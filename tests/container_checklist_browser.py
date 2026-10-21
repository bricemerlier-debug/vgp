from playwright.sync_api import sync_playwright, expect
import ast
import json
import os
import re
from pathlib import Path

legacy_checks = ast.literal_eval(re.search(r'^const containerParts=(\[[^;]+\]);', Path('containers.mjs').read_text(), re.M).group(1))
ids = [f'10000000-0000-0000-0000-00000000000{i}' for i in range(1, 4)]
seed = {
    'anticipation': 30,
    'equipment': [],
    'owners': [],
    'containerControllerProfiles': [{'id': 'controller-1', 'name': 'Laurent B.', 'email': ''}],
    'containers': [
        {'id': ids[0], 'number': 'CB001', 'type': 'CB', 'subtype': 'R2 - JAUNE', 'categoryChecks': legacy_checks, 'interventions': []},
        {'id': ids[1], 'number': 'SE118', 'type': 'SE', 'subtype': 'PC', 'interventions': []},
        {'id': ids[2], 'number': 'TC016', 'type': 'TC', 'subtype': 'CARCASSE', 'interventions': []},
    ],
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/cloud-config.js', lambda route: route.fulfill(body='window.VGP_CLOUD={enabled:false};', content_type='text/javascript'))
    page.add_init_script("localStorage.setItem('vgp-prototype-v1'," + json.dumps(json.dumps(seed)) + ');')
    page.goto('http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8000') + '/#containers')

    page.locator(f'[data-container-open="{ids[0]}"]').click()
    photo = page.locator('#containerDetail .container-photo-card').bounding_box()
    facts = page.locator('#containerDetail .container-facts').bounding_box()
    assert photo['y'] < facts['y'], (photo, facts)
    expect(page.locator('#containerPhotoStatus')).to_be_hidden()
    page.locator('#containerAddIntervention').click()
    checks = page.locator('#containerPartFields input[type=checkbox]')
    expect(checks).to_have_count(14)
    assert all(checks.nth(i).is_checked() for i in range(14))
    expect(page.locator('select[name="part:Frein"]')).to_have_value('Vérifié')
    page.locator('#containerInterventionForm [name=type][value=préventif]').check()
    expect(page.locator('#containerInterventionChecklist')).to_be_visible()
    page.locator('input[name="partIncluded:Butée"]').uncheck()
    page.locator('select[name="part:Frein"]').select_option(label='À réparer')
    page.locator('#containerInterventionForm select[name=controller]').select_option(label='Laurent B.')
    page.locator('#containerInterventionSubmit').click()
    expect(page.locator('#containerInterventionDialog')).to_be_hidden()
    saved = page.evaluate("JSON.parse(localStorage.getItem('vgp-prototype-v1')).containers[0].interventions[0].parts")
    assert len(saved) == 13 and 'Butée' not in saved and saved['Frein'] == 'À réparer' and saved['Bâti'] == 'Vérifié', saved

    page.locator('#containerBack').click()
    page.locator(f'[data-container-open="{ids[1]}"]').click()
    page.locator('#containerAddIntervention').click()
    expect(page.locator('#containerPartFields input[type=checkbox]')).to_have_count(12)
    expect(page.locator('input[name="partIncluded:Prise chariot"]')).to_be_checked()
    page.locator('#containerInterventionDialog .close').click()

    page.locator('#containerBack').click()
    page.locator(f'[data-container-open="{ids[2]}"]').click()
    page.locator('#containerAddIntervention').click()
    expect(page.locator('#containerPartFields input[type=checkbox]')).to_have_count(0)
    expect(page.locator('#containerPartFields')).to_contain_text('Aucune checklist définie')
    assert not errors, errors
    browser.close()

print('PASS checklists : catégorie, présélection, état enregistré et photo remontée.')
