import { analyze, InputError } from "@/lib/engine/report"
import { analyzeRequestSchema, type AnalyzeEvent } from "@/lib/engine/types"
import { rateLimit } from "@/lib/rate-limit"

export const maxDuration = 60

/**
 * POST /api/analyze — streams NDJSON AnalyzeEvents: one "stage" event each time a real stage
 * starts or finishes, then a final "report" (or "error") event.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (!rateLimit(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 },
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > 16_384) return Response.json({ error: "Request too large." }, { status: 413 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 })
  }
  const parsed = analyzeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AnalyzeEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`))
      try {
        const report = await analyze(parsed.data.input, parsed.data.source, send)
        send({ type: "report", report })
      } catch (err) {
        console.error("analysis failed", err instanceof InputError ? err.message : err)
        send({
          type: "error",
          message:
            err instanceof InputError
              ? err.message
              : "Analysis failed unexpectedly. Please try again.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  })
}
