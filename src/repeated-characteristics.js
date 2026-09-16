(function(root){
 'use strict';
 const collapsed=new Set();
 function syncGroup(state,source){
  const children=state.annotations.filter(r=>r.parentCharacteristicId===source.id&&!r.measurementComponent).sort((a,b)=>String(a.number).localeCompare(String(b.number),'tr',{numeric:true}));
  const base=source.repeatBaseNumber||String(source.number).split('.')[0];
  if(!children.length){source.number=base;source.repeatBaseNumber='';return;}
  const groupIds=new Set([source.id,...children.map(r=>r.id)]);if(state.annotations.some(r=>!groupIds.has(r.id)&&Array.from({length:children.length+1},(_,i)=>base+'.'+(i+1)).includes(String(r.number))))return;
  source.repeatBaseNumber=base;source.number=base+'.1';source.listOnly=false;
  children.forEach((r,i)=>{r.number=base+'.'+(i+2);r.repeatBaseNumber='';r.listOnly=!source.showQuantityBalloons;});
 }
 function drawingRecord(state,r){
  if(r.repeatBaseNumber&&!r.showQuantityBalloons)return {...r,number:r.repeatBaseNumber};
  return r;
 }
 function showBalloons(app,id,show){const selected=app.state.annotations.find(r=>r.id===id),source=selected?.parentCharacteristicId?app.state.annotations.find(r=>r.id===selected.parentCharacteristicId):selected;if(!source)return;
  app.checkpoint();source.showQuantityBalloons=show;syncGroup(app.state,source);
  if(show)positionChildren(app,source);
  app.recordChange('Miktar balonlarının çizim görünümü değiştirildi',source);app.renderAll();
 }
 function positionChildren(app,source){
  const children=app.state.annotations.filter(r=>r.parentCharacteristicId===source.id&&!r.measurementComponent);const height=app.elements.sourceCanvas.height||1000,width=app.elements.sourceCanvas.width||1000,step=(Number(source.size)||36)+8;
  children.forEach((r,i)=>{r.bubbleX=Math.min(.95,Math.max(.05,source.bubbleX+Math.floor((i+1)/8)*step/width));r.bubbleY=Math.min(.95,Math.max(.05,source.bubbleY+((source.bubbleY<.5?1:-1)*((i+1)%8))*step/height));});
 }
 function migrate(state){
  const copied=new Set((state.auditLog||[]).filter(a=>a.action==='Tekrarlı karakteristik kopyalandı').map(a=>a.id));
  for(const r of state.annotations){if(!r.listOnly&&!copied.has(r.id))continue;r.listOnly=true;const base=String(r.number).split('.')[0];if(!r.parentCharacteristicId)r.parentCharacteristicId=state.annotations.find(p=>String(p.number)===base)?.id||'';}
  for(const r of [...state.annotations]){const count=Number(r.quantity);if(r.parentCharacteristicId||!Number.isInteger(count)||count<2||count>1000||root.ASMachMeasureComponents?.components(r).length||state.annotations.some(c=>c.parentCharacteristicId===r.id))continue;
   const numbers=plan(state.annotations,r,count-1);state.annotations.push(...numbers.map(number=>({...JSON.parse(JSON.stringify(r)),id:crypto.randomUUID(),number,listOnly:true,parentCharacteristicId:r.id,quantity:'1',result:'',resultStatus:'pending',status:'needs_review',createdAt:new Date().toISOString()})));
  }
  for(const r of state.annotations)if(!r.parentCharacteristicId&&Number(r.quantity)>1&&!r.measurementComponent)syncGroup(state,r);
 }
 function listPreview(app,record){
  const ns='http://www.w3.org/2000/svg',visual=root.ASMachRoleAppearance?.effective(app.state,record)||record,appearance=root.ASMachBalloonAppearance?.normalize(visual)||visual;
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 48 32');svg.setAttribute('width','48');svg.setAttribute('height','30');svg.setAttribute('aria-label','Karakteristik '+record.number);svg.dataset.balloonShape=visual.shape||'circle';
  const tag=visual.shape==='square'?'rect':['hexagon','triangle','diamond'].includes(visual.shape)?'polygon':'ellipse',shape=document.createElementNS(ns,tag);
  if(visual.shape==='square')for(const [key,value] of Object.entries({x:7,y:3,width:34,height:26,rx:2}))shape.setAttribute(key,value);
  else if(visual.shape==='hexagon')shape.setAttribute('points','3,16 12,3 36,3 45,16 36,29 12,29');
  else if(visual.shape==='triangle')shape.setAttribute('points','24,2 45,29 3,29');
  else if(visual.shape==='diamond')shape.setAttribute('points','24,2 45,16 24,30 3,16');
  else for(const [key,value] of Object.entries({cx:24,cy:16,rx:18,ry:13}))shape.setAttribute(key,value);
  const color=/^#[0-9a-f]{6}$/i.test(visual.color)?visual.color:'#07899a';shape.setAttribute('fill',appearance.balloonFill||'#ffffff');shape.setAttribute('fill-opacity',String(appearance.balloonOpacity??1));shape.setAttribute('stroke',color);shape.setAttribute('stroke-width',String(Math.max(1,Math.min(3,Number(appearance.balloonLineWidth)||1.8))));if(appearance.balloonLineStyle==='dashed')shape.setAttribute('stroke-dasharray','5 3');else if(appearance.balloonLineStyle==='dotted')shape.setAttribute('stroke-dasharray','1 3');
  const label=document.createElementNS(ns,'text');label.setAttribute('x','24');label.setAttribute('y','17');label.setAttribute('text-anchor','middle');label.setAttribute('dominant-baseline','middle');label.setAttribute('font-size',String(Math.min(13,34/Math.max(2,String(record.number).length)*1.5)));label.setAttribute('font-weight',String(appearance.fontWeight||800));label.setAttribute('fill',appearance.textColor||color);label.setAttribute('fill-opacity',String(appearance.textOpacity??1));label.textContent=record.number;svg.append(shape,label);return {svg,color};
 }
 function groupRows(app){
  const componentToggle=document.querySelector('[title="Tüm alt karakteristikleri göster / gizle"]');if(componentToggle)componentToggle.hidden=!app.state.annotations.some(r=>r.measurementComponent&&r.parentCharacteristicId);
  const body=document.getElementById('balloonTableBody');if(!body)return;body.querySelectorAll('[data-repeat-toggle]').forEach(b=>b.remove());body.querySelectorAll('[data-repeat-root]').forEach(r=>delete r.dataset.repeatRoot);
  const rows=new Map([...body.querySelectorAll('tr[data-id]')].map(r=>[r.dataset.id,r])),groups=new Map();
  for(const r of app.state.annotations){const row=rows.get(r.id),dot=row?.querySelector('.balloon-dot');if(!dot)continue;dot.classList.add('repeat-balloon-preview');const preview=listPreview(app,r);dot.style.color=preview.color;dot.replaceChildren(preview.svg);}
  // Quantity copies are ordinary rows: preserve table sorting/filtering and alignment.
  // Only genuine measurement components retain the expandable hierarchy.
  for(const r of app.state.annotations)if(r.measurementComponent&&r.parentCharacteristicId&&rows.has(r.id)){if(!groups.has(r.parentCharacteristicId))groups.set(r.parentCharacteristicId,[]);groups.get(r.parentCharacteristicId).push(r);}
  for(const [id,children] of groups){const parent=rows.get(id);if(!parent)continue;children.sort((a,b)=>String(a.number).localeCompare(String(b.number),'tr',{numeric:true}));const cell=parent.querySelector('[data-editable=number]');if(!cell)continue;
const button=document.createElement('button');button.type='button';button.dataset.repeatToggle='';button.className='acui-mini-btn';button.textContent=(collapsed.has(id)?'▸':'▾')+' '+children.length;button.title='Alt karakteristikleri göster / gizle';button.setAttribute('aria-expanded',String(!collapsed.has(id)));button.onclick=e=>{e.stopPropagation();collapsed.has(id)?collapsed.delete(id):collapsed.add(id);app.renderAll();groupRows(app);};parent.dataset.repeatRoot='';cell.append(button);
let anchor=parent;for(const child of children){const row=rows.get(child.id);anchor.after(row);anchor=row;row.hidden=parent.hidden||collapsed.has(id);row.dataset.repeatParent=id;const number=row.querySelector('[data-editable=number]');if(number){number.style.paddingLeft='24px';number.title='Miktara bağlı karakteristik.';}}
  }
 }
 function plan(records,source,count){
  if(!Number.isInteger(count)||count<1||count>1000)throw Error('Kopya adedi 1–1000 arasında tam sayı olmalı.');
  const base=String(source.number).split('.')[0],used=new Set(records.map(r=>String(r.number))),numbers=[];
  for(let i=1;numbers.length<count;i++)if(!used.has(base+'.'+i))numbers.push(base+'.'+i);
  return numbers;
 }
 function apply(app,id,count){
  const source=app.state.annotations.find(r=>r.id===id);if(!source)throw Error('Kaynak karakteristik artık bulunamıyor.');
  const numbers=plan(app.state.annotations,source,count);
  const copies=numbers.map(number=>({...JSON.parse(JSON.stringify(source)),id:crypto.randomUUID(),number,listOnly:true,parentCharacteristicId:source.parentCharacteristicId||source.id,quantity:'1',result:'',resultStatus:'pending',status:'needs_review',createdAt:new Date().toISOString()}));
  app.checkpoint();app.state.annotations.push(...copies);for(const c of copies)app.recordChange('Tekrarlı karakteristik kopyalandı',c);app.state.selectedId=copies[0].id;app.renderAll();return copies;
 }
 function init(app){
  const css=document.createElement('style');css.textContent=`
   .list-toolbar [title="Tüm alt karakteristikleri göster / gizle"][hidden]{display:none!important}
   .acui-dock .acui-table .repeat-balloon-preview{border:0!important;background:none!important;border-radius:0!important;width:48px!important;height:30px!important;display:inline-flex!important;vertical-align:middle;line-height:1!important}
   .acui-dock .acui-table [data-repeat-toggle]{cursor:pointer;min-width:32px}
   .acui-dock .acui-table [data-repeat-toggle]:hover{background:#d8f0f5!important}
   .acui-dock .acui-table [data-repeat-toggle]:focus-visible{outline:2px solid #07899a}
   .acui-dock .acui-table [data-repeat-root] td{background:#eef6f9;border-top:1px solid #bddce4;border-bottom:1px solid #bddce4}
   .acui-dock .acui-table [data-repeat-root] [data-editable=number]{white-space:nowrap!important;overflow:visible!important}
   .acui-dock .acui-table [data-repeat-root] .balloon-dot{display:inline-flex;vertical-align:middle;flex-shrink:0;margin-right:5px}
   .acui-dock .acui-table [data-repeat-toggle]{display:inline-flex;vertical-align:middle;padding:2px 4px;min-height:22px;font-size:10px;border:1px solid #bbd9e3;background:white;border-radius:4px;color:#276274;white-space:nowrap}
   .acui-dock .acui-table [data-repeat-parent] [data-editable=number]{white-space:nowrap!important;border-left:2px solid #c2dde5;font-size:11px;overflow:visible!important}
   .acui-dock .acui-table [data-repeat-parent]:not(.is-selected) td{background:#f8fbfc}
html body .acui-dock.acui-expanded[class]{position:fixed!important;inset:var(--repeat-table-top,150px) var(--repeat-table-right,360px) 0 0!important;top:var(--repeat-table-top,150px)!important;width:auto!important;max-width:none!important;height:calc(100dvh - var(--repeat-table-top,150px))!important;max-height:calc(100dvh - var(--repeat-table-top,150px))!important;transform:none!important;overflow:hidden!important}
   html body .acui-dock.acui-expanded .table-wrap{min-height:0;overflow:auto}
  `;document.head.append(css);
  const toolbar=document.querySelector('.toolbar'),dock=document.querySelector('.acui-dock');
  const all=document.createElement('button');all.type='button';all.className='btn';all.textContent='Alt satırlar ▾';all.title='Tüm alt karakteristikleri göster / gizle';all.setAttribute('aria-expanded','true');all.onclick=()=>{const hide=all.getAttribute('aria-expanded')==='true';for(const r of app.state.annotations)if(r.parentCharacteristicId)hide?collapsed.add(r.parentCharacteristicId):collapsed.delete(r.parentCharacteristicId);all.setAttribute('aria-expanded',String(!hide));all.textContent=hide?'Alt satırlar ▸':'Alt satırlar ▾';app.renderAll();};document.querySelector('.list-toolbar')?.append(all);
  const inspector=document.querySelector('.inspector');
  const position=()=>{if(toolbar)document.documentElement.style.setProperty('--repeat-table-top',Math.ceil(toolbar.getBoundingClientRect().bottom)+'px');const rect=inspector?.getBoundingClientRect();document.documentElement.style.setProperty('--repeat-table-right',(rect&&rect.width>0&&rect.left>0?Math.max(0,innerWidth-Math.floor(rect.left)):0)+'px');};
  if(inspector)new ResizeObserver(position).observe(inspector);
  if(toolbar)new ResizeObserver(position).observe(toolbar);if(dock)new MutationObserver(position).observe(dock,{attributes:true,attributeFilter:['class']});root.addEventListener('resize',position);position();
  const original=document.getElementById('duplicateButton');if(!original)return;
  const button=document.createElement('button');button.type='button';button.id='repeatCharacteristicButton';button.className='btn';button.textContent='Çoklu kopyala';button.title='Tekrarlı ölçüler için 36.1, 36.2 gibi alt numaralı karakteristikler oluşturur.';original.after(button);
  const sync=()=>button.disabled=original.disabled;new MutationObserver(sync).observe(original,{attributes:true,attributeFilter:['disabled']});sync();
  button.onclick=()=>{
   const source=app.selectedAnnotation();if(!source)return;const dialog=document.createElement('dialog');dialog.className='asmach-modal';dialog.style.cssText='width:min(460px,90vw);border:1px solid #bdd2de;border-radius:10px;padding:20px;color:#173b4f';
dialog.innerHTML='<h3 style="margin-top:0">Tekrarlı karakteristik oluştur</h3><p data-source></p><label style="display:flex;align-items:center;gap:12px">Eklenecek kopya adedi <input type="number" min="1" max="1000" step="1" value="24" style="width:85px" aria-label="Eklenecek kopya adedi"></label><p data-preview role="status"></p><p style="font-size:12px;color:#587180">Ana kayıt korunur. Ölçü, tolerans, kaynak görüntü ve kontrol planı kopyalanır. Sonuçlar boşaltılır. Kullanılan alt numaralar atlanır; alt kayıtlar listede ana balon altında gösterilir; çizimde ve balonlu PDF üzerinde ayrı balon çizilmez.</p><footer style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-cancel>Vazgeç</button><button class="btn primary" data-apply>Listeye ekle</button></footer>';
   dialog.querySelector('[data-source]').textContent='Kaynak: #'+source.number+' · '+source.type;
   const input=dialog.querySelector('input'),preview=dialog.querySelector('[data-preview]'),save=dialog.querySelector('[data-apply]');
   const update=()=>{try{const numbers=plan(app.state.annotations,source,Number(input.value));preview.textContent=numbers.length===1?'Yeni numara: '+numbers[0]:`${numbers.length} yeni kayıt: ${numbers.slice(0,3).join(', ')}${numbers.length>3?' … '+numbers.at(-1):''}`;save.disabled=false;}catch(e){preview.textContent=e.message;save.disabled=true;}};
   input.oninput=update;dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();save.onclick=()=>{try{const copies=apply(app,source.id,Number(input.value));dialog.close();app.toast(copies.length+' alt numaralı karakteristik eklendi.');}catch(e){preview.textContent=e.message;}};
   dialog.addEventListener('close',()=>{dialog.remove();const popup=button.closest('[popover]'),trigger=popup&&document.querySelector('[popovertarget="'+popup.id+'"]');(trigger||button).focus();});document.body.append(dialog);update();dialog.showModal();input.focus();input.select();
  };
 }
 async function setQuantity(app,id,quantity){
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('Miktar 1–1000 arasında tam sayı olmalı.');
  const selected=app.state.annotations.find(r=>r.id===id),source=selected?.parentCharacteristicId?app.state.annotations.find(r=>r.id===selected.parentCharacteristicId):selected;if(!source)throw Error('Ana karakteristik bulunamadı.');
  if(selected?.measurementComponent||app.state.annotations.some(r=>r.parentCharacteristicId===source.id&&r.measurementComponent))throw Error('Bu kayıt bağımsız ölçü bileşenleri içeriyor. Miktar işlemi ölçü bileşenlerine uygulanamaz.');
  const children=app.state.annotations.filter(r=>r.parentCharacteristicId===source.id&&!r.measurementComponent).sort((a,b)=>String(a.number).localeCompare(String(b.number),'tr',{numeric:true})),target=quantity-1;
  if(children.length===target&&String(source.quantity)===String(quantity))return;
  if(target<children.length&&!await root.ASMachMessages.confirm(`${children.length-target} alt kayıt kaldırılacak. Bu kayıtlardaki ölçüm sonuçları da kaldırılır. Devam edilsin mi?`))return;
  app.checkpoint();if(target<children.length){const removed=new Set(children.slice(target).map(r=>r.id));app.state.annotations=app.state.annotations.filter(r=>!removed.has(r.id));}
  if(target>children.length){const numbers=plan(app.state.annotations,source,target-children.length);app.state.annotations.push(...numbers.map(number=>({...JSON.parse(JSON.stringify(source)),id:crypto.randomUUID(),number,listOnly:true,parentCharacteristicId:source.id,quantity:'1',result:'',resultStatus:'pending',status:'needs_review',createdAt:new Date().toISOString()})));}
  source.quantity=String(quantity);syncGroup(app.state,source);if(source.showQuantityBalloons)positionChildren(app,source);app.state.selectedId=source.id;app.recordChange('Karakteristik miktarı güncellendi',source);app.renderAll();
 }
 root.ASMachRepeatedCharacteristics={init,plan,apply,setQuantity,migrate,groupRows,drawingRecord,showBalloons,positionChildren};
})(window);
