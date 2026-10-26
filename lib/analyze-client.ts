import type { AnalyzeEvent, InputSource } from "@/lib/engine/types"

/** Calls POST /api/analyze and invokes onEvent for each NDJSON event as it arrives. */
export async function streamAnalysis(
  input: string,
  source: InputSource,
  onEvent: (e: AnalyzeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, source }),
    signal,
  })
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Analysis request failed (HTTP ${res.status}).`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (value) buffer += value
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) onEvent(JSON.parse(line) as AnalyzeEvent)
    }
    if (done) break
  }
}
