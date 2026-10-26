import { bandLabel } from "./score"
import type {
  CheckSummary,
  Explanation,
  Finding,
  ParsedUrl,
  RedirectResult,
  RiskBand,
} from "./types"

const LEADS: Record<RiskBand, string> = {
  critical: "This destination shows strong indicators of a malicious or deceptive link.",
  high: "This destination contains several indicators commonly associated with phishing.",
  moderate: "This destination has some characteristics that warrant caution.",
  low: "QRShield did not detect significant risk indicators for this destination. That is not a guarantee that the site is safe.",
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/** Short lowercase noun phrase for each indicator, used inside the summary sentence. */
const PHRASES: Record<string, string> = {
  threat_intel_match: "a match on a known-malicious URL list",
  threat_intel_domain: "a domain that appears on a phishing blocklist",
  domain_new_30: "a domain registered within the last 30 days",
  domain_new_180: "a recently registered domain",
  ip_host: "a raw IP address in place of a domain name",
  brand_impersonation: "a hostname that resembles a well-known brand it does not belong to",
  homograph: "look-alike or internationalized characters in the hostname",
  credentials_in_url: "misleading “@” syntax that disguises the real host",
  domain_in_subdomain: "another domain name embedded in a misleading position",
  excessive_subdomains: "an unusually deep chain of subdomains",
  hyphenated_host: "a heavily hyphenated hostname",
  suspicious_keywords: "account-verification or urgency wording",
  shortener: "a URL shortener that hides the real destination",
  cross_domain_redirect: "a redirect to a different domain",
  redirect_downgrade: "a redirect from HTTPS to unencrypted HTTP",
  long_redirect_chain: "a long chain of redirects",
  embedded_redirect_param: "another web address embedded in the query string",
  no_https: "no HTTPS encryption",
  unusual_encoding: "unusual encoding or invisible characters",
  executable_download: "a direct link to a downloadable program",
  long_url: "an abnormally long URL",
  nonstandard_port: "a non-standard network port",
  random_hostname: "a randomly generated-looking domain name",
  unusual_tld: "a top-level domain that is frequently abused",
}

const CHECK_NAMES: Partial<Record<CheckSummary["id"], string>> = {
  domain: "domain registration",
  redirects: "redirect resolution",
  threat_intel: "threat-intelligence lookups",
}

export function buildSummary(input: {
  band: RiskBand
  score: number
  findings: Finding[]
  parsed: ParsedUrl
  redirects: RedirectResult
  checks: CheckSummary[]
}): string {
  const { band, findings, parsed, redirects, checks } = input
  const parts = [LEADS[band]]

  const top = findings.filter((f) => f.contribution > 0).slice(0, 3)
  if (top.length) {
    const lead = band === "low" ? "Minor observations include" : "Notable findings include"
    parts.push(`${lead} ${listJoin(top.map((f) => PHRASES[f.id] ?? f.title.toLowerCase()))}.`)
  }

  if (redirects.finalUrl && redirects.hops.length > 1) {
    const finalHost = redirects.hops[redirects.hops.length - 1].hostname
    if (finalHost !== parsed.hostname) parts.push(`The link redirects to ${finalHost}.`)
  }

  const incomplete = checks
    .filter((c) => c.status !== "done" && CHECK_NAMES[c.id])
    .map((c) => CHECK_NAMES[c.id]!)
  if (incomplete.length) {
    parts.push(
      `Some checks could not be completed (${listJoin(incomplete)}), so this assessment rests on partial evidence.`,
    )
  }
  return parts.join(" ")
}

export function buildRecommendations(band: RiskBand, findings: Finding[]): string[] {
  const ids = new Set(findings.map((f) => f.id))
  const recs: string[] = []

  if (band === "critical" || band === "high") {
    recs.push("Do not enter passwords, one-time codes, card numbers or UPI PINs on this site.")
    recs.push(
      "If the code claims to come from a company or bank you use, open their official app or type their address yourself instead of following this link.",
    )
    recs.push(
      "If the QR code is printed in a public place (parking meter, poster, menu), check whether it is a sticker placed over the original and tell the venue.",
    )
  } else if (band === "moderate") {
    recs.push("Confirm who placed this QR code before trusting it.")
    recs.push(
      "Before signing in or paying, check that the domain in the address bar is the organization you expect.",
    )
  } else {
    recs.push("Still verify the source of the QR code before providing sensitive information.")
    recs.push(
      "After opening, confirm the domain in the address bar matches the organization you expect.",
    )
  }

  if (ids.has("brand_impersonation") || ids.has("homograph")) {
    recs.push(
      "Reach the brand mentioned through its official website or app rather than this link.",
    )
  }
  if (ids.has("shortener") || ids.has("cross_domain_redirect")) {
    recs.push(
      "Review the resolved destination above. The QR code does not point where it first appears to.",
    )
  }
  if (ids.has("executable_download")) {
    recs.push("Do not install software from a scanned link. Use your device's official app store.")
  }
  if (ids.has("no_https")) {
    recs.push("Never enter credentials or payment details on a page without HTTPS.")
  }
  if (ids.has("domain_new_30") || ids.has("domain_new_180")) {
    recs.push("Be wary of newly registered domains, which are often used for short-lived scams.")
  }
  return recs
}

export function templateExplanation(input: Parameters<typeof buildSummary>[0]): Explanation {
  return {
    summary: buildSummary(input),
    recommendations: buildRecommendations(input.band, input.findings),
    generatedBy: "template",
    model: null,
  }
}

export { bandLabel }
