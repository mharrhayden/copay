import { getBrackets } from './cohorts.js';
import { selectedProductId, onProductChange, beginRun } from './product-ui.js';
import { simulatePatientBatch } from './batch.js';
import { buildPatientQc, buildMostPopulatedCohortMatrix } from './patient-qc.js';
import { DEFAULT_PRODUCT_ID, getProduct } from './products.js';
import { patientVolumeType, onPatientVolumeChange } from './volume-ui.js';
import { eligibleCohortIds, onEligibilityChange } from './eligibility-ui.js';

const get = id => document.querySelector(`#${id}`);
const metrics = ['attempting', 'filling', 'scripts', 'scriptsPerPatient'];
let displayedRun = null;
function description(run) {
  const ids = run.policy.eligibleCohortIds;
  return `${getProduct(run.productId).name} · ${run.patientType === 'continuing' ? 'Continuing' : 'New'} · eligible starting cohorts ${ids.length ? `${ids[0]}–${ids.at(-1)}` : 'none'}`;
}
function currentSettings() {
  return { productId: get('product').value || DEFAULT_PRODUCT_ID, patientType: patientVolumeType(), policy: { eligibleCohortIds: eligibleCohortIds() } };
}
function renderContext() {
  const current = description(currentSettings());
  get('patient-qc-settings').textContent = displayedRun
    ? `Displayed QC run: ${description(displayedRun)}. Current selection: ${current}. Run again to apply the current selection.`
    : `Current QC settings: ${current}. Product, type, and eligible bounds come from Revenue summary.`;
}
function formatValue(value, key) {
  return value == null ? '—' : key === 'scriptsPerPatient' ? value.toFixed(2) : value.toLocaleString('en-US');
}
function appendRow(body, label, data, difference = false) {
  const row = document.createElement('tr');
  const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = label; row.append(heading);
  for (const key of metrics) {
    const cell = document.createElement('td');
    const value = data ? difference ? data.differences[key] : data.actual[key] : null;
    cell.textContent = difference && value != null ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : difference ? '—' : formatValue(value, key);
    if (difference && data) {
      cell.title = `Simulated: ${formatValue(data.actual[key], key)}; benchmark: ${formatValue(data.benchmark?.[key], key)}${key === 'scriptsPerPatient' && data.actual[key] != null ? `; unrounded simulated ratio: ${data.actual[key].toFixed(6)}` : ''}`;
      if (value != null) cell.dataset.direction = value > 0 ? 'above' : value < 0 ? 'below' : 'equal';
    }
    row.append(cell);
  }
  body.append(row);
}
function renderTables(run = null) {
  const productId = run?.productId ?? selectedProductId();
  const data = run ? buildPatientQc(run) : null;
  get('patient-qc-benchmark-note').textContent = productId === 'product-x' ? 'Product X illustrative reference: synthetic benchmark values, held fixed for New and Continuing.' : 'Product Y has no illustrative reference benchmark. Simulated results and the monthly matrix are available; reference differences are shown as a dash.';
  for (const id of ['patient-qc-actual', 'patient-qc-difference', 'patient-qc-actual-total', 'patient-qc-difference-total']) get(id).replaceChildren();
  getBrackets(productId).forEach((bracket, index) => {
    const label = `${bracket.id}. ${bracket.label}`;
    appendRow(get('patient-qc-actual'), label, data?.rows[index]);
    appendRow(get('patient-qc-difference'), label, data?.rows[index], true);
  });
  appendRow(get('patient-qc-actual-total'), 'Total', data?.total);
  appendRow(get('patient-qc-difference-total'), 'Total', data?.total, true);
  renderMonthMatrix(run);
}
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function matrixRow(body, values, startMonth = null, intensityMax = 0) {
  const row = document.createElement('tr');
  values.forEach((value, index) => {
    const cell = document.createElement(index === 0 ? 'th' : 'td');
    if (index === 0) cell.scope = 'row';
    const calendarIndex = index - 4;
    const calendarCell = calendarIndex >= 0 && calendarIndex < 12;
    const unavailable = calendarCell && startMonth !== null && calendarIndex + 1 < startMonth;
    cell.textContent = unavailable ? '—' : value;
    if (unavailable) cell.className = 'no-fill-opportunity';
    if (calendarCell && startMonth !== null && !unavailable) {
      const fills = Number(String(value).replaceAll(',', ''));
      cell.title = `${fills.toLocaleString('en-US')} completed scripts in ${monthNames[calendarIndex]} from ${monthNames[startMonth - 1]} starters`;
      if (fills > 0 && intensityMax > 0) cell.style.backgroundColor = `hsl(var(--theme-hue) 30% 40% / ${0.08 + 0.3 * fills / intensityMax})`;
    }
    row.append(cell);
  });
  body.append(row);
}
function renderMonthMatrix(run) {
  const matrix = run ? buildMostPopulatedCohortMatrix(run) : null;
  const body = get('patient-qc-matrix-body'); const footer = get('patient-qc-matrix-total');
  body.replaceChildren(); footer.replaceChildren();
  if (!matrix) {
    get('patient-qc-matrix-cohort').textContent = 'Run QC to inspect the starting cohort with the most attempting patients.';
    get('patient-qc-matrix-flow').textContent = '';
    get('patient-qc-matrix-check').textContent = '';
    const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 18; cell.textContent = 'Run the 10,000-patient QC simulation to populate this matrix.'; row.append(cell); body.append(row);
    return;
  }
  const count = value => value.toLocaleString('en-US');
  get('patient-qc-matrix-cohort').textContent = `Most populated starting cohort: ${matrix.bracket.id}. ${matrix.bracket.label} · ${count(matrix.total.attempting)} attempting patients · ${count(matrix.total.filling)} filling patients · ${count(matrix.total.scripts)} scripts.`;
  const reasons = matrix.stopReasons;
  get('patient-qc-matrix-flow').textContent = `Patient outcomes in this cohort: ${count(reasons.initialAbandonment)} initially abandoned; ${count(reasons.persistence)} stopped on ordinary persistence; ${count(reasons.copaySurprise)} stopped on copay surprise; ${count(reasons.yearEnd)} reached December without an earlier stop.`;
  const maximum = Math.max(0, ...matrix.rows.flatMap(row => row.calendarFills));
  for (const row of matrix.rows) {
    matrixRow(body, [monthNames[row.startMonth - 1], count(row.attempting), count(row.filling), String(row.maxFillsPerPatient), ...row.calendarFills.map(count), count(row.scripts), formatValue(row.scriptsPerPatient, 'scriptsPerPatient')], row.startMonth, maximum);
  }
  const total = matrix.total;
  matrixRow(footer, ['Total', count(total.attempting), count(total.filling), '—', ...total.calendarFills.map(count), count(total.scripts), formatValue(total.scriptsPerPatient, 'scriptsPerPatient')]);
  get('patient-qc-matrix-check').textContent = matrix.reconciles
    ? `Reconciled: all ${count(total.scripts)} matrix scripts match this cohort’s Scripts count in the QC results above.`
    : 'Reconciliation issue: matrix totals do not match the cohort summary.';
}
get('run-patient-qc').addEventListener('click', async () => {
  const settings = currentSettings();
  const status = get('patient-qc-status');
  const finishRun = beginRun();
  try {
    const run = await simulatePatientBatch({ ...settings, patientCount: 10000,
      onProgress: completed => { status.textContent = `${completed.toLocaleString('en-US')} of 10,000 QC patients simulated…`; },
    });
    displayedRun = run;
    renderTables(run); renderContext();
    status.textContent = `Complete: 10,000 independently simulated patients · ${description(run)}. Revenue and individual-patient results were preserved.`;
  } catch (error) {
    status.textContent = 'QC could not complete. Previous QC results are retained; please retry.';
    console.error(error);
  } finally { finishRun(); }
});
onPatientVolumeChange(renderContext);
onEligibilityChange(renderContext);
const runSnapshots = new Map();
let displayedProductId = selectedProductId();
onProductChange(productId => {
  runSnapshots.set(displayedProductId, displayedRun);
  displayedRun = runSnapshots.get(productId) ?? null;
  displayedProductId = productId;
  renderTables(displayedRun); renderContext();
  get('patient-qc-status').textContent = displayedRun ? `Showing saved ${getProduct(productId).name} QC results.` : 'Run QC to simulate 10,000 patients with the selected product and settings.';
});
renderTables(); renderContext();
