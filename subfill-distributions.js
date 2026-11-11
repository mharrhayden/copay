import { productYContinuingSubfillWeights } from './product-y-continuing-subfill-data.js';
import { productYSubfillWeights } from './product-y-subfill-data.js';
import { subfillWeights } from './subfill-data.js';
import { continuingSubfillWeights } from './continuing-subfill-data.js';

export function getSubfillWeights(patientType = 'new', productId = 'product-x') {
  if (productId === 'product-y') {
    if (patientType === 'new') return productYSubfillWeights;
    if (patientType === 'continuing') return productYContinuingSubfillWeights;
    throw new RangeError('Unknown subsequent-fill OOP distribution type.');
  }
  if (productId !== 'product-x') throw new RangeError('Unknown product.');
  if (patientType === 'new') {
    if (!Object.keys(subfillWeights).length) throw new Error('Missing New patient OOP table: restore subfill-data.js from the original Baseline Subfills Table.');
    return subfillWeights;
  }
  if (patientType === 'continuing') {
    if (!Object.keys(continuingSubfillWeights).length) throw new Error('Missing Continuing patient OOP table: restore continuing-subfill-data.js from the original Continuing Pts Distribution.');
    return continuingSubfillWeights;
  }
  throw new RangeError('Unknown subsequent-fill OOP distribution type.');
}
