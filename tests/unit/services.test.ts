import { afterEach, describe, expect, it, vi } from "vitest"
import { parseRdap } from "@/lib/engine/rdap"
import { canonicalUrl, checkThreatIntel, type ThreatProvider } from "@/lib/engine/threat-intel"
import { classify, MODEL, modelIsUsable, predictProbability } from "@/lib/engine/ml"
import { extractMlFeatures, mlHostname } from "@/lib/engine/ml-features"
import { rateLimit } from "@/lib/rate-limit"
import parity from "../fixtures/ml-parity.json"

describe("parseRdap", () => {
  const now = Date.parse("2026-10-26T00:00:00Z")
  it("extracts events and registrar from an RDAP domain object", () => {
    const r = parseRdap(
      {
        events: [
          { eventAction: "registration", eventDate: "2026-10-10T12:00:00Z" },
          { eventAction: "expiration", eventDate: "2027-10-10T12:00:00Z" },
          { eventAction: "last changed", eventDate: "2026-10-11T00:00:00Z" },
        ],
        entities: [
          { roles: ["registrant"] },
          { roles: ["registrar"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Example Registrar, Inc."]]] },
        ],
      },
      now,
    )
    expect(r).toEqual({
      registrationDate: "2026-10-10T12:00:00.000Z",
      expirationDate: "2027-10-10T12:00:00.000Z",
      lastChangedDate: "2026-10-11T00:00:00.000Z",
      registrar: "Example Registrar, Inc.",
      ageDays: 15,
    })
  })

  it("leaves missing or malformed data as null rather than guessing", () => {
    expect(parseRdap({ events: [{ eventAction: "registration", eventDate: "garbage" }] }, now)).toMatchObject({
      registrationDate: null,
      registrar: null,
      ageDays: null,
    })
    expect(parseRdap({ events: [{ eventAction: "registration", eventDate: "2030-01-01" }] }, now).ageDays).toBeNull()
  })
})

describe("checkThreatIntel", () => {
  afterEach(() => vi.unstubAllEnvs())
  const provider = (over: Partial<ThreatProvider>): ThreatProvider => ({
    id: "p",
    name: "P",
    unavailableReason: () => null,
    check: async () => ({ matched: false, detail: "no" }),
    ...over,
  })

  it("never reports an unqueried provider as clean", async () => {
    const r = await checkThreatIntel(["https://a.example/"], [
      provider({ id: "off", unavailableReason: () => "Not configured" }),
      provider({ id: "boom", check: async () => Promise.reject(new Error("HTTP 503")) }),
    ])
    expect(r.providers.map((p) => p.status)).toEqual(["not_checked", "error"])
    expect(r.status).toBe("failed")
  })

  it("reports matches and no_match from providers that ran", async () => {
    const r = await checkThreatIntel(["https://a.example/"], [
      provider({ id: "hit", check: async () => ({ matched: true, detail: "listed" }) }),
      provider({ id: "miss" }),
    ])
    expect(r.providers.map((p) => p.status)).toEqual(["match", "no_match"])
    expect(r.status).toBe("done")
  })

  it("skips every provider when network checks are disabled", async () => {
    vi.stubEnv("QRSHIELD_DISABLE_NETWORK", "1")
    const check = vi.fn()
    const r = await checkThreatIntel(["https://a.example/"], [provider({ check })])
    expect(check).not.toHaveBeenCalled()
    expect(r.status).toBe("skipped")
    expect(r.providers[0].status).toBe("not_checked")
  })

  it("canonicalizes URLs for exact feed matching", () => {
    expect(canonicalUrl("HTTPS://Evil.Example/Login/#x")).toBe("https://evil.example/Login")
    expect(canonicalUrl("not a url")).toBeNull()
  })
})

describe("ML model", () => {
  it("loads a model whose features match this build", () => {
    expect(modelIsUsable()).toBe(true)
    expect(MODEL.calibrated).toBe(false)
  })

  it("matches the Python pipeline's features and probabilities exactly (parity)", () => {
    expect(parity.length).toBeGreaterThan(200)
    for (const row of parity as { host: string; features: number[]; probability: number }[]) {
      const x = extractMlFeatures(row.host)
      x.forEach((v, i) => expect(v, `${row.host} feature ${i}`).toBeCloseTo(row.features[i], 9))
      expect(predictProbability(row.host).probability, row.host).toBeCloseTo(row.probability, 9)
    }
  })

  it("extracts hostnames the same way as the Python pipeline", () => {
    expect(mlHostname("https://user@WWW.Example.com:8080/x")).toBe("example.com")
    expect(mlHostname("no scheme")).toBeNull()
  })

  it("returns a bounded, labelled probability with top factors", () => {
    const r = classify("secure-login-verify-account.xyz")
    expect(r.status).toBe("available")
    expect(r.probability).toBeGreaterThan(0)
    expect(r.probability).toBeLessThan(1)
    expect(r.detail).toMatch(/Uncalibrated/)
    expect(r.topFactors.length).toBeGreaterThan(0)
  })
})

describe("rateLimit", () => {
  it("allows a burst then refills over time", () => {
    const t = 1_000_000
    const results = Array.from({ length: 21 }, () => rateLimit("k", t))
    expect(results.filter(Boolean)).toHaveLength(20)
    expect(rateLimit("k", t + 3_000)).toBe(true)
  })
})
