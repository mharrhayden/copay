import './patient-qc-ui.js';
import { getProduct } from './products.js';
import { selectedProductId, onProductChange, beginRun } from './product-ui.js';
import { patientVolumeType, onPatientVolumeChange } from './volume-ui.js';
import { eligibleCohortIds, onEligibilityChange } from './eligibility-ui.js';
import { createCohortRun, addPatientToRun, simulatePatientBatch } from './batch.js';
import { renderRevenueTab } from './revenue-ui.js';
import './tabs.js';
import { getBrackets, generatePatient, calculateRevenue } from './simulation.js';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = cents => currency.format(cents / 100);
const abandonment = bracket => `${(bracket.abandonmentBasisPoints / 100).toFixed(2)}%`;
const percent = value => `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 4 })}%`;
const probability = bracket => percent(bracket.weight / getBrackets(bracket.productId).reduce((total, item) => total + item.weight, 0));
let sequence = 0;
let currentPatient = null;
let currentBatch = null;
const settings = document.querySelector('#voucher-settings');
const productId = selectedProductId;
const snapshots = new Map();
let displayedProductId = productId();
function renderProductInfo() {
  const product = getProduct(productId());
  for (const selector of ['#wac', '#revenue-wac']) document.querySelector(selector).textContent = money(product.wacCents);
  const body = document.querySelector('#distribution');
  body.replaceChildren();
  const brackets = getBrackets(productId());
  for (const bracket of brackets) {
    const row = document.createElement('tr');
    for (const value of [`${bracket.id}. ${bracket.label}`, probability(bracket), money(bracket.oopCents), abandonment(bracket), `${bracket.gtnRatePercent}%`, percent(bracket.surpriseDropoffBasisPoints / 10000)]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    body.append(row);
  }
  const sourceTotal = brackets.reduce((total, bracket) => total + bracket.weight, 0) / 10;
  document.querySelector('#distribution-note').textContent = `${product.name} · ${brackets.length} starting cohorts. Illustrative starting percentages total ${sourceTotal.toFixed(1)}%; sampling normalizes them to 100%. Displayed selection probabilities are normalized.`;
  document.querySelector('#settings-note').textContent = `${product.name}: expanded benefit on fills 1–${product.expandedBenefitFills}, then up to ${money(product.standardBuydownCents)} per fill, within ${money(product.annualBuydownCapCents)} annual support. Eligibility applies to the next run.`;
}
renderProductInfo();

onEligibilityChange(() => {
  document.querySelector('#settings-note').textContent = 'Eligibility changed. Generate a patient or run a batch to apply it; existing results keep their original eligibility.';
  document.querySelector('#revenue-eligibility-note').textContent = 'Eligibility changed. Run the simulation again to apply these bounds; displayed results keep their previous eligibility.';
});
settings.addEventListener('submit', event => event.preventDefault());

for (let month = 1; month <= 12; month++) {
  const heading = document.createElement('th');
  heading.scope = 'col';
  heading.textContent = month;
  document.querySelector('#fill-months').append(heading);
  for (const row of ['calendar-month', 'status', 'original-cohort', 'original-probability', 'oop-distribution', 'pre-voucher-cohort', 'subfill-probability', 'initial-oop', 'voucher', 'cap', 'annual-before', 'buydown', 'annual-after', 'oop', 'wac', 'revenue', 'gtn-rate', 'gtn', 'spend', 'net-revenue', 'cogs', 'tf', 'net-after-costs', 'cohort', 'persistence-type', 'abandonment', 'retention', 'persistence', 'oop-cohort', 'surprise-rate', 'surprise-applies', 'surprise', 'chance']) {
    const cell = document.createElement('td');
    cell.id = `fill-${row}-${month}`;
    cell.textContent = '—';
    document.querySelector(`#fill-${row}`).append(cell);
  }
}

document.querySelector('#generate').addEventListener('click', () => {
  if (!settings.reportValidity()) return;
  const policy = {
    eligibleCohortIds: eligibleCohortIds(),
  };
  const patient = generatePatient(++sequence, policy, Math.random, Math.random, Math.random, patientVolumeType(), productId());
  renderPatient(patient);
});

function renderPatient(patient) {
  const policy = patient.voucherPolicy;
  const firstFill = patient.fills[0];
  document.querySelector('#settings-note').textContent = 'Settings applied. Generate another patient for a new independent simulation.';
  document.querySelector('#patient-id').textContent = patient.id;
  document.querySelector('#oop').textContent = money(patient.oopCents);
  document.querySelector('#bracket').textContent = `${patient.bracket.id}. ${patient.bracket.label}`;
  document.querySelector('#patient-volume-type').textContent = patient.patientType === 'continuing' ? 'Continuing' : 'New';
  document.querySelector('#start-month').textContent = `Month ${patient.startMonth}`;
  document.querySelector('#max-year-fills').textContent = String(patient.maxFillsInYear);
  document.querySelector('#probability').textContent = probability(patient.bracket);
  document.querySelector('#effective-oop').textContent = money(firstFill.effectiveOopCents);
  document.querySelector('#behavior-cohort').textContent = `${firstFill.behaviorBracket.id}. ${firstFill.behaviorBracket.label}`;
  document.querySelector('#abandonment').textContent = abandonment(firstFill.behaviorBracket);
  document.querySelector('#outcome').textContent = patient.outcome;
  document.querySelector('#outcome').dataset.outcome = patient.outcome.toLowerCase();
  document.querySelector('#patient-hint').textContent = 'Original OOP · before assistance';
  document.querySelector('#fill-count').textContent = `${patient.fillCount} / ${patient.maxFillsInYear} possible fills`;
  document.querySelector('#year-summary').textContent = patient.fillCount === 0
    ? 'Abandoned before the first fill. No fills completed this year.'
    : patient.fillCount === patient.maxFillsInYear ? `Completed all ${patient.maxFillsInYear} available in-year fills; reached December.`
    : `${patient.fillCount} ${patient.fillCount === 1 ? 'fill' : 'fills'} completed, then stopped before fill ${patient.fillCount + 1}.`;
  document.querySelector('#year-summary').textContent = `Starts in month ${patient.startMonth}. ` + document.querySelector('#year-summary').textContent;
  document.querySelector('#fill-scale-max').textContent = `${patient.maxFillsInYear} possible fills`;
  if (patient.fills.some(fill => fill.surpriseDropped)) {
    document.querySelector('#year-summary').textContent += ' Dropped off due to copay surprise.';
  }
  const eligible = policy.eligibleCohortIds.includes(patient.bracket.id);
  document.querySelector('#policy-summary').textContent = eligible
    ? `Eligible cohort · fills 1–2: EB, no per-fill maximum within annual balance · fills 3–12: up to ${money(getProduct(patient.productId).standardBuydownCents)} per fill · persistence stays in the first-fill cohort; each later fill with remaining copay adds surprise drop-off.`
    : 'Ineligible cohort · no eVoucher · persistence uses the first-fill cohort; surprise uses each fill’s remaining copay.';
  document.querySelector('#policy-summary').textContent += ` Annual support maximum: ${money(patient.annualSupportCapCents)}. Persistence table: ${patient.patientType === 'continuing' ? 'Continuing' : 'New'}.`;
  currentPatient = patient;
  renderRevenue();
  document.querySelector('#fill-bar').style.width = `${patient.fillCount / patient.maxFillsInYear * 100}%`;
  const progress = document.querySelector('#fill-progress');
  progress.setAttribute('aria-valuemax', patient.maxFillsInYear);
  progress.setAttribute('aria-valuenow', patient.fillCount);
  progress.setAttribute('aria-valuetext', `${patient.fillCount} of ${patient.maxFillsInYear} available in-year fills completed`);
  for (const fill of patient.fills) {
    // Both the simulation and table use the same sampled monthly inputs.
    // Planned costs remain visible after stopping without adding program spend.
    const behavior = firstFill.behaviorBracket;
    const benefit = fill;
    const oopBracket = fill.oopBracket;
    const surpriseApplies = fill.copaySurprise;
    const surpriseRate = oopBracket.surpriseDropoffBasisPoints / 10000;
    const appliedSurprise = fill.surpriseDropoffProbability;
    const baseChance = fill.persistenceProbability;
    const values = {
      'calendar-month': fill.inYear ? `Month ${fill.calendarMonth}` : 'Outside year',
      status: fill.status,
      'original-cohort': `${patient.bracket.id}. ${patient.bracket.label}`,
      'original-probability': probability(patient.bracket),
      'oop-distribution': fill.subfillType === 'continuing' ? 'Continuing' : 'New',
      'pre-voucher-cohort': `${fill.preVoucherBracket.id}. ${fill.preVoucherBracket.label}`,
      'subfill-probability': percent(fill.subfillProbability),
      'initial-oop': money(fill.initialOopCents),
      voucher: !eligible ? 'No' : !fill.voucherOffered ? 'Annual cap exhausted' : `${benefit.benefitType} · ${!fill.attempted ? 'Not reached' : fill.filled ? 'Applied' : 'Offered'}`,
      cap: !eligible ? '—' : benefit.benefitType === 'EB' ? 'No per-fill maximum' : money(getProduct(patient.productId).standardBuydownCents),
      'annual-before': money(fill.annualSupportBeforeCents),
      buydown: money(benefit.buydownCents),
      'annual-after': money(fill.annualSupportAfterCents),
      oop: money(benefit.effectiveOopCents),
      spend: money(fill.voucherCostCents ?? 0),
      cohort: `${behavior.id}. ${behavior.label}`,
      'persistence-type': fill.persistenceType === 'continuing' ? 'Continuing' : 'New',
      abandonment: fill.month === 1 ? abandonment(behavior) : 'Not reapplied',
      retention: `${fill.cohortRetentionPercent}%`,
      persistence: percent(baseChance),
      'oop-cohort': `${oopBracket.id}. ${oopBracket.label}`,
      'surprise-rate': percent(surpriseRate),
      'surprise-applies': surpriseApplies ? 'Yes · remaining copay' : 'No',
      surprise: percent(appliedSurprise),
      chance: percent(baseChance * (1 - appliedSurprise)),
    };
    for (const [row, value] of Object.entries(values)) {
      document.querySelector(`#fill-${row}-${fill.month}`).textContent = !fill.inYear && !['calendar-month', 'status', 'spend'].includes(row) ? '—' : value;
    }
    const status = document.querySelector(`#fill-status-${fill.month}`);
    status.dataset.filled = String(fill.filled);
    status.title = fill.status;
  }
}

function renderRevenue() {
  const wacCents = getProduct(productId()).wacCents;
  const valid = Number.isSafeInteger(wacCents);
  let run = currentBatch;
  if (!run && currentPatient) {
    run = createCohortRun(currentPatient.voucherPolicy, currentPatient.patientType, currentPatient.productId);
    addPatientToRun(run, currentPatient);
  }
  renderRevenueTab(run, wacCents, productId());
  if (!currentPatient) return;
  const amounts = valid ? calculateRevenue(currentPatient, wacCents) : null;
  document.querySelector('#revenue').textContent = amounts ? money(amounts.revenueCents) : '—';
  document.querySelector('#gtn-rate').textContent = `(${currentPatient.bracket.gtnRatePercent}%)`;
  document.querySelector('#gtn-deduction').textContent = amounts ? money(amounts.gtnDeductionCents) : '—';
  document.querySelector('#program-spend').textContent = money(currentPatient.programSpendCents);
  document.querySelector('#net-revenue').textContent = amounts ? money(amounts.netRevenueCents) : '—';
  document.querySelector('#net-revenue-after-costs').textContent = amounts ? money(amounts.netRevenueLessCogsTfCents) : '—';
  document.querySelector('#revenue-formula').textContent = amounts
    ? `${money(amounts.wacCents)} × ${currentPatient.fillCount} completed ${currentPatient.fillCount === 1 ? 'fill' : 'fills'} = ${money(amounts.revenueCents)} revenue. Less ${amounts.gtnRatePercent}% GTN (${money(amounts.gtnDeductionCents)}, starting cohort ${currentPatient.bracket.id}) and ${money(amounts.programSpendCents)} program spend = ${money(amounts.netRevenueCents)} net revenue. Less ${money(amounts.cogsCents)} COGS (1% of WAC) and ${money(amounts.tfCents)} TF ($6.50 × ${amounts.voucherFillCount} eVouchered fills) = ${money(amounts.netRevenueLessCogsTfCents)}.`
    : 'WAC is fixed by the selected product.';
  for (const fill of currentPatient.fills) {
    const revenueCents = amounts ? fill.filled ? amounts.wacCents : 0 : null;
    document.querySelector(`#fill-wac-${fill.month}`).textContent = amounts && fill.inYear ? money(amounts.wacCents) : '—';
    document.querySelector(`#fill-revenue-${fill.month}`).textContent = revenueCents === null ? '—' : money(revenueCents);
    const gtnCents = amounts ? fill.filled ? amounts.gtnPerFillCents : 0 : null;
    document.querySelector(`#fill-gtn-rate-${fill.month}`).textContent = fill.inYear ? `${currentPatient.bracket.gtnRatePercent}%` : '—';
    document.querySelector(`#fill-gtn-${fill.month}`).textContent = gtnCents === null ? '—' : money(gtnCents);
    document.querySelector(`#fill-net-revenue-${fill.month}`).textContent = revenueCents === null ? '—' : money(revenueCents - gtnCents - fill.voucherCostCents);
    const cogsCents = amounts ? fill.filled ? amounts.cogsPerFillCents : 0 : null;
    const tfCents = fill.filled && fill.voucherOffered ? 650 : 0;
    document.querySelector(`#fill-cogs-${fill.month}`).textContent = cogsCents === null ? '—' : money(cogsCents);
    document.querySelector(`#fill-tf-${fill.month}`).textContent = money(tfCents);
    document.querySelector(`#fill-net-after-costs-${fill.month}`).textContent = amounts ? money(revenueCents - gtnCents - fill.voucherCostCents - cogsCents - tfCents) : '—';
  }
}

renderRevenue();
document.querySelector('#run-batch').addEventListener('click', async () => {
  const countInput = document.querySelector('#patient-count');
  if (!countInput.reportValidity()) return;
  const patientCount = Number(countInput.value);
  const policy = { eligibleCohortIds: eligibleCohortIds() };
  const patientType = patientVolumeType();
  const selectedProduct = productId();
  const status = document.querySelector('#batch-status');
  const finishRun = beginRun();
  countInput.disabled = true;
  try {
    const run = await simulatePatientBatch({ patientCount, policy, patientType, productId: selectedProduct,
      onProgress: (completed, total) => { status.textContent = `Simulated ${completed.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} patients…`; },
    });
    currentBatch = run;
    renderRevenue();
    status.textContent = `Complete: ${patientCount.toLocaleString('en-US')} patients simulated. This run replaces the previous batch; the individual patient view is unchanged.`;
  } catch (error) {
    status.textContent = 'The batch could not complete. Previous results are retained; please retry.';
    console.error(error);
  } finally {
    countInput.disabled = false; finishRun();
  }
});

onPatientVolumeChange(type => {
  document.querySelector('#batch-status').textContent = `${type === 'continuing' ? 'Continuing' : 'New'} patients selected (monthly volume, persistence, and Initial OOP distribution). Run a new batch to apply it; existing results keep their original volume split.`;
});

function clearPatientView() {
  for (const id of ['patient-id', 'oop', 'bracket', 'patient-volume-type', 'start-month', 'max-year-fills', 'probability', 'effective-oop', 'behavior-cohort', 'abandonment', 'outcome', 'revenue', 'gtn-rate', 'gtn-deduction', 'program-spend', 'net-revenue', 'net-revenue-after-costs']) document.getElementById(id).textContent = '—';
  document.querySelector('#patient-id').textContent = 'No patient generated';
  delete document.querySelector('#outcome').dataset.outcome;
  for (const cell of document.querySelectorAll('.fill-table tbody td')) {
    cell.textContent = '—'; delete cell.dataset.filled; cell.title = '';
  }
  document.querySelector('#fill-count').textContent = '— / 12 fills';
  document.querySelector('#fill-bar').style.width = '0%';
  document.querySelector('#fill-progress').setAttribute('aria-valuenow', '0');
  document.querySelector('#fill-progress').setAttribute('aria-valuemax', '12');
  document.querySelector('#fill-progress').setAttribute('aria-valuetext', 'No patient generated');
  document.querySelector('#fill-scale-max').textContent = '12 possible fills';
  document.querySelector('#policy-summary').textContent = 'No patient generated yet.';
  document.querySelector('#year-summary').textContent = 'Generate a patient to see their year.';
  document.querySelector('#revenue-formula').textContent = 'Generate a patient to inspect the calculation.';
}
onProductChange(nextProductId => {
  snapshots.set(displayedProductId, { patient: currentPatient, batch: currentBatch });
  const previous = snapshots.get(nextProductId);
  currentPatient = previous?.patient ?? null;
  currentBatch = previous?.batch ?? null;
  displayedProductId = nextProductId;
  renderProductInfo();
  if (currentPatient) renderPatient(currentPatient); else clearPatientView();
  renderRevenue();
  document.querySelector('#batch-status').textContent = currentBatch ? `Showing saved ${getProduct(nextProductId).name} results. Run again to apply the current settings.` : 'Choose the patient count, then run the simulation.';
  document.querySelector('#revenue-eligibility-note').textContent = 'Eligibility changes apply to the next simulation.';
});
