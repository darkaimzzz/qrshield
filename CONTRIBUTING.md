# Contributing to QRShield

Thanks for your interest. Bug reports, detection-rule improvements, documentation fixes and new threat-intel providers are all welcome.

## Ground rules

- **Never weaken the safety guarantees.** The app must never navigate to an analyzed URL, never execute decoded content, and never report an unrun check as passing. Redirect probing must stay SSRF-safe ([docs/security-design.md](docs/security-design.md)).
- **No fabricated data.** No hardcoded scores, fake threat matches or pretend ML output. Demo cases go through the real engine.
- **Every rule needs a test.** A new indicator needs at least one positive case and one false-positive guard in `tests/unit/structure.test.ts` (or the relevant test file).
- Security vulnerabilities go through [SECURITY.md](SECURITY.md), not public issues.

## Development setup

```bash
git clone https://github.com/darkaimzzz/qrshield.git
cd qrshield
npm install                                   # Node ≥ 20.9; also copies the wasm decoder
npm run dev                                   # http://localhost:3000
npx playwright install chromium --only-shell  # for e2e tests
```

Optional, to retrain the ML model: install [uv](https://docs.astral.sh/uv/), then run `cd ml && uv sync && uv run python train.py`.

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run format      # Prettier
```

CI runs the same checks on every pull request.

## Common changes

### Adding or tuning a detection rule

1. Add the indicator (title, weight, severity, category, optional correlation group) to `lib/engine/indicators.ts`. The methodology page and docs table read from it.
2. Emit the finding with real evidence from `lib/engine/lexical.ts`, `impersonation.ts` or `report.ts`.
3. Add a short phrase for it in `PHRASES` in `lib/engine/explain.ts`.
4. Add tests, including a realistic legitimate URL that must **not** trigger it.
5. Update the weight table in [docs/scoring.md](docs/scoring.md) and add a [CHANGELOG](CHANGELOG.md) entry.

Weight changes need a short rationale in the PR description. Remember that the score must stay equal to the sum of the listed contributions.

### Adding a brand to the impersonation reference list

Edit `BRANDS` in `lib/engine/impersonation.ts`. List **every** registrable domain the brand operates, so its own sites are never flagged. Avoid tokens that are common words (see the Visa and Meta notes in the file).

### Adding a threat-intelligence provider

Implement the `ThreatProvider` interface in `lib/engine/threat-intel.ts`. Requirements: verify the provider's current API documentation and terms, read keys only from server-side environment variables, return `not_checked` when unconfigured, throw on errors (they are reported as "Not checked (error)"), and document the variable in `.env.example` and [docs/deployment.md](docs/deployment.md).

### Changing ML features

Change `ml/features.py` **and** `lib/engine/ml-features.ts` identically, retrain, and commit the new `lib/engine/model.json`, `ml/metrics.json` and `tests/fixtures/ml-parity.json`. Update the numbers in `ml/DATASET.md`. The parity test fails if the two implementations diverge.

## Code style

- TypeScript strict mode, Prettier (no semicolons, 100 columns), ESLint with the Next.js config.
- Keep engine modules free of React and browser APIs. `lib/engine/structure.ts` and its dependencies must stay isomorphic, because the education page runs them in the browser.
- Prefer small, well-named functions and comments that explain _why_.

## Commit messages

Use the imperative mood with a short summary line, e.g. `Detect lure-word domain names`. Reference issues where relevant.

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
