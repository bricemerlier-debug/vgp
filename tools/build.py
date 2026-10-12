from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
domain=(root/'domain.mjs').read_text().replace('export function','function')
app=(root/'app.js').read_text().split('\n',1)[1]
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="app.js"></script>','<script>'+domain+'\n'+app+'</script>')
(root/'prototype-vgp.html').write_text(html)
