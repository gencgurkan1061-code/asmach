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
  for(const k of keys)widths[k]=Math.max(k==='selection'?26:45,Math.min(600,Number(saved.widths?.[k])||parseInt(headers[keys.indexOf(k)].style.width)||110));
  const collapsed=new Set();let dragging=null,displayWidths={...widths};
  function save(){try{ASMachPreferences.setItem(storageKey,JSON.stringify({order,widths,hidden:[...hidden],group,secondary,panelEditing:true}));}catch{app.toast?.('Liste görünümü bu oturumda geçerli; tarayıcı ayarları kaydedilemedi.',true);}}
  function move(key,target){if(!key||key===target||['selection','number'].includes(target))return;order=order.filter(k=>k!==key);order.splice(order.indexOf(target),0,key);save();applyRows();}
  headers.forEach((h,i)=>{const key=keys[i];h.dataset.column=key;h.draggable=i>1;h.title=i>1?'Sıralamak için sürükleyin. Genişlik için sağ kenarı çekin.':labels[key];
   h.addEventListener('dragstart',e=>{dragging=key;e.dataTransfer.setData('text/plain',key);});h.addEventListener('dragover',e=>{if(i>1)e.preventDefault();});h.addEventListener('drop',e=>{e.preventDefault();move(dragging,key);dragging=null;});
   const grip=document.createElement('span');grip.className='lc-resize';grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');grip.setAttribute('aria-label',labels[key]+' sütun genişliği');
   grip.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();h.draggable=false;const start=e.clientX,initial=widths[key];grip.setPointerCapture(e.pointerId);grip.onpointermove=p=>{widths[key]=Math.max(i===0?26:45,Math.min(600,initial+p.clientX-start));applyRows();};grip.onpointerup=()=>{grip.onpointermove=null;h.draggable=i>1;save();};grip.onpointercancel=()=>{grip.onpointermove=null;h.draggable=i>1;save();};});
   grip.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();widths[key]=Math.max(i===0?26:45,Math.min(600,widths[key]+(e.key==='ArrowRight'?10:-10)));save();applyRows();});h.append(grip);
  });
  table.dataset.managedColumns='true';
  menu.replaceChildren();const note=document.createElement('strong');note.textContent='Sütun görünümü';note.style.gridColumn='1/-1';menu.append(note);
  for(const key of keys.slice(2)){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!hidden.has(key);check.dataset.columnVisible=key;label.append(check,document.createTextNode(labels[key]));menu.append(label);check.onchange=()=>{check.checked?hidden.delete(key):hidden.add(key);save();applyRows();};}
  const grouping=document.createElement('div');grouping.textContent='Gruplama';
  const select=document.createElement('select'),second=document.createElement('select');select.id='lcGrouping';second.id='lcGroupingSecondary';
  for(const [control,label] of [[select,'Birinci gruplama'],[second,'İkinci gruplama']]){control.setAttribute('aria-label',label);control.title=label;for(const [v,t] of groupOptions){const o=document.createElement('option');o.value=v;o.textContent=!v&&control===second?'İkinci seviye yok':t;control.append(o);}}
  function syncGroups(){select.value=group;second.value=secondary;second.disabled=!group;[...second.options].forEach(o=>o.disabled=!!o.value&&o.value===group);}
  grouping.append(select,document.createTextNode('→'),second);menu.append(grouping);syncGroups();
  select.onchange=()=>{group=select.value;if(!group||group===secondary)secondary='';syncGroups();collapsed.clear();save();applyRows();};
  second.onchange=()=>{secondary=second.value;collapsed.clear();save();applyRows();};
  const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='Varsayılan görünüm';reset.style.gridColumn='1/-1';reset.onclick=()=>{order=[...keys];hidden=new Set(['snapshot','requirement','confidence',...keys.slice(13)]);keys.forEach((k,i)=>widths[k]=i===0?26:i===1?48:['measurement','requirement','information'].includes(k)?180:100);group='';select.value='';collapsed.clear();menu.querySelectorAll('[data-column-visible]').forEach(c=>c.checked=!hidden.has(c.dataset.columnVisible));save();applyRows();};menu.append(reset);
  grouping.className='lc-grouping-control';grouping.removeAttribute('style');
  document.querySelector('.list-toolbar').append(grouping);
  const originalReset=reset.onclick;reset.onclick=()=>{secondary='';originalReset();order=order.filter(k=>k!=='classification');order.splice(order.indexOf('type')+1,0,'classification');hidden.delete('classification');menu.querySelector('[data-column-visible="classification"]').checked=true;syncGroups();save();applyRows();};
  root.ASMachListColumns.mountSettings=host=>{
   const area=document.createElement('div');area.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;max-width:850px';
   const info=document.createElement('p');info.textContent='Sütun görünürlüğü, sırası, genişlikleri ve gruplama bu kullanıcı için otomatik saklanır. Yeni projelerde ve sonraki açılışlarda aynı görünüm kullanılır. Değişiklikler hemen uygulanır.';host.append(info,area);
   for(const key of keys.slice(2)){const label=document.createElement('label'),check=document.createElement('input');label.style.cssText='display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid #e0e9ef';check.type='checkbox';check.checked=!hidden.has(key);label.append(check,document.createTextNode(labels[key]));area.append(label);check.onchange=()=>{const original=menu.querySelector('[data-column-visible="'+key+'"]');original.checked=check.checked;original.dispatchEvent(new Event('change',{bubbles:true}));};}
   const restore=document.createElement('button');restore.className='btn';restore.textContent='Varsayılan sütun görünümüne dön';restore.onclick=()=>{reset.click();[...area.querySelectorAll('input')].forEach((check,i)=>check.checked=!hidden.has(keys[i+2]));};host.append(restore);
  };
  root.ASMachListColumns.setWidth=(key,value)=>{if(!keys.includes(key))return;widths[key]=Math.max(key==='selection'?26:45,Math.min(600,value));save();applyRows();};
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
   displayWidths={...widths};for(const k of flexible)displayWidths[k]+=weight?spare*widths[k]/weight:0;
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
  .acui-column-menu>div[popover]{width:min(460px,calc(100vw - 20px))!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;max-height:none!important;overflow:visible!important;gap:4px!important;padding:8px!important}
  .acui-column-menu>div[popover] label{min-width:0;min-height:25px!important;justify-content:flex-start!important;gap:6px!important;padding:3px 5px!important;font-size:10px!important;line-height:14px}
  .acui-column-menu>div[popover] strong{font-size:11px;padding:2px 0 5px}.acui-column-menu>div[popover]>.btn{min-height:25px;font-size:10px;padding:3px 6px}
  @media(max-width:500px){.acui-column-menu>div[popover]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.acui-dock .lc-grouping-control{margin-left:0}}
  `;document.head.append(style);applyRows();
  if(root.ResizeObserver){let previous=-1,frame;new ResizeObserver(()=>{const width=table.closest('.table-wrap').clientWidth;if(width===previous)return;previous=width;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>applyRows());}).observe(table.closest('.table-wrap'));}
 }
 root.ASMachListColumns={init,apply:()=>applyRows()};
})(window);
