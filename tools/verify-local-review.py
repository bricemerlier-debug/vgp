"""Recette ciblée locale ; aucun accès à une production ou une messagerie."""
from pathlib import Path
import subprocess,json,sys,socket,urllib.request,time
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'artifacts/local-review';ART.mkdir(parents=True,exist_ok=True)
commands=[
 ['python','tools/build.py'],
 ['node','--test','tests/reminders.test.mjs','tests/reminder_worker.test.mjs','tests/nomenclature.test.mjs','tests/naming_review.test.mjs','tests/ownership.test.mjs','tests/digest.test.mjs','tests/weekly.test.mjs'],
 ['node','tests/cloud.mjs'],['node','tests/database.mjs'],['node','tests/digest_worker.mjs'],['node','tests/digest_database.mjs'],
 *[['python','tests/'+name+'.py'] for name in ['workspace_paths_browser','workspace_reader_browser','home_browser','naming_review_browser','naming_review_cloud_browser','nomenclature_browser','material_naming_filters_browser','calendar_status_colors']]
]
server=None
try:
 with socket.socket() as sock:
  if sock.connect_ex(('127.0.0.1',8000))!=0:
   server=subprocess.Popen([sys.executable,'-m','http.server','8000','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   for _ in range(30):
    try:urllib.request.urlopen('http://127.0.0.1:8000/app.js',timeout=1);break
    except OSError:time.sleep(.1)
 if urllib.request.urlopen('http://127.0.0.1:8000/app.js').read()!=(ROOT/'app.js').read_bytes():raise RuntimeError('Le port 8000 ne sert pas ce checkout ; arrêter ce serveur avant la recette.')
 results=[]
 with (ART/'validation.log').open('w') as log:
  for cmd in commands:
   label=' '.join(cmd);print(label,flush=True);log.write('\n$ '+label+'\n');log.flush();started=time.monotonic();result=subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
   results.append({'command':label,'exit_code':result.returncode,'seconds':round(time.monotonic()-started,2)})
   (ART/'validation.json').write_text(json.dumps({'scope':'Recette isolée, données fictives, aucun mail réel, aucune publication','results':results},ensure_ascii=False,indent=2)+'\n')
   if result.returncode:print('ÉCHEC : voir artifacts/local-review/validation.log',flush=True);sys.exit(result.returncode)
 print('PASS : '+str(len(results))+' commandes de validation ; preuves dans artifacts/local-review/',flush=True)
finally:
 if server:server.terminate();server.wait(timeout=5)
