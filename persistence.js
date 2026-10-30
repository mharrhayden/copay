const continuing = {
  A: [100,82,65,51,40,31,24,19,15,11,8,4],
  B: [100,75,62,49,39,31,24,19,15,11,8,5],
  C: [100,76,59,47,37,29,22,18,14,11,7,5],
  D: [100,67,57,45,36,28,22,17,14,10,7,5],
  E: [100,78,55,43,34,27,21,17,13,10,7,4],
  F: [100,76,53,42,33,26,20,16,13,9,7,4],
  G: [100,73,51,40,32,25,19,15,12,9,6,4],
  H: [100,71,50,39,30,23,19,15,11,8,6,3],
  I: [100,66,48,38,29,23,18,14,11,8,6,3],
  J: [100,67,46,36,28,22,17,14,10,8,5,3],
  K: [100,58,45,35,27,21,17,13,10,7,5,3],
  L: [100,71,42,33,25,20,16,12,9,7,5,3],
  M: [100,71,36,29,24,19,16,13,10,8,7,5],
  O: [100,67,35,27,23,19,15,12,10,8,6,4],
  P: [100,58,33,26,22,18,14,12,9,8,6,4],
  Q: [100,53,32,25,21,17,14,11,9,7,6,4],
  R: [100,45,30,24,19,16,13,11,8,7,5,4],
};
export const continuingPersistence = Object.freeze(Object.fromEntries(Object.entries(continuing).map(([id, curve]) => [id, Object.freeze(curve)])));

export function getPersistenceCurve(bracket, patientType = 'new') {
  if (patientType === 'new') return bracket.retention;
  if (patientType === 'continuing' && continuingPersistence[bracket.id]) return continuingPersistence[bracket.id];
  throw new RangeError('Unknown persistence type or cohort.');
}
