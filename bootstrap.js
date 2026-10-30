import { subfillWeights } from './subfill-data.js';
import { continuingSubfillWeights } from './continuing-subfill-data.js';

try {
  await import('./app.js');
  const { onPatientVolumeChange, patientVolumeType } = await import('./volume-ui.js');
  const available = {
    new: Object.keys(subfillWeights).length === 17,
    continuing: Object.keys(continuingSubfillWeights).length === 17,
  };
  for (const option of document.querySelector('#volume-type').options) {
    option.disabled = !available[option.value];
    if (!available[option.value]) option.textContent += ' (data needed)';
  }
  function updateAvailability() {
    const unavailable = !available[patientVolumeType()];
    const notice = document.querySelector('#recovery-notice');
    notice.hidden = available.new && available.continuing;
    notice.textContent = available.new && !available.continuing
      ? 'New patient simulation is available. Continuing patient simulation needs its separate OOP distribution table.'
      : 'Patient simulation needs the original OOP distribution table for the selected patient type.';
    for (const id of ['generate', 'run-batch', 'run-patient-qc']) {
      const button = document.getElementById(id);
      button.disabled = unavailable;
      button.title = unavailable ? 'The OOP distribution for this patient type is unavailable.' : '';
    }
    if (!unavailable) {
      document.querySelector('#batch-status').textContent = 'Choose the patient count, then run the simulation.';
      document.querySelector('#patient-qc-status').textContent = 'Run QC to simulate 10,000 patients with the selected settings.';
    }
  }
  onPatientVolumeChange(updateAvailability);
  updateAvailability();
} catch (error) {
  console.error(error);
  const notice = document.querySelector('#recovery-notice');
  notice.hidden = false;
  notice.textContent = `The application could not start: ${error.message}`;
  for (const id of ['generate', 'run-batch', 'run-patient-qc']) document.getElementById(id).disabled = true;
}
