# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-10-28

### Changed

- **New terminal / Matrix interface**: phosphor-green palette on near-black, JetBrains Mono throughout, no gradients. Adds a decorative digital-rain background and CRT scanlines (both off for reduced motion), a shell-prompt header, a numbered module menu, a typewriter hero, a live terminal log for analysis stages, a segmented LED score gauge, and terminal-window panels.
- Demo recording, GIF and screenshots refreshed for the new interface.

### Fixed

- **Live checks failing on IPv6-only (DNS64/NAT64) networks.** The SSRF guard rejected every `64:ff9b::/96` address, so redirect and RDAP lookups failed on such networks. Well-known NAT64 addresses are now judged by the IPv4 they embed; metadata, private and loopback targets stay blocked.

## [1.0.0] - 2026-10-26

First complete version, deployed at https://qrshieldmdp.vercel.app.

### Added

- **Scanning**: live camera scanning (`@zxing/browser`), on-device image decoding with multi-code selection (`zxing-wasm`), URL paste with validation, and inert handling of non-URL payloads (UPI, Wi-Fi, tel, SMS, email, vCard, blocked schemes).
- **Detection engine**: public-suffix-aware URL parsing; lexical analysis; brand-impersonation detection (43-brand reference set, typosquatting, homoglyph skeletons, mixed-script labels); SSRF-hardened redirect inspection with DNS pinning; RDAP domain age; threat intelligence via Phishing.Database (default) plus optional Google Safe Browsing, URLhaus and OpenPhish.
- **Scoring**: deterministic weighted evidence model (0–100) with correlation-group damping, a threat-intel floor and explicit check status.
- **Machine learning**: hostname logistic-regression classifier trained on the PhiUSIIL dataset with a grouped split (test ROC-AUC 0.906), exported to JSON and run in TypeScript, with a Python parity test.
- **Explanations**: deterministic summaries and recommendations, plus optional guarded LLM rewording through an OpenAI-compatible API.
- **App**: streaming analysis progress, a detailed report, PDF export, print stylesheet, local scan history, threat-intelligence education with local analytics, a methodology page, and a demo lab with a QR generator.
- **Quality**: 93 unit tests and 23 Playwright end-to-end tests (desktop and mobile), run in GitHub Actions CI.
- **Project**: documentation (`docs/`), demo recording, contribution and security policies, issue and PR templates, Dependabot.

[Unreleased]: https://github.com/darkaimzzz/qrshield/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/darkaimzzz/qrshield/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/darkaimzzz/qrshield/releases/tag/v1.0.0
