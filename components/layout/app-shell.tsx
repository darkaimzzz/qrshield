"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ScanLine } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"
import { NAV } from "./nav"

interface ServerStatus {
  network: boolean
  ml: { name: string; version: string } | null
  llm: boolean
  providers: { id: string; name: string; enabled: boolean; reason: string | null }[]
}

function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch("/api/status", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return status
}

function Flag({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">[</span>
      {label}:<span className={ok ? "text-primary" : "text-risk-moderate"}>{value}</span>
      <span className="text-muted-foreground">]</span>
    </span>
  )
}

function StatusFlags({ status }: { status: ServerStatus | null }) {
  if (!status) {
    return (
      <span className="text-muted-foreground text-xs" aria-hidden="true">
        [SYS:<span className="cursor-blink">..</span>]
      </span>
    )
  }
  const sources = status.providers.filter((p) => p.enabled).length
  return (
    <span
      className="text-foreground/90 inline-flex items-center gap-2 text-[11px] tracking-wider uppercase"
      title={
        status.network
          ? `Live checks enabled. ${sources} threat-intel source(s) active. ML model ${status.ml ? "loaded" : "unavailable"}.`
          : "Outbound network checks are disabled on this server"
      }
    >
      <span className="hidden sm:inline">
        <Flag label="NET" value={status.network ? "LIVE" : "OFF"} ok={status.network} />
      </span>
      <Flag label="INTEL" value={String(sources)} ok={sources > 0} />
      <Flag label="ML" value={status.ml ? "ON" : "OFF"} ok={Boolean(status.ml)} />
    </span>
  )
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

function promptPath(pathname: string) {
  return pathname === "/" ? "~" : `~${pathname}`
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const status = useServerStatus()

  return (
    <div className="flex min-h-dvh">
      <aside className="no-print border-sidebar-border bg-sidebar/85 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-sidebar-border flex h-16 items-center border-b px-5">
          <Link href="/" aria-label="QRShield home">
            <Logo />
          </Link>
        </div>
        <p className="text-muted-foreground px-5 pt-5 pb-2 text-[10px] tracking-[0.25em] uppercase">
          {"// modules"}
        </p>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map(({ href, label }, i) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-ring flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-xs tracking-[0.12em] uppercase transition-colors focus-visible:ring-1 focus-visible:outline-none",
                  active && "border-primary bg-primary/10 text-primary text-glow",
                )}
              >
                <span
                  aria-hidden="true"
                  className={active ? "text-primary" : "text-muted-foreground"}
                >
                  {active ? ">" : String(i + 1).padStart(2, "0")}
                </span>
                {label}
              </Link>
            )
          })}
          <Link
            href="/#scan"
            className="bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background glow mt-5 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold tracking-[0.18em] uppercase transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ScanLine className="size-4" /> New scan
          </Link>
        </nav>
        <div className="border-sidebar-border text-muted-foreground m-3 border p-3 text-[11px] leading-relaxed">
          <p className="text-primary mb-1">$ privacy --status</p>
          <p>
            <span className="text-primary">ok</span> images decoded on-device
          </p>
          <p>
            <span className="text-primary">ok</span> history stays in this browser
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print border-border bg-background/85 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-sm sm:px-6">
          <Link href="/" className="lg:hidden" aria-label="QRShield home">
            <Logo />
          </Link>
          <p className="hidden truncate text-xs lg:block" aria-hidden="true">
            <span className="text-primary">root@qrshield</span>
            <span className="text-muted-foreground">:</span>
            <span className="text-signal">{promptPath(pathname)}</span>
            <span className="text-muted-foreground">$ </span>
            <span className="text-foreground/80">scan --smarter --stay-safer</span>
            <span className="cursor-blink bg-primary ml-1 inline-block h-3.5 w-2 translate-y-0.5" />
          </p>
          <StatusFlags status={status} />
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pb-12">{children}</main>
      </div>

      <nav
        aria-label="Mobile"
        className="no-print border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {[NAV[0], NAV[1]].map(({ href, label, icon: Icon }) => (
            <MobileLink
              key={href}
              href={href}
              label={label}
              active={isActive(pathname, href)}
              Icon={Icon}
            />
          ))}
          <Link
            href="/#scan"
            className="text-primary -mt-5 flex flex-col items-center gap-1 text-[10px] font-bold tracking-widest uppercase"
          >
            <span className="glow bg-primary text-primary-foreground flex size-14 items-center justify-center">
              <ScanLine className="size-6" />
            </span>
            Scan
          </Link>
          {[NAV[2], NAV[3]].map(({ href, label, icon: Icon }) => (
            <MobileLink
              key={href}
              href={href}
              label={label.split(" ")[0]}
              active={isActive(pathname, href)}
              Icon={Icon}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}

function MobileLink({
  href,
  label,
  active,
  Icon,
}: {
  href: string
  label: string
  active: boolean
  Icon: (typeof NAV)[number]["icon"]
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "text-muted-foreground flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] tracking-wider uppercase",
        active && "text-primary text-glow",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  )
}
