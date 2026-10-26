"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { ArrowRight, Download, Loader2, QrCode, ScanSearch } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyzeHref } from "@/components/scanner/scan-panel"
import { decodeQrImage } from "@/lib/decode"
import { classifyQrContent } from "@/lib/qr-content"

export const DEMO_CASES = [
  {
    title: "Conventional HTTPS site",
    description:
      "A well-known, long-established site. Live redirect, RDAP and blocklist checks run against the real domain.",
    url: "https://www.wikipedia.org/",
  },
  {
    title: "Synthetic suspicious login",
    description: "Plain HTTP, lure words in a hyphenated domain and a login path.",
    url: "http://secure-account-verify.example/login/update?session=expired",
  },
  {
    title: "Synthetic deceptive brand URL",
    description: "A brand's domain used as a subdomain of an unrelated domain.",
    url: "https://paypal.com.account-security.example/signin/verify",
  },
  {
    title: "Synthetic IP-host URL",
    description:
      "A raw IP from the TEST-NET-3 documentation range (203.0.113.0/24) instead of a domain.",
    url: "http://203.0.113.45/bank/login.php",
  },
  {
    title: "Synthetic long / obfuscated URL",
    description:
      "Encoded hostname characters, double encoding, deep subdomains and an embedded redirect target.",
    url: "https://login.microsoftonline.com.auth-session-%76erify.example/%2561%2562/common/oauth2/v2.0/authorize?client_id=4765445b-32c6-49b0-83e6-1d93765276ca&response_type=code&redirect_uri=https%3A%2F%2Fcollect.example%2Fcallback&state=a8f3e2c1d4b5",
  },
] as const

export function DemoClient() {
  const router = useRouter()
  const [text, setText] = useState<string>(DEMO_CASES[2].url)
  const [qr, setQr] = useState<{ text: string; url: string } | null>(null)
  const dataUrl = qr && qr.text === text ? qr.url : null
  const [decoding, setDecoding] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!text.trim()) return
    QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#060a13", light: "#ffffff" },
    })
      .then((url) => !cancelled && setQr({ text, url }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [text])

  async function decodeGenerated() {
    if (!dataUrl) return
    setDecoding(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const [decoded] = await decodeQrImage(blob)
      if (!decoded) throw new Error("No QR code found")
      const c = classifyQrContent(decoded)
      if (c.kind !== "url") {
        toast.info("Decoded content is not a web URL", { description: decoded })
        return
      }
      router.push(`${analyzeHref(decoded, "demo")}&decoded=1`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDecoding(false)
    }
  }

  return (
    <>
      <section aria-labelledby="cases-heading">
        <h2 id="cases-heading" className="mb-4 text-lg font-semibold tracking-tight">
          Try a demo scan
        </h2>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DEMO_CASES.map((c, i) => (
            <li key={c.title} className="surface flex flex-col p-5" data-testid="demo-case">
              <span className="text-muted-foreground mb-2 font-mono text-xs">Case {i + 1}</span>
              <h3 className="font-medium">{c.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{c.description}</p>
              <p className="mt-3 rounded-md bg-black/30 px-2 py-1.5 font-mono text-[11px] break-all">
                {c.url}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button asChild size="sm">
                  <Link href={analyzeHref(c.url, "demo")}>
                    Analyze <ArrowRight />
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setText(c.url)}>
                  <QrCode /> Generate QR
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="gen-heading"
        className="surface grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-6"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <h2 id="gen-heading" className="text-lg font-semibold tracking-tight">
            QR generator
          </h2>
          <p className="text-muted-foreground text-sm">
            Generate a QR code for any sample or your own text, then scan it with QRShield on
            another device&apos;s camera, download it and use “Upload QR Image”, or decode it right
            here with the same on-device decoder.
          </p>
          <label htmlFor="qr-text" className="text-sm font-medium">
            QR content
          </label>
          <Input
            id="qr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-11 font-mono text-sm"
            spellCheck={false}
            maxLength={1500}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={decodeGenerated} disabled={!dataUrl || decoding}>
              {decoding ? <Loader2 className="animate-spin" /> : <ScanSearch />} Decode &amp;
              analyze this QR
            </Button>
            {dataUrl && (
              <Button variant="secondary" asChild>
                <a href={dataUrl} download="qrshield-demo-qr.png">
                  <Download /> Download PNG
                </a>
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Demo guide: open QRShield on a phone over HTTPS, choose Camera Scan and point it at this
            code. The decoded link is analyzed, never opened.
          </p>
        </div>
        <div className="mx-auto flex size-64 items-center justify-center rounded-2xl bg-white p-3 shadow-[0_0_40px_-10px_rgb(34_211_238/0.5)]">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img
              src={dataUrl}
              alt={`QR code encoding ${text}`}
              className="size-full"
              data-testid="generated-qr"
            />
          ) : (
            <span className="text-sm text-slate-500">Enter content</span>
          )}
        </div>
      </section>
    </>
  )
}
