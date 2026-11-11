import { demoData } from './demo-data.js';
export function getBrackets(productId = 'product-x') {
  if (!Object.hasOwn(demoData, productId)) throw new RangeError('Unknown product.');
  return demoData[productId].brackets;
}
export const brackets = getBrackets();
export function getDefaultVoucherPolicy(productId = 'product-x') {
  return Object.freeze({ eligibleCohortIds: Object.freeze(getBrackets(productId).map(bracket => bracket.id)) });
}
