"use client"

import { useEffect, useState } from "react"
import type { CheckStatus, StageId } from "@/lib/engine/types"
import { cn } from "@/lib/utils"

export type StageState = { status: "pending" | "running" | CheckStatus; detail?: string }

export const STAGES: { id: StageId; label: string }[] = [
  { id: "decode", label: "QR decoding" },
  { id: "structure", label: "URL structure analysis" },
  { id: "domain", label: "Domain inspection" },
  { id: "redirects", label: "Redirect investigation" },
  { id: "threat_intel", label: "Threat intelligence checks" },
  { id: "scoring", label: "Risk calculation" },
  { id: "report", label: "Report generation" },
]

const STATUS_TEXT: Record<StageState["status"], string> = {
  pending: "Waiting",
  running: "In progress",
  done: "Completed",
  failed: "Failed",
  skipped: "Skipped",
  not_configured: "Not configured",
}

/** Terminal-style status tag, e.g. "[ OK ]". Color plus text, never color alone. */
const TAG: Record<StageState["status"], { text: string; className: string }> = {
  pending: { text: "WAIT", className: "text-muted-foreground/60" },
  running: { text: "", className: "text-signal" },
  done: { text: " OK ", className: "text-primary text-glow" },
  failed: { text: "FAIL", className: "text-risk-critical" },
  skipped: { text: "SKIP", className: "text-muted-foreground" },
  not_configured: { text: "N/A ", className: "text-muted-foreground" },
}

const SPINNER = ["|", "/", "-", "\\"]
const BAR_CELLS = 28

function Spinner() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % SPINNER.length), 110)
    return () => window.clearInterval(id)
  }, [])
  return (
    <>
      {" "}
      {SPINNER[i]}
      {"  "}
    </>
  )
}

export function StageProgress({
  stages,
  compact = false,
}: {
  stages: Record<StageId, StageState>
  compact?: boolean
}) {
  const finished = STAGES.filter(
    (s) => !["pending", "running"].includes(stages[s.id].status),
  ).length
  const lit = Math.round((finished / STAGES.length) * BAR_CELLS)
  const pct = Math.round((finished / STAGES.length) * 100)

  return (
    <div className="surface p-5" data-testid="stage-progress">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xs font-bold tracking-[0.2em] uppercase">
          <span className="text-primary" aria-hidden="true">
            {"> "}
          </span>
          {compact ? "Analysis stages" : "Analyzing destination"}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {finished}/{STAGES.length}
        </span>
      </div>
      <div
        className="mb-4 text-xs whitespace-pre"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STAGES.length}
        aria-valuenow={finished}
        aria-label="Analysis progress"
      >
        <span className="text-muted-foreground">[</span>
        <span className="text-primary text-glow">{"█".repeat(lit)}</span>
        <span className="text-primary/20">{"░".repeat(BAR_CELLS - lit)}</span>
        <span className="text-muted-foreground">]</span>{" "}
        <span className="tabular-nums">{String(pct).padStart(3, " ")}%</span>
      </div>
      <ol className="flex flex-col gap-0.5 text-xs sm:text-[13px]" aria-live="polite">
        {STAGES.map((s) => {
          const st = stages[s.id]
          const tag = TAG[st.status]
          return (
            <li
              key={s.id}
              data-stage={s.id}
              data-status={st.status}
              className={cn(
                "flex items-start gap-2 px-1 py-1",
                st.status === "running" && "bg-primary/10",
              )}
            >
              <span className={cn("shrink-0 whitespace-pre", tag.className)} aria-hidden="true">
                [{st.status === "running" ? <Spinner /> : tag.text}]
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn(st.status === "pending" && "text-muted-foreground/70")}>
                  {s.label}
                </span>
                <span className="sr-only">: {STATUS_TEXT[st.status]}</span>
                {st.detail && !compact && (
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {"  └ "}
                    {st.detail}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
