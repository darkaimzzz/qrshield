import { makeFinding } from "./indicators"
import { tokenize } from "./lexical"
import type { Finding, LexicalFeatures, ParsedUrl } from "./types"

/**
 * Reference set of frequently impersonated brands (drawn from brands that recur in public
 * phishing reports: APWG, OpenPhish, Check Point brand-phishing reports), each with the
 * registrable domains the brand actually operates. Being on this list means "worth checking
 * for look-alikes", nothing more. Matching only ever yields *possible* impersonation.
 */
export interface Brand {
  name: string
  /** Word tokens that identify the brand in a hostname. */
  tokens: string[]
  domains: string[]
}

export const BRANDS: Brand[] = [
  { name: "PayPal", tokens: ["paypal"], domains: ["paypal.com", "paypal.me", "paypalobjects.com"] },
  {
    name: "Apple",
    tokens: ["apple", "icloud", "itunes"],
    domains: ["apple.com", "icloud.com", "itunes.com", "apple.co"],
  },
  {
    name: "Microsoft",
    tokens: [
      "microsoft",
      "microsoftonline",
      "office365",
      "outlook",
      "onedrive",
      "sharepoint",
      "hotmail",
    ],
    domains: [
      "microsoft.com",
      "live.com",
      "office.com",
      "outlook.com",
      "microsoftonline.com",
      "office365.com",
      "sharepoint.com",
      "onedrive.com",
      "hotmail.com",
      "msn.com",
      "azure.com",
      "bing.com",
    ],
  },
  {
    name: "Google",
    tokens: ["google", "gmail", "youtube"],
    domains: [
      "google.com",
      "gmail.com",
      "youtube.com",
      "youtu.be",
      "goo.gl",
      "google.co.in",
      "google.co.uk",
      "googleusercontent.com",
      "g.co",
    ],
  },
  {
    name: "Amazon",
    tokens: ["amazon", "amzn"],
    domains: [
      "amazon.com",
      "amazon.in",
      "amazon.co.uk",
      "amazon.de",
      "amzn.to",
      "amazon.ca",
      "amazon.com.au",
    ],
  },
  { name: "Netflix", tokens: ["netflix"], domains: ["netflix.com"] },
  {
    name: "Meta / Facebook",
    tokens: ["facebook"],
    domains: ["facebook.com", "fb.com", "meta.com", "messenger.com", "fb.me"],
  },
  { name: "Instagram", tokens: ["instagram"], domains: ["instagram.com"] },
  { name: "WhatsApp", tokens: ["whatsapp"], domains: ["whatsapp.com", "wa.me", "whatsapp.net"] },
  { name: "LinkedIn", tokens: ["linkedin"], domains: ["linkedin.com", "lnkd.in"] },
  { name: "X / Twitter", tokens: ["twitter"], domains: ["twitter.com", "x.com", "t.co"] },
  { name: "Dropbox", tokens: ["dropbox"], domains: ["dropbox.com"] },
  { name: "DocuSign", tokens: ["docusign"], domains: ["docusign.com", "docusign.net"] },
  { name: "Adobe", tokens: ["adobe"], domains: ["adobe.com"] },
  { name: "Chase", tokens: ["chase"], domains: ["chase.com"] },
  { name: "Bank of America", tokens: ["bankofamerica", "bofa"], domains: ["bankofamerica.com"] },
  { name: "Wells Fargo", tokens: ["wellsfargo"], domains: ["wellsfargo.com"] },
  { name: "HSBC", tokens: ["hsbc"], domains: ["hsbc.com", "hsbc.co.uk", "hsbc.co.in"] },
  { name: "Barclays", tokens: ["barclays"], domains: ["barclays.co.uk", "barclays.com"] },
  {
    name: "American Express",
    tokens: ["americanexpress", "amex"],
    domains: ["americanexpress.com"],
  },
  // "visa" is also an ordinary word (visa.vfsglobal.com); listed for ownership checks only.
  { name: "Visa", tokens: [], domains: ["visa.com", "visa.co.in"] },
  { name: "Mastercard", tokens: ["mastercard"], domains: ["mastercard.com", "mastercard.co.in"] },
  { name: "DHL", tokens: ["dhl"], domains: ["dhl.com", "dhl.de"] },
  { name: "FedEx", tokens: ["fedex"], domains: ["fedex.com"] },
  { name: "UPS", tokens: ["ups"], domains: ["ups.com"] },
  { name: "USPS", tokens: ["usps"], domains: ["usps.com"] },
  { name: "India Post", tokens: ["indiapost"], domains: ["indiapost.gov.in"] },
  { name: "IRS", tokens: ["irs"], domains: ["irs.gov"] },
  { name: "Coinbase", tokens: ["coinbase"], domains: ["coinbase.com"] },
  { name: "Binance", tokens: ["binance"], domains: ["binance.com"] },
  { name: "MetaMask", tokens: ["metamask"], domains: ["metamask.io"] },
  {
    name: "Steam",
    tokens: ["steampowered", "steamcommunity"],
    domains: ["steampowered.com", "steamcommunity.com"],
  },
  { name: "Roblox", tokens: ["roblox"], domains: ["roblox.com"] },
  { name: "Spotify", tokens: ["spotify"], domains: ["spotify.com"] },
  { name: "eBay", tokens: ["ebay"], domains: ["ebay.com", "ebay.in", "ebay.co.uk"] },
  { name: "Walmart", tokens: ["walmart"], domains: ["walmart.com"] },
  {
    name: "State Bank of India",
    tokens: ["onlinesbi", "sbi"],
    domains: ["onlinesbi.sbi", "sbi.co.in", "sbi.bank.in"],
  },
  {
    name: "HDFC Bank",
    tokens: ["hdfcbank", "hdfc"],
    domains: ["hdfcbank.com", "hdfc.com", "hdfc.bank.in"],
  },
  {
    name: "ICICI Bank",
    tokens: ["icicibank", "icici"],
    domains: ["icicibank.com", "icici.bank.in"],
  },
  { name: "Axis Bank", tokens: ["axisbank"], domains: ["axisbank.com", "axis.bank.in"] },
  { name: "Paytm", tokens: ["paytm"], domains: ["paytm.com", "paytm.in"] },
  { name: "PhonePe", tokens: ["phonepe"], domains: ["phonepe.com"] },
  {
    name: "BHIM UPI / NPCI",
    tokens: ["bhimupi", "npci"],
    domains: ["bhimupi.org.in", "npci.org.in"],
  },
]

const BRAND_DOMAINS = new Map(BRANDS.flatMap((b) => b.domains.map((d) => [d, b] as const)))

/** Words that, glued onto a brand name, form a typical lure domain ("paypalsecure", "apple-id"). */
const LURE_AFFIXES = new Set([
  "secure",
  "security",
  "login",
  "signin",
  "verify",
  "verification",
  "account",
  "accounts",
  "support",
  "help",
  "helpdesk",
  "service",
  "services",
  "online",
  "update",
  "id",
  "pay",
  "wallet",
  "center",
  "centre",
  "team",
  "official",
  "auth",
  "billing",
  "customer",
  "care",
  "alert",
  "alerts",
  "refund",
  "rewards",
  "gift",
  "unlock",
  "recovery",
  "kyc",
  "bonus",
  "app",
])

/**
 * Look-alike characters folded to the Latin letter they imitate (subset of Unicode
 * confusables.txt covering Cyrillic/Greek homoglyphs) plus common digit/leet substitutions.
 */
const CONFUSABLES: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ј: "j",
  ԁ: "d",
  ɡ: "g",
  ӏ: "l",
  ԛ: "q",
  ѕ: "s",
  ԝ: "w",
  һ: "h",
  ν: "v",
  ο: "o",
  α: "a",
  ρ: "p",
  τ: "t",
  ι: "i",
  κ: "k",
  ε: "e",
  ɑ: "a",
  ı: "i",
  ł: "l",
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
}

/** Maps a hostname label to the ASCII "skeleton" a human would likely read it as. */
export function skeleton(label: string): string {
  let s = label.normalize("NFKC").toLowerCase()
  s = [...s].map((ch) => CONFUSABLES[ch] ?? ch).join("")
  return s
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/cl(?=[aeiou])/g, "d")
}

/** Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

export function isBrandOwned(parsed: ParsedUrl): Brand | null {
  return parsed.registrableDomain ? (BRAND_DOMAINS.get(parsed.registrableDomain) ?? null) : null
}

interface BrandMatch {
  brand: Brand
  evidence: string
}

function matchBrand(parsed: ParsedUrl): BrandMatch | null {
  if (!parsed.registrableDomain || !parsed.publicSuffix) return null
  // Unicode and ASCII hostnames have the same label count, so labels can be sliced in parallel.
  const unicodeLabels = parsed.hostnameUnicode.split(".")
  const regLabelCount = parsed.registrableDomain.split(".").length
  const regUnicode = unicodeLabels.slice(-regLabelCount).join(".")
  const regLabelAscii = parsed.registrableDomain.split(".")[0]
  const regLabelUnicode = unicodeLabels[unicodeLabels.length - regLabelCount] ?? ""
  const subTokens = new Set(tokenize(parsed.subdomain))
  const regParts = regLabelAscii.split("-")
  const skel = skeleton(regLabelUnicode || regLabelAscii)

  for (const brand of BRANDS) {
    for (const token of brand.tokens) {
      // 1. Brand name used as a word in the subdomain of an unrelated domain.
      if (subTokens.has(token)) {
        return {
          brand,
          evidence: `“${token}” appears in the subdomain, but the site is actually ${parsed.registrableDomain}`,
        }
      }
      // 2. Brand combined with lure words in the registrable label ("paypal-verify", "applesupport").
      if (regParts.length > 1 && regParts.includes(token)) {
        return {
          brand,
          evidence: `Registrable domain ${parsed.registrableDomain} combines “${token}” with other words`,
        }
      }
      if (token.length >= 5 && regLabelAscii !== token) {
        const rest = regLabelAscii.startsWith(token)
          ? regLabelAscii.slice(token.length)
          : regLabelAscii.endsWith(token)
            ? regLabelAscii.slice(0, -token.length)
            : null
        if (rest !== null && LURE_AFFIXES.has(rest.replace(/-/g, ""))) {
          return {
            brand,
            evidence: `Registrable domain ${parsed.registrableDomain} = “${token}” + “${rest}”`,
          }
        }
      }
      // 3. Homoglyph / leet look-alike: the label *reads* as the brand but is spelled differently.
      if (token.length >= 4 && skel === token && (regLabelUnicode || regLabelAscii) !== token) {
        return {
          brand,
          evidence: `“${regUnicode || parsed.registrableDomain}” visually resembles “${token}” after character substitution`,
        }
      }
      // 4. Typosquatting: one or two edits away from the brand name. Short names are skipped
      //    because too many ordinary words sit one edit from them ("apple" → "apply").
      if (token.length >= 6 && regLabelAscii !== token) {
        const max = token.length >= 9 ? 2 : 1
        const dist = Math.min(editDistance(skel, token), editDistance(regLabelAscii, token))
        if (dist > 0 && dist <= max) {
          return {
            brand,
            evidence: `“${regLabelAscii}” is ${dist} character edit${dist > 1 ? "s" : ""} away from “${token}”`,
          }
        }
      }
      // 5. Brand name with a different public suffix ("paypal.co" when the brand uses paypal.com).
      if (regLabelAscii === token && token.length >= 5) {
        return {
          brand,
          evidence: `${parsed.registrableDomain} uses the brand name but is not one of ${brand.name}'s known domains (${brand.domains.slice(0, 3).join(", ")})`,
        }
      }
    }
  }
  return null
}

export function impersonationFindings(parsed: ParsedUrl, f: LexicalFeatures): Finding[] {
  if (parsed.isIp || isBrandOwned(parsed)) return []
  const out: Finding[] = []

  const match = matchBrand(parsed)
  if (match) {
    out.push(
      makeFinding(
        "brand_impersonation",
        `The address resembles ${match.brand.name}, but it is not on the list of domains ${match.brand.name} is known to use. This is a possible impersonation, not a confirmed one: some brands use partner or regional domains that are not in QRShield's reference list.`,
        [
          match.evidence,
          `Known ${match.brand.name} domains: ${match.brand.domains.slice(0, 4).join(", ")}`,
        ],
      ),
    )
  }

  if (f.mixedScriptLabel || f.isPunycode || f.nonAsciiHost) {
    const evidence = [
      `Displayed as: ${parsed.hostnameUnicode}`,
      `Actual (punycode): ${parsed.hostname}`,
    ]
    if (f.mixedScriptLabel) evidence.unshift(`Mixed scripts in one label: ${f.mixedScriptLabel}`)
    out.push(
      makeFinding(
        "homograph",
        f.mixedScriptLabel
          ? "A hostname label mixes Latin letters with letters from another alphabet that look identical. This is a strong sign of a homograph attack, where a fake domain is made to look like a familiar one."
          : "The hostname uses internationalized (non-ASCII) characters. Many legitimate sites use them, but they can also be used to create addresses that look identical to well-known domains.",
        evidence,
      ),
    )
  }

  return out
}
