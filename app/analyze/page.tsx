import type { Metadata } from "next"
import { Suspense } from "react"
import { AnalyzeClient } from "./analyze-client"

export const metadata: Metadata = { title: "Security Analysis" }

export default function AnalyzePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/40" />}>
        <AnalyzeClient />
      </Suspense>
    </div>
  )
}
