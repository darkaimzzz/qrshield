"use client"

import { useState } from "react"
import { ArrowRight, Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseUrl } from "@/lib/engine/parse"

export function UrlInput({ onSubmit, pending }: { onSubmit: (url: string) => void; pending: boolean }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const result = value.trim() ? parseUrl(value) : null
  const assumed = result?.ok && result.url.assumedProtocol

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    const r = parseUrl(value)
    if (!r.ok) return setError(r.error)
    setError(null)
    onSubmit(value.trim())
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <label htmlFor="url-input" className="text-sm font-medium">
        Web address to analyze
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="url-input"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://example.com/login"
            value={value}
            onChange={(e) => (setValue(e.target.value), setError(null))}
            aria-invalid={error ? true : undefined}
            aria-describedby="url-help"
            className="h-11 pl-9 font-mono text-sm"
          />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={pending || !value.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {pending ? "Starting…" : "Analyze URL"}
        </Button>
      </div>
      <p id="url-help" className="min-h-5 text-xs" aria-live="polite">
        {error ? (
          <span role="alert" className="text-red-300">{error}</span>
        ) : assumed ? (
          <span className="text-risk-moderate">No scheme given. QRShield will analyze it as https://{result.url.hostname}.</span>
        ) : (
          <span className="text-muted-foreground">
            Only http and https links are analyzed. QRShield never opens the destination in your browser.
          </span>
        )}
      </p>
    </form>
  )
}
