import type { Metadata } from "next"
import { BRANDS } from "@/lib/engine/impersonation"
import { INDICATORS } from "@/lib/engine/indicators"
import { MODEL } from "@/lib/engine/ml"
import { MAX_REDIRECTS } from "@/lib/engine/redirects"
import { BANDS, GROUP_DAMPING, THREAT_MATCH_FLOOR } from "@/lib/engine/score"
import { CATEGORY_LABEL, SEVERITY_STYLE } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Methodology" }

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="surface scroll-mt-24 p-5 sm:p-7">
      <h2 id={`${id}-h`} className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  )
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export default function MethodologyPage() {
  const m = MODEL.metrics
  const cm = m.confusion_matrix
  const indicators = Object.entries(INDICATORS).sort((a, b) => b[1].weight - a[1].weight)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Methodology</h1>
        <p className="mt-2 text-muted-foreground">
          What QRShield checks, how the score is calculated, what the machine-learning model is (and isn&apos;t), and where the limits are.
        </p>
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-2 text-xs">
          {[["what", "Overview"], ["checks", "Checks"], ["score", "Risk score"], ["ml", "Machine learning"], ["limits", "Limitations"], ["privacy", "Privacy"]].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-primary/50 hover:text-foreground">{l}</a>
          ))}
        </nav>
      </header>

      <Section id="what" title="What QRShield does">
        <p>
          A QR code hides its destination until you open it. QRShield decodes the code on your device and inspects the link <strong>without
          opening it in your browser</strong>. The server examines the URL text, follows HTTP redirects with security-hardened requests that never
          download page content, looks up the domain&apos;s registration date, and checks threat-intelligence lists. It then produces an
          explainable report.
        </p>
      </Section>

      <Section id="checks" title="Checks performed">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>URL validation</strong>: only http/https; javascript:, data:, file: and other schemes are rejected; control characters, oversized input and invalid hostnames are refused; credentials embedded in the URL are recorded but stripped.</li>
          <li><strong>Lexical analysis</strong>: length, subdomain depth, encoding, entropy, hyphens, IP hosts, punycode, invisible characters and lure keywords. Domains are split with the Public Suffix List, so <span className="font-mono">example.co.uk</span> is handled correctly. A keyword alone never counts.</li>
          <li><strong>Impersonation</strong>: brand names in subdomains of unrelated domains, brand + lure-word domains, typosquats (edit distance), homoglyph look-alikes and mixed-script labels, checked against a reference list of {BRANDS.length} frequently impersonated brands and the domains they actually use. Matches are reported as <em>possible</em> impersonation.</li>
          <li><strong>Redirects</strong>: up to {MAX_REDIRECTS} hops, HEAD (or header-only GET) requests. Every hop is re-validated; private, loopback, link-local, metadata and other non-public addresses are blocked at DNS-resolution time and the connection is pinned to the validated IP (DNS-rebinding safe); only ports 80/443; strict timeouts.</li>
          <li><strong>Domain age</strong>: RDAP, the IETF successor to WHOIS, via the IANA bootstrap registry. Missing data is shown as unavailable, never guessed.</li>
          <li><strong>Threat intelligence</strong>: Phishing.Database (MIT-licensed community list of active phishing domains) by default; optionally Google Safe Browsing, abuse.ch URLhaus (free API keys) and the OpenPhish community feed (opt-in, non-commercial terms). A source that was not queried is reported as “Not checked”, never as clean.</li>
        </ul>
      </Section>

      <Section id="score" title="How the risk score works">
        <p>
          The score is a deterministic sum of weighted evidence. Each finding carries a fixed weight. Indicators that describe overlapping
          evidence share a <strong>correlation group</strong>: the strongest counts in full and others count at {GROUP_DAMPING * 100}%, so
          one underlying problem is not counted twice. The total is capped at 100. A verified URL-level threat-intelligence match sets a
          floor of {THREAT_MATCH_FLOOR}. Checks that could not run add nothing and are listed separately, because missing evidence is not
          the same as passing.
        </p>
        <div className="flex flex-wrap gap-2">
          {BANDS.slice().reverse().map((b, i, arr) => (
            <span key={b.band} className="rounded-md border border-border px-2 py-1 text-xs text-foreground">
              {b.min}–{i < arr.length - 1 ? arr[i + 1].min - 1 : 100}: {b.label}
            </span>
          ))}
        </div>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-1 py-2 font-medium">Indicator</th>
                <th className="px-1 py-2 font-medium">Category</th>
                <th className="px-1 py-2 font-medium">Severity</th>
                <th className="px-1 py-2 font-medium">Group</th>
                <th className="px-1 py-2 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map(([id, ind]) => (
                <tr key={id} className="border-b border-border/60 text-foreground">
                  <td className="px-1 py-1.5">{ind.title}</td>
                  <td className="px-1 py-1.5 text-muted-foreground">{CATEGORY_LABEL[ind.category]}</td>
                  <td className="px-1 py-1.5"><span className={cn("rounded border px-1.5 py-px capitalize", SEVERITY_STYLE[ind.severity])}>{ind.severity}</span></td>
                  <td className="px-1 py-1.5 font-mono text-muted-foreground">{"group" in ind ? ind.group : "-"}</td>
                  <td className="px-1 py-1.5 text-right font-mono tabular-nums">+{ind.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Worked example.</strong> A shortener (+12) that redirects to another domain (+12, same “redirect” group, so +6) whose
          page is plain HTTP (+10) scores 28: Moderate. These weights are engineering heuristics, not measured probabilities.
        </p>
      </Section>

      <Section id="ml" title="Machine learning vs rule-based detection">
        <p>
          The risk score comes from transparent rules. Separately, QRShield runs a <strong>trained logistic-regression model</strong> on the
          destination hostname and shows its output as an &ldquo;estimated phishing probability&rdquo;. The two are never averaged: they
          answer different questions, and the model&apos;s output is not calibrated.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dataset: <strong>{MODEL.dataset.name}</strong> ({MODEL.dataset.license}), retrieved {MODEL.dataset.retrieved}, {MODEL.dataset.unique_hostnames.toLocaleString("en-US")} unique hostnames after de-duplication ({MODEL.dataset.class_counts.phishing.toLocaleString("en-US")} phishing / {MODEL.dataset.class_counts.legitimate.toLocaleString("en-US")} legitimate).</li>
          <li>Features: {MODEL.features.length} lexical hostname features (length, labels, digits, entropy, keywords, TLD). Paths are deliberately excluded because the dataset&apos;s legitimate URLs are mostly bare homepages, which would teach the model an artifact.</li>
          <li>Split: grouped by registrable domain so the same site never appears in both training and test data.</li>
        </ul>
        <div className="grid gap-2 sm:grid-cols-5">
          {[["Precision", m.precision], ["Recall", m.recall], ["F1", m.f1], ["ROC-AUC", m.roc_auc], ["Accuracy", m.accuracy]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-border bg-background/40 p-3">
              <p className="text-xs">{k}</p>
              <p className="font-mono text-lg text-foreground tabular-nums">{(v as number).toFixed(3)}</p>
            </div>
          ))}
        </div>
        <p>
          Held-out test set ({(m.support.phishing + m.support.legitimate).toLocaleString("en-US")} hostnames, threshold 0.5): {cm.tp.toLocaleString("en-US")} true positives,
          {" "}{cm.fp.toLocaleString("en-US")} false positives, {cm.fn.toLocaleString("en-US")} false negatives, {cm.tn.toLocaleString("en-US")} true negatives. The model misses about{" "}
          {pct(cm.fn / (cm.fn + cm.tp))} of phishing hostnames and wrongly flags about {pct(cm.fp / (cm.fp + cm.tn))} of legitimate ones on this data. Real-world performance on QR
          destinations will differ. Training is reproducible with <span className="font-mono">ml/train.py</span>.
        </p>
      </Section>

      <Section id="limits" title="Limitations and false positives">
        <ul className="list-disc space-y-1 pl-5">
          <li>Pages are not rendered: JavaScript/meta-refresh redirects, page content and phishing kits are invisible to QRShield.</li>
          <li>Legitimate sites can trigger indicators: marketing links are long, partners use brand names, regional brand domains may be missing from the reference list, and new businesses have new domains.</li>
          <li>Attackers can avoid every lexical signal by using a clean-looking domain or a compromised legitimate site.</li>
          <li>Threat lists only know reported threats; brand-new phishing sites are often not yet listed.</li>
          <li>RDAP coverage varies by registry; some ccTLDs publish no RDAP service or omit dates.</li>
          <li>Redirect results are what QRShield&apos;s server saw. Sites can serve different responses to different visitors (cloaking).</li>
        </ul>
      </Section>

      <Section id="privacy" title="Privacy and what is verified">
        <ul className="list-disc space-y-1 pl-5">
          <li>Images and camera frames are decoded in your browser and never uploaded or stored.</li>
          <li>Only the decoded URL is sent to QRShield&apos;s server for analysis. When configured, the URL is also sent to the enabled threat-intelligence providers.</li>
          <li>Scan history is stored in this browser&apos;s local storage and can be deleted at any time.</li>
          <li><strong>Verified</strong>: what the parser, DNS, RDAP registry and threat lists returned at scan time. <strong>Not verified</strong>: who operates a site, what the page contains, or whether a possible impersonation is real.</li>
        </ul>
        <p>
          <strong>Why no tool can guarantee a URL is safe:</strong> safety depends on what a site does after you arrive, and that can change
          at any moment, differ per visitor, or rely on information you type in. A low score means few warning signs were found, not that
          there is no risk.
        </p>
      </Section>
    </div>
  )
}
