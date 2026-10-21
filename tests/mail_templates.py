from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageDraw
from tempfile import TemporaryDirectory
from pathlib import Path
from email import policy
from email.parser import BytesParser
import io, json, os, base64

seed = {'anticipation': 30, 'equipment': [{
    'id': '10000000-0000-0000-0000-000000000001', 'identifier': 'TEST-VGP-001',
    'designation': 'Harnais de sécurité · matériel de test', 'category': 'Harnais',
    'location': 'Atelier', 'assignment': '', 'months': 12, 'owner': 'Responsable Test',
    'controls': [{'id': 'control-1', 'date': '2025-11-21', 'result': 'Bon état', 'intervenant': 'Testeur', 'observations': '', 'created': 1}]
}], 'owners': ['Responsable Test'], 'ownerContacts': [{'owner': 'Responsable Test', 'email': 'responsable@example.test'}]}
image = Image.new('RGB', (800, 550), '#e7eef7')
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((270, 70, 530, 480), radius=45, fill='#0057a8')
draw.rectangle((350, 110, 450, 420), fill='#ffda00')
photo = io.BytesIO()
image.save(photo, format='PNG')
base = 'http://127.0.0.1:' + os.environ.get('VGP_TEST_PORT', '8125')

with sync_playwright() as p, TemporaryDirectory() as directory:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for path in ['/', '/prototype-vgp.html']:
        context = browser.new_context(viewport={'width': 1440, 'height': 1100})
        page = context.new_page()
        errors, sends = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/cloud-config.js', lambda route: route.fulfill(body='window.VGP_CLOUD={enabled:false};', content_type='text/javascript'))
        page.route('**/mail-config.js', lambda route: route.fulfill(body="window.VGP_MAIL={gmailClientId:'mock.apps.googleusercontent.com'};", content_type='text/javascript'))
        page.add_init_script("if(!localStorage.getItem('vgp-prototype-v1'))localStorage.setItem('vgp-prototype-v1'," + json.dumps(json.dumps(seed)) + ');')
        page.add_init_script("window.google={accounts:{oauth2:{initTokenClient(config){return {requestAccessToken(){config.callback({access_token:'fictif',expires_in:3600});}};}}}};")
        page.route('https://www.googleapis.com/oauth2/v3/userinfo', lambda route: route.fulfill(json={'email': 'expediteur@example.test', 'email_verified': True}))
        def send(route):
            sends.append(route.request.post_data_json)
            route.fulfill(json={'id': 'message-test-1'})
        page.route('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', send)
        page.goto(base + path + '?mailFrom=expediteur%40example.test&mailTo=chef%40example.test#mailSettings')
        expect(page.locator('#mailSettingsView')).to_be_visible()
        assert 'mailFrom=' not in page.url and 'mailTo=' not in page.url
        expect(page.locator('#mailModelCards button')).to_have_count(5)
        assert page.locator('#reminderSimulation').count() == 0
        assert page.locator('#digestForm').count() == 0
        page.locator('#mailSampleEquipment').select_option(seed['equipment'][0]['id'])
        expect(page.locator('#mailTestRecipient')).to_have_value('chef@example.test')
        expect(page.locator('#mailEquipmentOwner')).to_contain_text('Responsable Test')
        preview = page.frame_locator('#mailSettingsPreview')
        expect(preview.get_by_role('heading', name='Votre matériel à contrôler')).to_be_visible()
        expect(preview.locator('body')).to_contain_text('TEST-VGP-001')
        expect(preview.locator('body')).to_contain_text('21/11/2026')
        page.locator('#mailPhotoFile').set_input_files({'name': 'test-photo.png', 'mimeType': 'image/png', 'buffer': photo.getvalue()})
        expect(page.locator('#mailPhotoStatus')).to_contain_text('Photo du matériel intégrée')
        expect(preview.get_by_alt_text('Photo du matériel TEST-VGP-001')).to_be_visible()
        state = page.evaluate("JSON.parse(localStorage.getItem('vgp-prototype-v1'))")
        assert state['equipment'][0]['mailPhoto']['data'].startswith('/9j/')
        assert state['ownerContacts'][0]['email'] == 'responsable@example.test'
        page.locator('.mail-edit-model > summary').click()
        page.locator('#mailSubject').fill('Contrôle de {{nom_equipement}}')
        page.locator('#mailBody').fill('Bonjour {{nom_proprietaire}}, merci de présenter {{numero_interne}} avant le {{date_controle}}.')
        page.locator('#mailSaveTemplate').click()
        expect(page.locator('#mailTemplateSaved')).to_contain_text('Modèle enregistré')
        expect(preview.locator('body')).to_contain_text('merci de présenter TEST-VGP-001')
        page.locator('#mailBody').fill('Champ inconnu {{mot_inconnu}}')
        page.locator('#mailSaveTemplate').click()
        expect(page.locator('#mailTemplateError')).to_contain_text('mot_inconnu')
        page.locator('#mailBody').fill('Bonjour {{nom_proprietaire}}, merci de présenter {{numero_interne}} avant le {{date_controle}}.')
        page.locator('#mailSaveTemplate').click()
        expect(page.locator('#mailTemplateSaved')).to_contain_text('Modèle enregistré')
        page.locator('.mail-edit-model > summary').click()
        page.locator('.mail-export-options > summary').click()
        with page.expect_download() as event:
            page.locator('#mailDownloadDraft').click()
        file = Path(directory) / 'test.eml'
        event.value.save_as(file)
        mail = BytesParser(policy=policy.default).parsebytes(file.read_bytes())
        assert str(mail['To']) == 'chef@example.test'
        assert str(mail['From']) == 'expediteur@example.test'
        assert str(mail['Subject']).startswith('[TEST] Contrôle de Harnais')
        assert 'cid:equipment-photo' in mail.get_body(preferencelist=('html',)).get_content()
        assert len([part for part in mail.walk() if part.get_content_type() == 'image/jpeg']) == 2
        page.locator('.mail-export-options > summary').click()
        if path == '/':
            page.locator('#mailConnectGmail').click()
            expect(page.locator('#mailGmailStatus')).to_contain_text('Compte connecté : expediteur@example.test')
            page.locator('#mailSendTest').click()
            expect(page.locator('#mailTestError')).to_contain_text('formulaire de perte nécessite Supabase')
            assert not sends
        else:
            expect(page.locator('#mailConnectGmail')).to_be_disabled()
            expect(page.locator('#mailSendTest')).to_be_disabled()
            assert not sends
        page.locator('#mailSettingsView').screenshot(path='/tmp/mails-vgp-desktop.png')
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('#mailSettingsView').screenshot(path='/tmp/mails-vgp-mobile.png')
        page.reload()
        page.locator('.mail-edit-model > summary').click()
        expect(page.locator('#mailSubject')).to_have_value('Contrôle de {{nom_equipement}}')
        # L'adresse est reprise de la fiche : aucun contact supplémentaire à créer.
        page.locator('#mailSampleEquipment').select_option(seed['equipment'][0]['id'])
        expect(page.locator('#mailTestRecipient')).to_have_value('responsable@example.test')
        page.goto(base + path + '#containers')
        page.reload()
        page.locator('#containerInventoryTab').click()
        expect(page.get_by_role('heading', name='Rapprochement des contenants')).to_be_visible()
        assert page.locator('.inventory-eyebrow').count() == 0
        assert page.locator('#inventoryScopeHelp').count() == 0
        assert page.locator('#inventoryCompare').is_visible()
        assert not errors, errors
        context.close()
    browser.close()
print('PASS Mails : modèles, destinataire associé, photo, aperçu HTML, MIME, Gmail intercepté, persistance, mobile et inventaire nettoyé.')
