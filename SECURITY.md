# Security policy

QRShield fetches attacker-controlled URLs on its server, so its security matters. Thank you for helping keep it safe.

## Supported versions

| Version                 | Supported |
| ----------------------- | --------- |
| `main` / latest release | ✅        |
| Older releases          | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's [private vulnerability reporting](https://github.com/darkaimzzz/qrshield/security/advisories/new) (_Security → Report a vulnerability_). Include:

- the affected component (e.g. redirect inspector, RDAP client, API route);
- steps or a minimal input that reproduces the issue;
- impact, as you understand it.

You can expect an acknowledgement within 7 days and an assessment within 14 days. Fixes are released as soon as practical, and reporters are credited unless they prefer otherwise.

## Scope

Especially interesting:

- **SSRF**: any way to make the server connect to a non-public address (private, loopback, link-local/metadata, CGNAT, ULA, IPv4-mapped/6to4/NAT64), a non-80/443 port, or a non-HTTP scheme, including through redirects, DNS rebinding or IP encoding tricks;
- request smuggling or resource exhaustion through `/api/analyze`;
- execution of decoded QR content, or the app navigating to an analyzed URL;
- leakage of server-side API keys;
- injection into the optional LLM explanation that changes evidence or scores.

Out of scope:

- QRShield's _detection_ missing a phishing site, or flagging a legitimate one. These are accuracy issues; please open a normal issue with the URL pattern.
- Rate limits being per instance (documented in [docs/deployment.md](docs/deployment.md)).
- Findings that require a compromised browser or device.

## Design references

The defenses are documented in [docs/security-design.md](docs/security-design.md) and tested in `tests/unit/redirects.test.ts`.
