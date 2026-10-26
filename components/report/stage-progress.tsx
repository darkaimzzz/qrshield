"use client"

import { motion } from "motion/react"
import { CheckCircle2, Circle, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react"
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

function StatusIcon({ status }: { status: StageState["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="size-4 animate-spin text-primary" />
    case "done":
      return <CheckCircle2 className="size-4 text-risk-low" />
    case "failed":
      return <XCircle className="size-4 text-risk-critical" />
    case "skipped":
      return <MinusCircle className="size-4 text-muted-foreground" />
    case "not_configured":
      return <CircleDashed className="size-4 text-muted-foreground" />
    default:
      return <Circle className="size-4 text-muted-foreground/50" />
  }
}

export function StageProgress({ stages, compact = false }: { stages: Record<StageId, StageState>; compact?: boolean }) {
  const finished = STAGES.filter((s) => !["pending", "running"].includes(stages[s.id].status)).length
  return (
    <div className="surface p-5" data-testid="stage-progress">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-semibold">{compact ? "Analysis stages" : "Analyzing destination"}</h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {finished}/{STAGES.length}
        </span>
      </div>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STAGES.length} aria-valuenow={finished} aria-label="Analysis progress">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-violet"
          animate={{ width: `${(finished / STAGES.length) * 100}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>
      <ol className="flex flex-col gap-1" aria-live="polite">
        {STAGES.map((s) => {
          const st = stages[s.id]
          return (
            <li
              key={s.id}
              data-stage={s.id}
              data-status={st.status}
              className={cn(
                "flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm",
                st.status === "running" && "bg-primary/5",
              )}
            >
              <span className="mt-0.5"><StatusIcon status={st.status} /></span>
              <span className="min-w-0 flex-1">
                <span className={cn(st.status === "pending" && "text-muted-foreground")}>{s.label}</span>
                {st.detail && !compact && <span className="block truncate text-xs text-muted-foreground">{st.detail}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{STATUS_TEXT[st.status]}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
