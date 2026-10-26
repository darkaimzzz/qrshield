# Risk scoring

The weighted evidence model behind the 0–100 score.

## The risk-scoring engine (`lib/engine/indicators.ts`, `score.ts`)

### The weight table

Every finding is an explicit evidence object: `{ id, category, severity, title, explanation, evidence[], weight, contribution, group }`.

| Indicator                                 | Weight | Severity | Group               |
| ----------------------------------------- | -----: | -------- | ------------------- |
| Known malicious URL match                 |     70 | critical | threat_intel        |
| Domain listed on a phishing blocklist     |     40 | high     | threat_intel        |
| Domain registered within 30 days          |     25 | high     | domain_age          |
| IP address instead of a domain name       |     24 | high     | –                   |
| Possible brand impersonation              |     20 | high     | impersonation       |
| Embedded credentials / misleading "@"     |     18 | high     | deceptive_structure |
| Look-alike / internationalized characters |     15 | high     | impersonation       |
| Domain registered within 180 days         |     12 | medium   | domain_age          |
| Account-verification or urgency language  |     12 | medium   | –                   |
| Known URL shortener                       |     12 | medium   | redirect            |
| Redirects to a different domain           |     12 | medium   | redirect            |
| Misleading hostname structure             |     10 | medium   | deceptive_structure |
| Domain name built from lure words         |     10 | medium   | deceptive_structure |
| No HTTPS                                  |     10 | medium   | –                   |
| Direct link to an executable              |     10 | medium   | –                   |
| Excessive subdomains                      |      8 | low      | deceptive_structure |
| Unusual encoding / invisible characters   |      8 | medium   | –                   |
| Redirect downgrades HTTPS → HTTP          |      8 | medium   | redirect            |
| Abnormally long URL                       |      7 | low      | –                   |
| Non-standard port                         |      6 | low      | –                   |
| Long redirect chain                       |      6 | low      | redirect            |
| Another URL embedded in the query         |      6 | low      | redirect            |
| Heavily hyphenated hostname               |      5 | low      | deceptive_structure |
| Random-looking hostname                   |      5 | low      | –                   |
| Frequently abused TLD                     |      5 | low      | –                   |

The suggested starting weights from the brief are kept as given (IP +24, impersonation +20, punycode +15, credentials +18, keywords +12, shortener +12, no HTTPS +10, subdomains +8, long +7, encoding +8, cross-domain +12, <30 d +25, <180 d +12, verified TI +70). The additions are documented and justified in code comments. The methodology page renders this table **from the live code**, so it cannot drift.

### The algorithm

```
sort findings by weight (desc)
for each finding:
    if its group was already seen:  contribution = weight × 0.5   (GROUP_DAMPING)
    else:                           contribution = weight
score = min(100, round(Σ contributions))
if a URL-level threat-intel match exists: score = max(score, 75)   (THREAT_MATCH_FLOOR)
band  = 0–24 Low Detected Risk · 25–49 Moderate · 50–74 High · 75–100 Critical
```

Design properties:

- **No double counting.** Correlated indicators (e.g. homograph + brand impersonation describe one deception) are damped.
- **Capped and normalized** to 0–100.
- **Missing evidence is not scored.** RDAP failing adds nothing and subtracts nothing. It appears in `checks[]` and `limitations[]` instead. A unit test asserts that a URL with every check unavailable scores 0, _and_ that the summary says "partial evidence".
- **Explainable by construction.** The test "explains the score exactly by finding contributions" asserts score = round(Σ contributions).
- **HTTP upgraded to HTTPS.** If an `http://` link is immediately redirected to `https://` on the _same_ registrable domain, `no_https` is dropped. A limitation notes that the first request was still unencrypted.

### Real results (live engine, 26 Oct 2026, network enabled)

| Input                                                               | Score / band    | Findings (contribution)                                                                                                                             | Notes                                                                                                                                            |
| ------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://www.wikipedia.org/`                                        | **0 Low**       | none                                                                                                                                                | No redirect (200); RDAP age 9,417 days; not on blocklist; ML 8.7 %                                                                               |
| `http://github.com`                                                 | **0 Low**       | none                                                                                                                                                | 301 → `https://github.com/` on the same site, so the no-HTTPS finding is dropped and a limitation notes the unencrypted first request; ML 27.5 % |
| `http://secure-account-verify.example/login/update?session=expired` | **32 Moderate** | keywords +12, no HTTPS +10, lure-word domain +10                                                                                                    | `.example` does not resolve; RDAP skipped                                                                                                        |
| `https://paypal.com.account-security.example/signin/verify`         | **42 Moderate** | impersonation +20, keywords +12, misleading structure +10                                                                                           |                                                                                                                                                  |
| `http://203.0.113.45/bank/login.php`                                | **46 Moderate** | IP host +24, keywords +12, no HTTPS +10                                                                                                             | Redirect probe refused: documentation IP is not public                                                                                           |
| `https://bit.ly/x`                                                  | **32 Moderate** | shortener +12, cross-domain +6 (damped), no HTTPS +10 (final destination), downgrade +4 (damped)                                                    | Real 301 to an HTTP page                                                                                                                         |
| `https://login.microsoftonline.com.auth-session-%76erify.example/…` | **67 High**     | impersonation +20, keywords +12, misleading structure +10, unusual encoding +8, long URL +7, embedded redirect +6, excessive subdomains +4 (damped) |                                                                                                                                                  |

**Worked arithmetic** for `bit.ly/x`: the redirect group has shortener 12 (full), cross-domain 12 → 6, downgrade 8 → 4; `no_https` (from the final destination) adds 10. 12 + 6 + 4 + 10 = **32**.

### Why these are heuristics, not probabilities

The weights encode engineering judgment about how strongly each signal indicates risk, given false-positive costs. They have **not** been fitted to data, and the UI and methodology page say so. That is precisely why a separately trained, measured ML model exists alongside them.
