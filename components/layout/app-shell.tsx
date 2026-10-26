"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Lock, ScanLine } from "lucide-react"
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

function StatusPill({ status }: { status: ServerStatus | null }) {
  if (!status) {
    return <span className="bg-muted h-7 w-40 animate-pulse rounded-full" aria-hidden="true" />
  }
  const sources = status.providers.filter((p) => p.enabled).length
  const tone = status.network ? "bg-risk-low" : "bg-risk-moderate"
  return (
    <span
      className="border-border bg-card/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
      title={
        status.network
          ? `Live checks enabled. ${sources} threat-intel source(s) active. ML model ${status.ml ? "loaded" : "unavailable"}.`
          : "Outbound network checks are disabled on this server"
      }
    >
      <span className={cn("size-1.5 rounded-full", tone)} />
      <span className="hidden sm:inline">{status.network ? "Live checks" : "Offline mode"}</span>
      <span className="text-border">|</span>
      <span>
        {sources} intel source{sources === 1 ? "" : "s"}
      </span>
      <span className="text-border">|</span>
      <span>ML {status.ml ? "on" : "off"}</span>
    </span>
  )
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const status = useServerStatus()

  return (
    <div className="flex min-h-dvh">
      <aside className="no-print border-sidebar-border bg-sidebar/80 sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r backdrop-blur lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="QRShield home">
            <Logo id="logo-side" />
          </Link>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-ring relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active && "bg-sidebar-accent text-foreground",
                )}
              >
                {active && (
                  <span
                    className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "size-4",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {label}
              </Link>
            )
          })}
          <Link
            href="/#scan"
            className="bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-[0_0_24px_-6px_rgb(34_211_238/0.6)] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ScanLine className="size-4" /> New scan
          </Link>
        </nav>
        <div className="border-border bg-card/50 text-muted-foreground m-3 rounded-lg border p-3 text-xs leading-relaxed">
          <div className="text-foreground mb-1 flex items-center gap-1.5 font-medium">
            <Lock className="text-primary size-3.5" /> Private by design
          </div>
          Images are decoded on your device. History stays in this browser.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print border-border bg-background/70 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6">
          <Link href="/" className="lg:hidden" aria-label="QRShield home">
            <Logo id="logo-head" />
          </Link>
          <p className="text-muted-foreground hidden text-sm lg:block">Scan Smarter. Stay Safer.</p>
          <StatusPill status={status} />
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pb-12">{children}</main>
      </div>

      <nav
        aria-label="Mobile"
        className="no-print border-border bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
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
            className="text-primary -mt-5 flex flex-col items-center gap-1 text-[11px] font-medium"
          >
            <span className="glow-cyan bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl">
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
        "text-muted-foreground flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
        active && "text-primary",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  )
}
