"""Verify the app in Chromium; optionally pass a standalone HTML path."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--html', type=Path)
parser.add_argument('--url', default='http://127.0.0.1:3000/')
parser.add_argument('--screenshot-dir', type=Path)
parser.add_argument('--product', choices=['ubrelvy', 'qulipta'], default='ubrelvy')
parser.add_argument('--patient-type', choices=['new', 'continuing'], default='new')
args = parser.parse_args()
url = args.html.resolve().as_uri() if args.html else args.url
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
        page.select_option('#product', args.product)
        cohort_count = 16 if args.product == 'qulipta' else 17
        wac = '$1,264.80' if args.product == 'qulipta' else '$1,393.68'
        assert page.locator('#distribution tr').count() == cohort_count
        assert page.locator('#cohort-revenue-heading th').count() == cohort_count + 2
        assert page.locator('#fill-months th').count() == 13
        assert page.locator('#patient-qc-actual tr').count() == cohort_count
        assert page.locator('#revenue-wac').inner_text() == wac
        assert page.locator('input#wac, input#revenue-wac').count() == 0
        assert args.product.capitalize() in page.locator('#patient-qc-settings').inner_text()
        assert page.locator('#volume-type option[value=continuing]').evaluate('(option) => option.disabled') == (args.product == 'qulipta')
        assert page.locator('#recovery-notice').is_hidden() == (args.product == 'ubrelvy')
        assert page.locator('html').get_attribute('data-product') == args.product
        assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--theme-hue').trim()") == ('112' if args.product == 'qulipta' else '210')
        page.select_option('#volume-type', args.patient_type)
        expected_type = 'Continuing' if args.patient_type == 'continuing' else 'New'
        page.locator('#simulation-tab').click()
        page.locator('#generate').click()
        assert page.locator('#patient-id').inner_text() == 'Patient 0001'
        assert page.locator('#patient-volume-type').inner_text() == expected_type
        assert page.locator('#fill-oop-distribution-1').inner_text() == expected_type
        assert page.locator('#fill-persistence-type-1').inner_text() == expected_type
        assert page.locator('#oop').inner_text().startswith('$')
        assert page.locator('#fill-initial-oop-1').inner_text().startswith('$')
        assert 'possible fills' in page.locator('#fill-count').inner_text()
        page.locator('#revenue-tab').click()
        # Exercise the visible thumb hit areas, rather than just setting values.
        low = page.locator('#rev-lower')
        high = page.locator('#rev-upper')
        assert low.bounding_box()['y'] == high.bounding_box()['y']
        assert page.locator('#rev-bounds-track .bounds-rail').count() == 1
        def drag_handle(locator, target):
            box = locator.bounding_box()
            current = int(locator.input_value())
            maximum = int(locator.get_attribute('max'))
            x = box['x'] + 11 + current / maximum * (box['width'] - 22)
            end = box['x'] + 11 + target / maximum * (box['width'] - 22)
            y = box['y'] + box['height'] / 2
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(end, y, steps=12)
            page.mouse.up()
        drag_handle(low, 4)
        drag_handle(high, 12)
        assert low.input_value() == '4', low.input_value()
        assert high.input_value() == '12', high.input_value()
        assert page.locator('#sim-lower').input_value() == '4'
        assert page.locator('#sim-upper').input_value() == '12'
        low.focus()
        page.keyboard.press('ArrowRight')
        assert low.input_value() == '5'
        # Coincident bounds remain a valid single-cohort selection.
        low.fill('12'); low.dispatch_event('input')
        page.keyboard.press('ArrowRight')
        assert low.input_value() == '12'
        high.focus(); page.keyboard.press('ArrowLeft')
        assert high.input_value() == '12'
        high.fill(str(cohort_count - 1)); high.dispatch_event('input')
        low.fill('0'); low.dispatch_event('input')
        page.locator('#patient-count').fill('10000')
        page.locator('#run-batch').click()
        assert page.locator('#product').is_disabled()
        assert page.locator('#volume-type').is_disabled()
        page.wait_for_function("document.querySelector('#batch-status').textContent.startsWith('Complete: 10,000')", timeout=30000)
        assert page.locator('#cohort-revenue-body tr').first.locator('td').last.inner_text() == '10,000'
        assert expected_type in page.locator('#revenue-patient').inner_text()
        assert page.locator('#overview-patients').inner_text() == '10,000'
        assert page.locator('#overview-fills').inner_text() != '—'
        page.locator('#patient-qc-tab').click()
        page.locator('#run-patient-qc').click()
        page.wait_for_function("document.querySelector('#patient-qc-status').textContent.startsWith('Complete: 10,000')", timeout=30000)
        assert expected_type in page.locator('#patient-qc-status').inner_text()
        assert page.locator('#patient-qc-actual-total td').first.inner_text() == '10,000'
        assert page.locator('#patient-qc-matrix-check').inner_text().startswith('Reconciled:')
        assert page.locator('#patient-qc-matrix-body tr').count() == 12
        page.locator('#revenue-tab').click()
        assert page.locator('#wac').inner_text() == wac
        page.locator('#rev-lower').fill('6')
        page.locator('#rev-lower').dispatch_event('input')
        assert page.locator('#sim-lower').input_value() == '6'
        # Switching products must change cohort structure, theme, WAC and result
        # context together. Returning restores the original product's results.
        original_results = page.locator('#cohort-revenue-body').inner_text()
        original_net = page.locator('#overview-net').inner_text()
        other = 'qulipta' if args.product == 'ubrelvy' else 'ubrelvy'
        page.select_option('#product', other)
        assert page.locator('html').get_attribute('data-product') == other
        assert page.locator('#cohort-revenue-heading th').count() == (18 if other == 'qulipta' else 19)
        assert page.locator('#overview-patients').inner_text() == '—'
        assert page.locator('#wac').inner_text() != wac
        page.select_option('#product', args.product)
        assert page.locator('#cohort-revenue-body').inner_text() == original_results
        assert page.locator('#overview-net').inner_text() == original_net
        assert page.locator('#wac').inner_text() == wac
        assert not errors, errors
        assert not external_requests, 'Standalone HTML made network requests'
        if args.screenshot_dir:
            args.screenshot_dir.mkdir(parents=True, exist_ok=True)
            page.evaluate('scrollTo(0,0)')
            page.screenshot(path=str(args.screenshot_dir / 'copay-desktop.png'), full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile page overflow'
        if args.screenshot_dir:
            page.evaluate('scrollTo(0,0)')
            page.screenshot(path=str(args.screenshot_dir / 'copay-mobile.png'), full_page=True)
        print(f'Browser passed for {args.product} {expected_type}: shared-rail dragging, keyboard bounds and synchronization; patient generation with correct OOP/persistence tables, 10,000-patient revenue batch, 10,000-patient QC, matrix reconciliation, tabs, product snapshots, fixed WAC, product palettes, synchronized settings, and mobile width.')
        if args.html:
            print('Standalone HTML content loaded with zero network requests (managed browser policy blocks file:// navigation).')
    finally:
        browser.close()
