import type { Metadata } from "next"
import { DemoClient } from "./demo-client"

export const metadata: Metadata = { title: "Demo Lab" }

export default function DemoPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Demo lab</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Five clearly synthetic cases that run through the real analysis engine. No scores are pre-computed. Fictional links use the reserved
          <span className="font-mono"> .example</span> domain or a documentation-only IP range, so they cannot point at a real victim or attacker.
        </p>
      </header>
      <DemoClient />
    </div>
  )
}
