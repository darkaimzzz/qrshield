"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Camera, ImageUp, Link2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { InputSource } from "@/lib/engine/types"
import { classifyQrContent, type QrContent } from "@/lib/qr-content"
import { CameraScan } from "./camera-scan"
import { ContentResult } from "./content-result"
import { UploadScan } from "./upload-scan"
import { UrlInput } from "./url-input"

type Tab = "camera" | "upload" | "url"

export function analyzeHref(text: string, source: InputSource) {
  return `/analyze?${new URLSearchParams({ u: text, src: source })}`
}

/** Hash links (#scan, #scan-url, #scan-upload) select a tab, so CTAs elsewhere can target it. */
function tabFromHash(): Tab | null {
  const h = window.location.hash
  if (h === "#scan-url") return "url"
  if (h === "#scan-upload") return "upload"
  if (h === "#scan") return "camera"
  return null
}

export function ScanPanel() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("camera")
  const [content, setContent] = useState<Exclude<QrContent, { kind: "url" }> | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const sync = () => {
      const t = tabFromHash()
      if (t) {
        setTab(t)
        setContent(null)
        document.getElementById("scan")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  function handle(text: string, source: InputSource) {
    const c = classifyQrContent(text)
    if (c.kind === "url") startTransition(() => router.push(analyzeHref(c.text, source)))
    else setContent(c)
  }

  return (
    <section id="scan" aria-labelledby="scan-heading" className="surface scroll-mt-24 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="scan-heading" className="text-lg font-semibold tracking-tight">
            Scan &amp; analyze
          </h2>
          <p className="text-sm text-muted-foreground">Decoded content is analyzed without opening it.</p>
        </div>
      </div>

      {content ? (
        <ContentResult content={content} onReset={() => setContent(null)} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid h-11 w-full grid-cols-3">
            <TabsTrigger value="camera" className="gap-1.5">
              <Camera className="size-4" /> <span>Camera<span className="hidden sm:inline"> Scan</span></span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <ImageUp className="size-4" /> <span>Upload<span className="hidden sm:inline"> QR Image</span></span>
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <Link2 className="size-4" /> <span>Paste URL</span>
            </TabsTrigger>
          </TabsList>
          {/* Inactive tabs unmount, which releases the camera when switching away. */}
          <TabsContent value="camera" className="pt-4">
            <CameraScan onDecoded={(t) => handle(t, "camera")} onUseUpload={() => setTab("upload")} />
          </TabsContent>
          <TabsContent value="upload" className="pt-4">
            <UploadScan onDecoded={(t) => handle(t, "upload")} />
          </TabsContent>
          <TabsContent value="url" className="pt-4">
            <UrlInput pending={pending} onSubmit={(u) => handle(u, "url")} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}
