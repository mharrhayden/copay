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

// Supplied Qulipta Continuing cumulative persistence, conditional on fill 1.
const quliptaContinuing = {
  "A": [
    100,
    96,
    93,
    83,
    76,
    70,
    64,
    57,
    51,
    46,
    37,
    22
  ],
  "B": [
    100,
    92,
    90,
    80,
    73,
    67,
    62,
    55,
    50,
    44,
    36,
    21
  ],
  "C": [
    100,
    90,
    80,
    74,
    69,
    64,
    60,
    56,
    51,
    45,
    37,
    22
  ],
  "D": [
    100,
    89,
    77,
    71,
    66,
    62,
    58,
    53,
    49,
    43,
    35,
    21
  ],
  "E": [
    100,
    90,
    74,
    68,
    63,
    59,
    55,
    51,
    46,
    41,
    34,
    20
  ],
  "F": [
    100,
    87,
    71,
    65,
    61,
    57,
    53,
    49,
    45,
    40,
    32,
    20
  ],
  "G": [
    100,
    86,
    71,
    65,
    60,
    54,
    50,
    45,
    41,
    35,
    29,
    17
  ],
  "H": [
    100,
    86,
    69,
    62,
    57,
    52,
    47,
    42,
    38,
    33,
    27,
    16
  ],
  "I": [
    100,
    77,
    66,
    60,
    55,
    50,
    45,
    40,
    37,
    32,
    26,
    15
  ],
  "J": [
    100,
    77,
    63,
    57,
    52,
    47,
    43,
    38,
    35,
    30,
    24,
    15
  ],
  "K": [
    100,
    79,
    64,
    55,
    48,
    43,
    38,
    35,
    31,
    27,
    22,
    13
  ],
  "L": [
    100,
    78,
    61,
    52,
    45,
    41,
    36,
    33,
    30,
    25,
    21,
    12
  ],
  "M": [
    100,
    79,
    57,
    48,
    43,
    38,
    34,
    31,
    28,
    24,
    20,
    11
  ],
  "O": [
    100,
    66,
    54,
    46,
    41,
    37,
    32,
    30,
    27,
    23,
    19,
    11
  ],
  "P": [
    100,
    58,
    51,
    43,
    38,
    34,
    30,
    28,
    25,
    21,
    17,
    10
  ],
  "Q": [
    100,
    60,
    47,
    40,
    35,
    32,
    28,
    26,
    23,
    20,
    16,
    9
  ]
};
export const quliptaContinuingPersistence = Object.freeze(Object.fromEntries(Object.entries(quliptaContinuing).map(([id, curve]) => [id, Object.freeze(curve)])));

export function getPersistenceCurve(bracket, patientType = 'new') {
  if (bracket.productId === 'qulipta') {
    if (patientType === 'new') return bracket.retention;
    if (patientType === 'continuing' && quliptaContinuingPersistence[bracket.id]) return quliptaContinuingPersistence[bracket.id];
    throw new RangeError('Unknown Qulipta persistence type or cohort.');
  }
  if (patientType === 'new') return bracket.retention;
  if (patientType === 'continuing' && continuingPersistence[bracket.id]) return continuingPersistence[bracket.id];
  throw new RangeError('Unknown persistence type or cohort.');
}
