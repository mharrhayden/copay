# Copay eVoucher simulator

Recovered from the supplied conversation export. The page has Revenue summary, Patient simulation, and Patient QC tabs. Most model and UI modules were recovered from the recorded source-writing commands. The original complete page, base styling, and some test edits were absent; those parts were reconstructed. See [recovery/RECOVERY.md](recovery/RECOVERY.md) for provenance and remaining gaps.

## Run

Use the existing checkout at `/workspace/copay`. Node.js 20+ and Python 3 are required; there are no npm dependencies to install.

```sh
cd /workspace/copay
npm start
```

This starts a local static HTTP server on port 3000. No API keys, database, or external service is required. Processes must be restarted in a restored environment. This does not publish the app.

## Patient data availability

New patient simulation is available. The supplied New patient OOP pivot table was imported into `subfill-data.js`: 124 populated rows, all 17 starting cohorts, 12 fills, and source column totals of 99.98%–100.02%. AAA–AAQ labels are mapped by dollar range to A–M, O–R; blank starting-cohort cells carry the preceding cohort. Missing destinations have zero weight. Sampling normalizes the original rounded weights without changing them.

Continuing patient simulation still needs its separate **Continuing Pts Distribution**. `continuing-subfill-data.js` remains an explicitly empty placeholder and the Continuing option is unavailable in the interface. No New data is substituted for Continuing patients.

The repeatable import command is:

```sh
python3 scripts/import-oop-table.py /path/to/upload.txt --patient-type new
```

For the Continuing table, use `--patient-type continuing`. The importer checks cohort labels, 12 percentage columns, duplicate rows, first-fill identity, column totals, and the cumulative distributions needed for nonincreasing OOP paths before writing data.

## Standalone HTML

Open `exports/copay-simulator.html` in a modern browser. It embeds all application JavaScript, styling, and available source data and needs no server or internet connection. Use Download if a file preview does not execute JavaScript. Results and settings reset when the page reloads.

Rebuild after source changes:

```sh
python3 scripts/export-html.py
```

## Validation

```sh
npm run test:core
npm test
```

The core suite uses explicit constant-cost schedules to validate clinical and financial rules independently of the missing OOP tables. It is not a validation of the original OOP transitions. The complete test command runs every recovered suite and currently exits unsuccessfully on tests requiring the missing Continuing table. No failing assertions have been disabled. Some historical inline test edits were absent from the export; recheck the recovered suites once source tables are available.

An optional interface check uses the environment's existing Playwright and Chromium installations. Start the server first, then run:

```sh
python3 scripts/browser-smoke.py
```

If a command sandbox prevents local sockets or browser startup, use the supported command approval flow. The test runner runs each test file directly so this environment reports individual test counts and failures reliably.

## Recovered model rules

- Starting OOP: 17 weighted cohorts, with supplied fixed dollar amounts. The original labels omit N.
- Later OOP: distributions conditioned on starting cohort, patient type, and fill number; a shared percentile couples later fills into a nonincreasing cost path. The New matrix is restored; the Continuing matrix remains missing.
- Ubrelvy: WAC $1,393.68; standard support up to $582.67 per fill. Expanded benefit covers fills 1–2 without a per-fill maximum. All support, including expanded benefit, counts toward a $7,000 annual patient limit.
- Eligibility: synchronized lower/upper starting-cohort bounds; each run snapshots its policy, product, and patient type.
- Abandonment applies once after first-fill assistance. Persistence stays tied to the first fill's final OOP cohort and uses the New or Continuing cumulative curve. Subsequent fills with remaining copay also receive an independent surprise drop-off check.
- One fill per month, no restarts, and no fills or spending after December. New and Continuing patients use different starting-month distributions.
- Revenue: completed fills × WAC, less starting-cohort GTN and actual support spend. The final measure also subtracts COGS at 1% of WAC and a $6.50 transaction fee per eVouchered completed fill. Amounts use integer cents; WAC changes reprice existing fills.
- Patient QC: a separate 10,000-patient run, fixed supplied benchmarks, signed percentage differences, and a monthly script matrix for the most populated starting cohort. The abandoned Program filter and obsolete OOP/start-month UI tabs were not restored.

Latest validation: 33 of 46 tests pass; 13 fail explicitly on the missing Continuing OOP table. All 170,000 sampled New OOP paths (17 cohorts × 10,000 percentiles) remain nonincreasing and agree with each monthly distribution within 0.01 percentage points. Browser validation of the exact standalone document passed patient generation, a 10,000-patient New revenue batch, a separate 10,000-patient QC run, and matrix reconciliation with no network requests. This managed browser blocks file:// navigation, so the standalone document was loaded into a blank browser page for that check.
