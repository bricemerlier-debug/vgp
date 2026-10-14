// Preserve native form values and change handlers behind a searchable popup.
export function installSearchableSelects(){
 const widgets=new WeakMap();let opened=null,sequence=0;
 const key=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 function enhance(select){
  if(select.hasAttribute('data-native-select')||widgets.has(select))return;
  const label=select.closest('label')?.childNodes[0]?.textContent?.trim()||select.getAttribute('aria-label')||'Choix';
  const wrapper=document.createElement('div');wrapper.className='searchable-select';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='select-popup';panel.hidden=true;
  const search=document.createElement('input');search.type='search';search.placeholder='Rechercher…';search.autocomplete='off';search.setAttribute('aria-label','Rechercher : '+label);
  const list=document.createElement('div');list.className='select-options';list.id='select-options-'+(++sequence);list.setAttribute('role','listbox');list.setAttribute('aria-label',label);trigger.setAttribute('aria-controls',list.id);
  panel.append(search,list);wrapper.append(trigger,panel);select.after(wrapper);select.classList.add('select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  let active=-1,buttons=[];
  const close=()=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(opened===widget)opened=null;};
  const sync=()=>{const text=(select.selectedOptions[0]?.textContent||'Choisir…')+' ▾';if(trigger.textContent!==text)trigger.textContent=text;trigger.disabled=select.disabled;if(select.disabled)close();};
  const move=index=>{active=index;buttons.forEach((button,i)=>{button.classList.toggle('is-active',i===active);});if(buttons[active]){search.setAttribute('aria-activedescendant',buttons[active].id);buttons[active].scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');};
  const filter=()=>{list.replaceChildren();buttons=[];active=-1;for(const [i,option] of [...select.options].entries()){if(option.disabled||!key(option.textContent).includes(key(search.value)))continue;const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.id=list.id+'-'+i;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));button.textContent=option.textContent;button.onmousedown=event=>event.preventDefault();button.onclick=event=>{event.preventDefault();select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus();};list.append(button);buttons.push(button);}if(!buttons.length){const empty=document.createElement('p');empty.textContent='Aucun résultat';empty.setAttribute('role','status');list.append(empty);}search.removeAttribute('aria-activedescendant');};
  const open=()=>{if(select.disabled)return;if(opened&&opened!==widget)opened.close();opened=widget;search.value='';filter();panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus();};
  const widget={close,sync};widgets.set(select,widget);
  trigger.onclick=event=>{event.preventDefault();panel.hidden?open():close();};trigger.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();move(event.key==='ArrowDown'?0:buttons.length-1);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  search.oninput=filter;search.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();trigger.focus();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(buttons.length)move((active+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length);}else if(event.key==='Enter'){event.preventDefault();if(buttons[active])buttons[active].click();else if(buttons.length===1)buttons[0].click();}};
  wrapper.addEventListener('focusout',()=>queueMicrotask(()=>{if(!wrapper.contains(document.activeElement))close();}));select.addEventListener('change',sync);select.form?.addEventListener('reset',()=>requestAnimationFrame(sync));
  new MutationObserver(()=>{sync();if(!panel.hidden)filter();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});sync();
 }
 const scan=()=>{document.querySelectorAll('select').forEach(enhance);document.querySelectorAll('select').forEach(s=>widgets.get(s)?.sync());};
 document.addEventListener('click',event=>{if(opened&&!event.target.closest('.searchable-select'))opened.close();});document.addEventListener('close',()=>opened?.close(),true);window.addEventListener('resize',()=>opened?.close());scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
}
