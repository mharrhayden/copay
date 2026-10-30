import test from 'node:test';
import assert from 'node:assert/strict';
import { startMonthDistribution, getStartMonthDistribution, selectStartMonth } from './start-month.js';
import { generatePatient, calculateRevenue, defaultVoucherPolicy } from './simulation.js';
import { runStartMonthQc } from './start-month-qc.js';
import { createCohortRun, addPatientToRun, cohortRevenue } from './batch.js';
const draws = (...values) => () => values.length ? values.shift() : 0;
const monthPercentile = month => startMonthDistribution.slice(0, month - 1).reduce((sum, entry) => sum + entry.probability, 0) + startMonthDistribution[month - 1].probability / 2;
const makePatient = month => generatePatient(1, defaultVoucherPolicy, draws(0.2, 0.99), () => 0.999999, () => monthPercentile(month));

test('both supplied starting-month tables are preserved and normalize their rounded weights', () => {
  const expectedByType = {
    new: [761,775,845,859,828,814,858,852,851,944,814,800],
    continuing: [4499,1873,1156,733,502,373,280,199,147,115,71,54],
  };
  for (const [type, expected] of Object.entries(expectedByType)) {
    assert.deepEqual(getStartMonthDistribution(type).map(entry => Math.round(entry.sourcePercent * 100)), expected);
    const total = expected.reduce((sum, value) => sum + value, 0);
    const counts = Array(12).fill(0);
    for (let ticket = 0; ticket < total; ticket++) counts[selectStartMonth((ticket + 0.5) / total, type).month - 1]++;
    assert.deepEqual(counts, expected);
    assert.equal(selectStartMonth(0, type).month, 1);
    assert.equal(selectStartMonth(0.999999999, type).month, 12);
  }
  for (const value of [-1, 1, NaN]) assert.throws(() => selectStartMonth(value), RangeError);
});

test('every starting month caps fills at December with no decisions or spending after year-end', () => {
  for (let month = 1; month <= 12; month++) {
    const patient = makePatient(month);
    assert.equal(patient.startMonth, month);
    assert.equal(patient.maxFillsInYear, 13 - month);
    assert.equal(patient.fillCount, Math.min(13 - month, 11)); // Supplied curve reaches zero at fill 12.
    for (const fill of patient.fills) {
      assert.equal(fill.calendarMonth, month + fill.month - 1);
      if (fill.calendarMonth > 12) {
        assert.equal(fill.status, 'Outside year');
        assert.equal(fill.filled, false);
        assert.equal(fill.attempted, false);
        assert.equal(fill.baseDraw, undefined);
        assert.equal(fill.voucherCostCents, 0);
      }
    }
  }
});

test('September allows four fills and counts EB by patient fill number, not calendar month', () => {
  const patient = makePatient(9);
  assert.equal(patient.fillCount, 4);
  assert.deepEqual(patient.fills.filter(fill => fill.filled).map(fill => fill.calendarMonth), [9, 10, 11, 12]);
  assert.deepEqual(patient.fills.slice(0, 4).map(fill => fill.benefitType), ['EB', 'EB', 'Standard', 'Standard']);
  assert.equal(patient.programSpendCents, 4 * 4005);
  const amounts = calculateRevenue(patient, 100000);
  assert.equal(amounts.revenueCents, 400000);
  assert.equal(amounts.gtnDeductionCents, 200000);
  assert.equal(amounts.netRevenueCents, 183980);
  const december = makePatient(12);
  assert.equal(december.fillCount, 1);
  assert.equal(december.programSpendCents, 4005);
  assert.equal(calculateRevenue(december, 100000).revenueCents, 100000);
});

test('calendar QC verifies actual generated patients against start-month volume and fill limits', () => {
  const stats = runStartMonthQc();
  assert.equal(stats.patientCount, 10000);
  assert.equal(stats.outsideYearFills, 0);
  assert.equal(stats.fillLimitViolations, 0);
  assert.equal(stats.months.reduce((sum, month) => sum + month.patientCount, 0), 10000);
  for (const month of stats.months) {
    assert.ok(Math.abs(month.patientCount / 10000 - month.probability) <= 0.0001);
    assert.ok(month.maxObservedFills <= month.maxFillsInYear);
    assert.ok(month.completedFills <= month.patientCount * month.maxFillsInYear);
  }
});

test('actual batch start-month QC reconciles to cohort fills and financial totals', () => {
  const run = createCohortRun(defaultVoucherPolicy);
  addPatientToRun(run, makePatient(9));
  addPatientToRun(run, makePatient(12));
  const stats = run.startMonthStats;
  assert.equal(stats.months[8].patientCount, 1);
  assert.equal(stats.months[8].maxObservedFills, 4);
  assert.equal(stats.months[11].patientCount, 1);
  assert.equal(stats.months[11].maxObservedFills, 1);
  const amounts = cohortRevenue(run, 100000);
  assert.equal(amounts.totals.fillCount, 5);
  assert.equal(stats.months.reduce((sum, month) => sum + month.completedFills, 0), amounts.totals.fillCount);
  assert.equal(amounts.totals.revenueCents, 500000);
});
