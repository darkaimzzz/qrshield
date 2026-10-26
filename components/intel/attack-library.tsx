"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseUrl } from "@/lib/engine/parse"
import { scoreFindings } from "@/lib/engine/score"
import { analyzeStructure } from "@/lib/engine/structure"
import { classifyQrContent, CONTENT_GUIDANCE } from "@/lib/qr-content"
import { SEVERITY_STYLE } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"

interface Attack {
  title: string
  how: string
  signs: string[]
  /** Synthetic example (reserved .example domains / documentation IP ranges). */
  example: string
}

const ATTACKS: Attack[] = [
  {
    title: "Quishing (QR phishing)",
    how: "A phishing link delivered as a QR code (in an email, parcel slip or poster) so that email filters can't read it and the victim opens it on a less-protected phone.",
    signs: ["Unexpected codes asking you to “re-verify” or “unlock” an account", "Codes in emails that could simply have contained a link"],
    example: "https://mfa-reverify.example/m365/auth?user=staff",
  },
  {
    title: "Credential harvesting",
    how: "A cloned login page collects usernames, passwords and one-time codes, often relaying them live to the real service.",
    signs: ["Login pages on domains unrelated to the service", "Urgent wording: suspended, verify, unusual activity"],
    example: "http://secure-account-update.example/verify/login",
  },
  {
    title: "Fake payment QR codes",
    how: "Stickers placed over a merchant's real code, or codes sent by “buyers” claiming you must scan to receive money. Scanning a UPI QR can only send money, never receive it.",
    signs: ["A sticker covering another code", "Payee name in your app not matching the shop", "Anyone asking you to scan to receive a refund"],
    example: "upi://pay?pa=refund.desk@examplebank&pn=Refund%20Desk&am=4999&cu=INR&tn=Cashback",
  },
  {
    title: "URL shortening attacks",
    how: "A shortener hides the real destination and can be repointed after the code is printed, so a code that was safe yesterday can be malicious today.",
    signs: ["Short links on official signage where a full domain would be expected"],
    example: "https://bit.ly/3QrDemo1",
  },
  {
    title: "Redirect abuse",
    how: "Attackers abuse open-redirect parameters on trusted sites so the link starts on a reputable domain and ends somewhere else.",
    signs: ["A full URL inside the query string (url=, next=, redirect=)"],
    example: "https://trusted-portal.example/out?url=https%3A%2F%2Fcollect-login.example%2Fsignin",
  },
  {
    title: "Typosquatting",
    how: "Registering domains one typo away from a brand (missing, doubled or swapped letters, or digits for letters) and waiting for mistakes.",
    signs: ["Doubled or swapped letters", "Digits replacing letters (0 for o, 1 for l)"],
    example: "https://paypa1.com/signin",
  },
  {
    title: "Homograph domains",
    how: "Internationalized domains use letters from other alphabets that look identical to Latin ones. A Cyrillic “а” makes “pаypal.com” a different domain.",
    signs: ["xn-- in the address bar", "A familiar name with characters that render slightly differently"],
    example: "https://xn--pypal-4ve.com/login",
  },
  {
    title: "Malicious downloads",
    how: "The code links straight to an app package or installer, usually disguised as an update, a parking app or a ticketing app.",
    signs: ["Links ending in .apk, .exe or .msi", "Being asked to allow installs from unknown sources"],
    example: "https://parking-pay.example/download/ParkingApp_v2.apk",
  },
  {
    title: "Social engineering",
    how: "The surrounding story does the work: prizes, fines, deliveries or refunds create urgency so the victim doesn't stop to check the address.",
    signs: ["Countdowns and penalties", "Rewards that seem too generous"],
    example: "https://claim-reward-now.example/gift/bonus?urgent=1",
  },
]

function Result({ example }: { example: string }) {
  const content = classifyQrContent(example)
  if (content.kind !== "url") {
    const g = content.kind === "text" ? CONTENT_GUIDANCE.text : CONTENT_GUIDANCE[content.kind]
    return (
      <div className="mt-3 space-y-2 rounded-lg border border-border bg-black/30 p-3 text-sm">
        <p className="font-medium">{g.title} detected (not a web URL)</p>
        {"fields" in content &&
          content.fields.map((f) => (
            <p key={f.label} className="text-xs">
              <span className="text-muted-foreground">{f.label}: </span>
              <span className="font-mono">{f.value}</span>
            </p>
          ))}
        <p className="text-xs text-muted-foreground">{g.body}</p>
      </div>
    )
  }
  const p = parseUrl(example)
  if (!p.ok) return <p className="mt-3 text-sm text-red-300">{p.error}</p>
  const { findings, score } = scoreFindings(analyzeStructure(p.url).findings)
  return (
    <div className="mt-3 rounded-lg border border-border bg-black/30 p-3" data-testid="attack-result">
      <p className="mb-2 text-xs text-muted-foreground">
        Offline structural checks only: {findings.length} indicator(s), partial score {score}. Redirects, domain age and
        threat lists run in a full analysis.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {findings.length === 0 && <li className="text-xs text-muted-foreground">No structural indicators.</li>}
        {findings.map((f) => (
          <li key={f.id} className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", SEVERITY_STYLE[f.severity])}>
            {f.title} +{f.contribution}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AttackLibrary() {
  const [ran, setRan] = useState<Set<number>>(new Set())
  return (
    <section aria-labelledby="attacks-heading">
      <h2 id="attacks-heading" className="mb-1 text-lg font-semibold tracking-tight">How QR-based attacks work</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Each example is synthetic (reserved .example domains, not real attacks). Press run to see what QRShield&apos;s engine detects in it.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ATTACKS.map((a, i) => (
          <article key={a.title} className="surface flex flex-col p-5">
            <h3 className="font-medium">{a.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a.how}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {a.signs.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet" /> {s}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <p className="rounded-md bg-black/30 px-2 py-1.5 font-mono text-[11px] break-all text-muted-foreground">{a.example}</p>
              {ran.has(i) ? (
                <Result example={a.example} />
              ) : (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setRan((s) => new Set(s).add(i))}>
                  <Play /> Run engine on example
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
