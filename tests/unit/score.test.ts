import { describe, expect, it } from "vitest"
import { INDICATORS, makeFinding, type IndicatorId } from "@/lib/engine/indicators"
import { bandFor, scoreFindings, THREAT_MATCH_FLOOR } from "@/lib/engine/score"

const f = (id: IndicatorId) => makeFinding(id, "x", ["e"])

describe("scoreFindings", () => {
  it("scores zero with no findings (missing evidence is not scored)", () => {
    expect(scoreFindings([])).toMatchObject({ score: 0, band: "low" })
  })

  it("sums independent indicators", () => {
    const r = scoreFindings([f("ip_host"), f("no_https")])
    expect(r.score).toBe(INDICATORS.ip_host.weight + INDICATORS.no_https.weight)
  })

  it("damps secondary indicators in the same correlation group", () => {
    const r = scoreFindings([f("homograph"), f("brand_impersonation")])
    expect(r.score).toBe(Math.round(20 + 15 * 0.5))
    expect(r.findings.find((x) => x.id === "homograph")?.contribution).toBe(7.5)
    expect(r.findings.find((x) => x.id === "brand_impersonation")?.contribution).toBe(20)
  })

  it("caps at 100", () => {
    const all = Object.keys(INDICATORS).map((id) => f(id as IndicatorId))
    expect(scoreFindings(all).score).toBe(100)
  })

  it("applies the threat-intel floor", () => {
    const r = scoreFindings([f("threat_intel_match")])
    expect(r.score).toBeGreaterThanOrEqual(THREAT_MATCH_FLOOR)
    expect(r.band).toBe("critical")
  })

  it("explains the score exactly by finding contributions", () => {
    const r = scoreFindings([f("shortener"), f("cross_domain_redirect"), f("no_https"), f("long_url")])
    expect(r.score).toBe(Math.round(r.findings.reduce((s, x) => s + x.contribution, 0)))
  })

  it("maps band boundaries", () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(bandFor)).toEqual([
      "low", "low", "moderate", "moderate", "high", "high", "critical", "critical",
    ])
  })
})
