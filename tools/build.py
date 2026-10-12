from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
domain=(root/'domain.mjs').read_text().replace('export function','function')
app='\n'.join(line for line in (root/'app.js').read_text().splitlines() if not line.startswith('import '))
cloud=(root/'cloud.mjs').read_text().replace('export function','function').replace('export class','class')
excel=(root/'excel.mjs').read_text().replace('export function','function').replace('const norm=', 'const excelNorm=').replace('norm(', 'excelNorm(')
html=html.replace('<script src="cloud-config.js"></script>','<script>'+(root/'cloud-config.js').read_text()+'</script>')
html=html.replace('<script src="vendor/excel.js"></script>','<script>'+(root/'vendor/excel.js').read_text()+'</script>')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="app.js"></script>','<script>'+domain+'\n'+cloud+'\n'+excel+'\n'+app+'</script>')
(root/'prototype-vgp.html').write_text(html)
