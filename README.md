# Illustrative patient and eVoucher simulator

Public app: https://mharrhayden.github.io/copay/

The current app uses **Product X** (blue) and **Product Y** (green), with synthetic illustrative inputs. Prices, cohort-average OOP, starting probabilities, behavior rates, persistence curves, monthly starts, subfill distributions, and reference benchmarks have been perturbed. These are demonstration values, not validated product estimates.

Program design is preserved: cohort boundaries, two adjustable eligibility goalposts, two expanded-benefit fills, standard support limits, the $7,000 annual patient support maximum, one monthly fill, December cutoff, first-fill abandonment, locked persistence cohort, recurring copay-surprise checks, 1% COGS and $6.50 per completed eVouchered fill. Product X standard support remains $582.67; Product Y remains $500. WAC is fixed by the illustrative catalog and cannot be edited in the interface.

Both New and Continuing patients are available for both products. Product X retains 17 cost cohorts; Product Y retains 16. All distributions normalize to 100%, all persistence curves are nonincreasing, and the shared-percentile cost schedules never increase OOP. Structural zero/100% anchors remain unchanged. Zero-dollar cohorts stay at zero and average costs remain within their original range definitions.

The input data lives in `demo-data.js`, deeply frozen at load. Each product and patient type uses its own dataset. Product X has a synthetic reference benchmark; Product Y shows simulated QC counts and its monthly matrix without a reference comparison. Results are kept separately by product, and selections are locked during runs.

## Development

Use the existing checkout at `/workspace/copay`. Each cloud task is isolated; do not create a worktree unless explicitly requested. Node.js 20+ and Python 3 are required. There are no npm dependencies, credentials, databases, or external services needed to run the app.

```sh
npm start
npm test
python3 scripts/export-html.py
```

The HTTP server uses port 3000. Restart it after restoring an environment. `exports/copay-simulator.html` is the standalone sharing artifact; browser previews that block JavaScript may require the hosted URL instead.

The automated suites check weighted sampling, rate calibration, conditional retention, cost-path distributions, eligibility, EB/standard support, annual limits, fees, financial reconciliation, calendars, QC, and generic-only source/export content. They use illustrative fixtures and program invariants rather than retaining earlier input datasets.

Optional browser validation, using the environment's existing Playwright and Chromium:

```sh
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product product-x --patient-type new
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product product-x --patient-type continuing
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product product-y --patient-type new
python3 scripts/browser-smoke.py --html exports/copay-simulator.html --product product-y --patient-type continuing
```

Managed Chromium may block file:// navigation; the browser check loads the exact standalone document into a blank page. The `--url` option tests a served build. Use supported command approval if browser startup or local sockets are blocked.

## Publish

```sh
npm run build:site
npm run publish:pages
```

Commit source changes before publishing. The publish helper uses an isolated Git index and normal push to `gh-pages`, preserving the checkout. GitHub Pages deploys that branch's `/ (root)` folder. The public build includes only runtime files. Visitors calculate locally, with no shared result storage or login.

Source backup branch: `copay-simulator-recovery`. Current source and sharing artifacts have generic names; earlier Git history has not been rewritten and retains previous versions. Small numerical perturbations are illustrative substitutions, not a guarantee that a dataset cannot be recognized.
