import { brackets } from './simulation.js';

let lower = 0;
let upper = brackets.length - 1;
const listeners = [];
const get = id => document.querySelector(`#${id}`);

export function eligibleCohortIds() {
  return brackets.slice(lower, upper + 1).map(bracket => bracket.id);
}
export function onEligibilityChange(listener) { listeners.push(listener); }

function renderBounds() {
  for (const prefix of ['sim', 'rev']) {
    const low = get(`${prefix}-lower`);
    const high = get(`${prefix}-upper`);
    low.value = String(lower); high.value = String(upper);
    // At the far-right endpoint, keep the lower handle reachable when both
    // goalposts coincide. Keyboard focus always brings either handle forward.
    low.style.zIndex = lower === upper && upper === brackets.length - 1 ? '3' : '2';
    high.style.zIndex = lower === upper && upper === brackets.length - 1 ? '2' : '3';
    low.setAttribute('aria-valuetext', `${brackets[lower].id}. ${brackets[lower].label}`);
    high.setAttribute('aria-valuetext', `${brackets[upper].id}. ${brackets[upper].label}`);
    get(`${prefix}-lower-label`).textContent = `${brackets[lower].id}. ${brackets[lower].label}`;
    get(`${prefix}-upper-label`).textContent = `${brackets[upper].id}. ${brackets[upper].label}`;
    get(`${prefix}-bounds-summary`).textContent = `${brackets[lower].id}–${brackets[upper].id} · ${upper - lower + 1} ${lower === upper ? 'cohort' : 'cohorts'}`;
    const track = get(`${prefix}-bounds-track`);
    track.style.setProperty('--lower', `${lower / (brackets.length - 1) * 100}%`);
    track.style.setProperty('--upper', `${upper / (brackets.length - 1) * 100}%`);
  }
}

for (const prefix of ['sim', 'rev']) {
  for (const bracket of brackets) {
    const tick = document.createElement('span'); tick.textContent = bracket.id;
    get(`${prefix}-bounds-ticks`).append(tick);
  }
  get(`${prefix}-lower`).addEventListener('input', event => {
    lower = Math.min(Number(event.target.value), upper);
    renderBounds(); listeners.forEach(listener => listener());
  });
  get(`${prefix}-upper`).addEventListener('input', event => {
    upper = Math.max(Number(event.target.value), lower);
    renderBounds(); listeners.forEach(listener => listener());
  });
}
renderBounds();
