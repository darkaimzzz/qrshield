import dns from "node:dns"
import type { LookupAddress, LookupOptions } from "node:dns"
import ipaddr from "ipaddr.js"
import { Agent, request } from "undici"
import { parseUrl } from "./parse"
import type { RedirectHop, RedirectResult } from "./types"

/**
 * Server-side redirect investigation hardened against SSRF.
 *
 * Defense in depth:
 *  1. Every URL (initial and each Location) is re-parsed: http/https only, ports 80/443 only,
 *     no credentials, valid public hostname.
 *  2. IP-literal hosts must be public unicast addresses (WHATWG parsing has already normalized
 *     decimal/octal/hex IPv4 tricks such as http://2130706433/ to 127.0.0.1).
 *  3. DNS names are resolved by `safeLookup`, which rejects the connection if ANY A/AAAA answer
 *     is non-public. Because the lookup is the one Node's net/tls uses for the socket, the
 *     connection goes exactly to the validated address: no TOCTOU window for DNS rebinding.
 *     TLS still verifies the certificate against the hostname (servername is unchanged).
 *  4. No automatic redirect following, strict timeouts, small header limit, bodies never read.
 */

export const MAX_REDIRECTS = 5
const CONNECT_TIMEOUT_MS = 3_000
const HOP_TIMEOUT_MS = 5_000
const TOTAL_TIMEOUT_MS = 12_000
const USER_AGENT = "QRShield-LinkInspector/1.0 (+redirect check; page content is not downloaded)"

export class BlockedDestinationError extends Error {}

/** RFC 6052 well-known NAT64 prefix 64:ff9b::/96 (first 12 bytes). */
const NAT64_WKP = [0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0]

/** True only for globally routable unicast addresses (ipaddr.js "unicast" range). */
export function isPublicAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false
  let addr = ipaddr.parse(ip)
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6
    const bytes = v6.toByteArray()
    if (v6.isIPv4MappedAddress()) {
      addr = v6.toIPv4Address()
    } else if (NAT64_WKP.every((b, i) => bytes[i] === b)) {
      // DNS64 networks (IPv6-only hosts, common on mobile carriers) answer with 64:ff9b::/96
      // addresses; the NAT64 gateway forwards to the embedded IPv4, so judge that address.
      addr = ipaddr.fromByteArray(bytes.slice(12))
    }
  }
  // Excludes private, loopback, link-local (incl. 169.254.169.254 metadata), CGNAT
  // (incl. 100.100.100.200), multicast, reserved, unique-local (incl. fd00:ec2::254),
  // 6to4/Teredo/local-use NAT64 (which can embed private IPv4), documentation and
  // benchmarking ranges.
  return addr.range() === "unicast"
}

type Resolver = (
  hostname: string,
  options: { all: true; verbatim: boolean },
  cb: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/** A dns.lookup-compatible function that refuses non-public answers. Resolver is injectable for tests. */
export function createSafeLookup(resolve: Resolver = dns.lookup as unknown as Resolver) {
  return function safeLookup(hostname: string, options: LookupOptions, cb: LookupCallback) {
    resolve(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return cb(err, [])
      if (!addresses?.length)
        return cb(new BlockedDestinationError(`${hostname} did not resolve`), [])
      const bad = addresses.find((a) => !isPublicAddress(a.address))
      if (bad) {
        return cb(
          new BlockedDestinationError(`${hostname} resolves to non-public address ${bad.address}`),
          [],
        )
      }
      const usable = options.family
        ? addresses.filter((a) => a.family === options.family)
        : addresses
      if (!usable.length)
        return cb(new BlockedDestinationError(`${hostname}: no usable address`), [])
      if (options.all) cb(null, usable)
      else cb(null, usable[0].address, usable[0].family)
    })
  }
}

/** Validates a URL as a probe target. Returns a reason string if it must not be fetched. */
export function probeBlockReason(raw: string): string | null {
  const p = parseUrl(raw)
  if (!p.ok) return p.error
  const u = p.url
  if (u.hadCredentials) return "URLs with embedded credentials are not probed"
  if (u.effectivePort !== 80 && u.effectivePort !== 443) {
    return `Port ${u.effectivePort} is not probed (only 80 and 443 are allowed)`
  }
  if (u.isIp && !isPublicAddress(u.hostname.replace(/^\[|\]$/g, ""))) {
    return `${u.hostname} is not a public address`
  }
  return null
}

/** Undici agent whose every connection goes through the SSRF-safe lookup. */
export function createProbeAgent(resolve?: Resolver): Agent {
  return new Agent({
    connect: { lookup: createSafeLookup(resolve), timeout: CONNECT_TIMEOUT_MS },
    allowH2: false,
    headersTimeout: HOP_TIMEOUT_MS,
    bodyTimeout: HOP_TIMEOUT_MS,
    maxHeaderSize: 16 * 1024,
    connections: 4,
  })
}

export interface HopResponse {
  status: number
  location: string | null
}

export type FetchHop = (url: string, signal: AbortSignal) => Promise<HopResponse>

/**
 * One request without following redirects. HEAD first; GET (body discarded unread) if HEAD is
 * refused. IP-literal hosts never reach DNS lookup, so they are validated here as well.
 */
export function makeFetchHop(getAgent: () => Agent): FetchHop {
  return async (url, signal) => {
    const u = new URL(url)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new BlockedDestinationError(`${u.protocol} is not allowed`)
    }
    const host = u.hostname.replace(/^\[|\]$/g, "")
    if (ipaddr.isValid(host) && !isPublicAddress(host)) {
      throw new BlockedDestinationError(`${host} is not a public address`)
    }
    const dispatcher = getAgent()
    const send = async (method: "HEAD" | "GET") => {
      const res = await request(url, {
        method,
        dispatcher,
        signal,
        headers: { "user-agent": USER_AGENT, accept: "*/*" },
      })
      res.body.destroy() // never download page content
      const loc = res.headers.location
      return { status: res.statusCode, location: Array.isArray(loc) ? loc[0] : (loc ?? null) }
    }
    const head = await send("HEAD")
    if ([403, 405, 501].includes(head.status)) return send("GET")
    return head
  }
}

let defaultAgent: Agent | null = null
export const fetchHop: FetchHop = makeFetchHop(() => (defaultAgent ??= createProbeAgent()))

function registrable(u: string): string {
  const p = parseUrl(u)
  return p.ok ? (p.url.registrableDomain ?? p.url.hostname) : u
}

function describeError(err: unknown): string {
  if (err instanceof BlockedDestinationError) return `Blocked: ${err.message}`
  const e = err as { name?: string; code?: string; message?: string; cause?: unknown }
  if (e.cause instanceof BlockedDestinationError) return `Blocked: ${e.cause.message}`
  if (e.name === "TimeoutError" || e.name === "AbortError" || e.code?.includes("TIMEOUT")) {
    return "Timed out"
  }
  if (e.code === "ENOTFOUND") return "Domain does not resolve (DNS lookup failed)"
  if (e.code === "ECONNREFUSED") return "Connection refused"
  if (e.code?.startsWith("ERR_TLS") || e.code?.includes("CERT")) return `TLS error (${e.code})`
  return e.code ?? e.message ?? "Request failed"
}

export async function inspectRedirects(
  startUrl: string,
  hop: FetchHop = fetchHop,
): Promise<RedirectResult> {
  if (process.env.QRSHIELD_DISABLE_NETWORK === "1") {
    return {
      status: "skipped",
      hops: [],
      finalUrl: null,
      loop: false,
      truncated: false,
      detail: "Outbound network checks are disabled on this server.",
    }
  }

  const hops: RedirectHop[] = []
  const seen = new Set<string>()
  const overall = AbortSignal.timeout(TOTAL_TIMEOUT_MS)
  let current = startUrl
  let prevDomain: string | null = null

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const domain = registrable(current)
    const hostname = parseUrl(current).ok ? new URL(current).hostname : current
    const crossDomain = prevDomain !== null && prevDomain !== domain
    const blocked = probeBlockReason(current)
    if (blocked) {
      hops.push({ url: current, hostname, status: null, crossDomain, error: blocked })
      return {
        status: i === 0 ? "skipped" : "done",
        hops,
        finalUrl: i === 0 ? null : current,
        loop: false,
        truncated: false,
        detail: i === 0 ? `Not probed: ${blocked}` : `Redirect target not followed: ${blocked}`,
      }
    }
    if (seen.has(current)) {
      hops.push({ url: current, hostname, status: null, crossDomain, error: "Redirect loop" })
      return {
        status: "done",
        hops,
        finalUrl: current,
        loop: true,
        truncated: false,
        detail: "Redirect loop detected.",
      }
    }
    seen.add(current)

    let res: HopResponse
    try {
      res = await hop(current, AbortSignal.any([overall, AbortSignal.timeout(HOP_TIMEOUT_MS)]))
    } catch (err) {
      const error = describeError(err)
      hops.push({ url: current, hostname, status: null, crossDomain, error })
      return {
        status: i === 0 ? "failed" : "done",
        hops,
        finalUrl: i === 0 ? null : current,
        loop: false,
        truncated: false,
        detail: i === 0 ? `Could not reach the destination: ${error}` : `Chain stopped: ${error}`,
      }
    }

    hops.push({ url: current, hostname, status: res.status, crossDomain })
    prevDomain = domain
    const isRedirect = [301, 302, 303, 307, 308].includes(res.status) && res.location
    if (!isRedirect) {
      return {
        status: "done",
        hops,
        finalUrl: current,
        loop: false,
        truncated: false,
        detail:
          hops.length === 1
            ? `No HTTP redirect (status ${res.status}).`
            : `${hops.length - 1} redirect${hops.length > 2 ? "s" : ""} followed.`,
      }
    }
    try {
      current = new URL(res.location!, current).href
    } catch {
      return {
        status: "done",
        hops,
        finalUrl: current,
        loop: false,
        truncated: false,
        detail: "Malformed redirect Location header.",
      }
    }
  }

  return {
    status: "done",
    hops,
    finalUrl: current,
    loop: false,
    truncated: true,
    detail: `Stopped after ${MAX_REDIRECTS} redirects; the chain continues further.`,
  }
}
