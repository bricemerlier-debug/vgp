from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://127.0.0.1:8000'+'#material')
 page.get_by_role('button',name='Ouvrir',exact=True).first.click()
 page.get_by_role('button',name='Archiver',exact=True).click()
 form=page.locator('#requestArchive')
 form.locator('[name=reason]').select_option('Équipement perdu')
 form.locator('[name=requester]').fill('Demandeur')
 form.get_by_role('button',name='Préparer le document').click()
 assert not json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))['equipment'][0]['archived']
 with page.expect_popup() as popup:
  page.get_by_role('button',name='Générer le document à signer').click()
 assert 'Équipement perdu' in popup.value.locator('body').inner_text()
 page.reload()
 page.get_by_role('button',name='Ouvrir',exact=True).first.click()
 page.get_by_role('button',name='Poursuivre la demande').click()
 approve=page.locator('#approveArchive')
 approve.locator('[name=approver]').fill('Approbateur')
 approve.locator('[name=confirmed]').check()
 approve.get_by_role('button',name='Valider l’archivage').click()
 assert page.locator('#archiveDialog').is_visible()
 approve.locator('[name=signedAttachment]').set_input_files({'name':'signe.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 document signe de test'})
 approve.get_by_role('button',name='Valider l’archivage').click()
 expect(page.locator('#archiveDialog')).not_to_be_visible()
 assert page.locator('#detailContent').get_by_role('link',name='Document signé : signe.pdf').count()==1
 assert page.get_by_role('button',name='+ Enregistrer un contrôle').count()==0
 page.locator('#detail [data-close]').click()
 assert page.locator('tr.archived-row').count()==1
 assert page.locator('#activeEquipmentTab').inner_text()=='Actifs (1)'
 assert page.locator('#archivedEquipmentTab').inner_text()=='Archivés (1)'
 assert page.locator('#stats [data-status-filter=""] strong').inner_text()=='1'
 page.get_by_role('button',name='Ouvrir le menu',exact=True).click()
 page.locator('[data-view=kpi]').click()
 expect(page.locator('#kpi-performed')).to_have_text('1')
 expect(page.locator('#kpi-todo')).to_have_text('0')
 page.get_by_role('button',name='Ouvrir le menu',exact=True).click()
 page.locator('[data-view=material]').click()
 page.locator('#archivedEquipmentTab').click()
 page.get_by_role('button',name='Ouvrir',exact=True).first.click()
 page.get_by_role('button',name='Modifier la fiche').click()
 page.locator('#equipmentForm [name=location]').fill('Changement pendant archivage')
 page.get_by_role('button',name='Enregistrer l’équipement').click()
 assert page.get_by_role('button',name='Désarchiver',exact=True).count()==1
 page.get_by_role('button',name='Désarchiver',exact=True).click()
 found=page.locator('#foundForm');found.locator('[name=author]').fill('Trouveur fictif');found.locator('[name=comment]').fill('Retrouvé pendant le test');found.get_by_role('button',name='Réactiver sans valider une nouvelle échéance').click();expect(page.locator('#foundDialog')).not_to_be_visible();expect(page.locator('#detailContent')).to_contain_text('Situation à vérifier')
 page.get_by_role('button',name='+ Enregistrer un contrôle').click();control=page.locator('#controlForm');control.locator('[name=intervenant]').fill('Contrôleur retour');control.locator('[name=result]').select_option('Bon état');control.get_by_role('button',name='Enregistrer le contrôle',exact=True).click();expect(page.locator('#control')).not_to_be_visible()
 assert page.locator('#detailContent').get_by_role('link',name='Document signé : signe.pdf').count()==1
 with page.expect_download() as pdf:
  page.get_by_role('button',name='Télécharger le PDF').first.click()
 pdf.value.save_as('/tmp/vgp-control-test.pdf')
 page.locator('#detail [data-close]').click()
 assert page.locator('tr.archived-row').count()==0
 # Second supported archive reason and export/import roundtrip.
 page.get_by_role('button',name='Ouvrir',exact=True).first.click()
 page.get_by_role('button',name='Archiver',exact=True).click()
 page.locator('#requestArchive [name=reason]').select_option('Mis au rebut')
 page.locator('#requestArchive [name=requester]').fill('Testeur')
 page.get_by_role('button',name='Préparer le document').click()
 with page.expect_popup() as popup:page.get_by_role('button',name='Générer le document à signer').click()
 assert 'Mis au rebut' in popup.value.locator('body').inner_text()
 approve=page.locator('#approveArchive')
 approve.locator('[name=approver]').fill('Signataire')
 approve.locator('[name=confirmed]').check()
 approve.locator('[name=intervenant]').fill('Contrôleur rebut')
 approve.locator('[name=signedAttachment]').set_input_files({'name':'rebut.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 test'})
 approve.get_by_role('button',name='Valider l’archivage').click()
 expect(page.locator('#archiveDialog')).not_to_be_visible()
 page.locator('#detail [data-close]').click()
 with page.expect_download() as backup:page.get_by_role('button',name='Exporter une sauvegarde').click()
 backup.value.save_as('/tmp/vgp-archive-backup.json')
 page.on('dialog',lambda d:d.accept())
 page.locator('#import').set_input_files('/tmp/vgp-archive-backup.json')
 page.get_by_text('Sauvegarde importée.',exact=True).wait_for()
 record=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))['equipment'][0]
 assert record['siteId']==1
 assert record['archived'] and len(record['archiveHistory'])==3 and len(record['controls'])==3
 assert record['archiveHistory'][0]['snapshot']['location']=='Atelier A (fictif)'
 assert not errors,errors
 b.close()
 print('PASS: archivage perdu/rebut, demande persistante, signature obligatoire, document et historique, gris/KPI, réactivation inconnue puis contrôle réel, PDF, export/import')
