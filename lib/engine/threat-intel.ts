import { fetch } from "undici"
import type { ProviderResult, ThreatIntelResult } from "./types"

/**
 * Threat-intelligence providers. A provider that is not configured or cannot be reached reports
 * "not_checked" / "error" — never "no_match". "no_match" only means "this list does not contain
 * the URL right now", which is not evidence that the URL is safe.
 */
export interface ThreatProvider {
  id: string
  name: string
  /** Null when usable; otherwise why the provider is not queried (missing key, disabled). */
  unavailableReason(): string | null
  /** Checks candidate URLs (original + redirect targets). Resolves to match / no_match. */
  check(urls: string[]): Promise<{ matched: boolean; detail: string }>
  /** Pre-fetches a downloadable list so the later check does not wait on it. */
  warm?(): Promise<unknown>
}

const FEED_TTL_MS = 6 * 60 * 60 * 1000
const FEED_TIMEOUT_MS = 15_000

/** Downloads and caches a newline-delimited list; concurrent callers share one download. */
function cachedList(url: string, transform: (line: string) => string | null) {
  let state: { at: number; set: Set<string> } | null = null
  let pending: Promise<Set<string>> | null = null
  return async (): Promise<Set<string>> => {
    if (state && Date.now() - state.at < FEED_TTL_MS) return state.set
    pending ??= (async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) })
        if (!res.ok) throw new Error(`feed HTTP ${res.status}`)
        const set = new Set<string>()
        for (const line of (await res.text()).split("\n")) {
          const v = line.trim()
          if (!v || v.startsWith("#")) continue
          const t = transform(v)
          if (t) set.add(t)
        }
        state = { at: Date.now(), set }
        return set
      } finally {
        pending = null
      }
    })()
    return pending
  }
}

/** Canonical form for exact URL matching: lowercase scheme/host, no fragment, no trailing slash. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    u.hash = ""
    return u.href.replace(/\/$/, "")
  } catch {
    return null
  }
}

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/** Phishing.Database (MIT licensed, community-maintained, active phishing domains). */
const phishingDatabaseList = cachedList(
  "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt",
  (l) => l.toLowerCase().replace(/^www\./, ""),
)
export const phishingDatabase: ThreatProvider = {
  id: "phishing_database",
  name: "Phishing.Database (active phishing domains)",
  unavailableReason: () =>
    process.env.PHISHING_DATABASE_DISABLED === "1" ? "Disabled by server configuration" : null,
  warm: () => phishingDatabaseList(),
  async check(urls) {
    const list = await phishingDatabaseList()
    const hit = urls.map(hostOf).find((h) => h && list.has(h))
    return hit
      ? { matched: true, detail: `Host ${hit} is listed as an active phishing domain.` }
      : { matched: false, detail: `Host not found among ${list.size.toLocaleString("en-US")} listed domains.` }
  },
}

/** OpenPhish community feed. Its terms restrict use to non-commercial research, so it is opt-in. */
const openPhishList = cachedList("https://openphish.com/feed.txt", canonicalUrl)
export const openPhish: ThreatProvider = {
  id: "openphish",
  name: "OpenPhish community feed",
  unavailableReason: () =>
    process.env.OPENPHISH_ENABLED === "1"
      ? null
      : "Opt-in (OPENPHISH_ENABLED=1); feed terms limit use to non-commercial research",
  warm: () => openPhishList(),
  async check(urls) {
    const list = await openPhishList()
    const hit = urls.map(canonicalUrl).find((u) => u && list.has(u))
    return hit
      ? { matched: true, detail: `Exact URL listed in the OpenPhish feed.` }
      : { matched: false, detail: `URL not in the current feed (${list.size.toLocaleString("en-US")} entries).` }
  },
}

/** Google Safe Browsing Lookup API v4 (requires GSB_API_KEY). */
export const googleSafeBrowsing: ThreatProvider = {
  id: "google_safe_browsing",
  name: "Google Safe Browsing",
  unavailableReason: () => (process.env.GSB_API_KEY ? null : "Not configured (GSB_API_KEY)"),
  async check(urls) {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(process.env.GSB_API_KEY!)}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "qrshield", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: urls.map((url) => ({ url })),
          },
        }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { matches?: { threatType: string }[] }
    const types = [...new Set(data.matches?.map((m) => m.threatType) ?? [])]
    return types.length
      ? { matched: true, detail: `Listed as ${types.join(", ")}.` }
      : { matched: false, detail: "No match in Safe Browsing lists." }
  },
}

/** abuse.ch URLhaus (malware distribution URLs; requires a free URLHAUS_AUTH_KEY). */
export const urlhaus: ThreatProvider = {
  id: "urlhaus",
  name: "abuse.ch URLhaus",
  unavailableReason: () => (process.env.URLHAUS_AUTH_KEY ? null : "Not configured (URLHAUS_AUTH_KEY)"),
  async check(urls) {
    for (const url of urls.slice(0, 3)) {
      const res = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: { "Auth-Key": process.env.URLHAUS_AUTH_KEY! },
        body: new URLSearchParams({ url }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { query_status: string; threat?: string; url_status?: string }
      if (data.query_status === "ok") {
        return { matched: true, detail: `Listed (${data.threat ?? "malware"}, status ${data.url_status ?? "unknown"}).` }
      }
      if (data.query_status !== "no_results") throw new Error(data.query_status)
    }
    return { matched: false, detail: "Not listed in URLhaus." }
  },
}

export const PROVIDERS: ThreatProvider[] = [phishingDatabase, openPhish, googleSafeBrowsing, urlhaus]

export function warmThreatFeeds(): void {
  if (process.env.QRSHIELD_DISABLE_NETWORK === "1") return
  for (const p of PROVIDERS) if (!p.unavailableReason()) p.warm?.().catch(() => {})
}

export async function checkThreatIntel(
  urls: string[],
  providers: ThreatProvider[] = PROVIDERS,
): Promise<ThreatIntelResult> {
  const networkOff = process.env.QRSHIELD_DISABLE_NETWORK === "1"
  const results: ProviderResult[] = await Promise.all(
    providers.map(async (p): Promise<ProviderResult> => {
      const reason = networkOff ? "Outbound network checks are disabled" : p.unavailableReason()
      if (reason) return { id: p.id, name: p.name, status: "not_checked", detail: reason }
      try {
        const r = await p.check(urls)
        return { id: p.id, name: p.name, status: r.matched ? "match" : "no_match", detail: r.detail }
      } catch (err) {
        return {
          id: p.id,
          name: p.name,
          status: "error",
          detail: `Not checked: ${(err as Error).name === "TimeoutError" ? "timed out" : (err as Error).message}`,
        }
      }
    }),
  )
  const anyChecked = results.some((r) => r.status === "match" || r.status === "no_match")
  const anyAttempted = results.some((r) => r.status !== "not_checked")
  return {
    status: anyChecked ? "done" : anyAttempted ? "failed" : networkOff ? "skipped" : "not_configured",
    providers: results,
  }
}
