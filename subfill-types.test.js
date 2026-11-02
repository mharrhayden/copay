import test from 'node:test';
import assert from 'node:assert/strict';
import { brackets, createSubfillSchedule, selectSubfill, simulateYear, generatePatient, defaultVoucherPolicy, calculateRevenue } from './simulation.js';
import { subfillWeights } from './subfill-data.js';
import { getSubfillWeights } from './subfill-distributions.js';
import { runDistributionQc } from './qc.js';
const cohort = id => brackets.find(bracket => bracket.id === id);
const draws = (...values) => () => values.length ? values.shift() : 0.999999;

test('Continuing source labels map by dollar range and New source data is preserved', () => {
  assert.equal(getSubfillWeights('new'), subfillWeights);
  const continuing = getSubfillWeights('continuing');
  assert.equal(Object.keys(continuing).length, 17);
  assert.equal(Object.values(continuing).reduce((sum, targets) => sum + Object.keys(targets).length, 0), 147);
  assert.deepEqual(continuing.B.A.slice(0, 3), [0, 2273, 5250]);
  assert.deepEqual(continuing.C.C.slice(0, 3), [10000, 7798, 4492]);
  assert.equal(continuing.Q.Q[1], 4750); // Source AAP: $1,000.01–$1,300.
  assert.equal(continuing.R.Q[1], 432); // Source AAQ to AAP.
  assert.equal(selectSubfill(cohort('B'), 3, 0, 'continuing').subfillSourcePercent, 52.5);
  assert.equal(selectSubfill(cohort('B'), 3, 0, 'new').subfillSourcePercent, 22.8);
  assert.throws(() => getSubfillWeights('other'), RangeError);
});

test('both OOP tables preserve all normalized monthly distributions without any increasing path', () => {
  for (const type of ['new', 'continuing']) {
    for (const original of brackets) {
      const targets = getSubfillWeights(type)[original.id];
      const totals = Array.from({ length: 12 }, (_, month) => Object.values(targets).reduce((sum, weights) => sum + weights[month], 0));
      const cuts = new Set([0, 1]);
      for (let month = 0; month < 12; month++) {
        assert.ok(Math.abs(totals[month] - 10000) <= 2);
        let cumulative = 0;
        for (const weights of Object.values(targets)) { cumulative += weights[month]; cuts.add(cumulative / totals[month]); }
      }
      const sorted = [...cuts].sort((a, b) => a - b);
      const counts = Array.from({ length: 12 }, () => Object.fromEntries(brackets.map(bracket => [bracket.id, 0])));
      for (let index = 1; index < sorted.length; index++) {
        const width = sorted[index] - sorted[index - 1];
        const schedule = createSubfillSchedule(original, () => (sorted[index] + sorted[index - 1]) / 2, type);
        assert.equal(schedule[0].preVoucherBracket.id, original.id);
        schedule.forEach((fill, month) => {
          assert.equal(fill.subfillType, type);
          if (month) assert.ok(fill.initialOopCents <= schedule[month - 1].initialOopCents, `${type}, ${original.id}, fill ${month + 1}`);
          counts[month][fill.preVoucherBracket.id] += width;
        });
      }
      for (let month = 0; month < 12; month++) {
        for (const bracket of brackets) assert.ok(Math.abs(counts[month][bracket.id] - (targets[bracket.id]?.[month] ?? 0) / totals[month]) < 1e-12);
      }
    }
  }
});

test('type-specific monthly OOP affects voucher spend while keeping first-fill persistence fixed', () => {
  const make = type => generatePatient(1, defaultVoucherPolicy, draws(0, 0.99, 0, 0), () => 0.3, () => 0, type);
  const newPatient = make('new');
  const continuing = make('continuing');
  assert.equal(newPatient.fillCount, 3);
  assert.equal(continuing.fillCount, 3);
  assert.equal(newPatient.fills[2].preVoucherBracket.id, 'B');
  assert.equal(continuing.fills[2].preVoucherBracket.id, 'A');
  assert.equal(newPatient.programSpendCents, 1092);
  assert.equal(continuing.programSpendCents, 728);
  assert.equal(continuing.fills[2].subfillType, 'continuing');
  assert.equal(continuing.fills[2].persistenceType, 'continuing');
  assert.equal(continuing.fills[2].behaviorBracket.id, 'A');
  assert.equal(calculateRevenue(continuing, 100000).netRevenueLessCogsTfCents, 129322);
});

test('OOP QC samples and groups paths from the selected patient type', () => {
  const newQc = runDistributionQc(cohort('B'), 10000, 'new');
  const continuing = runDistributionQc(cohort('B'), 10000, 'continuing');
  assert.equal(newQc.counts[1].A, 915);
  assert.equal(continuing.counts[1].A, 2273);
  assert.equal(continuing.counts[2].A, 5250);
  assert.deepEqual(continuing.paths.map(path => path.count), [4750, 2977, 2273]);
  assert.equal(continuing.increasingPaths, 0);
  assert.equal(newQc.increasingPaths, 0);
  assert.equal(continuing.patientType, 'continuing');
});

test('simulateYear defaults to the selected type when no explicit OOP schedule is passed', () => {
  const fills = simulateYear(cohort('B'), defaultVoucherPolicy, draws(0.3, 0.99, 0, 0), null, 1, 'continuing');
  assert.equal(fills[2].preVoucherBracket.id, 'A');
  assert.equal(fills[2].subfillType, 'continuing');
});
