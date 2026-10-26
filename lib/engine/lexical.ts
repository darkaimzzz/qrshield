import { makeFinding } from "./indicators"
import type { Finding, LexicalFeatures, ParsedUrl } from "./types"

/** Words common in credential-phishing lures. A single hit is never enough on its own. */
export const SUSPICIOUS_KEYWORDS = [
  "login", "logon", "signin", "sign-in", "verify", "verification", "validate", "account",
  "update", "secure", "security", "confirm", "password", "passwd", "credential", "unlock",
  "suspend", "suspended", "locked", "billing", "invoice", "payment", "refund", "reward",
  "prize", "gift", "bonus", "claim", "urgent", "alert", "authenticate", "recover", "reset",
  "kyc", "webscr", "wallet", "seed", "airdrop", "support", "helpdesk", "otp", "banking",
] as const

/**
 * Curated list of public URL-shortening and dynamic-QR redirect services. Shorteners are
 * legitimate tools, but they hide the destination, which is exactly what a QR code already does.
 */
export const URL_SHORTENERS = new Set([
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly", "tiny.cc", "bl.ink", "s.id",
  "lnkd.in", "shorte.st", "adf.ly", "bit.do", "short.gy", "tiny.one", "qrco.de", "qr.codes",
  "qrs.ly", "q-r.to", "me-qr.com", "urlz.fr", "u.to", "clck.ru", "soo.gd", "trib.al", "dub.sh",
  "shorturl.gg", "x.gd", "1url.com", "2.gp", "linktr.ee",
])

/**
 * TLDs that repeatedly appear at the top of public phishing/abuse-rate reports (e.g. Interisle
 * "Phishing Landscape", Spamhaus TLD reputation). Low weight: most sites on them are benign.
 */
export const ABUSED_TLDS = new Set([
  "zip", "mov", "top", "xyz", "click", "link", "cfd", "sbs", "quest", "cyou", "rest", "icu",
  "buzz", "monster", "gq", "tk", "ml", "cf", "ga", "work", "bond", "lol", "mom", "country",
  "kim", "fit", "loan", "win", "bid",
])

const EXECUTABLE_EXTENSIONS = [
  "exe", "msi", "apk", "scr", "bat", "cmd", "vbs", "jar", "ps1", "dmg", "pkg", "iso", "hta",
  "lnk", "xapk", "appx", "msix",
]

// Zero-width and bidirectional-override characters used to disguise text.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g
const NON_LATIN_SCRIPTS: [string, RegExp][] = [
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Armenian", /\p{Script=Armenian}/u],
  ["Cherokee", /\p{Script=Cherokee}/u],
]

export function shannonEntropy(s: string): number {
  if (!s) return 0
  const counts = new Map<string, number>()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const c of counts.values()) {
    const p = c / s.length
    h -= p * Math.log2(p)
  }
  return h
}

/** Splits text into lowercase word tokens on any non-alphanumeric boundary. */
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function findKeywords(parsed: ParsedUrl): string[] {
  // The registrable domain itself is excluded: "secureworks.com" names a company, not a lure.
  const registrableLabel = parsed.registrableDomain?.split(".")[0] ?? ""
  const haystack = [parsed.subdomain, safeDecode(parsed.pathname), safeDecode(parsed.search)]
    .join(" ")
    .toLowerCase()
  const tokens = new Set(tokenize(haystack))
  const hits = new Set<string>()
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (kw.includes("-") ? haystack.includes(kw) : tokens.has(kw)) hits.add(kw)
  }
  // Lure words glued into the registrable label itself, e.g. "account-verify-portal".
  for (const t of registrableLabel.split("-")) {
    if (registrableLabel.includes("-") && (SUSPICIOUS_KEYWORDS as readonly string[]).includes(t)) {
      hits.add(t)
    }
  }
  return [...hits]
}

export function extractLexical(parsed: ParsedUrl): LexicalFeatures {
  const url = parsed.normalized
  const host = parsed.hostname
  const letters = (url.match(/[a-z]/gi) ?? []).length
  const digits = (url.match(/\d/g) ?? []).length
  const special = (url.match(/[^a-z0-9]/gi) ?? []).length
  const pathSegments = parsed.pathname.split("/").filter(Boolean)
  const lastSegment = safeDecode(pathSegments[pathSegments.length - 1] ?? "").toLowerCase()
  const ext = /\.([a-z0-9]{2,5})$/.exec(lastSegment)?.[1]
  const hostLabelsNoSuffix = parsed.registrableDomain
    ? host.slice(0, host.length - (parsed.publicSuffix?.length ?? 0) - 1)
    : host

  let mixedScriptLabel: string | null = null
  for (const label of parsed.hostnameUnicode.split(".")) {
    const hasLatin = /[a-z]/i.test(label)
    const other = NON_LATIN_SCRIPTS.find(([, re]) => re.test(label))
    if (hasLatin && other) {
      mixedScriptLabel = `${label} (Latin + ${other[0]})`
      break
    }
  }

  return {
    urlLength: url.length,
    hostnameLength: host.length,
    pathLength: parsed.pathname.length,
    queryLength: parsed.search.length,
    subdomainCount: parsed.subdomain ? parsed.subdomain.split(".").length : 0,
    pathDepth: pathSegments.length,
    specialCharRatio: url.length ? special / url.length : 0,
    digitLetterRatio: letters ? digits / letters : digits,
    hostnameHyphens: (host.match(/-/g) ?? []).length,
    hostnameDigits: (host.match(/\d/g) ?? []).length,
    repeatedSeparators: (url.slice(url.indexOf("//") + 2).match(/\/\/|\.\.|--|__/g) ?? []).length,
    percentEncodedCount: (url.match(/%[0-9a-f]{2}/gi) ?? []).length,
    doubleEncoded: /%25[0-9a-f]{2}/i.test(url),
    hostnameEntropy: shannonEntropy(hostLabelsNoSuffix.replace(/\./g, "")),
    pathEntropy: shannonEntropy(parsed.pathname + parsed.search),
    atSymbol: parsed.hadCredentials || parsed.original.split("?")[0].includes("@"),
    doubleSlashInPath: parsed.pathname.includes("//"),
    isPunycode: host.split(".").some((l) => l.startsWith("xn--")),
    nonAsciiHost: /[^\x00-\x7F]/.test(parsed.hostnameUnicode),
    mixedScriptLabel,
    invisibleChars: (parsed.original.match(INVISIBLE) ?? []).length,
    suspiciousKeywords: findKeywords(parsed),
    embeddedUrlInQuery: /(?:^|[=&?])(?:https?(?::|%3a)(?:\/\/|%2f%2f)|www\.)/i.test(
      parsed.search,
    ),
    executableExtension: ext && EXECUTABLE_EXTENSIONS.includes(ext) ? ext : null,
    tldIsUnusual: parsed.publicSuffix
      ? ABUSED_TLDS.has(parsed.publicSuffix.split(".").pop() ?? "")
      : false,
  }
}

/**
 * Structural findings derived from the URL text alone. `brandOwned` suppresses language-based
 * findings on a brand's own verified domains (e.g. accounts.google.com/signin is expected).
 */
export function lexicalFindings(
  parsed: ParsedUrl,
  f: LexicalFeatures,
  opts: { brandOwned: boolean; otherSignals: number },
): Finding[] {
  const out: Finding[] = []

  if (parsed.isIp) {
    out.push(
      makeFinding(
        "ip_host",
        "The URL uses a raw IP address instead of a domain name. This is sometimes used to hide who operates a site, although some legitimate services and devices use direct IP addresses.",
        [`Host: ${parsed.hostname}`],
      ),
    )
  }

  if (parsed.hadCredentials || f.atSymbol) {
    out.push(
      makeFinding(
        "credentials_in_url",
        "The URL contains “user@host” syntax. Browsers ignore everything before the “@”, so text such as a trusted brand name placed there can make a link look like it goes somewhere it does not.",
        [
          parsed.credentialUser
            ? `Text before “@”: ${parsed.credentialUser}`
            : "“@” present in the address",
          `Actual host: ${parsed.hostname}`,
        ],
      ),
    )
  }

  if (parsed.protocol === "http:") {
    out.push(
      makeFinding(
        "no_https",
        "The destination does not use HTTPS, so anything entered on the page could be read or modified in transit. Legitimate sites that ask for logins or payments use HTTPS.",
        [`Scheme: ${parsed.protocol.replace(":", "")}`],
      ),
    )
  }

  if (parsed.port && parsed.effectivePort !== 80 && parsed.effectivePort !== 443) {
    out.push(
      makeFinding(
        "nonstandard_port",
        "The URL specifies an unusual network port. Public websites almost always use the default ports; custom ports are more common on test servers and ad-hoc infrastructure.",
        [`Port: ${parsed.port}`],
      ),
    )
  }

  if (f.subdomainCount >= 3) {
    out.push(
      makeFinding(
        "excessive_subdomains",
        "The hostname has many subdomain levels. Long chains of subdomains can push the real domain out of view on small screens.",
        [`${f.subdomainCount} subdomain levels: ${parsed.subdomain}`],
      ),
    )
  }

  // A full domain name inside the subdomain ("paypal.com.account-check.example") or as a path
  // segment is a classic way to show a trusted name while pointing elsewhere.
  const domainLike = /(?:^|\.)([a-z0-9-]+\.(?:com|net|org|gov|edu|co|io|in|uk|app))(?:\.|$)/
  const subMatch = parsed.subdomain && domainLike.exec(parsed.subdomain)
  const pathMatch = /^\/(?:[^/]*\/)*?([a-z0-9-]+\.(?:com|net|org|gov|in|co\.uk))(?:\/|$)/i.exec(
    parsed.pathname,
  )
  if (subMatch || pathMatch) {
    out.push(
      makeFinding(
        "domain_in_subdomain",
        "Another domain name appears inside this URL in a position where it does not control the destination. This can make the link look like it belongs to a different site.",
        [
          subMatch ? `In subdomain: ${subMatch[1]}` : `In path: ${pathMatch?.[1]}`,
          `Actual registrable domain: ${parsed.registrableDomain ?? parsed.hostname}`,
        ],
      ),
    )
  }

  if (f.hostnameHyphens >= 3) {
    out.push(
      makeFinding(
        "hyphenated_host",
        "The hostname contains many hyphens, a pattern often used to string together reassuring words (e.g. secure-account-update).",
        [`${f.hostnameHyphens} hyphens in ${parsed.hostname}`],
      ),
    )
  }

  if (f.urlLength > 100) {
    out.push(
      makeFinding(
        "long_url",
        "The URL is unusually long. Very long links are hard to inspect and can hide the meaningful part of the address.",
        [`${f.urlLength} characters`],
      ),
    )
  }

  const encodingEvidence: string[] = []
  if (f.invisibleChars > 0) encodingEvidence.push(`${f.invisibleChars} invisible/bidi character(s)`)
  if (f.doubleEncoded) encodingEvidence.push("Double percent-encoding (%25xx)")
  if (f.percentEncodedCount >= 8) {
    encodingEvidence.push(`${f.percentEncodedCount} percent-encoded characters`)
  }
  if (/%[0-9a-f]{2}/i.test(parsed.original.split(/[/?#]/, 3)[2] ?? "")) {
    encodingEvidence.push("Percent-encoding inside the hostname")
  }
  if (parsed.isIp && parsed.ipVersion === 4 && !parsed.original.includes(parsed.hostname)) {
    encodingEvidence.push(`IP address written in non-standard notation (resolves to ${parsed.hostname})`)
  }
  if (encodingEvidence.length) {
    out.push(
      makeFinding(
        "unusual_encoding",
        "Parts of the URL are encoded or contain characters that make it harder for people to read what the address really says.",
        encodingEvidence,
      ),
    )
  }

  if (f.embeddedUrlInQuery) {
    out.push(
      makeFinding(
        "embedded_redirect_param",
        "The query string contains another web address. Sites use this for legitimate redirects, but attackers abuse trusted sites’ redirect parameters to bounce visitors elsewhere.",
        [`Query: ${truncate(safeDecode(parsed.search), 120)}`],
      ),
    )
  }

  if (f.executableExtension) {
    out.push(
      makeFinding(
        "executable_download",
        "The link appears to point directly at a downloadable program or installer. Installing software from a scanned code is a common malware delivery route.",
        [`File type: .${f.executableExtension}`],
      ),
    )
  }

  const hostCore = parsed.registrableDomain?.split(".")[0] ?? ""
  // Long label, high character entropy and an unpronounceable consonant run (e.g. "xkqjwvbrtz7").
  if (
    !parsed.isIp &&
    hostCore.length >= 10 &&
    shannonEntropy(hostCore) >= 3.3 &&
    consonantRun(hostCore) >= 5
  ) {
    out.push(
      makeFinding(
        "random_hostname",
        "The domain name looks randomly generated rather than chosen to be memorable. Disposable phishing and malware domains are often generated automatically.",
        [`${parsed.registrableDomain} (entropy ${shannonEntropy(hostCore).toFixed(2)} bits/char)`],
      ),
    )
  }

  if (f.tldIsUnusual) {
    out.push(
      makeFinding(
        "unusual_tld",
        "The domain uses a top-level domain that appears disproportionately often in public phishing and abuse reports. Most sites on it are still legitimate; treat this as weak context only.",
        [`.${parsed.publicSuffix}`],
      ),
    )
  }

  // Keywords are corroborating evidence: they only count with ≥2 distinct lure words or alongside
  // at least one other structural/impersonation signal, and never on the brand's own domain.
  const corroborated = f.suspiciousKeywords.length >= 2 || out.length + opts.otherSignals > 0
  if (!opts.brandOwned && f.suspiciousKeywords.length > 0 && corroborated) {
    out.push(
      makeFinding(
        "suspicious_keywords",
        "The address uses wording typical of account-verification or urgency lures. These words are also used by legitimate sites, so this only matters in combination with the other findings.",
        [`Words: ${f.suspiciousKeywords.join(", ")}`],
      ),
    )
  }

  return out
}

function consonantRun(s: string): number {
  let best = 0
  let cur = 0
  for (const ch of s) {
    if (/[bcdfghjklmnpqrstvwxz]/.test(ch)) best = Math.max(best, ++cur)
    else cur = 0
  }
  return best
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
