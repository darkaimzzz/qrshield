import { describe, expect, it } from "vitest"
import { parseUrl } from "@/lib/engine/parse"

function ok(input: string) {
  const r = parseUrl(input)
  if (!r.ok) throw new Error(`expected ok for ${input}: ${r.error}`)
  return r.url
}

describe("parseUrl", () => {
  it("accepts and normalizes ordinary URLs", () => {
    const u = ok("  https://Shop.Example.co.uk/path?q=1#top  ")
    expect(u.hostname).toBe("shop.example.co.uk")
    expect(u.registrableDomain).toBe("example.co.uk")
    expect(u.subdomain).toBe("shop")
    expect(u.publicSuffix).toBe("co.uk")
    expect(u.protocol).toBe("https:")
    expect(u.assumedProtocol).toBe(false)
  })

  it("uses the public suffix list, not the last two labels", () => {
    expect(ok("https://a.b.example.com.au").registrableDomain).toBe("example.com.au")
    // Private suffix: each github.io site is a separate registrable unit.
    expect(ok("https://victim.github.io").registrableDomain).toBe("victim.github.io")
  })

  it("assumes https when the scheme is missing, including host:port inputs", () => {
    const u = ok("example.com/login")
    expect(u.normalized).toBe("https://example.com/login")
    expect(u.assumedProtocol).toBe(true)
    expect(ok("example.com:8443/x").port).toBe("8443")
  })

  it.each([
    ["javascript:alert(1)", "javascript"],
    ["data:text/html,<script>alert(1)</script>", "data"],
    ["file:///etc/passwd", "file"],
    ["ftp://example.com/x", "ftp"],
    ["mailto:a@example.com", "mailto"],
    ["WIFI:S:home;T:WPA;P:secret;;", "wifi"],
  ])("rejects unsupported scheme %s", (input, scheme) => {
    const r = parseUrl(input)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.kind).toBe("unsupported_scheme")
      expect(r.scheme).toBe(scheme)
    }
  })

  it("rejects control characters, empty and oversized input", () => {
    expect(parseUrl("https://exa\u0000mple.com").ok).toBe(false)
    expect(parseUrl("https://example.com/\nx").ok).toBe(false)
    expect(parseUrl("   ").ok).toBe(false)
    expect(parseUrl(`https://example.com/${"a".repeat(3000)}`).ok).toBe(false)
  })

  it("rejects invalid or non-public hostnames", () => {
    expect(parseUrl("https://localhost/admin").ok).toBe(false)
    expect(parseUrl("https://intranet/").ok).toBe(false)
    expect(parseUrl("https://-bad-.com").ok).toBe(false)
    expect(parseUrl("http://").ok).toBe(false)
  })

  it("normalizes numeric IPv4 tricks via the WHATWG parser", () => {
    expect(ok("http://2130706433/").hostname).toBe("127.0.0.1")
    expect(ok("http://0x7f.1/").hostname).toBe("127.0.0.1")
    expect(ok("http://0177.0.0.1/").hostname).toBe("127.0.0.1")
    const v6 = ok("http://[::1]/")
    expect(v6.isIp).toBe(true)
    expect(v6.ipVersion).toBe(6)
  })

  it("records and strips embedded credentials", () => {
    const u = ok("https://paypal.com@evil.example/login")
    expect(u.hadCredentials).toBe(true)
    expect(u.credentialUser).toBe("paypal.com")
    expect(u.hostname).toBe("evil.example")
    expect(u.normalized).toBe("https://evil.example/login")
  })

  it("decodes punycode hostnames for display", () => {
    const u = ok("https://xn--pypal-4ve.com/")
    expect(u.hostnameUnicode).toBe("pаypal.com")
  })
})
