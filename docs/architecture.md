# Architecture

How QRShield is put together: components, data flow and the lifecycle of a scan.

## Architecture and data flow

```
 ┌────────────────────────── BROWSER (client) ──────────────────────────┐
 │                                                                       │
 │  Camera tab ── @zxing/browser (getUserMedia, rear camera) ─┐          │
 │  Upload tab ── zxing-wasm (ZXing C++ → WebAssembly, local) ─┼─► text  │
 │  Paste tab  ── parseUrl() client-side validation ───────────┘    │    │
 │                                                                   ▼    │
 │                                   classifyQrContent(text)  (lib/qr-content.ts)
 │                       ┌───────────────────┴────────────────────┐       │
 │                 kind = "url"                       UPI / Wi-Fi / tel / text / javascript: …
 │                       │                                  shown as inert text, never executed
 │                       ▼                                                │
 │      router.push("/analyze?u=<url>&src=<camera|upload|url|demo>")       │
 │                       │                                                │
 │      streamAnalysis() ─── POST /api/analyze ───────────────┐           │
 │         reads NDJSON events, updates stage list live       │           │
 │                       ▲                                    │           │
 │      ReportView ◄── {type:"report"} ── historyStore (localStorage)      │
 │      PDF (jsPDF) · print CSS · copy summary · inspect JSON │           │
 └────────────────────────────────────────────────────────────┼───────────┘
                                                              │ only the URL string
 ┌──────────────────────── SERVER (Next.js route, Node) ──────▼──────────┐
 │ route.ts: rate limit → size limit → zod schema → ReadableStream        │
 │   analyze()  (lib/engine/report.ts)                                    │
 │     1 structure   parseUrl → analyzeStructure (lexical + impersonation)│
 │     2 redirects   inspectRedirects (undici + pinned safe DNS lookup) ──┼──► target site (HEAD/GET headers only)
 │     3 domain      lookupDomain (IANA bootstrap → registry RDAP) ───────┼──► rdap.* servers
 │     4 threat_intel checkThreatIntel (providers in parallel) ───────────┼──► Phishing.Database / GSB / URLhaus / OpenPhish
 │     5 scoring     scoreFindings + classify (ML)                        │
 │     6 report      templateExplanation → optional llmExplanation ───────┼──► OpenAI-compatible API (only if configured)
 │   each stage emits {type:"stage", stage, status} as it really happens  │
 └────────────────────────────────────────────────────────────────────────┘
```

**Technology stack (versions verified at build time):** Next.js 16.4 (App Router, Turbopack, Cache Components), React 19.3, TypeScript (strict), Tailwind CSS 4.3, shadcn/ui (Radix), Lucide icons, Motion 14, Recharts 3, @zxing/browser 0.2, zxing-wasm 3.1, qrcode 1.5, tldts 7, undici 8, ipaddr.js 2.5, zod 4, jsPDF 4, Vitest 5, Playwright 1.64, Python 3.14 + scikit-learn 1.9.1 (training only).

## Repository map

| Path                                                 | Responsibility                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `app/page.tsx`                                       | Dashboard: hero, scanner, recent scans, education                         |
| `app/analyze/analyze-client.tsx`                     | Streams an analysis or opens a saved report (`?id=`)                      |
| `app/history/history-client.tsx`                     | Search, filter, sort, delete, clear, autosave toggle                      |
| `app/intelligence/page.tsx`                          | URL anatomy, attack library, local analytics charts                       |
| `app/demo/demo-client.tsx`                           | 5 synthetic cases, QR generator, decode-your-own-QR                       |
| `app/methodology/page.tsx`                           | Live weight table, model metrics, limitations                             |
| `app/api/analyze/route.ts`                           | Streaming NDJSON analysis endpoint                                        |
| `app/api/status/route.ts`                            | Which optional capabilities are enabled (no secrets)                      |
| `lib/engine/types.ts`                                | Shared `Report` contract + zod request schema                             |
| `lib/engine/parse.ts`                                | Input validation and normalization                                        |
| `lib/engine/lexical.ts`                              | Lexical features and structural findings                                  |
| `lib/engine/impersonation.ts`                        | Brand list, skeletons, edit distance, impersonation findings              |
| `lib/engine/structure.ts`                            | Isomorphic offline analysis (used by server and education page)           |
| `lib/engine/redirects.ts`                            | SSRF-hardened redirect inspector                                          |
| `lib/engine/rdap.ts`                                 | RDAP domain registration lookup                                           |
| `lib/engine/threat-intel.ts`                         | Provider interface and four providers                                     |
| `lib/engine/indicators.ts`                           | **The weight table**: every indicator's weight, severity, category, group |
| `lib/engine/score.ts`                                | Scoring algorithm and bands                                               |
| `lib/engine/ml-features.ts` / `ml.ts` / `model.json` | ML features, inference, exported model                                    |
| `lib/engine/explain.ts` / `llm.ts`                   | Deterministic explanation, optional LLM rewrite                           |
| `lib/engine/report.ts`                               | The pipeline orchestrator (`analyze()`)                                   |
| `lib/decode.ts`                                      | Client-side WASM image decoding                                           |
| `lib/qr-content.ts`                                  | Non-URL payload classification (UPI, Wi-Fi, …)                            |
| `lib/history.ts`                                     | `HistoryStore` interface + localStorage implementation                    |
| `lib/pdf.ts`                                         | PDF report and copyable text summary                                      |
| `ml/train.py`, `ml/features.py`                      | Reproducible training pipeline                                            |
| `ml/DATASET.md`, `ml/metrics.json`                   | Dataset card and measured metrics                                         |
| `tests/unit/*.test.ts`                               | 93 Vitest tests                                                           |
| `tests/e2e/*.spec.ts`                                | 23 Playwright tests (desktop + mobile)                                    |

## A scan, end to end

The walkthrough below follows a user scanning a sticker on a parking meter.

1. **Camera permission is requested only on click.** `CameraScan.start()` (`components/scanner/camera-scan.tsx`) first checks `window.isSecureContext` (camera APIs only exist on HTTPS or localhost) and `navigator.mediaDevices`. It then dynamically imports `@zxing/browser` and calls `decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } })`, which prefers the rear camera.
2. **Exactly one detection.** The decode callback checks a `handledRef` flag, calls `controls.stop()` immediately, and ignores late duplicate callbacks. The camera is released on unmount. Radix tabs unmount inactive panels, so switching tabs also releases the camera.
3. **Classification.** `classifyQrContent()` decides whether the text is a web URL. `upi://`, `WIFI:`, `tel:`, `sms:`, `mailto:`, `geo:`, vCard/MECARD and blocked schemes (`javascript:`, `data:`, `intent:` …) are displayed as inert text with guidance. Nothing is opened, dialed or executed.
4. **Navigation stays inside QRShield.** The app routes to `/analyze?u=<url>&src=camera`. The decoded destination is never rendered as a link; the e2e tests assert that the browser host never changes.
5. **Streaming analysis.** `streamAnalysis()` POSTs `{input, source}` and reads the response body line by line. Each line is an event such as `{"type":"stage","stage":"redirects","status":"done","detail":"1 redirect followed."}`. The UI marks a stage complete only when such an event arrives. **There are no timers.**
6. **Report and history.** The final event carries the full `Report`. If autosave is on (the default), it goes to `localStorage`. The report page renders from that object.

Real stream for `https://bit.ly/3xyzQRS` (abridged):

```
{"type":"stage","stage":"structure","status":"running"}
{"type":"stage","stage":"structure","status":"done","detail":"1 structural indicator(s)"}
{"type":"stage","stage":"redirects","status":"running"}
{"type":"stage","stage":"redirects","status":"done","detail":"No HTTP redirect (status 404)."}
{"type":"stage","stage":"domain","status":"running"}
{"type":"stage","stage":"threat_intel","status":"running"}
{"type":"stage","stage":"domain","status":"done","detail":"Registration data retrieved from the registry's RDAP service."}
{"type":"stage","stage":"threat_intel","status":"done","detail":"1 of 4 sources checked"}
{"type":"stage","stage":"scoring","status":"running"} … {"type":"report","report":{…}}
```

The **QR decoding** stage is set by the client: _done_ for camera, upload or generated-QR decodes, and _skipped ("Not applicable: URL entered directly")_ for pasted URLs. Decoding genuinely happens before the request.
