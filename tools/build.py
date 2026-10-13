from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument("--cloud",action="store_true",help="Inclure la configuration Supabase publique dans le HTML autonome")
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
domain=(root/'domain.mjs').read_text().replace('export function','function')
app='\n'.join(line for line in (root/'app.js').read_text().splitlines() if not line.startswith('import '))
cloud=(root/'cloud.mjs').read_text().replace('export function','function').replace('export class','class')
naming=(root/'nomenclature.mjs').read_text().replace('export function','function')
excel=(root/'excel.mjs').read_text().replace('export function','function').replace('const norm=', 'const excelNorm=').replace('norm(', 'excelNorm(')
html=html.replace('<script src="cloud-config.js"></script>','<script>'+((root/'cloud-config.js').read_text() if args.cloud else "window.VGP_CLOUD=Object.freeze({enabled:false,url:'',publicKey:'',workspaceId:''});")+ '</script>')
html=html.replace('<script src="vendor/excel.js"></script>','<script>'+(root/'vendor/excel.js').read_text()+'</script>')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="app.js"></script>','<script>'+domain+'\n'+naming+'\n'+cloud+'\n'+excel+'\n'+app+'</script>')
(root/'prototype-vgp.html').write_text(html)
