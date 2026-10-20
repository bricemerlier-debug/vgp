from playwright.sync_api import sync_playwright, expect
from PIL import Image
import io, json, os

container_id = '10000000-0000-0000-0000-000000000001'
seed = {
    'anticipation': 30,
    'equipment': [],
    'containers': [{'id': container_id, 'number': 'CE101', 'type': 'CE', 'subtype': 'PC', 'interventions': []}],
    'owners': [],
}
image = Image.new('RGB', (1200, 900), '#0057a8')
buffer = io.BytesIO()
image.save(buffer, format='PNG')
png = buffer.getvalue()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/cloud-config.js', lambda route: route.fulfill(body="window.VGP_CLOUD={enabled:false};", content_type='text/javascript'))
    page.add_init_script("localStorage.setItem('vgp-prototype-v1'," + json.dumps(json.dumps(seed)) + ");")
    page.goto('http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8000') + '/#containers')
    page.get_by_role('button', name='Ouvrir', exact=True).click()
    frame = page.locator('.container-photo-frame')
    expect(frame).to_be_visible()
    assert frame.evaluate('(node) => Math.abs(node.clientWidth - node.clientHeight) <= 1')
    page.locator('#containerPhotoInput').set_input_files({'name': 'photo.png', 'mimeType': 'image/png', 'buffer': png})
    expect(page.locator('#containerPhotoImage')).to_be_visible()
    assert page.locator('#containerPhotoImage').evaluate('(image) => image.src.startsWith("blob:")')
    stored = page.evaluate("JSON.parse(localStorage.getItem('vgp-prototype-v1')).containers[0]")
    assert stored['photoPath'].startswith('local:')
    assert 'base64' not in json.dumps(stored)
    page.locator('#containerPhotoRemove').click()
    expect(page.locator('#containerPhotoImage')).to_be_hidden()
    assert page.evaluate("JSON.parse(localStorage.getItem('vgp-prototype-v1')).containers[0].photoPath") is None
    page.reload()
    page.get_by_role('button', name='Ouvrir', exact=True).click()
    expect(page.locator('#containerPhotoImage')).to_be_hidden()
    assert not errors, errors
    browser.close()

print('PASS fiche contenant : carré photo, compression, stockage séparé, retrait et persistance validés.')
