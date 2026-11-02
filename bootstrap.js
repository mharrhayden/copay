try {
  await import('./app.js');
  const { onPatientVolumeChange, patientVolumeType } = await import('./volume-ui.js');
  const { selectedProductId, onProductChange, onBusyChange, isBusy } = await import('./product-ui.js');
  const { getProduct } = await import('./products.js');
  const { hasPatientData, missingModelInputs, missingPatientInputs } = await import('./model-readiness.js');
  function updateAvailability() {
    const productId = selectedProductId();
    const product = getProduct(productId);
    const typeInput = document.querySelector('#volume-type');
    for (const option of typeInput.options) {
      option.disabled = !hasPatientData(productId, option.value);
      const gaps = missingPatientInputs(productId, option.value);
      const unavailableLabel = gaps.length === 1 && gaps[0] === 'persistence curves' ? ' (persistence needed)' : ' (data needed)';
      option.textContent = `${option.value === 'new' ? 'New' : 'Continuing'}${option.disabled ? unavailableLabel : ''}`;
    }
    // Product changes start with a supported type; unavailable tables are never
    // replaced by another product's or another patient's source distributions.
    if (!hasPatientData(productId, patientVolumeType()) && hasPatientData(productId, 'new')) {
      typeInput.value = 'new'; typeInput.dispatchEvent(new Event('change')); return;
    }
    const missing = missingModelInputs(productId, patientVolumeType());
    const notice = document.querySelector('#recovery-notice');
    const continuingGaps = missingPatientInputs(productId, 'continuing');
    const missingContinuing = continuingGaps.length > 0;
    notice.hidden = !missing.length && !missingContinuing;
    notice.textContent = missing.length
      ? `${product.name} simulation needs: ${missing.join(', ')}.`
      : `${product.name} New patient simulation is available. Continuing patient ${continuingGaps.join(' and ')} have not been supplied.`;
    for (const id of ['generate', 'run-batch', 'run-patient-qc']) {
      const button = document.getElementById(id);
      button.disabled = missing.length > 0 || isBusy();
      button.title = missing.length ? `Missing ${missing.join(', ')}` : '';
    }
  }
  onPatientVolumeChange(updateAvailability);
  onProductChange(updateAvailability);
  onBusyChange(updateAvailability);
  updateAvailability();
} catch (error) {
  console.error(error);
  const notice = document.querySelector('#recovery-notice');
  notice.hidden = false;
  notice.textContent = `The application could not start: ${error.message}`;
  for (const id of ['generate', 'run-batch', 'run-patient-qc']) document.getElementById(id).disabled = true;
}
