(function(root){
 'use strict';
 const storageKey='asmach.characteristic-columns.v1';
 const keys=['selection','number','page','snapshot','type','measurement','requirement','zone','method','frequency','information','confidence','actions','nominalValue','unit','lowerTolerance','upperTolerance','lowerLimit','upperLimit','toleranceStandard'];
 keys.push('classification');
 const classLabels={critical:'Kritik',major:'Önemli',minor:'Az önemli',normal:'Önemsiz'};
 const groupOptions=[['','Gruplama yok'],['classification','Sınıflandırma'],['type','Karakteristik türü'],['page','Çizim sayfası'],['zone','Zone'],['method','Kontrol yöntemi'],['frequency','Kontrol sıklığı'],['operation','Operasyon']];
 let applyRows=()=>{};
 function init(app){
  const table=document.querySelector('.acui-table'),menu=document.querySelector('.acui-column-menu>div');if(!table||!menu)return;
  const head=table.tHead.rows[0];const classHeader=document.createElement('th');classHeader.textContent='Sınıflandırma';head.append(classHeader);
  const headers=[...head.cells],labels=Object.fromEntries(headers.map((h,i)=>[keys[i],h.textContent.trim()||'Seçim']));
  let saved={};try{saved=JSON.parse(ASMachPreferences.getItem(storageKey)||'{}')||{};}catch{}
  let order=['selection','number',...([...new Set(Array.isArray(saved.order)?saved.order:[])].filter(k=>keys.includes(k)&&!['selection','number'].includes(k)))];order.push(...keys.filter(k=>!order.includes(k)));
  let widths={},hidden=new Set(Array.isArray(saved.hidden)?saved.hidden.filter(k=>keys.includes(k)):['snapshot','requirement','confidence',...keys.slice(13)]),group=['type','page','zone','method','frequency','operation'].includes(saved.group)?saved.group:'';
  if(!saved.order?.includes('classification')){order=order.filter(k=>k!=='classification');order.splice(order.indexOf('type')+1,0,'classification');hidden.delete('classification');}
  if(saved.group==='classification')group='classification';
  let secondary=groupOptions.some(([k])=>k===saved.secondary)&&saved.secondary!==group&&group?saved.secondary:'';
  if(!saved.panelEditing&&!Array.isArray(saved.hidden)){hidden=new Set(['snapshot','requirement','zone','confidence','actions','nominalValue','unit','lowerTolerance','upperTolerance','lowerLimit','upperLimit','toleranceStandard']);}
  hidden.delete('selection');hidden.delete('number');
  const clampWidth=(key,value)=>Math.max(key==='selection'?26:45,Math.min(1200,Math.round(Number(value)||0)));
  for(const k of keys)widths[k]=clampWidth(k,Number(saved.widths?.[k])||parseInt(headers[keys.indexOf(k)].style.width)||110);
  const collapsed=new Set(),selectedColumns=new Set();let dragging=null,displayWidths={...widths},exactWidths=saved.exactWidths===true,lastSelected='';
  function save(){try{ASMachPreferences.setItem(storageKey,JSON.stringify({order,widths,hidden:[...hidden],group,secondary,panelEditing:true,exactWidths}));}catch{app.toast?.('Liste görünümü bu oturumda geçerli; tarayıcı ayarları kaydedilemedi.',true);}}
  function setWidths(changes){for(const [key,value] of Object.entries(changes))if(keys.includes(key))widths[key]=clampWidth(key,value);exactWidths=true;save();applyRows();}
  function syncSelection(){for(const h of headers)h.classList.toggle('lc-selected',selectedColumns.has(h.dataset.column));menu.querySelectorAll('[data-width-select]').forEach(button=>{const selected=selectedColumns.has(button.dataset.widthSelect);button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'✓':'Seç';});const count=menu.querySelector('#lcSelectedCount');if(count)count.textContent=selectedColumns.size?selectedColumns.size+' sütun seçili':'Genişlik için sütun seçin';const input=menu.querySelector('#lcWidthValue');if(input&&selectedColumns.size===1)input.value=String(widths[[...selectedColumns][0]]);}
  function selectColumn(key,extend=false,toggle=false){if(!keys.includes(key))return;if(extend&&lastSelected){const a=order.indexOf(lastSelected),b=order.indexOf(key);if(!toggle)selectedColumns.clear();for(const k of order.slice(Math.min(a,b),Math.max(a,b)+1))selectedColumns.add(k);}else if(toggle){selectedColumns.has(key)?selectedColumns.delete(key):selectedColumns.add(key);}else{selectedColumns.clear();selectedColumns.add(key);}lastSelected=key;syncSelection();}
  function autoWidth(key){
   const host=document.createElement('span');host.className='lc-measure';document.body.append(host);const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');let max=0;
   for(const cell of [head.querySelector(`[data-column="${key}"]`),...table.tBodies[0].querySelectorAll(`tr[data-id] [data-column="${key}"]`)]){
    if(!cell)continue;const style=getComputedStyle(cell);ctx.font=style.font;const text=(cell===head.querySelector(`[data-column="${key}"]`)?labels[key]:cell.textContent||'').trim();const textWidth=ctx.measureText(text).width;
    host.style.font=style.font;host.replaceChildren(...[...cell.childNodes].filter(n=>!n.classList?.contains('lc-resize')&&!n.classList?.contains('ta-filter')).map(n=>n.cloneNode(true)));
    max=Math.max(max,textWidth,host.getBoundingClientRect().width);
   }
   host.remove();return clampWidth(key,max+30);
  }
  function fitColumns(chosen){const changes={};for(const key of chosen)changes[key]=autoWidth(key);if(Object.keys(changes).length)setWidths(changes);}
  function move(key,target){if(!key||key===target||['selection','number'].includes(target))return;order=order.filter(k=>k!==key);order.splice(order.indexOf(target),0,key);save();applyRows();}
  headers.forEach((h,i)=>{const key=keys[i];h.dataset.column=key;h.draggable=i>1;h.title=i>1?'Sürükle: sırala · Ctrl/Shift+tıkla: sütun seç · Kenarı çift tıkla: otomatik genişlik':labels[key];
   h.addEventListener('dragstart',e=>{dragging=key;e.dataTransfer.setData('text/plain',key);});h.addEventListener('dragover',e=>{if(i>1)e.preventDefault();});h.addEventListener('drop',e=>{e.preventDefault();move(dragging,key);dragging=null;});
   h.addEventListener('click',e=>{if(e.target.closest('button,input,.lc-resize'))return;if(e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();selectColumn(key,e.shiftKey,e.ctrlKey||e.metaKey);}});
   const grip=document.createElement('span');grip.className='lc-resize';grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('aria-label',labels[key]+' sütun genişliği');
   grip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();h.draggable=false;const start=e.clientX,initial=widths[key];grip.setPointerCapture(e.pointerId);grip.onpointermove=p=>{widths[key]=clampWidth(key,initial+p.clientX-start);exactWidths=true;applyRows();};grip.onpointerup=()=>{grip.onpointermove=null;h.draggable=i>1;save();};grip.onpointercancel=()=>{grip.onpointermove=null;h.draggable=i>1;save();};});
   grip.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();fitColumns([key]);});
   grip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Enter'].includes(e.key))return;e.preventDefault();if(e.key==='Enter')fitColumns([key]);else setWidths({[key]:widths[key]+(e.key==='ArrowRight'?10:-10)});});h.append(grip);
  });
  table.dataset.managedColumns='true';
  menu.replaceChildren();const note=document.createElement('strong');note.textContent='Sütunları düzenle';note.className='lc-menu-title';menu.append(note);
  const hint=document.createElement('p');hint.className='lc-menu-hint';hint.textContent='Kutucuk: göster/gizle · Seç: genişlik uygula. Başlık kenarına çift tıklayınca otomatik sığdırılır.';menu.append(hint);
  const tileArea=document.createElement('div');tileArea.className='lc-column-tiles';menu.append(tileArea);
  for(const key of keys.slice(2)){const tile=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span'),choose=document.createElement('button');tile.className='lc-column-tile';check.type='checkbox';check.checked=!hidden.has(key);check.dataset.columnVisible=key;text.textContent=labels[key];text.title=labels[key];label.append(check,text);choose.type='button';choose.className='lc-width-select';choose.dataset.widthSelect=key;choose.title=labels[key]+' sütununu genişlik ayarı için seç';choose.setAttribute('aria-pressed','false');choose.textContent='Seç';choose.onclick=()=>selectColumn(key,false,true);tile.append(label,choose);tileArea.append(tile);check.onchange=()=>{check.checked?hidden.delete(key):hidden.add(key);save();applyRows();};}
  const widthTools=document.createElement('section');widthTools.className='lc-width-tools';widthTools.innerHTML='<strong>Toplu genişlik</strong><span id="lcSelectedCount">Genişlik için sütun seçin</span><div class="lc-width-actions"><label>Genişlik (px) <input id="lcWidthValue" type="number" min="45" max="1200" step="1" inputmode="numeric" aria-label="Seçili sütunların genişliği, piksel"></label><button type="button" class="btn" id="lcApplyWidth">Uygula</button><button type="button" class="btn" id="lcAutoWidth">Otomatik sığdır</button></div><div class="lc-select-actions"><button type="button" class="btn" id="lcSelectVisible">Görünenleri seç</button><button type="button" class="btn" id="lcClearSelection">Seçimi temizle</button></div>';
  menu.append(widthTools);widthTools.querySelector('#lcApplyWidth').onclick=()=>{const input=widthTools.querySelector('#lcWidthValue');if(!selectedColumns.size){menu.querySelector('[data-width-select]')?.focus();return;}if(!input.checkValidity()||!input.value){input.reportValidity();return;}setWidths(Object.fromEntries([...selectedColumns].map(key=>[key,input.value])));};
  widthTools.querySelector('#lcAutoWidth').onclick=()=>{if(!selectedColumns.size){menu.querySelector('[data-width-select]')?.focus();return;}fitColumns(selectedColumns);};
  widthTools.querySelector('#lcSelectVisible').onclick=()=>{selectedColumns.clear();for(const key of order)if(!hidden.has(key)&&!['selection','number'].includes(key))selectedColumns.add(key);syncSelection();};
  widthTools.querySelector('#lcClearSelection').onclick=()=>{selectedColumns.clear();syncSelection();};
  syncSelection();
  const grouping=document.createElement('div');grouping.textContent='Gruplama';
  const select=document.createElement('select'),second=document.createElement('select');select.id='lcGrouping';second.id='lcGroupingSecondary';
  for(const [control,label] of [[select,'Birinci gruplama'],[second,'İkinci gruplama']]){control.setAttribute('aria-label',label);control.title=label;for(const [v,t] of groupOptions){const o=document.createElement('option');o.value=v;o.textContent=!v&&control===second?'İkinci seviye yok':t;control.append(o);}}
  function syncGroups(){select.value=group;second.value=secondary;second.disabled=!group;[...second.options].forEach(o=>o.disabled=!!o.value&&o.value===group);}
  grouping.append(select,document.createTextNode('→'),second);menu.append(grouping);syncGroups();
  select.onchange=()=>{group=select.value;if(!group||group===secondary)secondary='';syncGroups();collapsed.clear();save();applyRows();};
  second.onchange=()=>{secondary=second.value;collapsed.clear();save();applyRows();};
  const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='Varsayılan görünüm';reset.style.gridColumn='1/-1';reset.onclick=()=>{order=[...keys];hidden=new Set(['snapshot','requirement','confidence',...keys.slice(13)]);keys.forEach((k,i)=>widths[k]=i===0?26:i===1?48:['measurement','requirement','information'].includes(k)?180:100);exactWidths=false;selectedColumns.clear();syncSelection();group='';select.value='';collapsed.clear();menu.querySelectorAll('[data-column-visible]').forEach(c=>c.checked=!hidden.has(c.dataset.columnVisible));save();applyRows();};menu.append(reset);
  grouping.className='lc-grouping-control';grouping.removeAttribute('style');
  document.querySelector('.list-toolbar').append(grouping);
  const originalReset=reset.onclick;reset.onclick=()=>{secondary='';originalReset();order=order.filter(k=>k!=='classification');order.splice(order.indexOf('type')+1,0,'classification');hidden.delete('classification');menu.querySelector('[data-column-visible="classification"]').checked=true;syncGroups();save();applyRows();};
  root.ASMachListColumns.mountSettings=host=>{
   const area=document.createElement('div');area.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;max-width:850px';
   const info=document.createElement('p');info.textContent='Sütun görünürlüğü, sırası, genişlikleri ve gruplama bu kullanıcı için otomatik saklanır. Yeni projelerde ve sonraki açılışlarda aynı görünüm kullanılır. Değişiklikler hemen uygulanır.';host.append(info,area);
   for(const key of keys.slice(2)){const label=document.createElement('label'),check=document.createElement('input');label.style.cssText='display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid #e0e9ef';check.type='checkbox';check.checked=!hidden.has(key);label.append(check,document.createTextNode(labels[key]));area.append(label);check.onchange=()=>{const original=menu.querySelector('[data-column-visible="'+key+'"]');original.checked=check.checked;original.dispatchEvent(new Event('change',{bubbles:true}));};}
   const widthPanel=document.createElement('section');widthPanel.className='lc-settings-width';widthPanel.innerHTML='<h3>Toplu sütun genişliği</h3><p>Birden çok sütunu Ctrl veya Shift ile seçin. Genişliği piksel olarak uygulayın ya da içeriğe otomatik sığdırın.</p><div><select multiple size="8" aria-label="Genişliği değiştirilecek sütunlar"></select><div><label>Genişlik (px)<input type="number" min="45" max="1200" step="1" inputmode="numeric"></label><button type="button" class="btn" data-apply>Seçilenlere uygula</button><button type="button" class="btn" data-auto>Otomatik sığdır</button></div></div>';
   const picker=widthPanel.querySelector('select'),input=widthPanel.querySelector('input');for(const key of keys.slice(2)){const option=document.createElement('option');option.value=key;option.textContent=labels[key];picker.append(option);}
   const chosen=()=>[...picker.selectedOptions].map(option=>option.value);widthPanel.querySelector('[data-apply]').onclick=()=>{if(!chosen().length){picker.focus();return;}if(!input.value||!input.checkValidity()){input.reportValidity();return;}setWidths(Object.fromEntries(chosen().map(key=>[key,input.value])));};widthPanel.querySelector('[data-auto]').onclick=()=>{if(!chosen().length){picker.focus();return;}fitColumns(chosen());};host.append(widthPanel);
   const restore=document.createElement('button');restore.className='btn';restore.textContent='Varsayılan sütun görünümüne dön';restore.onclick=()=>{reset.click();[...area.querySelectorAll('input')].forEach((check,i)=>check.checked=!hidden.has(keys[i+2]));};host.append(restore);
  };
  root.ASMachListColumns.setWidth=(key,value)=>{if(!keys.includes(key))return;setWidths({[key]:value});};
  root.ASMachListColumns.autoFit=key=>{if(keys.includes(key))fitColumns([key]);};
  root.ASMachListColumns.hide=key=>{const check=menu.querySelector(`[data-column-visible="${key}"]`);if(check){check.checked=false;check.onchange();}};
  root.ASMachListColumns.reset=()=>reset.click();
  // The unified visibility menu supersedes the old positional column preset.
  const preset=document.querySelector('#acuiColumnsToggle');if(preset)preset.addEventListener('click',e=>{e.stopImmediatePropagation();const show=hidden.has('snapshot');for(const k of ['snapshot','requirement','confidence'])show?hidden.delete(k):hidden.add(k);preset.setAttribute('aria-pressed',String(show));menu.querySelectorAll('[data-column-visible]').forEach(c=>c.checked=!hidden.has(c.dataset.columnVisible));save();applyRows();},true);
  function cells(row){if(!row.dataset.columnsTagged){[...row.cells].forEach((c,i)=>c.dataset.column=keys[i]);row.dataset.columnsTagged='true';}const map=Object.fromEntries([...row.cells].map(c=>[c.dataset.column,c]));for(const [index,k] of order.entries()){const c=map[k];if(!c)continue;c.hidden=hidden.has(k);c.style.width=displayWidths[k]+'px';c.style.minWidth=displayWidths[k]+'px';c.style.maxWidth=displayWidths[k]+'px';if(row.cells[index]!==c)row.insertBefore(c,row.cells[index]||null);}}
  head.dataset.columnsTagged='true';
  applyRows=()=>{
   const body=table.tBodies[0];if(body.querySelector('.acui-inline-input'))return;
   if(app.state.annotations.some(r=>r.listOnly))widths.number=Math.max(widths.number,100);
   const visible=order.filter(k=>!hidden.has(k)),base=visible.reduce((n,k)=>n+widths[k],0),available=table.closest('.table-wrap').clientWidth;
   const flexible=visible.filter(k=>!['selection','number'].includes(k)),weight=flexible.reduce((n,k)=>n+widths[k],0),spare=Math.max(0,available-base);
   displayWidths={...widths};if(!exactWidths)for(const k of flexible)displayWidths[k]+=weight?spare*widths[k]/weight:0;
   const records=new Map(app.state.annotations.map(r=>[String(r.id),r]));
   cells(head);const rows=[...body.querySelectorAll('tr[data-id]')];rows.forEach((r,i)=>{if(!r.querySelector('[data-column="classification"]')){const td=document.createElement('td');td.dataset.column='classification';td.dataset.editable='classification';r.append(td);}const td=r.querySelector('[data-column="classification"]');td.textContent=root.ASMachClassification?.label(records.get(r.dataset.id)?.classification)||'Belirtilmedi';td.title=td.textContent;if(r.dataset.listIndex===undefined)r.dataset.listIndex=String(i);cells(r);});rows.sort((a,b)=>Number(a.dataset.listIndex)-Number(b.dataset.listIndex));body.querySelectorAll('.lc-group').forEach(r=>r.remove());
   const total=visible.reduce((n,k)=>n+displayWidths[k],0);table.style.setProperty('width',total+'px','important');table.style.setProperty('min-width',total+'px','important');
   rows.forEach(r=>{r.hidden=false;if(!group)body.append(r);});
   if(group){const rowMap=new Map(rows.map(r=>[r.dataset.id,r]));
    function owner(row){const seen=new Set();while(!seen.has(row.dataset.id)){seen.add(row.dataset.id);const r=records.get(row.dataset.id);if(!(r?.listOnly||r?.measurementComponent)||!rowMap.has(String(r.parentCharacteristicId)))break;row=rowMap.get(String(r.parentCharacteristicId));}return row;}
    function value(row,key){row=owner(row);const r=records.get(row.dataset.id)||{};return ['method','frequency','classification'].includes(key)?row.querySelector(`[data-column="${key}"]`)?.textContent.trim()||'Belirtilmedi':String(r[key]||'Belirtilmedi');}
    function renderGroups(items,level,path=[],ancestorHidden=false){const key=[group,secondary][level],buckets=new Map();for(const row of items){const name=value(row,key);if(!buckets.has(name))buckets.set(name,[]);buckets.get(name).push(row);}
     for(const [name,members] of buckets){const next=[...path,key,name],id=JSON.stringify(next),closed=collapsed.has(id),tr=document.createElement('tr');tr.className='lc-group';tr.dataset.level=String(level);tr.hidden=ancestorHidden;const td=document.createElement('td');td.colSpan=visible.length;const button=document.createElement('button');button.type='button';button.style.paddingLeft=(9+level*24)+'px';button.setAttribute('aria-expanded',String(!closed));for(const [cls,text] of [['arrow',closed?'▸':'▾'],['name',name],['count',members.length+' kayıt']]){const span=document.createElement('span');span.className='lc-group-'+cls;span.textContent=text;button.append(span);}button.onclick=()=>{closed?collapsed.delete(id):collapsed.add(id);applyRows();};td.append(button);tr.append(td);body.append(tr);if(level===0&&secondary)renderGroups(members,1,next,ancestorHidden||closed);else for(const row of members){row.hidden=ancestorHidden||closed;body.append(row);}}
    }renderGroups(rows,0);
   }
   window.ASMachRepeatedCharacteristics?.groupRows(app);
  };
  const style=document.createElement('style');style.textContent=`
  .acui-dock.acui-readable .acui-table[data-managed-columns]{table-layout:fixed}
  .acui-dock.acui-readable .acui-table[data-managed-columns] :is(th,td)[data-column]{display:table-cell!important;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis}
  .acui-dock.acui-readable .acui-table[data-managed-columns] :is(th,td)[hidden],.acui-dock .acui-table tr[hidden]{display:none!important}
  .acui-dock.acui-readable .acui-table[data-managed-columns] thead th{position:sticky;top:0;z-index:5;background:#e9eff5;user-select:none;padding-right:10px!important}
  .acui-dock.acui-readable .acui-table[data-managed-columns] thead th:nth-child(-n+2){z-index:6}
  .acui-table[data-managed-columns] th[draggable=true]{cursor:grab}
  .lc-resize{position:absolute;right:0;top:0;height:100%;width:7px;cursor:col-resize;touch-action:none;border-right:2px solid #bdd1df}.lc-resize:hover,.lc-resize:focus{background:#07899a44;outline:none}
  .acui-dock.acui-readable .acui-table .lc-group td{position:static!important;display:table-cell!important;max-width:none!important;background:#e8f1f7!important;padding:0 6px!important}
  .acui-dock.acui-readable .acui-table .lc-group td{text-align:left!important;height:32px!important;border-top:1px solid #bed5df;border-bottom:1px solid #d7e4ea;border-left:3px solid #07899a;padding:0!important}
  .lc-group button{display:flex;align-items:center;justify-content:flex-start;gap:8px;border:0;background:none;color:#214b60;font-size:11px;font-weight:650;padding:5px 9px;cursor:pointer;text-align:left;min-height:30px}
  .lc-group button:hover{background:#d6eaf2}.lc-group button:focus-visible{outline:2px solid #07899a;outline-offset:-2px}
  .lc-group-arrow{width:18px;height:18px;display:grid;place-items:center;border:1px solid #b7d2df;border-radius:4px;background:white;color:#087c8b}.lc-group-count{font-size:10px;font-weight:500;color:#47667b;border:1px solid #c5d9e4;border-radius:10px;background:white;padding:1px 7px}
  .acui-dock .lc-grouping-control{display:flex;align-items:center;gap:6px;white-space:nowrap;color:#32556b;font-size:10px;order:1;margin-left:10px}
  .acui-dock :is(#lcGrouping,#lcGroupingSecondary){width:145px;min-height:24px;height:24px;padding:2px 5px;font-size:10px;border:1px solid #bad0de;border-radius:4px;background:#fff}
  .acui-dock .acui-list-summary{justify-content:flex-start;gap:10px;flex-wrap:wrap}.acui-dock .acui-list-summary>div:last-of-type{margin-left:auto;order:2}
  .acui-dock.acui-readable .acui-table[data-managed-columns] thead th.lc-selected{background:#d5edf5!important;box-shadow:inset 0 0 0 2px #07899a;color:#075d70}
  .lc-measure{position:fixed;left:-10000px;top:0;display:inline-block;width:max-content;max-width:none;white-space:nowrap;visibility:hidden;pointer-events:none}
  .acui-column-menu>div[popover]{width:min(590px,calc(100vw - 20px))!important;display:grid!important;grid-template-columns:1fr!important;max-height:min(520px,72vh)!important;overflow:auto!important;gap:7px!important;padding:12px!important;box-sizing:border-box!important}
  .acui-column-menu>div[popover] .lc-menu-title{font-size:13px;color:#173d51;padding:0!important}.acui-column-menu>div[popover] .lc-menu-hint{font-size:10px;line-height:1.4;color:#55758a;margin:0 0 3px}
  .acui-column-menu>div[popover] .lc-column-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
  .acui-column-menu>div[popover] .lc-column-tile{display:flex;align-items:center;min-width:0;min-height:34px;padding:3px 5px;border:1px solid #dce7ee;border-radius:5px;background:#f7fafc;gap:4px}
  .acui-column-menu>div[popover] .lc-column-tile:has([aria-pressed=true]){border-color:#71b9c8;background:#eaf7fa}
  .acui-column-menu>div[popover] .lc-column-tile label{display:flex!important;align-items:center;flex:1;min-width:0;min-height:0!important;padding:0!important;background:none!important;font-size:10px!important;line-height:1.2!important;gap:5px!important;cursor:pointer}
  .acui-column-menu>div[popover] .lc-column-tile label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .acui-column-menu>div[popover] .lc-width-select{flex:0 0 auto;min-width:32px;padding:3px 4px;border:1px solid #bfd4df;border-radius:3px;background:#fff;color:#41677b;font:9px 'Segoe UI',sans-serif;cursor:pointer}.acui-column-menu>div[popover] .lc-width-select[aria-pressed=true]{background:#087f91;color:white;border-color:#087f91}
  .acui-column-menu>div[popover] .lc-width-tools{display:grid;grid-template-columns:1fr auto;gap:6px 10px;padding:9px;border:1px solid #cadde6;border-radius:6px;background:#f3f9fb;font-size:10px}.acui-column-menu>div[popover] .lc-width-tools>strong{font-size:11px;color:#1c5368}.acui-column-menu>div[popover] #lcSelectedCount{color:#537489;text-align:right}
  .acui-column-menu>div[popover] .lc-width-actions,.acui-column-menu>div[popover] .lc-select-actions{grid-column:1/-1;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.acui-column-menu>div[popover] .lc-width-actions label{display:flex!important;align-items:center;gap:5px!important;padding:0!important;background:none!important;font-size:10px!important}.acui-column-menu>div[popover] #lcWidthValue{width:72px;height:27px;min-height:27px;padding:3px 5px;border:1px solid #b6cedc;border-radius:4px;background:#fff;font-size:11px}.acui-column-menu>div[popover] .lc-width-tools .btn{min-height:27px;padding:4px 7px;font-size:10px}.acui-column-menu>div[popover]>.btn{min-height:27px;font-size:10px;padding:4px 7px;justify-self:start}
  .acui-column-menu>div[popover] .lc-width-tools .btn{border:1px solid #b9d1df;border-radius:4px;background:#fff;color:#25546b;cursor:pointer}.acui-column-menu>div[popover] #lcApplyWidth{background:#087f91;border-color:#087f91;color:#fff;font-weight:650}.acui-column-menu>div[popover]>.btn{border:1px solid #c6d9e2;background:#fff;color:#25546b}
  .lc-settings-width{margin:20px 0;padding:14px;border:1px solid #cbdde6;border-radius:7px;background:#f7fbfd;max-width:850px}.lc-settings-width h3{margin:0 0 5px;font-size:13px}.lc-settings-width p{margin:0 0 12px;font-size:11px;color:#537186}.lc-settings-width>div{display:grid;grid-template-columns:minmax(180px,1fr) minmax(190px,1fr);gap:14px}.lc-settings-width select{width:100%;min-height:180px;padding:5px;border:1px solid #bfd2de;border-radius:5px;background:#fff}.lc-settings-width select option{padding:4px 6px}.lc-settings-width>div>div{display:flex;align-items:flex-start;flex-direction:column;gap:8px}.lc-settings-width label{display:flex;align-items:center;gap:7px;font-size:11px}.lc-settings-width input{width:85px;height:30px;padding:4px 6px;border:1px solid #b9cedb;border-radius:4px}.lc-settings-width .btn{min-height:29px;padding:5px 9px;border:1px solid #bdd2df;border-radius:4px;background:white;color:#25546b}.lc-settings-width [data-apply]{background:#087f91;color:white;border-color:#087f91}
  @media(max-width:500px){.acui-column-menu>div[popover] .lc-column-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.acui-dock .lc-grouping-control{margin-left:0}}
  `;document.head.append(style);applyRows();
  if(root.ResizeObserver){let previous=-1,frame;new ResizeObserver(()=>{const width=table.closest('.table-wrap').clientWidth;if(width===previous)return;previous=width;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>applyRows());}).observe(table.closest('.table-wrap'));}
 }
 root.ASMachListColumns={init,apply:()=>applyRows()};
})(window);
