import { getBrackets } from './cohorts.js';

import { demoData } from './demo-data.js';

export const patientQcBenchmarks = demoData['product-x'].benchmarks;
export function percentageDifference(actual, benchmark) {
  return actual == null || benchmark == null || benchmark === 0 ? null : (actual - benchmark) / benchmark * 100;
}
function totals(rows) {
  const result = { attempting: 0, filling: 0, scripts: 0 };
  for (const row of rows) for (const key of Object.keys(result)) result[key] += row[key];
  return { ...result, scriptsPerPatient: result.filling ? result.scripts / result.filling : null };
}
function compare(actual, benchmark) {
  if (!benchmark) return { attempting: null, filling: null, scripts: null, scriptsPerPatient: null };
  return Object.fromEntries(Object.keys(benchmark).map(key => [key, percentageDifference(actual[key], benchmark[key])]));
}
export function buildPatientQc(run) {
  const rows = getBrackets(run.productId).map(bracket => {
    const cohort = run.cohorts.find(item => item.bracket.id === bracket.id);
    const actual = { attempting: cohort.patientCount, filling: cohort.patientsFilling, scripts: cohort.fillCount, scriptsPerPatient: cohort.patientsFilling ? cohort.fillCount / cohort.patientsFilling : null };
    const benchmark = run.productId === 'product-x' ? patientQcBenchmarks[bracket.id] : null;
    return { bracket, actual, benchmark, differences: compare(actual, benchmark) };
  });
  const actual = totals(rows.map(row => row.actual));
  const benchmark = run.productId === 'product-x' ? totals(Object.values(patientQcBenchmarks)) : null;
  return { rows, total: { actual, benchmark, differences: compare(actual, benchmark) } };
}

export function buildMostPopulatedCohortMatrix(run) {
  const cohort = run.cohorts.reduce((largest, item) => item.patientCount > largest.patientCount ? item : largest, run.cohorts[0]);
  if (!cohort || cohort.patientCount === 0) return null;
  const rows = cohort.startMonthRows.map(row => {
    const scripts = row.calendarFills.reduce((sum, count) => sum + count, 0);
    return { ...row, calendarFills: [...row.calendarFills], maxFillsPerPatient: 13 - row.startMonth, scripts, scriptsPerPatient: row.filling ? scripts / row.filling : null };
  });
  const calendarTotals = Array.from({ length: 12 }, (_, month) => rows.reduce((sum, row) => sum + row.calendarFills[month], 0));
  const attempting = rows.reduce((sum, row) => sum + row.attempting, 0);
  const filling = rows.reduce((sum, row) => sum + row.filling, 0);
  const scripts = calendarTotals.reduce((sum, count) => sum + count, 0);
  return { bracket: cohort.bracket, rows, stopReasons: { ...cohort.stopReasons }, total: { attempting, filling, calendarFills: calendarTotals, scripts, scriptsPerPatient: filling ? scripts / filling : null }, reconciles: attempting === cohort.patientCount && filling === cohort.patientsFilling && scripts === cohort.fillCount };
}
