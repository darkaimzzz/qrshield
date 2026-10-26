# Detection engine

Every analysis stage in `lib/engine/`: what it checks, the exact rules, and why.

## Input validation and URL parsing (`lib/engine/parse.ts`)

`parseUrl()` runs identically in the browser (instant form validation) and on the server (the authoritative check).

| Rule                                                        | Behavior                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whitespace                                                  | Trimmed                                                                                                                                                                                                                                 |
| Empty / > 2,048 chars                                       | Rejected (`MAX_INPUT_LENGTH`)                                                                                                                                                                                                           |
| C0/C1 control characters (`\u0000–\u001F`, `\u007F–\u009F`) | Rejected                                                                                                                                                                                                                                |
| Scheme                                                      | Only `http`/`https`. `javascript:`, `data:`, `file:`, `ftp:`, `mailto:`, `wifi:` … are rejected with a named reason                                                                                                                     |
| No scheme (`example.com/login`)                             | `https://` is prepended and `assumedProtocol=true` is recorded. The UI shows the assumption and the report lists it as a limitation                                                                                                     |
| `host:port` without scheme (`example.com:8080/x`)           | Recognized as host:port, not as a scheme named "example.com"                                                                                                                                                                            |
| Parsing                                                     | WHATWG `URL`, the same parser browsers use                                                                                                                                                                                              |
| Hostname                                                    | Must be an IP literal or a DNS name with ≥ 2 labels, LDH characters, labels ≤ 63, total ≤ 253, non-numeric TLD. `localhost` and `intranet` are rejected                                                                                 |
| IP encoding tricks                                          | WHATWG normalizes `http://2130706433/`, `http://0x7f.1/` and `http://0177.0.0.1/` to `127.0.0.1` _before_ any check                                                                                                                     |
| Embedded credentials (`https://paypal.com@evil.example`)    | Recorded as evidence (`credentialUser`) and **stripped** from the normalized URL, so they are never forwarded                                                                                                                           |
| Domain split                                                | `tldts` with the full **Public Suffix List** (`allowPrivateDomains: true`), so `shop.example.co.uk` → registrable `example.co.uk`, and `victim.github.io` is its own registrable unit. The code never naïvely takes the last two labels |
| IDN                                                         | `hostnameUnicode` is decoded with `punycode.js` for display and homograph checks                                                                                                                                                        |

## Lexical analysis (`lib/engine/lexical.ts`)

`extractLexical()` computes these features: URL, hostname, path and query lengths, subdomain count, path depth, special-character ratio, digit-to-letter ratio, hostname hyphens and digits, repeated separators (`//`, `..`, `--`, `__`), percent-encoded count, double encoding (`%25xx`), Shannon entropy of the hostname and of the path, `@` usage, punycode labels, non-ASCII hostnames, mixed-script labels (Latin + Cyrillic/Greek/Armenian/Cherokee), invisible/bidi characters, lure keywords, URLs embedded in the query, executable file extensions and abused TLDs.

`lexicalFindings()` turns features into findings:

| Finding                   | Trigger                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ip_host`                 | Hostname is an IPv4/IPv6 literal                                                                                                              |
| `credentials_in_url`      | `user@host` syntax present                                                                                                                    |
| `no_https`                | `http:` scheme (removed if the same site immediately upgrades to HTTPS; see [Risk scoring](scoring.md))                                       |
| `nonstandard_port`        | Port other than 80/443                                                                                                                        |
| `excessive_subdomains`    | ≥ 3 subdomain levels                                                                                                                          |
| `domain_in_subdomain`     | A full domain (`paypal.com`) sitting inside the subdomain, or as a path segment                                                               |
| `lure_domain_name`        | The registrable name is made of ≥ 2 lure words (`secure-account-verify`)                                                                      |
| `hyphenated_host`         | ≥ 3 hyphens in the hostname                                                                                                                   |
| `long_url`                | > 100 characters                                                                                                                              |
| `unusual_encoding`        | Invisible/bidi chars, double encoding, ≥ 8 percent-escapes, percent-encoding inside the hostname, or an IPv4 written in non-standard notation |
| `embedded_redirect_param` | Query contains `http(s)://` / `%3A%2F%2F` / `www.` after `=`, `&` or `?`                                                                      |
| `executable_download`     | Last path segment ends in `.apk .exe .msi .scr .bat .cmd .vbs .jar .ps1 .dmg .pkg .iso .hta .lnk .xapk .appx .msix`                           |
| `random_hostname`         | Registrable label ≥ 10 chars, entropy ≥ 3.3 bits/char, and a run of ≥ 5 consonants                                                            |
| `unusual_tld`             | TLD on a curated list of frequently abused TLDs (`zip`, `mov`, `top`, `xyz`, `tk`, …)                                                         |
| `suspicious_keywords`     | See below                                                                                                                                     |

**Keywords are corroborating evidence, never proof.** The keyword finding fires only if:

- there are **≥ 2 distinct** lure words, **or** at least one _other_ structural or impersonation signal exists; **and**
- the domain is **not** a reference brand's own domain.

So `https://forum.example.org/login` and `https://accounts.google.com/signin/v2/identifier` produce **no findings** (both are unit-tested). Keywords are searched in the subdomain, path and query, not in the registrable name itself. That avoids flagging companies like "SecureWorks" for their own name. The registrable name is covered separately by `lure_domain_name` when it is _only_ lure words.

## Brand-impersonation detection (`lib/engine/impersonation.ts`)

**Reference set.** 43 frequently impersonated brands are listed, each with name tokens and the **registrable domains the brand actually operates**. They include global brands (PayPal, Apple, Microsoft, Google, Amazon, Netflix, Meta, banks, couriers, crypto exchanges) and Indian banks and payments (SBI, HDFC, ICICI, Axis, Paytm, PhonePe, BHIM/NPCI, India Post). The selection is drawn from brands that recur in public phishing reports (APWG, OpenPhish, Check Point brand-phishing reports). If the registrable domain is on a brand's own list, impersonation checks are skipped (`isBrandOwned`).

**Five detection strategies,** applied in order (first match wins):

1. **Brand in the subdomain of an unrelated domain**: `paypal.com.account-security.example`. Matching is by whole token, so `groups.example` never matches `ups`.
2. **Brand + lure word in the registrable name**: `paypal-verify.example`, `applesupport.example`. Concatenations only count if the remainder is a known lure affix (`support`, `secure`, `login`, `id`, `wallet` …), which is why `pineapple.example` is _not_ flagged.
3. **Homoglyph / leet skeleton**: the label is folded through a confusables map (Cyrillic а, е, о, р, с …; Greek ο, α …; `0→o`, `1→l`, `3→e`, `5→s`, `@→a`, `rn→m`, `vv→w`, `cl→d`) after NFKC normalization. If the result equals a brand while the original does not, it is a look-alike. `xn--pypal-4ve.com` (Cyrillic "а") → `paypal`.
4. **Typosquatting**: Damerau-Levenshtein (optimal string alignment) distance 1 for brand tokens of 6–8 characters, ≤ 2 for ≥ 9 characters. Tokens under 6 characters are excluded, because too many ordinary words sit one edit away (`apple` → `apply`, `adobe` → `adore`). Examples: `paypa1`, `payapl`, `gooogle`.
5. **Brand name on a foreign suffix**: `paypal.co` when PayPal uses `paypal.com`.

Separately, the **`homograph`** finding fires for punycode or non-ASCII hostnames (medium wording: _many legitimate sites use IDNs_). It escalates to strong wording when a single label **mixes scripts**, such as Latin plus Cyrillic in one word.

**Wording is deliberately "possible impersonation".** The explanation states that brands may use partner or regional domains missing from the reference list. "Visa" is listed for ownership only, with no tokens, because `visa.vfsglobal.com` is a legitimate visa-services site. This is a documented false-positive mitigation.

## Domain age via RDAP (`lib/engine/rdap.ts`)

**RDAP** (RFC 9082/9083) is the IETF's structured JSON successor to WHOIS. The process is:

1. Fetch the **IANA bootstrap registry** (`https://data.iana.org/rdap/dns.json`, RFC 9224) and cache it for 24 h. It maps each TLD to its registry's RDAP base URL.
2. Compute the **ICANN** registrable domain (private suffixes excluded, so `foo.github.io` is looked up as `github.io`).
3. `GET {base}domain/{domain}` with `Accept: application/rdap+json`, an 8 s timeout and a 512 KB body cap. It goes through the **same SSRF-safe agent**, because registries may redirect to registrar RDAP servers.
4. `parseRdap()` extracts `registration`, `expiration` and `last changed` events and the registrar's vCard `fn`.
5. Age in days = now − registration. Unparseable or future dates become `null`.

| Situation                                    | Status shown                                                         |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Registry publishes no RDAP (e.g. `.example`) | _Skipped_: "The .example registry does not publish an RDAP service…" |
| 404                                          | _Done_: "The registry has no record of this domain"                  |
| No registration date in the response         | _Done_, age "Unavailable", plus a limitation note                    |
| Timeout / error                              | _Failed_ (not cached, so a retry can succeed)                        |

**Findings:** `domain_new_30` (+25) for < 30 days and `domain_new_180` (+12) for < 180 days. These share a correlation group, so only one counts in full. The wording says this is a _risk signal, not proof_. Real example: `bit.ly` → registered 2008-05-17 via `rdap.nic.ly`, age 6,735 days.

## Threat intelligence (`lib/engine/threat-intel.ts`)

There is one `ThreatProvider` interface with four implementations, queried in parallel:

| Provider                                              | Key?                      | Default                            | Level     | Notes                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------- | ---------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phishing.Database** (`phishing-domains-ACTIVE.txt`) | No                        | **On**                             | Domain    | MIT-licensed community list (~392,000 active phishing domains at test time). Downloaded server-side, cached 6 h, warmed at the start of each analysis |
| **OpenPhish community feed**                          | No                        | Off (opt-in `OPENPHISH_ENABLED=1`) | Exact URL | Its terms restrict use to non-commercial research and prohibit commercial "detection" use, so it is not enabled by default                            |
| **Google Safe Browsing v4 Lookup**                    | `GSB_API_KEY`             | Off                                | URL       | `threatMatches:find` with MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION                                             |
| **abuse.ch URLhaus**                                  | `URLHAUS_AUTH_KEY` (free) | Off                                | URL       | `POST /v1/url/`; `query_status` `ok` = listed, `no_results` = not listed                                                                              |

**Status semantics** (the core honesty rule):

- `match`: the source lists it.
- `no_match`: the source was queried and does not list it _today_. This is shown as "Not listed", with the caveat that lists cannot prove safety.
- `not_checked`: the source is not configured, or the network is disabled.
- `error`: the query failed. Shown as **"Not checked (error)"**, never as clean.

A URL-level match yields `threat_intel_match` (+70, and the **score floor of 75 = Critical**). A domain-level listing yields `threat_intel_domain` (+40). It is weaker because community domain lists can include compromised or shared hosts. Both are in the `threat_intel` group.

URLs checked are the normalized URL plus every redirect hop. Privacy: URLs are sent to external providers only when an operator enables them; the methodology page states this.

## Explanations: templates and the optional LLM

**Default (always on), `explain.ts`.** The summary has three parts:

1. A band-specific lead sentence. The Low band explicitly says "not a guarantee".
2. "Notable findings include …", naming the top three findings by contribution, each mapped to a fixed noun phrase.
3. The redirect destination, plus a "partial evidence" sentence listing incomplete checks.

Recommendations are band-specific and then contextual. For High or Critical: _"Do not enter passwords, one-time codes, card numbers or UPI PINs"_, plus the sticker-overlay advice. Further items depend on the findings: impersonation, shortener, executable, no HTTPS, new domain. **Every sentence maps to a finding.** A test asserts that an IP-only URL's summary mentions IP and HTTPS and nothing about brands, redirects or registration.

**Optional LLM, `llm.ts`.** Enabled only with `LLM_API_KEY` and `LLM_MODEL`; works with any OpenAI-compatible `/chat/completions` endpoint. Guardrails:

- **Minimal input:** only band, score, hostname(s), finding titles, severities, up to three evidence strings each, and the names of incomplete checks. No page content and no user data.
- **Untrusted data stays data:** the payload is JSON in a `data` field, and the system prompt says to ignore any instructions inside it. This addresses prompt injection via crafted URLs.
- **Rules in the prompt:** no new facts, no claim of visiting the site, no new score, never "safe" or "guaranteed".
- **Bounded output:** `max_tokens: 400`, temperature 0.2, JSON mode, zod schema (summary 20–700 chars, 1–5 recommendations ≤ 220 chars).
- **Post-filter:** output containing "visited", "I opened", "is safe" or "guaranteed" is rejected.
- **Any failure** (timeout, HTTP error, bad JSON, schema miss) falls back to the template.
- The badge reads **"AI-generated wording (model)"** only when the LLM text was actually used; otherwise it reads "Generated from findings".
