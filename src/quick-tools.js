(function(root){
 function init(){
  const shortcuts=new Map();
  let measurementType=document.getElementById('boxMeasurementType');
  if(!measurementType){measurementType=document.createElement('input');measurementType.type='hidden';measurementType.id='boxMeasurementType';measurementType.value='';document.body.append(measurementType);}
  function choices(id,items){const select=document.getElementById(id);if(!select)return;select.hidden=true;const bar=document.createElement('div');bar.className='qt-options';bar.setAttribute('role','group');bar.setAttribute('aria-label',select.getAttribute('aria-label'));select.after(bar);
   for(const [value,label,key] of items){const button=document.createElement('button');button.type='button';button.className='btn qt-choice';button.dataset.choice=value;button.dataset.for=id;button.textContent=label;button.title=label+' · '+key.toUpperCase();button.setAttribute('aria-keyshortcuts',key.toUpperCase());button.onclick=()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};bar.append(button);shortcuts.set(key,button);}
   const sync=()=>bar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(root.ASMachApp?.state.mode==='box'&&b.dataset.choice===select.value)));select.addEventListener('change',sync);const modeButton=document.getElementById('boxOcrModeButton');if(modeButton)new MutationObserver(sync).observe(modeButton,{attributes:true,attributeFilter:['class']});sync();
  }
  choices('boxContentMode',[['auto','Otomatik','1'],['dimension','Ölçü','2'],['gdt','GD&T','3'],['note','Not OCR','4']]);choices('boxScanMode',[['smart','Akıllı','s'],['controlled','Kontrollü','d']]);
  for(const [id,label,key] of [['acuiCreateManual','Karakteristik','c'],['acuiCreateNote','Not ekle','n'],['viewNumberingButton','Balon sırası','r'],['balloonSettingsButton','Balon stili','g'],['autoDetectButton','Otomatik tespit','a']]){const b=document.getElementById(id);if(!b)continue;b.textContent=label;b.title=label+' · '+key.toUpperCase();b.setAttribute('aria-keyshortcuts',key.toUpperCase());shortcuts.set(key,b);}
document.addEventListener('keydown',e=>{if(root.ASMachKeyboard?.inWorkspace()||e.repeat||e.isComposing||e.shiftKey||e.metaKey||e.altKey||e.ctrlKey)return;if(e.target.isContentEditable||e.target.closest('input,select,textarea,[role=textbox]')||[...document.querySelectorAll('dialog[open],.modal.is-visible,.wf-dialog.is-visible,.busy.is-visible')].some(n=>n.getClientRects().length))return;const button=shortcuts.get(e.key.toLowerCase());if(!button||button.disabled||(button.classList.contains('qt-choice')&&root.ASMachApp?.state.mode!=='box'))return;e.preventDefault();e.stopImmediatePropagation();button.click();},true);
  const box=document.getElementById('boxOcrModeButton'),autoDetect=document.getElementById('autoDetectButton');
  if(box&&autoDetect){const scan=document.querySelector('[data-for="boxScanMode"]')?.parentElement,content=document.querySelector('[data-for="boxContentMode"]')?.parentElement;if(scan&&content)box.after(scan,content,autoDetect);}
  for(const b of document.querySelectorAll('.toolbar [aria-keyshortcuts]')){const k=document.createElement('kbd');k.className='qt-key';k.textContent=b.getAttribute('aria-keyshortcuts').replace('Control','Ctrl').replace(/\+([a-z])$/,(_,letter)=>'+'+letter.toUpperCase());b.append(k);}
  for(const [id,key] of [['undoButton','Ctrl+Z'],['redoButton','Ctrl+Y']]){const b=document.getElementById(id);if(b){const k=document.createElement('kbd');k.className='qt-key';k.textContent=key;b.append(k);}}
  installDrawingMenu();
  installPointerBadge();
  const paths={smart:'M12 2 9 9 2 12 9 15 12 22 15 15 22 12 15 9Z',controlled:'M4 4h16v16H4z M7 12l3 3 7-7',auto:'M4 7h12l-3-3 M20 17H8l3 3 M18 7a7 7 0 0 1 2 7 M6 17a7 7 0 0 1-2-7',dimension:'M3 6h18v12H3z M7 6v5 M12 6v3 M17 6v5',gdt:'M12 2v20 M2 12h20 M5 5h14v14H5z',note:'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5'};
  document.querySelectorAll('.qt-choice').forEach(b=>b.insertAdjacentHTML('afterbegin',`<svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${paths[b.dataset.choice]||paths.auto}"/></svg>`));
  const contextual=document.createElement('style');contextual.textContent='.toolbar:has(#boxOcrModeButton:not(.mode-active)) .qt-options{display:none!important}#helpButton{width:29px;height:29px;border-radius:50%!important;font-weight:800;font-size:15px!important}';document.head.append(contextual);
  const style=document.createElement('style');style.textContent=`
  #qtDrawingMenu{position:fixed;margin:0;padding:5px;width:246px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;border:1px solid #c5d5e2;border-radius:7px;background:white;box-shadow:0 8px 28px #102a4330;color:#123047}
  #qtDrawingMenu .qt-menu-heading{font-size:10px;color:#647789;padding:5px 8px 3px;border-top:1px solid #e5edf3;margin-top:3px}#qtDrawingMenu .qt-menu-heading:first-child{border:0;margin-top:0}
  #qtDrawingMenu button{display:flex;align-items:center;gap:7px;width:100%;border:0;border-radius:4px;background:transparent;padding:5px 8px;text-align:left;color:inherit;font-size:12px;cursor:pointer}#qtDrawingMenu button:hover,#qtDrawingMenu button:focus-visible{background:#e4f4f7;outline:none}#qtDrawingMenu button[aria-checked=true]{color:#008799;background:#edf8fa}#qtDrawingMenu button:disabled{opacity:.4;cursor:default}#qtDrawingMenu kbd{margin-left:auto;font:10px Segoe UI;color:#667c8f}#qtDrawingMenu .qt-menu-icon{width:17px;text-align:center}
  #qtDrawingMenu{width:274px;padding:4px;border:1px solid #aeb9c2;border-radius:4px;background:#fafafa;box-shadow:2px 5px 16px #172b3c40;font-family:'Segoe UI',sans-serif}
  #qtDrawingMenu .qt-menu-heading{padding:5px 8px 3px 31px;font-size:9px;letter-spacing:.04em;color:#64717c;border-color:#dce1e5;margin-top:4px}
  #qtDrawingMenu button{display:grid;grid-template-columns:20px minmax(0,1fr) auto 14px;gap:7px;min-height:27px;padding:3px 7px;border:1px solid transparent;border-radius:2px;font:12px 'Segoe UI',sans-serif}
  #qtDrawingMenu button::after{content:'';width:14px;text-align:center}
  #qtDrawingMenu button:hover,#qtDrawingMenu button:focus-visible{background:#e5f1fb;border-color:#a9cce8}
  #qtDrawingMenu button[aria-checked=true]{background:#d4f0f2;color:#005b68;font-weight:700;border-color:#65b8c1;box-shadow:inset 3px 0 #008c9d}
  #qtDrawingMenu button[aria-checked=true]:hover,#qtDrawingMenu button[aria-checked=true]:focus-visible{background:#bce5e9;border-color:#008c9d}
  #qtDrawingMenu button[aria-checked=true]::after{content:'✓';font-size:15px;font-weight:800;color:#007384}
  #qtDrawingMenu button[aria-checked=true] .qt-menu-icon{border:0;background:transparent}
  #qtDrawingMenu button[aria-checked=true] kbd{color:#236571}
  #qtDrawingMenu .qt-submenu-host{position:relative}
  #qtDrawingMenu .qt-submenu-host>button::after{content:'›';font-size:17px;line-height:1;color:#526b7d}
  #qtDrawingMenu .qt-submenu{display:none;position:fixed;z-index:2147483647;width:210px;padding:4px;border:1px solid #aeb9c2;border-radius:4px;background:#fafafa;box-shadow:2px 5px 16px #172b3c40}
  #qtDrawingMenu .qt-submenu-host[data-open=true]>.qt-submenu{display:block}
  #qtDrawingMenu .qt-submenu .qt-menu-heading{padding-left:8px;margin:0 0 2px}
  #qtDrawingMenu .qt-menu-icon svg{width:16px!important;height:16px!important;flex:0 0 16px!important;pointer-events:none}
  #qtDrawingMenu .qt-menu-icon{width:20px;height:20px;display:grid;place-items:center;box-sizing:border-box}
  #qtDrawingMenu kbd{font:10px 'Segoe UI',sans-serif;color:#64717c;white-space:nowrap}
  .toolbar #boxContentMode[hidden],.toolbar #boxScanMode[hidden]{display:none!important}
  .qt-options{display:flex;gap:2px;padding:2px;background:#eaf0f5;border:1px solid #d5e0e8;border-radius:5px}
  .toolbar[data-organized] .qt-choice{min-height:25px;padding:3px 5px!important;font-size:10px;white-space:nowrap;border:1px solid transparent!important;background:transparent!important}
  .toolbar[data-organized] .qt-choice[aria-pressed=true]{background:#fff!important;color:#007d8e;border-color:#9ed4dc!important;box-shadow:0 1px 2px #17384915}
  .toolbar[data-organized] .wl-section .wl-group{gap:3px}.toolbar[data-organized] .wl-section{padding-right:7px}.toolbar[data-organized] .wl-main{gap:6px;flex-basis:100%;border-top:1px solid #d7e1e9;order:2}
  .toolbar[data-organized] .wl-appbar{order:0}.toolbar #wlGlobal{order:1}.toolbar #acuiCreateManual,.toolbar #acuiCreateNote,.toolbar #viewNumberingButton,.toolbar #balloonSettingsButton{font-size:10px;white-space:nowrap}
  @media(max-height:760px){.workspace.acui-dashboard{grid-template-rows:minmax(0,1fr) 298px}.toolbar[data-organized] .wl-main{padding-top:2px;padding-bottom:2px}.toolbar[data-organized] .wl-main .btn{min-height:25px;font-size:10px;padding:3px 4px!important}.toolbar[data-organized] .wl-main .btn svg{width:13px;height:13px}}
  .toolbar[data-organized]{flex-wrap:nowrap!important;min-width:0;max-width:100%;width:100%;box-sizing:border-box}
  .toolbar[data-organized] .wl-main{order:1;flex:1 1 0!important;min-width:0;flex-wrap:nowrap!important;border-top:0;gap:5px;padding:3px 5px;overflow-x:auto;scrollbar-width:thin}
  .toolbar[data-organized] #wlGlobal{order:2;flex:0 0 auto;width:auto;flex-wrap:nowrap;margin-left:0}
  .toolbar[data-organized] .wl-appbar{flex:0 0 auto;padding:3px 5px}
  .toolbar[data-organized] .wl-section{flex:0 0 auto;padding-right:5px;align-self:flex-start}
  .toolbar[data-organized] .wl-section .wl-group{flex-wrap:nowrap;gap:2px}
  .toolbar[data-organized] .wl-main .btn{position:relative;min-height:36px!important;padding:3px 4px 13px!important;gap:3px;font-size:10px;white-space:nowrap}
  .toolbar[data-organized] .wl-main .icon-btn{width:38px}
  .toolbar[data-organized] .wl-main .qt-key,.toolbar[data-organized] .wl-main .shortcut{position:absolute;bottom:1px;left:0;width:100%;height:10px;min-width:0;line-height:10px;text-align:center;font:8px/10px 'Segoe UI',sans-serif;color:#6b8193;border:0;box-shadow:none;background:none;padding:0;margin:0}
  .toolbar[data-organized] .qt-options{gap:1px;padding:1px}
  .toolbar[data-organized] .wl-main .btn{min-height:34px!important;padding:4px 7px 4px!important;gap:5px;font-size:11px;border-radius:5px}
  .toolbar[data-organized] .wl-main .qt-key,.toolbar[data-organized] .wl-main .shortcut{position:static;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:auto;min-width:17px;height:17px;padding:0 3px;border:1px solid #d1dce5;border-radius:3px;background:#fff;color:#486175;font:10px/15px 'Segoe UI',sans-serif;box-shadow:0 1px 0 #d1dce5;margin-left:2px}
  .toolbar[data-organized] .qt-options{padding:2px;gap:2px;background:#e8eef3;border-color:#d6e0e8}
  .toolbar[data-organized] .qt-choice[aria-pressed=true]{background:#d9f2f5!important;color:#006c7e;border-color:#66b9c6!important;box-shadow:inset 0 -2px #00899d;font-weight:650}
  .toolbar[data-organized] .wl-main .btn:not(:disabled):hover{background:#e8f1f6!important}.toolbar[data-organized] .wl-main .btn:focus-visible{outline:2px solid #008da1;outline-offset:1px}
  .toolbar[data-organized] .wl-section-label{font-size:8px;letter-spacing:.08em;color:#526b7d}
  .toolbar[data-organized] .wl-main .icon-btn{width:auto;min-width:42px}
  .toolbar[data-organized] .wl-main{scroll-behavior:auto!important}
  `;document.head.append(style);
 }
 function toolPresentation(selector,fallback){const source=document.querySelector(selector),aliases={'#acuiCreateManual':'#manualToolsButton','#acuiCreateNote':'[data-choice="note"]'};const visual=document.querySelector(aliases[selector]||selector);const copy=visual?.cloneNode(true);copy?.querySelectorAll('svg,kbd,.shortcut').forEach(n=>n.remove());return{source,label:selector==='#acuiCreateNote'?'Not ekle':(copy?.textContent.trim()||fallback),icon:visual?.querySelector('svg')?.cloneNode(true)};}
 function toolIcon(target,selector,fallback){const info=toolPresentation(selector,fallback);if(info.icon){info.icon.setAttribute('aria-hidden','true');target.append(info.icon);}return info;}
 function installPointerBadge(){
  const gdtStyle=document.createElement('style');gdtStyle.textContent='#qtPointerBadge:has(.rb-gdt-icon){opacity:.7}';document.head.append(gdtStyle);
  const overlay=document.getElementById('overlay');if(!overlay||document.getElementById('qtPointerBadge'))return;
  const badge=document.createElement('div');badge.id='qtPointerBadge';badge.hidden=true;badge.setAttribute('aria-hidden','true');document.body.append(badge);
  const css=document.createElement('style');css.textContent='#qtPointerBadge{opacity:.7;position:fixed;z-index:2147483646;display:flex;gap:3px;pointer-events:none!important;user-select:none;color:#087f91;filter:drop-shadow(0 1px 2px #ffffff)}#qtPointerBadge[hidden]{display:none!important}#qtPointerBadge span{display:grid;place-items:center;width:23px;height:23px;border:1px solid #a6cdd5;border-radius:5px;background:#fffffff2;font:18px/1 Segoe UI Symbol,Segoe UI,sans-serif}#qtPointerBadge .qt-record{color:#218443;width:21px;height:21px}#qtPointerBadge span{width:21px;height:21px}#qtPointerBadge svg{width:14px!important;height:14px!important;min-width:14px!important;max-width:14px!important;flex:0 0 14px!important}#qtPointerBadge .qt-pointer-label{align-self:center;max-width:180px;padding:3px 5px;border-radius:3px;background:#fffffff2;color:#24566e;font:11px Segoe UI,sans-serif}';document.head.append(css);
  let pointer=null,frame=0,last='';
  const stop=()=>{pointer=null;badge.hidden=true;cancelAnimationFrame(frame);frame=0;};
  function paint(){
   frame=0;if(!pointer)return;
   const s=root.ASMachApp?.state,hit=document.elementFromPoint(pointer.x,pointer.y);
   const onDrawing=hit&&(hit===overlay||overlay.contains(hit)||hit.id==='sourceCanvas');
   badge.hidden=!s?.fileData||!onDrawing||document.hidden;
   if(!badge.hidden){
    let selector='#selectModeButton',record='';
    if(s.pendingPlacement||s.mode==='add')selector='#addModeButton';
    else if(s.mode==='box'){selector='[data-for="boxContentMode"][data-choice="'+(document.getElementById('boxContentMode')?.value||'auto')+'"]';record=document.getElementById('boxScanMode')?.value==='controlled'?'controlled':'smart';}
    const info=toolPresentation(selector,'Seç'),recordSelector='[data-for="boxScanMode"][data-choice="'+record+'"]',recordInfo=record?toolPresentation(recordSelector,'') : null;
    const label=info.label+(recordInfo?' · '+recordInfo.label:''),key=selector+'|'+label;
    if(last!==key){last=key;badge.replaceChildren();const tool=document.createElement('span');toolIcon(tool,selector,info.label);badge.append(tool);if(record){const r=document.createElement('span');r.className='qt-record';toolIcon(r,recordSelector,recordInfo.label);badge.append(r);}const caption=document.createElement('small');caption.className='qt-pointer-label';caption.textContent=label;badge.append(caption);badge.dataset.tool=info.label;badge.dataset.record=record;badge.title=label;}
    badge.style.left=Math.max(2,Math.min(pointer.x-10,innerWidth-badge.offsetWidth-2))+'px';badge.style.top=Math.min(pointer.y+19,innerHeight-badge.offsetHeight-2)+'px';
   }
   frame=requestAnimationFrame(paint);
  }
  overlay.addEventListener('pointermove',e=>{if(e.pointerType==='touch'){stop();return;}pointer={x:e.clientX,y:e.clientY};if(!frame)paint();});
  overlay.addEventListener('pointerleave',stop);overlay.addEventListener('pointercancel',stop);root.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 }
 function installDrawingMenu(){
  const viewer=document.getElementById('viewer');if(!viewer)return;
  const menu=document.createElement('div');menu.id='qtDrawingMenu';menu.setAttribute('popover','manual');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Çizim hızlı araçları');document.body.append(menu);
  let previousFocus;
  const close=(restore=false)=>{if(!menu.matches(':popover-open'))return;menu.hidePopover();if(restore&&previousFocus?.isConnected)previousFocus.focus();};
  function heading(text){const h=document.createElement('div');h.className='qt-menu-heading';h.setAttribute('role','presentation');h.textContent=text;menu.append(h);}
  function action(selector,label,key,icon,radio=false){const source=document.querySelector(selector);if(!source)return;const b=document.createElement('button');b.type='button';b.dataset.source=selector;b.disabled=source.disabled;b.setAttribute('role',radio?'menuitemradio':'menuitem');if(radio)b.setAttribute('aria-checked',(source.getAttribute('aria-pressed')==='true'&&(!source.matches('.qt-choice')||root.ASMachApp?.state.mode==='box'))?'true':'false');const i=document.createElement('span');i.className='qt-menu-icon';i.setAttribute('aria-hidden','true');const info=toolIcon(i,selector,label);const name=document.createElement('span');name.textContent=info.label;const k=document.createElement('kbd');k.textContent=source.getAttribute('aria-keyshortcuts')||key;b.append(i,name,k);b.onclick=()=>{close();if(!source.disabled)source.click();};menu.append(b);}
  function measurementSubmenu(){
   const source=document.querySelector('[data-for="boxContentMode"][data-choice="dimension"]');if(!source)return;
   const host=document.createElement('div');host.className='qt-submenu-host';
   const trigger=document.createElement('button');trigger.type='button';trigger.setAttribute('role','menuitem');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
   const icon=document.createElement('span');icon.className='qt-menu-icon';icon.setAttribute('aria-hidden','true');toolIcon(icon,'[data-for="boxContentMode"][data-choice="dimension"]','Ölçü');
   const name=document.createElement('span'),key=document.createElement('kbd');name.textContent='Ölçü';key.textContent='Alt+2';trigger.append(icon,name,key);
   const submenu=document.createElement('div');submenu.className='qt-submenu';submenu.setAttribute('role','menu');submenu.setAttribute('aria-label','Algılanacak ölçü türü');
   const title=document.createElement('div');title.className='qt-menu-heading';title.textContent='ALGILANACAK ÖLÇÜ TÜRÜ';submenu.append(title);
   const options=[['','Otomatik tür seçimi','✧'],['Uzunluk','Uzunluk','↔'],['Çap','Çap','Ø'],['Yarıçap','Yarıçap','R'],['Açı','Açı','∠'],['Pah','Pah','×'],['Diş','Diş','M'],['Geçme','Geçme','H7'],['Limit ölçü','Limit ölçü','↕'],['Yüzey','Yüzey pürüzlülüğü','▽']];
   const open=()=>{host.dataset.open='true';trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect(),w=210,left=r.right+w<=innerWidth-8?r.right-1:Math.max(8,r.left-w+1);submenu.style.left=left+'px';submenu.style.top=Math.max(8,Math.min(r.top,innerHeight-submenu.offsetHeight-8))+'px';};
   const shut=()=>{delete host.dataset.open;trigger.setAttribute('aria-expanded','false');};
   for(const [value,label,glyph]of options){const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String((document.getElementById('boxMeasurementType')?.value||'')===value));const i=document.createElement('span');i.className='qt-menu-icon';i.setAttribute('aria-hidden','true');i.textContent=glyph;const n=document.createElement('span');n.textContent=label;const k=document.createElement('kbd');b.append(i,n,k);b.onclick=()=>{const target=document.getElementById('boxMeasurementType');target.value=value;target.dispatchEvent(new Event('change',{bubbles:true}));close();source.click();};submenu.append(b);}
   trigger.onclick=open;host.onpointerenter=open;host.onpointerleave=shut;
   trigger.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();open();submenu.querySelector('button')?.focus();}};
   submenu.addEventListener('keydown',e=>{const buttons=[...submenu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowLeft'){e.preventDefault();shut();trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}});
   host.append(trigger,submenu);menu.append(host);
  }
  viewer.addEventListener('contextmenu',e=>{
   if(e.target.closest('.balloon-group,.style-legend,input,textarea,button,a'))return;
   const s=root.ASMachApp?.state;if(!s?.fileData)return;
   if(s.pendingRecognition||s.pendingAnchor||s.pendingPlacement||s.balloonReviewOpening||s.autoScanRequest)return;
   e.preventDefault();e.stopImmediatePropagation();close();previousFocus=document.activeElement;menu.replaceChildren();
   heading('SEÇİM / EKLE');action('#selectModeButton','Seçim aracı','V','↖');action('#addModeButton','Balon ekle','B','⊕');action('#acuiCreateManual','Karakteristik ekle','Ctrl+Alt+C','▤');action('#acuiCreateNote','Not ekle','Ctrl+Alt+N','✎');
   heading('EKLEME ŞEKLİ');action('[data-for="boxScanMode"][data-choice="smart"]','Akıllı — doğrudan kaydet','Alt+5','✓',true);action('[data-for="boxScanMode"][data-choice="controlled"]','Kontrollü — önce düzenle','Alt+6','☑',true);
   heading('OKUMA TÜRÜ');action('[data-for="boxContentMode"][data-choice="auto"]','Otomatik ayıklama','Alt+1','✧',true);measurementSubmenu();for(const [v,label,key,icon] of [['gdt','GD&T ayıkla','3','⌖'],['note','Not OCR','4','≡']])action('[data-for="boxContentMode"][data-choice="'+v+'"]',label,'Alt+'+key,icon,true);
   heading('GÖRÜNÜM');action('#extractedVisibilityButton',s.hideExtractedDetails?'Ayıklananları göster':'Ayıklananları gizle','','◉',true);
   const visibility=menu.querySelector('[data-source="#extractedVisibilityButton"]');if(visibility){visibility.setAttribute('role','menuitemcheckbox');visibility.setAttribute('aria-checked',String(!!s.hideExtractedDetails));}
   action('#zoomInButton','Yakınlaştır','','+');action('#zoomOutButton','Uzaklaştır','','−');action('#fitButton','Ekrana sığdır','','⛶');
   menu.showPopover();const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-r.height-8))+'px';menu.querySelector('button:not(:disabled)')?.focus();
  },true);
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close();},true);
  document.addEventListener('scroll',e=>{if(!menu.contains(e.target))close();},true);root.addEventListener('resize',()=>close());
  menu.addEventListener('keydown',e=>{const buttons=[...menu.querySelectorAll('button:not(:disabled)')];let i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[i]?.focus();}else if(e.key==='Tab')close();});
 }
 root.ASMachQuickTools={init};
})(window);
