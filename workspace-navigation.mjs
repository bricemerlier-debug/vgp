// Navigation entre pages existantes : aucun changement des données ou des règles métier.
export function installWorkspaceNavigation({navigate,openNaming}){
 const groups=[{id:'vgp',views:['material','kpi','planning','shiftCalendar','actionKpi']},{id:'personnel',views:['controllers','owners']}];
 let referenceContext=false;
 const references=document.querySelector('#referenceNavigation');
 document.querySelector('#administrationView .actions').addEventListener('click',event=>{if(event.target.closest('button'))referenceContext=true;},true);
 document.querySelector('#navigation').addEventListener('click',event=>{if(event.target.closest('[data-view]'))referenceContext=false;},true);
 for(const button of references.querySelectorAll('[data-reference-view]'))button.onclick=()=>{referenceContext=true;if(button.dataset.referenceView==='naming')openNaming();else navigate(button.dataset.referenceView);};
 const selectedView=view=>view==='shiftCalendar'?'planning':view;
 for(const group of groups){
  const tabs=[...document.querySelectorAll('#'+group.id+'Workspace [data-workspace-view]')];
  for(const [index,tab] of tabs.entries()){
   tab.onclick=()=>navigate(tab.dataset.workspaceView);
   tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length,target=tabs[i];navigate(target.dataset.workspaceView);if(target.getAttribute('aria-selected')==='true')target.focus();};
  }
 }
 return {update(view,origin='material'){
  const effective=view==='equipment'?origin:view;const planning=document.querySelector('#planningView');planning.hidden=!['planning','shiftCalendar'].includes(view);planning.dataset.shiftView=String(view==='shiftCalendar');
  if(['administration','naming','mailSettings'].includes(effective))referenceContext=true;else if(!['owners','controllers'].includes(effective))referenceContext=false;
  references.hidden=effective==='administration'||!referenceContext;for(const button of references.querySelectorAll('[data-reference-view]')){if(button.dataset.referenceView===effective)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  for(const group of groups){const active=group.views.includes(effective),host=document.querySelector('#'+group.id+'Workspace');host.hidden=!active;const intro=host.querySelector('.workspace-intro');if(intro)intro.hidden=view==='equipment';
   for(const tab of host.querySelectorAll('[data-workspace-view]')){const selected=tab.dataset.workspaceView===selectedView(effective);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
   const menu=document.querySelector('[data-nav-group="'+group.id+'"]');if(active)menu.setAttribute('aria-current','page');else menu.removeAttribute('aria-current');
  }
 }};
}
