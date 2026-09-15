(function(root){
 'use strict';let rotation=0,app;
 function pointer(event,b){let x=(event.clientX-b.left)/b.width,y=(event.clientY-b.top)/b.height;[x,y]=rotation===90?[y,1-x]:rotation===180?[1-x,1-y]:rotation===270?[1-y,x]:[x,y];return{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};}
 function init(a){app=a;const bar=document.getElementById('drawingFloatingTools'),stage=app.elements.stage,viewer=app.elements.viewer,holder=document.createElement('div');holder.className='pdf-rotated-holder';stage.before(holder);holder.append(stage);
  function layout(){const w=stage.offsetWidth,h=stage.offsetHeight,swap=rotation%180!==0;holder.style.width=(swap?h:w)+'px';holder.style.height=(swap?w:h)+'px';stage.style.transformOrigin='0 0';stage.style.transform=rotation===90?`translate(${h}px,0) rotate(90deg)`:rotation===180?`translate(${w}px,${h}px) rotate(180deg)`:rotation===270?`translate(0,${w}px) rotate(270deg)`:'none';}
  new ResizeObserver(layout).observe(stage);
  function fit(widthOnly=false){const c=app.elements.sourceCanvas,swap=rotation%180!==0,w=swap?c.height:c.width,h=swap?c.width:c.height;if(!w||!h)return;app.setZoom(Math.min(Math.max(1,viewer.clientWidth-2)/w,widthOnly?4:Math.max(1,viewer.clientHeight-2)/h,4));layout();viewer.scrollTo(0,0);}
  root.ASMachPdfTools.fit=()=>{if(file!==app.state.fileData){file=app.state.fileData;rotation=0;}fit();};
  const group=title=>{const g=document.createElement('div');g.className='pdf-tool-group';g.setAttribute('role','group');g.setAttribute('aria-label',title);bar.append(g);return g;};
  const zoom=bar.querySelector('.df-zoom');zoom.classList.add('pdf-tool-group');zoom.setAttribute('role','group');zoom.setAttribute('aria-label','Yakınlaştırma ve görünüm');
  const rotate=group('Sayfayı döndür'),pages=group('Sayfa geçişleri');let target=rotate;
  const button=(label,title,action)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=action;target.append(b);return b;};
  button('↶','Görünümü 90° sola döndür',()=>{rotation=(rotation+270)%360;fit();});button('↷','Görünümü 90° sağa döndür',()=>{rotation=(rotation+90)%360;fit();});button('0°','Görünüm dönüşünü sıfırla',()=>{rotation=0;fit();});
  target=zoom;button('↔','Genişliğe sığdır',()=>fit(true));button('1:1','Gerçek boyut · %100',()=>app.setZoom(1));
  target=pages;const first=button('⇤','İlk sayfa',()=>app.changePage(1));pages.append(document.getElementById('pageNav'));const last=button('⇥','Son sayfa',()=>app.changePage(app.state.pageCount));
  const syncPages=()=>{pages.hidden=!(app.state.pageCount>1);first.disabled=app.state.currentPage<=1;last.disabled=app.state.currentPage>=app.state.pageCount;};setInterval(syncPages,200);syncPages();
  document.getElementById('fitButton').addEventListener('click',e=>{e.stopImmediatePropagation();fit();},true);
  let page=app.state.currentPage,file=app.state.fileData;setInterval(()=>{if(page!==app.state.currentPage||file!==app.state.fileData){page=app.state.currentPage;file=app.state.fileData;rotation=0;layout();}},200);
  const css=document.createElement('style');css.textContent=`html body #drawingFloatingTools{top:var(--df-top)!important;bottom:auto!important;right:8px!important;transform:none!important;gap:3px;padding:3px;border-radius:6px;max-width:calc(100% - 16px);flex-wrap:wrap}html body #drawingFloatingTools .btn,html body #drawingFloatingTools .icon-btn{height:25px;min-height:25px;min-width:25px;padding:2px 5px;font-size:10px;border-radius:4px}html body #drawingFloatingTools svg{width:12px;height:12px}html body #drawingFloatingTools #zoomLabel{min-width:32px;font-size:10px}html body #drawingFloatingTools #pageNav{gap:2px;padding-left:4px}html body #drawingFloatingTools #pageNav button{min-width:25px;width:25px;height:25px;padding:2px}html body #drawingFloatingTools .df-zoom{gap:2px}.pdf-rotated-holder{position:relative;flex:none}.pdf-rotated-holder>.stage{position:absolute;left:0;top:0}`;document.head.append(css);layout();
  const grouped=document.createElement('style');grouped.textContent=`
   html body #drawingFloatingTools{gap:5px;padding:5px;align-items:center;border-radius:7px}
   html body #drawingFloatingTools .pdf-tool-group{display:flex;align-items:center;flex-wrap:nowrap;gap:3px;padding:0 6px 0 0;border-right:1px solid #cddce6;flex:0 0 auto}
   html body #drawingFloatingTools .pdf-tool-group:last-child{padding-right:0;border-right:0}
   html body #drawingFloatingTools .pdf-tool-group[hidden]{display:none!important}
   html body #drawingFloatingTools :is(.btn,.icon-btn){height:28px;min-height:28px;min-width:28px;margin:0;display:inline-flex;align-items:center;justify-content:center}
   html body #drawingFloatingTools #pageNav{border:0;padding:0;gap:3px;min-height:28px}
   html body #drawingFloatingTools #zoomLabel{min-width:38px;text-align:center;font-variant-numeric:tabular-nums}
  `;document.head.append(grouped);
 }
 root.ASMachPdfTools={init,pointer,angle:()=>rotation};
})(window);
