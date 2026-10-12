from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/prototype-vgp.html')
 for i in range(1,5):
  page.get_by_role('button',name='+ Ajouter un équipement').click();f=page.locator('#equipmentForm');f.locator('[name=identifier]').fill('JUIN-'+str(i));f.locator('[name=designation]').fill('Anneau juin '+str(i));page.get_by_role('button',name='Date manuelle du prochain contrôle').click();f.locator('[name=manualNextControlDate]').fill('2026-06-20');f.get_by_role('button',name='Enregistrer l’équipement').click()
  if i<4:
   page.locator('#list tbody tr').filter(has_text='JUIN-'+str(i)).get_by_role('button',name='Ouvrir',exact=True).click();page.get_by_role('button',name='+ Enregistrer un contrôle').click();c=page.locator('#controlForm');c.locator('[name=date]').fill('2026-07-01');c.locator('[name=intervenant]').fill('Testeur');c.locator('[name=result]').select_option('Bon état');c.get_by_role('button',name='Enregistrer le contrôle',exact=True).click();page.locator('#detail [data-close]').click()
 page.reload();page.get_by_role('button',name='Ouvrir le menu',exact=True).click();page.locator('[data-view=kpi]').click();page.locator('#monthlyYear').fill('2026');page.locator('#monthlyYear').dispatch_event('change')
 june=page.locator('.month-card').filter(has=page.get_by_role('heading',name='Juin',exact=True));assert '75 %' in june.inner_text() and '3 / 4' in june.inner_text()
 june.get_by_role('button',name='25 % non réalisés').click();expect(page.locator('#monthlyRemainingList tbody tr')).to_have_count(1);assert 'JUIN-4' in page.locator('#monthlyRemainingList').inner_text();assert 'En retard' in page.locator('#monthlyRemainingList').inner_text();page.get_by_role('button',name='Ouvrir la fiche',exact=True).click();expect(page.locator('#detail')).to_be_visible();assert 'JUIN-4' in page.locator('#detailTitle').inner_text();page.locator('#detail [data-close]').click()
 page.set_viewport_size({'width':390,'height':844});assert page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth')
 assert not errors,errors;b.close();print('PASS: planning juin conservé après réalisation, courbe 75%, clic 25%, liste en retard, fiche, persistance, mobile')
