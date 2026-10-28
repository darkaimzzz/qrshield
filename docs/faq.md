# FAQ, limitations and glossary

Answers to the questions reviewers ask most, plus known limitations.

## Limitations and honest caveats

1. **No page rendering.** JavaScript redirects, meta-refresh, cloaking and the actual phishing page are invisible. This is deliberate: it is safer for the server and faster.
2. **Cloaking.** A site may show QRShield's server something different from what a phone sees.
3. **Blocklists lag.** New phishing sites often go live hours before listing. Free lists cover fewer threats than commercial feeds.
4. **Heuristic false positives.** Long marketing links, partner domains that use brand names, regional brand domains missing from the reference list, new legitimate businesses, and legitimate IDNs.
5. **False negatives.** A clean-looking domain on a compromised legitimate site evades lexical signals.
6. **RDAP coverage.** Some ccTLDs publish no RDAP service or omit dates.
7. **ML scope.** Trained on 2023-era web URLs, not QR-specific ones. Hostname-only. Uncalibrated.
8. **Free-tier scale.** In-memory caches and rate limiting are per instance.

## Reviewer Q&A

**Product and safety**

1. **Does QRShield ever open the website?** Not in your browser. The server sends header-only requests (HEAD, or GET with the body discarded unread) to follow redirects. It never downloads or executes page content. E2E tests assert that the browser stays on QRShield.
2. **Can a "Low" result be trusted as safe?** No. Low means few warning signs were detected among the checks that ran. The UI, the PDF and the methodology page all say this.
3. **Why show "Not checked" instead of "Clean"?** An unqueried source provides no evidence. Calling it clean would be a false safety claim.
4. **What happens with non-URL QR codes?** They are classified (UPI, Wi-Fi, phone, SMS, email, location, contact, blocked scheme, text) and shown as inert text with specific guidance. UPI codes show the payee ID, name and amount, with the warning that scanning is never needed to _receive_ money.
5. **What does QRShield do with a `javascript:` QR code?** It is classified as a blocked scheme and never executed, opened or sent for URL analysis. The server would also reject it (tested).

**Security engineering**

6. **How do you prevent SSRF?** Eleven layers ([security design](security-design.md)). The key ones: every hop is re-validated, only ports 80/443, IP literals are checked in the connector, every DNS answer must be public unicast, and the socket is pinned to the validated address.
7. **How do you stop DNS rebinding?** Validation happens _inside_ the DNS lookup that Node uses to open the socket, so there is no second resolution to race. A test simulates a resolver that turns private on the second call.
8. **Doesn't pinning break HTTPS certificate checks?** No. Only the address lookup is customized; the TLS servername stays the hostname, so certificates are verified normally.
9. **What about `http://2130706433/` or `0x7f.1`?** The WHATWG parser normalizes them to `127.0.0.1` first, and the IP-literal check then rejects them (tested).
10. **What about IPv6 tricks like `::ffff:127.0.0.1`, 6to4 or NAT64?** IPv4-mapped addresses are unwrapped. Well-known NAT64 addresses (`64:ff9b::/96`, used by DNS64 on IPv6-only networks) are judged by the IPv4 they embed, so `64:ff9b::a9fe:a9fe` (metadata) is blocked while NAT64 answers for public sites work. 6to4, Teredo and local-use NAT64 ranges are not "unicast" in ipaddr.js, so they are blocked (tested).
11. **Could a redirect send the server to the cloud metadata service?** No. The Location is re-validated as a new URL; 169.254.169.254 is link-local and blocked (tested).
12. **Why not just use `fetch` with `redirect: "follow"`?** The brief forbids it: automatic following would connect to intermediate hops without per-hop validation.
13. **How are large or slow responses handled?** 16 KB header cap, bodies destroyed unread, 3 s/5 s/12 s timeouts, and at most two requests per hop.
14. **Is the API abusable?** Per-IP token-bucket rate limiting (20/min), a 16 KB body cap, a zod schema and a 2,048-char URL cap. The limiter is per instance, which is documented.
15. **Are secrets exposed to the client?** No. Keys are read only in server modules. `/api/status` returns booleans only (e2e-tested).

**Detection logic**

16. **Why does `accounts.google.com/signin` not get flagged for "signin"?** Keywords never count on a brand's own domain, and a single keyword needs corroboration (tested).
17. **How do you avoid flagging "pineapple" as Apple?** Concatenated brand matches require the remainder to be a lure affix, and typo matching ignores brand names shorter than 6 characters.
18. **What is a homograph attack, and how is it detected?** Look-alike letters from other alphabets (Cyrillic "а"). QRShield decodes punycode, flags mixed-script labels, and folds confusables to a skeleton to compare against brands.
19. **Why "possible" impersonation?** Without contacting the brand, QRShield cannot verify ownership. Partner and regional domains exist.
20. **Why public-suffix-aware parsing?** "Last two labels" is wrong for `example.co.uk` (it would give `co.uk`) and for `user.github.io`. tldts uses the Public Suffix List.
21. **How is the final destination analyzed?** If redirects end on a different registrable domain, the final URL gets the full offline analysis, plus RDAP and ML on its host. Evidence is labelled "Final destination:".

**Scoring**

22. **Where do the weights come from?** The brief's suggested heuristics, plus documented additions. They are engineering judgments, not fitted probabilities, and are stated as such.
23. **What is the correlation group damping?** Within a group, the strongest finding counts fully and the rest count at 50 %. This avoids double counting one underlying deception (e.g. homograph + impersonation).
24. **Can I reproduce a score by hand?** Yes. Score = round(Σ contributions), capped at 100, and every contribution is shown on the finding (tested).
25. **How do failed checks affect the score?** They don't. They are listed as limitations and reduce stated confidence, but never act as "passed".
26. **Why can a verified threat match force Critical?** A curated URL-level listing from Google Safe Browsing, URLhaus or OpenPhish is strong direct evidence. A floor of 75 ensures it is never diluted.

**Machine learning**

27. **Is the ML real?** Yes. A logistic regression trained on 219,036 real labelled hostnames from a CC BY 4.0 dataset, with a reproducible script, saved metrics and a parity test.
28. **Why logistic regression and not deep learning?** It is interpretable (per-feature contributions), tiny (runs in TypeScript with no Python server), fast, and adequate: ROC-AUC 0.906.
29. **Why hostname-only features?** The dataset's benign URLs are mostly bare homepages; path features would learn that artifact and flag normal QR deep links.
30. **How did you avoid data leakage?** De-duplication by hostname, dropping conflicting labels, and a split grouped by registrable domain with an assertion.
31. **Why is test AUC (0.906) higher than CV AUC (0.875)?** Variance in how the random group split composed the test set. The honest range is 0.87–0.91.
32. **Why not average the ML probability and the heuristic score?** They measure different things, the probability is uncalibrated, and averaging would break the score's explainability. There is no documented rationale for averaging, so we don't.
33. **Is the probability calibrated?** No, and the UI says so. Balanced class weights shift it, and no calibration was fitted or evaluated.
34. **How do you know the TypeScript model equals the Python one?** A parity test on 206 hosts asserts features and probabilities agree to 1e-9.
35. **What if the model file is missing or mismatched?** `modelIsUsable()` fails, and the panel shows "Unavailable" with no fabricated value.
36. **Why does ML sometimes disagree with the score?** It sees only the hostname and learned statistical patterns. For example, it rates `bit.ly` at 40.7 % because short hostnames appear in phishing data. Showing both lets users see that disagreement.

**Data, privacy and operations**

37. **Is OpenPhish used?** Only if enabled. Its terms limit use to non-commercial research and prohibit commercial detection use, so it is opt-in by design.
38. **Why Phishing.Database by default?** It is MIT-licensed, keyless, actively maintained and large (~392k domains).
39. **Where is history stored?** Only in the browser's localStorage. It is never uploaded and is deletable at any time.
40. **Is the LLM required?** No. Template explanations are always available; the LLM is optional and guarded ([detection engine: explanations](detection-engine.md#explanations-templates-and-the-optional-llm)).
41. **How do you stop prompt injection through a malicious URL?** The URL is passed as JSON data, the system prompt says the data field is not instructions, the output is schema-validated and filtered, and the score and evidence cannot be changed by the LLM.
42. **How does the stage progress avoid being fake?** Each status comes from a server event emitted when the real operation finishes. There are no timers.
43. **What happens if a third-party service is down?** That check is marked failed or "Not checked", the analysis continues, and the limitation is listed.
44. **Can it run offline or without keys?** Yes. With no keys, every core feature works. With `QRSHIELD_DISABLE_NETWORK=1` the structural analysis and ML still run, and network checks are honestly marked as skipped.
45. **How would you scale it?** Move the caches and rate limiter to Redis, add a history database behind `HistoryStore`, add commercial threat feeds behind `ThreatProvider`, and periodically retrain the model on QR-specific data.

## Glossary

- **Quishing:** phishing delivered through QR codes.
- **SSRF:** Server-Side Request Forgery; tricking a server into requesting internal resources.
- **DNS rebinding:** a domain that resolves to a public IP when checked and a private IP when connected.
- **RDAP:** Registration Data Access Protocol, the JSON successor to WHOIS.
- **Public Suffix List (PSL):** the list of suffixes under which names can be registered (`com`, `co.uk`, `github.io`).
- **Registrable domain:** the public suffix plus one label (`example.co.uk`); whoever registered it controls the site.
- **Punycode / IDN:** the ASCII encoding (`xn--…`) of internationalized domain names.
- **Homograph:** a look-alike domain using visually identical characters.
- **ROC-AUC:** the probability that the model ranks a random phishing host above a random legitimate one.
- **Calibration:** whether a predicted 80 % means "right 80 % of the time".
- **NDJSON:** newline-delimited JSON, one event per line, used for streaming.
