from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/prototype-vgp.html');page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.locator('[data-view=kpi]').click()
 for kind,count in [('active',2),('missing',1),('controlled',1),('todo',1),('history',1),('overdue',1),('undefined',1),('result:Bon état',1)]:
  page.locator('#kpiVisual').locator('[data-kpi-list="'+kind+'"]').first.click();expect(page.locator('#kpiListContent tbody tr')).to_have_count(count);page.locator('#kpiListDialog [data-close]').click()
 # Prepare valid archival records without modifying tracked fixtures.
 page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.locator('[data-view=material]').click()
 page.get_by_role('button',name='+ Ajouter un équipement').click();form=page.locator('#equipmentForm');form.locator('[name=identifier]').fill('SCRAP');form.locator('[name=designation]').fill('Anneau à jeter');form.get_by_role('button',name='Enregistrer l’équipement').click()
 data=json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))
 for e,reason in [(data['equipment'][1],'Équipement perdu'),(data['equipment'][2],'Mis au rebut')]:
  e['archived']=True;e['archiveHistory']=[{'id':'a-'+e['id'],'type':'archive','reason':reason,'date':'2026-10-01','requester':'Test','observations':'','created':1,'generated':True,'snapshot':{key:str(e.get(key,'')) for key in ['identifier','serialNumber','designation','category','location','sector','team','owner','assignment']},'approvalDate':'2026-10-01','approver':'Test','validated':1,'signedAttachment':{'name':'test.pdf','url':'data:application/pdf;base64,JVBERg=='}}]
 page.evaluate('(d)=>localStorage.setItem("vgp-prototype-v1",JSON.stringify(d))',data);page.reload();page.locator('#archivedEquipmentTab').click()
 expect(page.locator('#list tr.lost-row')).to_have_count(1);expect(page.locator('#list tr.scrapped-row')).to_have_count(1)
 assert 'Équipement perdu' in page.locator('#list tr.lost-row').inner_text();assert 'Mis au rebut' in page.locator('#list tr.scrapped-row').inner_text()
 assert page.locator('#list tr.lost-row').evaluate('(e)=>getComputedStyle(e).backgroundColor')!=page.locator('#list tr.scrapped-row').evaluate('(e)=>getComputedStyle(e).backgroundColor')
 page.locator('#archiveReasonFilter').select_option('Équipement perdu');expect(page.locator('#list tbody tr')).to_have_count(1);page.locator('#archiveReasonFilter').select_option('Mis au rebut');expect(page.locator('#list tbody tr')).to_have_count(1)
 page.set_viewport_size({'width':390,'height':844});assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
 assert not errors,errors;b.close();print('PASS: cartes KPI/listes, échéances/résultats/historique, motifs archives distincts et filtres, mobile')
