(function(root){
 'use strict';
 function init(){
  const toolbar=document.querySelector('.toolbar');if(!toolbar)return;
  const css=document.createElement('style');css.textContent=`
  html,body{height:100%;overflow:hidden!important}
  body .app{height:100dvh;min-height:0;overflow:hidden}
  html body .app{grid-template-rows:auto minmax(0,1fr)!important}
  body .topbar{flex-shrink:0}
  html body .toolbar[data-organized]{position:relative;z-index:3000;overflow:visible!important;flex-wrap:wrap!important;min-width:0}
  html body .toolbar[data-organized] .wl-main{overflow:visible!important;flex-wrap:wrap!important;min-width:0;gap:5px;flex:1 1 900px}
  html body .toolbar[data-organized] .wl-section{flex-shrink:1;min-width:0;margin-left:0;padding-right:6px}
  html body .toolbar[data-organized] .wl-group{flex-wrap:wrap!important;min-width:0;gap:3px}
  html body .toolbar[data-organized] #wlGlobal{margin-left:auto;flex-wrap:wrap;max-width:100%}
  html body .toolbar[data-organized] .wl-main .btn,html body .toolbar[data-organized] #wlGlobal .btn,html body .toolbar[data-organized] .wl-appbar .btn{min-height:28px!important;padding:3px 5px!important;font-size:10px!important;gap:3px;border-radius:4px}
  html body .toolbar[data-organized] .wl-main{padding:3px 5px;gap:4px}
  html body .toolbar[data-organized] .wl-main .qt-key,html body .toolbar[data-organized] .wl-main .shortcut{min-width:14px;height:14px;padding:0 2px;font:9px/12px 'Segoe UI',sans-serif;margin-left:1px}
  html body .toolbar[data-organized] .tool-icon{width:14px;height:14px;flex-basis:14px}
  html body .toolbar[data-organized] .wl-main .icon-btn{min-width:28px}
  html body .toolbar[data-organized] .qt-options{padding:1px;gap:1px}
  html body .toolbar[data-organized] .wl-section-label{font-size:7px;line-height:9px}
  html body .toolbar[data-organized] #balloonRoleView{height:28px;font-size:10px;max-width:148px}
  html body .toolbar[data-organized] .wl-menu-body{z-index:3100}
  html body #reportCenter,html body #productionWorkspace,html body #automaticReviewModal,html body #balloonSettingsModal,html body .rc-fullscreen{
   top:var(--app-shell-bottom,110px)!important;bottom:0!important;height:calc(100dvh - var(--app-shell-bottom,110px))!important;max-height:calc(100dvh - var(--app-shell-bottom,110px))!important;margin:0!important;
  }
  html body #balloonSettingsModal .settings-card,html body #automaticReviewModal .wf-card,html body .rc-fullscreen>.modal-card,html body .rc-fullscreen>.wf-card{
   height:100%!important;max-height:100%!important;min-height:0!important;
  }
  html body dialog.rc-fullscreen::backdrop{top:var(--app-shell-bottom,110px)}
  html body .acui-dock.acui-expanded{inset:var(--app-shell-bottom,110px) 0 0!important;width:100%!important;height:calc(100dvh - var(--app-shell-bottom,110px))!important;max-height:calc(100dvh - var(--app-shell-bottom,110px))!important;border-radius:0;transform:none!important}
  html body #balloonSettingsModal .settings-card>.modal-head,html body #pdfExportModal.rc-fullscreen .modal-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  html body #balloonSettingsModal .modal-head h3{flex:1}
  html body #balloonSettingsModal .modal-head #settingsCancelButton,html body #pdfExportModal .modal-head #pdfExportCancelButton{margin-left:auto;background:white;color:#173a4b;min-height:30px}
  @media(max-width:1000px){html body .toolbar[data-organized] .wl-main{flex-basis:100%;order:2}html body .toolbar[data-organized] #wlGlobal{order:1}}
  `;document.head.append(css);
  const role=document.getElementById('balloonRoleView');if(role){role.options[0].textContent='Balon stili: Kalite';role.options[1].textContent='Balon stili: Operatör';role.setAttribute('aria-label','Çizimde gösterilen balon stili');role.title='Yalnızca çizimdeki balon görünümünü seçer; ölçüleri ve kontrol planını değiştirmez. Seçilen sorumlunun etkin kontrol yöntemi stili kullanılır. Plan yoksa mevcut stil korunur. PDF de bu görünümü kullanır.';}
  const update=()=>{const bottom=Math.ceil((document.getElementById('workspaceTabs')||toolbar).getBoundingClientRect().bottom);document.documentElement.style.setProperty('--app-shell-bottom',bottom+'px');};
  new ResizeObserver(update).observe(toolbar);const top=document.querySelector('.topbar');if(top)new ResizeObserver(update).observe(top);root.addEventListener('resize',update);update();
  const cancel=document.getElementById('settingsCancelButton');document.querySelector('#balloonSettingsModal .modal-head')?.append(cancel);
  // Keep original controls and their cancel handlers; no draft is saved by closing.
  const pdf=document.getElementById('pdfExportModal');if(pdf)new MutationObserver(()=>{if(pdf.classList.contains('rc-fullscreen')){const b=document.getElementById('pdfExportCancelButton');if(b&&!pdf.querySelector('.modal-head').contains(b))pdf.querySelector('.modal-head').append(b);}}).observe(pdf,{attributes:true,attributeFilter:['class']});
 }
 root.ASMachApplicationShell={init};
})(window);
