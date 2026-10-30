import { brackets, createSubfillSchedule } from './simulation.js';
import { getSubfillWeights } from './subfill-distributions.js';

export function distributionFor(original, fill, patientType = 'new') {
  if (!Number.isInteger(fill) || fill < 1 || fill > 12) throw new RangeError('Invalid QC cohort or fill.');
  const subfillWeights = getSubfillWeights(patientType);
  if (!subfillWeights[original.id]) throw new RangeError('Invalid QC cohort or fill.');
  const weights = subfillWeights[original.id];
  const total = Object.values(weights).reduce((sum, row) => sum + row[fill - 1], 0);
  let cumulative = 0;
  return brackets.map(bracket => {
    const weight = weights[bracket.id]?.[fill - 1] ?? 0;
    const lower = cumulative / total;
    cumulative += weight;
    return { bracket, sourcePercent: weight / 100, probability: weight / total, lower, upper: cumulative / total, sourceTotalPercent: total / 100 };
  });
}

export function runDistributionQc(original, sampleCount = 10000, patientType = 'new') {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) throw new RangeError('QC sample count must be positive.');
  const counts = Array.from({ length: 12 }, () => Object.fromEntries(brackets.map(bracket => [bracket.id, 0])));
  let increasingPaths = 0;
  const groupedPaths = new Map();
  for (let index = 0; index < sampleCount; index++) {
    const percentile = (index + 0.5) / sampleCount;
    const schedule = createSubfillSchedule(original, () => percentile, patientType);
    let increased = false;
    schedule.forEach((fill, month) => {
      counts[month][fill.preVoucherBracket.id]++;
      if (month && fill.initialOopCents > schedule[month - 1].initialOopCents) increased = true;
    });
    if (increased) increasingPaths++;
    const key = schedule.map(fill => fill.preVoucherBracket.id).join('→');
    if (!groupedPaths.has(key)) groupedPaths.set(key, {
      cohorts: schedule.map(fill => fill.preVoucherBracket.id),
      oopCents: schedule.map(fill => fill.initialOopCents),
      count: 0,
      hasIncrease: increased,
    });
    groupedPaths.get(key).count++;
  }
  let maxDifferencePp = 0;
  for (let fill = 1; fill <= 12; fill++) {
    for (const row of distributionFor(original, fill, patientType)) {
      maxDifferencePp = Math.max(maxDifferencePp, Math.abs(counts[fill - 1][row.bracket.id] / sampleCount - row.probability) * 100);
    }
  }
  return { patientType, sampleCount, counts, increasingPaths, maxDifferencePp, paths: [...groupedPaths.values()].sort((a, b) => b.count - a.count) };
}
