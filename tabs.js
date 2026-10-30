const tabs = ['revenue-tab', 'simulation-tab', 'patient-qc-tab'].map(id => document.querySelector(`#${id}`));
function activate(index) {
  tabs.forEach((tab, position) => {
    tab.setAttribute('aria-selected', String(position === index));
    tab.tabIndex = position === index ? 0 : -1;
    document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = position !== index;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(index));
  tab.addEventListener('keydown', event => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
    if (next !== null) { event.preventDefault(); activate(next); tabs[next].focus(); }
  });
});
