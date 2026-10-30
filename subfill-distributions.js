import { subfillWeights } from './subfill-data.js';
import { continuingSubfillWeights } from './continuing-subfill-data.js';

export function getSubfillWeights(patientType = 'new') {
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
