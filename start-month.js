const volumeWeights = Object.freeze({
  new: Object.freeze([761, 775, 845, 859, 828, 814, 858, 852, 851, 944, 814, 800]),
  continuing: Object.freeze([4499, 1873, 1156, 733, 502, 373, 280, 199, 147, 115, 71, 54]),
});
const quliptaWeights = Object.freeze({
  new: Object.freeze([793,763,820,849,809,791,857,850,872,975,815,806]),
  continuing: Object.freeze([6209,1701,1020,408,202,140,99,73,55,44,28,20]),
});
export const startMonthDistributions = Object.freeze(Object.fromEntries(Object.entries(volumeWeights).map(([type, weights]) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return [type, Object.freeze(weights.map((weight, index) => Object.freeze({ month: index + 1, sourcePercent: weight / 100, probability: weight / total, maxFillsInYear: 12 - index })))];
})));
const quliptaStartMonthDistributions = Object.freeze(Object.fromEntries(Object.entries(quliptaWeights).map(([type, weights]) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return [type, Object.freeze(weights.map((weight, index) => Object.freeze({ month: index + 1, sourcePercent: weight / 100, probability: weight / total, maxFillsInYear: 12 - index })))];
})));
export function getStartMonthDistribution(patientType = 'new', productId = 'ubrelvy') {
  if (!['ubrelvy', 'qulipta'].includes(productId)) throw new RangeError('Unknown product.');
  const distribution = (productId === 'qulipta' ? quliptaStartMonthDistributions : startMonthDistributions)[patientType];
  if (!distribution) throw new RangeError('Patient volume must be New or Continuing.');
  return distribution;
}
export const startMonthDistribution = startMonthDistributions.new;

export function selectStartMonth(draw = Math.random(), patientType = 'new', productId = 'ubrelvy') {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Start month draw must be in [0, 1).');
  const distribution = getStartMonthDistribution(patientType, productId);
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.probability;
    if (draw < cumulative) return entry;
  }
  return distribution.at(-1); // Floating-point endpoint protection.
}

export function createStartMonthStats(patientType = 'new', productId = 'ubrelvy') {
  return {
    patientType,
    productId,
    patientCount: 0,
    outsideYearFills: 0,
    fillLimitViolations: 0,
    months: getStartMonthDistribution(patientType, productId).map(entry => ({ ...entry, patientCount: 0, completedFills: 0, maxObservedFills: 0 })),
  };
}

export function addPatientStartMonth(stats, patient) {
  if ((patient.patientType ?? 'new') !== stats.patientType) throw new RangeError('Patient volume type does not match the run.');
  if ((patient.productId ?? 'ubrelvy') !== (stats.productId ?? 'ubrelvy')) throw new RangeError('Patient product does not match starting-month statistics.');
  const entry = stats.months[patient.startMonth - 1];
  if (!entry) throw new RangeError('Unknown patient starting month.');
  stats.patientCount++;
  entry.patientCount++;
  entry.completedFills += patient.fillCount;
  entry.maxObservedFills = Math.max(entry.maxObservedFills, patient.fillCount);
  stats.outsideYearFills += patient.fills.filter(fill => fill.filled && (fill.calendarMonth < 1 || fill.calendarMonth > 12)).length;
  if (patient.fillCount > entry.maxFillsInYear) stats.fillLimitViolations++;
}
