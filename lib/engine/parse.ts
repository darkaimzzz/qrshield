import { parse as parseDomain } from "tldts"
import { toUnicode } from "punycode.js"
import type { ParsedUrl } from "./types"

export const MAX_INPUT_LENGTH = 2048

export type ParseErrorKind =
  "empty" | "too_long" | "control_chars" | "unsupported_scheme" | "malformed" | "invalid_host"

export type ParseResult =
  { ok: true; url: ParsedUrl } | { ok: false; kind: ParseErrorKind; error: string; scheme?: string }

// C0/C1 control characters (tab, newline, NUL, ...). Never valid in a URL someone meant to share.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/
const SCHEME = /^([a-z][a-z0-9+.-]*):/i
const HOST_PORT = /^[^/?#:@]+:\d{1,5}(?:[/?#]|$)/

function fail(kind: ParseErrorKind, error: string, scheme?: string): ParseResult {
  return { ok: false, kind, error, scheme }
}

/**
 * Validates and normalizes untrusted input (decoded QR text or pasted URL) into a ParsedUrl.
 * Only http/https destinations are analyzable; everything else is rejected with a reason.
 * Runs identically in the browser (client-side validation) and on the server.
 */
export function parseUrl(raw: string): ParseResult {
  const input = raw.trim()
  if (!input) return fail("empty", "Enter a URL to analyze.")
  if (input.length > MAX_INPUT_LENGTH) {
    return fail("too_long", `Input exceeds ${MAX_INPUT_LENGTH} characters.`)
  }
  if (CONTROL_CHARS.test(input)) {
    return fail(
      "control_chars",
      "Input contains control characters, which are never valid in a URL.",
    )
  }

  let candidate = input
  let assumedProtocol = false
  const scheme = SCHEME.exec(input)?.[1]?.toLowerCase()
  // "example.com:8080/x" looks like a scheme to the regex; treat host:port as a schemeless URL.
  const isRealScheme = scheme !== undefined && !HOST_PORT.test(input)

  if (isRealScheme) {
    if (scheme !== "http" && scheme !== "https") {
      return fail(
        "unsupported_scheme",
        `“${scheme}:” links are not web addresses and cannot be analyzed as URLs.`,
        scheme,
      )
    }
    if (!/^https?:\/\//i.test(input)) return fail("malformed", "Malformed URL after the scheme.")
  } else {
    if (input.startsWith("//")) candidate = `https:${input}`
    else candidate = `https://${input}`
    assumedProtocol = true
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return fail("malformed", "This does not look like a valid web address.")
  }

  const hostname = url.hostname.toLowerCase()
  const ipVersion = hostname.startsWith("[")
    ? 6
    : /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
      ? 4
      : null
  if (!ipVersion && !isValidDnsHostname(hostname)) {
    return fail("invalid_host", `“${hostname || "(empty)"}” is not a valid public hostname.`)
  }

  const hadCredentials = url.username !== "" || url.password !== ""
  const credentialUser = decodeURIComponent(url.username)
  // Credentials are recorded as evidence but never kept in the normalized URL or sent anywhere.
  url.username = ""
  url.password = ""

  const info = parseDomain(hostname, { allowPrivateDomains: true })
  const registrableDomain = ipVersion ? null : info.domain
  const subdomain = ipVersion ? "" : (info.subdomain ?? "")
  let hostnameUnicode = hostname
  try {
    hostnameUnicode = toUnicode(hostname)
  } catch {
    // Invalid punycode is left as-is; the lexical analyzer still flags the xn-- label.
  }

  return {
    ok: true,
    url: {
      original: input,
      normalized: url.href,
      protocol: url.protocol as "http:" | "https:",
      hostname,
      hostnameUnicode,
      subdomain,
      registrableDomain,
      publicSuffix: ipVersion ? null : info.publicSuffix,
      isIcannSuffix: info.isIcann === true,
      port: url.port,
      effectivePort: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      isIp: ipVersion !== null,
      ipVersion,
      hadCredentials,
      credentialUser,
      assumedProtocol,
    },
  }
}

/** DNS hostname that could exist on the public internet: ≥2 labels, LDH rules, length limits. */
function isValidDnsHostname(hostname: string): boolean {
  if (hostname.length === 0 || hostname.length > 253) return false
  const labels = hostname.replace(/\.$/, "").split(".")
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  if (/^\d+$/.test(tld)) return false
  return labels.every(
    (l) => l.length > 0 && l.length <= 63 && /^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/.test(l),
  )
}
