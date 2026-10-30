import { DEFAULT_PRODUCT_ID, getProduct } from './products.js';
import { getPersistenceCurve } from './persistence.js';
import { selectStartMonth } from './start-month.js';
import { getSubfillWeights } from './subfill-distributions.js';

const surpriseDropoffBasisPoints = Object.freeze({ A: 0, B: 711, C: 711, D: 1301, E: 1301, F: 1607, G: 2231, H: 2445, I: 3197, J: 4052, K: 4778, L: 4942, M: 4942, O: 5606, P: 5752, Q: 6122, R: 6122 });
const gtnRates2027 = Object.freeze({ A: 55, B: 55, C: 54, D: 53, E: 52, F: 50, G: 50, H: 49, I: 48, J: 47, K: 44, L: 40, M: 38, O: 37, P: 36, Q: 30, R: 25 });
export const brackets = Object.freeze([
  ['A', '$0', 0, 0, 978, [100, 64, 27, 17, 11, 8, 5, 3, 2, 1, 1, 0]],
  ['B', '$0.01 – $5', 20, 364, 1672, [100, 57, 28, 18, 11, 7, 4, 3, 2, 1, 1, 0]],
  ['C', '$5.01 – $10', 12, 953, 2342, [100, 50, 27, 17, 10, 7, 4, 3, 2, 1, 1, 0]],
  ['D', '$10.01 – $15', 26, 1450, 2361, [100, 46, 26, 16, 10, 7, 4, 3, 1, 1, 1, 0]],
  ['E', '$15.01 – $20', 33, 1919, 2506, [100, 47, 25, 16, 10, 7, 4, 3, 1, 1, 1, 0]],
  ['F', '$20.01 – $25', 81, 2438, 2535, [100, 47, 24, 15, 9, 6, 4, 2, 1, 1, 1, 0]],
  ['G', '$25.01 – $50', 437, 4005, 2917, [100, 44, 23, 14, 8, 5, 4, 2, 1, 1, 0, 0]],
  ['H', '$50.01 – $100', 116, 7420, 4852, [100, 42, 20, 12, 9, 6, 4, 2, 2, 1, 1, 0]],
  ['I', '$100.01 – $200', 45, 15707, 6382, [100, 31, 20, 12, 8, 6, 4, 2, 2, 1, 1, 0]],
  ['J', '$200.01 – $300', 29, 23772, 7619, [100, 34, 19, 11, 8, 6, 4, 2, 2, 1, 1, 0]],
  ['K', '$300.01 – $400', 17, 34296, 7983, [100, 27, 17, 11, 7, 5, 4, 2, 2, 1, 1, 0]],
  ['L', '$400.01 – $500', 19, 46642, 7983, [100, 26, 16, 10, 7, 5, 3, 2, 2, 1, 1, 0]],
  ['M', '$500.01 – $600', 25, 54721, 8062, [100, 30, 16, 10, 6, 4, 3, 2, 2, 1, 0, 0]],
  ['O', '$600.01 – $800', 14, 67773, 8062, [100, 22, 15, 9, 6, 4, 3, 2, 1, 1, 0, 0]],
  ['P', '$800.01 – $1,000', 38, 90310, 8101, [100, 25, 14, 9, 6, 4, 3, 2, 1, 1, 0, 0]],
  ['Q', '$1,000.01 – $1,300', 44, 106775, 8809, [100, 28, 13, 8, 5, 4, 3, 2, 1, 1, 0, 0]],
  ['R', '$1,300+', 44, 165808, 8809, [100, 22, 12, 7, 5, 3, 2, 2, 1, 1, 0, 0]],
].map(([id, label, weight, oopCents, abandonmentBasisPoints, retention]) => Object.freeze({ id, label, weight, oopCents, abandonmentBasisPoints, retention: Object.freeze(retention), surpriseDropoffBasisPoints: surpriseDropoffBasisPoints[id], gtnRatePercent: gtnRates2027[id] })));

function validateDraw(draw) {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Draw must be in [0, 1).');
}

export function selectBracket(draw = Math.random()) {
  validateDraw(draw);
  const ticket = Math.floor(draw * 1000);
  let cumulative = 0;
  for (const bracket of brackets) {
    cumulative += bracket.weight;
    if (ticket < cumulative) return bracket;
  }
  throw new Error('Invalid distribution.');
}

export function selectOutcome(bracket, draw = Math.random()) {
  validateDraw(draw);
  return Math.floor(draw * 10000) < bracket.abandonmentBasisPoints ? 'Abandoned' : 'Filled';
}

export const defaultVoucherPolicy = Object.freeze({
  eligibleCohortIds: Object.freeze(brackets.map(bracket => bracket.id)),
});

const upperBoundsCents = [0, 500, 1000, 1500, 2000, 2500, 5000, 10000, 20000, 30000, 40000, 50000, 60000, 80000, 100000, 130000, Infinity];

export function bracketForOop(oopCents) {
  if (!Number.isSafeInteger(oopCents) || oopCents < 0) throw new RangeError('OOP must be nonnegative integer cents.');
  return brackets[upperBoundsCents.findIndex(upper => oopCents <= upper)];
}

export function validateVoucherPolicy(policy) {
  if (Object.keys(policy).some(key => key !== 'eligibleCohortIds')) throw new RangeError('Only cohort eligibility is configurable.');
  if (!Array.isArray(policy.eligibleCohortIds) || policy.eligibleCohortIds.some(id => !brackets.some(bracket => bracket.id === id))) throw new RangeError('Unknown eligible cohort.');
}

// Convert cumulative retention to a conditional chance of continuing at this
// fill: S(m) / S(m-1), always using the first fill’s post-eVoucher cohort.
export function continuationProbability(bracket, fill, patientType = 'new') {
  if (!Number.isInteger(fill) || fill < 2 || fill > 12) throw new RangeError('Continuation fill must be 2–12.');
  const curve = getPersistenceCurve(bracket, patientType);
  const previous = curve[fill - 2];
  return previous === 0 ? 0 : curve[fill - 1] / previous;
}

// EB covers the first two fills in full. Product standard benefit is a per-fill cap,
// subject to the remaining annual support balance and never more than the OOP.
export function voucherBenefit(oopCents, fill, eligible = true, productId = DEFAULT_PRODUCT_ID, annualRemainingCents = getProduct(productId).annualBuydownCapCents) {
  if (!Number.isSafeInteger(oopCents) || oopCents < 0) throw new RangeError('OOP must be nonnegative integer cents.');
  if (!Number.isInteger(fill) || fill < 1 || fill > 12) throw new RangeError('Fill must be 1–12.');
  const product = getProduct(productId);
  if (!Number.isSafeInteger(annualRemainingCents) || annualRemainingCents < 0 || annualRemainingCents > product.annualBuydownCapCents) throw new RangeError('Invalid annual support balance.');
  const benefitType = eligible ? fill <= 2 ? 'EB' : 'Standard' : null;
  const scheduledBuydownCents = eligible ? Math.min(oopCents, fill <= 2 ? oopCents : product.standardBuydownCents) : 0;
  const buydownCents = Math.min(scheduledBuydownCents, annualRemainingCents);
  return Object.freeze({ benefitType, scheduledBuydownCents, annualCapLimited: buydownCents < scheduledBuydownCents, buydownCents, effectiveOopCents: oopCents - buydownCents });
}

// These are per-fill distributions conditioned on the ORIGINAL cohort, not
// transitions conditioned on the immediately previous fill's sampled cohort.
export function selectSubfill(originalBracket, month, draw = Math.random(), patientType = 'new') {
  validateDraw(draw);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Fill must be 1–12.');
  const destinations = getSubfillWeights(patientType)[originalBracket.id];
  if (!destinations) throw new RangeError('Missing original-cohort subfill distribution.');
  const total = Object.values(destinations).reduce((sum, weights) => sum + weights[month - 1], 0);
  let cumulative = 0;
  for (const [id, weights] of Object.entries(destinations)) {
    const weight = weights[month - 1];
    cumulative += weight;
    if (draw * total < cumulative) {
      return Object.freeze({ month, subfillType: patientType, subfillPercentile: draw, preVoucherBracket: brackets.find(bracket => bracket.id === id), initialOopCents: brackets.find(bracket => bracket.id === id).oopCents, subfillProbability: weight / total, subfillSourcePercent: weight / 100, subfillTotalPercent: total / 100 });
    }
  }
  throw new Error('Invalid subfill weights.');
}

export function createSubfillSchedule(originalBracket, random = Math.random, patientType = 'new') {
  // The source columns shift toward lower OOP over time. Reusing one percentile
  // couples them into a nonincreasing path while preserving every marginal
  // distribution, unlike independent redraws or clipping higher outcomes.
  const percentile = random();
  validateDraw(percentile);
  // Fill 1 is the already-selected original cohort; no second cohort draw.
  return Object.freeze(Array.from({ length: 12 }, (_, index) => selectSubfill(originalBracket, index + 1, index === 0 ? 0 : percentile, patientType)));
}

export function simulateYear(bracket, policy = defaultVoucherPolicy, random = Math.random, schedule = null, startMonth = 1, patientType = 'new', productId = DEFAULT_PRODUCT_ID) {
  validateVoucherPolicy(policy);
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) throw new RangeError('Starting month must be 1–12.');
  schedule ??= createSubfillSchedule(bracket, random, patientType);
  const draw = () => { const value = random(); validateDraw(value); return value; };
  const eligible = policy.eligibleCohortIds.includes(bracket.id);
  const behaviorBracket = bracketForOop(voucherBenefit(schedule[0].initialOopCents, 1, eligible, productId).effectiveOopCents);
  const persistenceCurve = getPersistenceCurve(behaviorBracket, patientType);
  const fills = [];
  let annualRemainingCents = getProduct(productId).annualBuydownCapCents;
  let stopped = false;
  for (const planned of schedule) {
    const { month, initialOopCents } = planned;
    const voucherOffered = eligible && annualRemainingCents > 0;
    const { benefitType, scheduledBuydownCents, annualCapLimited, buydownCents, effectiveOopCents } = voucherBenefit(initialOopCents, month, eligible, productId, annualRemainingCents);
    const oopBracket = bracketForOop(effectiveOopCents);
    const persistenceProbability = month === 1 ? 1 - behaviorBracket.abandonmentBasisPoints / 10000 : continuationProbability(behaviorBracket, month, patientType);
    const copaySurprise = month > 1 && effectiveOopCents > 0;
    const surpriseDropoffProbability = copaySurprise ? oopBracket.surpriseDropoffBasisPoints / 10000 : 0;
    const decisionProbability = persistenceProbability * (1 - surpriseDropoffProbability);
    const inputs = { ...planned, persistenceType: patientType, cohortRetentionPercent: persistenceCurve[month - 1], previousCohortRetentionPercent: month > 1 ? persistenceCurve[month - 2] : null, calendarMonth: startMonth + month - 1, inYear: startMonth + month - 1 <= 12, annualSupportBeforeCents: annualRemainingCents, voucherOffered, benefitType, scheduledBuydownCents, annualCapLimited, buydownCents, effectiveOopCents, oopBracket, behaviorBracket, persistenceProbability, copaySurprise, surpriseDropoffProbability, decisionProbability };
    if (!inputs.inYear) {
      fills.push(Object.freeze({ ...inputs, attempted: false, filled: false, status: 'Outside year', annualSupportAfterCents: annualRemainingCents, voucherCostCents: 0, surpriseDraw: null, surpriseDropped: false }));
      continue;
    }
    if (stopped) {
      fills.push(Object.freeze({ ...inputs, attempted: false, filled: false, status: 'Not reached', annualSupportAfterCents: annualRemainingCents, voucherCostCents: 0, surpriseDraw: null, surpriseDropped: false }));
      continue;
    }
    const baseDraw = draw();
    const persisted = month === 1 ? selectOutcome(behaviorBracket, baseDraw) === 'Filled' : baseDraw < persistenceProbability;
    const surpriseDraw = persisted && copaySurprise ? draw() : null;
    const surpriseDropped = surpriseDraw !== null && Math.floor(surpriseDraw * 10000) < oopBracket.surpriseDropoffBasisPoints;
    const filled = persisted && !surpriseDropped;
    const status = filled ? 'Filled' : month === 1 ? 'Abandoned' : surpriseDropped ? 'Copay surprise' : 'Stopped';
    annualRemainingCents -= filled ? buydownCents : 0;
    fills.push(Object.freeze({ ...inputs, annualSupportAfterCents: annualRemainingCents, attempted: true, filled, status, surpriseDropped, baseDraw, surpriseDraw, voucherCostCents: filled ? buydownCents : 0 }));
    stopped = !filled;
  }
  return Object.freeze(fills);
}

export function generatePatient(sequence, policy = defaultVoucherPolicy, random = Math.random, subfillRandom = random, startMonthRandom = random, patientType = 'new', productId = DEFAULT_PRODUCT_ID) {
  const startingMonth = selectStartMonth(startMonthRandom(), patientType);
  const bracket = selectBracket(random());
  const voucherPolicy = Object.freeze({ ...policy, eligibleCohortIds: Object.freeze([...policy.eligibleCohortIds]) });
  const schedule = createSubfillSchedule(bracket, subfillRandom, patientType);
  const fills = simulateYear(bracket, voucherPolicy, random, schedule, startingMonth.month, patientType, productId);
  const programSpendCents = fills.reduce((total, fill) => total + fill.voucherCostCents, 0);
  const voucherFillCount = fills.filter(fill => fill.filled && fill.voucherOffered).length;
  const outcome = fills[0].filled ? 'Filled' : 'Abandoned';
  return Object.freeze({ id: `Patient ${String(sequence).padStart(4, '0')}`, bracket, oopCents: bracket.oopCents, productId, patientType, startMonth: startingMonth.month, startMonthProbability: startingMonth.probability, maxFillsInYear: startingMonth.maxFillsInYear, outcome, fillCount: fills.filter(fill => fill.filled).length, fills, voucherPolicy, programSpendCents, voucherFillCount, annualSupportCapCents: getProduct(productId).annualBuydownCapCents, annualSupportRemainingCents: fills.at(-1).annualSupportAfterCents });
}

export function calculateRevenue(patient, wacCents = getProduct(patient.productId ?? DEFAULT_PRODUCT_ID).wacCents) {
  if (!Number.isSafeInteger(wacCents) || wacCents < 0) throw new RangeError('WAC must be nonnegative integer cents.');
  const revenueCents = wacCents * patient.fillCount;
  const gtnRatePercent = patient.bracket.gtnRatePercent;
  // Round GTN to cents for each completed fill so monthly and annual math agree.
  const gtnPerFillCents = Number((BigInt(wacCents) * BigInt(gtnRatePercent) + 50n) / 100n);
  const gtnDeductionCents = gtnPerFillCents * patient.fillCount;
  const netRevenueCents = revenueCents - gtnDeductionCents - patient.programSpendCents;
  const voucherFillCount = patient.voucherFillCount ?? patient.fills?.filter(fill => fill.filled && fill.voucherOffered).length ?? 0;
  const cogsPerFillCents = Number((BigInt(wacCents) + 50n) / 100n);
  const cogsCents = cogsPerFillCents * patient.fillCount;
  const tfPerVoucherFillCents = 650;
  const tfCents = tfPerVoucherFillCents * voucherFillCount;
  const netRevenueLessCogsTfCents = netRevenueCents - cogsCents - tfCents;
  if (!Number.isSafeInteger(netRevenueLessCogsTfCents)) throw new RangeError('Net revenue exceeds supported precision.');
  if (!Number.isSafeInteger(revenueCents) || !Number.isSafeInteger(netRevenueCents)) throw new RangeError('Revenue exceeds supported precision.');
  return Object.freeze({ wacCents, revenueCents, gtnRatePercent, gtnPerFillCents, gtnDeductionCents, programSpendCents: patient.programSpendCents, netRevenueCents, voucherFillCount, cogsPerFillCents, cogsCents, tfPerVoucherFillCents, tfCents, netRevenueLessCogsTfCents });
}
