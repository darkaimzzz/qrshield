import { cn } from "@/lib/utils"

/**
 * QRShield mark: a shield whose interior is drawn from QR finder patterns and data modules.
 * `id` keeps SVG gradient ids unique when several logos are on the page (one may be hidden).
 */
export function LogoMark({ className, id = "qs" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.16" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 27 6.6v8.2c0 7.1-4.6 12.4-11 14.7C9.6 27.2 5 21.9 5 14.8V6.6L16 2.5Z"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-stroke)`}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="#e6f9fd" strokeWidth="1.3">
        <rect x="9.2" y="9.2" width="4.6" height="4.6" rx="0.8" />
        <rect x="18.2" y="9.2" width="4.6" height="4.6" rx="0.8" />
        <rect x="9.2" y="18.2" width="4.6" height="4.6" rx="0.8" />
      </g>
      <g fill="#22d3ee">
        <rect x="10.9" y="10.9" width="1.2" height="1.2" rx="0.2" />
        <rect x="19.9" y="10.9" width="1.2" height="1.2" rx="0.2" />
        <rect x="10.9" y="19.9" width="1.2" height="1.2" rx="0.2" />
        <rect x="18.4" y="18.4" width="1.6" height="1.6" rx="0.3" />
        <rect x="21.2" y="18.4" width="1.6" height="1.6" rx="0.3" />
        <rect x="18.4" y="21.2" width="1.6" height="1.6" rx="0.3" fill="#8b5cf6" />
      </g>
    </svg>
  )
}

export function Logo({ className, id }: { className?: string; id?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark id={id} />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        QR<span className="text-primary">Shield</span>
      </span>
    </span>
  )
}
