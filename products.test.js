import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRODUCT_ID, products, getProduct } from './products.js';
import { voucherBenefit, generatePatient, defaultVoucherPolicy, calculateRevenue } from './simulation.js';
import { createCohortRun, addPatientToRun, cohortRevenue } from './batch.js';

test('Ubrelvy is the only product and provides exact WAC and standard-benefit defaults', () => {
  assert.deepEqual(Object.keys(products), ['ubrelvy']);
  assert.equal(DEFAULT_PRODUCT_ID, 'ubrelvy');
  assert.equal(getProduct().wacCents, 139368);
  assert.equal(getProduct().standardBuydownCents, 58267);
  assert.equal(getProduct().annualBuydownCapCents, 700000);
  assert.ok(Object.isFrozen(getProduct()));
  assert.throws(() => getProduct('other'), RangeError);
});

test('Ubrelvy EB has no per-fill maximum within annual support, while standard benefit caps at $582.67 without overpaying', () => {
  assert.equal(voucherBenefit(200000, 1).buydownCents, 200000);
  assert.equal(voucherBenefit(200000, 2).effectiveOopCents, 0);
  assert.equal(voucherBenefit(200000, 3).buydownCents, 58267);
  assert.equal(voucherBenefit(200000, 3).effectiveOopCents, 141733);
  assert.equal(voucherBenefit(58267, 3).effectiveOopCents, 0);
  assert.equal(voucherBenefit(58268, 3).effectiveOopCents, 1);
  assert.equal(voucherBenefit(4005, 3).buydownCents, 4005);
});

test('default product WAC flows into revenue, GTN, COGS, TF, and batch snapshots', () => {
  const patient = generatePatient(1, defaultVoucherPolicy, () => 0.5);
  assert.equal(patient.productId, 'ubrelvy');
  assert.equal(patient.fillCount, 2);
  const amounts = calculateRevenue(patient);
  assert.equal(amounts.wacCents, 139368);
  assert.equal(amounts.revenueCents, 278736);
  assert.equal(amounts.gtnDeductionCents, 139368);
  assert.equal(amounts.cogsCents, 2788);
  assert.equal(amounts.tfCents, 1300);
  assert.equal(amounts.netRevenueLessCogsTfCents, 127270);
  const run = createCohortRun(defaultVoucherPolicy);
  addPatientToRun(run, patient);
  assert.equal(run.productId, 'ubrelvy');
  assert.equal(cohortRevenue(run, 139368).totals.netRevenueLessCogsTfCents, amounts.netRevenueLessCogsTfCents);
});
