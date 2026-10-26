import http from "node:http"
import type { AddressInfo } from "node:net"
import type { LookupAddress } from "node:dns"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  createProbeAgent,
  createSafeLookup,
  fetchHop,
  makeFetchHop,
  inspectRedirects,
  isPublicAddress,
  probeBlockReason,
  type FetchHop,
} from "@/lib/engine/redirects"

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.100.100.200",
    "0.0.0.0", "255.255.255.255", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd00:ec2::254",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2002:7f00:1::", "64:ff9b::7f00:1", "192.0.2.1", "not-an-ip",
  ])("blocks %s", (ip) => expect(isPublicAddress(ip)).toBe(false))

  it.each(["8.8.8.8", "1.1.1.1", "93.184.215.14", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  )
})

function lookupWith(answers: LookupAddress[] | Error) {
  const safe = createSafeLookup((_h, _o, cb) =>
    answers instanceof Error ? cb(answers, []) : cb(null, answers),
  )
  return new Promise<{ err: Error | null; address: unknown }>((resolve) =>
    safe("victim.example", { all: false }, (err, address) => resolve({ err, address })),
  )
}

describe("createSafeLookup", () => {
  it("returns a public answer (the address the socket will connect to)", async () => {
    const r = await lookupWith([{ address: "93.184.215.14", family: 4 }])
    expect(r.err).toBeNull()
    expect(r.address).toBe("93.184.215.14")
  })

  it("refuses if any answer is private (mixed-answer rebinding)", async () => {
    const r = await lookupWith([
      { address: "93.184.215.14", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ])
    expect(r.err?.message).toMatch(/non-public address 127\.0\.0\.1/)
  })

  it("refuses metadata and IPv4-mapped loopback answers", async () => {
    expect((await lookupWith([{ address: "169.254.169.254", family: 4 }])).err).toBeTruthy()
    expect((await lookupWith([{ address: "::ffff:127.0.0.1", family: 6 }])).err).toBeTruthy()
  })

  it("validates every resolution independently (rebinding between lookups)", async () => {
    let calls = 0
    const safe = createSafeLookup((_h, _o, cb) =>
      cb(null, [{ address: ++calls === 1 ? "93.184.215.14" : "10.0.0.5", family: 4 }]),
    )
    const run = () =>
      new Promise<Error | null>((res) => safe("rebind.example", { all: false }, (e) => res(e)))
    expect(await run()).toBeNull()
    expect((await run())?.message).toMatch(/10\.0\.0\.5/)
  })
})

describe("probeBlockReason", () => {
  it("blocks unsafe targets before any connection", () => {
    expect(probeBlockReason("http://127.0.0.1/")).toMatch(/not a public address/)
    expect(probeBlockReason("http://2130706433/")).toMatch(/not a public address/)
    expect(probeBlockReason("http://[::1]/")).toMatch(/not a public address/)
    expect(probeBlockReason("https://example.com:22/")).toMatch(/Port 22/)
    expect(probeBlockReason("https://user:pw@example.com/")).toMatch(/credentials/)
    expect(probeBlockReason("file:///etc/passwd")).toBeTruthy()
    expect(probeBlockReason("https://example.com/")).toBeNull()
  })
})

describe("inspectRedirects", () => {
  const chain: Record<string, { status: number; location?: string }> = {
    "https://short.example/a": { status: 301, location: "https://middle.example/b" },
    "https://middle.example/b": { status: 302, location: "/c" },
    "https://middle.example/c": { status: 302, location: "https://final.example/" },
    "https://final.example/": { status: 200 },
  }
  const fake: FetchHop = async (url) => {
    const hop = chain[url]
    if (!hop) throw Object.assign(new Error("nope"), { code: "ENOTFOUND" })
    return { status: hop.status, location: hop.location ?? null }
  }

  it("follows a chain, resolving relative locations and marking cross-domain hops", async () => {
    const r = await inspectRedirects("https://short.example/a", fake)
    expect(r.status).toBe("done")
    expect(r.finalUrl).toBe("https://final.example/")
    expect(r.hops.map((h) => h.status)).toEqual([301, 302, 302, 200])
    expect(r.hops.map((h) => h.crossDomain)).toEqual([false, true, false, true])
  })

  it("refuses to follow a redirect to an internal address", async () => {
    const r = await inspectRedirects("https://a.example/", async () => ({
      status: 302,
      location: "http://169.254.169.254/latest/meta-data/",
    }))
    expect(r.hops).toHaveLength(2)
    expect(r.hops[1].error).toMatch(/not a public address/)
    expect(r.hops[1].status).toBeNull()
  })

  it("detects loops and caps the chain length", async () => {
    const loop = await inspectRedirects("https://a.example/", async (u) => ({
      status: 302,
      location: u === "https://a.example/" ? "https://b.example/" : "https://a.example/",
    }))
    expect(loop.loop).toBe(true)
    let n = 0
    const endless = await inspectRedirects("https://a.example/0", async () => ({
      status: 302,
      location: `https://a.example/${++n}`,
    }))
    expect(endless.truncated).toBe(true)
    expect(endless.hops).toHaveLength(6)
  })

  it("reports failures honestly instead of inventing a chain", async () => {
    const r = await inspectRedirects("https://nowhere.example/", fake)
    expect(r.status).toBe("failed")
    expect(r.finalUrl).toBeNull()
    expect(r.hops[0].error).toMatch(/DNS/)
  })
})

describe("real connector against a loopback server", () => {
  let server: http.Server
  let port = 0
  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end("secret internal page"))
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
    port = (server.address() as AddressInfo).port
  })
  afterAll(() => server.close())

  it("refuses IP-literal loopback targets inside the connector itself", async () => {
    await expect(fetchHop(`http://127.0.0.1:${port}/`, AbortSignal.timeout(2000))).rejects.toThrow(
      /not a public address/,
    )
  })

  it("refuses a hostname whose DNS answer points at loopback (rebinding)", async () => {
    const agent = createProbeAgent((_h, _o, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]))
    const hop = makeFetchHop(() => agent)
    await expect(hop(`http://rebind.example:${port}/`, AbortSignal.timeout(2000))).rejects.toThrow()
    await agent.close()
  })

  it("control: the same server is reachable when DNS is public-looking but socket is pinned", async () => {
    // Proves the test server works, so the rejections above come from the guard, not the server.
    const res = await fetch(`http://127.0.0.1:${port}/`)
    expect(await res.text()).toBe("secret internal page")
  })
})
