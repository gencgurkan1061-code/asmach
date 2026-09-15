(function(root){
 'use strict';let app;const clone=x=>JSON.parse(JSON.stringify(x));const roles={operator:'Operatör',quality:'Kalite operatörü'};
 function factory(methods,fallback){const result={operator:{},quality:{}};methods.forEach((m,i)=>{const hue=(i*137.508)%360,s=.68,l=.37,a=s*Math.min(l,1-l),f=n=>{const k=(n+hue/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');},color='#'+f(0)+f(8)+f(4);for(const role of Object.keys(roles))result[role][m.value]={...fallback(m.value,i),...root.ASMachBalloonAppearance.normalize({}),color,size:20,fontSize:10,opacity:1,shape:['circle','square','hexagon'][i%3],arrowEnabled:true,arrowStyle:['open','triangle','diamond','dot'][i%4],balloonLineStyle:role==='quality'?'dashed':'solid',boxLineStyle:'solid'};});return result;}
 const appearanceKeys=['color','size','fontSize','shape','opacity','arrowEnabled','arrowStyle','balloonFill','boxFill','textColor','boxColor','leaderColor','boxGap','boxPadding','fontWeight','arrowSize','boxFillOpacity','boxOpacity','balloonOpacity','leaderOpacity','textOpacity','boxLineWidth','boxLineStyle','balloonLineWidth','balloonLineStyle','leaderLineWidth','leaderLineStyle'];
 function methodStyle(state,method){return method&&state?.methodStyles?.[method]||null;}
 function source(state,item){
  if(item.balloonStyleMode==='fixed')return{mode:'fixed',role:item.balloonStyleMethod?'fixed-method':'custom',method:item.balloonStyleMethod||'',label:item.balloonStyleMethod?'Sabit yöntem stili':'Özel sabit stil'};
  const plans=root.ASMachRolePlans?.normalize(item);
  if(item.balloonStyleMode==='common'&&item.commonPlanEnabled===true&&item.inspectionMethod)return{mode:'common',role:'common',method:item.inspectionMethod,label:'Ortak'};
  if(item.balloonStyleMode==='quality'&&plans?.quality?.enabled&&plans.quality.inspectionMethod)return{mode:'quality',role:'quality',method:plans.quality.inspectionMethod,label:'Kalite'};
  if(item.balloonStyleMode==='operator'&&plans?.operator?.enabled&&plans.operator.inspectionMethod)return{mode:'operator',role:'operator',method:plans.operator.inspectionMethod,label:'Operatör'};
  if(item.commonPlanEnabled===true&&item.inspectionMethod)return{mode:'auto',role:'common',method:item.inspectionMethod,label:'Ortak'};
  if(plans?.quality?.enabled&&plans.quality.inspectionMethod)return{mode:'auto',role:'quality',method:plans.quality.inspectionMethod,label:'Kalite'};
  if(plans?.operator?.enabled&&plans.operator.inspectionMethod)return{mode:'auto',role:'operator',method:plans.operator.inspectionMethod,label:'Operatör'};
  return{mode:'auto',role:'default',method:item.inspectionMethod||'',label:'Proje varsayılanı'};
 }
 function applyStyle(item,style){if(!style)return item;const normalized={...style,...root.ASMachBalloonAppearance.normalize(style)};for(const key of appearanceKeys)if(normalized[key]!==undefined)item[key]=normalized[key];return item;}
 function effective(state,item){const selected=source(state,item),style=selected.role==='custom'?null:methodStyle(state,selected.method);if(!style)return item;const resolved={...style,...root.ASMachBalloonAppearance.normalize(style)},patch={};for(const key of appearanceKeys)if(resolved[key]!==undefined)patch[key]=resolved[key];if(item.ocrAutoSized){if(Number.isFinite(item.size))patch.size=item.size;if(Number.isFinite(item.fontSize))patch.fontSize=item.fontSize;}for(const k of Object.keys(item.newRecordAppearance||{}))if(appearanceKeys.includes(k)&&item[k]!==undefined)patch[k]=item[k];return{...item,...patch};}
 function setMode(state,item,mode,method=''){
  if(mode==='auto'){item.ocrAutoSized=false;item.balloonStyleMode='auto';item.balloonStyleMethod='';return item;}
  if(['common','operator','quality'].includes(mode)){item.ocrAutoSized=false;item.balloonStyleMode=mode;item.balloonStyleMethod='';return item;}
  const current=effective(state,item);item.ocrAutoSized=false;item.balloonStyleMode='fixed';item.balloonStyleMethod=method||'';applyStyle(item,methodStyle(state,method)||current);return item;
 }
 function init(bridge){app=bridge;const original=root.ASMachAppearanceSettings.mount;
  document.getElementById('balloonSettingsModal')?.style.setProperty('padding','0','important');
  const layout=document.createElement('style');layout.textContent=`
  #balloonSettingsModal .settings-card{box-sizing:border-box;overflow:hidden}
  #balloonSettingsModal .settings-card>.modal-head{padding:12px 20px!important}
  #balloonSettingsModal .settings-card>.modal-head h3{font-size:18px;margin:3px 0 0}
  #balloonSettingsModal .settings-card>.modal-body{display:grid!important;grid-template-columns:1fr auto;grid-template-rows:auto minmax(0,1fr);gap:10px 16px;padding:12px 16px!important;overflow:hidden;background:#f1f6f9}
  #balloonSettingsModal .appearance-legend{align-self:center;min-width:0}
  #balloonSettingsModal .appearance-legend[open]{grid-column:1/-1}
  #balloonSettingsModal .settings-section-head{margin:0;gap:12px}
  #balloonSettingsModal .settings-section-head h4{display:none}
  #balloonSettingsModal .settings-list{grid-column:1/-1;min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden!important}
  #balloonSettingsModal .ra-rolebar{margin:0;padding:8px 10px;border:1px solid #d4e2eb;border-radius:8px;background:white;flex-shrink:0}
  #balloonSettingsModal .ra-rolebar .btn{min-height:30px;padding:6px 12px}
  #balloonSettingsModal .appearance-manager{width:100%;max-width:none;margin:0;grid-template-columns:230px minmax(0,1fr);gap:12px;min-height:0;flex:1;align-items:stretch}
  #balloonSettingsModal .appearance-nav{max-height:none;min-height:0;overflow:auto;padding:0 3px 0 0;gap:5px}
  #balloonSettingsModal .appearance-nav button{min-height:40px;padding:4px 9px;border-radius:6px}
  #balloonSettingsModal .appearance-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-content:start;gap:16px;padding:16px;overflow:auto;border-radius:8px}
  #balloonSettingsModal .ra-previews{grid-column:1/-1;gap:10px;margin:0}
  #balloonSettingsModal .ra-previews section{padding:8px 12px;border-radius:7px}
  #balloonSettingsModal .ra-previews svg{height:85px;display:block}
  #balloonSettingsModal .appearance-fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start;background:#f8fbfd;padding:12px;border:1px solid #e0e9ef;border-radius:7px}
  #balloonSettingsModal .appearance-name{grid-column:auto}
  #balloonSettingsModal .appearance-lines{margin:0;padding:12px;gap:10px;grid-template-columns:72px minmax(0,1fr) minmax(0,1fr);align-content:start;border:1px solid #e0e9ef;border-radius:7px;background:#f8fbfd}
  #balloonSettingsModal .appearance-actions{grid-column:1/-1;margin:0;padding-top:12px}
  #balloonSettingsModal .appearance-status{grid-column:1/-1;margin:0;min-height:0}
  #balloonSettingsModal .appearance-status:empty{display:none}
  #balloonSettingsModal .settings-card>.modal-actions{padding:10px 16px!important;background:white;border-top:1px solid #d4e2eb}
  @media(min-width:1650px){#balloonSettingsModal .appearance-detail{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) 300px}#balloonSettingsModal .ra-previews{grid-column:3;grid-row:1;grid-template-columns:1fr;align-content:start}#balloonSettingsModal .ra-previews svg{height:110px}#balloonSettingsModal .appearance-fields{grid-column:1;grid-row:1}#balloonSettingsModal .appearance-lines{grid-column:2;grid-row:1}}
  @media(max-width:1000px){#balloonSettingsModal .appearance-manager{grid-template-columns:190px minmax(0,1fr)}#balloonSettingsModal .appearance-detail{grid-template-columns:1fr}#balloonSettingsModal .appearance-fields,#balloonSettingsModal .appearance-lines{grid-column:1}}
  @media(max-width:650px){#balloonSettingsModal .settings-card>.modal-body{display:flex!important;flex-direction:column;overflow:auto}#balloonSettingsModal .settings-list{overflow:visible!important;flex-shrink:0}#balloonSettingsModal .appearance-manager{grid-template-columns:1fr}#balloonSettingsModal .appearance-nav{max-height:95px;display:flex}#balloonSettingsModal .appearance-detail{overflow:visible}#balloonSettingsModal .ra-rolebar{flex-wrap:wrap}}
  `;
  document.head.append(layout);
  const head=document.querySelector('#balloonSettingsModal .modal-head'),title=document.createElement('div');title.className='ra-title';
  title.append(...head.querySelectorAll('small,h3'));head.prepend(title);head.append(document.getElementById('settingsSaveButton'));
  const headerStyle=document.createElement('style');headerStyle.textContent=`
   html body #balloonSettingsModal .settings-card>.modal-head{gap:8px;padding:10px 16px!important;flex-wrap:nowrap}
   #balloonSettingsModal .ra-title{flex:1;min-width:0}#balloonSettingsModal .ra-title small{font-size:9px;letter-spacing:.1em}#balloonSettingsModal .ra-title h3{margin:2px 0 0;font-size:16px}
   html body #balloonSettingsModal .modal-head #settingsCancelButton{order:1;margin-left:0}
   html body #balloonSettingsModal .modal-head #settingsSaveButton{order:2;min-height:30px;padding:6px 12px}
   html body #balloonSettingsModal .settings-card>.modal-actions{display:none}
   html body #balloonSettingsModal .settings-section-head{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
   html body #balloonSettingsModal .settings-section-head>div{display:none}
   #balloonSettingsModal .settings-section-head .btn{min-height:30px;padding:5px 10px;font-size:11px}
   #balloonSettingsModal .ra-reset{color:#985329}
   html body #balloonSettingsModal .appearance-legend summary{padding:7px 10px;border:1px solid #d4e2eb;border-radius:5px;background:white;display:list-item;width:fit-content;list-style-position:inside}
   @media(max-width:650px){html body #balloonSettingsModal .settings-card>.modal-head{flex-wrap:wrap}.ra-title{flex-basis:100%!important}}
  `;document.head.append(headerStyle);
  root.ASMachAppearanceSettings.mount=(container,options)=>{container._roleEvents?.abort();container._roleEvents=new AbortController();const signal=container._roleEvents.signal;const {draft,fallback}=options;
   const rerender=()=>root.ASMachAppearanceSettings.mount(container,options);
   original(container,options);
   const card=container.closest('.settings-card');card.classList.remove('classification-mode');
   let areas=card.querySelector('.style-area-tabs');if(!areas){areas=document.createElement('div');areas.className='style-area-tabs';for(const [value,title] of [['styles','Kontrol yöntemi stilleri'],['classes','Sınıflandırmalar']]){const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.styleArea=value;button.textContent=title;button.onclick=()=>{if(value==='classes'){root.ASMachClassification.open();return;}card.classList.remove('classification-mode');card.querySelector('#classificationStyleDock').hidden=true;areas.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};areas.append(button);}container.before(areas);}
   areas.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.styleArea==='styles')));
   let dock=card.querySelector('#classificationStyleDock');if(!dock){dock=document.createElement('div');dock.id='classificationStyleDock';container.after(dock);}dock.hidden=true;
   let footer=card.querySelector('.style-save-footer');if(!footer){footer=document.createElement('div');footer.className='style-save-footer';footer.innerHTML='<small>Stil değişikliklerini uygulamak için kaydedin. Sınıflandırmalar otomatik kaydedilir.</small>';card.append(footer);}footer.append(document.getElementById('settingsSaveButton'));
   document.head.append(layout);
   document.head.append(alignment);
   const bar=document.createElement('div');bar.className='ra-rolebar';bar.innerHTML='<strong>Tek balon · Ortak çizim stili</strong>';const reset=document.createElement('button');reset.className='btn';reset.textContent='Fabrika ayarlarına dön';reset.type='button';reset.onclick=async()=>{if(!await root.ASMachMessages.confirm('Tüm yöntem stilleri fabrika ayarlarına dönecek. Yöntemler, ölçüler ve kontrol planları silinmez. Kaydet ile uygulanır. Devam edilsin mi?'))return;draft.styles=factory(draft.methods,fallback).operator;rerender();};reset.classList.add('ra-reset');const tools=container.closest('.settings-card').querySelector('.settings-section-head');tools.querySelector('.ra-reset')?.remove();tools.append(reset);
   const both=document.createElement('div');both.className='ra-previews';both.style.gridTemplateColumns='1fr';const update=()=>{const key=draft.activeMethod||draft.methods[0].value;both.innerHTML='<section><strong>Çizim ve PDF önizlemesi</strong>'+root.ASMachBalloonAppearance.preview(draft.styles[key],22)+'</section>';};update();container.querySelector('.appearance-detail').prepend(both);container.addEventListener('input',update,{signal});container.addEventListener('change',update,{signal});container.addEventListener('click',()=>{if(!both.isConnected)container.querySelector('.appearance-detail')?.prepend(both);update();},{signal});
   redesign(card,container,both);
   container.addEventListener('click',()=>redesign(card,container,both),{signal});
   container.addEventListener('change',()=>studio(container,false),{signal});
  };
  const css=document.createElement('style');css.textContent=`#balloonSettingsModal{padding:0;z-index:2100}#balloonSettingsModal .settings-card{width:100vw!important;height:100dvh;max-width:none!important;max-height:100dvh!important;border:0;border-radius:0}.ra-rolebar{display:flex;gap:8px;align-items:center;margin:0 0 14px}.ra-rolebar>strong{margin-right:10px}.ra-rolebar>button:last-child{margin-left:auto;color:#985329}.ra-previews{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:15px}.ra-previews section{border:1px solid #d5e4ec;border-radius:10px;background:#f5fafc;padding:10px}.ra-previews svg{width:100%;height:110px}.ra-previews strong{font-size:12px;color:#32566e}#balloonSettingsModal .appearance-preview{display:none}#balloonSettingsModal .appearance-manager{grid-template-columns:240px minmax(0,1fr);max-width:1450px;margin:auto}#balloonSettingsModal .appearance-nav{max-height:calc(100dvh - 270px)}#balloonSettingsModal .appearance-detail{padding:18px;background:white}#balloonSettingsModal .appearance-fields{gap:14px}#balloonSettingsModal .appearance-lines{gap:12px;margin-top:18px;padding-top:18px}#balloonRoleView{height:29px;border:1px solid #c6dde7;border-radius:5px;color:#20516a;background:white;font-size:11px;max-width:150px}@media(max-width:800px){#balloonSettingsModal .appearance-manager{grid-template-columns:170px minmax(0,1fr)}.ra-rolebar{flex-wrap:wrap}}`;document.head.append(css);
 }
 function redesign(card,container,preview){
  const modal=card.closest('#balloonSettingsModal');modal.classList.add('sw-redesign');
  const body=card.querySelector('.modal-body');let shell=body.querySelector('.sw-shell');
  if(!shell){shell=document.createElement('div');shell.className='sw-shell';const top=document.createElement('div');top.className='sw-top';const title=document.createElement('div');title.className='sw-title';title.innerHTML='<strong>Balon ve işaret tasarımı</strong><span>Yöntem stilleri ve sınıflandırmalar</span>';top.append(title,card.querySelector('.style-area-tabs'));const tools=card.querySelector('.settings-section-head');top.append(tools);const content=document.createElement('div');content.className='sw-content';content.append(container,card.querySelector('#classificationStyleDock'));const legend=card.querySelector('.appearance-legend');shell.append(top);if(legend)shell.append(legend);shell.append(content);body.append(shell);}
  const manager=container.querySelector('.appearance-manager');if(manager&&preview)manager.append(preview);
  card.querySelector('.style-save-footer')?.append(document.getElementById('settingsSaveButton'));
  studio(container,false);
 }
 function studio(host,classification=false){
  const manager=host.querySelector(classification?'.cl-layout':'.appearance-manager');if(!manager)return;
  const nav=manager.querySelector(classification?'.cl-list':'.appearance-nav'),editor=manager.querySelector(classification?'.cl-editor':'.appearance-detail'),preview=manager.querySelector(classification?'.cl-preview':'.ra-previews');
  if(!editor||!preview)return;manager.classList.add('studio-grid');nav.classList.add('studio-list');editor.classList.add('studio-inspector');
  let stage=manager.querySelector('.studio-stage');if(!stage){stage=document.createElement('section');stage.className='studio-stage';stage.innerHTML='<header><span>CANLI ÖNİZLEME</span><strong>Çizim üzerindeki görünüm</strong><small>Bir öğeye tıklayın veya aşağıdan seçin.</small></header><div class="studio-canvas"></div><div class="studio-parts" role="group" aria-label="Düzenlenecek öğe"></div><p class="studio-note">Önizleme büyütülmüştür. Çizim ve PDF boyutları ayarladığınız px değerleriyle korunur.</p>';manager.append(stage);}stage.querySelector('.studio-canvas').append(preview);
  const groups=[];
  if(classification){
   const grid=editor.querySelector('.cl-fields');
   for(const [title,keys] of [['Genel',['name','criteria']],['İşaret',['shape','fill','border','size','opacity','lineWidth','lineStyle']],['Yazı',['text','prefix','suffix','ink','font','fontWeight','textOpacity']],['Yerleşim',['mode','side']]]){let group=grid.querySelector('[data-studio-group="'+title+'"]');if(!group){group=document.createElement('section');group.dataset.studioGroup=title;const heading=document.createElement('h3');heading.textContent=title;group.append(heading);for(const k of keys){const input=grid.querySelector('[data-class-field="'+k+'"]');if(input)group.append(input.closest('label'));}grid.append(group);}groups.push([title,group]);}
  }else for(const group of editor.querySelectorAll('.appearance-group'))groups.push([({'Yöntem':'Genel','Balon':'Balon','Yazı':'Yazı','Ölçü kutusu':'Kutu','Bağlantı / ok':'Bağlantı'})[group.dataset.section],group]);
  const parts=stage.querySelector('.studio-parts');if([...parts.children].map(b=>b.dataset.part).join('|')!==groups.map(([n])=>n).join('|'))parts.replaceChildren();
  const choose=title=>{for(const [,g] of groups)g.classList.remove('studio-inactive');};
  for(const [title] of groups){let b=[...parts.children].find(n=>n.dataset.part===title);if(!b){b=document.createElement('button');b.type='button';b.dataset.part=title;b.textContent=title;parts.append(b);}b.onclick=()=>choose(title);}
  choose(groups.some(([n])=>n===host.dataset.studioPart)?host.dataset.studioPart:classification?'İşaret':'Balon');
  preview.onclick=e=>{const svg=e.target.closest('svg');if(!svg||e.target===svg)return;if(classification){choose('İşaret');return;}const target=e.target,tag=target.tagName.toLowerCase(),balloon=target.closest('g[fill]')||tag==='text'&&Number(target.getAttribute('x'))>230;choose(balloon?'Balon':tag==='rect'||tag==='text'?'Kutu':'Bağlantı');};
  for(const select of editor.querySelectorAll('select[data-edit=shape],select[data-edit=arrowStyle],select[data-class-field=shape]')){
   let tiles=select.nextElementSibling;if(!tiles?.classList.contains('studio-tiles')){tiles=document.createElement('div');tiles.className='studio-tiles';tiles.setAttribute('role','group');tiles.setAttribute('aria-label',select.closest('label').firstChild.textContent);select.after(tiles);select.hidden=true;
    const shapes={circle:'<circle cx="16" cy="12" r="8"/>',square:'<rect x="8" y="4" width="16" height="16"/>',diamond:'<path d="M16 3 26 12 16 21 6 12Z"/>',hexagon:'<path d="M11 4h10l5 8-5 8H11l-5-8Z"/>',triangle:'<path d="M16 3 26 21H6Z"/>',open:'<path d="M27 12H5m8-7-8 7 8 7"/>',dot:'<circle cx="8" cy="12" r="4" fill="currentColor"/><path d="M12 12h16"/>'};
    for(const o of select.options){const b=document.createElement('button');b.type='button';b.dataset.tile=o.value;b.title=o.textContent;b.setAttribute('aria-label',o.textContent);b.innerHTML='<svg viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+(shapes[o.value]||'')+'</svg>';b.onclick=()=>{select.value=o.value;select.dispatchEvent(new Event('change',{bubbles:true}));};tiles.append(b);}
   }tiles.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.tile===select.value));b.disabled=select.disabled;});
  }
  for(const label of editor.querySelectorAll('label:has(input[type=color])'))label.classList.add('studio-color');
  if(!nav.previousElementSibling?.classList.contains('studio-search')){let library=manager.querySelector('.studio-library');if(!library){library=document.createElement('aside');library.className='studio-library';const search=document.createElement('input');search.className='studio-search';search.type='search';search.placeholder=classification?'Sınıf ara…':'Yöntem ara…';search.setAttribute('aria-label',search.placeholder);search.oninput=()=>nav.querySelectorAll('button').forEach(b=>b.hidden=!b.textContent.toLocaleLowerCase('tr').includes(search.value.toLocaleLowerCase('tr')));library.append(search);manager.prepend(library);}library.append(nav);}
  host.classList.add('studio-host');
  for(const input of editor.querySelectorAll('[data-edit=fontSize],[data-class-field=font]'))input.title='Üst yazı boyutu (px). Yazı şekle sığmazsa görünümde otomatik küçültülür; bu değer değişmez.';
  if(classification){const header=host.querySelector(':scope>header');if(header)manager.querySelector('.studio-library').prepend(header);}
  manager.classList.add('studio-dashboard');editor.append(stage);
  parts.hidden=true;stage.querySelector('header small').textContent='Ayar değişiklikleri burada anında görünür.';
  const actions=editor.querySelector(':scope>.appearance-actions');if(actions){stage.querySelector('.appearance-actions')?.remove();stage.append(actions);}
  if(classification){
   const header=manager.querySelector('.studio-library>header');
   if(header){const input=header.querySelector('[data-new]'),add=header.querySelector('[data-add]');header.classList.add('studio-class-actions');header.querySelector('h3').hidden=true;input.hidden=true;const originalAdd=add.onclick;add.textContent='+ Sınıflandırma ekle';add.onclick=()=>{if(input.hidden){input.hidden=false;add.textContent='Ekle';input.focus();return;}originalAdd();};stage.append(header);}
   const remove=editor.querySelector(':scope>[data-remove]');if(remove)stage.append(remove);
  }
 }
 function save(draft,state){if(state.metadata.roleAppearance)state.metadata.roleAppearance.enabled=false;}
 const alignment=document.createElement('style');alignment.textContent=`
 html body #balloonSettingsModal .settings-card{display:flex!important;flex-direction:column!important;min-height:0;padding-bottom:58px!important;box-sizing:border-box}
 html body #balloonSettingsModal .style-save-footer{position:absolute;bottom:0;left:0;right:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;background:white;border-top:1px solid #c9dce7;min-height:50px;box-sizing:border-box}
 .style-save-footer small{font-size:11px;color:#547083}.style-save-footer #settingsSaveButton{margin:0!important;min-width:120px}
 .style-area-tabs{display:flex;gap:6px;max-width:1200px;margin:0 auto 10px}.style-area-tabs button[aria-pressed=true]{background:#e1f2f5;border-color:#07899a;color:#007b8c}
 html body #balloonSettingsModal .classification-mode .appearance-manager,html body #balloonSettingsModal .classification-mode .appearance-legend{display:none!important}
 html body #balloonSettingsModal .classification-mode .settings-section-head{display:none!important}
 #classificationStyleDock[hidden]{display:none!important}
 html body #balloonSettingsModal .classification-mode .sw-content>.studio-host{display:none!important;height:0!important}
 html body #balloonSettingsModal .classification-mode #classificationStyleDock{display:block;margin:0!important;width:100%;height:100%!important;min-height:0}
 html body #balloonSettingsModal .appearance-manager{max-width:1200px!important;grid-template-columns:190px minmax(0,1fr)!important}
 html body #balloonSettingsModal .appearance-detail{grid-template-columns:minmax(0,1fr) 215px!important}
 html body #balloonSettingsModal [data-section="Balon"],html body #balloonSettingsModal [data-section="Ölçü kutusu"],html body #balloonSettingsModal [data-section="Bağlantı / ok"]{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px 12px!important}
 html body #balloonSettingsModal .appearance-component-line{grid-column:1/-1!important;display:grid!important;grid-template-columns:95px minmax(0,1fr)!important;align-items:center!important;border-top:1px solid #dbe5ec!important;padding-top:7px!important}
 html body #balloonSettingsModal [data-section="Bağlantı / ok"] .appearance-component-line>strong{display:block!important}
 html body #balloonSettingsModal .appearance-component-line .appearance-line-controls{justify-content:flex-start;flex-wrap:nowrap}
 html body #balloonSettingsModal .appearance-group>label{min-width:0;align-self:end!important}
 html body #balloonSettingsModal .appearance-group .appearance-line-toggle{height:50px;align-items:center!important}
 html body #balloonSettingsModal .appearance-group input,html body #balloonSettingsModal .appearance-group select{height:30px}
 #balloonSettingsModal #classificationManager .cl-layout{grid-template-columns:190px minmax(0,1fr);gap:12px}#balloonSettingsModal #classificationManager .cl-editor{padding:12px;background:white;border:1px solid #d5e1e9;border-radius:6px}
 @media(max-width:850px){html body #balloonSettingsModal .appearance-detail{grid-template-columns:minmax(0,1fr) 160px!important}html body #balloonSettingsModal .appearance-manager{grid-template-columns:155px minmax(0,1fr)!important}}
 `;document.head.append(alignment);
 function sync(){}
 const workspaceDesign=document.createElement('style');workspaceDesign.textContent=`
 #balloonSettingsModal.sw-redesign .settings-card{height:100%!important;max-height:100%!important;display:flex!important;flex-direction:column!important;padding:0!important;overflow:hidden!important;background:#f5f7fa}
 #balloonSettingsModal.sw-redesign .settings-card>.modal-body{display:block!important;flex:1 1 0!important;min-height:0!important;padding:0!important;overflow:hidden!important}
 #balloonSettingsModal.sw-redesign .sw-shell{height:100%;display:flex;flex-direction:column;min-height:0}
 #balloonSettingsModal.sw-redesign .sw-top{display:flex;align-items:center;gap:18px;padding:14px 20px;background:white;border-bottom:1px solid #dce5ec;flex-shrink:0;flex-wrap:wrap}
 #balloonSettingsModal.sw-redesign .sw-title{display:grid;gap:4px;min-width:190px}.sw-title strong{font-size:15px;color:#143d52}.sw-title span{font-size:11px;color:#627c8d}
 #balloonSettingsModal.sw-redesign .style-area-tabs{display:flex;gap:3px;margin:0!important;padding:3px;background:#edf3f6;border-radius:7px;max-width:none;flex-shrink:0}
 #balloonSettingsModal.sw-redesign .style-area-tabs .btn{font-size:11px;min-height:30px;border:0;background:transparent;color:#516b7d;padding:5px 12px}
 #balloonSettingsModal.sw-redesign .style-area-tabs .btn[aria-pressed=true]{background:white;color:#007d8c;box-shadow:0 1px 3px #15384a22}
 #balloonSettingsModal.sw-redesign .settings-section-head{margin:0 0 0 auto!important;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0!important}
 #balloonSettingsModal.sw-redesign .settings-section-head .btn{font-size:11px;min-height:30px}
 #balloonSettingsModal.sw-redesign .appearance-legend{margin:0!important;padding:4px 20px!important;background:white;border:0;border-bottom:1px solid #e1e9ee;flex-shrink:0}
 #balloonSettingsModal.sw-redesign .appearance-legend summary{border:0!important;background:transparent!important;font-size:10px;padding:4px 0!important}
 #balloonSettingsModal.sw-redesign .appearance-legend[open]{max-height:32vh;overflow:auto}
 #balloonSettingsModal.sw-redesign .sw-content{flex:1 1 0;min-height:0;overflow:auto;padding:16px 20px}
 #balloonSettingsModal.sw-redesign .settings-list{display:block!important;overflow:visible!important;min-height:0!important;margin:0!important}
 #balloonSettingsModal.sw-redesign .appearance-manager{display:grid!important;grid-template-columns:190px minmax(480px,1fr) 245px!important;max-width:1440px!important;margin:0 auto!important;gap:16px!important;align-items:start!important;min-height:0!important;width:100%!important}
 #balloonSettingsModal.sw-redesign .appearance-nav{display:flex!important;flex-direction:column!important;gap:3px!important;padding:6px!important;border:1px solid #d9e5ed;border-radius:8px;background:white;max-height:calc(100dvh - 290px)!important;overflow:auto!important;height:auto!important}
 #balloonSettingsModal.sw-redesign .appearance-nav button{display:grid;grid-template-columns:minmax(0,1fr) 50px;min-height:36px!important;border:0;border-radius:5px;padding:6px 8px!important;font-size:11px!important;font-weight:500}
 #balloonSettingsModal.sw-redesign .appearance-nav svg{width:50px!important;height:24px!important}
 #balloonSettingsModal.sw-redesign .appearance-nav button[aria-pressed=true]{background:#e7f5f6;border:0;box-shadow:inset 3px 0 #008a99;color:#006c7a}
 #balloonSettingsModal.sw-redesign .appearance-detail{display:flex!important;flex-direction:column!important;gap:12px!important;padding:0!important;border:0!important;border-radius:0!important;overflow:visible!important;background:none!important;height:auto!important;min-height:0!important}
 #balloonSettingsModal.sw-redesign .appearance-fields{display:contents!important}
 #balloonSettingsModal.sw-redesign .appearance-group{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px 14px!important;padding:14px 16px!important;background:white!important;border:1px solid #d9e5ed!important;border-radius:8px!important;align-items:end!important;margin:0!important}
 #balloonSettingsModal.sw-redesign .appearance-group h3{font-size:12px!important;color:#18475c;margin:0 0 3px!important;grid-column:1/-1!important}
 #balloonSettingsModal.sw-redesign [data-section="Yöntem"]{grid-template-columns:minmax(0,1fr) 110px!important}
 #balloonSettingsModal.sw-redesign .appearance-name{grid-column:auto!important}
 #balloonSettingsModal.sw-redesign .appearance-group label{font-size:11px!important;font-weight:400;gap:5px!important;display:grid;min-width:0}
 #balloonSettingsModal.sw-redesign .appearance-group input:not([type=checkbox]):not([type=range]),#balloonSettingsModal.sw-redesign .appearance-group select{height:32px!important;min-height:32px!important;font-size:12px!important;border-radius:5px;padding:4px 7px;width:100%;box-sizing:border-box}
 #balloonSettingsModal.sw-redesign .appearance-slider{display:block!important}
 #balloonSettingsModal.sw-redesign .appearance-slider input[type=range]{display:none!important}
 #balloonSettingsModal.sw-redesign .appearance-group .appearance-component-line{display:grid!important;grid-template-columns:105px minmax(0,1fr)!important;grid-column:1/-1!important;padding-top:8px!important;border-top:1px solid #edf1f4!important;gap:8px!important;align-items:center!important}
 #balloonSettingsModal.sw-redesign .sw-shell>.appearance-legend{align-self:stretch!important;width:auto!important}
 #balloonSettingsModal.sw-redesign .appearance-component-line>strong{display:block!important;font-size:10px!important;font-weight:500;color:#607989}
 #balloonSettingsModal.sw-redesign .appearance-line-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap!important}
 #balloonSettingsModal.sw-redesign .appearance-inline-width{display:flex!important;align-items:center;gap:5px!important}
 #balloonSettingsModal.sw-redesign .appearance-inline-width input{width:64px!important}
 #balloonSettingsModal.sw-redesign .appearance-line-toggle{display:flex!important;height:49px!important;align-items:center!important}
 #balloonSettingsModal.sw-redesign .ra-previews{display:block!important;grid-column:3!important;grid-row:auto!important;align-self:start!important;margin:0!important;position:sticky;top:0}
 #balloonSettingsModal.sw-redesign .ra-previews section{background:white!important;border:1px solid #d9e5ed;border-radius:8px;padding:14px!important;height:auto!important}
 #balloonSettingsModal.sw-redesign .ra-previews strong{font-size:12px!important;color:#18475c}
 #balloonSettingsModal.sw-redesign .ra-previews svg{width:100%!important;height:160px!important;display:block}
 #balloonSettingsModal.sw-redesign .appearance-actions{margin:0!important;padding:0!important;border:0;display:flex;flex-wrap:wrap;gap:6px}
 #balloonSettingsModal.sw-redesign .appearance-actions .btn{font-size:10px!important;min-height:30px}
 #balloonSettingsModal.sw-redesign .appearance-status:empty,#balloonSettingsModal.sw-redesign .appearance-lines[hidden]{display:none!important}
 #balloonSettingsModal.sw-redesign .style-save-footer{position:static!important;flex:0 0 auto!important;display:flex;justify-content:space-between;align-items:center;padding:12px 20px!important;min-height:56px!important;background:white;border-top:1px solid #d9e5ed;z-index:1}
 #balloonSettingsModal.sw-redesign .style-save-footer #settingsSaveButton{min-height:34px!important;padding:7px 22px!important}
 #balloonSettingsModal.sw-redesign #classificationStyleDock{max-width:1440px;margin:auto}
 #balloonSettingsModal.sw-redesign #classificationManager{max-width:none}
 #balloonSettingsModal.sw-redesign #classificationManager .cl-layout{grid-template-columns:190px minmax(0,1fr);gap:16px}
 #balloonSettingsModal.sw-redesign #classificationManager .cl-list{padding:6px;border:1px solid #d9e5ed;border-radius:8px;background:white;align-self:start}
 #balloonSettingsModal.sw-redesign #classificationManager .cl-editor{padding:16px;border-radius:8px}
 @media(max-width:1150px){#balloonSettingsModal.sw-redesign .appearance-manager{grid-template-columns:165px minmax(0,1fr)!important}#balloonSettingsModal.sw-redesign .ra-previews{grid-column:2!important;position:static}#balloonSettingsModal.sw-redesign .ra-previews svg{height:110px!important}}
 @media(max-width:720px){#balloonSettingsModal.sw-redesign .sw-top{padding:10px;gap:8px}#balloonSettingsModal.sw-redesign .sw-content{padding:10px}#balloonSettingsModal.sw-redesign .appearance-manager{grid-template-columns:minmax(0,1fr)!important}#balloonSettingsModal.sw-redesign .appearance-nav{max-height:145px!important}#balloonSettingsModal.sw-redesign .ra-previews{grid-column:1!important}#balloonSettingsModal.sw-redesign .appearance-group{grid-template-columns:repeat(2,minmax(0,1fr))!important}#balloonSettingsModal.sw-redesign #classificationManager .cl-layout{grid-template-columns:1fr}#balloonSettingsModal.sw-redesign #classificationManager .cl-fields{grid-template-columns:repeat(2,minmax(0,1fr))}#balloonSettingsModal.sw-redesign .style-save-footer small{max-width:55%;font-size:10px}}
 `;document.head.append(workspaceDesign);
 const studioCss=document.createElement('style');studioCss.textContent=`
 #balloonSettingsModal.sw-redesign .sw-content{padding:14px!important;background:#eef2f5;overflow:auto!important}
 #balloonSettingsModal.sw-redesign .studio-grid{display:grid!important;grid-template-columns:195px minmax(290px,1fr) 350px!important;gap:14px!important;width:100%;max-width:none!important;align-items:stretch!important;min-height:560px;height:calc(100dvh - 235px)}
 #balloonSettingsModal.sw-redesign .studio-library{grid-column:1;grid-row:1;display:flex;flex-direction:column;min-height:0;padding:10px;background:white;border:1px solid #d8e2e9;border-radius:10px;overflow:hidden}
 #balloonSettingsModal.sw-redesign .studio-search{width:100%;box-sizing:border-box;height:32px;min-height:32px!important;border:1px solid #d6e1e9;border-radius:6px;padding:5px 8px;margin-bottom:10px;font-size:11px}
 #balloonSettingsModal.sw-redesign .studio-list{border:0!important;padding:0!important;margin:0!important;background:white!important;overflow:auto!important;max-height:none!important;min-height:0;display:flex!important;flex-direction:column!important;gap:4px!important;position:static!important;width:100%;box-sizing:border-box}
 #balloonSettingsModal.sw-redesign .studio-list button{width:100%;min-height:40px!important;padding:9px!important;font-size:11px!important;border:0!important;border-radius:6px!important;box-sizing:border-box;text-align:left!important;flex-shrink:0}
 #balloonSettingsModal.sw-redesign .studio-list button[hidden]{display:none!important}
 #balloonSettingsModal.sw-redesign .studio-list button[aria-pressed=true]{background:#e4f5f5!important;color:#007587!important;box-shadow:inset 3px 0 #008d9c}
 #balloonSettingsModal.sw-redesign .studio-stage{grid-column:2;grid-row:1;background:#f8fafb;border:1px solid #d8e2e9;border-radius:10px;padding:22px;display:flex;flex-direction:column;min-width:0;overflow:hidden}
 #balloonSettingsModal.sw-redesign .studio-stage header{display:grid;gap:8px;padding:0!important;flex-shrink:0;background:transparent!important}
 #balloonSettingsModal.sw-redesign .studio-stage header span{font-size:10px;letter-spacing:.12em;color:#728896}
 #balloonSettingsModal.sw-redesign .studio-stage header strong{font-size:19px;color:#21495d}
 #balloonSettingsModal.sw-redesign .studio-stage header small{font-size:11px;color:#657d8b;margin:0!important}
 #balloonSettingsModal.sw-redesign .studio-canvas{display:flex;align-items:center;justify-content:center;min-height:210px;flex:1;background-image:radial-gradient(#d7e2e9 .8px,transparent .8px);background-size:18px 18px;margin:20px -8px}
 #balloonSettingsModal.sw-redesign .studio-canvas .ra-previews,#balloonSettingsModal.sw-redesign .studio-canvas .cl-preview{width:100%;position:static!important;border:0!important;background:transparent!important;padding:0!important;margin:0!important;display:block!important}
 #balloonSettingsModal.sw-redesign .studio-canvas section{border:0!important;background:transparent!important;padding:0!important}
 #balloonSettingsModal.sw-redesign .studio-canvas strong,#balloonSettingsModal.sw-redesign .studio-canvas small{display:none!important}
 #balloonSettingsModal.sw-redesign .studio-canvas svg{width:100%!important;height:260px!important;max-height:40vh;cursor:pointer;filter:drop-shadow(0 4px 5px #27445312)}
 #balloonSettingsModal.sw-redesign .studio-parts{display:flex;gap:5px;justify-content:center;flex-wrap:wrap}
 #balloonSettingsModal.sw-redesign .studio-parts button{border:1px solid #ccdce5;border-radius:6px;background:white;color:#426275;padding:8px 12px;min-height:34px;font-size:11px}
 #balloonSettingsModal.sw-redesign .studio-parts button[aria-pressed=true]{color:white;background:#008a99;border-color:#008a99}
 #balloonSettingsModal.sw-redesign .studio-note{font-size:10px;line-height:1.6;text-align:center;color:#718491;margin:14px 0 0}
 #balloonSettingsModal.sw-redesign .studio-inspector{grid-column:3!important;grid-row:1!important;display:flex!important;flex-direction:column!important;gap:14px!important;min-width:0!important;padding:18px!important;border:1px solid #d8e2e9!important;border-radius:10px!important;background:white!important;overflow:auto!important;align-self:stretch!important;margin:0!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-group,#balloonSettingsModal.sw-redesign .studio-inspector [data-studio-group]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:15px 10px!important;border:0!important;border-radius:0!important;padding:0!important;background:white!important;margin:0!important;grid-row:auto!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .studio-inactive{display:none!important}
 #balloonSettingsModal.sw-redesign .studio-inspector h3{font-size:16px!important;margin:0 0 12px!important;padding:0 0 12px;border-bottom:1px solid #e0e8ed;grid-column:1/-1!important}
 #balloonSettingsModal.sw-redesign .studio-inspector label{display:grid!important;gap:6px!important;font-size:11px!important;min-width:0;color:#486779;grid-column:auto!important}
 #balloonSettingsModal.sw-redesign .studio-inspector label:has([data-edit=label]),#balloonSettingsModal.sw-redesign .studio-inspector label:has([data-class-field=name]),#balloonSettingsModal.sw-redesign .studio-inspector .cl-wide{grid-column:1/-1!important}
 #balloonSettingsModal.sw-redesign .studio-inspector input:not([type=checkbox]):not([type=range]),#balloonSettingsModal.sw-redesign .studio-inspector select{width:100%!important;min-width:0!important;box-sizing:border-box;height:33px!important;min-height:33px!important;padding:5px 7px;border:1px solid #cbdbe5;border-radius:5px;margin:0!important;font-size:12px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .studio-color{grid-template-columns:1fr 42px!important;align-items:center!important;grid-column:1/-1!important;padding:7px 0;border-bottom:1px solid #edf1f4}
 #balloonSettingsModal.sw-redesign .studio-inspector .studio-color input[type=color]{width:42px!important;height:28px!important;min-height:28px!important;padding:2px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-component-line{grid-column:1/-1!important;display:grid!important;grid-template-columns:1fr!important;padding-top:12px!important;gap:7px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-line-controls{gap:6px!important;flex-wrap:nowrap!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-inline-width input{width:52px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-actions{margin-top:auto!important;padding-top:18px!important;border-top:1px solid #e0e8ed!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-actions .btn{flex:1 1 40%;font-size:10px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .cl-fields{display:contents!important}
 #balloonSettingsModal.sw-redesign #classificationStyleDock{max-width:none!important}
 #balloonSettingsModal.sw-redesign #classificationManager>header{padding:0 0 10px!important;justify-content:flex-end}
 #balloonSettingsModal.sw-redesign #classificationManager>header h3{margin-right:auto;font-size:12px;color:#547486}
 #balloonSettingsModal.sw-redesign #classificationManager>small{display:none}
 #balloonSettingsModal.sw-redesign #classificationManager .studio-grid{height:calc(100dvh - 281px);min-height:520px}
 #balloonSettingsModal.sw-redesign #classificationManager [data-remove]{margin-top:auto;color:#c32940}
 @media(max-width:1050px){#balloonSettingsModal.sw-redesign .studio-grid{grid-template-columns:160px minmax(220px,1fr) 290px!important}.studio-stage{padding:14px!important}}
 @media(max-width:800px){#balloonSettingsModal.sw-redesign .studio-grid{grid-template-columns:150px minmax(0,1fr)!important;height:auto!important}#balloonSettingsModal.sw-redesign .studio-library{grid-row:1/3}#balloonSettingsModal.sw-redesign .studio-inspector{grid-column:2!important;grid-row:2!important}#balloonSettingsModal.sw-redesign .studio-stage{grid-column:2;min-height:320px}#balloonSettingsModal.sw-redesign .studio-canvas{min-height:100px}#balloonSettingsModal.sw-redesign .studio-canvas svg{height:150px!important}}
 #balloonSettingsModal.sw-redesign .studio-tiles{display:flex;gap:4px;flex-wrap:wrap}
 #balloonSettingsModal.sw-redesign .studio-tiles button{border:1px solid #cbdce5;border-radius:5px;background:white;width:36px;height:32px;min-height:32px;padding:3px;color:#527082}
 #balloonSettingsModal.sw-redesign .studio-tiles button[aria-pressed=true]{background:#daf1f4;border-color:#008b9a;color:#008192}
 #balloonSettingsModal.sw-redesign .studio-tiles button:disabled{opacity:.4}
 #balloonSettingsModal.sw-redesign .studio-tiles svg{width:27px;height:22px}
 #balloonSettingsModal.sw-redesign .studio-inspector select[hidden]{display:none!important}
 #balloonSettingsModal.sw-redesign .sw-content{overflow:hidden!important}
 #balloonSettingsModal.sw-redesign .studio-host,#balloonSettingsModal.sw-redesign #classificationStyleDock{height:100%!important;min-height:0!important}
 #balloonSettingsModal.sw-redesign .studio-grid,#balloonSettingsModal.sw-redesign #classificationManager .studio-grid{height:100%!important;min-height:0!important}
 #balloonSettingsModal.sw-redesign .studio-stage{min-height:0!important;padding:18px!important}
 #balloonSettingsModal.sw-redesign .studio-canvas{min-height:60px!important;margin:10px 0!important;overflow:hidden}
 #balloonSettingsModal.sw-redesign .studio-canvas svg{max-height:27vh!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-group,#balloonSettingsModal.sw-redesign .studio-inspector [data-studio-group]{gap:10px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .studio-color{padding:3px 0!important}
 #balloonSettingsModal.sw-redesign #classificationManager .studio-library header{display:flex!important;flex-wrap:wrap;gap:5px!important;padding:0 0 12px!important}
 #balloonSettingsModal.sw-redesign #classificationManager .studio-library header h3{font-size:11px;width:100%;margin:0 0 3px}
 #balloonSettingsModal.sw-redesign #classificationManager .studio-library header input{width:100%!important;min-width:0!important;font-size:11px}
 #balloonSettingsModal.sw-redesign #classificationManager .studio-library header button{width:100%;font-size:11px}
 @media(max-width:800px){#balloonSettingsModal.sw-redesign .sw-content{overflow:auto!important}#balloonSettingsModal.sw-redesign .studio-grid,#balloonSettingsModal.sw-redesign #classificationManager .studio-grid{height:auto!important}#balloonSettingsModal.sw-redesign .studio-stage{min-height:300px!important}}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-group,#balloonSettingsModal.sw-redesign .studio-inspector [data-studio-group]{grid-template-columns:minmax(0,1fr)!important;gap:5px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector label,#balloonSettingsModal.sw-redesign .studio-inspector .studio-color{display:grid!important;grid-template-columns:minmax(95px,1fr) 150px!important;gap:8px!important;align-items:center!important;grid-column:1!important;min-height:32px;margin:0!important;padding:3px 0!important;border-bottom:1px solid #edf2f5}
 #balloonSettingsModal.sw-redesign .studio-inspector h3{margin-bottom:6px!important;padding-bottom:9px;font-size:14px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector input:not([type=range]):not([type=checkbox]),#balloonSettingsModal.sw-redesign .studio-inspector select{height:28px!important;min-height:28px!important;font-size:11px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .studio-color input[type=color]{width:44px!important;justify-self:start}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-slider{min-width:0}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-inline-width{display:flex!important;grid-template-columns:none!important;min-height:0;border:0;padding:0!important;gap:4px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-line-toggle{display:flex!important;height:32px!important;min-height:32px!important;gap:8px!important}
 #balloonSettingsModal.sw-redesign .studio-inspector .appearance-component-line{padding-top:6px!important}
 #balloonSettingsModal.sw-redesign .studio-tiles{gap:3px;flex-wrap:wrap}
 #balloonSettingsModal.sw-redesign .studio-tiles button{width:27px;height:28px;min-height:28px;padding:1px}
 #balloonSettingsModal.sw-redesign .studio-tiles svg{width:23px;height:21px}
 #balloonSettingsModal.sw-redesign .studio-dashboard{grid-template-columns:180px minmax(0,1fr)!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector{grid-column:2!important;display:grid!important;grid-template-columns:minmax(0,1fr) 300px!important;align-content:start;align-items:start;gap:12px!important;padding:0!important;border:0!important;background:transparent!important;overflow:auto!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-fields,#balloonSettingsModal.sw-redesign .studio-dashboard .cl-fields{grid-column:1!important;grid-row:1!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:start}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group,#balloonSettingsModal.sw-redesign .studio-dashboard [data-studio-group]{display:grid!important;border:1px solid #d8e2e9!important;border-radius:8px!important;padding:12px!important;grid-column:auto!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section=Yöntem]{grid-column:1/-1!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector label{min-height:29px!important;padding:2px 0!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector h3{margin-bottom:2px!important;padding-bottom:7px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-stage{grid-column:2!important;grid-row:1/4!important;position:sticky;top:0;padding:14px!important;align-self:start}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-stage header strong{font-size:16px}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-parts{display:none!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-canvas{height:220px;flex:none;margin:12px 0!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-canvas svg{height:200px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-note{margin:5px 0 12px}
 html body #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin:0!important;padding-top:12px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-actions [data-delete]{margin:0}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector label{grid-template-columns:minmax(70px,1fr) minmax(65px,110px)!important}
 @media(max-width:1250px){#balloonSettingsModal.sw-redesign .studio-dashboard .appearance-fields,#balloonSettingsModal.sw-redesign .studio-dashboard .cl-fields{grid-template-columns:1fr!important}#balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector{grid-template-columns:minmax(0,1fr) 260px!important}}
 @media(max-width:850px){#balloonSettingsModal.sw-redesign .studio-dashboard{grid-template-columns:140px minmax(0,1fr)!important}#balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector{grid-template-columns:minmax(0,1fr)!important}#balloonSettingsModal.sw-redesign .studio-dashboard .studio-stage{grid-column:1!important;grid-row:2!important;position:static}}
 @media(min-width:1100px) and (max-height:850px){
 #balloonSettingsModal.sw-redesign .sw-top{padding:4px 12px!important}
 #balloonSettingsModal.sw-redesign .sw-title span{display:none}
 #balloonSettingsModal.sw-redesign .sw-content{padding:5px 8px!important}
 #balloonSettingsModal.sw-redesign .appearance-legend{padding:0 12px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group{padding:6px!important}
 }
 /* Dense dashboard: related controls share rows, rather than stretching labels. */
 @media(min-width:1100px){
 #balloonSettingsModal.sw-redesign .studio-dashboard{grid-template-columns:155px minmax(0,1fr)!important;gap:9px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector{grid-template-columns:minmax(0,1fr) 245px!important;gap:9px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-fields,#balloonSettingsModal.sw-redesign .studio-dashboard .cl-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group,#balloonSettingsModal.sw-redesign .studio-dashboard [data-studio-group]{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px 10px!important;padding:8px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector label,#balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector .studio-color{grid-column:auto!important;grid-template-columns:minmax(0,1fr) minmax(50px,85px)!important;gap:5px!important;border:0!important;padding:0!important;min-height:28px!important;font-size:10px!important;line-height:1.2}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-name{grid-column:auto!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector h3{font-size:12px!important;padding-bottom:5px!important;margin:0 0 2px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector .appearance-component-line{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:6px!important;padding-top:5px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-component-line>strong{font-size:10px;min-width:50px}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-line-controls{gap:3px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector .appearance-inline-width{display:flex!important;min-height:0!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-line-choices button{width:27px!important;min-height:27px!important;height:27px!important;padding:2px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-inspector [data-edit=arrowStyle]+.studio-tiles{flex-wrap:nowrap!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard label:has([data-edit=arrowStyle]),#balloonSettingsModal.sw-redesign .studio-dashboard label:has([data-class-field=criteria]){grid-column:1/-1!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-stage{padding:10px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-canvas{height:165px!important;margin:7px 0!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-canvas svg{height:150px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-stage header strong{font-size:14px}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-note{line-height:1.3;margin:4px 0 8px}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-tiles{flex-wrap:nowrap!important;gap:2px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-tiles button{flex-shrink:0;width:25px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section=Yöntem]{grid-template-columns:65px minmax(0,1fr) minmax(0,1fr)!important;align-items:center}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section=Yöntem] h3{grid-column:auto!important;border:0!important;padding:0!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section="Bağlantı / ok"] label:has([data-edit=arrowStyle]){grid-column:auto!important;display:flex!important;flex-direction:column;align-items:start!important;gap:3px!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section="Bağlantı / ok"] .appearance-line-toggle{grid-column:auto!important;align-self:center!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group{row-gap:3px!important}
 }
 @media(min-width:1100px){
 #balloonSettingsModal.sw-redesign .studio-dashboard{grid-template-columns:210px minmax(0,1fr)!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .studio-list button{grid-template-columns:minmax(0,1fr) 52px!important;overflow-wrap:normal!important;word-break:normal!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group>label,#balloonSettingsModal.sw-redesign .studio-dashboard [data-studio-group]>label{grid-template-columns:100px minmax(60px,125px)!important;justify-content:start!important;column-gap:6px!important;min-width:0}
 #balloonSettingsModal.sw-redesign .studio-dashboard .appearance-group[data-section=Yöntem]{grid-template-columns:60px minmax(0,1fr) minmax(0,1fr)!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard [data-studio-group] label:has([data-class-field=shape]){grid-column:1/-1!important;grid-template-columns:100px minmax(0,1fr)!important}
 #balloonSettingsModal.sw-redesign .studio-dashboard [data-studio-group] .studio-tiles{flex-wrap:wrap!important}
 }
 #balloonSettingsModal.sw-redesign .studio-class-actions{display:flex!important;flex-wrap:wrap;gap:6px!important;border-top:1px solid #d8e2e9;padding:10px 0 6px!important;margin-top:10px}
 #balloonSettingsModal.sw-redesign .studio-class-actions h3[hidden],#balloonSettingsModal.sw-redesign .studio-class-actions input[hidden]{display:none!important}
 #balloonSettingsModal.sw-redesign .studio-class-actions input{width:100%!important;flex:1 0 100%;box-sizing:border-box}
 #balloonSettingsModal.sw-redesign .studio-class-actions button{width:100%;background:#008b9b!important;color:white!important}
 #balloonSettingsModal.sw-redesign .studio-stage>[data-remove]{width:100%;margin-top:6px;color:#bd3040}
 `;document.head.append(studioCss);
 root.ASMachRoleAppearance={init,factory,effective,source,setMode,applyStyle,save,sync,studio};
})(window);
