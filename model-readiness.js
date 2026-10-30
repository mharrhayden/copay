import { getProduct } from './products.js';
import { getBrackets } from './cohorts.js';
import { getPersistenceCurve } from './persistence.js';
import { getSubfillWeights } from './subfill-distributions.js';
export function hasPatientData(productId, patientType) {
  try {
    const weights = getSubfillWeights(patientType, productId);
    return getBrackets(productId).every(bracket => weights[bracket.id] && getPersistenceCurve(bracket, patientType)?.length === 12);
  } catch { return false; }
}
export function missingModelInputs(productId, patientType) {
  const product = getProduct(productId);
  const missing = [];
  if (!Number.isSafeInteger(product.wacCents)) missing.push('fixed WAC');
  if (![product.standardBuydownCents, product.annualBuydownCapCents, product.expandedBenefitFills].every(Number.isSafeInteger)) missing.push('eVoucher benefit limits');
  if (!hasPatientData(productId, patientType)) missing.push(`${patientType === 'new' ? 'New' : 'Continuing'} OOP and persistence tables`);
  return missing;
}
