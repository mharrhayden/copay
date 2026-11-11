import { DEFAULT_PRODUCT_ID, getProduct } from './products.js';
const input = document.querySelector('#product');
const listeners = [];
const busyListeners = [];
let activeRuns = 0;
export const selectedProductId = () => input.value || DEFAULT_PRODUCT_ID;
export function onProductChange(listener) { listeners.push(listener); }
export function onBusyChange(listener) { busyListeners.push(listener); }
export const isBusy = () => activeRuns > 0;
export function beginRun() {
  activeRuns++;
  updateBusy();
  return () => { activeRuns--; updateBusy(); };
}
function updateBusy() {
  input.disabled = isBusy();
  document.querySelector('#volume-type').disabled = isBusy();
  busyListeners.forEach(listener => listener());
}
input.value = DEFAULT_PRODUCT_ID;
document.documentElement.dataset.product = DEFAULT_PRODUCT_ID;
input.addEventListener('change', () => {
  const product = getProduct(selectedProductId());
  document.documentElement.dataset.product = product.id;
  listeners.forEach(listener => listener(product.id));
});
