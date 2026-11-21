Third-party libraries served from this site (instead of a public CDN) so the Content-Security-Policy can
allow only our own scripts and no outside script ever runs next to your data or API key.

- `chart.umd.js` — Chart.js 4.4.1, MIT License, https://www.chartjs.org
- `anthropic-sdk.mjs` — Anthropic TypeScript SDK 1.8.0 (`@anthropic-ai/sdk`), Apache License 2.0,
  bundled for the browser with esbuild: `esbuild entry.mjs --bundle --format=esm --minify --platform=browser`
  where `entry.mjs` is `export { default, Anthropic } from '@anthropic-ai/sdk';`
- `jspdf.umd.min.js` — jsPDF 4.2.1, MIT License, https://github.com/parallax/jsPDF (PDF reports; loaded only when a PDF is made)
- `html2canvas.min.js` — html2canvas 1.4.1, MIT License, https://html2canvas.hertzen.com (draws the report, Arabic included, for the PDF)
