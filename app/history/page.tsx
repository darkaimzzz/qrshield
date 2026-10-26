import type { Metadata } from "next"
import { HistoryClient } from "./history-client"

export const metadata: Metadata = { title: "Scan History" }

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <HistoryClient />
    </div>
  )
}
