import { generatePatient, defaultVoucherPolicy } from './simulation.js';
import { createStartMonthStats, addPatientStartMonth } from './start-month.js';

export function runStartMonthQc(sampleCount = 10000, policy = defaultVoucherPolicy, patientType = 'new') {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) throw new RangeError('QC count must be positive.');
  const stats = createStartMonthStats(patientType);
  let seed = 2027;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < sampleCount; index++) {
    const patient = generatePatient(index + 1, policy, random, random, () => (index + 0.5) / sampleCount, patientType);
    addPatientStartMonth(stats, patient);
  }
  return stats;
}
