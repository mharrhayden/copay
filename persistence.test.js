import test from 'node:test';
import assert from 'node:assert/strict';
import { continuingPersistence, getPersistenceCurve } from './persistence.js';
import { brackets, continuationProbability, generatePatient, defaultVoucherPolicy, calculateRevenue } from './simulation.js';
import { runStartMonthQc } from './start-month-qc.js';
const cohort = id => brackets.find(bracket => bracket.id === id);
const draws = (...values) => () => values.length ? values.shift() : 0.999999;

const expected = `
A 100 82 65 51 40 31 24 19 15 11 8 4
B 100 75 62 49 39 31 24 19 15 11 8 5
C 100 76 59 47 37 29 22 18 14 11 7 5
D 100 67 57 45 36 28 22 17 14 10 7 5
E 100 78 55 43 34 27 21 17 13 10 7 4
F 100 76 53 42 33 26 20 16 13 9 7 4
G 100 73 51 40 32 25 19 15 12 9 6 4
H 100 71 50 39 30 23 19 15 11 8 6 3
I 100 66 48 38 29 23 18 14 11 8 6 3
J 100 67 46 36 28 22 17 14 10 8 5 3
K 100 58 45 35 27 21 17 13 10 7 5 3
L 100 71 42 33 25 20 16 12 9 7 5 3
M 100 71 36 29 24 19 16 13 10 8 7 5
O 100 67 35 27 23 19 15 12 10 8 6 4
P 100 58 33 26 22 18 14 12 9 8 6 4
Q 100 53 32 25 21 17 14 11 9 7 6 4
R 100 45 30 24 19 16 13 11 8 7 5 4`.trim().split('\n');

test('Continuing persistence exactly matches all 17 supplied curves while New keeps the original table', () => {
  for (const line of expected) {
    const [id, ...values] = line.split(' ');
    assert.deepEqual(getPersistenceCurve(cohort(id), 'continuing'), values.map(Number));
    assert.equal(getPersistenceCurve(cohort(id), 'new'), cohort(id).retention);
    assert.ok(Object.isFrozen(continuingPersistence[id]));
  }
  assert.equal(continuationProbability(cohort('A'), 2, 'new'), 0.64);
  assert.equal(continuationProbability(cohort('A'), 2, 'continuing'), 0.82);
});

test('conditional continuation reproduces cumulative retention for both types and every cohort', () => {
  for (const type of ['new', 'continuing']) {
    for (const bracket of brackets) {
      const curve = getPersistenceCurve(bracket, type);
      let survival = 1;
      for (let fill = 2; fill <= 12; fill++) {
        const chance = continuationProbability(bracket, fill, type);
        assert.ok(chance >= 0 && chance <= 1);
        survival *= chance;
        assert.ok(Math.abs(survival - curve[fill - 1] / 100) < 1e-12);
      }
    }
  }
});

test('same OOP and clinical draws produce type-specific fill outcomes using post-voucher cohort A', () => {
  const make = type => generatePatient(1, defaultVoucherPolicy, draws(0.2, 0.99, 0.7), () => 0.999999, () => 0, type);
  const newPatient = make('new');
  const continuing = make('continuing');
  assert.equal(newPatient.startMonth, 1);
  assert.equal(continuing.startMonth, 1);
  assert.equal(newPatient.fillCount, 1);
  assert.equal(continuing.fillCount, 2);
  assert.equal(continuing.fills[1].behaviorBracket.id, 'A');
  assert.equal(continuing.fills[1].cohortRetentionPercent, 82);
  assert.equal(continuing.fills[1].persistenceProbability, 0.82);
  assert.equal(continuing.fills[2].cohortRetentionPercent, 65);
  assert.equal(continuing.fills[2].persistenceProbability, 65 / 82);
  assert.equal(calculateRevenue(continuing).netRevenueLessCogsTfCents, 88690);
});

test('ineligible Continuing patients keep first-fill cohort persistence after a later OOP drop', () => {
  const patient = generatePatient(1, { eligibleCohortIds: [] }, draws(0.99, 0.99, 0.3, 0.99), () => 0.22, () => 0, 'continuing');
  assert.equal(patient.fills[1].preVoucherBracket.id, 'G');
  assert.equal(patient.fills[1].behaviorBracket.id, 'R');
  assert.equal(patient.fills[1].persistenceProbability, 0.45);
  assert.equal(patient.fills[2].persistenceProbability, 30 / 45);
});

test('Continuing can reach 12 January fills but both types still stop at December', () => {
  const make = (type, monthPercentile) => generatePatient(1, defaultVoucherPolicy, (() => { let call = 0; return () => call++ === 0 ? 0.2 : call === 2 ? 0.99 : 0; })(), () => 0.999999, () => monthPercentile, type);
  const january = make('continuing', 0);
  assert.equal(january.fillCount, 12);
  assert.equal(january.fills[11].calendarMonth, 12);
  assert.equal(january.fills[11].persistenceProbability, 4 / 8);
  assert.equal(make('new', 0).fillCount, 11);
  assert.equal(make('continuing', 0.999999).fillCount, 1);
  const stats = runStartMonthQc(10000, defaultVoucherPolicy, 'continuing');
  assert.equal(stats.outsideYearFills, 0);
  assert.equal(stats.fillLimitViolations, 0);
  assert.equal(stats.months[0].maxObservedFills, 12);
});
