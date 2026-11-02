const surpriseDropoffBasisPoints = Object.freeze({ A: 0, B: 711, C: 711, D: 1301, E: 1301, F: 1607, G: 2231, H: 2445, I: 3197, J: 4052, K: 4778, L: 4942, M: 4942, O: 5606, P: 5752, Q: 6122, R: 6122 });
const gtnRates2027 = Object.freeze({ A: 55, B: 55, C: 54, D: 53, E: 52, F: 50, G: 50, H: 49, I: 48, J: 47, K: 44, L: 40, M: 38, O: 37, P: 36, Q: 30, R: 25 });
const ubrelvyBrackets = Object.freeze([
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
].map(([id, label, weight, oopCents, abandonmentBasisPoints, retention]) => Object.freeze({ id, label, weight, oopCents, abandonmentBasisPoints, retention: Object.freeze(retention), surpriseDropoffBasisPoints: surpriseDropoffBasisPoints[id], gtnRatePercent: gtnRates2027[id], productId: 'ubrelvy' })));


// Qulipta has 16 distinct ranges; its final cohort includes all OOP over $1,000.
const quliptaLabels = ['$0', '$0.01 – $5', '$5.01 – $10', '$10.01 – $15', '$15.01 – $20', '$20.01 – $25', '$25.01 – $50', '$50.01 – $100', '$100.01 – $200', '$200.01 – $300', '$300.01 – $400', '$400.01 – $500', '$500.01 – $600', '$600.01 – $800', '$800.01 – $1,000', '$1,000+'];
const quliptaIds = [...'ABCDEFGHIJKLMOPQ'];
const quliptaWeights = [0,33,26,27,42,73,424,124,73,24,11,12,22,17,8,83];
const quliptaOop = [0,348,929,1452,1927,2454,4001,7281,14455,23672,33943,47769,55151,64345,94839,111404];
const quliptaAbandonment = [790,1205,1532,2357,2668,2668,3139,5000,5959,7452,8147,8167,8167,8294,8294,8985];
const quliptaSurprise = [0,667,1193,1205,1534,1534,1790,2628,2828,3620,3620,3812,4607,4607,4974,5911];
const quliptaRetention = [[100, 77, 54, 39, 29, 22, 16, 11, 8, 5, 3, 1], [100, 72, 45, 34, 27, 22, 18, 14, 12, 9, 6, 3], [100, 73, 43, 32, 26, 21, 17, 13, 11, 8, 5, 2], [100, 71, 41, 31, 25, 20, 16, 13, 11, 8, 5, 2], [100, 64, 39, 30, 24, 19, 15, 12, 10, 7, 5, 2], [100, 60, 37, 28, 23, 18, 15, 12, 10, 7, 5, 2], [100, 61, 40, 29, 22, 17, 12, 9, 6, 4, 3, 1], [100, 56, 39, 26, 19, 15, 11, 9, 6, 4, 2, 1], [100, 49, 36, 25, 18, 14, 10, 8, 5, 4, 2, 1], [100, 53, 34, 23, 17, 13, 10, 8, 5, 3, 2, 1], [100, 59, 34, 24, 16, 12, 9, 7, 4, 3, 2, 1], [100, 47, 31, 22, 15, 11, 8, 6, 4, 3, 2, 1], [100, 33, 29, 20, 14, 10, 7, 6, 4, 2, 2, 1], [100, 43, 28, 19, 13, 9, 7, 5, 4, 2, 1, 1], [100, 32, 25, 17, 12, 8, 6, 5, 3, 2, 1, 1], [100, 31, 22, 15, 11, 8, 6, 4, 3, 2, 1, 0]];
const quliptaBrackets = Object.freeze(quliptaIds.map((id, index) => Object.freeze({
  id, productId: 'qulipta', label: quliptaLabels[index], weight: quliptaWeights[index], oopCents: quliptaOop[index],
  abandonmentBasisPoints: quliptaAbandonment[index], surpriseDropoffBasisPoints: quliptaSurprise[index],
  gtnRatePercent: index <= 6 ? 66 : index <= 11 ? 59 : 48,
  retention: Object.freeze(quliptaRetention[index]),
})));
export function getBrackets(productId = 'ubrelvy') {
  if (productId === 'ubrelvy') return ubrelvyBrackets;
  if (productId === 'qulipta') return quliptaBrackets;
  throw new RangeError('Unknown product.');
}
export const brackets = ubrelvyBrackets;
export function getDefaultVoucherPolicy(productId = 'ubrelvy') {
  return Object.freeze({ eligibleCohortIds: Object.freeze(getBrackets(productId).map(bracket => bracket.id)) });
}
