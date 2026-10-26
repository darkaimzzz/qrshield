"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, Loader2, ShieldAlert, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

type CameraState = "idle" | "starting" | "scanning" | "denied" | "no_camera" | "insecure" | "error"

interface Controls {
  stop: () => void
}

const MESSAGES: Partial<Record<CameraState, { title: string; body: string }>> = {
  denied: {
    title: "Camera permission was denied",
    body: "Allow camera access for this site in your browser settings and try again, or upload a photo of the QR code instead.",
  },
  no_camera: {
    title: "No camera available",
    body: "This device doesn't expose a usable camera. Upload a screenshot or photo of the QR code instead.",
  },
  insecure: {
    title: "Camera requires a secure connection",
    body: "Browsers only allow camera access on HTTPS pages or on localhost. Open QRShield over HTTPS, or upload an image instead.",
  },
  error: {
    title: "The camera could not be started",
    body: "Another app may be using it. Close other camera apps and retry, or upload an image instead.",
  },
}

export function CameraScan({
  onDecoded,
  onUseUpload,
}: {
  onDecoded: (text: string) => void
  onUseUpload: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<Controls | null>(null)
  const handledRef = useRef(false)
  const [state, setState] = useState<CameraState>("idle")

  const stop = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }

  // Release the camera on unmount (tab switch or navigation).
  useEffect(() => stop, [])

  async function start() {
    if (!window.isSecureContext) return setState("insecure")
    if (!navigator.mediaDevices?.getUserMedia) return setState("no_camera")
    handledRef.current = false
    setState("starting")
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser")
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 })
      controlsRef.current = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result, _err, controls) => {
          // One detection per session: stop immediately and ignore late duplicate callbacks.
          if (!result || handledRef.current) return
          handledRef.current = true
          controls.stop()
          controlsRef.current = null
          setState("idle")
          onDecoded(result.getText())
        },
      )
      setState("scanning")
    } catch (err) {
      stop()
      const name = (err as Error).name
      if (name === "NotAllowedError" || name === "SecurityError") setState("denied")
      else if (name === "NotFoundError" || name === "OverconstrainedError") setState("no_camera")
      else setState("error")
    }
  }

  const message = MESSAGES[state]
  const active = state === "scanning" || state === "starting"

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border bg-black/60">
        <video
          ref={videoRef}
          className={active ? "size-full object-cover" : "hidden"}
          muted
          playsInline
          aria-label="Live camera preview"
        />
        {!active && (
          <div className="grid-bg absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {message ? (
              <>
                <ShieldAlert className="text-risk-moderate size-8" />
                <p className="font-medium">{message.title}</p>
                <p className="text-muted-foreground text-sm">{message.body}</p>
              </>
            ) : (
              <>
                <Camera className="text-primary size-9" />
                <p className="text-muted-foreground text-sm">
                  Camera access is requested only when you press start. Video stays on your device.
                </p>
              </>
            )}
          </div>
        )}
        {/* Scan boundary */}
        <div className="pointer-events-none absolute inset-[12%]" aria-hidden="true">
          {[
            "top-0 left-0 border-t-2 border-l-2",
            "top-0 right-0 border-t-2 border-r-2",
            "bottom-0 left-0 border-b-2 border-l-2",
            "right-0 bottom-0 border-r-2 border-b-2",
          ].map((c) => (
            <span key={c} className={`border-primary absolute size-7 rounded-[4px] ${c}`} />
          ))}
          {state === "scanning" && (
            <span
              className="via-primary absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent to-transparent shadow-[0_0_12px_2px_rgb(34_211_238/0.6)]"
              style={{ animation: "scanline 2.2s ease-in-out infinite" }}
            />
          )}
        </div>
        {state === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="text-primary size-7 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {active ? (
          <Button variant="secondary" onClick={() => (stop(), setState("idle"))}>
            <CameraOff /> Stop camera
          </Button>
        ) : (
          <Button onClick={start} size="lg">
            <Camera /> {message ? "Try camera again" : "Start camera"}
          </Button>
        )}
        <Button variant="ghost" onClick={onUseUpload}>
          <Upload /> Upload an image instead
        </Button>
      </div>
      <p className="text-muted-foreground text-center text-xs" aria-live="polite">
        {state === "scanning"
          ? "Point the camera at a QR code. Scanning stops automatically when one is found."
          : " "}
      </p>
    </div>
  )
}
