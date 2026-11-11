import { demoData } from './demo-data.js';
export const DEFAULT_PRODUCT_ID = 'product-x';
export const products = Object.freeze(Object.fromEntries(Object.entries(demoData).map(([id, data]) => [id, data.product])));
export function getProduct(id = DEFAULT_PRODUCT_ID) {
  if (!Object.hasOwn(products, id)) throw new RangeError('Unknown product.');
  return products[id];
}
