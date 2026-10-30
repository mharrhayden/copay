# Recovery record

Source: the user's uploaded `Pasted text.txt` conversation export. Recovery targeted the final state described in that history, including reverting the subsequently cancelled Patient QC Program filter. No changes were pushed or published.

## Recovered and reconstructed files

- `simulation.js`: reconstructed the small initial OOP generator from the user's exact supplied inputs, then recovered the recorded subsequent source edits. Reinstated the patient-type schedule parameter indicated by the later code and tests.
- `products.js`, `persistence.js`, `start-month.js`: supplied data and final settings recovered from complete recorded commands.
- `app.js`, `batch.js`, `eligibility-ui.js`, `volume-ui.js`, `revenue-ui.js`, `tabs.js`, `patient-qc.js`, `patient-qc-ui.js`, `qc.js`, `start-month-qc.js`: recovered recorded file writes and later edits. Obsolete OOP/start-month UI modules are omitted, matching their deletion in the history.
- `index.html`: reconstructed because the original file's contents were not included. Uses the final recovered modules' element IDs and three-tab workflow.
- `styles.css`: reconstructed base styling with recorded subsequent CSS additions. Not a byte-for-byte recovery of the original appearance.
- `bootstrap.js` and missing-data checks in `subfill-distributions.js`: new recovery safeguards that keep the interface inspectable while preventing simulation with absent source data. QC validates invalid fill numbers before consulting source tables.
- `package.json`, `scripts/run-tests.js`, and `scripts/browser-smoke.py`: reconstructed dependency-free startup and verification workflow.
- Existing named test files were recovered where full source commands were available. The final inline test edits were not all present. `simulation.test.js` is a new core regression suite using explicit schedules; the older incomplete recovered version is preserved in `simulation.test.js.partial.txt` as text, not as an executable test. The recovered starting-month test was updated to verify both explicitly supplied volume tables rather than its superseded single-table assumption.

## Source tables still required

The export referenced two old attachments, but did not include their content:

1. Baseline Subfills Table, formerly `attachments/b51080e9-a3b1-432d-b19b-09331b6aa4a6/Pasted text.txt`. Historical import expected 153 original/destination rows across 17 starting cohorts.
2. Continuing Pts Distribution, formerly `attachments/98aefa58-99eb-4a28-bf35-70b435aaa8fe/Pasted text.txt`. Historical import expected 147 sparse rows across 17 starting cohorts. Source AAA–AAQ map by dollar range to A–M, O–R, not directly by letter suffix.

Both data modules should export an object shaped as follows (schema only, no sample weights):

```
starting cohort ID -> destination cohort ID -> 12 integer weights
```

Each integer is a hundredth of a percent. Original rounded column totals were allowed to differ from 10,000 by at most 2; the sampler normalizes them. Destination order must follow the dollar-range cohort order. The first fill is fixed to the starting cohort. Missing zero-weight destinations in the Continuing source remain zero. Do not infer complete matrices from isolated example percentages in the history.

Restore the exports `subfillWeights` and `continuingSubfillWeights` in their respective modules using the original uploaded data. Freeze objects/arrays as in the recorded import. Then rerun the full suite, resolve any remaining omitted historical test edits against the recovered final rules, and validate actual patient generation, batch revenue, and 10,000-patient QC before claiming full recovery.

## Verification in this environment

Core model tests and the Playwright interface smoke test passed. The interface check covered initialization, 17 starting cohorts, 12 monthly columns, revenue headings, patient QC rows, tabs, synchronized pricing/type/eligibility controls, missing-data guards, and mobile page width. Full-suite results are summarized in the final task report. Full simulations and statistical OOP validation remain blocked by the missing tables.

Final full-suite run: 46 tests executed; 18 passed, 28 failed, 0 skipped. All remaining failures report a missing original New or Continuing OOP table. This does not establish that those tests will pass once the data is restored.

## New patient data restored

The next user upload supplied the New patient pivot table with AAA–AAQ labels and blank repeated starting-cohort cells. `scripts/import-oop-table.py` maps labels by dollar range, carries blank starting-cohort labels, preserves sparse rows and integer hundredth-percent weights, validates rounded totals, and checks first-fill identity and stochastic monotonicity. It imported 124 populated rows rather than the old export's expected 153 rows; absent destinations are zero. The New distribution QC tests pass, including the recorded G fill-2 example of 11.67% out of a 99.98% rounded total.

The New option and its individual, revenue, and QC controls are enabled. Only Continuing remains unavailable. Full-suite result after this import: 46 executed, 33 passed, 13 failed, zero skipped. Every failure explicitly requires the missing Continuing source table. The old September revenue test used the superseded $1,000 WAC implicitly; it now passes that WAC explicitly, preserving its original assertions and testing repricing independently of the Ubrelvy default.

Additional checks passed: 170,000 New OOP paths across every starting cohort with no increases and marginal sampling error below 0.01 percentage points; standalone HTML content with zero network requests; actual New patient generation; separate 10,000-patient revenue and QC runs; matrix reconciliation; settings synchronization; mobile width. File-scheme navigation is blocked by managed Chromium policy, so the exact standalone HTML was loaded with Playwright into a blank page. The export embeds modules using a data-URL import map for use without a server in modern browsers.

## Continuing data restored; recovery blockers resolved

The user supplied the Continuing Pts Distribution. The validated importer restored all 147 sparse rows across the 17 starting cohorts and 12 fill columns. Rounded totals range from 99.98% to 100.02%; dollar-range mapping, first-fill identity, and exact cumulative monotonicity checks pass. Both New and Continuing options are now enabled; the recovery notice is hidden when both datasets are available.

Two remaining historical tests implicitly assumed $1,000 WAC while the recovered product default is $1,393.68. Their revenue calls now explicitly supply the original $1,000 fixture WAC; their expected values and model calculations are unchanged. The temporary missing-data core check was replaced by assertions that both complete, distinct source tables are loaded and immutable. Full suite: 46 passed, zero failed, zero skipped.

Continuing OOP QC sampled 170,000 paths (17 cohorts × 10,000 percentiles), found zero increases, and matched every monthly distribution within 0.01 percentage points. The standalone browser check now accepts --patient-type new or --patient-type continuing and verifies the selected OOP and persistence tables in the individual ledger, actual 10,000-patient revenue and QC runs, and monthly matrix reconciliation.

## Qulipta product integration

Added the user's Qulipta inputs: 16 cohort ranges (one $1,000+ range), supplied starting weights totaling 99.9% and normalized at selection, fixed average OOP, 2027 GTN, abandonment/surprise rates, 2025 monthly New/Continuing start volumes, New persistence curves, and the supplied New subfill matrix (114 populated rows). The user confirmed fixed WAC $1,264.80, standard benefit $500, $7,000 annual support, and two EB fills. Qulipta Continuing OOP/persistence tables remain unavailable; its provided monthly starting distribution is retained without enabling unsupported Continuing simulation.

Product-specific cohorts now live in `cohorts.js`; the engine routes all cost, behavior, benefit, calendar, and revenue lookups by product. Existing Ubrelvy exports/defaults are preserved for regression coverage. Product changes reset the displayed cohort structure, sliders, and palette while restoring only that product's cached results. Product/type selection is locked during active runs. WAC fields are fixed references and do not affect calculation inputs. Ubrelvy is blue and Qulipta green, including table and matrix shading. Qulipta never uses Ubrelvy reference benchmarks.

Validation: all 56 model tests pass with zero skipped. The 10 new Qulipta tests cover exact inputs, normalized selection, both supplied month tables, cumulative persistence, 160,000 New OOP paths with marginal error below 0.01 percentage points, benefit rules and annual exhaustion, eligibility, December cutoff, financial reconciliation, and unavailable Continuing guards. Browser checks exercise product switching, independent snapshots, fixed pricing, palettes, correct source/persistence tables, shared goalposts, and actual 10,000-patient revenue/QC runs.
