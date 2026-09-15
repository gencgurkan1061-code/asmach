(function(root){
 'use strict';
 function init(){
  const add=document.getElementById('addModeButton'),manual=document.getElementById('acuiCreateManual'),note=document.getElementById('acuiCreateNote'),gdt=document.getElementById('acuiCreateGdt');if(!add||!manual||!note||!gdt)return;
  const trigger=document.createElement('button');trigger.id='manualToolsButton';trigger.type='button';trigger.className='btn';trigger.title='Manuel ekleme araçları · Balon B, Karakteristik C, Not N';trigger.setAttribute('aria-controls','manualToolOptions');trigger.innerHTML='<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 16 11-11 4 4L8 20H4z M13 7l4 4"/></svg>Manuel ekle';
  const group=document.createElement('div');group.id='manualToolOptions';group.className='manual-tool-options';group.setAttribute('role','group');group.setAttribute('aria-label','Manuel ekleme türü');add.before(trigger,group);group.append(manual,gdt,note);add.hidden=true;
  for(const [b,label,icon] of [[manual,'Ölçü','↔'],[gdt,'GD&T','⌖'],[note,'Not','▤']])b.textContent=icon+' '+label;
  let active=false,mode=root.ASMachApp?.state.mode,choice=add.id;
  const paint=()=>{group.hidden=!active;trigger.setAttribute('aria-expanded',String(active));trigger.setAttribute('aria-pressed',String(active));trigger.disabled=manual.disabled;gdt.disabled=manual.disabled;note.disabled=manual.disabled;for(const b of [add,manual,gdt,note])b.setAttribute('aria-pressed',String(active&&choice===b.id));};
  trigger.onclick=()=>{root.ASMachWorkspaceTabs?.activate('drawing');active=true;choice=add.id;add.click();paint();};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if([add,manual,gdt,note].includes(b)){root.ASMachWorkspaceTabs?.activate('drawing');root.ASMachApp.setMode('add');active=true;choice=b.id;}else if(['selectModeButton','boxOcrModeButton','autoDetectButton'].includes(b.id)||(b.dataset.workspaceTrigger&&b.dataset.workspaceTrigger!=='drawing'))active=false;paint();},true);
  new MutationObserver(()=>{const next=root.ASMachApp?.state.mode;if(next!==mode){mode=next;active=next==='add';if(active)choice=add.id;}paint();}).observe(add,{attributes:true,attributeFilter:['class','disabled']});
  const css=document.createElement('style');css.textContent='.toolbar #addModeButton[hidden]{display:none!important}.manual-tool-options{display:flex;align-items:center;gap:2px;padding:2px;background:#e8eef3;border:1px solid #d6e0e8;border-radius:5px}.manual-tool-options[hidden]{display:none!important}.toolbar #manualToolsButton[aria-pressed=true],.manual-tool-options .btn[aria-pressed=true]{background:#d9f2f5!important;color:#006c7e;border-color:#66b9c6!important;box-shadow:inset 0 -2px #00899d}.manual-tool-options .btn{white-space:nowrap}';document.head.append(css);paint();installShortcuts();
 }

 function installShortcuts(){
const bindings=[['b','#manualToolsButton'],['c','#acuiCreateManual'],['t','#acuiCreateGdt'],['n','#acuiCreateNote'],['v','#selectModeButton'],['k','#boxOcrModeButton'],['a','#autoDetectButton'],['r','#viewNumberingButton'],['g','#balloonSettingsButton'],['h','[data-workspace-trigger=drawing]'],['p','#rbTab-file,.wl-appbar details summary'],['e','[data-workspace-trigger=reports]'],['F2','#appSettingsButton'],['F1','#helpButton'],['+','#zoomInButton'],['-','#zoomOutButton'],['0','#fitButton']];
  for(const [key,selector] of bindings){const b=document.querySelector(selector);if(!b)continue;b.querySelectorAll('kbd,.shortcut').forEach(n=>n.remove());const label=b.getAttribute('aria-label')||b.textContent;b.setAttribute('aria-keyshortcuts',key.toUpperCase());const k=document.createElement('kbd');k.className='qt-key';k.textContent=key.toUpperCase();b.append(k);b.title=label.trim()+' · '+key.toUpperCase();}
  root.addEventListener('keydown',e=>{
   if(e.key==='F2'&&e.target.closest('#wfRows td[data-editable]'))return;
   if(e.defaultPrevented||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.target.isContentEditable||e.target.closest('input,select,textarea,[role=textbox]'))return;
   if([...document.querySelectorAll('dialog[open]:not(.wt-panel),.modal.is-visible:not(.wt-panel),.acui-modal.is-open,.busy.is-visible')].some(n=>n.getClientRects().length))return;
   const key=e.key.length===1?e.key.toLowerCase():e.key;let selector=bindings.find(([k])=>k===key)?.[1];
   if(!selector&&root.ASMachApp.state.mode==='add')selector={'2':'#acuiCreateManual','3':'#acuiCreateGdt','4':'#acuiCreateNote'}[key];
   if(!selector)return;const b=document.querySelector(selector);if(!b||b.disabled)return;e.preventDefault();e.stopImmediatePropagation();b.click();
  },true);
 }
 root.ASMachManualTools={init};
})(window);
