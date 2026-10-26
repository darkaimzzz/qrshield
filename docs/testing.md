# Testing

What the test suites cover and how to run them.

## Running the suites

```bash
npm test                                        # Vitest unit tests (~1 s)
npx playwright install chromium --only-shell    # once
npm run test:e2e                                # builds, serves on :3100 with QRSHIELD_DISABLE_NETWORK=1, runs Playwright
npm run lint && npm run typecheck               # static checks
```

- The e2e server runs with outbound network **disabled**, so results don't depend on third-party services. Network-dependent code is covered by unit tests with injected resolvers, fake hop functions and a real loopback HTTP server.
- To run the mobile layout checks against a deployment: `E2E_BASE_URL=https://qrshieldmdp.vercel.app npx playwright test tests/e2e/mobile.spec.ts --project=mobile`.
- **ML parity:** after retraining (`cd ml && uv run python train.py`), `tests/fixtures/ml-parity.json` is regenerated and `services.test.ts` confirms that the TypeScript inference matches Python.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit and e2e tests on every push and pull request.

## Coverage

**Unit tests (Vitest): 93 passing across 7 files.**

- `parse.test.ts`: scheme rejection (javascript/data/file/ftp/mailto/WIFI), control characters, oversize input, `localhost`, decimal/hex/octal IPs, IPv6, credential stripping, punycode, PSL edge cases.
- `structure.test.ts`: no findings on Wikipedia, GitHub, Google sign-in and PayPal sign-in; lone "login" not flagged; impersonation positives (subdomain, typo, affix, leet, homograph, `microsoftonline` look-alike); false-positive guards (`pineapple`, `apply`, `groups`); entropy; shorteners; executables; encoding.
- `score.test.ts`: zero baseline, sums, group damping, cap, TI floor, exact explainability, band boundaries.
- `redirects.test.ts`: 20 blocked and 5 allowed address classes, rebinding variants, chain following, relative Locations, metadata redirect blocked, loops, 5-hop cap, honest failure, and the real loopback-server proof.
- `services.test.ts`: RDAP parsing including malformed and future dates; provider status semantics; network kill switch; **ML parity on 206 hosts**; rate limiter.
- `report.test.ts`: stage event order, InputError, unavailable checks excluded from the score, final-destination analysis, critical case, explanation grounding.
- `qr-content.test.ts`: payload classification, Wi-Fi password not exposed, HTTP→HTTPS upgrade rule.

**End-to-end tests (Playwright): 23 passing.** They run against a production build with outbound network disabled, for determinism.

- Paste flow with real stage statuses; scheme rejection without navigation.
- **Upload of generated QR PNGs** (single, two codes in one image with a chooser, blank image, Wi-Fi, UPI).
- Camera fallback in headless Chromium (no camera).
- Copy to clipboard; PDF download beginning with `%PDF-`; inspect dialog; save toggle.
- API validation and status without secrets.
- History persistence across reload, search, filter, open, delete, clear-all confirm and autosave off.
- All five demo cases; generated-QR decode round trip; intelligence examples; methodology.
- **Zero horizontal overflow on six pages at mobile width**; mobile scan button.

**Other gates:** `eslint` clean, `tsc --noEmit` clean (strict), `next build` clean. Manual verification with live network covered real RDAP lookups (e.g. `rdap.nic.ly` for bit.ly), real redirects (bit.ly, github.com) and real blocklist loading (392,163 domains; a full cold-start analysis, including that download, finished in about 2.7 s).
