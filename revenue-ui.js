import { getProduct } from './products.js';
import { getBrackets } from './simulation.js';
import { cohortRevenue } from './batch.js';
const get = id => document.querySelector(`#${id}`);
const money = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact',
  minimumFractionDigits: Math.abs(cents) >= 100000 ? 1 : 0,
  maximumFractionDigits: Math.abs(cents) >= 100000 ? 1 : 0,
}).format(cents / 100);
const exactMoney = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const count = value => value.toLocaleString('en-US');

export function renderRevenueTab(run, wacCents, productId = run?.productId ?? 'product-x') {
  const brackets = getBrackets(productId);
  const heading = get('cohort-revenue-heading'); heading.replaceChildren();
  for (const label of ['Metric', ...brackets.map(bracket => `${bracket.id}. ${bracket.label}`), 'Total']) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; heading.append(th);
  }
  const body = get('cohort-revenue-body'); body.replaceChildren();
  const financial = wacCents === null || !run ? null : cohortRevenue(run, wacCents);
  const rows = [
    ['Patients attempting', 'patientCount', false], ['Patients filling', 'patientsFilling', false], ['Fills', 'fillCount', false],
    ['Gross Revenue', 'revenueCents', true], ['GTN', 'gtnDeductionCents', true],
    ['Revenue post GTN', 'revenuePostGtnCents', true], ['Program spend', 'programSpendCents', true],
    ['Net revenue', 'netRevenueCents', true],
    ['Net revenue less COGS and TF', 'netRevenueLessCogsTfCents', true],
  ];
  for (const [label, key, isMoney] of rows) {
    const tr = document.createElement('tr');
    if (key === 'revenueCents') tr.className = 'gross-revenue-row';
    if (key === 'netRevenueLessCogsTfCents') tr.className = 'revenue-net-after-costs';
    if (key === 'netRevenueCents') tr.className = 'revenue-net-total';
    const th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.append(th);
    const rawTotal = run ? run.cohorts.reduce((sum, item) => sum + (item[key] ?? 0), 0) : null;
    for (let index = 0; index <= brackets.length; index++) {
      const isTotal = index === brackets.length;
      const raw = run ? isTotal ? rawTotal : run.cohorts[index][key] : null;
      const value = financial ? isTotal ? financial.totals[key] : financial.cohorts[index][key] : key === 'patientCount' || key === 'patientsFilling' || key === 'fillCount' || key === 'programSpendCents' ? raw : null;
      const td = document.createElement('td'); td.textContent = value == null ? '—' : isMoney ? money(value) : count(value);
      if (isMoney && value != null) td.title = exactMoney(value);
      if (isTotal) td.className = 'cohort-total';
      if (key === 'gtnDeductionCents' && !isTotal) td.title = `${brackets[index].gtnRatePercent}% GTN from the starting cohort${value == null ? '' : ` · ${exactMoney(value)}`}`;
      if (key === 'netRevenueLessCogsTfCents' && financial) {
        const detail = isTotal ? financial.totals : financial.cohorts[index];
        td.title = `${exactMoney(value)} after COGS (1% of WAC): ${exactMoney(detail.cogsCents)}, and TF ($6.50 × ${count(detail.voucherFillCount)} eVouchered fills): ${exactMoney(detail.tfCents)}`;
      }
      tr.append(td);
    }
    body.append(tr);
  }
  get('overview-patients').textContent = run ? count(run.patientCount) : '—';
  get('overview-fills').textContent = financial ? count(financial.totals.fillCount) : '—';
  get('overview-net').textContent = financial ? exactMoney(financial.totals.netRevenueLessCogsTfCents) : '—';
  get('revenue-patient').textContent = run
    ? `${getProduct(run.productId).name} · ${run.patientType === 'continuing' ? 'Continuing' : 'New'} patients · ${count(run.patientCount)} simulated, grouped by starting OOP cohort.`
    : 'Explore how patient costs, eVoucher support, and completed fills shape annual revenue.';
  get('batch-policy').textContent = run
    ? `Eligibility used for these results: ${run.policy.eligibleCohortIds.length === brackets.length ? 'all starting cohorts' : run.policy.eligibleCohortIds.length ? run.policy.eligibleCohortIds.join(', ') : 'no cohorts'}. WAC is fixed by product.`
    : 'Set the eligible cohort range above, then run a simulation to compare results.';
}
