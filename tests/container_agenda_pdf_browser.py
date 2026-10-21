from playwright.sync_api import sync_playwright, expect
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import os
import subprocess

def box(number, dates):
    return {'id': number, 'number': number, 'type': 'CA', 'subtype': 'PLI AMIENS', 'interventions': [
        {'number': str(index) + number, 'date': date, 'type': 'préventif', 'controller': 'Laurent B.', 'generalState': '', 'comment': '', 'parts': {}}
        for index, date in enumerate(dates)
    ]}

seed = {'anticipation': 30, 'equipment': [], 'owners': [], 'containers': [box('CA001', ['2025-10-20']), box('CA002', ['2025-10-22']), box('CA003', ['2025-10-19', '2026-10-19']), box('CA004', ['2025-10-26'])]}

with sync_playwright() as p, TemporaryDirectory() as directory:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, timezone_id='Europe/Paris')
    page.clock.install(time=datetime(2026, 10, 21, 10, tzinfo=timezone.utc))
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/cloud-config.js', lambda route: route.fulfill(body='window.VGP_CLOUD={enabled:false};', content_type='text/javascript'))
    page.add_init_script("localStorage.setItem('vgp-prototype-v1'," + json.dumps(json.dumps(seed)) + ');')
    base = 'http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8124')
    for path in ['/', '/prototype-vgp.html']:
        page.goto(base + path + '#containers')
        page.locator('#containerAgendaTab').click()
        expect(page.locator('#containerAgendaRange')).to_contain_text('19/10/2026 au 25/10/2026')
        before = page.evaluate("localStorage.getItem('vgp-prototype-v1')")
        with page.expect_download() as event:
            page.locator('#containerAgendaPdf').click()
        download = event.value
        assert download.suggested_filename == 'preventifs-contenants-2026-10-19-au-2026-10-25.pdf'
        target = Path(directory) / 'week.pdf'
        download.save_as(target)
        text = subprocess.check_output(['pdftotext', str(target), '-'], text=True)
        assert 'CA001' in text and 'CA002' in text and 'CA003' not in text and 'CA004' not in text, text
        expect(page.locator('#containerAgendaExportStatus')).to_contain_text('2 contenants restant à contrôler')
        assert before == page.evaluate("localStorage.getItem('vgp-prototype-v1')")
        page.locator('#containerAgendaNext').click()
        with page.expect_download() as event:
            page.locator('#containerAgendaPdf').click()
        assert event.value.suggested_filename == 'preventifs-contenants-2026-10-26-au-2026-11-01.pdf'
        event.value.save_as(target)
        text = subprocess.check_output(['pdftotext', str(target), '-'], text=True)
        assert 'CA004' in text and 'CA001' not in text
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.locator('#containerAgendaPdf')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.set_viewport_size({'width': 1440, 'height': 1000})
    page.screenshot(path='/tmp/container-agenda-pdf.png', full_page=True)
    assert not errors, errors
    browser.close()

print('PASS export PDF : semaine affichée, exclusion des faits, téléchargement, mobile et version autonome.')
