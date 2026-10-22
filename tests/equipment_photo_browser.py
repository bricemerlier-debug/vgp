from playwright.sync_api import sync_playwright, expect
from PIL import Image
import io, json, os

equipment_id='equipment-photo-test'
seed={'anticipation':30,'owners':['Responsable Test'],'equipment':[{'id':equipment_id,'siteId':1,'identifier':'PHOTO-VGP-001','designation':'Anneau de test','serialNumber':'','sector':'B2','zone':'','team':'A','owner':'Responsable Test','location':'Atelier','category':'','assignment':'','months':12,'firstControlDate':'2026-11-21','controls':[],'archived':False,'archiveHistory':[]}]}
picture=Image.new('RGB',(1600,1100),'#0057a8');buffer=io.BytesIO();picture.save(buffer,format='PNG');png=buffer.getvalue()
base='http://127.0.0.1:'+os.environ.get('VGP_TEST_PORT','8000')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':900})
 context.route('**/cloud-config.js',lambda route:route.fulfill(body='window.VGP_CLOUD={enabled:false};',content_type='text/javascript'))
 context.add_init_script("localStorage.setItem('vgp-prototype-v1',"+json.dumps(json.dumps(seed))+");")
 page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(base+'/#material');page.locator('[data-open="'+equipment_id+'"]').click()
 expect(page.locator('#equipmentPhotoCard')).to_be_visible()
 before=page.evaluate("localStorage.getItem('vgp-prototype-v1')")
 page.locator('#equipmentPhotoInput').set_input_files({'name':'photo.png','mimeType':'image/png','buffer':png})
 expect(page.locator('#equipmentPhotoStatus')).to_have_text('Photo enregistrée.')
 expect(page.locator('#equipmentPhotoImage')).to_be_visible()
 page.locator('#detail').screenshot(path='/tmp/vgp-equipment-photo-desktop.png')
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth')==390
 page.set_viewport_size({'width':1440,'height':900})
 assert page.locator('#equipmentPhotoImage').evaluate('(img)=>img.src.startsWith("blob:")')
 assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==before
 page.reload();expect(page.locator('#equipmentPhotoImage')).to_be_visible()
 page.goto(base+'/#mailSettings');page.locator('#mailSampleEquipment').select_option(equipment_id)
 preview=page.frame_locator('#mailSettingsPreview')
 expect(preview.get_by_alt_text('Photo du matériel PHOTO-VGP-001')).to_be_visible()
 page.goto(base+'/#equipment/'+equipment_id);expect(page.locator('#equipmentPhotoImage')).to_be_visible()
 page.locator('#equipmentPhotoRemove').click();expect(page.locator('#equipmentPhotoStatus')).to_have_text('Photo retirée.')
 expect(page.locator('#equipmentPhotoPlaceholder')).to_be_visible()
 page.goto(base+'/#mailSettings');page.locator('#mailSampleEquipment').select_option(equipment_id)
 expect(preview.get_by_alt_text('Photo du matériel PHOTO-VGP-001')).to_have_count(0)
 assert not errors,errors
 browser.close()
print('PASS photo VGP locale : ajout, aperçu, persistance, mail automatique et retrait sans grossir l’instantané.')
