# Frontend

Scanning, pages, design system, accessibility, history and export.

## Frontend: scanning, pages, design, accessibility

- **Upload decoding.** `zxing-wasm/reader` (ZXing C++ compiled to WebAssembly) runs `readBarcodes(file, { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 8 })`. The `.wasm` file is **self-hosted** at `/wasm/zxing_reader.wasm`, copied by `postinstall`, so no CDN is involved and images never leave the device. File type (PNG/JPG/WebP) and size (≤ 8 MB) are validated. Several results trigger a chooser; none triggers a clear error. Object URLs are revoked to free memory.
- **Camera decoding.** `@zxing/browser` `BrowserQRCodeReader`, scanning every 150 ms. Errors are mapped: `NotAllowedError`/`SecurityError` → permission denied; `NotFoundError`/`OverconstrainedError` → no camera; other errors → generic. Each state shows guidance and an "Upload an image instead" fallback.
- **Pages.**
  - `/`: dashboard.
  - `/analyze`: live stages, then the report.
  - `/history`.
  - `/intelligence`: URL anatomy, nine attack explainers that run the **real** isomorphic engine (`analyzeStructure`) in the browser on synthetic examples, and Recharts charts computed only from local history, with empty states and a "your device only" label.
  - `/demo`.
  - `/methodology`: renders the live weight table and model metrics.
- **Next.js 16 specifics.** Cache Components is enabled. Pages that read `useSearchParams` are wrapped in `<Suspense>`. The `runtime` export is not used (Cache Components forbids it; Node is the default). The analyze route sets `maxDuration = 60`. Analysis runs are keyed components, so a retry remounts with fresh state (no `setState` inside effects, per React lint rules).
- **Design system.**
  - Dark navy `#060a13`, cyan accent `#22d3ee`, violet `#8b5cf6`.
  - Risk colors: emerald `#10b981`, amber `#f59e0b`, orange `#f97316`, red `#ef4444`, as Tailwind 4 `@theme` tokens.
  - Geist Sans/Mono, translucent "surface" utility, subtle grid and radial glows.
  - Custom SVG logo: a shield whose interior is QR finder patterns. Gradient ids are unique per instance; a bug where a hidden sidebar copy broke the header logo was found and fixed.
- **Motion.** Page transitions (`template.tsx`), gauge sweep and count-up, staggered panels, an expandable evidence accordion and the scan line. `MotionConfig reducedMotion="user"` plus a CSS `prefers-reduced-motion` override disable motion for users who ask.
- **Accessibility.**
  - Semantic landmarks, `aria-current`, `aria-expanded` and `aria-pressed`, `role="alert"` errors and live regions for stage progress, a labelled progress bar, and focus-visible rings.
  - Severity always carries a text label, not color alone. Charts include a "View as table" alternative. The amber/orange risk pair was validated with a palette checker (normal-vision ΔE 9.6, close), so the bars are always identified by text axis labels.
- **Responsive.** Sidebar on desktop; on mobile, a bottom navigation bar with a raised **Scan** button and safe-area padding. Playwright verifies zero horizontal overflow on every page at Pixel 7 width.

## History, PDF and print

- **`HistoryStore` interface** (`list`, `get`, `save`, `remove`, `clear`, `subscribe`) with a localStorage implementation. It is exposed to React through `useSyncExternalStore`, syncs across tabs through the `storage` event, validates entries on read, and keeps an in-memory copy if storage is blocked (private mode). A server database can replace it without touching the UI.
- **Autosave.** On by default and switchable on the History page. The report's Save button toggles saved state.
- **PDF.** `jsPDF` builds a **text** PDF (selectable, small) containing the branded header, report ID, generation time, score and band, summary, scan details (timestamp, source, original and normalized and final URL), every finding with its explanation and evidence, the redirect chain, RDAP data, threat-intel results, the ML result, recommendations, checks, limitations, the safety disclaimer and page numbers. Non-Latin-1 characters are transliterated, because the built-in PDF fonts cannot render them; punycode hostnames remain exact.
- **Print.** A print stylesheet removes navigation and buttons, uses white paper, and avoids breaking panels across pages.
