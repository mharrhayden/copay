import test from 'node:test';
import assert from 'node:assert/strict';
import { createCohortRun, addPatientToRun, simulatePatientBatch } from './batch.js';
import { buildPatientQc, buildMostPopulatedCohortMatrix } from './patient-qc.js';
import { generatePatient, defaultVoucherPolicy } from './simulation.js';
import { getStartMonthDistribution } from './start-month.js';
const draws = (...values) => () => values.length ? values.shift() : 0;
function monthPercentile(month) {
  const distribution = getStartMonthDistribution('new');
  return distribution.slice(0, month - 1).reduce((sum, entry) => sum + entry.probability, 0) + distribution[month - 1].probability / 2;
}
function patient(month, clinical = draws(0.2, 0.99)) {
  return generatePatient(1, defaultVoucherPolicy, clinical, () => 0.999999, () => monthPercentile(month));
}

test('monthly matrix groups actual scripts by starting month and calendar month with year-end limits', () => {
  const run = createCohortRun(defaultVoucherPolicy);
  addPatientToRun(run, patient(9)); // G, four fills in September–December.
  addPatientToRun(run, patient(9, draws(0.2, 0))); // G, initial abandonment.
  addPatientToRun(run, patient(12)); // G, December only.
  const matrix = buildMostPopulatedCohortMatrix(run);
  assert.equal(matrix.bracket.id, 'G');
  const september = matrix.rows[8];
  assert.equal(september.attempting, 2);
  assert.equal(september.filling, 1);
  assert.equal(september.maxFillsPerPatient, 4);
  assert.deepEqual(september.calendarFills, [...Array(8).fill(0), 1, 1, 1, 1]);
  assert.equal(september.scripts, 4);
  assert.equal(september.scriptsPerPatient, 4);
  assert.deepEqual(matrix.rows[11].calendarFills, [...Array(11).fill(0), 1]);
  assert.equal(matrix.rows[11].maxFillsPerPatient, 1);
  assert.equal(matrix.rows[0].scriptsPerPatient, null);
  assert.equal(matrix.total.attempting, 3);
  assert.equal(matrix.total.filling, 2);
  assert.equal(matrix.total.scripts, 5);
  assert.equal(matrix.total.scriptsPerPatient, 2.5);
  assert.equal(matrix.reconciles, true);
  assert.deepEqual(matrix.stopReasons, { initialAbandonment: 1, persistence: 0, copaySurprise: 0, yearEnd: 2 });
});

test('matrix dynamically chooses the largest starting cohort rather than hardcoding G', () => {
  const run = createCohortRun(defaultVoucherPolicy);
  const makeB = () => generatePatient(1, defaultVoucherPolicy, draws(0, 0.99), () => 0.999999, () => 0.999999);
  addPatientToRun(run, patient(9));
  addPatientToRun(run, makeB()); addPatientToRun(run, makeB());
  const matrix = buildMostPopulatedCohortMatrix(run);
  assert.equal(matrix.bracket.id, 'B');
  assert.equal(matrix.total.attempting, 2);
  assert.equal(matrix.total.scripts, 2);
  assert.equal(buildMostPopulatedCohortMatrix(createCohortRun(defaultVoucherPolicy)), null);
});

test('same QC run reconciles every calendar cell, start group, cohort total, and stopping outcome', async () => {
  let seed = 90210;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const run = await simulatePatientBatch({ patientCount: 10000, policy: defaultVoucherPolicy, random, yieldControl: async () => {} });
  const matrix = buildMostPopulatedCohortMatrix(run);
  const qcRow = buildPatientQc(run).rows.find(row => row.bracket.id === matrix.bracket.id);
  assert.equal(matrix.total.attempting, qcRow.actual.attempting);
  assert.equal(matrix.total.filling, qcRow.actual.filling);
  assert.equal(matrix.total.scripts, qcRow.actual.scripts);
  assert.equal(matrix.total.scriptsPerPatient, qcRow.actual.scriptsPerPatient);
  assert.equal(Object.values(matrix.stopReasons).reduce((sum, count) => sum + count, 0), matrix.total.attempting);
  assert.equal(matrix.reconciles, true);
  for (const row of matrix.rows) {
    assert.ok(row.calendarFills.slice(0, row.startMonth - 1).every(count => count === 0));
    assert.equal(row.calendarFills[row.startMonth - 1], row.filling);
    assert.ok(row.scripts <= row.filling * row.maxFillsPerPatient);
    for (let month = row.startMonth; month < 12; month++) assert.ok(row.calendarFills[month] <= row.calendarFills[month - 1]);
  }
});

test('matrix distinguishes ordinary persistence stops from copay-surprise stops', () => {
  const run = createCohortRun(defaultVoucherPolicy);
  addPatientToRun(run, generatePatient(1, defaultVoucherPolicy, () => 0.5)); // G, ordinary stop at fill 3.
  addPatientToRun(run, generatePatient(2, defaultVoucherPolicy, draws(0.99, 0.99, 0, 0, 0.1), () => 0.999999, () => 0)); // R, surprise at fill 3.
  assert.equal(run.cohorts.find(cohort => cohort.bracket.id === 'G').stopReasons.persistence, 1);
  assert.equal(run.cohorts.find(cohort => cohort.bracket.id === 'R').stopReasons.copaySurprise, 1);
});
