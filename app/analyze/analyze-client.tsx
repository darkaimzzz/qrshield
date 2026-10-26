"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { AlertTriangle, ArrowLeft, RotateCcw, ScanLine } from "lucide-react"
import { ReportView } from "@/components/report/report-view"
import { STAGES, StageProgress, type StageState } from "@/components/report/stage-progress"
import { Button } from "@/components/ui/button"
import { streamAnalysis } from "@/lib/analyze-client"
import { inputSources, type InputSource, type Report, type StageId } from "@/lib/engine/types"
import { getAutosave, historyStore, useHydrated } from "@/lib/history"

type Stages = Record<StageId, StageState>

function initialStages(source: InputSource, decoded: boolean): Stages {
  const s = Object.fromEntries(STAGES.map((x) => [x.id, { status: "pending" }])) as Stages
  // Decoding happens in the browser before this page loads; pasted URLs have nothing to decode.
  s.decode =
    decoded || source === "camera" || source === "upload"
      ? { status: "done", detail: "Decoded on your device" }
      : { status: "skipped", detail: "Not applicable: URL entered directly" }
  return s
}

export function AnalyzeClient() {
  const params = useSearchParams()
  const input = params.get("u")
  const id = params.get("id")
  const srcParam = params.get("src") as InputSource | null
  const source: InputSource = srcParam && inputSources.includes(srcParam) ? srcParam : "url"
  const decoded = params.get("decoded") === "1"
  const hydrated = useHydrated()
  const [attempt, setAttempt] = useState(0)

  // Saved report: render from local history without re-running any checks.
  const saved = id && hydrated ? historyStore.get(id) : undefined

  if (id) {
    if (!hydrated) return null
    if (!saved) {
      return (
        <Message
          title="Saved report not found"
          body="It may have been deleted from this device's history."
        />
      )
    }
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ReportView report={saved} />
      </div>
    )
  }

  if (!input) {
    return (
      <Message
        title="Nothing to analyze"
        body="Scan a QR code, upload an image or paste a URL to start an analysis."
      />
    )
  }

  // A new key remounts the run, giving each analysis (and each retry) fresh state.
  return (
    <AnalysisRun
      key={`${input}|${source}|${attempt}`}
      input={input}
      source={source}
      decoded={decoded}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  )
}

function AnalysisRun({
  input,
  source,
  decoded,
  onRetry,
}: {
  input: string
  source: InputSource
  decoded: boolean
  onRetry: () => void
}) {
  const [stages, setStages] = useState<Stages>(() => initialStages(source, decoded))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    streamAnalysis(
      input,
      source,
      (e) => {
        if (e.type === "stage") {
          setStages((s) => ({ ...s, [e.stage]: { status: e.status, detail: e.detail } }))
        } else if (e.type === "report") {
          if (getAutosave()) historyStore.save(e.report)
          setReport(e.report)
        } else {
          setError(e.message)
        }
      },
      ctrl.signal,
    ).catch((err: Error) => {
      if (err.name !== "AbortError")
        setError(err.message || "Could not reach the analysis service.")
    })
    return () => ctrl.abort()
  }, [input, source])

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      {!report && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <StageProgress stages={stages} />
          <div className="surface flex flex-col justify-center gap-3 p-6">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Analyzing</p>
            <p className="font-mono text-sm break-all" data-testid="analyzing-input">
              {input}
            </p>
            <p className="text-muted-foreground text-sm">
              QRShield is inspecting this link from its server. Your browser does not open the
              destination at any point.
            </p>
            {error && (
              <div
                role="alert"
                className="border-risk-critical/30 bg-risk-critical/10 mt-2 flex flex-col gap-3 rounded-xl border p-4 text-sm"
              >
                <span className="flex items-center gap-2 font-medium text-red-200">
                  <AlertTriangle className="size-4" /> {error}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={onRetry}>
                    <RotateCcw /> Retry
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/#scan">
                      <ScanLine /> Scan something else
                    </Link>
                  </Button>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {report && (
        <>
          <ReportView report={report} />
          <StageProgress stages={stages} compact />
        </>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/"
      className="no-print text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" /> Dashboard
    </Link>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="surface mx-auto flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <ScanLine className="text-primary size-8" />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{body}</p>
      <Button asChild>
        <Link href="/#scan">Start a scan</Link>
      </Button>
    </div>
  )
}
