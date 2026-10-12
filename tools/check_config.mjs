import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validateConfig} from '../cloud.mjs';
const source=readFileSync('cloud-config.js','utf8');
if(source.includes('sb_secret_')&&!source.split('\n').filter(l=>!l.trim().startsWith('//')).every(l=>!l.includes('sb_secret_')))throw Error('Clé secrète interdite.');
const sandbox={window:{},document:{documentElement:{classList:{add(){}}}}};runInNewContext(source,sandbox);validateConfig({...sandbox.window.VGP_CLOUD,enabled:!!sandbox.window.VGP_CLOUD.publicKey});console.log('Configuration publique vérifiée.');
