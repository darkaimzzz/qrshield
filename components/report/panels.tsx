"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import {
  ArrowDown,
  Brain,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleX,
  Database,
  Globe,
  Info,
  ListChecks,
  Route,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import type { Finding, ProviderResult, Report } from "@/lib/engine/types"
import { CATEGORY_LABEL, SEVERITY_STYLE } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"

export function Panel({
  title,
  icon: Icon,
  children,
  className,
  aside,
  id,
}: {
  title: string
  icon: typeof Globe
  children: React.ReactNode
  className?: string
  aside?: React.ReactNode
  id?: string
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("surface print-break min-w-0 p-5", className)}
      aria-label={title}
    >
      <div className="border-border -mx-5 -mt-5 mb-4 flex items-center justify-between gap-3 border-b border-dashed px-5 py-2.5">
        <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase">
          <Icon className="text-primary size-3.5" />
          <span className="text-primary" aria-hidden="true">
            {">"}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </motion.section>
  )
}

function Row({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="border-border/60 grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 border-b border-dashed py-2 text-[13px] last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-all", mono && "font-mono text-[13px]")}>{children}</dd>
    </div>
  )
}

const Unavailable = ({ children = "Unavailable" }: { children?: React.ReactNode }) => (
  <span className="text-muted-foreground italic">{children}</span>
)

export function SummaryPanel({ report }: { report: Report }) {
  return (
    <Panel
      title="Executive security summary"
      icon={ShieldAlert}
      aside={
        <span className="border-border text-muted-foreground inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] tracking-wider uppercase">
          {report.explanation.generatedBy === "llm" ? (
            <>
              <Sparkles className="text-signal size-3" /> AI-generated wording (
              {report.explanation.model})
            </>
          ) : (
            "Generated from findings"
          )}
        </span>
      }
    >
      <p className="leading-relaxed text-pretty" data-testid="summary">
        {report.explanation.summary}
      </p>
    </Panel>
  )
}

export function UrlIntelPanel({ report }: { report: Report }) {
  const { parsed: p, lexical: l, redirects } = report
  const patterns = [
    l.suspiciousKeywords.length && `Keywords: ${l.suspiciousKeywords.join(", ")}`,
    l.percentEncodedCount && `${l.percentEncodedCount} percent-encoded chars`,
    l.repeatedSeparators && `${l.repeatedSeparators} repeated separators`,
    l.atSymbol && "“@” in address",
    l.isPunycode && "Punycode label",
    l.embeddedUrlInQuery && "URL inside query",
  ].filter(Boolean) as string[]
  return (
    <Panel title="URL intelligence" icon={Globe}>
      <dl>
        <Row label="Original input" mono>
          {report.input}
        </Row>
        <Row label="Normalized URL" mono>
          {p.normalized}
        </Row>
        <Row label="Final URL" mono>
          {redirects.finalUrl ?? (
            <Unavailable>
              {redirects.status === "done"
                ? "Not resolved"
                : "Not resolved (redirect check did not run)"}
            </Unavailable>
          )}
        </Row>
        <Row label="Protocol">
          {p.protocol.replace(":", "").toUpperCase()}
          {p.assumedProtocol && <span className="text-risk-moderate ml-2 text-xs">(assumed)</span>}
        </Row>
        <Row label="Hostname" mono>
          {p.hostname}
          {p.hostnameUnicode !== p.hostname && (
            <span className="text-muted-foreground block text-xs">
              Displays as: {p.hostnameUnicode}
            </span>
          )}
        </Row>
        <Row label="Subdomain" mono>
          {p.subdomain || <Unavailable>None</Unavailable>}
        </Row>
        <Row label="Registrable domain" mono>
          {p.registrableDomain ?? (
            <Unavailable>{p.isIp ? "N/A (IP address)" : "Unknown"}</Unavailable>
          )}
        </Row>
        <Row label="Public suffix" mono>
          {p.publicSuffix ?? <Unavailable>N/A</Unavailable>}
        </Row>
        <Row label="URL length">{l.urlLength} characters</Row>
        <Row label="HTTPS">
          {p.protocol === "https:" ? "Yes" : <span className="text-risk-moderate">No</span>}
        </Row>
        <Row label="Port">{p.port || `${p.effectivePort} (default)`}</Row>
        <Row label="Path depth">{l.pathDepth}</Row>
        <Row label="Lexical patterns">
          {patterns.length ? (
            <span className="flex flex-wrap gap-1.5">
              {patterns.map((x) => (
                <span
                  key={x}
                  className="border-border bg-muted rounded-md border px-1.5 py-0.5 text-xs"
                >
                  {x}
                </span>
              ))}
            </span>
          ) : (
            <Unavailable>None detected</Unavailable>
          )}
        </Row>
      </dl>
    </Panel>
  )
}

export function RedirectPanel({ report }: { report: Report }) {
  const r = report.redirects
  return (
    <Panel title="Redirect chain" icon={Route} aside={<StatusChip status={r.status} />}>
      {r.hops.length === 0 ? (
        <p className="text-muted-foreground text-sm">{r.detail}</p>
      ) : (
        <ol className="flex flex-col" data-testid="redirect-chain">
          {r.hops.map((h, i) => (
            <li key={`${h.url}-${i}`} className="flex flex-col items-stretch">
              {i > 0 && (
                <span className="text-muted-foreground flex items-center gap-2 py-1 pl-4 text-xs">
                  <ArrowDown className="size-3.5" />
                  {h.crossDomain && (
                    <span className="border-risk-moderate/40 bg-risk-moderate/10 text-risk-moderate rounded border px-1.5 py-px">
                      Cross-domain
                    </span>
                  )}
                </span>
              )}
              <div
                className={cn(
                  "bg-background/40 rounded-xl border p-3",
                  h.error
                    ? "border-risk-critical/30"
                    : i === r.hops.length - 1
                      ? "border-primary/40"
                      : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{h.hostname}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {h.status ?? "n/a"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-xs break-all">{h.url}</p>
                {h.error && <p className="text-risk-critical mt-1 text-xs">{h.error}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {r.hops.length > 0 && <p className="text-muted-foreground mt-3 text-xs">{r.detail}</p>}
    </Panel>
  )
}

export function DomainPanel({ report }: { report: Report }) {
  const d = report.domain
  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { dateStyle: "medium" }) : null
  return (
    <Panel
      title="Domain intelligence"
      icon={CalendarClock}
      aside={<StatusChip status={d.status} />}
    >
      <dl>
        <Row label="Domain" mono>
          {d.domain ?? <Unavailable>N/A</Unavailable>}
        </Row>
        <Row label="Registered">{fmt(d.registrationDate) ?? <Unavailable />}</Row>
        <Row label="Domain age">
          {d.ageDays !== null ? `${d.ageDays.toLocaleString()} days` : <Unavailable />}
        </Row>
        <Row label="Registrar">{d.registrar ?? <Unavailable />}</Row>
        <Row label="Expires">{fmt(d.expirationDate) ?? <Unavailable />}</Row>
        <Row label="Data source" mono>
          {d.source ? `RDAP · ${d.source}` : <Unavailable>None</Unavailable>}
        </Row>
      </dl>
      <p className="text-muted-foreground mt-3 text-xs">{d.detail}</p>
    </Panel>
  )
}

export function FindingCard({
  finding,
  open,
  onToggle,
}: {
  finding: Finding
  open: boolean
  onToggle: () => void
}) {
  return (
    <li
      className="border-border bg-background/40 rounded-xl border"
      data-testid="finding"
      data-finding-id={finding.id}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className={cn(
            "shrink-0 border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
            SEVERITY_STYLE[finding.severity],
          )}
        >
          {finding.severity}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">{finding.title}</span>
        <span
          className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
          title="Points added to the score"
        >
          +{finding.contribution}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 text-sm">
              <p className="text-muted-foreground">{finding.explanation}</p>
              <div>
                <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                  Evidence
                </p>
                <ul className="space-y-1">
                  {finding.evidence.map((e) => (
                    <li
                      key={e}
                      className="rounded-md bg-black/30 px-2 py-1 font-mono text-xs break-all"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-muted-foreground text-xs">
                Category: {CATEGORY_LABEL[finding.category]} · Weight {finding.weight}
                {finding.contribution !== finding.weight &&
                  ` · counted at ${finding.contribution} because a related indicator in the “${finding.group}” group already counts in full`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

export function FindingsPanel({ report, expandAll }: { report: Report; expandAll: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return (
    <Panel
      id="findings"
      title="Threat indicators"
      icon={TriangleAlert}
      aside={
        <span className="text-muted-foreground text-xs">
          {report.findings.length} found · total {report.score}
        </span>
      }
    >
      {report.findings.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          No risk indicators were detected by the checks that ran. This does not prove the
          destination is safe. See limitations below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {report.findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              open={expandAll || open.has(f.id)}
              onToggle={() => toggle(f.id)}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}

const PROVIDER_STYLE: Record<
  ProviderResult["status"],
  { label: string; icon: typeof CircleCheck; cls: string }
> = {
  match: { label: "Match", icon: CircleX, cls: "text-risk-critical" },
  no_match: { label: "Not listed", icon: CircleCheck, cls: "text-risk-low" },
  not_checked: { label: "Not checked", icon: CircleDashed, cls: "text-muted-foreground" },
  error: { label: "Not checked (error)", icon: CircleDashed, cls: "text-risk-moderate" },
}

export function ThreatIntelPanel({ report }: { report: Report }) {
  return (
    <Panel
      title="Threat intelligence"
      icon={Database}
      aside={<StatusChip status={report.threatIntel.status} />}
    >
      <ul className="flex flex-col gap-2">
        {report.threatIntel.providers.map((p) => {
          const s = PROVIDER_STYLE[p.status]
          return (
            <li
              key={p.id}
              className="border-border bg-background/40 flex items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <s.icon className={cn("mt-0.5 size-4 shrink-0", s.cls)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.name}</span>
                <span className="text-muted-foreground block text-xs">{p.detail}</span>
              </span>
              <span className={cn("shrink-0 text-xs", s.cls)}>{s.label}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">
        “Not listed” only means the URL is not on that list today. Lists cannot prove a URL is safe.
      </p>
    </Panel>
  )
}

export function MlPanel({ report }: { report: Report }) {
  const ml = report.ml
  return (
    <Panel title="Machine learning analysis" icon={Brain}>
      {ml.status === "unavailable" || ml.probability === null ? (
        <p className="text-muted-foreground text-sm">Model unavailable: {ml.detail}</p>
      ) : (
        <div className="space-y-4" data-testid="ml-panel">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Estimated phishing probability</span>
              <span className="text-signal text-2xl font-bold tabular-nums">
                {(ml.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="overflow-hidden text-xs whitespace-pre" aria-hidden="true">
              <span className="text-signal">{"█".repeat(Math.round(ml.probability * 30))}</span>
              <span className="text-primary/20">
                {"░".repeat(30 - Math.round(ml.probability * 30))}
              </span>
            </div>
          </div>
          {ml.topFactors.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs tracking-wide uppercase">
                Strongest model inputs
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {ml.topFactors.map((f) => (
                  <li
                    key={f.feature}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 font-mono text-[11px]",
                      f.impact > 0
                        ? "border-risk-high/30 text-risk-high"
                        : "border-risk-low/30 text-primary",
                    )}
                    title={f.impact > 0 ? "Pushed toward phishing" : "Pushed toward legitimate"}
                  >
                    {f.feature} {f.impact > 0 ? "▲" : "▼"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="border-signal/25 bg-signal/5 text-muted-foreground flex gap-2 rounded-lg border p-3 text-xs">
            <Info className="text-signal mt-px size-3.5 shrink-0" />
            <span>
              {ml.detail} Model: {ml.modelName}. A statistical prediction from the hostname that may
              be wrong. See the methodology page for its measured accuracy.
            </span>
          </p>
        </div>
      )}
    </Panel>
  )
}

export function RecommendationsPanel({ report }: { report: Report }) {
  return (
    <Panel title="Recommended actions" icon={ListChecks}>
      <ul className="flex flex-col gap-2 text-sm">
        {report.explanation.recommendations.map((r) => (
          <li key={r} className="flex gap-2">
            <span className="text-primary shrink-0" aria-hidden="true">
              {">"}
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function LimitationsPanel({ report }: { report: Report }) {
  return (
    <Panel title="Checks & limitations" icon={Info}>
      <ul className="mb-4 grid gap-2 sm:grid-cols-2">
        {report.checks.map((c) => (
          <li
            key={c.id}
            className="border-border bg-background/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <span>{c.label}</span>
            <StatusChip status={c.status} />
          </li>
        ))}
      </ul>
      <ul className="text-muted-foreground flex flex-col gap-1.5 text-xs">
        {report.limitations.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="shrink-0" aria-hidden="true">
              {"--"}
            </span>{" "}
            {l}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "border-risk-low/30 text-primary",
    failed: "border-risk-critical/30 text-risk-critical",
    skipped: "border-border text-muted-foreground",
    not_configured: "border-border text-muted-foreground",
  }
  const label: Record<string, string> = {
    done: "Completed",
    failed: "Failed",
    skipped: "Skipped",
    not_configured: "Not configured",
  }
  return (
    <span
      className={cn(
        "shrink-0 border px-1.5 py-0.5 text-[10px] tracking-wider uppercase",
        map[status],
      )}
    >
      {label[status] ?? status}
    </span>
  )
}
