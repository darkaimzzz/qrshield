import { randomUUID } from "node:crypto"
import { templateExplanation } from "./explain"
import { makeFinding } from "./indicators"
import { llmExplanation } from "./llm"
import { classify } from "./ml"
import { parseUrl } from "./parse"
import { lookupDomain } from "./rdap"
import { inspectRedirects } from "./redirects"
import { scoreFindings } from "./score"
import { analyzeStructure } from "./structure"
import { checkThreatIntel, warmThreatFeeds, type ThreatProvider } from "./threat-intel"
import {
  REPORT_VERSION,
  type AnalyzeEvent,
  type CheckStatus,
  type CheckSummary,
  type DomainInfo,
  type Finding,
  type InputSource,
  type RedirectResult,
  type Report,
  type StageId,
  type ThreatIntelResult,
} from "./types"

export class InputError extends Error {}

/** Providers whose match means "this exact URL is known-bad" (vs. domain-level listings). */
const URL_LEVEL_PROVIDERS = new Set(["openphish", "google_safe_browsing", "urlhaus"])

export interface AnalyzeDeps {
  inspectRedirects: typeof inspectRedirects
  lookupDomain: typeof lookupDomain
  checkThreatIntel: (urls: string[], providers?: ThreatProvider[]) => Promise<ThreatIntelResult>
  warmThreatFeeds: () => void
}

const defaultDeps: AnalyzeDeps = { inspectRedirects, lookupDomain, checkThreatIntel, warmThreatFeeds }

function redirectFindings(r: RedirectResult): Finding[] {
  const out: Finding[] = []
  const chain = r.hops.map((h) => h.hostname)
  if (r.hops.some((h) => h.crossDomain)) {
    out.push(
      makeFinding(
        "cross_domain_redirect",
        "The link sends visitors on to a different domain. Legitimate services do this too (for example, shorteners and login providers), but the site you finally land on is the one that matters.",
        [`Chain: ${chain.join(" → ")}`],
      ),
    )
  }
  for (let i = 1; i < r.hops.length; i++) {
    if (r.hops[i - 1].url.startsWith("https:") && r.hops[i].url.startsWith("http:")) {
      out.push(
        makeFinding(
          "redirect_downgrade",
          "A redirect moves the connection from encrypted HTTPS to unencrypted HTTP.",
          [`${r.hops[i - 1].url} → ${r.hops[i].url}`],
        ),
      )
      break
    }
  }
  if (r.hops.length - 1 >= 3 || r.truncated || r.loop) {
    out.push(
      makeFinding(
        "long_redirect_chain",
        "The link passes through several redirects before reaching its destination, which makes the final site harder to anticipate.",
        [r.loop ? "Redirect loop detected" : `${r.hops.length - 1} redirects${r.truncated ? " (chain continues)" : ""}`],
      ),
    )
  }
  return out
}

function domainFindings(d: DomainInfo): Finding[] {
  if (d.ageDays === null) return []
  const evidence = [
    `Registered: ${d.registrationDate?.slice(0, 10)} (${d.ageDays} days ago)`,
    `Source: RDAP ${d.source}`,
  ]
  if (d.ageDays < 30) {
    return [
      makeFinding(
        "domain_new_30",
        "The domain was registered less than a month ago. Phishing sites are often set up on fresh domains and abandoned quickly; new legitimate sites exist too, so this is a risk signal rather than proof.",
        evidence,
      ),
    ]
  }
  if (d.ageDays < 180) {
    return [
      makeFinding(
        "domain_new_180",
        "The domain is less than six months old. Recently registered domains are statistically more likely to be used for abuse, though most are legitimate.",
        evidence,
      ),
    ]
  }
  return []
}

function threatFindings(t: ThreatIntelResult): Finding[] {
  const matches = t.providers.filter((p) => p.status === "match")
  const urlMatches = matches.filter((p) => URL_LEVEL_PROVIDERS.has(p.id))
  const domainMatches = matches.filter((p) => !URL_LEVEL_PROVIDERS.has(p.id))
  const out: Finding[] = []
  if (urlMatches.length) {
    out.push(
      makeFinding(
        "threat_intel_match",
        "This URL appears on a threat-intelligence list of known malicious links. Treat it as dangerous.",
        urlMatches.map((p) => `${p.name}: ${p.detail}`),
      ),
    )
  }
  if (domainMatches.length) {
    out.push(
      makeFinding(
        "threat_intel_domain",
        "The destination's domain appears on a community-maintained list of active phishing domains. Such lists can occasionally include compromised or shared domains, but a listing is strong evidence of abuse.",
        domainMatches.map((p) => `${p.name}: ${p.detail}`),
      ),
    )
  }
  return out
}

/** Merges findings from the final destination into the original list without double counting. */
function mergeFindings(base: Finding[], extra: Finding[], label: string): Finding[] {
  const out = [...base]
  for (const f of extra) {
    const existing = out.find((e) => e.id === f.id)
    const tagged = f.evidence.map((e) => `${label}: ${e}`)
    if (existing) existing.evidence = [...existing.evidence, ...tagged]
    else out.push({ ...f, evidence: tagged })
  }
  return out
}

const STAGE_LABELS: Record<StageId, string> = {
  decode: "QR decoding",
  structure: "URL structure analysis",
  domain: "Domain inspection",
  redirects: "Redirect investigation",
  threat_intel: "Threat intelligence checks",
  scoring: "Risk calculation",
  report: "Report generation",
}

export async function analyze(
  rawInput: string,
  source: InputSource,
  emit: (e: AnalyzeEvent) => void = () => {},
  deps: AnalyzeDeps = defaultDeps,
): Promise<Report> {
  const stage = (s: StageId, status: "running" | CheckStatus, detail?: string) =>
    emit({ type: "stage", stage: s, status, detail })

  // Start downloading blocklists now so the threat-intel stage does not wait on them later.
  deps.warmThreatFeeds()

  // 1. Structure (offline)
  stage("structure", "running")
  const p = parseUrl(rawInput)
  if (!p.ok) {
    stage("structure", "failed", p.error)
    throw new InputError(p.error)
  }
  const parsed = p.url
  const structure = analyzeStructure(parsed)
  let findings = structure.findings
  stage("structure", "done", `${findings.length} structural indicator(s)`)

  // 2. Redirects (network, SSRF-guarded)
  stage("redirects", "running")
  const redirects = await deps.inspectRedirects(parsed.normalized)
  stage("redirects", redirects.status, redirects.detail)
  findings = [...findings, ...redirectFindings(redirects)]

  // The final destination gets the same offline analysis as the scanned URL.
  let destinationHost = parsed.hostname
  let destinationIsIp = parsed.isIp
  if (redirects.finalUrl && redirects.finalUrl !== parsed.normalized) {
    const fp = parseUrl(redirects.finalUrl)
    if (fp.ok && fp.url.registrableDomain !== parsed.registrableDomain) {
      findings = mergeFindings(findings, analyzeStructure(fp.url).findings, "Final destination")
      destinationHost = fp.url.hostname
      destinationIsIp = fp.url.isIp
    }
  }

  // 3. Domain registration + 4. threat intelligence, in parallel
  stage("domain", "running")
  stage("threat_intel", "running")
  const urlsToCheck = [...new Set([parsed.normalized, ...redirects.hops.map((h) => h.url)])]
  const [domain, threatIntel] = await Promise.all([
    deps.lookupDomain(destinationHost, destinationIsIp).then((d) => {
      stage("domain", d.status, d.detail)
      return d
    }),
    deps.checkThreatIntel(urlsToCheck).then((t) => {
      const checked = t.providers.filter((x) => x.status === "match" || x.status === "no_match").length
      stage("threat_intel", t.status, `${checked} of ${t.providers.length} sources checked`)
      return t
    }),
  ])
  findings = [...findings, ...domainFindings(domain), ...threatFindings(threatIntel)]

  // 5. Scoring + ML (independent outputs; ML is never folded into the score)
  stage("scoring", "running")
  const scored = scoreFindings(findings)
  const ml = classify(destinationHost)
  stage("scoring", "done", `Score ${scored.score}/100`)

  // 6. Report
  stage("report", "running")
  const statusOf: Record<StageId, CheckStatus> = {
    decode: "done",
    structure: "done",
    domain: domain.status,
    redirects: redirects.status,
    threat_intel: threatIntel.status,
    scoring: "done",
    report: "done",
  }
  const details: Partial<Record<StageId, string>> = {
    structure: `${structure.findings.length} structural indicator(s) on the scanned URL`,
    domain: domain.detail,
    redirects: redirects.detail,
    threat_intel: threatIntel.providers.map((x) => `${x.name}: ${x.status.replace("_", " ")}`).join("; "),
    scoring: `${scored.findings.length} finding(s), score ${scored.score}`,
  }
  const checks: CheckSummary[] = (["structure", "domain", "redirects", "threat_intel", "scoring"] as const).map(
    (id) => ({ id, label: STAGE_LABELS[id], status: statusOf[id], detail: details[id] ?? "" }),
  )

  const limitations = [
    "QRShield inspects the link and its HTTP redirects only. It does not render pages or run scripts, so JavaScript or meta-refresh redirects and the page's actual content are not analyzed.",
    "Threat-intelligence lists only contain threats that have already been reported; new phishing sites often go live before they are listed.",
  ]
  if (parsed.assumedProtocol) limitations.push("No scheme was provided, so https:// was assumed.")
  if (domain.status !== "done") limitations.push(`Domain registration data unavailable: ${domain.detail}`)
  else if (domain.ageDays === null) limitations.push("Domain age could not be determined from the registry response.")
  if (redirects.status !== "done") limitations.push(`Redirects were not resolved: ${redirects.detail}`)
  if (threatIntel.providers.every((x) => x.status !== "no_match" && x.status !== "match")) {
    limitations.push("No threat-intelligence source could be queried; absence of a listing was not checked.")
  }

  const base = {
    score: scored.score,
    band: scored.band,
    findings: scored.findings,
    parsed,
    redirects,
    checks,
  }
  const template = templateExplanation(base)
  const explanation = await llmExplanation(base, template)
  stage("report", "done")

  return {
    version: REPORT_VERSION,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    input: rawInput.trim(),
    lexical: structure.lexical,
    domain,
    threatIntel,
    ml,
    explanation,
    limitations,
    ...base,
  }
}
