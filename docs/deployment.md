# Deployment

QRShield is a standard Next.js 16 application. Static pages are prerendered; `/api/analyze` and `/api/status` run as Node.js functions. It needs **no database and no API keys**.

Production instance: **https://qrshieldmdp.vercel.app**

## Vercel (recommended)

```bash
npm i -g vercel        # or use npx vercel
vercel login
vercel link            # create or select a project
vercel deploy --prod
```

Notes:

- The `postinstall` script copies the ZXing WebAssembly decoder into `public/wasm/` during Vercel's install step. No manual asset handling is needed.
- `/api/analyze` sets `maxDuration = 60`. A typical analysis takes 1–3 s, with a worst case of about 30 s when every external lookup times out.
- `.vercelignore` keeps the Python virtualenv, the raw dataset and test artifacts out of uploads.
- **Automatic deploys on push:** connect the GitHub repository in the Vercel dashboard (_Project → Settings → Git_). Your Vercel account needs a GitHub login connection (_Account Settings → Authentication_). After that, every push to `main` deploys to production and pull requests get preview URLs.

### Deployment protection

Production domains are public. Preview deployments may be behind Vercel Authentication, depending on your team settings.

## Any Node.js host

```bash
npm ci
npm run build
npm start              # serves on PORT (default 3000)
```

Requirements: Node.js ≥ 20.9 (CI uses 24). Outbound HTTPS access is needed for redirect probing, RDAP and threat feeds. Without it, set `QRSHIELD_DISABLE_NETWORK=1` and those checks report themselves as skipped.

**Camera scanning requires HTTPS** (or `localhost`). Put the app behind TLS when phones will use it.

## Configuration

All variables are optional and read only on the server. See [`.env.example`](../.env.example).

| Variable                                   | Effect                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `QRSHIELD_DISABLE_NETWORK=1`               | Disables redirect probing, RDAP, threat intel and the LLM. Used by the e2e tests             |
| `GSB_API_KEY`                              | Enables Google Safe Browsing v4 Lookup                                                       |
| `URLHAUS_AUTH_KEY`                         | Enables abuse.ch URLhaus (free key from https://auth.abuse.ch/)                              |
| `OPENPHISH_ENABLED=1`                      | Enables the OpenPhish community feed. Its terms allow only non-commercial research use       |
| `PHISHING_DATABASE_DISABLED=1`             | Disables the default Phishing.Database blocklist                                             |
| `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | Optional LLM rewording of explanations through any OpenAI-compatible `/chat/completions` API |

On Vercel: `vercel env add GSB_API_KEY production`, then redeploy.

## Operational characteristics

| Concern         | Current behavior                                                                                     | When to change it                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Blocklist cache | Downloaded per function instance, cached 6 h (~392k domains, a few seconds to fetch on a cold start) | If cold starts matter, pre-warm on a schedule or move the list to a shared KV store |
| RDAP cache      | In memory per instance, 1 h for results and 24 h for the bootstrap file                              | Fine for most traffic                                                               |
| Rate limit      | In-memory token bucket per instance: 20 requests per minute per IP                                   | Use a shared store (e.g. Upstash Redis) under real abuse                            |
| History         | Browser `localStorage` only                                                                          | Implement `HistoryStore` against a database to add accounts                         |

## Post-deploy smoke test

```bash
BASE=https://your-deployment.example
curl -s $BASE/api/status
curl -sN -X POST $BASE/api/analyze -H 'content-type: application/json' \
  -d '{"input":"https://www.wikipedia.org/","source":"url"}' | tail -1
# The SSRF guard must refuse internal targets:
curl -sN -X POST $BASE/api/analyze -H 'content-type: application/json' \
  -d '{"input":"http://169.254.169.254/latest/meta-data/","source":"url"}' | tail -1
```

To run the Playwright suite against a deployment: `E2E_BASE_URL=$BASE npx playwright test tests/e2e/mobile.spec.ts --project=mobile`. The other e2e specs assume network checks are disabled.
