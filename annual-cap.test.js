import test from 'node:test';
import assert from 'node:assert/strict';
import { brackets, voucherBenefit, createSubfillSchedule, simulateYear, generatePatient, defaultVoucherPolicy, calculateRevenue } from './simulation.js';
import { createCohortRun, addPatientToRun, cohortRevenue } from './batch.js';
const draws = (...values) => () => values.length ? values.shift() : 0.999999;
function highCostPatient(failPartialOffer = false, startMonthDraw = 0) {
  const clinical = [0.99, 0];
  for (let fill = 3; fill <= 12; fill++) clinical.push(0, failPartialOffer && fill === 9 ? 0.1 : 0.99);
  return generatePatient(1, defaultVoucherPolicy, draws(0.99, ...clinical), () => 0.999999, () => startMonthDraw, 'continuing');
}

test('normal and EB benefits are both limited to the remaining annual support balance', () => {
  const standard = voucherBenefit(165808, 3, true, 'ubrelvy', 18782);
  assert.equal(standard.scheduledBuydownCents, 58267);
  assert.equal(standard.buydownCents, 18782);
  assert.equal(standard.effectiveOopCents, 147026);
  assert.equal(standard.annualCapLimited, true);
  assert.equal(voucherBenefit(800000, 1).buydownCents, 700000);
  assert.equal(voucherBenefit(800000, 1).effectiveOopCents, 100000);
  assert.equal(voucherBenefit(165808, 3, true, 'ubrelvy', 0).buydownCents, 0);
  assert.throws(() => voucherBenefit(1000, 1, true, 'ubrelvy', -1), RangeError);
  assert.throws(() => voucherBenefit(1000, 1, true, 'ubrelvy', 700001), RangeError);
});

test('patient can use the final partial voucher but never exceed $7,000, including EB', () => {
  const patient = highCostPatient();
  assert.equal(patient.fillCount, 12);
  assert.equal(patient.programSpendCents, 700000);
  assert.equal(patient.annualSupportRemainingCents, 0);
  assert.equal(patient.fills[7].annualSupportAfterCents, 18782);
  const partial = patient.fills[8];
  assert.equal(partial.voucherCostCents, 18782);
  assert.equal(partial.annualSupportBeforeCents, 18782);
  assert.equal(partial.annualSupportAfterCents, 0);
  assert.equal(partial.effectiveOopCents, 147026);
  assert.equal(partial.oopBracket.id, 'R');
  assert.equal(partial.surpriseDropoffProbability, 0.6122);
  assert.equal(partial.behaviorBracket.id, 'A');
  const exhausted = patient.fills[9];
  assert.equal(exhausted.voucherOffered, false);
  assert.equal(exhausted.voucherCostCents, 0);
  assert.equal(exhausted.effectiveOopCents, 165808);
  assert.equal(exhausted.surpriseDropoffProbability, 0.6122);
  assert.equal(patient.voucherFillCount, 9);
  assert.equal(calculateRevenue(patient).tfCents, 5850);
  assert.equal(calculateRevenue(patient).netRevenueLessCogsTfCents, 531734);
});

test('a partial offer that causes abandonment does not consume annual balance or incur TF', () => {
  const patient = highCostPatient(true);
  assert.equal(patient.fillCount, 8);
  assert.equal(patient.programSpendCents, 681218);
  assert.equal(patient.annualSupportRemainingCents, 18782);
  const last = patient.fills[8];
  assert.equal(last.status, 'Copay surprise');
  assert.equal(last.buydownCents, 18782);
  assert.equal(last.voucherCostCents, 0);
  assert.equal(last.annualSupportAfterCents, last.annualSupportBeforeCents);
  assert.equal(patient.voucherFillCount, 8);
});

test('an EB fill can exhaust the annual cap and later fills use the remaining copay for surprise', () => {
  const bracket = brackets.find(item => item.id === 'R');
  const schedule = createSubfillSchedule(bracket, () => 0.999999, 'continuing').map(fill => ({ ...fill, initialOopCents: 800000 }));
  const fills = simulateYear(bracket, defaultVoucherPolicy, draws(0.99, 0, 0.99), schedule, 1, 'continuing');
  assert.equal(fills[0].voucherCostCents, 700000);
  assert.equal(fills[0].effectiveOopCents, 100000);
  assert.equal(fills[0].behaviorBracket.id, 'P');
  assert.equal(fills[1].benefitType, 'EB');
  assert.equal(fills[1].voucherOffered, false);
  assert.equal(fills[1].effectiveOopCents, 800000);
  assert.equal(fills[1].surpriseDropoffProbability, 0.6122);
  assert.equal(fills.reduce((sum, fill) => sum + fill.voucherCostCents, 0), 700000);
});

test('cap is per patient, never shared across a cohort, and year-end still blocks later support', () => {
  const run = createCohortRun(defaultVoucherPolicy, 'continuing');
  addPatientToRun(run, highCostPatient()); addPatientToRun(run, highCostPatient());
  assert.equal(cohortRevenue(run, 139368).totals.programSpendCents, 1400000);
  const december = highCostPatient(false, 0.999999);
  assert.equal(december.fillCount, 1);
  assert.equal(december.programSpendCents, 165808);
  assert.equal(december.annualSupportRemainingCents, 534192);
  assert.ok(december.fills.slice(1).every(fill => !fill.attempted && fill.voucherCostCents === 0 && fill.annualSupportAfterCents === 534192));
});

test('all randomized ledgers reconcile support usage, fees, and annual limits for both patient types', () => {
  let seed = 123456;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const type of ['new', 'continuing']) {
    for (let index = 0; index < 2000; index++) {
      const patient = generatePatient(index + 1, defaultVoucherPolicy, random, random, random, type);
      assert.ok(patient.programSpendCents <= 700000);
      let balance = 700000;
      for (const fill of patient.fills) {
        assert.equal(fill.annualSupportBeforeCents, balance);
        assert.equal(fill.annualSupportAfterCents, balance - fill.voucherCostCents);
        balance = fill.annualSupportAfterCents;
        assert.ok(balance >= 0);
      }
      assert.equal(patient.programSpendCents, 700000 - balance);
      assert.equal(calculateRevenue(patient).tfCents, patient.fills.filter(fill => fill.filled && fill.voucherOffered).length * 650);
    }
  }
});
