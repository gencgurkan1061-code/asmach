/* Shared desktop chrome; presentation only, never replaces form nodes or handlers. */
(function(){
 'use strict';
 const scope='html body :is(dialog,.modal-card,.wf-card,.settings-card):not(#dw-excluded):not(#dw-excluded-two)';
 const style=document.createElement('style');style.id='desktop-window-theme';
 style.textContent=`
 html body :is(dialog,.modal-card,.wf-card,.settings-card):not(.wt-panel){border-radius:6px;box-shadow:0 6px 24px #17384926}
 ${scope}:not(.wt-panel)>:is(header,.modal-head,.wf-head,.acui-head){display:flex!important;align-items:center!important;gap:8px!important;min-height:30px!important;padding:4px 9px!important;background:#edf4f8!important;color:#173d52!important;border-bottom:1px solid #c5d8e4!important;flex-shrink:0!important;cursor:move;touch-action:none}
 ${scope}:not(.wt-panel)>:is(header,.modal-head,.wf-head,.acui-head) :is(h1,h2,h3,strong){font-family:Segoe UI,Arial,sans-serif!important;font-size:12px!important;font-weight:600!important;letter-spacing:normal!important;margin:0!important;color:inherit!important}
 ${scope}:not(.wt-panel)>header>div>small{display:none!important}
 ${scope}:not(.wt-panel)>:is(header,.modal-head,.wf-head,.acui-head) :is([aria-label=Kapat],[data-close],[data-cancel]){margin-left:auto!important;min-width:28px!important;min-height:25px!important;padding:2px 7px!important;background:transparent!important;border:1px solid transparent!important;border-radius:3px!important;box-shadow:none!important;color:inherit!important}
 ${scope}:not(.wt-panel)>:is(header,.modal-head,.wf-head,.acui-head) :is([aria-label=Kapat],[data-close],[data-cancel]):hover{background:#c42b1c!important;color:#fff!important}
 html body dialog#productionWorkspace.project-info-window{display:grid!important;grid-template-columns:190px minmax(0,1fr);grid-template-rows:38px minmax(0,1fr) 54px;width:min(1180px,94vw)!important;height:min(760px,90dvh)!important;background:#f4f7fa;border:1px solid #b9ccd8!important;overflow:hidden}
 html body dialog#productionWorkspace.project-info-window>header{grid-column:1/-1}
 html body dialog#productionWorkspace.project-info-window>nav{grid-column:1;grid-row:2;display:flex!important;flex-direction:column;align-items:stretch!important;justify-content:flex-start;gap:2px!important;background:#f8fafc!important;border-right:1px solid #d7e2e9!important;padding:14px 10px!important;overflow:auto}
 html body dialog#productionWorkspace.project-info-window .pr-nav-caption{padding:0 9px 9px;color:#78909f;font-size:9px;font-weight:700;letter-spacing:.11em}
 html body dialog#productionWorkspace.project-info-window>nav button{flex:none!important;text-align:left;padding:9px 10px!important;background:transparent;border:0!important;border-left:3px solid transparent!important;border-radius:4px!important;white-space:normal!important;color:#486577!important;font-size:11px!important}
 html body dialog#productionWorkspace.project-info-window>nav button:hover{background:#edf3f6!important}
 html body dialog#productionWorkspace.project-info-window>nav button[aria-selected=true],html body dialog#productionWorkspace.project-info-window>nav button.active{background:#e3f2f5!important;border-left-color:#008b9c!important;color:#087889!important;font-weight:650}
 html body dialog#productionWorkspace.project-info-window>main{grid-column:2;grid-row:2;background:#f4f7fa;padding:16px 18px!important}
 html body dialog#productionWorkspace.project-info-window>footer{grid-column:1/-1;padding:9px 14px!important;min-height:54px!important}
 html body dialog#productionWorkspace.project-info-window .pr-page-heading{min-height:38px;margin-bottom:2px}
 html body dialog#productionWorkspace.project-info-window .pr-page-heading h2{font-size:17px!important;font-weight:650!important}
 html body dialog#productionWorkspace.project-info-window .pr-page-heading p{font-size:11px!important;margin-top:3px!important}
 html body dialog#productionWorkspace.project-info-window .pr-project{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;background:transparent!important;border:0!important;border-radius:0!important;overflow:visible!important}
 html body dialog#productionWorkspace.project-info-window .pr-project>section{display:block!important;padding:16px!important;border:1px solid #d7e2e9!important;border-radius:7px!important;background:#fff!important}
 html body dialog#productionWorkspace.project-info-window .pr-project>.pr-identity,html body dialog#productionWorkspace.project-info-window .pr-project>.pr-project-notes{grid-column:1/-1}
 html body dialog#productionWorkspace.project-info-window .pr-project>.pr-identity .pr-fields{grid-template-columns:repeat(4,minmax(0,1fr))!important}
 html body dialog#productionWorkspace.project-info-window .pr-section-label{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;margin-bottom:13px}
 html body dialog#productionWorkspace.project-info-window .pr-section-label .pr-section-index{grid-row:1/3;margin:0!important}
 html body dialog#productionWorkspace.project-info-window .pr-section-label h3{margin:0!important}
 html body dialog#productionWorkspace.project-info-window .pr-section-label p{margin:2px 0 0!important}
 html body dialog#productionWorkspace.project-info-window{min-width:min(720px,94vw)!important;min-height:min(500px,90dvh)!important;max-width:98vw!important;max-height:96dvh!important;resize:none!important}
 html body dialog#productionWorkspace.project-info-window dialog.pr-record-modal{min-width:min(520px,90vw)!important;min-height:min(360px,80dvh)!important;max-width:95vw!important;max-height:92dvh!important;resize:none!important;overflow:auto!important}
 html body dialog:is(#productionWorkspace.project-info-window,.pr-record-modal)>.dw-resize-handle{position:absolute;right:1px;bottom:1px;width:18px;height:18px;padding:0;border:0;background:linear-gradient(135deg,transparent 45%,#8aa5b4 46% 54%,transparent 55% 65%,#8aa5b4 66% 74%,transparent 75%);cursor:nwse-resize;z-index:20}
 html body dialog:is(#productionWorkspace.project-info-window,.pr-record-modal)>.dw-resize-handle:focus-visible{outline:2px solid #008b9d;outline-offset:-2px}
 @media(max-width:900px){html body dialog#productionWorkspace.project-info-window{grid-template-columns:160px minmax(0,1fr)}html body dialog#productionWorkspace.project-info-window .pr-project{grid-template-columns:1fr!important}html body dialog#productionWorkspace.project-info-window .pr-project>section{grid-column:1!important}html body dialog#productionWorkspace.project-info-window .pr-project>.pr-identity .pr-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
 @media(max-width:650px){html body dialog#productionWorkspace.project-info-window{grid-template-columns:125px minmax(0,1fr);width:98vw!important;height:94dvh!important}html body dialog#productionWorkspace.project-info-window .pr-project>.pr-identity .pr-fields{grid-template-columns:1fr!important}}
 `;
 document.head.append(style);
 // Move actual dialog windows by their title bar, without affecting inputs.
 document.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button,input,select,textarea,a'))return;
  const header=e.target.closest('header,.modal-head,.wf-head,.acui-head'),dialog=header?.parentElement;
  if(!dialog?.matches('dialog[open]:not(.wt-panel)')||header.onpointerdown)return;
  const rect=dialog.getBoundingClientRect(),dx=e.clientX-rect.left,dy=e.clientY-rect.top;
  header.setPointerCapture(e.pointerId);e.preventDefault();
  const move=ev=>{dialog.style.setProperty('transform','none','important');dialog.style.setProperty('margin','0','important');dialog.style.setProperty('inset',Math.max(0,Math.min(innerHeight-35,ev.clientY-dy))+'px auto auto '+Math.max(0,Math.min(innerWidth-rect.width,ev.clientX-dx))+'px','important');};
  const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);};
  header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);
 });
 const attachResize=dialog=>{
  if(dialog.dataset.desktopResizeReady)return;dialog.dataset.desktopResizeReady='true';const handle=document.createElement('button');handle.type='button';handle.className='dw-resize-handle';handle.setAttribute('aria-label','Pencereyi yeniden boyutlandır');handle.title='Pencereyi yeniden boyutlandır';dialog.append(handle);
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const rect=dialog.getBoundingClientRect(),startX=event.clientX,startY=event.clientY,minWidth=dialog.classList.contains('pr-record-modal')?520:720,minHeight=dialog.classList.contains('pr-record-modal')?360:500;dialog.style.setProperty('transform','none','important');dialog.style.setProperty('margin','0','important');dialog.style.setProperty('inset',rect.top+'px auto auto '+rect.left+'px','important');dialog.style.setProperty('width',rect.width+'px','important');dialog.style.setProperty('height',rect.height+'px','important');const move=ev=>{dialog.style.setProperty('width',Math.max(Math.min(minWidth,innerWidth-rect.left),Math.min(innerWidth-rect.left,rect.width+ev.clientX-startX))+'px','important');dialog.style.setProperty('height',Math.max(Math.min(minHeight,innerHeight-rect.top),Math.min(innerHeight-rect.top,rect.height+ev.clientY-startY))+'px','important');};const end=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);};document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);});
 };
 const scanResize=()=>document.querySelectorAll('dialog#productionWorkspace.project-info-window,dialog.pr-record-modal').forEach(attachResize);scanResize();new MutationObserver(scanResize).observe(document.body,{childList:true,subtree:true});
 // Keep the common chrome last even when a tool installs its own lazy CSS.
 let pending=false;new MutationObserver(()=>{if(pending||document.head.lastElementChild===style)return;pending=true;queueMicrotask(()=>{pending=false;document.head.append(style);});}).observe(document.head,{childList:true});
})();
