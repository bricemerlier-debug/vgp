import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildVgpEquipmentMail,buildVgpMailDraft,vgpMailTemplateIssue,vgpMailPhotoValid} from '../vgp-mail.mjs';
import {createVgpGmail} from '../vgp-mail-gmail.mjs';
import {equipmentLossFormUrl,createLossLinkClient} from '../loss-link-api.mjs';
import {approved} from './fixtures.mjs';
import {goodyearReportLogo} from '../assets/report-logo.mjs';

function fixture(){return {ownerContacts:[{owner:'Responsable Test',email:'responsable@example.test'}],mailTemplates:[{kind:'month',subject:'Contrôle {{numero_interne}} — {{nom_equipement}}',body:'Bonjour {{nom_proprietaire}},\n\nPrésentez {{numero_interne}} avant le {{date_controle}}.'}],equipment:[approved({id:'equipment-1',identifier:'TEST-001',designation:'Harnais de test',category:'Harnais',location:'Atelier',assignment:'',owner:'Responsable Test',sector:'B2 - Cuisson',months:12,controls:[],firstControlDate:'2026-11-21',mailPhoto:{width:1000,height:187,data:goodyearReportLogo.data}})]};}
const prepare=(state=fixture(),options={})=>buildVgpEquipmentMail(state,{equipmentId:'equipment-1',kind:'month',sender:'expediteur@example.test',...options});

test('destinataire repris depuis le propriétaire, modèles substitués et photo intégrée',()=>{
 const state=fixture(),before=JSON.stringify(state),mail=prepare(state);
 assert.equal(mail.recipient,'responsable@example.test');assert.equal(mail.sender,'expediteur@example.test');
 assert.match(mail.subject,/^\[TEST\] Contrôle TEST-001/);assert.match(mail.text,/21\/11\/2026/);assert.ok(!mail.text.includes('{{'));
 assert.match(mail.html,/cid:goodyear-logo/);assert.match(mail.html,/cid:equipment-photo/);assert.match(mail.html,/MESSAGE DE TEST/);
 assert.equal(mail.attachments.length,2);assert.match(mail.previewHtml,/src="data:image\/jpeg;base64,/);
 const override=prepare(state,{recipient:'chef@example.test'});assert.equal(override.recipient,'chef@example.test');assert.equal(JSON.stringify(state),before);
});

test('archives exclues, adresses contrôlées, texte échappé et photo invalide ignorée',()=>{
 const state=fixture();state.equipment[0].designation='<img src=x onerror=alert(1)>';
 assert.match(prepare(state).html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.ok(!prepare(state).html.includes('<img src=x'));
 assert.throws(()=>prepare(state,{recipient:'a@example.test\r\nBcc: vol@example.test'}),/destinataire/);
 assert.throws(()=>prepare(state,{sender:'a@example.test\nX: bad'}),/expéditrice/);
 state.equipment[0].mailPhoto={data:'https://example.test/photo.jpg'};assert.equal(prepare(state).attachments.length,1);
 state.equipment[0].archived=true;assert.throws(()=>prepare(state),/équipement actif/);
 assert.equal(vgpMailPhotoValid({width:100,height:100,data:goodyearReportLogo.data}),true);
 assert.equal(vgpMailPhotoValid({width:1500,height:100,data:goodyearReportLogo.data}),false);
 assert.match(vgpMailTemplateIssue({subject:'{{inconnu}}',body:'Bonjour'}),/inconnu/);
});

test('brouillon MIME : adresses, objet UTF-8, HTML et images CID',()=>{
 const mail=prepare(),draft=buildVgpMailDraft(mail,{now:new Date('2026-10-21T10:00:00Z'),id:'test'});
 assert.match(draft,/From: expediteur@example.test\r\nTo: responsable@example.test/);
 assert.match(draft,/X-Unsent: 1/);assert.match(draft,/multipart\/related/);assert.match(draft,/Content-ID: <equipment-photo>/);
 assert.match(draft,/Content-Type: text\/html; charset=UTF-8/);
 const htmlBase64=draft.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g,'');
 assert.equal(Buffer.from(htmlBase64,'base64').toString('utf8'),mail.html);
 assert.throws(()=>buildVgpMailDraft({...mail,recipient:''}),/destinataire/);
 assert.throws(()=>buildVgpMailDraft({...mail,sender:''}),/compte/);
});

test('bouton de perte : lien personnel dans le HTML et le texte, aperçu inactif sans lien',()=>{
 const token='a'.repeat(64),url=equipmentLossFormUrl('https://site.example.test/vgp/?mailTo=test#mailSettings',token);
 assert.equal(url,'https://site.example.test/vgp/declarer-perte.html#token='+token);
 const mail=prepare(fixture(),{lossUrl:url,test:false});
 assert.ok(mail.html.includes('href="'+url+'"'));assert.match(mail.html,/Déclarer ce matériel perdu/);assert.ok(mail.text.includes(url));
 assert.match(prepare().previewHtml,/Le lien personnel sera ajouté/);assert.ok(!prepare().html.includes('href="#'));
 assert.throws(()=>prepare(fixture(),{lossUrl:'javascript:alert(1)'}),/Lien/);
 assert.throws(()=>equipmentLossFormUrl('https://site.example.test','bad'),/invalide/);
});

test('formulaire public : seule la capacité du lien est transmise, aucun compte administrateur',async()=>{
 const calls=[],client=createLossLinkClient({enabled:true,url:'https://test.supabase.co',publicKey:'sb_publishable_test'},{fetcher:async(url,request)=>{calls.push({url,request});return {ok:true,json:async()=>({status:'ready'})};}});
 await client.read('a'.repeat(64));await client.submit('a'.repeat(64),{name:'Destinataire Test',details:'Recherches fictives',signature:{},accepted:true});
 assert.equal(calls.length,2);assert.equal(calls[0].request.headers.Authorization,undefined);
 assert.equal(calls[0].request.headers.apikey,'sb_publishable_test');assert.deepEqual(JSON.parse(calls[0].request.body),{token:'a'.repeat(64)});
 assert.equal(JSON.parse(calls[1].request.body).equipment_id,undefined);
 assert.throws(()=>client.read('bad'),/incomplet/);
});

function mockedGoogle(email='expediteur@example.test'){
 const calls=[],browser={google:{accounts:{oauth2:{initTokenClient(config){
  assert.match(config.scope,/gmail.send/);
  return {requestAccessToken(){config.callback({access_token:'token-fictif',expires_in:3600});}};
 }}}}};
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.includes('userinfo'))return {ok:true,json:async()=>({email,email_verified:true})};return {ok:true,status:200,json:async()=>({id:'message-fictif'})};};
 return {browser,calls,fetcher};
}

test('Gmail : compte autorisé vérifié, envoi explicite du test avec photo, aucun jeton persisté',async()=>{
 const mock=mockedGoogle(),gmail=createVgpGmail({clientId:'fictif.apps.googleusercontent.com',...mock});
 assert.equal(mock.calls.length,0);assert.equal(gmail.active(),null);
 await assert.rejects(()=>gmail.sendTest(prepare()),/Connecte/);
 await gmail.connect('expediteur@example.test');assert.equal(mock.calls.length,1);assert.equal(gmail.active().email,'expediteur@example.test');
 const result=await gmail.sendTest(prepare());assert.equal(result.id,'message-fictif');assert.equal(mock.calls.length,2);
 const sent=mock.calls[1];assert.match(sent.url,/gmail\/v1\/users\/me\/messages\/send/);
 const raw=JSON.parse(sent.options.body).raw,decoded=Buffer.from(raw,'base64url').toString('utf8');
 assert.match(decoded,/Content-ID: <equipment-photo>/);assert.ok(!decoded.includes('X-Unsent'));
 await assert.rejects(()=>gmail.sendTest(prepare(fixture(),{test:false})),/Seuls les messages de test/);
 gmail.disconnect();assert.equal(gmail.active(),null);
});

test('Gmail : configuration absente et compte différent bloquent l’envoi',async()=>{
 const empty=createVgpGmail();assert.equal(empty.configured(),false);await assert.rejects(()=>empty.connect('a@example.test'),/configurée/);
 const mock=mockedGoogle('autre@example.test'),gmail=createVgpGmail({clientId:'fictif.apps.googleusercontent.com',...mock});
 await assert.rejects(()=>gmail.connect('expediteur@example.test'),/correspondant/);assert.equal(gmail.active(),null);assert.equal(mock.calls.length,1);
});

test('Gmail : réponse inconnue signalée sans réessai automatique',async()=>{
 const mock=mockedGoogle();let sends=0;
 const gmail=createVgpGmail({clientId:'fictif.apps.googleusercontent.com',browser:mock.browser,fetcher:async(url,options)=>{if(url.includes('userinfo'))return mock.fetcher(url,options);sends++;throw new TypeError('Network failed');}});
 await gmail.connect('expediteur@example.test');await assert.rejects(()=>gmail.sendTest(prepare()),error=>error.uncertain===true&&/Vérifie les messages envoyés/.test(error.message));assert.equal(sends,1);
});

test('modèle retard personnalisé avec échéance, photo et déclaration de perte',async()=>{
 const {vgpMailDefaultTemplates,vgpMailKinds}=await import('../vgp-mail.mjs');
 const state=fixture();state.mailTemplates=vgpMailDefaultTemplates();
 assert.equal(vgpMailKinds.length,5);
 const mail=buildVgpEquipmentMail(state,{equipmentId:'equipment-1',kind:'overdue'});
 assert.match(mail.subject,/en retard/);assert.match(mail.text,/21\/11\/2026/);
 assert.match(mail.previewHtml,/Tous les 7 jours/);assert.equal(mail.hasPhoto,true);
});

test('aucun accès à la fiche interne dans les mails destinataires',()=>{
 const mail=buildVgpEquipmentMail(fixture(),{equipmentId:'equipment-1',siteUrl:'https://interne.example.test/'});
 for(const content of [mail.html,mail.previewHtml,mail.text]){
  assert.doesNotMatch(content,/Voir la fiche|interne\.example\.test|#equipment\//);
 }
});

test('verrou test : un rappel réel est refusé avant tout appel Gmail',async()=>{
 let calls=0;
 const gmail=createVgpGmail({clientId:'public.apps.googleusercontent.com',fetcher:async()=>{calls++;throw Error('Aucun appel attendu');}});
 await assert.rejects(()=>gmail.sendMail({test:false,lossUrl:'https://example.test/declarer-perte.html'}),/Envoi réel désactivé/);
 assert.equal(calls,0);
});

test('mise au rebut : encart distinct et lien personnel dans le HTML et le texte',()=>{
 const scrapUrl='https://example.test/declarer-rebut.html#token='+'a'.repeat(64);
 const mail=buildVgpEquipmentMail(fixture(),{equipmentId:'equipment-1',scrapUrl});
 assert.match(mail.html,/Déclarer la mise au rebut/);assert.ok(mail.html.includes(scrapUrl));assert.ok(mail.text.includes(scrapUrl));
 assert.match(mail.previewHtml,/Vous ne retrouvez plus/);assert.match(mail.previewHtml,/Ce matériel a été mis au rebut/);
 assert.match(mail.previewHtml,/<tr><td class="mail-action-cell" width="50%"[\s\S]*?Vous ne retrouvez plus[\s\S]*?<\/td><td class="mail-action-cell" width="50%"[\s\S]*?Ce matériel a été mis au rebut/);
 assert.match(mail.previewHtml,/border-top:4px solid #ffda00/);assert.match(mail.previewHtml,/border-top:4px solid #0055a4/);
 assert.doesNotMatch(mail.previewHtml,/#934538|#fff6f3/);
 assert.throws(()=>buildVgpEquipmentMail(fixture(),{equipmentId:'equipment-1',scrapUrl:'javascript:alert(1)'}),/Lien de mise au rebut invalide/);
});
