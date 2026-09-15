(function(root){
 'use strict';
 const visible=n=>!!n?.getClientRects().length&&!n.closest('[hidden],[inert]')&&!n.disabled;
 const editing=n=>n.isContentEditable||!!n.closest('input:not([type=checkbox]):not([type=radio]),textarea,select,[role=textbox]');
 const scopes='.toolbar,nav,[role=tablist],.appearance-nav,.rc-cards,.wf-filterbar,.ra-rolebar,.modal-actions,.wf-foot,.qt-options,.wl-menu-body';
 function inWorkspace(){return [...document.querySelectorAll('#reportCenter,#productionWorkspace,dialog[open],.modal.is-visible,.wf-dialog.open')].some(visible);}
 function init(){
  const style=document.createElement('style');style.textContent=':where(button,a,summary,input,select,textarea,[tabindex]):focus-visible{outline:2px solid #008b9d!important;outline-offset:2px}tr.kn-row:focus-visible{outline-offset:-2px;background:#e3f4f8!important}';document.head.append(style);
  const prepare=()=>document.querySelectorAll('tbody tr').forEach(row=>{if(row.querySelector('td')&&!row.hasAttribute('tabindex')){row.tabIndex=0;row.classList.add('kn-row');}});
  let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;prepare();});}}).observe(document.body,{childList:true,subtree:true});prepare();
  const help=document.createElement('dialog');help.id='keyboardHelp';help.style.cssText='max-width:540px;width:90vw;border:1px solid #bdd4df;border-radius:10px;padding:22px;color:#173b4f';help.innerHTML='<h2 style="margin-top:0">Klavye ile kullanım</h2><p>Tab / Shift+Tab: sonraki / önceki alan</p><p>↑ ↓: listede önceki / sonraki satır<br>← →: satır içindeki düğmeler veya araçlar<br>Home / End: listenin başı / sonu<br>Enter: odaktaki satırı aç veya düğmeyi çalıştır<br>Boşluk: satırın seçim kutusunu değiştir</p><p>Esc: mevcut iptal / kapat işlemi<br>Alt+←: açık tam ekran görünümden geri dön<br>F1: bu kısayol rehberi</p><p>Çizim alanında yön tuşları: kaydır. Metin, sayı ve seçim alanlarında tuşların normal davranışı korunur. Araçların harf kısayolları düğmelerin üzerinde görünür.</p><button class="btn" type="button">Kapat</button>';help.querySelector('button').onclick=()=>help.close();document.body.append(help);
  const button=document.createElement('button');button.className='btn';button.type='button';button.id='helpButton';button.textContent='?';button.setAttribute('aria-label','Kullanım kılavuzu');button.title='Klavye kısayolları · F1';button.setAttribute('aria-keyshortcuts','F1');button.onclick=()=>{if(root.ASMachUsageGuide){root.ASMachUsageGuide.open();return;}if(!help.open)help.showModal();};document.getElementById('wlGlobal')?.append(button);
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const move=(items,current,key)=>{if(!items.length)return;const i=items.indexOf(current);const next=key==='Home'?0:key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,i+(key==='ArrowDown'||key==='ArrowRight'?1:-1)));items[next].focus();items[next].scrollIntoView({block:'nearest',inline:'nearest'});};
  document.addEventListener('keydown',e=>{
   if(e.defaultPrevented||e.isComposing)return;const n=e.target;
   if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='a'&&!editing(n)){
    // Ribbon buttons and the non-modal appearance palette are drawing controls,
    // not a separate text-selection workspace. Keep real dialogs isolated.
    const blocked=[...document.querySelectorAll('#reportCenter,#productionWorkspace,dialog[open],.modal.is-visible,.wf-dialog.open,.cu-modal.is-open,.asmach-modal.open')].some(node=>node.id!=='formatToolWindow'&&visible(node));
    const app=root.ASMachApp,s=app?.state;if(!s?.fileData||blocked||s.controlledDraft||s.pendingRecognition||s.pendingPlacement||s.pendingAnchor||s.autoScanRequest)return;
    stop(e);root.getSelection()?.removeAllRanges();const ids=s.annotations.filter(r=>!r.listOnly).map(r=>r.id);root.ASMachCharacteristicUI?.selectIds(ids,'replace');if(!ids.includes(s.selectedId))s.selectedId=ids[0]||null;app.renderAll();return;
   }
   if(e.key==='F1'){stop(e);button.click();return;}
   if(e.altKey&&e.key==='ArrowLeft'&&!editing(n)){
    const close=[...document.querySelectorAll('#settingsCancelButton,#pdfExportCancelButton,#reportCenter [data-close],#productionWorkspace [data-close],#automaticReviewModal [data-close]')].filter(visible).at(-1);if(close){stop(e);close.click();}return;
   }
   if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||editing(n))return;
   const row=n.closest('tbody tr'),table=row?.closest('table');
   if(row&&['ArrowUp','ArrowDown','Home','End'].includes(e.key)){stop(e);move([...table.querySelectorAll('tbody tr')].filter(r=>r.querySelector('td')&&visible(r)),row,e.key);return;}
   if(row&&n===row&&e.key==='Enter'){stop(e);row.click();return;}
   if(row&&n===row&&e.key===' '){const c=row.querySelector('input[type=checkbox]');if(visible(c)){stop(e);c.click();}return;}
   if(row&&['ArrowLeft','ArrowRight'].includes(e.key)){const items=[row,...row.querySelectorAll('button,a,input[type=checkbox],summary')].filter(visible);stop(e);move(items,n,e.key);return;}
   // Workbench tabs implement selection, wrapping and hidden-tab skipping themselves.
   if(n.closest('.cw-tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   if(n.closest('.wf-order-icons'))return;
   const scope=n.closest(scopes);
   if(scope&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){const items=[...scope.querySelectorAll('button,a,summary,input[type=checkbox],[role=tab]')].filter(visible);if(items.length){stop(e);move(items,n,e.key);}return;}
   if(n.closest('.viewer')&&e.key.startsWith('Arrow')){const viewer=n.closest('.viewer');stop(e);viewer.scrollBy({left:e.key==='ArrowRight'?60:e.key==='ArrowLeft'?-60:0,top:e.key==='ArrowDown'?60:e.key==='ArrowUp'?-60:0});}
  },true);
  document.querySelector('.viewer')?.setAttribute('tabindex','0');
  const drawing=document.getElementById('viewer');drawing?.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,a,input,select,textarea,[contenteditable],summary,[role=button]')||inWorkspace()||root.ASMachApp?.state.controlledDraft)return;drawing.focus({preventScroll:true});},true);
  drawing?.setAttribute('aria-keyshortcuts','Control+A Meta+A');
 }
 root.ASMachKeyboard={init,inWorkspace};
})(window);
