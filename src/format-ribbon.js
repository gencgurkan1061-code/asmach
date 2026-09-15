/* Selection-scoped formatting. Unchecked fields and unselected records are untouched. */
(function(root){
 'use strict';let host,app,mode='style',signature='',collection,records=[],body,status;
 const lines=['solid:Düz','dashed:Kesikli','dotted:Noktalı'];
 const specs=[['Balon',[
 ['size','Çap (px)',16,160],['fontSize','Yazı (px)',6,96],['opacity','Genel opaklık (%)',10,100],['color','Renk','color'],['shape','Şekil',['circle:Daire','square:Kare','hexagon:Altıgen']],['balloonFill','Dolgu','color'],['balloonOpacity','Balon (%)',0,100],['balloonLineWidth','Çizgi (px)',.5,12,.1],['balloonLineStyle','Çizgi türü',lines]]],
 ['Yazı / Kutu',[
 ['fontWeight','Yazı stili',['400:Normal','700:Kalın','800:Çok kalın']],['textColor','Yazı rengi','color'],['textOpacity','Yazı (%)',0,100],['boxPadding','Metin kenar boşluğu (px)',0,40],['boxColor','Kutu rengi','color'],['boxFill','Kutu dolgusu','color'],['boxFillOpacity','Dolgu (%)',0,100],['boxOpacity','Kutu (%)',0,100],['boxLineWidth','Çizgi (px)',.5,12,.1],['boxLineStyle','Çizgi türü',[...lines,'none:Gizle']]]],
 ['Bağlantı / Konum',[
 ['arrowEnabled','Bağlantı',['true:Göster','false:Gizle']],['arrowStyle','Ok ucu',['open:Açık ok','triangle:Dolu ok','diamond:Baklava','dot:Nokta']],['arrowSize','Ok (px)',4,40],['boxGap','Kutudan uzaklık (px)',0,500],['leaderColor','Renk','color'],['leaderOpacity','Opaklık (%)',0,100],['leaderLineWidth','Çizgi (px)',.5,12,.1],['leaderLineStyle','Çizgi türü',lines],['boxDirection','Konum',['left:← Sol','right:→ Sağ','top:↑ Üst','bottom:↓ Alt','top-left:↖ Sol üst','top-right:↗ Sağ üst','bottom-left:↙ Sol alt','bottom-right:↘ Sağ alt']]]]];
 const percent=k=>k==='opacity'||k.endsWith('Opacity');
 const allFields=specs.flatMap(s=>s[1]);
 const groups=[['Balon',['size','opacity','color','shape','balloonFill','balloonOpacity','balloonLineWidth','balloonLineStyle']],['Yazı',['fontSize','fontWeight','textColor','textOpacity']],['Ölçü kutusu',['boxPadding','boxColor','boxFill','boxFillOpacity','boxOpacity','boxLineWidth','boxLineStyle']],['Bağlantı',['arrowEnabled','arrowStyle','arrowSize','leaderColor','leaderOpacity','leaderLineWidth','leaderLineStyle']],['Balon konumu',['boxDirection','boxGap']]];
 function dropdown(title,content){const d=document.createElement('details'),s=document.createElement('summary');d.className='fr-dropdown';s.className='btn';s.textContent=title+' ▾';d.append(s,content);d.addEventListener('toggle',()=>{if(d.open)host.querySelectorAll('.fr-dropdown[open]').forEach(other=>{if(other!==d)other.open=false;});});return d;}
 function ids(){const multi=root.ASMachCharacteristicUI.selectionIds();return multi.length?multi:[app.selectedAnnotation()?.id].filter(Boolean);}
 function normalized(r){const visible=root.ASMachRoleAppearance?.effective(app.state,r)||r;return {...visible,...root.ASMachBalloonAppearance.normalize(visible)};}
 function apply(patch,targets){
  const prepared=[],failed=[];
  for(const r of targets){const visible=normalized(r);if(Object.entries(patch).every(([k,v])=>visible[k]===v))continue;const next={...r};root.ASMachRoleAppearance?.setMode(app.state,next,'fixed','');Object.assign(next,patch);if('boxGap'in patch||'boxDirection'in patch){if(r.page!==app.state.currentPage)return {error:'Konum ve uzaklık için aynı sayfadaki balonları seçin. Diğer görünüm ayarları tüm sayfalara uygulanabilir.'};delete next.reviewBalloonPosition;const direction=next.boxDirection||'left';if(!app.placeBalloonBesideBox(next,direction,next.boxGap??8,true)){failed.push(r.number);continue;}}
   if('boxPadding'in patch&&r.selectionBox){
    if(r.page!==app.state.currentPage)return {error:'Kutu kenar boşluğu için aynı sayfadaki balonları seçin.'};
    const w=app.elements.sourceCanvas.width,h=app.elements.sourceCanvas.height,b=r.selectionBox,d=patch.boxPadding-visible.boxPadding;
    const points=b.points?.length===4?b.points:[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];
    const p=points.map(v=>({x:v.x*w,y:v.y*h})),u={x:p[1].x-p[0].x,y:p[1].y-p[0].y},v={x:p[3].x-p[0].x,y:p[3].y-p[0].y},uw=Math.hypot(u.x,u.y),vh=Math.hypot(v.x,v.y);
    if(!w||!h||uw+2*d<1||vh+2*d<1)return {error:'Kutu kenar boşluğu bu ölçü için çok küçük.'};
    const expanded=p.map((q,i)=>({x:(q.x+([-1,1,1,-1][i]*u.x/uw+[-1,-1,1,1][i]*v.x/vh)*d)/w,y:(q.y+([-1,1,1,-1][i]*u.y/uw+[-1,-1,1,1][i]*v.y/vh)*d)/h}));
    if(expanded.some(q=>q.x<0||q.x>1||q.y<0||q.y>1))return {error:'Kutu kenar boşluğu sayfa sınırının dışına taşıyor.'};
    const x=Math.min(...expanded.map(q=>q.x)),y=Math.min(...expanded.map(q=>q.y));
    next.selectionBox={...b,x,y,w:Math.max(...expanded.map(q=>q.x))-x,h:Math.max(...expanded.map(q=>q.y))-y,...(b.points?.length===4?{points:expanded}:{})};
   }
   if(JSON.stringify(next)!==JSON.stringify(r))prepared.push([r,next]);
  }
  if(failed.length)return {error:'Konum uygulanamadı: '+failed.map(n=>'#'+n).join(', ')+'. Kutuyu veya yönü kontrol edin. Hiçbir kayıt değiştirilmedi.'};
  if(prepared.length){app.checkpoint();for(const [r,next] of prepared){if('boxGap'in patch||'boxDirection'in patch)delete r.reviewBalloonPosition;Object.assign(r,next);app.recordChange('Seçili balonlar Biçim sekmesinden düzenlendi',r);}app.renderAll();}
  return {changed:prepared.length};
 }
 function render(){
  document.getElementById('frBulkPreview')?.remove();
  body.replaceChildren();records=app.state.annotations.filter(r=>ids().includes(r.id));collection=app.state.annotations;
  host.querySelector('[data-count]').textContent=records.length+' seçili';
  status.textContent=records.length?(mode==='bulk'?'Değişiklikleri önizleyin, ardından onaylayıp uygulayın.':records.length+' seçili · Değişiklikler özel sabit stil olarak uygulanır; yöntem stilinden bağımsız korunur.'):'Çizimden veya tablodaki kutucuklardan balon seçin.';
  if(!records.length)return;
  if(mode==='bulk'){const selected=JSON.stringify(ids());const editor=root.ASMachCharacteristicEditing.open(app,records.map(r=>r.id),{host:body,canApply:()=>JSON.stringify(ids())===selected,onApplied:render,onClosed:render});editor.querySelectorAll('.acui-content > section').forEach(section=>{section.classList.add('fr-flyout');const menu=dropdown(section.querySelector('h3').textContent,section);editor.querySelector('.acui-content').insertBefore(menu,editor.querySelector('[data-preview]'));});previewWindow(editor);return;}
  const before=records.map(r=>JSON.stringify(r));
  function commitField(input){
   if(collection!==app.state.annotations||signature!==JSON.stringify(ids())||records.some((r,i)=>JSON.stringify(r)!==before[i])){render();status.textContent='Seçim veya kayıtlar değişti; alanlar yenilendi. Ayarı tekrar değiştirin.';return;}
   if(input.value===''||!input.checkValidity()){input.reportValidity();status.textContent='Geçerli bir değer girin.';return;}
   const k=input.dataset.styleField,value=input.type==='number'?Number(input.value)/(percent(k)?100:1):k==='fontWeight'?Number(input.value):k==='arrowEnabled'?input.value==='true':input.value;
   try{const result=apply({[k]:value},records);if(result.error){status.textContent=result.error;return;}records.forEach((r,i)=>before[i]=JSON.stringify(r));status.textContent=result.changed+' balon güncellendi.';}catch(error){status.textContent='Biçim uygulanamadı: '+error.message;}
  }
  for(const [title,keys] of groups){const fields=keys.map(k=>allFields.find(f=>f[0]===k));const section=document.createElement('section'),h=document.createElement('h3');section.className='fr-flyout';h.textContent=title;section.append(h);const grid=document.createElement('div');grid.className='fr-grid';section.append(grid);
   for(const [key,label,kind,max,step] of fields){const row=document.createElement('label'),enable=document.createElement('input'),caption=document.createElement('span'),input=document.createElement(Array.isArray(kind)?'select':'input');enable.type='checkbox';enable.dataset.enableStyle=key;caption.textContent=label;input.dataset.styleField=key;input.disabled=true;
    if(Array.isArray(kind)){for(const text of kind){const [v,t]=text.split(':');input.add(new Option(t,v));}}
    else{input.type=kind==='color'?'color':'number';if(kind!=='color'){input.min=kind;input.max=max;input.step=step||1;}}
    const values=records.map(r=>{const v=normalized(r);if(kind==='color')return v[key]||r.color||'#07899a';return v[key]??(key==='boxDirection'?'left':key==='arrowEnabled'?true:key==='arrowStyle'?'open':key==='shape'?'circle':key==='size'?36:key==='fontSize'?16:key==='opacity'?1:'#07899a');});
    const mixed=values.some(v=>v!==values[0]);input.value=percent(key)?Math.round(Number(values[0])*100):String(values[0]);
    if(mixed){row.title='Karışık değerler — yeni değer seçili balonlara uygulanır';caption.textContent+=' · Karışık';if(input.type==='number'){input.value='';input.placeholder='Karışık';}if(input.tagName==='SELECT'){input.add(new Option('Karışık',''),0);input.value='';}}
    enable.hidden=true;input.disabled=false;input.onchange=()=>commitField(input);row.append(caption,input);grid.append(row);
   }if(title==='Balon konumu'){const directions=document.createElement('div');directions.className='fr-directions';for(const [value,label] of [['top-left','↖'],['top','↑'],['top-right','↗'],['left','←'],['','Ölçü'],['right','→'],['bottom-left','↙'],['bottom','↓'],['bottom-right','↘']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=!value;b.title=value?allFields.find(f=>f[0]==='boxDirection')[2].find(o=>o.startsWith(value+':')).split(':')[1]:'Ölçü kutusu';b.dataset.direction=value;b.onclick=()=>{const input=grid.querySelector('[data-style-field=boxDirection]');input.value=value;commitField(input);directions.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};directions.append(b);}section.prepend(directions);}body.append(dropdown(title,section));
  }
 }
 function refresh(){if(host.hidden&&!document.getElementById('formatToolWindow')?.open)return;const next=JSON.stringify(ids());if(next!==signature||collection!==app.state.annotations){signature=next;render();}}
 function previewWindow(editor){
  const trigger=editor.querySelector('[data-preview-button]'),prepare=trigger.onclick,save=editor.querySelector('[data-save]'),summary=editor.querySelector('[data-preview]');
  trigger.onclick=()=>{
   prepare();host.querySelectorAll('.fr-dropdown[open]').forEach(d=>d.open=false);
   document.getElementById('frBulkPreview')?.remove();const dialog=document.createElement('dialog');dialog.id='frBulkPreview';dialog.setAttribute('aria-label','Değişiklikleri önizle');
   dialog.innerHTML='<header><strong>Değişiklikleri önizle</strong><button type="button" data-cancel aria-label="Kapat">×</button></header><div class="fr-preview-content" role="status"></div><footer><button type="button" class="btn" data-cancel>İptal</button><button type="button" class="btn primary" data-confirm>Onayla ve uygula</button></footer>';
   const content=dialog.querySelector('.fr-preview-content'),confirm=dialog.querySelector('[data-confirm]');content.textContent=summary.textContent;confirm.disabled=save.disabled;
   dialog.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());
   confirm.onclick=()=>{save.click();if(!editor.isConnected||!editor.open){dialog.close();}else{content.textContent=summary.textContent;confirm.disabled=save.disabled;}};
   document.body.append(dialog);dialog.showModal();
   const header=dialog.querySelector('header');let drag;
   header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=dialog.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);e.preventDefault();};
   header.onpointermove=e=>{if(drag?.id!==e.pointerId)return;const r=dialog.getBoundingClientRect();dialog.style.margin='0';dialog.style.inset='auto';dialog.style.left=Math.max(8,Math.min(innerWidth-r.width-8,e.clientX-drag.x))+'px';dialog.style.top=Math.max(8,Math.min(innerHeight-r.height-8,e.clientY-drag.y))+'px';};
   header.onpointerup=header.onpointercancel=e=>{if(drag?.id===e.pointerId){drag=null;if(header.hasPointerCapture(e.pointerId))header.releasePointerCapture(e.pointerId);}};
  };
 }
 function showBulk(targets){root.ASMachCharacteristicUI.selectIds(targets);mode='bulk';root.ASMachRibbon.open('format');signature=JSON.stringify(ids());render();}
 function init(panel,bridge){host=panel;app=bridge;host.innerHTML='<div class="fr-bar"><strong data-count>0 seçili</strong><button class="btn" data-mode="style">Balon görünümü</button><button class="btn" data-mode="bulk">Karakteristik / Denetleme</button></div><div class="fr-body"></div><div class="fr-status" role="status"></div>';body=host.querySelector('.fr-body');status=host.querySelector('.fr-status');host.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render();});
  const style=document.createElement('style');style.textContent=`
   #rbPanel-format{display:block;min-height:0;max-height:none;overflow:visible;padding:5px 8px!important}
   #rbPanel-format .fr-bar{display:flex;align-items:center;gap:7px;margin-bottom:5px}
   #rbPanel-format .fr-body{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
   #rbPanel-format .fr-dropdown{position:relative}
   #rbPanel-format .fr-dropdown>summary{list-style:none;cursor:pointer}
   #rbPanel-format .fr-dropdown[open]>summary{background:#e2f5f7;border-color:#07899a}
   #rbPanel-format .fr-flyout{position:absolute;left:0;top:calc(100% + 4px);z-index:4000;width:320px;max-width:calc(100vw - 24px);max-height:65vh;overflow:auto;overscroll-behavior:contain;padding:10px!important;box-shadow:0 8px 24px #16374b33;box-sizing:border-box}
   #rbPanel-format .fr-directions{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px}
   #rbPanel-format .fr-directions button{height:30px;border:1px solid #c5d7e2;background:#fff;color:#14556a;border-radius:3px;cursor:pointer}
   #rbPanel-format .fr-directions button[aria-pressed=true]{background:#d5f3f6;border-color:#07899a}
   #rbPanel-format section{min-width:0;background:white;border:1px solid #ccdae4;border-radius:3px;padding:5px 7px}
   #rbPanel-format h3{font-size:11px;margin:0 0 5px}
   #rbPanel-format .fr-grid{display:grid;grid-template-columns:1fr;gap:5px}
   #rbPanel-format .fr-grid label{display:grid;grid-template-columns:minmax(65px,1fr) 82px;align-items:center;gap:4px;font-size:10px;min-width:0;margin:0}
   #rbPanel-format input:not([type=checkbox]),#rbPanel-format select{width:100%;height:25px;min-height:25px;padding:2px 4px;box-sizing:border-box;font-size:11px;border:1px solid #bdcfdc;border-radius:3px}
   #rbPanel-format input[type=checkbox]{width:13px;height:13px;margin:0}
   #rbPanel-format footer{margin-left:auto;display:flex;justify-content:flex-end;gap:6px}
   #rbPanel-format .fr-status{font-size:11px;padding-top:4px}
   #rbPanel-format #acuiBulkEditor.format-embedded{display:block;position:static;inset:auto;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;margin:0;padding:0;border:0;box-shadow:none;grid-column:1/-1}
   #rbPanel-format #acuiBulkEditor .acui-head{display:none}
   #rbPanel-format #acuiBulkEditor .acui-content{display:flex;flex-wrap:wrap;gap:6px;max-height:none!important;overflow:visible!important;padding:0}
   #rbPanel-format #acuiBulkEditor [data-preview]{flex-basis:100%}
   #rbPanel-format #acuiBulkEditor .acui-section{grid-column:auto}
   #rbPanel-format #acuiBulkEditor .acui-bulk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
   #rbPanel-format #acuiBulkEditor .acui-subtle{display:none}
   #rbPanel-format #acuiBulkEditor [data-preview]{max-height:75px}
   #rbPanel-format #acuiBulkEditor .acui-foot{margin:0;padding:4px;display:flex}
   html body #rbPanel-format #acuiBulkEditor.format-embedded{display:flex!important;align-items:center;gap:8px}
   html body #rbPanel-format #acuiBulkEditor .acui-content{flex:1;min-width:0;background:transparent}
   html body #rbPanel-format #acuiBulkEditor [data-preview],html body #rbPanel-format #acuiBulkEditor .acui-foot [data-close],html body #rbPanel-format #acuiBulkEditor .acui-foot [data-save]{display:none!important}
   html body #rbPanel-format #acuiBulkEditor .acui-foot{flex:none;margin-left:auto;padding:0;border:0;background:transparent}
   html body #rbPanel-format #acuiBulkEditor [data-preview-button]{white-space:nowrap}
   #frBulkPreview{width:640px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:0;border:1px solid #adc6d3;border-radius:7px;color:#173d52;box-shadow:0 12px 45px #17374744}
   #frBulkPreview[open]{display:flex;flex-direction:column}#frBulkPreview::backdrop{background:#132f4855}
   html body #frBulkPreview>header{display:flex!important;align-items:center;justify-content:space-between;padding:10px 14px;background:#edf5f8;flex:none}
   #frBulkPreview header button{border:0;background:transparent;font-size:22px;cursor:pointer}
   #frBulkPreview .fr-preview-content{white-space:pre-wrap;padding:16px;overflow:auto;min-height:0;font-size:12px;line-height:1.6}
   #frBulkPreview>footer{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid #d0dfe7;flex:none}
   html body #rbPanel-format #acuiBulkEditor.format-embedded{justify-content:flex-start!important;flex-wrap:nowrap;width:100%;margin:0!important}
   html body #rbPanel-format #acuiBulkEditor .acui-content{justify-content:flex-start!important;margin:0!important;width:auto!important;padding:0!important}
   html body #rbPanel-format #acuiBulkEditor [data-preview-button]{background:#008b9b;color:white;border-color:#007787;font-weight:650}
   html body #frBulkPreview>header{cursor:move;touch-action:none;user-select:none;background:#e7eff4;border-bottom:1px solid #bacdd9;font-size:13px;padding:7px 12px}
   @media(max-width:1200px){#rbPanel-format .fr-grid{grid-template-columns:1fr}#rbPanel-format #acuiBulkEditor .acui-content{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;document.head.append(style);document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))host.querySelectorAll('.fr-dropdown[open]').forEach(d=>d.open=false);});host.addEventListener('keydown',e=>{if(e.key==='Escape'){host.querySelectorAll('.fr-dropdown[open]').forEach(d=>d.open=false);e.stopPropagation();}});setInterval(refresh,350);refresh();
 }
 const originalInit=init;let tool,copied;
 function openTool(next){
  mode=next;tool.querySelector('strong').textContent=next==='bulk'?'Karakteristik / Denetleme':next==='copy'?'Biçim kopyalama':'Balon görünümü';
  signature=JSON.stringify(ids());render();
  if(next==='copy'){
   body.replaceChildren();const capture=document.createElement('button'),paste=document.createElement('button'),hint=document.createElement('p');capture.className=paste.className='btn';capture.textContent='Seçili balonun biçimini al';paste.textContent='Seçili balonlara uygula';hint.textContent='Önce tek kaynak balonu seçip biçimini alın. Ardından çizimden hedef balonları seçin ve uygulayın. Ölçü ve denetleme bilgileri değiştirilmez.';
   capture.onclick=()=>{const selected=app.state.annotations.filter(r=>ids().includes(r.id));if(selected.length!==1){status.textContent='Kaynak olarak yalnız bir balon seçin.';return;}const source=normalized(selected[0]);copied=Object.fromEntries(allFields.filter(f=>!['boxDirection','boxGap'].includes(f[0])).map(f=>[f[0],source[f[0]]]).filter(([,v])=>v!==undefined));status.textContent='Biçim alındı. Şimdi hedef balonları seçin.';};
   paste.onclick=()=>{if(!copied){status.textContent='Önce kaynak biçimini alın.';return;}const targets=app.state.annotations.filter(r=>ids().includes(r.id));const result=apply(copied,targets);status.textContent=result.error||result.changed+' balonun biçimi güncellendi.';};body.append(hint,capture,paste);
  }
  if(!tool.open)tool.show();
 }
 function windowInit(panel,bridge){originalInit(panel,bridge);tool=document.createElement('dialog');tool.id='formatToolWindow';tool.setAttribute('aria-label','Düzenleme aracı');tool.innerHTML='<header><strong></strong><button class="btn" aria-label="Kapat">×</button></header>';document.body.append(tool);tool.append(body,status);tool.querySelector('button').onclick=()=>tool.close();tool.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();tool.close();}});
  panel.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>openTool(b.dataset.mode));const copy=document.createElement('button');copy.className='btn';copy.textContent='Biçim kopyalama';copy.onclick=()=>openTool('copy');panel.querySelector('.fr-bar').prepend(copy);
  const css=document.createElement('style');css.textContent=[...document.querySelectorAll('style')].find(s=>s.textContent.includes('#rbPanel-format .fr-bar')).textContent.replaceAll('#rbPanel-format','#formatToolWindow')+`
  html body dialog#formatToolWindow{position:fixed;inset:155px 24px auto auto!important;width:540px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 180px);height:auto!important;margin:0!important;padding:0;border:1px solid #b8ccd8;border-radius:9px;background:#fff;color:#173d52;z-index:4500;box-shadow:0 12px 40px #153c5033;overflow:auto;resize:both}
  html body dialog#formatToolWindow:not([open]){display:none!important}#formatToolWindow>header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#edf5f8;cursor:move;touch-action:none}#formatToolWindow .fr-body{display:flex;flex-wrap:wrap;gap:8px;padding:12px}#formatToolWindow .fr-status{padding:10px;border-top:1px solid #d8e4ec}#formatToolWindow .fr-flyout{position:static!important;width:100%!important;max-height:none!important;box-shadow:none!important;margin-top:6px}#formatToolWindow .fr-dropdown{width:100%}html body #formatToolWindow #acuiBulkEditor.format-embedded{display:block!important}html body #formatToolWindow #acuiBulkEditor .acui-content{display:block!important}#formatToolWindow p{font-size:12px;line-height:1.6}#rbPanel-format .fr-bar{margin:0}
  html body dialog#productionWorkspace.project-info-window{inset:50% auto auto 50%!important;transform:translate(-50%,-50%);margin:0!important;width:min(1060px,94vw)!important;height:min(720px,88dvh)!important;max-height:88dvh!important;border:1px solid #b8ccd8;border-radius:10px;padding:0;box-shadow:0 16px 55px #16384944;overflow:hidden}#productionWorkspace.project-info-window::backdrop{background:#17364c55}html body #productionWorkspace.project-info-window>header{display:flex!important;flex:none;padding:10px 16px}html body #productionWorkspace.project-info-window>header h2{font-size:17px;margin:0}html body #productionWorkspace.project-info-window nav{flex:none}html body #productionWorkspace.project-info-window main{min-height:0;overflow:auto;padding:12px}html body #productionWorkspace.project-info-window footer{flex:none;flex-wrap:wrap}html body #productionWorkspace.project-info-window .pr-project>section{grid-template-columns:1fr;padding:12px;gap:10px}html body #productionWorkspace.project-info-window .pr-project .pr-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
  `;document.head.append(css);const header=tool.querySelector('header');let drag;header.onpointerdown=e=>{if(e.button||e.target.closest('button'))return;const r=tool.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);};header.onpointermove=e=>{if(!drag)return;tool.style.setProperty('inset',Math.max(0,Math.min(innerHeight-60,e.clientY-drag.y))+'px auto auto '+Math.max(0,Math.min(innerWidth-tool.offsetWidth,e.clientX-drag.x))+'px','important');};header.onpointerup=header.onpointercancel=()=>drag=null;
 }
 const originalRender=render;render=function(){if(mode==='copy'){host.querySelector('[data-count]').textContent=ids().length+' seçili';return;}originalRender();};
 root.ASMachFormatRibbon={init:windowInit,showBulk(targets){showBulk(targets);openTool('bulk');},apply};
})(window);
