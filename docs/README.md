# QRShield documentation

| Document                                | What's inside                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Architecture](architecture.md)         | Components, data flow, repository map, and a scan traced end to end                             |
| [Detection engine](detection-engine.md) | URL parsing, lexical analysis, impersonation detection, RDAP, threat intelligence, explanations |
| [Risk scoring](scoring.md)              | The weight table, the scoring algorithm, worked examples                                        |
| [Security design](security-design.md)   | SSRF defense in depth, DNS-rebinding protection, privacy and data handling                      |
| [Machine learning](machine-learning.md) | Dataset, features, grouped split, metrics, calibration, TypeScript inference                    |
| [Frontend](frontend.md)                 | Camera and image decoding, pages, design system, accessibility, history, PDF export             |
| [HTTP API](api.md)                      | `POST /api/analyze` streaming protocol and the `Report` schema; `GET /api/status`               |
| [Testing](testing.md)                   | Unit and end-to-end suites and how to run them                                                  |
| [Deployment](deployment.md)             | Vercel and self-hosting, configuration, operations                                              |
| [FAQ, limitations and glossary](faq.md) | 45 reviewer questions answered, known limitations                                               |

Also see [ml/DATASET.md](../ml/DATASET.md) (dataset and model card), [CONTRIBUTING.md](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md).
