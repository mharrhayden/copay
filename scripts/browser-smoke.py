"""Verify the app in Chromium; optionally pass a standalone HTML path."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--html', type=Path)
args = parser.parse_args()
url = args.html.resolve().as_uri() if args.html else 'http://127.0.0.1:3000/'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/lib/chromium/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'], timeout=15000)
    try:
        page = browser.new_page()
        errors = []
        external_requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        if args.html:
            page.on('request', lambda request: external_requests.append(request.url) if request.url.startswith(('http:', 'https:')) else None)
        if args.html:
            # Managed browser policy disables file:// navigation. Inject the
            # exact standalone document into a blank page to test its content.
            page.set_content(args.html.read_text(), wait_until='networkidle', timeout=15000)
        else:
            page.goto(url, wait_until='networkidle', timeout=15000)
        page.wait_for_function("document.querySelectorAll('#distribution tr').length === 17 && !document.querySelector('#run-batch').disabled", timeout=10000)
        assert page.locator('#cohort-revenue-heading th').count() == 19
        assert page.locator('#fill-months th').count() == 13
        assert page.locator('#patient-qc-actual tr').count() == 17
        assert page.locator('#revenue-wac').input_value() == '1393.68'
        assert 'Ubrelvy' in page.locator('#patient-qc-settings').inner_text()
        assert page.locator('#volume-type option[value=continuing]').evaluate('(option) => option.disabled'), page.locator('#recovery-notice').text_content()
        page.locator('#simulation-tab').click()
        page.locator('#generate').click()
        assert page.locator('#patient-id').inner_text() == 'Patient 0001'
        assert page.locator('#oop').inner_text().startswith('$')
        assert page.locator('#fill-initial-oop-1').inner_text().startswith('$')
        assert 'possible fills' in page.locator('#fill-count').inner_text()
        page.locator('#revenue-tab').click()
        page.locator('#patient-count').fill('10000')
        page.locator('#run-batch').click()
        page.wait_for_function("document.querySelector('#batch-status').textContent.startsWith('Complete: 10,000')", timeout=30000)
        assert page.locator('#cohort-revenue-body tr').first.locator('td').last.inner_text() == '10,000'
        page.locator('#patient-qc-tab').click()
        page.locator('#run-patient-qc').click()
        page.wait_for_function("document.querySelector('#patient-qc-status').textContent.startsWith('Complete: 10,000')", timeout=30000)
        assert page.locator('#patient-qc-actual-total td').first.inner_text() == '10,000'
        assert page.locator('#patient-qc-matrix-check').inner_text().startswith('Reconciled:')
        assert page.locator('#patient-qc-matrix-body tr').count() == 12
        page.locator('#revenue-tab').click()
        page.locator('#revenue-wac').fill('1400.00')
        assert page.locator('#wac').input_value() == '1400.00'
        page.locator('#rev-lower').fill('6')
        page.locator('#rev-lower').dispatch_event('input')
        assert page.locator('#sim-lower').input_value() == '6'
        assert not errors, errors
        assert not external_requests, 'Standalone HTML made network requests'
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflow'
        print('Browser passed: patient generation, 10,000-patient New batch, 10,000-patient QC, matrix reconciliation, tabs, synchronized settings, mobile width, and unavailable Continuing guard.')
        if args.html:
            print('Standalone HTML content loaded with zero network requests (managed browser policy blocks file:// navigation).')
    finally:
        browser.close()
