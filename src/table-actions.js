(function(root){
 'use strict';let transform=rows=>rows;
 function init(app){
  const table=document.querySelector('.acui-table'),filters=new Map();let sorting=null,source=app.state.fileData;
  root.ASMachTableActions.hasFilters=()=>filters.size>0;
  // Balloon numbers are hierarchical identifiers (32.2, 32.20), not decimal values.
  const numeric=new Set(['page','nominalValue','lowerTolerance','upperTolerance','lowerLimit','upperLimit','confidence']);
  function value(r,k){
   if(k==='measurement')return root.ASMachRequirements.syncRequirement({...r,requirementMode:'auto'}).requirement||r.requirement||'';
   if(k==='method'||k==='frequency'){const render=p=>k==='method'?(app.methodLabel?.(p.inspectionMethod)||p.inspectionMethod||''):(root.ASMachInspectionPlan.label(p)||'');return r.rolePlans?Object.entries(r.rolePlans).filter(([,p])=>p.enabled).map(([role,p])=>`${root.ASMachRolePlans.roles[role]}: ${render(p)}`).join(' · '):render(r);}
   if(k==='information'){const issues=root.ASMachInspectionPlan.checkInformation(r);return issues.length?issues.map(i=>i.label).join(' · '):'Bilgiler tamam';}
   if(k==='confidence')return String(r.detectionConfidence??'');return String(r[k]??'');
  }
  const compare=(a,b,k)=>{if(k==='number')return root.ASMachNumberOrder.compare(a,b);const n=s=>s.trim()===''?NaN:Number(s.replace(',','.'));return numeric.has(k)&&Number.isFinite(n(a))&&Number.isFinite(n(b))?n(a)-n(b):a.localeCompare(b,'tr',{numeric:true,sensitivity:'base'});};
  transform=rows=>{if(source!==app.state.fileData){source=app.state.fileData;filters.clear();sorting=null;}const result=rows.filter(r=>[...filters].every(([k,values])=>values.has(value(r,k))));return sorting?result.sort((a,b)=>compare(value(a,sorting.key),value(b,sorting.key),sorting.key)*sorting.direction):result;};
  const popup=document.createElement('div');popup.id='lcHeaderMenu';popup.setAttribute('popover','manual');table.closest('.acui-dock').append(popup);
  function close(){if(popup.matches(':popover-open'))popup.hidePopover();}
  function update(){table.querySelectorAll('th[data-column]').forEach(h=>{const key=h.dataset.column;h.setAttribute('aria-sort',sorting?.key===key?(sorting.direction===1?'ascending':'descending'):'none');const b=h.querySelector('.ta-filter');if(b){b.textContent=filters.has(key)?'●':sorting?.key===key?(sorting.direction===1?'↑':'↓'):'▾';b.classList.toggle('ta-active',filters.has(key));}});app.renderAll();}
  function action(title,run,disabled=false){const b=document.createElement('button');b.type='button';b.textContent=title;b.disabled=disabled;b.onclick=()=>{run();};popup.append(b);return b;}
  function place(x,y){popup.showPopover();const r=popup.getBoundingClientRect();popup.style.left=Math.max(6,Math.min(x,innerWidth-r.width-6))+'px';popup.style.top=Math.max(6,Math.min(y,innerHeight-r.height-6))+'px';}
  function open(key,x,y,enumerate=false){
   close();popup.replaceChildren();const h=table.querySelector(`th[data-column="${key}"]`),title=document.createElement('strong');title.textContent=h?([...h.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()):'Tablo ayarları';popup.append(title);
   const allowed=!!h&&!['selection','snapshot','actions'].includes(key);
   const sort=direction=>{sorting={key,direction};update();close();};
   action('↑ Artan sırala',()=>sort(1),!allowed);action('↓ Azalan sırala',()=>sort(-1),!allowed);action('↺ Sıralamayı temizle',()=>{sorting=null;update();close();},!sorting);
   if(enumerate&&allowed){
    const values=[...new Set(app.state.annotations.filter(r=>[...filters].every(([k,vs])=>k===key||vs.has(value(r,k)))).map(r=>value(r,key)))].sort((a,b)=>compare(a,b,key));
    const selected=new Set(filters.get(key)||values),search=document.createElement('input');search.type='search';search.placeholder='Değerlerde ara…';search.setAttribute('aria-label','Filtre değerlerinde ara');popup.append(search);
    const tools=document.createElement('div');tools.className='ta-options';const options=document.createElement('div');options.className='ta-values';
    for(const v of values){const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.checked=selected.has(v);check.dataset.enumValue=v;check.onchange=()=>check.checked?selected.add(v):selected.delete(v);text.textContent=v||'(Boş)';label.title=text.textContent;label.append(check,text);options.append(label);}
    for(const [text,on] of [['Tümünü seç',true],['Seçimi temizle',false]]){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>options.querySelectorAll('label').forEach(l=>{if(l.hidden)return;const c=l.querySelector('input');c.checked=on;c.onchange();});tools.append(b);}
    search.oninput=()=>options.querySelectorAll('label').forEach(l=>l.hidden=!l.textContent.toLocaleLowerCase('tr').includes(search.value.toLocaleLowerCase('tr')));popup.append(tools,options);
    action('Filtreyi uygula',()=>{if(values.every(v=>selected.has(v)))filters.delete(key);else filters.set(key,selected);update();close();}).className='ta-apply';
   }else action('⌄ Sütun filtresi…',()=>open(key,x,y,true),!allowed);
   action('Bu sütunun filtresini temizle',()=>{filters.delete(key);update();close();},!filters.has(key));
   if(!enumerate){
    action('↔ Genişliği içeriğe uydur',()=>{const texts=[h?.textContent||'',...app.state.annotations.map(r=>value(r,key))];root.ASMachListColumns.setWidth(key,Math.max(...texts.map(t=>Math.min(80,t.length)))*6+32);close();},!h);
    const grouping=document.querySelector('#lcGrouping');action('Bu sütuna göre grupla',()=>{grouping.value=key;grouping.dispatchEvent(new Event('change',{bubbles:true}));close();},![...grouping.options].some(o=>o.value===key));
    action('Gruplamayı kaldır',()=>{grouping.value='';grouping.dispatchEvent(new Event('change',{bubbles:true}));close();},!grouping.value);
    action('Bu sütunu gizle',()=>{root.ASMachListColumns.hide(key);close();},!h||['selection','number'].includes(key));
    action('▥ Sütun seçici',()=>{close();const menu=document.querySelector('.acui-column-menu');menu.open=true;});
    action('Tablo görünümünü sıfırla',()=>{filters.clear();sorting=null;root.ASMachListColumns.reset();update();close();});
   }
   action('Tüm sütun filtrelerini temizle',()=>{filters.clear();update();close();},!filters.size);place(x,y);
  }
  table.querySelectorAll('th[data-column]').forEach(h=>{const key=h.dataset.column;if(['selection','snapshot','actions'].includes(key))return;const b=document.createElement('button');b.type='button';b.className='ta-filter';b.textContent='▾';b.title='Filtrele ve sırala';b.setAttribute('aria-label',key+' sütununu filtrele ve sırala');b.onclick=e=>{e.stopPropagation();const r=b.getBoundingClientRect();open(key,r.left,r.bottom,true);};h.append(b);});
  table.addEventListener('contextmenu',e=>{e.preventDefault();const cell=e.target.closest('[data-column]');open(cell?.dataset.column||'',e.clientX,e.clientY);});
  document.addEventListener('pointerdown',e=>{if(!popup.contains(e.target)&&!e.target.closest('.ta-filter'))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});window.addEventListener('resize',close);
  document.querySelector('#acuiClearFilters').addEventListener('click',()=>{filters.clear();update();});
  const clearButton=document.querySelector('#acuiClearFilters'),oldActions=clearButton.parentElement;
  clearButton.classList.add('btn');clearButton.title='Etkin arama ve sütun filtrelerini temizle';
  document.querySelector('.list-toolbar').append(clearButton);oldActions.remove();
  document.querySelector('#acuiFilterToggle').hidden=true;
  document.querySelector('#lcGrouping').addEventListener('change',()=>{const m=document.querySelector('.acui-column-menu');m.open=false;const p=m.querySelector('[popover]');if(p?.matches(':popover-open'))p.hidePopover();});
  const style=document.createElement('style');style.textContent=`
   .acui-dock #acuiFilterToggle{display:none!important}
   .acui-dock #acuiClearFilters[hidden]{display:none!important}
   .acui-dock #acuiClearFilters:not([hidden]){color:#087c8b;background:#eaf5f7;border:1px solid #bcdce3;white-space:nowrap}
   .acui-dock.acui-readable .acui-dock-handle .list-toolbar input[type=search],.acui-dock.acui-readable .acui-dock-handle .list-toolbar #searchInput{flex:0 1 190px!important;width:190px!important;min-width:70px}
   .acui-dock.acui-readable .lc-grouping-control{flex-shrink:0;margin:0 3px;gap:4px}.acui-dock #lcGrouping{width:126px}
   .acui-dock.acui-readable .acui-table th[data-column]{padding-right:26px!important}
   .ta-filter{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:18px;height:20px;border:0;border-radius:3px;background:transparent;color:#486b82;padding:0;font-size:12px;cursor:pointer}.ta-filter:hover,.ta-filter.ta-active{background:#d8edf4;color:#007a8c}
   #lcHeaderMenu{position:fixed;inset:auto;margin:0;width:260px;max-width:calc(100vw - 12px);max-height:calc(100dvh - 12px);overflow:auto;padding:7px;border:1px solid #c4d4df;border-radius:7px;background:white;box-shadow:0 8px 30px #19364b38;font:11px Arial;color:#244052}
   #lcHeaderMenu>strong{display:block;padding:5px 7px;border-bottom:1px solid #e1e8ee;margin-bottom:4px}
   #lcHeaderMenu button{display:block;width:100%;text-align:left;border:0;border-radius:3px;background:white;color:#294b60;font:11px Arial;padding:6px 7px;cursor:pointer}#lcHeaderMenu button:hover:not(:disabled){background:#eaf4f8}#lcHeaderMenu button:disabled{opacity:.4;cursor:default}
   #lcHeaderMenu input[type=search]{width:100%;height:27px;padding:4px 6px;border:1px solid #c2d4df;border-radius:3px;margin:5px 0;box-sizing:border-box}
   #lcHeaderMenu .ta-options{display:flex}#lcHeaderMenu .ta-options button{font-size:10px}
   #lcHeaderMenu .ta-values{max-height:160px;overflow:auto;border:1px solid #e0e7ed;padding:4px}
   #lcHeaderMenu label{display:flex;align-items:center;gap:6px;padding:4px;font-size:11px}#lcHeaderMenu label[hidden]{display:none}#lcHeaderMenu label input{width:13px;height:13px;flex-shrink:0}#lcHeaderMenu label span{overflow-wrap:anywhere}#lcHeaderMenu .ta-apply{background:#07899a;color:white;margin:5px 0}
  `;document.head.append(style);update();
 }
 root.ASMachTableActions={init,transform:rows=>transform(rows)};
})(window);
