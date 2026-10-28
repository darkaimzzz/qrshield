"use client"

import { useEffect, useRef, useState } from "react"
import { FileImage, ImageUp, Loader2, QrCode, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { decodeQrImage, DecodeError, validateImage } from "@/lib/decode"
import { cn } from "@/lib/utils"

type Status =
  | { kind: "idle" }
  | { kind: "decoding" }
  | { kind: "error"; message: string }
  | { kind: "choose"; results: string[] }

export function UploadScan({ onDecoded }: { onDecoded: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [dragging, setDragging] = useState(false)

  // Revoke object URLs so image data is released from memory.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  async function handleFile(file: File | undefined) {
    if (!file) return
    const invalid = validateImage(file)
    if (invalid) return setStatus({ kind: "error", message: invalid })
    setPreview({ url: URL.createObjectURL(file), name: file.name })
    setStatus({ kind: "decoding" })
    try {
      const results = await decodeQrImage(file)
      if (results.length === 0) {
        setStatus({
          kind: "error",
          message:
            "No QR code was found in this image. Try a sharper, well-lit photo with the whole code visible.",
        })
      } else if (results.length === 1) {
        setStatus({ kind: "idle" })
        onDecoded(results[0])
      } else {
        setStatus({ kind: "choose", results })
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message:
          err instanceof DecodeError
            ? err.message
            : "The QR decoder failed to load. Check your connection and retry.",
      })
    }
  }

  function reset() {
    setPreview(null)
    setStatus({ kind: "idle" })
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
        className={cn(
          "grid-bg border-border hover:border-primary/60 focus-within:border-primary relative flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload a QR code image"
          data-testid="qr-upload-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img
            src={preview.url}
            alt={`Preview of ${preview.name}`}
            className="max-h-56 rounded-lg object-contain"
          />
        ) : (
          <>
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
              <ImageUp className="size-6" />
            </span>
            <span className="font-medium">Drop a QR code image here or click to browse</span>
            <span className="text-muted-foreground text-sm">
              PNG, JPG or WebP up to 8 MB. Decoded locally; the image is never uploaded or stored.
            </span>
          </>
        )}
        {status.kind === "decoding" && (
          <span className="bg-background/70 absolute inset-0 flex items-center justify-center gap-2 rounded-2xl text-sm">
            <Loader2 className="text-primary size-4 animate-spin" /> Decoding on your device…
          </span>
        )}
      </label>

      {status.kind === "error" && (
        <p
          role="alert"
          className="border-risk-critical/30 bg-risk-critical/10 text-risk-critical rounded-lg border px-3 py-2 text-sm"
        >
          {status.message}
        </p>
      )}

      {status.kind === "choose" && (
        <div
          className="border-border bg-card/60 rounded-xl border p-4"
          role="group"
          aria-label="Multiple QR codes found"
        >
          <p className="mb-3 text-sm font-medium">
            {status.results.length} QR codes found. Choose one to analyze:
          </p>
          <ul className="flex flex-col gap-2">
            {status.results.map((text, i) => (
              <li key={text}>
                <button
                  type="button"
                  onClick={() => onDecoded(text)}
                  className="border-border bg-background/50 hover:border-primary/60 focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:outline-none"
                >
                  <QrCode className="text-primary size-4 shrink-0" />
                  <span className="text-muted-foreground text-xs">#{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileImage className="size-4 shrink-0" />{" "}
            <span className="truncate">{preview.name}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X /> Clear
          </Button>
        </div>
      )}
    </div>
  )
}
