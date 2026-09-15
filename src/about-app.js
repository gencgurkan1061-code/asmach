(function(root){
 'use strict';
 let workspace;
 const infoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.7v6.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.4" r=".9" fill="currentColor"/></svg>';
 function mount(host){
  host.replaceChildren();
  const native=root.ASMachDesktop,current=native?.info?.version||root.ASMachBuildVersion||'Bilinmiyor';
  const area=document.createElement('section');area.className='about-application';
  area.innerHTML='<span class="about-icon">'+infoIcon+'</span><div class="about-copy"><p class="about-kicker">HAKKINDA</p><h1>ASMach Inspection</h1><p class="about-description">Teknik resim balonlama ve denetleme uygulaması</p><dl><dt>Mevcut sürüm</dt><dd data-current></dd></dl></div>';
  area.querySelector('[data-current]').textContent=current+(native?'':' · HTML önizleme');host.append(area);
  if(!document.getElementById('aboutApplicationStyle')){const css=document.createElement('style');css.id='aboutApplicationStyle';css.textContent=`
   #aboutWorkspace{position:fixed;inset:var(--app-shell-bottom) 0 0;z-index:1800;box-sizing:border-box;overflow:auto;padding:34px;background:#f5f8fa;color:#24485d}
   #aboutWorkspace.wt-inactive{display:none!important}
   .about-application{display:flex;align-items:flex-start;gap:20px;width:min(680px,100%);padding:26px 28px;border:1px solid #cddde6;border-radius:8px;background:#fff;box-shadow:0 5px 18px #264d6112}
   .about-icon{display:grid;place-items:center;width:58px;height:58px;flex:0 0 58px;border-radius:12px;background:#078fa1;color:#fff}
   .about-icon svg{width:31px;height:31px}.about-copy{min-width:0}.about-kicker{margin:0 0 5px!important;color:#078497!important;font-size:10px!important;font-weight:800;letter-spacing:.1em}
   .about-copy h1{margin:0;font-size:23px;color:#173f55}.about-description{margin:5px 0 19px!important;color:#607d8d!important}
   .about-copy dl{display:grid;grid-template-columns:115px minmax(0,1fr);align-items:center;margin:0;padding-top:13px;border-top:1px solid #e1eaef}
   .about-copy dt,.about-copy dd{margin:0;font-size:12px}.about-copy dt{color:#68818f}.about-copy dd{font-weight:700;color:#294d61}
   @media(max-width:620px){#aboutWorkspace{padding:16px}.about-application{box-sizing:border-box;padding:20px;gap:14px}.about-icon{width:46px;height:46px;flex-basis:46px}.about-icon svg{width:25px;height:25px}}
  `;document.head.append(css);}
 }
 function open(){
  if(!workspace){workspace=document.createElement('main');workspace.id='aboutWorkspace';workspace.setAttribute('aria-label','Hakkında');document.body.append(workspace);mount(workspace);}
  queueMicrotask(()=>root.ASMachWorkspaceTabs?.activate?.('about'));
 }
 function close(){if(document.body.dataset.workspaceScreen==='about')root.ASMachWorkspaceTabs?.activate?.('drawing');}
 root.ASMachAbout={mount,open,close};
})(window);
