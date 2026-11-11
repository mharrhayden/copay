import { demoData } from './demo-data.js';
export const continuingPersistence = demoData['product-x'].persistence.continuing;
export const productYContinuingPersistence = demoData['product-y'].persistence.continuing;
export function getPersistenceCurve(bracket, patientType = 'new') {
  const curve = demoData[bracket.productId ?? 'product-x']?.persistence[patientType]?.[bracket.id];
  if (!curve) throw new RangeError('Unknown persistence product, type or cohort.');
  return curve;
}
