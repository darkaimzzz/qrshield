import { describe, expect, it } from "vitest"
import { buildRecommendations, buildSummary } from "@/lib/engine/explain"
import { analyze, InputError, type AnalyzeDeps } from "@/lib/engine/report"
import type { AnalyzeEvent, DomainInfo, RedirectResult, ThreatIntelResult } from "@/lib/engine/types"

const noDomain: DomainInfo = {
  status: "failed",
  domain: null,
  registrationDate: null,
  expirationDate: null,
  lastChangedDate: null,
  registrar: null,
  ageDays: null,
  source: null,
  detail: "RDAP lookup failed: timed out",
}
const notChecked: ThreatIntelResult = {
  status: "not_configured",
  providers: [{ id: "x", name: "X", status: "not_checked", detail: "Not configured" }],
}
const noRedirect = (url: string): RedirectResult => ({
  status: "done",
  hops: [{ url, hostname: new URL(url).hostname, status: 200, crossDomain: false }],
  finalUrl: url,
  loop: false,
  truncated: false,
  detail: "No HTTP redirect (status 200).",
})

function deps(over: Partial<AnalyzeDeps> = {}): AnalyzeDeps {
  return {
    inspectRedirects: async (u) => noRedirect(u),
    lookupDomain: async () => noDomain,
    checkThreatIntel: async () => notChecked,
    warmThreatFeeds: () => {},
    ...over,
  }
}

describe("analyze pipeline", () => {
  it("emits running/finished events for each real stage in order of completion", async () => {
    const events: AnalyzeEvent[] = []
    await analyze("https://example.com/", "url", (e) => events.push(e), deps())
    const stages = events.filter((e) => e.type === "stage").map((e) => e.type === "stage" && `${e.stage}:${e.status}`)
    expect(stages).toEqual([
      "structure:running", "structure:done", "redirects:running", "redirects:done",
      "domain:running", "threat_intel:running", "domain:failed", "threat_intel:not_configured",
      "scoring:running", "scoring:done", "report:running", "report:done",
    ])
  })

  it("rejects invalid input with an InputError", async () => {
    await expect(analyze("javascript:alert(1)", "url", () => {}, deps())).rejects.toBeInstanceOf(InputError)
  })

  it("keeps unavailable checks out of the score and lists them as limitations", async () => {
    const r = await analyze("https://example.com/", "url", () => {}, deps())
    expect(r.score).toBe(0)
    expect(r.band).toBe("low")
    expect(r.checks.find((c) => c.id === "domain")?.status).toBe("failed")
    expect(r.limitations.join(" ")).toMatch(/Domain registration data unavailable/)
    expect(r.limitations.join(" ")).toMatch(/No threat-intelligence source could be queried/)
    expect(r.explanation.summary).toMatch(/partial evidence/)
    expect(r.explanation.generatedBy).toBe("template")
  })

  it("analyzes the final destination of a redirect and adds age + threat-intel evidence", async () => {
    const r = await analyze(
      "https://bit.ly/abc",
      "camera",
      () => {},
      deps({
        inspectRedirects: async () => ({
          status: "done",
          hops: [
            { url: "https://bit.ly/abc", hostname: "bit.ly", status: 301, crossDomain: false },
            { url: "http://paypal-verify.example/login", hostname: "paypal-verify.example", status: 200, crossDomain: true },
          ],
          finalUrl: "http://paypal-verify.example/login",
          loop: false,
          truncated: false,
          detail: "1 redirect followed.",
        }),
        lookupDomain: async (host) => ({
          ...noDomain,
          status: "done",
          domain: host,
          registrationDate: "2026-10-20T00:00:00.000Z",
          ageDays: 6,
          source: "rdap.example",
          detail: "ok",
        }),
        checkThreatIntel: async () => ({
          status: "done",
          providers: [{ id: "google_safe_browsing", name: "GSB", status: "match", detail: "SOCIAL_ENGINEERING" }],
        }),
      }),
    )
    const ids = r.findings.map((f) => f.id)
    expect(ids).toEqual(
      expect.arrayContaining(["shortener", "cross_domain_redirect", "brand_impersonation", "no_https", "domain_new_30", "threat_intel_match"]),
    )
    expect(r.findings.find((f) => f.id === "brand_impersonation")?.evidence[0]).toMatch(/^Final destination:/)
    expect(r.band).toBe("critical")
    expect(r.ml.status).toBe("available")
    expect(r.explanation.recommendations.join(" ")).toMatch(/Do not enter passwords/)
  })
})

describe("explanations are grounded in findings", () => {
  it("only mentions indicators that were actually found", async () => {
    const r = await analyze("http://203.0.113.9/", "url", () => {}, deps())
    const summary = buildSummary({ ...r })
    expect(summary).toMatch(/raw IP address/)
    expect(summary).toMatch(/no HTTPS/)
    expect(summary).not.toMatch(/brand|redirect|registered/)
  })

  it("tailors recommendations to the band", () => {
    expect(buildRecommendations("low", []).join(" ")).toMatch(/verify the source/)
    expect(buildRecommendations("low", []).join(" ")).not.toMatch(/Do not enter passwords/)
  })
})
