import { getProduct } from './products.js';
import { getBrackets } from './cohorts.js';
import { getPersistenceCurve } from './persistence.js';
import { getSubfillWeights } from './subfill-distributions.js';
export function missingPatientInputs(productId, patientType) {
  const missing = [];
  const brackets = getBrackets(productId);
  try {
    const weights = getSubfillWeights(patientType, productId);
    if (!brackets.every(bracket => weights[bracket.id])) missing.push('OOP distributions');
  } catch { missing.push('OOP distributions'); }
  try {
    if (!brackets.every(bracket => getPersistenceCurve(bracket, patientType)?.length === 12)) missing.push('persistence curves');
  } catch { missing.push('persistence curves'); }
  return missing;
}
export function hasPatientData(productId, patientType) {
  return missingPatientInputs(productId, patientType).length === 0;
}
export function missingModelInputs(productId, patientType) {
  const product = getProduct(productId);
  const missing = [];
  if (!Number.isSafeInteger(product.wacCents)) missing.push('fixed WAC');
  if (![product.standardBuydownCents, product.annualBuydownCapCents, product.expandedBenefitFills].every(Number.isSafeInteger)) missing.push('eVoucher benefit limits');
  const type = patientType === 'new' ? 'New' : 'Continuing';
  missing.push(...missingPatientInputs(productId, patientType).map(input => `${type} ${input}`));
  return missing;
}
