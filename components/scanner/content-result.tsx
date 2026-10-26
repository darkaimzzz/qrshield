"use client"

import { Copy, Info, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CONTENT_GUIDANCE, type QrContent } from "@/lib/qr-content"

/** Shows a decoded non-URL payload as inert text. Nothing here is opened, dialed or executed. */
export function ContentResult({
  content,
  onReset,
}: {
  content: Exclude<QrContent, { kind: "url" }>
  onReset: () => void
}) {
  const guide = CONTENT_GUIDANCE[content.kind]
  return (
    <div className="flex flex-col gap-4" data-testid="content-result">
      <div className="flex items-start gap-3 rounded-xl border border-violet/30 bg-violet/10 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-violet" />
        <div>
          <p className="font-medium">{guide.title}: URL analysis not applicable</p>
          <p className="mt-1 text-sm text-muted-foreground">{guide.body}</p>
        </div>
      </div>

      {"fields" in content && content.fields.length > 0 && (
        <dl className="grid gap-2 rounded-xl border border-border bg-card/60 p-4 text-sm sm:grid-cols-[auto_1fr]">
          {content.fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-mono break-all">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div>
        <p className="mb-1.5 text-xs tracking-wide text-muted-foreground uppercase">Decoded content</p>
        <pre className="max-h-48 overflow-auto rounded-xl border border-border bg-black/40 p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {content.text}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onReset}>
          <ScanLine /> Scan another
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            navigator.clipboard.writeText(content.text).then(
              () => toast.success("Decoded text copied"),
              () => toast.error("Clipboard unavailable"),
            )
          }
        >
          <Copy /> Copy text
        </Button>
      </div>
    </div>
  )
}
