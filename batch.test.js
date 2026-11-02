import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVoucherPolicy, generatePatient as generateCalendarPatient } from './simulation.js';
import { createCohortRun, addPatientToRun, cohortRevenue } from './batch.js';
const generatePatient = (sequence, policy, random) => generateCalendarPatient(sequence, policy, random, random, () => 0);
const draws = (...values) => () => values.length ? values.shift() : 0.999999;

test('cohort aggregation reconciles patients, completed fills, GTN, one program-spend total, and net', () => {
  const patients = [
    generatePatient(1, defaultVoucherPolicy, () => 0.5),
    generatePatient(2, defaultVoucherPolicy, draws(0.99, 0.6, 0.99, 0, 0)),
    generatePatient(3, defaultVoucherPolicy, draws(0.5, 0.5, 0)),
    generatePatient(4, defaultVoucherPolicy, draws(0, 0.99, 0.99, 0.99)),
  ];
  const run = createCohortRun(defaultVoucherPolicy);
  patients.forEach(patient => addPatientToRun(run, patient));
  const { cohorts, totals } = cohortRevenue(run, 100000);
  const g = cohorts.find(cohort => cohort.bracket.id === 'G');
  assert.equal(g.patientCount, 2); // Includes the patient who abandoned.
  assert.equal(g.fillCount, 2);
  assert.equal(g.netRevenueCents, 91990);
  assert.equal(totals.patientCount, 4);
  assert.equal(totals.fillCount, 6);
  assert.equal(totals.revenueCents, 600000);
  assert.equal(totals.gtnDeductionCents, 230000);
  assert.equal(totals.revenuePostGtnCents, 370000);
  assert.equal(totals.programSpendCents, 347410);
  assert.equal(totals.netRevenueCents, 22590);
  assert.equal(cohorts.find(cohort => cohort.bracket.id === 'A').patientCount, 0);
  assert.equal(totals.netRevenueCents, cohorts.reduce((sum, cohort) => sum + cohort.netRevenueCents, 0));
});

test('WAC recalculation preserves batch patients, fills, program spend, and eligibility snapshot', () => {
  const policy = { eligibleCohortIds: ['G'] };
  const run = createCohortRun(policy);
  addPatientToRun(run, generatePatient(1, policy, () => 0.5));
  policy.eligibleCohortIds.length = 0;
  const original = cohortRevenue(run, 100000);
  const repriced = cohortRevenue(run, 150000);
  assert.deepEqual(run.policy.eligibleCohortIds, ['G']);
  assert.equal(repriced.totals.patientCount, original.totals.patientCount);
  assert.equal(repriced.totals.fillCount, original.totals.fillCount);
  assert.equal(repriced.totals.programSpendCents, original.totals.programSpendCents);
  assert.equal(repriced.totals.revenueCents, 300000);
  assert.equal(repriced.totals.netRevenueCents, 141990);
});
