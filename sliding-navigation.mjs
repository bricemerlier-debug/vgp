export function installSlidingNavigation(){
 const menu=document.querySelector('#navigation'),toggle=document.querySelector('#menuToggle');
 const edge=document.createElement('div');edge.className='navigation-hover-edge';edge.setAttribute('aria-hidden','true');document.body.append(edge);
 const pointer=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const nativeClose=menu.close.bind(menu);let hovering=false,timer,animation,generation=0,pointerX=-1,pointerY=-1;document.addEventListener('pointermove',event=>{pointerX=event.clientX;pointerY=event.clientY;});
 const cancel=()=>{clearTimeout(timer);};
 const animate=(from,to)=>{animation?.cancel();animation=menu.animate([{transform:`translateX(${from})`,opacity:from==='0%'?1:0.5},{transform:`translateX(${to})`,opacity:to==='0%'?1:0.5}],{duration:reduced.matches?0:220,easing:'ease-out',fill:'forwards'});return animation;};
 menu.close=(value)=>{cancel();if(!menu.open)return;const run=++generation;animate('0%','-100%').finished.then(()=>{if(run!==generation)return;nativeClose(value);animation?.cancel();hovering=false;toggle.setAttribute('aria-expanded','false');}).catch(()=>{});};
 function open(hover=false){cancel();if(document.body.classList.contains('cloud-locked')||[...document.querySelectorAll('dialog[open]')].some(d=>d!==menu))return;if(menu.open){if(animation?.playState==='running'){generation++;animate('-100%','0%');}return;}generation++;hovering=hover;const focused=document.activeElement;if(hover)menu.show();else menu.showModal();toggle.setAttribute('aria-expanded','true');animate('-100%','0%');if(hover&&focused instanceof HTMLElement){focused.focus({preventScroll:true});if(menu.contains(document.activeElement))document.activeElement.blur();}}
 function leave(){cancel();if(hovering&&!menu.contains(document.activeElement))timer=setTimeout(()=>{const r=menu.getBoundingClientRect();if(pointerX>=r.left&&pointerX<=r.right&&pointerY>=r.top&&pointerY<=r.bottom)return;menu.close();},260);}
 edge.addEventListener('pointerenter',()=>{if(pointer.matches)open(true);});toggle.addEventListener('pointerenter',()=>{if(pointer.matches)open(true);});menu.addEventListener('pointerenter',cancel);menu.addEventListener('pointerleave',leave);edge.addEventListener('pointerleave',leave);
 menu.addEventListener('focusout',()=>queueMicrotask(()=>{if(!menu.matches(':hover'))leave();}));
 toggle.onclick=()=>{if(menu.open){if(hovering){hovering=false;menu.querySelector('[aria-current="page"]')?.focus();}else menu.close();}else open();};
 menu.addEventListener('cancel',event=>{event.preventDefault();menu.close();});menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&hovering){event.preventDefault();menu.close();}});
 menu.addEventListener('click',event=>{if(event.target===menu){const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();}});
 menu.addEventListener('close',()=>{cancel();hovering=false;toggle.setAttribute('aria-expanded','false');});
}
