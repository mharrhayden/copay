export const DEFAULT_PRODUCT_ID = 'ubrelvy';
export const products = Object.freeze({
  ubrelvy: Object.freeze({ id: 'ubrelvy', name: 'Ubrelvy', wacCents: 139368, standardBuydownCents: 58267, annualBuydownCapCents: 700000 }),
});
export function getProduct(id = DEFAULT_PRODUCT_ID) {
  if (!Object.hasOwn(products, id)) throw new RangeError('Unknown product.');
  return products[id];
}
