"use client"

import Link from "next/link"
import { ArrowRight, History, ScanLine } from "lucide-react"
import { useHistory, useHydrated } from "@/lib/history"
import { BAND_STYLE, formatDateTime, SOURCE_LABEL } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"

export function RecentScans() {
  const history = useHistory()
  const hydrated = useHydrated()
  const recent = history.slice(0, 5)

  return (
    <section aria-labelledby="recent-heading" className="surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="recent-heading" className="flex items-center gap-2 font-semibold">
          <History className="size-4 text-primary" /> Recent scans
        </h2>
        {history.length > 0 && (
          <Link href="/history" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {!hydrated ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
          <ScanLine className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No scans yet. Results you analyze are stored on this device only.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((r) => {
            const s = BAND_STYLE[r.band]
            return (
              <li key={r.id}>
                <Link
                  href={`/analyze?id=${r.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums", s.text, s.bg, s.border)}>
                    {r.score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-sm">{r.parsed.hostname}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)} · {SOURCE_LABEL[r.source]}
                    </span>
                  </span>
                  <span className={cn("hidden text-xs sm:inline", s.text)}>{s.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
