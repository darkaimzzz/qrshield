"use client"

import { useSyncExternalStore } from "react"
import { REPORT_VERSION, type Report } from "@/lib/engine/types"

/**
 * Scan history persisted in this browser only. The interface lets a server-side store replace
 * localStorage later without touching the UI. Only report JSON is stored, never images.
 */
export interface HistoryStore {
  list(): Report[]
  get(id: string): Report | undefined
  save(report: Report): void
  remove(id: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

const KEY = "qrshield.history.v1"
const AUTOSAVE_KEY = "qrshield.autosave"
const MAX_ENTRIES = 200
const EMPTY: Report[] = []

function isReport(x: unknown): x is Report {
  const r = x as Report
  return (
    typeof r === "object" && r !== null && r.version === REPORT_VERSION &&
    typeof r.id === "string" && typeof r.score === "number" && typeof r.createdAt === "string"
  )
}

export function createLocalHistoryStore(storage: () => Storage | null): HistoryStore {
  const listeners = new Set<() => void>()
  let cache: Report[] | null = null

  const read = (): Report[] => {
    if (cache) return cache
    try {
      const raw = storage()?.getItem(KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      cache = Array.isArray(parsed) ? parsed.filter(isReport) : []
    } catch {
      cache = []
    }
    return cache
  }
  const write = (reports: Report[]) => {
    cache = reports
    try {
      storage()?.setItem(KEY, JSON.stringify(reports))
    } catch {
      // Storage full or blocked (private mode): keep the in-memory copy for this session.
    }
    listeners.forEach((l) => l())
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        cache = null
        listeners.forEach((l) => l())
      }
    })
  }

  return {
    list: () => read(),
    get: (id) => read().find((r) => r.id === id),
    save: (report) => write([report, ...read().filter((r) => r.id !== report.id)].slice(0, MAX_ENTRIES)),
    remove: (id) => write(read().filter((r) => r.id !== id)),
    clear: () => write([]),
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

export const historyStore = createLocalHistoryStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
)

export function useHistory(): Report[] {
  return useSyncExternalStore(historyStore.subscribe, historyStore.list, () => EMPTY)
}

/** True once mounted on the client; history is empty during server render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export function getAutosave(): boolean {
  try {
    return window.localStorage.getItem(AUTOSAVE_KEY) !== "0"
  } catch {
    return true
  }
}

export function setAutosave(on: boolean) {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, on ? "1" : "0")
  } catch {
    // ignore
  }
}
