const ids = ['volume-type'];
let selected = 'new';
const listeners = [];
export const patientVolumeType = () => selected;
export function onPatientVolumeChange(listener) { listeners.push(listener); }
for (const id of ids) {
  const input = document.querySelector(`#${id}`); input.value = selected;
  input.addEventListener('change', () => {
    selected = input.value;
    for (const target of ids) document.querySelector(`#${target}`).value = selected;
    listeners.forEach(listener => listener(selected));
  });
}
