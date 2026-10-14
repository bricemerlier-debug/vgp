import json
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright,expect
source={'anticipation':30,'owners':[],'equipment':[]}
for i,(name,date) in enumerate([('EN-RETARD','2026-10-13'),('DATE-LIMITE','2026-10-14'),('UN-MOIS','2026-11-14'),('PLUS-UN-MOIS','2026-11-15'),('DEUX-MOIS','2026-12-14'),('A-DEFINIR',None),('ARCHIVE','2025-01-01')],1):
 e={'id':'fiction-'+str(i),'siteId':i,'identifier':name,'serialNumber':'','designation':name,'category':'','assignment':'','location':'Atelier fictif','sector':'','zone':'','team':'','owner':'','comments':'Donnée de test fictive','months':12,'controls':[],'archived':name=='ARCHIVE','archiveHistory':[]}
 if date:e.update(manualNextControlDate=date,manualControlId=None,dateValidation={'validated':True,'reason':'Échéance fictive de test','source':'Import fictif','by':'Testeur fictif'})
 if name=='ARCHIVE':e['archiveHistory']=[{'id':'loss-test','type':'archive','reason':'Équipement perdu','workflow':'loss-declaration','date':'2026-10-13','requester':'Testeur fictif','observations':'Recherche fictive','account':'Testeur fictif'}]
 source['equipment'].append(e)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,14,10,0,tzinfo=timezone.utc));page.add_init_script('localStorage.setItem("vgp-prototype-v1",'+json.dumps(json.dumps(source))+');');page.goto('http://127.0.0.1:8000/prototype-vgp.html#material')
 for value,n,names in [('',7,None),('En retard',1,['EN-RETARD']),('À faire',2,['DATE-LIMITE','UN-MOIS']),('Échéance à plus d’un mois',2,['PLUS-UN-MOIS','DEUX-MOIS']),('Situation à vérifier',1,['A-DEFINIR']),('Introuvable',1,['ARCHIVE']),('Archivé',0,[])]:
  card=page.locator('#stats [data-status-filter="'+value+'"]');expect(card.locator('strong')).to_have_text(str(n));card.click();expect(page.locator('#list tbody tr')).to_have_count(n)
  if names:assert sorted(page.locator('#list tbody tr').all_text_contents()) and all(name in page.locator('#list').inner_text() for name in names)
  expect(card).to_have_attribute('aria-pressed','true')
 expect(page.locator('#stats')).not_to_contain_text('Sans contrôle');page.locator('#stats [data-status-filter="Échéance à plus d’un mois"]').click();expect(page.locator('#list .badge')).to_have_text(['À jour','À jour']);page.locator('#stats [data-status-filter="À faire"]').click();expect(page.locator('#list .badge')).to_have_text(['À contrôler bientôt','À contrôler bientôt']);page.get_by_role('combobox',name='Filtrer les échéances',exact=True).click();popup=page.locator('.select-popup:visible');popup.get_by_role('searchbox').fill('définir');popup.get_by_role('option',name='Échéance à définir',exact=True).click();expect(page.locator('#list tbody tr')).to_have_count(1);expect(page.locator('#list')).to_contain_text('A-DEFINIR');assert json.loads(page.evaluate("localStorage.getItem('vgp-prototype-v1')"))==source;assert page.evaluate('document.documentElement.scrollWidth')==390;assert not errors,errors;b.close()
print('PASS échéances distinctes : retard, date limite/J-1 mois, à jour à 2 mois, sans échéance et archives ; compteurs/listes concordants sans faux contrôles ni modification des données.')
