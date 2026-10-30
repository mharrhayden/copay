import test from 'node:test';
import assert from 'node:assert/strict';
import { brackets } from './simulation.js';
import { distributionFor, runDistributionQc } from './qc.js';
const cohort = id => brackets.find(bracket => bracket.id === id);

test('QC exposes source percentages, normalized probabilities, and contiguous selection intervals', () => {
  const rows = distributionFor(cohort('G'), 2);
  assert.equal(rows.length, 17);
  assert.equal(rows[0].sourcePercent, 11.67);
  assert.equal(rows[0].sourceTotalPercent, 99.98);
  assert.equal(rows[0].probability, 1167 / 9998);
  assert.equal(rows[0].lower, 0);
  assert.equal(rows.at(-1).upper, 1);
  rows.forEach((row, index) => {
    if (index) assert.equal(row.lower, rows[index - 1].upper);
    assert.ok(Math.abs(row.upper - row.lower - row.probability) < 1e-12);
  });
  assert.equal(rows.find(row => row.bracket.id === 'R').probability, 0);
});

test('QC sweep exercises actual schedules and matches expected distributions with no OOP increases', () => {
  const result = runDistributionQc(cohort('R'));
  assert.equal(result.sampleCount, 10000);
  assert.equal(result.increasingPaths, 0);
  assert.ok(result.maxDifferencePp <= 0.010000001);
  result.counts.forEach((counts, month) => {
    assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 10000);
    distributionFor(cohort('R'), month + 1).forEach(row => {
      assert.ok(Math.abs(counts[row.bracket.id] / 10000 - row.probability) <= 0.000100001);
    });
  });
  assert.equal(result.counts[0].R, 10000);
});

test('QC rejects invalid fills and sample counts', () => {
  assert.throws(() => distributionFor(cohort('A'), 0), RangeError);
  assert.throws(() => distributionFor(cohort('A'), 13), RangeError);
  assert.throws(() => runDistributionQc(cohort('A'), 0), RangeError);
});
