import { getBrackets } from './cohorts.js';
import { selectedProductId, onProductChange } from './product-ui.js';
let brackets = getBrackets(selectedProductId());
let lower = 0;
let upper = brackets.length - 1;
const listeners = [];
const get = id => document.querySelector(`#${id}`);
export function eligibleCohortIds() { return brackets.slice(lower, upper + 1).map(bracket => bracket.id); }
export function onEligibilityChange(listener) { listeners.push(listener); }
function renderBounds() {
  const max = brackets.length - 1;
  for (const prefix of ['sim', 'rev']) {
    const low = get(`${prefix}-lower`);
    const high = get(`${prefix}-upper`);
    low.max = high.max = String(max);
    low.value = String(lower); high.value = String(upper);
    low.style.zIndex = lower === upper && upper === max ? '3' : '2';
    high.style.zIndex = lower === upper && upper === max ? '2' : '3';
    low.setAttribute('aria-valuetext', `${brackets[lower].id}. ${brackets[lower].label}`);
    high.setAttribute('aria-valuetext', `${brackets[upper].id}. ${brackets[upper].label}`);
    get(`${prefix}-lower-label`).textContent = `${brackets[lower].id}. ${brackets[lower].label}`;
    get(`${prefix}-upper-label`).textContent = `${brackets[upper].id}. ${brackets[upper].label}`;
    get(`${prefix}-bounds-summary`).textContent = `${brackets[lower].id}–${brackets[upper].id} · ${upper - lower + 1} ${lower === upper ? 'cohort' : 'cohorts'}`;
    const track = get(`${prefix}-bounds-track`);
    track.style.setProperty('--lower', `${lower / max * 100}%`);
    track.style.setProperty('--upper', `${upper / max * 100}%`);
  }
}
function renderTicks() {
  for (const prefix of ['sim', 'rev']) {
    const ticks = get(`${prefix}-bounds-ticks`);
    ticks.replaceChildren();
    ticks.style.gridTemplateColumns = `repeat(${brackets.length}, 1fr)`;
    for (const bracket of brackets) {
      const tick = document.createElement('span'); tick.textContent = bracket.id; ticks.append(tick);
    }
  }
}
for (const prefix of ['sim', 'rev']) {
  get(`${prefix}-lower`).addEventListener('input', event => {
    lower = Math.min(Number(event.target.value), upper);
    renderBounds(); listeners.forEach(listener => listener());
  });
  get(`${prefix}-upper`).addEventListener('input', event => {
    upper = Math.max(Number(event.target.value), lower);
    renderBounds(); listeners.forEach(listener => listener());
  });
}
onProductChange(productId => {
  brackets = getBrackets(productId); lower = 0; upper = brackets.length - 1;
  renderTicks(); renderBounds();
});
renderTicks(); renderBounds();
