"use client"

import Link from "next/link"
import { useMemo, useState, useSyncExternalStore } from "react"
import { HardDrive, History, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { RiskBand } from "@/lib/engine/types"
import { getAutosave, historyStore, setAutosave, useHistory, useHydrated } from "@/lib/history"
import { BAND_STYLE, formatDateTime, SOURCE_LABEL } from "@/lib/risk-ui"
import { cn } from "@/lib/utils"

const autosaveListeners = new Set<() => void>()

export function HistoryClient() {
  const history = useHistory()
  const hydrated = useHydrated()
  const [query, setQuery] = useState("")
  const [band, setBand] = useState<"all" | RiskBand>("all")
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const autosave = useSyncExternalStore(
    (l) => (autosaveListeners.add(l), () => autosaveListeners.delete(l)),
    getAutosave,
    () => true,
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return history
      .filter((r) => band === "all" || r.band === band)
      .filter(
        (r) =>
          !q ||
          r.input.toLowerCase().includes(q) ||
          r.parsed.hostname.includes(q) ||
          (r.redirects.finalUrl ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (sort === "newest" ? -1 : 1) * a.createdAt.localeCompare(b.createdAt))
  }, [history, query, band, sort])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Scan history</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <HardDrive className="size-4" /> Stored locally on this device. Nothing is uploaded, and
            images are never saved.
          </p>
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <Switch
            checked={autosave}
            onCheckedChange={(v) => {
              setAutosave(v)
              autosaveListeners.forEach((l) => l())
            }}
            aria-label="Save new scans automatically"
          />
          Save new scans automatically
        </label>
      </div>

      <div className="surface flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by URL or domain"
            aria-label="Search scans"
            className="h-10 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <Select value={band} onValueChange={(v) => setBand(v as typeof band)}>
            <SelectTrigger className="h-10 w-full md:w-48" aria-label="Filter by severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {(Object.keys(BAND_STYLE) as RiskBand[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BAND_STYLE[b].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-10 w-full md:w-40" aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-10" disabled={!history.length}>
              <Trash2 /> Clear all
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all scan history?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes {history.length} saved report
                {history.length === 1 ? "" : "s"} from this browser. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-white"
                onClick={() => {
                  historyStore.clear()
                  toast("Scan history cleared")
                }}
              >
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {!hydrated ? (
        <div className="bg-muted/40 h-64 animate-pulse rounded-2xl" />
      ) : history.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-10 text-center">
          <History className="text-muted-foreground size-8" />
          <p className="font-medium">No saved scans yet</p>
          <p className="text-muted-foreground text-sm">Reports you analyze appear here.</p>
          <Button asChild>
            <Link href="/#scan">Start a scan</Link>
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="surface text-muted-foreground p-8 text-center text-sm">
          No scans match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="history-list">
          {rows.map((r) => {
            const s = BAND_STYLE[r.band]
            return (
              <li
                key={r.id}
                className="surface flex items-center gap-3 p-3 sm:gap-4 sm:p-4"
                data-testid="history-row"
              >
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl border text-base font-semibold tabular-nums",
                    s.text,
                    s.bg,
                    s.border,
                  )}
                >
                  {r.score}
                </span>
                <Link
                  href={`/analyze?id=${r.id}`}
                  className="focus-visible:ring-ring min-w-0 flex-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="block truncate font-mono text-sm">{r.input}</span>
                  <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className={s.text}>{s.label}</span>
                    <span>·</span>
                    <span>{formatDateTime(r.createdAt)}</span>
                    <span>·</span>
                    <span>{SOURCE_LABEL[r.source]}</span>
                  </span>
                </Link>
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <Link href={`/analyze?id=${r.id}`}>Open report</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete scan of ${r.parsed.hostname}`}
                  onClick={() => {
                    historyStore.remove(r.id)
                    toast("Scan deleted")
                  }}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
