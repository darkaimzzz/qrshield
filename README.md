# QRShield: Scan Smarter. Stay Safer.

**Live:** https://qrshieldmdp.vercel.app

QRShield turns a QR code, which normally hides its destination, into an explainable security report, **without opening the destination in your browser**.

Scan with the camera, upload an image or paste a URL. QRShield decodes the code on your device, then its server inspects the link. It checks URL structure, look-alike brands, HTTP redirects (SSRF-hardened), domain age via RDAP, and threat-intelligence lists. The result is a transparent 0–100 risk score with evidence for every point, plus a separate, genuinely trained ML phishing estimate.

## Features

- **Three inputs**: live camera scanning (ZXing, rear camera preferred, auto-stop, permission and no-camera handling), drag-and-drop image upload (ZXing C++ WebAssembly, decoded locally, choose between multiple codes) and URL paste with validation.
- **Non-URL QR codes** (UPI payments, Wi-Fi, phone, SMS, vCard, `javascript:` …) are shown as inert text with guidance and never executed.
- **Streaming analysis**: `/api/analyze` streams NDJSON stage events. A stage is marked done, failed, skipped or not configured only when its real operation reports that status.
- **Report**: risk gauge, executive summary, URL intelligence, redirect chain, RDAP domain data, every finding with evidence and score contribution, threat-intel sources (“Not checked” ≠ clean), ML panel, recommendations, checks and limitations.
- **Actions**: copy summary, save to history, text-based PDF export (jsPDF), print stylesheet, and an "inspect details" view with the raw report JSON.
- **History**: stored in the browser only. Search, filter by severity, sort, open, delete, clear with confirmation, and an autosave toggle.
- **Threat Intelligence page**: interactive URL anatomy, nine attack explainers that run the real engine on synthetic examples, and charts from your own local history.
- **Methodology page**: live weight table, real model metrics, limitations and privacy.
- **Demo Lab**: five synthetic cases plus a QR generator that can decode its own output end-to-end.

## Quick start

Requires Node ≥ 20.9 (developed on Node 26) and npm.

```bash
npm install          # also copies the ZXing wasm decoder into public/wasm
npm run dev          # http://localhost:3000
```

Camera scanning needs a secure context: `localhost` or HTTPS. On a phone, use the deployed HTTPS URL.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development, production build, production server |
| `npm test` | Vitest unit tests (engine, SSRF guard, RDAP, threat intel, scoring, ML parity, …) |
| `npm run test:e2e` | Playwright end-to-end tests on desktop and mobile (builds and serves with `QRSHIELD_DISABLE_NETWORK=1`) |
| `npm run lint` / `typecheck` / `format` | ESLint, `tsc --noEmit`, Prettier |

Playwright needs a browser once: `npx playwright install chromium --only-shell`.

### Configuration (all optional)

See `.env.example`. Without any variables QRShield runs the full rule engine, live redirect and RDAP checks, the keyless Phishing.Database blocklist and the ML model. Optional additions are Google Safe Browsing (`GSB_API_KEY`), URLhaus (`URLHAUS_AUTH_KEY`), the OpenPhish community feed (`OPENPHISH_ENABLED=1`, non-commercial terms) and an OpenAI-compatible LLM for rewording explanations (`LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`). Secrets are only read server-side.

## Architecture

```
Browser                                         Next.js server (Node runtime)
───────                                         ─────────────────────────────
Camera (@zxing/browser) ─┐                      POST /api/analyze  (zod-validated, rate-limited)
Upload (zxing-wasm)  ────┼─► classifyQrContent ─►  analyze()  ── streams NDJSON stage events
Paste URL ───────────────┘   (lib/qr-content)       │
                                                    ├─ parse.ts          WHATWG URL + tldts (PSL)
History (localStorage) ◄── Report JSON ◄────────────├─ structure.ts      lexical.ts + impersonation.ts
PDF (jsPDF), print                                  ├─ redirects.ts      undici + pinned safe DNS lookup
                                                    ├─ rdap.ts           IANA bootstrap → registry RDAP
                                                    ├─ threat-intel.ts   provider interface
                                                    ├─ score.ts          weighted evidence (indicators.ts)
                                                    ├─ ml.ts             logistic regression (model.json)
                                                    └─ explain.ts / llm.ts
```

The shared, strongly typed `Report` contract lives in `lib/engine/types.ts`. Every engine module is independently unit-tested and receives its network dependencies through injectable parameters.

### Security model of the redirect inspector

`lib/engine/redirects.ts` follows up to five HTTP redirects without loading pages in the user's browser:

- Every URL is re-parsed: http/https only, ports 80/443 only, no embedded credentials.
- IP-literal hosts are validated in the connector itself (Node skips DNS lookup for literals). WHATWG parsing normalizes `http://2130706433/`, hex and octal tricks first.
- DNS names resolve through `createSafeLookup`, which rejects the connection if **any** A/AAAA answer is not public unicast. That covers private, loopback, link-local/metadata, CGNAT, ULA, IPv4-mapped, 6to4, Teredo and NAT64 addresses. Because this lookup is the one `net`/`tls` use for the socket, the connection is pinned to the validated address (no DNS-rebinding window), and TLS still verifies the certificate against the hostname.
- No automatic redirects, HEAD first (GET only if refused), bodies destroyed unread, 3 s connect / 5 s per hop / 12 s total, 16 KB header limit.
- RDAP queries use the same guarded agent.

## Machine learning

`ml/` contains a reproducible uv project. It trains a logistic-regression model on hostname features from the **PhiUSIIL Phishing URL Dataset** (UCI, CC BY 4.0), using a split grouped by registrable domain. Held-out test results: precision 0.902, recall 0.768, F1 0.830, ROC-AUC 0.906. The model is exported to JSON and evaluated in TypeScript. A parity test checks the TypeScript features and probabilities against Python output to 1e-9. Full details, including the dataset bias and why only hostnames are used, are in [`ml/DATASET.md`](ml/DATASET.md).

```bash
cd ml && uv sync && uv run python train.py
```

## Demo guide (for judges)

1. Open **Demo Lab** and press **Analyze** on each case. All five run through the real engine; nothing is pre-scored.
   - *Conventional HTTPS* (wikipedia.org) shows live redirect, RDAP registration data and a blocklist check.
   - *IP-host* shows the SSRF guard: the redirect probe refuses the documentation-range IP and says why.
2. In the **QR generator**, pick a case and press **Decode & analyze this QR** to exercise the on-device WebAssembly decoder end-to-end. Or download the PNG and use **Upload QR Image**.
3. On a phone, open the deployed HTTPS URL, tap **Scan**, and point the camera at the generated code on your laptop screen.
4. Open a report's **Inspect details**, **Download PDF** and **Copy summary**, then check **Scan History** and **Threat Intelligence** (charts appear once you have scans).

The fictional URLs use the reserved `.example` TLD and the `203.0.113.0/24` documentation range. They are synthetic demonstrations, not real attacks.

## Limitations

QRShield does not render pages or run JavaScript, so in-page redirects and page content are not analyzed. Blocklists only contain already-reported threats. RDAP coverage varies by registry. Lexical rules can produce false positives on legitimate marketing links and false negatives on clean-looking or compromised domains. A low score means few warning signs were detected; **no automated tool can guarantee that a URL is safe.**

## Data and licenses

- PhiUSIIL Phishing URL Dataset: Prasad & Chandra (2024), CC BY 4.0.
- Phishing.Database: MIT License, https://github.com/Phishing-Database/Phishing.Database
- Public Suffix List via `tldts` (MPL-2.0 data).
- ZXing (`@zxing/browser`, Apache-2.0) and ZXing-C++ via `zxing-wasm` (MIT/Apache-2.0).
