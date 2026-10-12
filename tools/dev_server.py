"""Serveur local de développement, sans dépendances externes."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import hashlib
import json
import argparse

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ('index.html', 'app.js', 'domain.mjs', 'style.css', 'cloud.mjs', 'excel.mjs', 'cloud-config.js', 'vendor/excel.js')
RELOAD = b'''<script>
(()=>{let version=null,reloading=false;
async function check(){try{const response=await fetch('/__dev/version',{cache:'no-store'});if(!response.ok)return;const next=await response.json();if(version===null){version=next.version;return;}if(next.version===version||reloading)return;
// Wait while a form/dialog is open, so unsaved input is not discarded.
if(document.querySelector('dialog[open]'))return;
reloading=true;location.reload();}catch{}}
check();setInterval(check,1000);
})();</script>'''

def version():
    digest = hashlib.sha256()
    for name in SOURCES:
        digest.update(name.encode())
        digest.update((ROOT / name).read_bytes())
    return digest.hexdigest()

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/__dev/version':
            body = json.dumps({'version': version()}).encode()
            content_type = 'application/json'
        elif path in ('/', '/index.html'):
            body = (ROOT / 'index.html').read_bytes().replace(b'</html>', RELOAD + b'</html>')
            content_type = 'text/html; charset=utf-8'
        elif path.lstrip('/') in SOURCES:
            body = (ROOT / path.lstrip('/')).read_bytes()
            content_type = 'text/css; charset=utf-8' if path.endswith('.css') else 'text/javascript; charset=utf-8'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as error:
        raise SystemExit(f'Impossible de démarrer sur le port {args.port} : {error}. Fermez le serveur précédent, puis réessayez.')
    print(f'Vérification générale périodique Goodyear Amiens : http://localhost:{args.port}', flush=True)
    print('Rechargement automatique actif. Ctrl+C pour arrêter. Gardez la même adresse pour retrouver vos données.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServeur arrêté. Les données restent dans votre navigateur.')
    finally:
        server.server_close()
