import { DEFAULT_PRODUCT_ID, getProduct } from './products.js';
import { createStartMonthStats, addPatientStartMonth } from './start-month.js';
import { brackets, calculateRevenue, generatePatient } from './simulation.js';

export function createCohortRun(policy, patientType = 'new', productId = DEFAULT_PRODUCT_ID) {
  getProduct(productId);
  return {
    patientCount: 0,
    productId,
    patientType,
    startMonthStats: createStartMonthStats(patientType),
    policy: Object.freeze({ eligibleCohortIds: Object.freeze([...policy.eligibleCohortIds]) }),
    cohorts: brackets.map(bracket => ({ bracket, productId, patientCount: 0, patientsFilling: 0, fillCount: 0, voucherFillCount: 0, programSpendCents: 0,
      startMonthRows: Array.from({ length: 12 }, (_, index) => ({ startMonth: index + 1, attempting: 0, filling: 0, calendarFills: Array(12).fill(0) })),
      stopReasons: { initialAbandonment: 0, persistence: 0, copaySurprise: 0, yearEnd: 0 },
    })),
  };
}

export function addPatientToRun(run, patient) {
  if ((patient.productId ?? DEFAULT_PRODUCT_ID) !== run.productId) throw new RangeError('Patient product does not match the run.');
  const cohort = run.cohorts.find(item => item.bracket.id === patient.bracket.id);
  if (!cohort) throw new RangeError('Unknown starting cohort.');
  addPatientStartMonth(run.startMonthStats, patient);
  cohort.patientCount++;
  if (patient.fillCount > 0) cohort.patientsFilling++;
  cohort.fillCount += patient.fillCount;
  cohort.voucherFillCount += patient.voucherFillCount ?? patient.fills.filter(fill => fill.filled && fill.voucherOffered).length;
  cohort.programSpendCents += patient.programSpendCents;
  const monthRow = cohort.startMonthRows[patient.startMonth - 1];
  monthRow.attempting++;
  if (patient.fillCount > 0) monthRow.filling++;
  for (const fill of patient.fills) {
    if (fill.filled && fill.calendarMonth >= 1 && fill.calendarMonth <= 12) monthRow.calendarFills[fill.calendarMonth - 1]++;
  }
  const lastAttempt = patient.fills.findLast(fill => fill.attempted);
  if (patient.fillCount === 0) cohort.stopReasons.initialAbandonment++;
  else if (lastAttempt?.status === 'Copay surprise') cohort.stopReasons.copaySurprise++;
  else if (lastAttempt?.status === 'Stopped') cohort.stopReasons.persistence++;
  else cohort.stopReasons.yearEnd++;
  run.patientCount++;
}

export function cohortRevenue(run, wacCents) {
  const cohorts = run.cohorts.map(cohort => {
    const amounts = calculateRevenue(cohort, wacCents);
    return { ...cohort, ...amounts, revenuePostGtnCents: amounts.revenueCents - amounts.gtnDeductionCents };
  });
  const totals = { patientCount: 0, patientsFilling: 0, fillCount: 0, voucherFillCount: 0, cogsCents: 0, tfCents: 0, netRevenueLessCogsTfCents: 0, revenueCents: 0, gtnDeductionCents: 0, revenuePostGtnCents: 0, programSpendCents: 0, netRevenueCents: 0 };
  for (const cohort of cohorts) {
    for (const key of Object.keys(totals)) totals[key] += cohort[key];
  }
  return { cohorts, totals };
}

export async function simulatePatientBatch({ patientCount, policy, patientType = 'new', productId = DEFAULT_PRODUCT_ID, random = Math.random, onProgress = () => {}, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) }) {
  if (!Number.isSafeInteger(patientCount) || patientCount < 1 || patientCount > 300000) throw new RangeError('Patient count must be between 1 and 300,000.');
  const run = createCohortRun(policy, patientType, productId);
  for (let index = 0; index < patientCount; index++) {
    addPatientToRun(run, generatePatient(index + 1, run.policy, random, random, random, run.patientType, run.productId));
    if ((index + 1) % 200 === 0 || index + 1 === patientCount) {
      onProgress(index + 1, patientCount);
      await yieldControl();
    }
  }
  return run;
}
