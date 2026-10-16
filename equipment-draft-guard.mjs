export function installEquipmentDraftGuard({form,editor,saveForm,onClean}){
 let baseline='',pending=null;
 const values=()=>JSON.stringify([...form.elements].filter(e=>e.name&&!['submit','button'].includes(e.type)).map(e=>[e.name,e.type==='checkbox'||e.type==='radio'?e.checked:e.value,e.type==='file'?[...e.files].map(f=>[f.name,f.size,f.lastModified]):null]));
 const dirty=()=>editor.open&&values()!==baseline;
 const dialog=document.createElement('dialog');dialog.id='equipmentUnsaved';dialog.setAttribute('aria-labelledby','equipmentUnsavedTitle');dialog.innerHTML='<h2 id="equipmentUnsavedTitle">Enregistrer les modifications ?</h2><p>Cette fiche contient des changements non enregistrés.</p><div class="actions"><button type="button" data-draft-save>Enregistrer et continuer</button><button type="button" class="secondary" data-draft-discard>Abandonner les changements</button><button type="button" class="secondary" data-draft-stay autofocus>Continuer la saisie</button></div>';document.body.append(dialog);
 const stay=()=>{pending=null;dialog.close();};dialog.querySelector('[data-draft-stay]').onclick=stay;dialog.addEventListener('cancel',()=>{pending=null;});
 dialog.querySelector('[data-draft-discard]').onclick=()=>{const next=pending;pending=null;onClean();baseline=values();dialog.close();next?.();};
 dialog.querySelector('[data-draft-save]').onclick=async()=>{const next=pending;pending=null;dialog.close();if(!form.reportValidity())return;if(await saveForm())next?.();};
 function request(next){if(!dirty()){next();return;}if(dialog.open)return;pending=next;dialog.showModal();}
 editor.addEventListener('cancel',event=>{if(dirty()){event.preventDefault();request(()=>editor.close());}});
 return {dirty,request,reset(){baseline=values();onClean();},close(){request(()=>editor.close());}};
}
