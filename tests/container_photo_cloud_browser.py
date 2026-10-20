from playwright.sync_api import sync_playwright, expect
from PIL import Image
from datetime import datetime, timezone
import io, json, os

workspace = '10000000-0000-0000-0000-000000000001'
container_id = '30000000-0000-0000-0000-000000000001'
state = {'revision': 8, 'role': 'editor', 'payload': {
    'anticipation': 30, 'equipment': [], 'owners': [],
    'containers': [{'id': container_id, 'number': 'CE202', 'type': 'CE', 'subtype': 'PC', 'interventions': []}],
}}
uploads, deleted, signed = [], [], []
config = "window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'" + workspace + "'};document.documentElement.classList.add('cloud-locked');"
headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,authorization,content-type,x-upsert', 'Access-Control-Allow-Methods': 'POST,GET,DELETE'}
image = Image.new('RGB', (1000, 800), '#0057a8')
buffer = io.BytesIO()
image.save(buffer, format='PNG')
png = buffer.getvalue()
replacement = Image.new('RGB', (1000, 800), '#a63a2e')
replacement_buffer = io.BytesIO()
replacement.save(replacement_buffer, format='PNG')
replacement_png = replacement_buffer.getvalue()

def api(route):
    url = route.request.url
    if route.request.method == 'OPTIONS':
        route.fulfill(status=204, headers=headers)
        return
    if '/token?' in url:
        result = {'access_token': 'test', 'refresh_token': 'test', 'expires_in': 3600, 'user': {'id': '20000000-0000-0000-0000-000000000001', 'email': 'test@example.fr'}}
    elif url.endswith('read_state'):
        result = state
    elif url.endswith('read_shift_calendar'):
        result = {'revision': 0, 'rows': [], 'imports': []}
    elif url.endswith('tracking_ready'):
        result = True
    elif url.endswith('write_containers'):
        body = route.request.post_data_json
        assert body['expected_revision'] == state['revision']
        assert 'base64' not in json.dumps(body['containers'])
        state['payload']['containers'] = body['containers']
        state['revision'] += 1
        result = {'revision': state['revision']}
    elif '/storage/v1/object/sign/equipment-maintenance/' in url:
        path = url.split('/equipment-maintenance/', 1)[1].split('?', 1)[0]
        if route.request.method == 'POST':
            signed.append(path)
            result = {'signedURL': '/object/sign/equipment-maintenance/' + path + '?token=fictif'}
        else:
            route.fulfill(body=png, content_type='image/png', headers=headers)
            return
    elif '/storage/v1/object/equipment-maintenance/' in url:
        path = url.split('/equipment-maintenance/', 1)[1]
        if route.request.method == 'POST':
            assert route.request.headers['content-type'] == 'image/jpeg'
            assert route.request.post_data_buffer[:2] == b'\xff\xd8'
            assert len(route.request.post_data_buffer) <= 180 * 1024
            if path not in uploads:
                uploads.append(path)
            result = {'Key': path}
        elif route.request.method == 'DELETE':
            deleted.append(path)
            result = {}
        else:
            raise AssertionError('Unexpected storage method: ' + route.request.method)
    else:
        result = None
    route.fulfill(json=result, headers=headers)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install(time=datetime(2026, 10, 20, 10, tzinfo=timezone.utc))
    page.route('**/cloud-config.js', lambda route: route.fulfill(body=config, content_type='text/javascript'))
    page.route('https://test.supabase.co/**', api)
    page.goto('http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8000') + '/#containers')
    page.locator('#loginForm [name=email]').fill('test@example.fr')
    page.locator('#loginForm [name=password]').fill('test')
    page.locator('#loginForm button').first.click()
    page.get_by_role('button', name='Ouvrir', exact=True).click()
    page.locator('#containerPhotoInput').set_input_files({'name': 'photo.png', 'mimeType': 'image/png', 'buffer': png})
    expect(page.locator('#containerPhotoImage')).to_be_visible()
    first = state['payload']['containers'][0]['photoPath']
    assert first == uploads[0] and first == signed[0]
    assert state['revision'] == 9
    page.locator('#containerPhotoInput').set_input_files({'name': 'photo-remplacement.png', 'mimeType': 'image/png', 'buffer': replacement_png})
    for _ in range(100):
        if len(uploads) >= 2:
            break
        page.wait_for_timeout(100)
    assert len(uploads) >= 2, page.locator('#containerPhotoError').inner_text() or page.locator('#containerPhotoStatus').inner_text()
    expect(page.locator('#containerPhotoImage')).to_be_visible()
    second = state['payload']['containers'][0]['photoPath']
    assert second == uploads[1] and second != first
    assert deleted == [first]
    page.locator('#containerPhotoRemove').click()
    expect(page.locator('#containerPhotoImage')).to_be_hidden()
    assert 'photoPath' not in state['payload']['containers'][0]
    assert deleted == [first, second]
    assert not errors, errors
    browser.close()

print('PASS photo Supabase simulée : compression, téléversement privé, URL signée, remplacement et suppression de l’ancienne copie.')
