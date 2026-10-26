/**
 * Hostname feature extraction for the ML classifier.
 * MUST stay identical to ml/features.py — tests/unit/ml-parity.test.ts enforces this against
 * vectors exported by the Python pipeline.
 *
 * Only the hostname is used (leading "www." stripped). The training data's legitimate URLs are
 * almost all bare homepages, so path/query features would learn that artifact rather than phishing.
 */

export const ML_KEYWORDS = [
  "login", "signin", "verify", "account", "update", "secure", "security", "bank", "confirm",
  "password", "wallet", "support", "service", "billing", "payment", "auth", "webscr", "recover",
  "unlock", "alert", "free", "bonus", "gift", "claim", "online", "app", "web", "mail", "office",
  "help",
]

export const ML_TLDS = [
  "com", "org", "net", "de", "uk", "ru", "info", "io", "xyz", "top", "app", "dev", "ly", "me",
  "co", "in", "br", "jp", "fr", "au", "it", "nl", "pl", "ca", "es", "edu", "gov", "tk", "ml",
  "ga", "cf", "gq", "shop", "online", "site", "store", "live", "club", "vip", "cn",
]

const VOWELS = new Set(["a", "e", "i", "o", "u"])

function entropy(s: string): number {
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

export function mlHostname(url: string): string | null {
  const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(url.trim())
  if (!m) return null
  return m[1].toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}

export function featureNames(): string[] {
  return [
    "host_length", "num_labels", "num_hyphens", "num_digits", "digit_ratio", "host_entropy",
    "longest_label", "mean_label", "tld_length", "is_ip", "has_punycode", "vowel_ratio",
    "max_consonant_run", "keyword_hits", "num_underscores", "hyphen_in_reg_label",
    "first_label_length", "repeated_char_max",
    ...ML_TLDS.map((t) => `tld_${t}`),
    "tld_other",
  ]
}

/** Returns the feature vector (same order as featureNames()). */
export function extractMlFeatures(host: string): number[] {
  const labels = host.split(".").filter(Boolean)
  const tld = labels.length > 1 ? labels[labels.length - 1] : ""
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") ? 1 : 0
  const letters = [...host].filter((c) => c >= "a" && c <= "z")
  const digits = [...host].filter((c) => c >= "0" && c <= "9").length
  const vowels = letters.filter((c) => VOWELS.has(c)).length

  let maxRun = 0
  let run = 0
  let maxRepeat = 0
  let repeat = 0
  let prev = ""
  for (const c of host) {
    if (c >= "a" && c <= "z" && !VOWELS.has(c)) maxRun = Math.max(maxRun, ++run)
    else run = 0
    repeat = c === prev ? repeat + 1 : 1
    maxRepeat = Math.max(maxRepeat, repeat)
    prev = c
  }

  const keywordHits = ML_KEYWORDS.filter((k) => host.includes(k)).length
  const regLabel = labels.length >= 2 ? labels[labels.length - 2] : (labels[0] ?? "")
  const labelLens = labels.map((l) => l.length)

  return [
    host.length,
    labels.length,
    (host.match(/-/g) ?? []).length,
    digits,
    host.length ? digits / host.length : 0,
    entropy(host.replace(/\./g, "")),
    labelLens.length ? Math.max(...labelLens) : 0,
    labelLens.length ? labelLens.reduce((a, b) => a + b, 0) / labelLens.length : 0,
    tld.length,
    isIp,
    host.includes("xn--") ? 1 : 0,
    letters.length ? vowels / letters.length : 0,
    maxRun,
    keywordHits,
    (host.match(/_/g) ?? []).length,
    regLabel.includes("-") ? 1 : 0,
    labels[0]?.length ?? 0,
    maxRepeat,
    ...ML_TLDS.map((t) => (tld === t ? 1 : 0)),
    tld && !ML_TLDS.includes(tld) ? 1 : 0,
  ]
}
