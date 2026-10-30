import test from 'node:test';
import assert from 'node:assert/strict';
import { patientQcBenchmarks, percentageDifference, buildPatientQc } from './patient-qc.js';
import { createCohortRun, simulatePatientBatch } from './batch.js';
import { defaultVoucherPolicy } from './simulation.js';

test('supplied cohort benchmarks are preserved and totals use the filling-patient denominator', () => {
  const qc = buildPatientQc(createCohortRun(defaultVoucherPolicy));
  assert.equal(qc.rows.length, 17);
  assert.deepEqual(patientQcBenchmarks.B, { attempting: 205, filling: 185, scripts: 409, scriptsPerPatient: 2.22 });
  assert.equal(patientQcBenchmarks.G.scripts, 8790);
  assert.equal(patientQcBenchmarks.R.scriptsPerPatient, 2.19);
  assert.equal(qc.total.benchmark.attempting, 10000);
  assert.equal(qc.total.benchmark.filling, 9023);
  assert.equal(qc.total.benchmark.scripts, 20305);
  assert.equal(qc.total.benchmark.scriptsPerPatient, 20305 / 9023);
});

test('comparison uses supplied ratios, signed percentage differences, and undefined zero denominators', () => {
  const run = createCohortRun(defaultVoucherPolicy);
  Object.assign(run.cohorts.find(cohort => cohort.bracket.id === 'B'), { patientCount: 205, patientsFilling: 185, fillCount: 409 });
  const qc = buildPatientQc(run);
  const b = qc.rows.find(row => row.bracket.id === 'B');
  assert.equal(b.actual.scriptsPerPatient, 409 / 185);
  assert.equal(b.differences.attempting, 0);
  assert.equal(b.differences.scriptsPerPatient, (409 / 185 - 2.22) / 2.22 * 100);
  assert.equal(qc.rows[0].differences.attempting, null);
  assert.equal(qc.rows.find(row => row.bracket.id === 'C').differences.scripts, -100);
  assert.equal(qc.rows.find(row => row.bracket.id === 'C').differences.scriptsPerPatient, null);
  assert.equal(qc.total.actual.scriptsPerPatient, 409 / 185);
  assert.equal(percentageDifference(120, 100), 20);
  assert.equal(percentageDifference(80, 100), -20);
  assert.equal(percentageDifference(0, 0), null);
});

test('10,000-patient QC executes the batch model, reports progress, and counts scripts per filling patient', async () => {
  let completed = 0;
  const run = await simulatePatientBatch({ patientCount: 10000, policy: defaultVoucherPolicy, random: () => 0.5, yieldControl: async () => {}, onProgress: value => { completed = value; } });
  const qc = buildPatientQc(run);
  const g = qc.rows.find(row => row.bracket.id === 'G');
  assert.equal(completed, 10000);
  assert.equal(g.actual.attempting, 10000);
  assert.equal(g.actual.filling, 10000);
  assert.equal(g.actual.scripts, 20000);
  assert.equal(g.actual.scriptsPerPatient, 2);
  assert.equal(qc.total.actual.attempting, 10000);
  assert.equal(qc.total.actual.scripts, 20000);
  assert.equal(run.startMonthStats.outsideYearFills, 0);
});

test('batch runner snapshots eligibility and validates counts for revenue and QC callers', async () => {
  const policy = { eligibleCohortIds: ['G'] };
  const run = await simulatePatientBatch({ patientCount: 400, policy, random: () => 0.5, yieldControl: async () => {}, onProgress: () => { policy.eligibleCohortIds.length = 0; } });
  assert.equal(buildPatientQc(run).total.actual.scripts, 800);
  assert.deepEqual(run.policy.eligibleCohortIds, ['G']);
  for (const patientCount of [0, 1.5, 300001]) await assert.rejects(simulatePatientBatch({ patientCount, policy }), RangeError);
});
