import type { Metadata } from "next"
import { AttackLibrary } from "@/components/intel/attack-library"
import { LocalAnalytics } from "@/components/intel/local-analytics"
import { UrlAnatomy } from "@/components/intel/url-anatomy"

export const metadata: Metadata = { title: "Threat Intelligence" }

export default function IntelligencePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Threat intelligence</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          How QR-code attacks work, how to read a link, and what your own scans have surfaced.
        </p>
      </header>
      <UrlAnatomy />
      <AttackLibrary />
      <LocalAnalytics />
    </div>
  )
}
