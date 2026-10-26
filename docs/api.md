# HTTP API

QRShield exposes two route handlers. Both are used by the web app and can be called directly. The shared TypeScript types live in [`lib/engine/types.ts`](../lib/engine/types.ts).

## `POST /api/analyze`

Analyzes one URL and **streams progress** as newline-delimited JSON (`application/x-ndjson`).

### Request

```json
{ "input": "https://example.com/login", "source": "url" }
```

| Field    | Type                                      | Notes                                                                                                                   |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `input`  | string, 1–4096 chars                      | The decoded QR text or pasted URL. Validated again by `parseUrl` (http/https only, ≤ 2048 chars, no control characters) |
| `source` | `"camera" \| "upload" \| "url" \| "demo"` | Optional, default `"url"`. Recorded in the report                                                                       |

### Responses

| Status | Body                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| `200`  | NDJSON event stream (below)                                                  |
| `400`  | `{ "error": "…" }`: invalid JSON or schema                                   |
| `413`  | `{ "error": "Request too large." }`: body over 16 KB                         |
| `429`  | `{ "error": "Too many requests…" }`: rate limit (20/min per IP per instance) |

Invalid URLs (for example `javascript:alert(1)`) return `200` with a single `{"type":"error"}` event after the `structure` stage fails, so streaming clients handle every outcome the same way.

### Events

```ts
type AnalyzeEvent =
  | {
      type: "stage"
      stage: StageId
      status: "running" | "done" | "failed" | "skipped" | "not_configured"
      detail?: string
    }
  | { type: "report"; report: Report }
  | { type: "error"; message: string }

type StageId =
  "decode" | "structure" | "domain" | "redirects" | "threat_intel" | "scoring" | "report"
```

The server emits each `stage` event when the corresponding operation actually starts or finishes. `decode` is client-side and never emitted by the server. The last event is always `report` or `error`.

Example (abridged):

```
{"type":"stage","stage":"structure","status":"running"}
{"type":"stage","stage":"structure","status":"done","detail":"1 structural indicator(s)"}
{"type":"stage","stage":"redirects","status":"running"}
{"type":"stage","stage":"redirects","status":"done","detail":"1 redirect followed."}
{"type":"stage","stage":"domain","status":"running"}
{"type":"stage","stage":"threat_intel","status":"running"}
{"type":"stage","stage":"domain","status":"done","detail":"Registration data retrieved from the registry's RDAP service."}
{"type":"stage","stage":"threat_intel","status":"done","detail":"1 of 4 sources checked"}
{"type":"stage","stage":"scoring","status":"running"}
{"type":"stage","stage":"scoring","status":"done","detail":"Score 32/100"}
{"type":"stage","stage":"report","status":"running"}
{"type":"stage","stage":"report","status":"done"}
{"type":"report","report":{ … }}
```

### The `Report` object

| Field                                           | Description                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`, `id`, `createdAt`, `source`, `input` | Metadata. `id` is a UUID                                                                                                                                                           |
| `parsed`                                        | Normalized URL parts: hostname (ASCII and Unicode), subdomain, registrable domain, public suffix, port, IP flags, whether credentials were present, whether `https://` was assumed |
| `lexical`                                       | All lexical features (lengths, entropy, encodings, keywords, …)                                                                                                                    |
| `redirects`                                     | `{ status, hops[{url, hostname, status, crossDomain, error?}], finalUrl, loop, truncated, detail }`                                                                                |
| `domain`                                        | RDAP result: `{ status, domain, registrationDate, expirationDate, lastChangedDate, registrar, ageDays, source, detail }`                                                           |
| `threatIntel`                                   | `{ status, providers[{id, name, status: match \| no_match \| not_checked \| error, detail}] }`                                                                                     |
| `findings`                                      | `Finding[]` sorted by weight: `{ id, category, severity, title, explanation, evidence[], weight, contribution, group? }`                                                           |
| `score`, `band`                                 | 0–100 and `low \| moderate \| high \| critical`                                                                                                                                    |
| `checks`                                        | Status of each stage, so missing evidence is explicit                                                                                                                              |
| `ml`                                            | `{ status, probability (0–1, uncalibrated), modelName, detail, topFactors[] }`                                                                                                     |
| `explanation`                                   | `{ summary, recommendations[], generatedBy: template \| llm, model }`                                                                                                              |
| `limitations`                                   | Human-readable caveats for this specific report                                                                                                                                    |

### Reading the stream (browser or Node 18+)

```ts
const res = await fetch("/api/analyze", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ input: url, source: "url" }),
})
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
let buf = ""
for (;;) {
  const { value, done } = await reader.read()
  buf += value ?? ""
  let i
  while ((i = buf.indexOf("\n")) >= 0) {
    const event = JSON.parse(buf.slice(0, i))
    buf = buf.slice(i + 1)
    console.log(event)
  }
  if (done) break
}
```

## `GET /api/status`

Reports which optional capabilities are enabled. It never returns secrets.

```json
{
  "network": true,
  "ml": { "name": "QRShield hostname logistic regression", "version": "2026-10-26" },
  "llm": false,
  "providers": [
    {
      "id": "phishing_database",
      "name": "Phishing.Database (active phishing domains)",
      "enabled": true,
      "reason": null
    },
    {
      "id": "google_safe_browsing",
      "name": "Google Safe Browsing",
      "enabled": false,
      "reason": "Not configured (GSB_API_KEY)"
    }
  ]
}
```
