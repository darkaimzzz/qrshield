import { getDomain } from "tldts"
import { fetch, Agent } from "undici"
import { createSafeLookup } from "./redirects"
import type { DomainInfo } from "./types"

/**
 * Domain registration data via RDAP (RFC 9082/9083), the IETF successor to WHOIS.
 * The registry's RDAP server is discovered through the IANA bootstrap registry (RFC 9224).
 * Results are reported exactly as published; absent fields stay null ("Unavailable").
 */

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json"
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000
const RESULT_TTL_MS = 60 * 60 * 1000
const TIMEOUT_MS = 8_000
const MAX_BODY_BYTES = 512 * 1024

// RDAP servers come from IANA, but redirects to registrar RDAP servers are still SSRF-guarded.
const agent = new Agent({ connect: { lookup: createSafeLookup(), timeout: 4_000 } })

let bootstrap: { at: number; services: Map<string, string> } | null = null
const cache = new Map<string, { at: number; info: DomainInfo }>()

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    dispatcher: agent,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/rdap+json, application/json" },
    redirect: "follow",
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (text.length > MAX_BODY_BYTES) throw new Error("Response too large")
  return JSON.parse(text)
}

async function rdapBaseFor(tld: string): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > BOOTSTRAP_TTL_MS) {
    const data = (await getJson(BOOTSTRAP_URL)) as { services: [string[], string[]][] }
    const services = new Map<string, string>()
    for (const [tlds, urls] of data.services) {
      const base = urls.find((u) => u.startsWith("https://")) ?? urls[0]
      for (const t of tlds) services.set(t.toLowerCase(), base.endsWith("/") ? base : `${base}/`)
    }
    bootstrap = { at: Date.now(), services }
  }
  return bootstrap.services.get(tld) ?? null
}

interface RdapEvent {
  eventAction?: string
  eventDate?: string
}
interface RdapEntity {
  roles?: string[]
  vcardArray?: [string, [string, unknown, string, unknown][]]
  entities?: RdapEntity[]
}
export interface RdapDomain {
  events?: RdapEvent[]
  entities?: RdapEntity[]
}

function validDate(s: string | undefined): string | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Pure parser for an RDAP domain object (exported for tests). */
export function parseRdap(data: RdapDomain, now = Date.now()) {
  const event = (action: string) =>
    validDate(data.events?.find((e) => e.eventAction === action)?.eventDate)
  const registrationDate = event("registration")
  const registrarEntity = data.entities?.find((e) => e.roles?.includes("registrar"))
  const fn = registrarEntity?.vcardArray?.[1]?.find((p) => p[0] === "fn")?.[3]
  const ageDays =
    registrationDate !== null
      ? Math.floor((now - Date.parse(registrationDate)) / 86_400_000)
      : null
  return {
    registrationDate,
    expirationDate: event("expiration"),
    lastChangedDate: event("last changed"),
    registrar: typeof fn === "string" && fn.trim() ? fn.trim() : null,
    // A registration date in the future is malformed data, not a brand-new domain.
    ageDays: ageDays !== null && ageDays >= 0 ? ageDays : null,
  }
}

function result(partial: Partial<DomainInfo> & Pick<DomainInfo, "status" | "detail">): DomainInfo {
  return {
    domain: null,
    registrationDate: null,
    expirationDate: null,
    lastChangedDate: null,
    registrar: null,
    ageDays: null,
    source: null,
    ...partial,
  }
}

export async function lookupDomain(hostname: string, isIp: boolean): Promise<DomainInfo> {
  if (isIp) return result({ status: "skipped", detail: "IP addresses have no domain registration." })
  if (process.env.QRSHIELD_DISABLE_NETWORK === "1") {
    return result({ status: "skipped", detail: "Outbound network checks are disabled on this server." })
  }
  // RDAP is keyed by the ICANN registrable domain (private suffixes like github.io excluded).
  const domain = getDomain(hostname, { allowPrivateDomains: false })
  if (!domain) return result({ status: "skipped", detail: "No registrable domain to look up." })

  const cached = cache.get(domain)
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) return cached.info

  const tld = domain.split(".").pop()!
  let info: DomainInfo
  try {
    const base = await rdapBaseFor(tld)
    if (!base) {
      info = result({
        status: "skipped",
        domain,
        detail: `The .${tld} registry does not publish an RDAP service in the IANA bootstrap registry.`,
      })
    } else {
      const url = `${base}domain/${encodeURIComponent(domain)}`
      const data = (await getJson(url)) as RdapDomain | null
      if (!data) {
        info = result({
          status: "done",
          domain,
          source: new URL(base).hostname,
          detail: "The registry has no record of this domain (it may not be registered).",
        })
      } else {
        const parsed = parseRdap(data)
        info = result({
          status: "done",
          domain,
          source: new URL(url).hostname,
          ...parsed,
          detail: parsed.registrationDate
            ? "Registration data retrieved from the registry's RDAP service."
            : "The registry responded but did not publish a registration date.",
        })
      }
    }
  } catch (err) {
    info = result({
      status: "failed",
      domain,
      detail: `RDAP lookup failed: ${(err as Error).name === "TimeoutError" ? "timed out" : (err as Error).message}`,
    })
  }
  if (info.status !== "failed") {
    if (cache.size > 500) cache.clear()
    cache.set(domain, { at: Date.now(), info })
  }
  return info
}
