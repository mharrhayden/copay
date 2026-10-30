import { getBrackets } from './cohorts.js';

// Supplied benchmark values, including the displayed Scripts / Patient ratios.
const values = [
  ['A', 0, 0, 0, null],
  ['B', 205, 185, 409, 2.22], ['C', 122, 110, 262, 2.38],
  ['D', 260, 234, 552, 2.36], ['E', 333, 301, 683, 2.27],
  ['F', 810, 731, 1629, 2.23], ['G', 4369, 3942, 8790, 2.23],
  ['H', 1159, 1046, 2378, 2.27], ['I', 452, 407, 914, 2.24],
  ['J', 286, 258, 602, 2.33], ['K', 171, 155, 348, 2.25],
  ['L', 189, 170, 375, 2.20], ['M', 251, 227, 531, 2.34],
  ['O', 136, 123, 290, 2.36], ['P', 377, 340, 793, 2.33],
  ['Q', 440, 397, 881, 2.22], ['R', 440, 397, 868, 2.19],
];
export const patientQcBenchmarks = Object.freeze(Object.fromEntries(values.map(([id, attempting, filling, scripts, scriptsPerPatient]) => [id, Object.freeze({ attempting, filling, scripts, scriptsPerPatient })])));
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
    const benchmark = run.productId === 'ubrelvy' ? patientQcBenchmarks[bracket.id] : null;
    return { bracket, actual, benchmark, differences: compare(actual, benchmark) };
  });
  const actual = totals(rows.map(row => row.actual));
  const benchmark = run.productId === 'ubrelvy' ? totals(Object.values(patientQcBenchmarks)) : null;
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
