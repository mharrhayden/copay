import test from 'node:test';
import assert from 'node:assert/strict';
import { brackets, selectBracket, selectOutcome, continuationProbability, bracketForOop, voucherBenefit, simulateYear, calculateRevenue, defaultVoucherPolicy } from './simulation.js';
import { getPersistenceCurve } from './persistence.js';
import { getSubfillWeights } from './subfill-distributions.js';
const cohort = id => brackets.find(item => item.id === id);
// Explicit constant-cost schedules isolate clinical and financial rules from the
// two source OOP tables that were not present in the conversation export.
const scheduleFor = bracket => Array.from({length: 12}, (_, index) => ({ month: index + 1, preVoucherBracket: bracket, initialOopCents: bracket.oopCents }));

test('all 1,000 tickets reproduce the supplied starting OOP probabilities', () => {
  const counts = Object.fromEntries(brackets.map(bracket => [bracket.id, 0]));
  for (let ticket = 0; ticket < 1000; ticket++) counts[selectBracket((ticket + 0.5) / 1000).id]++;
  for (const bracket of brackets) assert.equal(counts[bracket.id], bracket.weight);
  assert.equal(selectBracket(0).id, 'B');
  assert.equal(selectBracket(0.999999).id, 'R');
});

test('all supplied abandonment probabilities are reproduced at basis-point precision', () => {
  const expected = [978,1672,2342,2361,2506,2535,2917,4852,6382,7619,7983,7983,8062,8062,8101,8809,8809];
  for (const [index, bracket] of brackets.entries()) {
    let abandoned = 0;
    for (let ticket = 0; ticket < 10000; ticket++) if (selectOutcome(bracket, (ticket + 0.5) / 10000) === 'Abandoned') abandoned++;
    assert.equal(abandoned, expected[index]);
  }
});

test('conditional continuation reproduces New and Continuing cumulative persistence curves', () => {
  for (const type of ['new', 'continuing']) for (const bracket of brackets) {
    let survival = 1;
    const curve = getPersistenceCurve(bracket, type);
    for (let fill = 2; fill <= 12; fill++) {
      const chance = continuationProbability(bracket, fill, type);
      assert.ok(chance >= 0 && chance <= 1);
      survival *= chance;
      assert.ok(Math.abs(survival - curve[fill - 1] / 100) < 1e-12);
    }
  }
});

test('first-fill assistance precedes abandonment and abandoned offers do not spend', () => {
  const bracket = cohort('G');
  const schedule = scheduleFor(bracket);
  const assisted = simulateYear(bracket, defaultVoucherPolicy, () => 0.2, schedule);
  const unassisted = simulateYear(bracket, {eligibleCohortIds: []}, () => 0.2, schedule);
  assert.equal(assisted[0].filled, true);
  assert.equal(assisted[0].behaviorBracket.id, 'A');
  assert.equal(assisted[0].voucherCostCents, 4005);
  assert.equal(unassisted[0].status, 'Abandoned');
  assert.ok(unassisted.every(fill => !fill.filled && fill.voucherCostCents === 0));
  const abandoned = simulateYear(bracket, defaultVoucherPolicy, () => 0, schedule);
  assert.equal(abandoned[0].status, 'Abandoned');
  assert.equal(abandoned[0].annualSupportAfterCents, 700000);
  assert.ok(abandoned.slice(1).every(fill => !fill.attempted));
});

test('annual cap is exact, partial vouchers count once, and exhausted support incurs no fee', () => {
  const bracket = cohort('R');
  // Explicit per-fill draw sequence: first abandonment, then continuation/surprise.
  const values = [0.99,0];
  for (let fill = 3; fill <= 12; fill++) values.push(0,0.99);
  const ledger = simulateYear(bracket, defaultVoucherPolicy, () => values.shift(), scheduleFor(bracket), 1, 'continuing');
  assert.ok(ledger.every(fill => fill.filled));
  assert.equal(ledger.reduce((sum, fill) => sum + fill.voucherCostCents, 0), 700000);
  assert.equal(ledger[8].voucherCostCents, 18782);
  assert.equal(ledger[9].voucherOffered, false);
  assert.equal(ledger[9].surpriseDropoffProbability, 0.6122);
  assert.equal(ledger.at(-1).annualSupportAfterCents, 0);
  const amounts = calculateRevenue({bracket, fillCount: 12, programSpendCents: 700000, voucherFillCount: 9, productId: 'ubrelvy'});
  assert.equal(amounts.tfCents, 5850);
  assert.equal(amounts.netRevenueLessCogsTfCents, 531734);
});

test('December permits one fill and never spends or draws for out-of-year fills', () => {
  let calls = 0;
  const bracket = cohort('G');
  const fills = simulateYear(bracket, defaultVoucherPolicy, () => {calls++; return 0.99;}, scheduleFor(bracket), 12, 'continuing');
  assert.equal(calls, 1);
  assert.equal(fills[0].voucherCostCents, 4005);
  assert.ok(fills.slice(1).every(fill => fill.status === 'Outside year' && !fill.attempted && fill.voucherCostCents === 0));
});

test('WAC repricing preserves support costs and applies starting-cohort GTN and exact fees', () => {
  const patient = {bracket: cohort('G'), fillCount: 2, programSpendCents: 8010, voucherFillCount: 2, productId: 'ubrelvy'};
  const original = calculateRevenue(patient, 100000);
  const repriced = calculateRevenue(patient, 150000);
  assert.equal(original.netRevenueCents, 91990);
  assert.equal(repriced.netRevenueCents, 141990);
  assert.equal(original.programSpendCents, repriced.programSpendCents);
  assert.equal(original.tfCents, 1300);
  assert.equal(original.cogsCents, 2000);
});

test('OOP cohort boundaries and invalid draws are checked', () => {
  assert.equal(bracketForOop(0).id, 'A');
  assert.equal(bracketForOop(500).id, 'B');
  assert.equal(bracketForOop(501).id, 'C');
  assert.equal(bracketForOop(130001).id, 'R');
  for (const draw of [-1, 1, NaN, Infinity]) assert.throws(() => selectBracket(draw), RangeError);
  assert.throws(() => voucherBenefit(1000, 1, true, 'ubrelvy', -1), RangeError);
});

test('both patient types have complete, distinct, immutable OOP source tables', () => {
  const newWeights = getSubfillWeights('new');
  const continuingWeights = getSubfillWeights('continuing');
  assert.notEqual(newWeights, continuingWeights);
  for (const weights of [newWeights, continuingWeights]) {
    assert.deepEqual(Object.keys(weights), brackets.map(bracket => bracket.id));
    assert.ok(Object.isFrozen(weights));
    for (const destinations of Object.values(weights)) {
      assert.ok(Object.isFrozen(destinations));
      for (const values of Object.values(destinations)) {
        assert.equal(values.length, 12);
        assert.ok(Object.isFrozen(values));
      }
    }
  }
});
