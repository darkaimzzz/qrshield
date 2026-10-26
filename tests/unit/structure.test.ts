import { describe, expect, it } from "vitest"
import { editDistance, skeleton } from "@/lib/engine/impersonation"
import { parseUrl } from "@/lib/engine/parse"
import { analyzeStructure } from "@/lib/engine/structure"

function ids(input: string): string[] {
  const p = parseUrl(input)
  if (!p.ok) throw new Error(p.error)
  return analyzeStructure(p.url).findings.map((f) => f.id)
}

describe("structural analysis", () => {
  it("finds nothing notable on plain, well-formed URLs", () => {
    expect(ids("https://www.wikipedia.org/")).toEqual([])
    expect(ids("https://github.com/vercel/next.js")).toEqual([])
  })

  it("does not flag a brand's own login page for keywords or impersonation", () => {
    expect(ids("https://accounts.google.com/signin/v2/identifier")).toEqual([])
    expect(ids("https://www.paypal.com/signin?returnUri=%2Fmyaccount")).toEqual([])
  })

  it("does not flag a single login keyword on its own", () => {
    expect(ids("https://forum.example.org/login")).toEqual([])
  })

  it("flags domains assembled from lure words, but not real brand names", () => {
    expect(ids("https://secure-account-verify.example/")).toContain("lure_domain_name")
    expect(ids("https://secure-shop.example/")).not.toContain("lure_domain_name")
    expect(ids("https://login.microsoftonline.com.auth.example/")).toContain("brand_impersonation")
    expect(ids("https://login.microsoftonline.com/common/oauth2")).toEqual([])
  })

  it("flags keywords when corroborated by other signals", () => {
    const r = ids("http://secure-account-update.example/verify/login")
    expect(r).toContain("suspicious_keywords")
    expect(r).toContain("no_https")
  })

  it("flags IP hosts, credentials syntax and non-standard ports", () => {
    expect(ids("http://203.0.113.7/login")).toContain("ip_host")
    expect(ids("https://paypal.com@evil.example/")).toContain("credentials_in_url")
    expect(ids("https://example.com:8443/")).toContain("nonstandard_port")
  })

  it("flags a non-standard IPv4 notation as unusual encoding", () => {
    expect(ids("http://3405803783/")).toEqual(
      expect.arrayContaining(["ip_host", "unusual_encoding"]),
    )
  })

  it("detects brand impersonation patterns", () => {
    expect(ids("https://paypal.com.secure-check.example/")).toEqual(
      expect.arrayContaining(["brand_impersonation", "domain_in_subdomain"]),
    )
    expect(ids("https://paypa1.com/")).toContain("brand_impersonation")
    expect(ids("https://paypal-verify.example/")).toContain("brand_impersonation")
    expect(ids("https://applesupport.example/")).toContain("brand_impersonation")
    expect(ids("https://micr0soft.example/")).toContain("brand_impersonation")
  })

  it("avoids common false positives for short brand names", () => {
    expect(ids("https://www.pineapple.example/")).not.toContain("brand_impersonation")
    expect(ids("https://apply.example/")).not.toContain("brand_impersonation")
    expect(ids("https://groups.example/")).not.toContain("brand_impersonation")
  })

  it("detects homographs (mixed Cyrillic/Latin)", () => {
    const r = ids("https://xn--pypal-4ve.com/")
    expect(r).toEqual(expect.arrayContaining(["homograph", "brand_impersonation"]))
  })

  it("flags shorteners, executables, long URLs and embedded redirects", () => {
    expect(ids("https://bit.ly/3abcXYZ")).toContain("shortener")
    expect(ids("https://files.example/setup/Installer.apk")).toContain("executable_download")
    expect(ids(`https://example.com/${"a/".repeat(60)}`)).toContain("long_url")
    expect(ids("https://example.com/out?url=https%3A%2F%2Fevil.example")).toContain(
      "embedded_redirect_param",
    )
  })

  it("flags random-looking hostnames but not ordinary words", () => {
    expect(ids("https://xkqjwvbrtzpl.example/")).toContain("random_hostname")
    expect(ids("https://internationalization.example/")).not.toContain("random_hostname")
  })
})

describe("impersonation helpers", () => {
  it("computes Damerau-Levenshtein distance", () => {
    expect(editDistance("paypal", "paypal")).toBe(0)
    expect(editDistance("paypa1", "paypal")).toBe(1)
    expect(editDistance("payapl", "paypal")).toBe(1)
    expect(editDistance("gooogle", "google")).toBe(1)
  })

  it("folds look-alike characters into a skeleton", () => {
    expect(skeleton("pаypal")).toBe("paypal") // Cyrillic а
    expect(skeleton("rnicrosoft")).toBe("microsoft")
    expect(skeleton("g00gle")).toBe("google")
  })
})
