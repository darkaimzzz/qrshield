"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { parseUrl } from "@/lib/engine/parse"

const PARTS = [
  {
    key: "protocol",
    label: "Protocol",
    cls: "border-sky-400/40 bg-sky-400/10 text-sky-200",
    note: "How the browser connects. https encrypts the connection, but phishing sites use it too.",
  },
  {
    key: "subdomain",
    label: "Subdomain",
    cls: "border-violet/40 bg-violet/10 text-violet-200",
    note: "Chosen freely by whoever owns the domain, so it can contain any brand name.",
  },
  {
    key: "domain",
    label: "Registrable domain",
    cls: "border-primary/50 bg-primary/15 text-cyan-100",
    note: "The part someone actually registered. This decides who controls the site.",
  },
  {
    key: "port",
    label: "Port",
    cls: "border-pink-400/40 bg-pink-400/10 text-pink-200",
    note: "Network port. Unusual on public websites.",
  },
  {
    key: "path",
    label: "Path",
    cls: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    note: "Which page on the site. Can contain anything, including other domain names.",
  },
  {
    key: "query",
    label: "Query",
    cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    note: "Parameters for the page. Sometimes hides a second URL to redirect to.",
  },
  {
    key: "fragment",
    label: "Fragment",
    cls: "border-slate-400/40 bg-slate-400/10 text-slate-200",
    note: "Never sent to the server; used only by the page itself.",
  },
] as const

export function UrlAnatomy() {
  const [value, setValue] = useState(
    "https://login.paypal.com.secure-verify.example:8443/account/update?session=1&next=https%3A%2F%2Fevil.example#step2",
  )
  const r = parseUrl(value)
  const parts: Partial<Record<(typeof PARTS)[number]["key"], string>> = r.ok
    ? {
        protocol: `${r.url.protocol}//`,
        subdomain: r.url.subdomain ? `${r.url.subdomain}.` : undefined,
        domain: r.url.registrableDomain ?? r.url.hostname,
        port: r.url.port ? `:${r.url.port}` : undefined,
        path: r.url.pathname !== "/" ? r.url.pathname : undefined,
        query: r.url.search || undefined,
        fragment: r.url.hash || undefined,
      }
    : {}

  return (
    <section className="surface p-5" aria-labelledby="anatomy-heading">
      <h2 id="anatomy-heading" className="font-semibold">
        URL anatomy
      </h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">
        Type any address to see which part decides where you actually land. It is parsed with the
        same public-suffix-aware parser QRShield uses.
      </p>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="URL to dissect"
        className="h-11 font-mono text-sm"
        spellCheck={false}
      />
      {r.ok ? (
        <>
          <div
            className="border-border mt-4 flex flex-wrap gap-y-2 rounded-xl border bg-black/30 p-3 font-mono text-sm break-all"
            data-testid="url-anatomy"
          >
            {PARTS.map((p) =>
              parts[p.key] ? (
                <span key={p.key} className={`rounded border px-1 py-0.5 ${p.cls}`} title={p.label}>
                  {parts[p.key]}
                </span>
              ) : null,
            )}
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {PARTS.filter((p) => parts[p.key]).map((p) => (
              <div key={p.key} className="flex gap-2 text-sm">
                <dt className={`h-fit shrink-0 rounded border px-1.5 text-xs ${p.cls}`}>
                  {p.label}
                </dt>
                <dd className="text-muted-foreground">{p.note}</dd>
              </div>
            ))}
          </dl>
          {r.url.registrableDomain && (
            <p className="border-primary/30 bg-primary/5 mt-4 rounded-lg border p-3 text-sm">
              This link is controlled by{" "}
              <span className="text-primary font-mono font-medium">{r.url.registrableDomain}</span>
              {r.url.subdomain && (
                <>
                  , regardless of what the subdomain{" "}
                  <span className="font-mono">{r.url.subdomain}</span> says
                </>
              )}
              .
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {r.error}
        </p>
      )}
    </section>
  )
}
