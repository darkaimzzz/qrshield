# Security design

How QRShield safely fetches attacker-controlled URLs, and how user data is handled. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Redirect investigation and SSRF defense in depth (`lib/engine/redirects.ts`)

The server fetches attacker-chosen URLs, which is a textbook **Server-Side Request Forgery** surface. An attacker could encode `http://169.254.169.254/latest/meta-data/` (the cloud metadata service) in a QR code, or a domain that resolves to an internal address. QRShield's defenses are layered so that each one is sufficient on its own for the attacks it covers.

### Layers

| #   | Layer                                                                                                                                                                                                                                 | Where                   | Stops                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| 1   | Strict parse of every URL (initial **and each Location**): http/https only, valid public hostname, no credentials, **ports 80/443 only**                                                                                              | `probeBlockReason()`    | `file:`, `gopher:`, `ftp:`; `:22`/`:6379`/`:11211` port scans; credential smuggling |
| 2   | WHATWG normalization of numeric hosts _before_ validation                                                                                                                                                                             | `parseUrl()`            | `http://2130706433/`, `0x7f.1`, `0177.0.0.1`                                        |
| 3   | IP-literal validation **inside the connector** (Node skips DNS for literals, so the lookup hook alone would miss them)                                                                                                                | `makeFetchHop()`        | `http://127.0.0.1/`, `http://[::1]/`, even when called directly                     |
| 4   | `createSafeLookup`: resolves **all** A/AAAA records and fails if **any** answer is non-public                                                                                                                                         | `createSafeLookup()`    | DNS names pointing to internal IPs; mixed public+private answers                    |
| 5   | **Connection pinning**: the safe lookup _is_ the lookup Node's `net.connect`/`tls.connect` uses for the socket (passed via undici `Agent({ connect: { lookup } })`), so the socket connects to exactly the address that was validated | `createProbeAgent()`    | **DNS rebinding** (TOCTOU between check and connect)                                |
| 6   | TLS servername remains the hostname                                                                                                                                                                                                   | undici connector        | Pinning never weakens certificate verification                                      |
| 7   | No automatic redirects. Each hop is a separate request, re-validated from layer 1                                                                                                                                                     | `inspectRedirects()`    | Open-redirect bounce to `http://localhost`                                          |
| 8   | Max 5 redirects; loop detection via a visited set                                                                                                                                                                                     | `MAX_REDIRECTS`, `seen` | Infinite chains                                                                     |
| 9   | Timeouts: 3 s connect, 5 s per hop (headers/body), 12 s overall (`AbortSignal.any`)                                                                                                                                                   | constants               | Slowloris / tarpits                                                                 |
| 10  | `maxHeaderSize` 16 KB; HEAD first, GET only if HEAD returns 403/405/501; `res.body.destroy()` unread                                                                                                                                  | `makeFetchHop()`        | Large responses; page content is never downloaded or executed                       |
| 11  | Network kill switch `QRSHIELD_DISABLE_NETWORK=1`                                                                                                                                                                                      | all network modules     | Offline/test deployments, reported as "skipped"                                     |

### What "public" means

`isPublicAddress()` accepts only addresses whose `ipaddr.js` range is `unicast`. IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is unwrapped first, and well-known NAT64 addresses (`64:ff9b::/96`, returned by DNS64 on IPv6-only networks) are judged by their embedded IPv4. Rejected ranges include private (10/8, 172.16/12, 192.168/16), loopback, link-local (incl. **169.254.169.254** cloud metadata), CGNAT 100.64/10 (incl. Alibaba metadata 100.100.100.200), multicast, broadcast, reserved, documentation/benchmarking, IPv6 unique-local (incl. AWS `fd00:ec2::254`), link-local, **6to4 (2002::/16), Teredo and local-use NAT64 (64:ff9b:1::/48)** (which can embed private IPv4), and unspecified. All of these are unit-tested.

### Proof by test

`tests/unit/redirects.test.ts` starts a **real HTTP server on 127.0.0.1** and shows:

1. The IP-literal request is refused by the connector.
2. A hostname whose (injected) resolver returns 127.0.0.1 is refused through the real undici agent.
3. A control request with a normal `fetch` _can_ reach the server, so the refusals come from the guard and not from a broken server.

Further tests cover mixed-answer rebinding, a resolver that turns private on its second call, redirect chains to `169.254.169.254`, loops, and the 5-hop cap.

### What the user sees

Each hop shows the hostname, URL and status code. **Cross-domain** transitions are highlighted. Blocked or failed hops show the exact reason, e.g. `Not probed: 203.0.113.45 is not a public address` or `Domain does not resolve (DNS lookup failed)`. If probing could not run, the panel says so; it never invents a chain.

### Redirect-derived findings

These are `cross_domain_redirect`, `redirect_downgrade` (HTTPS → HTTP), and `long_redirect_chain` (≥ 3 redirects, truncation or a loop). The **final destination** then receives the full offline analysis too, with evidence prefixed "Final destination:" (`mergeFindings` in `report.ts`). Domain age and ML are computed on the final destination's host when it differs.

## Privacy and data handling

| Data                           | Where it goes                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Camera frames, uploaded images | Decoded in the browser. Never uploaded, never stored                                                                                                               |
| Decoded URL                    | Sent to QRShield's server for analysis. Sent to external threat-intel providers only if an operator enables them; the hostname may go to an LLM only if configured |
| Report                         | Returned to the browser; stored only in that browser's `localStorage` (≤ 200 entries)                                                                              |
| Embedded credentials           | Stripped before any network use; only the username appears as evidence; passwords are never shown                                                                  |
| Wi-Fi passwords in QR codes    | Displayed as "Included (hidden)"                                                                                                                                   |
| Secrets (API keys)             | Server-side environment variables only. `/api/status` reports only booleans, which an e2e test asserts                                                             |

There are no accounts, no cookies and no analytics. The server logs only failure messages.
