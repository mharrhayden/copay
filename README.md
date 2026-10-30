# Copay eVoucher simulator

Public site: **https://mharrhayden.github.io/copay/**

Select the product in the top-right dropdown. Product selection switches cohort definitions, starting probabilities, OOP amounts, GTN, abandonment, surprise rates, persistence, start-month distributions, benefit rules, fixed WAC, tables, and interface palette together. Each product retains its own in-page patient, revenue, and QC results. A product cannot be switched while a simulation is running.

| Product | Palette | Fixed WAC / fill | Standard buydown / fill | Annual support | Patient types |
| --- | --- | --- | --- | --- | --- |
| Ubrelvy | Blue | $1,393.68 | $582.67 | $7,000 | New and Continuing |
| Qulipta | Green | $1,264.80 | $500.00 | $7,000 | New; Continuing persistence pending |

Both products have expanded benefit on their first two fills, with no per-fill maximum within the remaining annual support balance. Eligibility uses two goalposts on one combined bar. WAC is displayed as a fixed product reference; users cannot edit it. COGS remains 1% of WAC and the transaction fee remains $6.50 per completed eVouchered fill.

## Run locally

Use the existing checkout at `/workspace/copay`. Node.js 20+ and Python 3 are required; there are no npm dependencies to install.

```sh
cd /workspace/copay
npm start
```

This serves the static app on port 3000. No API keys, database, or external service are required. Processes must restart after environment restoration. Use existing checkouts; cloud tasks are isolated and do not need new Git worktrees unless explicitly requested.

## Product data

Ubrelvy has 17 cohorts, ending in $1,000.01–$1,300 and $1,300+. Its New and Continuing OOP matrices are in `subfill-data.js` (124 populated rows) and `continuing-subfill-data.js` (147 rows).

Qulipta has 16 cohorts, ending in a single $1,000+ cohort. Its New OOP matrix is in `qulipta-subfill-data.js` (114 rows), and its Continuing OOP matrix is in `qulipta-continuing-subfill-data.js` (128 rows). The supplied starting probabilities total 99.9%; selection normalizes all supplied weights without changing them. Cohort averages, 2027 GTN, abandonment, and surprise rates are in `cohorts.js`, along with the supplied New persistence curves. The 2025 New/Continuing monthly starting volumes are in `start-month.js` and normalize their rounded source totals. **Qulipta Continuing persistence curves have not been supplied**, so that option stays unavailable. No Ubrelvy or New-patient data is substituted for it.

The importer maps AAA–AAQ or shorter cohort labels by dollar range, carries blank pivot labels, and treats omitted destinations as zero. It verifies 12 fill columns, percentage precision, duplicate rows, first-fill identity, rounded column totals, and exact cumulative monotonicity before writing:

```sh
python3 scripts/import-oop-table.py /path/to/table.txt --patient-type new --product qulipta
```

Use `--product ubrelvy` for Ubrelvy and `--patient-type continuing` for a Continuing source. The Qulipta Continuing subfill table is now routed by `subfill-distributions.js`. Its supplied persistence curves still need to be added in `persistence.js` before enabling that type.

## Model rules

- Starting OOP cohort is drawn once; each cohort uses its supplied average dollar amount.
- Subsequent Initial OOP is conditioned on the original cohort, patient type, product, and fill number. A shared percentile across fills preserves the source marginals while preventing OOP increases.
- First-fill abandonment applies after assistance. All later persistence uses the first fill's final OOP cohort and the selected patient's product-specific persistence table. Later fills with remaining copay also receive independent surprise checks using that fill's final OOP cohort.
- One fill per month, no gaps or restarts, and no fills or spending after December. Monthly entry volumes are product- and patient-type-specific.
- Support, including expanded benefit, counts against the patient's annual limit. Only completed in-year fills debit support; unused offers and out-of-year fills do not spend. A partial final voucher can exhaust the balance exactly.
- Revenue is completed fills × fixed product WAC, less starting-cohort GTN and actual support. The final metric also subtracts COGS and transaction fees. Calculations use integer cents and per-fill rounding.
- Patient QC independently simulates 10,000 patients and reconciles a monthly script matrix for the most populated starting cohort. Ubrelvy's fixed supplied benchmarks remain available. Qulipta benchmarks have not been supplied, so its reference differences display a dash; simulated counts and matrix still work.

## Validate

```sh
npm test
python3 scripts/export-html.py
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product ubrelvy --patient-type new
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product ubrelvy --patient-type continuing
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product qulipta --patient-type new
```

All 57 automated tests pass with zero skipped. The environment's optional browser checks use its existing Playwright and `/usr/lib/chromium/chromium`. They verify patient generation, 10,000-patient revenue/QC runs, matrix reconciliation, correct cohorts/persistence, fixed WAC, product snapshots, palette switching, slider dragging/keyboard bounds, and mobile width. Managed Chromium blocks file:// navigation, so the exact standalone HTML content is loaded into a blank browser page. Use supported command approval if local sockets or browser startup are blocked.

The optional `--url` flag tests a served public build, including a project subdirectory. Tests retain an internal WAC override for isolated fixture/repricing assertions; the application always calculates from the fixed catalog WAC and exposes no price entry.

## Share and publish

`exports/copay-simulator.html` embeds CSS, JavaScript, and all available datasets. Rebuild it with `python3 scripts/export-html.py`. Some file previews block script execution; the hosted URL is the preferred team-sharing route.

The public site uses GitHub Pages, deploying from `gh-pages`, folder `/ (root)`. That branch contains only runtime files; no tests, recovery notes, or development helpers. After committing source changes:

```sh
npm run publish:pages
```

This builds `_site` and pushes its files using an isolated Git index, preserving the checkout. Existing Pages settings trigger deployment automatically. Website visitors run calculations in their own browsers; there is no server, login, or shared result storage. Results reset on reload.

Source backup branch: `copay-simulator-recovery`. Historical reconstruction details are in [recovery/RECOVERY.md](recovery/RECOVERY.md).
