import { cn } from "@/lib/utils"

/** QRShield mark: an angular shield whose interior is drawn from QR finder patterns, in phosphor green. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path
        d="M16 2.5 27 6.5v9c0 6.6-4.4 11.6-11 14-6.6-2.4-11-7.4-11-14v-9Z"
        fill="rgb(0 255 102 / 0.08)"
        stroke="#00ff66"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
      <g fill="none" stroke="#00ff66" strokeWidth="1.4">
        <rect x="9.2" y="9.2" width="4.6" height="4.6" />
        <rect x="18.2" y="9.2" width="4.6" height="4.6" />
        <rect x="9.2" y="18.2" width="4.6" height="4.6" />
      </g>
      <g fill="#00ff66">
        <rect x="10.9" y="10.9" width="1.2" height="1.2" />
        <rect x="19.9" y="10.9" width="1.2" height="1.2" />
        <rect x="10.9" y="19.9" width="1.2" height="1.2" />
        <rect x="18.4" y="18.4" width="1.6" height="1.6" />
        <rect x="21.2" y="18.4" width="1.6" height="1.6" />
        <rect x="18.4" y="21.2" width="1.6" height="1.6" fill="#d6ffe2" />
      </g>
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="drop-shadow-[0_0_6px_rgb(0_255_102/0.45)]" />
      <span className="text-foreground text-[15px] font-bold tracking-[0.18em] uppercase">
        QR<span className="text-primary text-glow">Shield</span>
        <span className="cursor-blink text-primary" aria-hidden="true">
          _
        </span>
      </span>
    </span>
  )
}
