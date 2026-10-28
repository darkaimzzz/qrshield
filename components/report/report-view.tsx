"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { useState } from "react"
import {
  Bookmark,
  BookmarkCheck,
  Clipboard,
  FileDown,
  Loader2,
  Microscope,
  Printer,
  ScanLine,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Report } from "@/lib/engine/types"
import { historyStore, useHistory } from "@/lib/history"
import { downloadReportPdf, reportSummaryText } from "@/lib/pdf"
import { BAND_STYLE, formatDateTime, SOURCE_LABEL } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"
import {
  DomainPanel,
  FindingsPanel,
  LimitationsPanel,
  MlPanel,
  RecommendationsPanel,
  RedirectPanel,
  SummaryPanel,
  ThreatIntelPanel,
  UrlIntelPanel,
} from "./panels"
import { RiskGauge } from "./risk-gauge"

export function ReportView({ report }: { report: Report }) {
  const history = useHistory()
  const saved = history.some((r) => r.id === report.id)
  const [inspect, setInspect] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const band = BAND_STYLE[report.band]
  const finalHost = report.redirects.hops.at(-1)?.hostname

  async function pdf() {
    setPdfBusy(true)
    try {
      await downloadReportPdf(report)
    } catch {
      toast.error("PDF generation failed")
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="report">
      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn("surface relative overflow-hidden p-5 sm:p-7", band.border)}
      >
        <p
          className="text-muted-foreground border-border -mx-5 -mt-5 mb-5 flex flex-wrap justify-between gap-2 border-b border-dashed px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase sm:-mx-7 sm:-mt-7 sm:px-7"
          aria-hidden="true"
        >
          <span>
            <span className="text-primary">[ OK ]</span> analysis complete
          </span>
          <span>id:{report.id.slice(0, 8)}</span>
        </p>
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center">
          <RiskGauge score={report.score} band={report.band} />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <span
              className={cn(
                "inline-flex border px-3 py-1 text-xs font-bold tracking-[0.2em] uppercase",
                band.text,
                band.bg,
                band.border,
              )}
              data-testid="risk-band"
            >
              {band.label}
            </span>
            <h1 className="no-prompt text-foreground mt-3 text-xl font-bold break-all sm:text-2xl">
              {report.parsed.hostname}
            </h1>
            {finalHost && finalHost !== report.parsed.hostname && (
              <p className="text-muted-foreground mt-1 text-sm">
                Final destination:{" "}
                <span className="text-foreground font-mono break-all">{finalHost}</span>
              </p>
            )}
            <p className="text-muted-foreground mt-3 text-sm">
              {formatDateTime(report.createdAt)} · {SOURCE_LABEL[report.source]}
            </p>
            {report.band === "low" && (
              <p className="text-muted-foreground mt-2 text-xs">
                Low detected risk means few warning signs were found, not that the destination is
                guaranteed safe.
              </p>
            )}
          </div>
        </div>

        <div className="no-print relative mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
          <Button asChild>
            <Link href="/#scan">
              <ScanLine /> Scan another QR
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              navigator.clipboard.writeText(reportSummaryText(report)).then(
                () => toast.success("Report summary copied"),
                () => toast.error("Clipboard unavailable"),
              )
            }
          >
            <Clipboard /> Copy summary
          </Button>
          <Button
            variant="secondary"
            aria-pressed={saved}
            onClick={() => {
              if (saved) {
                historyStore.remove(report.id)
                toast("Removed from scan history")
              } else {
                historyStore.save(report)
                toast.success("Saved to scan history")
              }
            }}
          >
            {saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}{" "}
            {saved ? "Saved to history" : "Save to history"}
          </Button>
          <Button variant="secondary" onClick={pdf} disabled={pdfBusy}>
            {pdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />} Download PDF
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button variant="ghost" onClick={() => setInspect(true)}>
            <Microscope /> Inspect details
          </Button>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryPanel report={report} />
        <RecommendationsPanel report={report} />
      </div>
      <FindingsPanel report={report} expandAll={false} />
      <div className="grid gap-6 lg:grid-cols-2">
        <UrlIntelPanel report={report} />
        <div className="flex min-w-0 flex-col gap-6">
          <RedirectPanel report={report} />
          <DomainPanel report={report} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ThreatIntelPanel report={report} />
        <MlPanel report={report} />
      </div>
      <LimitationsPanel report={report} />

      <Dialog open={inspect} onOpenChange={setInspect}>
        <DialogContent className="max-h-[85dvh] max-w-3xl overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detailed findings</DialogTitle>
            <DialogDescription>
              Every finding with its evidence, followed by the complete report data.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-6 max-h-[65dvh] space-y-4 overflow-y-auto px-6">
            <FindingsPanel report={report} expandAll />
            <div>
              <p className="text-muted-foreground mb-1.5 text-xs tracking-wide uppercase">
                Raw report JSON
              </p>
              <pre className="border-border overflow-x-auto rounded-xl border bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
