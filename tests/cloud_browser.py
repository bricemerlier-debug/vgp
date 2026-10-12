"""Deux navigateurs indépendants, API simulée ; le SQL/RLS est testé séparément."""
from playwright.sync_api import sync_playwright, expect
import json, zipfile, io
from xml.sax.saxutils import escape
config="window.VGP_CLOUD={enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test',workspaceId:'10000000-0000-0000-0000-000000000001'};document.documentElement.classList.add('cloud-locked');"
state={'revision':0,'payload':{'anticipation':30,'equipment':[],'owners':[]}}
fail=False

def api(route):
 global state
 if route.request.method=='OPTIONS':
  route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'POST'});return
 body=route.request.post_data_json
 if '/token?' in route.request.url:result={'access_token':'test','refresh_token':'test','expires_in':3600}
 elif route.request.url.endswith('read_state'): result=state
 elif route.request.url.endswith('write_state'):
  if fail:route.fulfill(status=503,headers={'Access-Control-Allow-Origin':'*'},json={'message':'Indisponible : aucun enregistrement'});return
  if body['expected_revision']!=state['revision']:route.fulfill(status=409,headers={'Access-Control-Allow-Origin':'*'},json={'message':'REVISION_CONFLICT'});return
  state={'revision':state['revision']+1,'payload':body['document']};result={'revision':state['revision'],'receipt':None}
 else:result=None
 route.fulfill(json=result,headers={'Access-Control-Allow-Origin':'*'})

def xlsx():
 rows=[['Numéro interne','Nom','Numéro de série'],['CLOUD-1','Doublon',''],['EXCEL-1','Anneau Excel','S-EXCEL']]
 sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join('<row r="%d">'%(i+1)+''.join('<c r="%s%d" t="inlineStr"><is><t>%s</t></is></c>'%(chr(65+j),i+1,escape(v)) for j,v in enumerate(row))+'</row>' for i,row in enumerate(rows))+'</sheetData></worksheet>'
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w') as z:
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
  z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Matériel" sheetId="1" r:id="rId1"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  z.writestr('xl/worksheets/sheet1.xml',sheet)
 return out.getvalue()

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 pages=[];errors=[]
 for i in range(2):
  context=b.new_context();context.route('**/cloud-config.js',lambda r:r.fulfill(body=config,content_type='text/javascript'));context.route('https://test.supabase.co/**',api)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("localStorage.setItem('vgp-prototype-v1',JSON.stringify({original:'preserved'}))")
  page.goto('http://127.0.0.1:8000/');expect(page.locator('main')).not_to_be_visible();expect(page.locator('#authGate')).to_be_visible()
  page.locator('#loginForm [name=email]').fill('test@example.fr');page.locator('#loginForm [name=password]').fill('test');page.locator('#loginForm button').first.click();expect(page.locator('main')).to_be_visible();pages.append(page)
 page=pages[0];page.locator('#add').click() if page.locator('#add').count() else page.get_by_role('button',name='+ Ajouter un équipement').click()
 page.locator('#equipmentForm [name=identifier]').fill('CLOUD-1');page.locator('#equipmentForm [name=designation]').fill('Anneau partagé');page.locator('#equipmentForm button').filter(has_text='Enregistrer l’équipement').click();expect(page.locator('#editor')).not_to_be_visible()
 assert state['payload']['equipment'][0]['identifier']=='CLOUD-1'
 assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))=={'original':'preserved'}
 pages[1].reload();expect(pages[1].locator('tbody')).to_contain_text('Anneau partagé')
 # Le second appareil modifie, le premier devenu obsolète ne peut écraser.
 second=pages[1];second.get_by_role('button',name='+ Ajouter un équipement').click();second.locator('[name=identifier]').fill('PHONE');second.locator('[name=designation]').fill('Téléphone');second.locator('#equipmentForm button').filter(has_text='Enregistrer l’équipement').click();expect(second.locator('#editor')).not_to_be_visible()
 page.get_by_role('button',name='+ Ajouter un équipement').click();page.locator('[name=identifier]').fill('OLD');page.locator('[name=designation]').fill('Ancien');page.locator('#equipmentForm button').filter(has_text='Enregistrer l’équipement').click();expect(page.locator('#equipmentError')).to_contain_text('REVISION_CONFLICT');assert len(state['payload']['equipment'])==2
 page.reload();expect(page.locator('tbody')).to_contain_text('Téléphone')
 page.locator('#settingsToggle').click();page.locator('#dataSettings').click();page.locator('#excelFile').set_input_files({'name':'test.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':xlsx()});expect(page.locator('#excelPreview')).to_contain_text('1 ajouts possibles');expect(page.locator('#excelPreview')).to_contain_text('1 doublons');page.locator('#excelApply').click();expect(page.locator('#dataStatus')).to_contain_text('Équipements ajoutés');assert len(state['payload']['equipment'])==3
 page.locator('[data-close=dataDialog]').click();row=page.locator('tbody tr').filter(has_text='CLOUD-1');row.get_by_role('button',name='Ouvrir',exact=True).click();page.locator('#newControl').click();page.locator('#controlForm [name=intervenant]').fill('Vérificateur cloud');page.locator('#controlForm [name=result]').select_option('Bon état');page.get_by_role('button',name='Enregistrer le contrôle',exact=True).click();expect(page.locator('#control')).not_to_be_visible();assert state['payload']['equipment'][0]['controls'][0]['reportId'];pages[1].reload();expect(pages[1].locator('tbody tr').filter(has_text='CLOUD-1')).to_contain_text('Bon état');page.locator('#detail [data-close]').click();fail=True;page.get_by_role('button',name='+ Ajouter un équipement').click();page.locator('[name=identifier]').fill('FAIL');page.locator('[name=designation]').fill('Échec réseau');page.locator('#equipmentForm button').filter(has_text='Enregistrer l’équipement').click();expect(page.locator('#equipmentError')).to_contain_text('aucun enregistrement');assert len(state['payload']['equipment'])==3
 assert not errors,errors
 b.close()
print('PASS: authentification obligatoire, deux appareils, local préservé, conflit, import XLSX réel et erreur réseau sans faux succès.')
