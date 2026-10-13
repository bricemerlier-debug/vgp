from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
server=None
style=ROOT/'style.css';original=style.read_bytes()
def start():
 p=subprocess.Popen(['python','-u',str(ROOT/'tools/dev_server.py'),'--port','8002'],stdout=subprocess.PIPE,text=True)
 assert 'http://localhost:8002' in p.stdout.readline()
 return p
try:
 server=start()
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=b.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/cloud-config.js',lambda r:r.fulfill(body="window.VGP_CLOUD={enabled:false};",content_type='text/javascript'));page.goto('http://localhost:8002/#material')
  page.get_by_role('button',name='+ Ajouter un équipement').click()
  form=page.locator('#equipmentForm')
  form.locator('#initial summary').click()
  for name,value in [('identifier','LIVE-001'),('designation','Essai persistant'),('date','2026-06-01'),('intervenant','Testeur')]:form.locator('[name='+name+']').fill(value)
  form.locator('[name=result]').select_option('Bon état')
  form.get_by_role('button',name='Enregistrer l’équipement').click()
  before=page.evaluate("localStorage.getItem('vgp-prototype-v1')")
  page.reload()
  assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==before
  page.wait_for_timeout(1200)
  page.get_by_role('button',name='+ Ajouter un équipement').click()
  form.locator('[name=identifier]').fill('SAISIE-NON-ENREGISTREE')
  style.write_bytes(original+b'\n/* test live reload */\n')
  page.wait_for_timeout(1500)
  assert form.locator('[name=identifier]').input_value()=='SAISIE-NON-ENREGISTREE'
  with page.expect_navigation():page.locator('#editor [data-close]').click()
  assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==before
  server.terminate();server.wait(timeout=5);server=start()
  page.reload()
  assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")==before
  page.locator('#search').fill('LIVE-001')
  page.get_by_role('button',name='Ouvrir',exact=True).click()
  assert '01/06/2026' in page.locator('#detailContent').inner_text()
  assert page.get_by_role('button',name='Télécharger le PDF').count()==1
  assert page.request.get('http://localhost:8002/.git/config').status==404
  # An empty existing dataset must remain empty; corrupted data must not be replaced.
  page.evaluate("localStorage.setItem('vgp-prototype-v1',JSON.stringify({anticipation:30,equipment:[],owners:[]}))")
  page.reload();expect(page.get_by_text('Aucun équipement correspondant.',exact=True)).to_be_visible()
  page.evaluate("localStorage.setItem('vgp-prototype-v1','broken original data')")
  page.reload();expect(page.locator('#message')).to_contain_text('aucune donnée existante')
  page.get_by_role('button',name='+ Ajouter un équipement').click()
  form.locator('[name=identifier]').fill('ATTEMPT');form.locator('[name=designation]').fill('Do not overwrite')
  form.get_by_role('button',name='Enregistrer l’équipement').click()
  assert page.evaluate("localStorage.getItem('vgp-prototype-v1')")=='broken original data'
  assert not errors,errors
  b.close()
 print('PASS: rechargement automatique, formulaire préservé, contrôles et équipements après rafraîchissement/redémarrage, parc vide conservé, données corrompues protégées')
finally:
 style.write_bytes(original)
 if server:server.terminate();server.wait(timeout=5)
