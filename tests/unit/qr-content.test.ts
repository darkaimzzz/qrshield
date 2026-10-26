import { describe, expect, it } from "vitest"
import { analyze } from "@/lib/engine/report"
import { classifyQrContent } from "@/lib/qr-content"

describe("classifyQrContent", () => {
  it("routes web URLs (with or without scheme) to analysis", () => {
    expect(classifyQrContent("https://example.com").kind).toBe("url")
    expect(classifyQrContent("example.com/menu").kind).toBe("url")
    expect(classifyQrContent("example.com:8080/x").kind).toBe("url")
  })

  it("never treats executable or app schemes as URLs", () => {
    expect(classifyQrContent("javascript:alert(1)")).toMatchObject({
      kind: "blocked_scheme",
      scheme: "javascript",
    })
    expect(classifyQrContent("intent://scan/#Intent;scheme=zxing;end")).toMatchObject({
      kind: "blocked_scheme",
    })
  })

  it("parses payment, Wi-Fi and contact payloads without exposing secrets", () => {
    const upi = classifyQrContent("upi://pay?pa=a@bank&pn=Shop&am=10")
    expect(upi.kind).toBe("upi")
    const wifi = classifyQrContent("WIFI:T:WPA;S:My\\;Net;P:secret;;")
    expect(wifi).toMatchObject({ kind: "wifi" })
    expect(JSON.stringify(wifi.kind === "wifi" && wifi.fields)).toContain("My;Net")
    expect(JSON.stringify(wifi.kind === "wifi" && wifi.fields)).not.toContain("secret")
    expect(classifyQrContent("tel:+15550100").kind).toBe("tel")
    expect(classifyQrContent("hello world").kind).toBe("text")
  })
})

describe("http → https upgrade on the same site", () => {
  it("does not penalize plain http when the site immediately upgrades", async () => {
    const r = await analyze("http://example.org/", "url", () => {}, {
      inspectRedirects: async () => ({
        status: "done",
        hops: [
          { url: "http://example.org/", hostname: "example.org", status: 301, crossDomain: false },
          { url: "https://example.org/", hostname: "example.org", status: 200, crossDomain: false },
        ],
        finalUrl: "https://example.org/",
        loop: false,
        truncated: false,
        detail: "1 redirect followed.",
      }),
      lookupDomain: async () => ({
        status: "skipped",
        domain: null,
        registrationDate: null,
        expirationDate: null,
        lastChangedDate: null,
        registrar: null,
        ageDays: null,
        source: null,
        detail: "x",
      }),
      checkThreatIntel: async () => ({ status: "not_configured", providers: [] }),
      warmThreatFeeds: () => {},
    })
    expect(r.findings.map((f) => f.id)).not.toContain("no_https")
    expect(r.limitations.join(" ")).toMatch(/first request is still unencrypted/)
  })
})
