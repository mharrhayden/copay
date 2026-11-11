import { demoData } from './demo-data.js';
function distributions(productId) {
  const data = demoData[productId];
  if (!data) throw new RangeError('Unknown product.');
  return Object.freeze(Object.fromEntries(Object.entries(data.months).map(([type, weights]) => {
    const total = weights.reduce((sum, value) => sum + value, 0);
    return [type, Object.freeze(weights.map((weight, index) => Object.freeze({ month: index + 1, sourcePercent: weight / 100, probability: weight / total, maxFillsInYear: 12 - index })))];
  })));
}
const byProduct = Object.freeze(Object.fromEntries(Object.keys(demoData).map(id => [id, distributions(id)])));
export const startMonthDistributions = byProduct['product-x'];
export const startMonthDistribution = startMonthDistributions.new;
export function getStartMonthDistribution(patientType = 'new', productId = 'product-x') {
  const distribution = byProduct[productId]?.[patientType];
  if (!distribution) throw new RangeError('Unknown product or patient type.');
  return distribution;
}

export function selectStartMonth(draw = Math.random(), patientType = 'new', productId = 'product-x') {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Start month draw must be in [0, 1).');
  const distribution = getStartMonthDistribution(patientType, productId);
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.probability;
    if (draw < cumulative) return entry;
  }
  return distribution.at(-1); // Floating-point endpoint protection.
}

export function createStartMonthStats(patientType = 'new', productId = 'product-x') {
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
  if ((patient.productId ?? 'product-x') !== (stats.productId ?? 'product-x')) throw new RangeError('Patient product does not match starting-month statistics.');
  const entry = stats.months[patient.startMonth - 1];
  if (!entry) throw new RangeError('Unknown patient starting month.');
  stats.patientCount++;
  entry.patientCount++;
  entry.completedFills += patient.fillCount;
  entry.maxObservedFills = Math.max(entry.maxObservedFills, patient.fillCount);
  stats.outsideYearFills += patient.fills.filter(fill => fill.filled && (fill.calendarMonth < 1 || fill.calendarMonth > 12)).length;
  if (patient.fillCount > entry.maxFillsInYear) stats.fillLimitViolations++;
}
