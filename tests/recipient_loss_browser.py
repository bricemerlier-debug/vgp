from playwright.sync_api import sync_playwright, expect
from tempfile import TemporaryDirectory
from pathlib import Path
from email import policy
from email.parser import BytesParser
import base64, copy, json, os, re, subprocess

workspace = '10000000-0000-0000-0000-000000000001'
equipment_id = '10000000-0000-0000-0000-000000000002'
state = {'revision': 0, 'role': 'admin', 'migration': None, 'payload': {
    'anticipation': 30, 'trackingVersion': 2, 'owners': ['Responsable Test'],
    'ownerContacts': [{'owner': 'Responsable Test', 'email': 'responsable@example.test'}],
    'equipment': [{'id': equipment_id, 'siteId': 1, 'identifier': 'TEST-PERTE-001', 'serialNumber': 'SER-TEST',
        'designation': 'Harnais de test', 'category': 'Harnais', 'location': 'Atelier', 'assignment': '',
        'owner': 'Responsable Test', 'months': 12, 'archived': False, 'archiveHistory': [], 'obligations': [],
        'periodicityValidation': {'validated': True, 'months': 12, 'by': 'Testeur fictif', 'reason': 'Règle fictive du test'},
        'controls': [{'id': 'control-1', 'reportId': '7', 'date': '2025-10-21', 'result': 'Bon état', 'intervenant': 'Contrôleur Test', 'observations': '', 'created': 1}]}]
}}
config = "window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'" + workspace + "',requireTrackingGuard:true};"
links, mails, submissions = {}, [], []
base = 'http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8125')
headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,authorization,content-type', 'Access-Control-Allow-Methods': 'POST,GET'}

def api(route):
    request, url = route.request, route.request.url
    if request.method == 'OPTIONS':
        route.fulfill(status=204, headers=headers)
        return
    body = request.post_data_json if request.method == 'POST' else {}
    name = url.split('/')[-1]
    if name == 'read_state': result = state
    elif name == 'tracking_ready': result = True
    elif name == 'read_shift_calendar': result = {'revision': 0, 'rows': [], 'imports': []}
    elif name == 'create_equipment_loss_link':
        assert body['equipment_id'] == equipment_id
        assert body['w'] == workspace
        assert request.headers.get('authorization') == 'Bearer session-fictive'
        if not body['for_test']: assert body['recipient'] == 'responsable@example.test'
        token = ('a' if body['for_test'] else 'b') * 64
        links[token] = {'test': body['for_test'], 'recipient': body['recipient'], 'receipt': None}
        result = {'token': token, 'expiresAt': '2035-01-01T00:00:00Z', 'test': body['for_test']}
    elif name == 'read_equipment_loss_link':
        assert 'authorization' not in request.headers
        link = links.get(body['token'])
        if not link:
            route.fulfill(status=400, json={'message': 'Lien invalide ou expiré'}, headers=headers)
            return
        if link['receipt']:
            result = {'status': 'submitted', 'test': link['test'], 'receipt': link['receipt']}
        else:
            result = {'status': 'ready', 'test': link['test'], 'recipient': link['recipient'], 'equipment': {'number': 'TEST-PERTE-001', 'name': 'Harnais de test', 'serialNumber': 'SER-TEST', 'owner': 'Responsable Test'}}
    elif name == 'submit_equipment_loss':
        assert 'authorization' not in request.headers
        assert 'equipment_id' not in body and 'recipient' not in body
        assert body['accepted'] is True
        assert body['signature']['data'].startswith('/9j/')
        assert body['signature']['width'] == 720 and body['signature']['height'] <= 240
        submissions.append(body)
        link = links[body['token']]
        receipt = {'id': '30000000-0000-0000-0000-000000000001' if link['test'] else '30000000-0000-0000-0000-000000000002', 'number': 'TEST-PERTE-001', 'signer': body['signer_name'], 'date': '2026-10-21', 'test': link['test']}
        if not link['test']:
            receipt['reportId'] = '8'
            e = state['payload']['equipment'][0]
            snapshot = {key: e.get(key, '') for key in ['identifier', 'designation', 'serialNumber', 'category', 'location', 'assignment', 'sector', 'zone', 'owner', 'team']}
            snapshot['siteId'] = e['siteId']
            e['archived'] = True
            e['pendingArchive'] = None
            e['archiveHistory'].append({'id': receipt['id'], 'type': 'archive', 'workflow': 'loss-declaration', 'reason': 'Équipement perdu', 'date': receipt['date'], 'requester': body['signer_name'], 'observations': body['search_details'], 'account': 'Lien envoyé à ' + link['recipient'], 'created': 1, 'generated': False, 'reportId': '8', 'snapshot': snapshot, 'equipmentSnapshot': snapshot, 'reportSignature': body['signature'], 'recipientDeclaration': {'recipient': link['recipient'], 'signerName': body['signer_name'], 'accepted': True}})
            state['revision'] += 1
        link['receipt'] = receipt
        # La réponse perdue est retrouvée par la relecture du même lien.
        if link['test']:
            route.fulfill(status=503, json={'message': 'Réponse fictive perdue'}, headers=headers)
            return
        result = receipt
    elif 'workspace_state?' in url: result = [{'revision': state['revision']}]
    else: result = None
    route.fulfill(json=copy.deepcopy(result), headers=headers)

with sync_playwright() as p, TemporaryDirectory() as directory:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    context.route('**/cloud-config.js', lambda r: r.fulfill(body=config, content_type='text/javascript'))
    context.route('**/mail-config.js', lambda r: r.fulfill(body="window.VGP_MAIL={gmailClientId:'fictif.apps.googleusercontent.com'};", content_type='text/javascript'))
    context.route('https://test.supabase.co/**', api)
    context.route('https://www.googleapis.com/oauth2/v3/userinfo', lambda r: r.fulfill(json={'email': 'expediteur@example.test', 'email_verified': True}))
    context.add_init_script("window.google={accounts:{oauth2:{initTokenClient(config){return {requestAccessToken(){config.callback({access_token:'gmail-fictif',expires_in:3600});}};}}}};")
    context.add_init_script("try{sessionStorage.setItem('vgp-auth:https://test.supabase.co',JSON.stringify({access_token:'session-fictive',refresh_token:'refresh-fictif',expires_at:4102444800,user:{id:'20000000-0000-0000-0000-000000000001',email:'expediteur@example.test'}}));}catch{}")
    def gmail(route):
        raw = route.request.post_data_json['raw']
        mail = BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(raw + '=' * (-len(raw) % 4)))
        mails.append(mail)
        route.fulfill(json={'id': 'gmail-' + str(len(mails))})
    context.route('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', gmail)
    page = context.new_page()
    errors = []
    context.on('page', lambda new_page: new_page.on('pageerror', lambda error: errors.append(str(error))))
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/?mailFrom=expediteur%40example.test&mailTo=chef%40example.test#mailSettings')
    expect(page.locator('#mailSettingsView')).to_be_visible()
    page.locator('#mailSampleEquipment').select_option(equipment_id)
    page.locator('#mailConnectGmail').click()
    expect(page.locator('#mailGmailStatus')).to_contain_text('Compte connecté')
    for is_test in [True, False]:
        if not is_test:
            page.locator('#mailIsTest').uncheck()
            expect(page.locator('#mailTestRecipient')).to_have_value('responsable@example.test')
            expect(page.locator('#mailTestRecipient')).to_have_attribute('readonly', '')
        page.locator('#mailSendTest').click()
        expect(page.locator('#mailTestStatus')).to_contain_text(('Test' if is_test else 'Rappel') + ' envoyé')
        html = mails[-1].get_body(preferencelist=('html',)).get_content()
        link_url = re.search(r'href="([^"]+declarer-perte.html#token=[a-f0-9]{64})"', html).group(1)
        assert ('[TEST]' in str(mails[-1]['Subject'])) == is_test
        assert 'Déclarer ce matériel perdu' in html
        assert state['payload']['equipment'][0]['archived'] is False
        recipient = context.new_page()
        recipient.goto(link_url)
        expect(recipient.locator('#lossPanel')).to_be_visible()
        assert not recipient.locator('input[type=password]').count()
        assert recipient.locator('.portal-version').count() == 0
        assert not submissions or is_test is False
        recipient.locator('#lossSigner').fill('Responsable Test')
        recipient.locator('#lossDetails').fill('Recherché dans le casier et dans l’atelier sans le retrouver.')
        recipient.locator('#lossAccepted').check()
        recipient.locator('#lossSubmit').click()
        expect(recipient.locator('#lossSubmitError')).to_contain_text('Ajoutez votre signature')
        recipient.locator('#lossSignWithName').click()
        if not is_test:
            recipient.locator('#lossPanel').screenshot(path='/tmp/declaration-perte-formulaire.png')
        recipient.set_viewport_size({'width': 390, 'height': 844})
        assert recipient.evaluate('document.documentElement.scrollWidth<=innerWidth')
        recipient.locator('#lossSubmit').click()
        expect(recipient.locator('#lossSuccess')).to_be_visible()
        expect(recipient.locator('#lossSuccessText')).to_contain_text('Aucun matériel' if is_test else 'a été déclaré perdu')
        assert state['payload']['equipment'][0]['archived'] is not is_test
        recipient.reload()
        expect(recipient.locator('#lossSuccess')).to_be_visible()
        recipient.close()
    assert len(submissions) == 2 and len(mails) == 2
    page.goto(base + '/#equipment/' + equipment_id)
    page.reload()
    expect(page.locator('#equipmentOverview')).to_contain_text('Déclaration introuvable · suivi suspendu')
    with page.expect_download() as event:
        page.locator('[data-control-pdf="30000000-0000-0000-0000-000000000002"]').click()
    pdf = Path(directory) / 'declaration.pdf'
    event.value.save_as(pdf)
    text = subprocess.check_output(['pdftotext', str(pdf), '-'], text=True)
    assert 'Responsable Test' in text and 'Recherché dans le casier' in ' '.join(text.split())
    assert 'DÉCLARATION D’INTROUVABLE' in text
    assert 'Signature du déclarant' in text
    invalid = context.new_page()
    invalid.goto(base + '/declarer-perte.html#token=' + 'c' * 64)
    expect(invalid.locator('#lossError')).to_contain_text('invalide')
    expect(invalid.locator('#lossPanel')).to_be_hidden()
    invalid.goto(base + '/operateur.html')
    expect(invalid.locator('.portal-hero')).to_be_visible()
    assert invalid.locator('.portal-version').count() == 0
    assert not errors, errors
    browser.close()
print('PASS déclaration de perte : mail, lien dédié, signature, test sans effet, archivage réel simulé, réponse perdue, PDF et badge opérateur retiré.')
