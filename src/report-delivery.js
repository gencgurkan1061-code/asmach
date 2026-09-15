(function(root){
 'use strict';const key='asmach.excel-delivery.v1',defaults={paper:'template',orientation:'template',scale:'template',area:'template',naming:'drawing',custom:'',date:false,openAfter:false};
 function load(){try{return{...defaults,...JSON.parse(root.ASMachPreferences.getItem(key)||'{}')};}catch{return{...defaults};}}
 const clean=s=>String(s??'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim();
 function name(state,item,o,ext='xlsx',now=new Date()){
  const drawing=String(state.fileName||'Rapor').replace(/\.[^.]+$/,''),part=state.metadata?.partNo||drawing;
  let base=o.naming==='custom'?o.custom:o.naming==='template'?item.name:(o.naming==='part'?part:drawing)+'_'+item.name;
  base=clean(base).replace(/\.(xlsx|pdf|zip)$/i,'')||'Rapor';if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(base))base='Rapor_'+base;
  if(o.date)base+='_'+now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');return base.slice(0,170)+'.'+ext;
 }
 function printParts(source,o){
  const out={...source},ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',parse=s=>new DOMParser().parseFromString(s,'application/xml'),xml=d=>new XMLSerializer().serializeToString(d);
  for(const [path,value] of Object.entries(out))if(/^xl\/worksheets\/[^/]+\.xml$/.test(path)){
   const d=parse(value),root=d.documentElement;let setup=d.getElementsByTagNameNS(ns,'pageSetup')[0];
   if(o.paper!=='template'||o.orientation!=='template'||o.scale!=='template'){
    if(!setup){setup=d.createElementNS(ns,'pageSetup');const next=[...root.children].find(n=>['headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'].includes(n.localName));next?root.insertBefore(setup,next):root.append(setup);}
    if(['a4','a3','letter'].includes(o.paper))setup.setAttribute('paperSize',{a4:'9',a3:'8',letter:'1'}[o.paper]);
    if(['portrait','landscape'].includes(o.orientation))setup.setAttribute('orientation',o.orientation);
    if(['width','page','actual'].includes(o.scale)){
     let pr=d.getElementsByTagNameNS(ns,'sheetPr')[0];if(!pr){pr=d.createElementNS(ns,'sheetPr');root.prepend(pr);}let fit=pr.getElementsByTagNameNS(ns,'pageSetUpPr')[0];if(!fit){fit=d.createElementNS(ns,'pageSetUpPr');pr.append(fit);}
     fit.setAttribute('fitToPage',o.scale==='actual'?'0':'1');setup.setAttribute('fitToWidth',o.scale==='actual'?'0':'1');setup.setAttribute('fitToHeight',o.scale==='page'?'1':'0');if(o.scale==='actual')setup.setAttribute('scale','100');else setup.removeAttribute('scale');
    }
   }out[path]=xml(d);
  }
  if(o.area==='all'){const d=parse(out['xl/workbook.xml']);for(const n of [...d.getElementsByTagNameNS(ns,'definedName')])if(n.getAttribute('name')==='_xlnm.Print_Area')n.remove();out['xl/workbook.xml']=xml(d);}
  return out;
 }
 function panel(state,item){
  const el=document.createElement('div');el.className='out-delivery';el.innerHTML='<div class="out-delivery-grid"></div><div class="out-delivery-save"></div><small data-file-preview></small>';
  const initial=load(),fields=[['paper','Kâğıt',[['template','Şablondaki'],['a4','A4'],['a3','A3'],['letter','Letter']]],['orientation','Yön',[['template','Şablondaki'],['portrait','Dikey'],['landscape','Yatay']]],['scale','Ölçek',[['template','Şablondaki'],['width','Genişliğe sığdır'],['page','Tek sayfaya sığdır'],['actual','%100']]],['area','Yazdırma alanı',[['template','Şablondaki alan'],['all','Sayfanın tamamı']]],['naming','Dosya adı',[['drawing','Çizim + şablon'],['part','Parça no + şablon'],['template','Şablon adı'],['custom','Özel ad']]]];
  for(const [key,title,options]of fields){const label=document.createElement('label');label.textContent=title;const select=document.createElement('select');select.dataset.delivery=key;options.forEach(([v,t])=>select.append(new Option(t,v)));select.value=initial[key];label.append(select);el.querySelector('.out-delivery-grid').append(label);}
  const extra=el.querySelector('.out-delivery-save');extra.innerHTML='<label data-custom-name>Özel dosya adı<input data-delivery="custom" maxlength="160"></label><label><input type="checkbox" data-delivery="date"> Tarih ekle</label><label><input type="checkbox" data-delivery="openAfter"> Kaydettikten sonra aç</label>';
  extra.querySelector('[data-delivery=custom]').value=initial.custom;for(const key of ['date','openAfter'])extra.querySelector('[data-delivery='+key+']').checked=initial[key];if(!root.ASMachDesktop){const open=extra.querySelector('[data-delivery=openAfter]');open.checked=false;open.disabled=true;open.parentElement.title='Windows masaüstü uygulamasında kullanılabilir.';}
  const values=()=>Object.fromEntries([...el.querySelectorAll('[data-delivery]')].map(e=>[e.dataset.delivery,e.type==='checkbox'?e.checked:e.value]));
  const update=()=>{const o=values();el.querySelector('[data-custom-name]').hidden=o.naming!=='custom';el.querySelector('[data-file-preview]').textContent='Dosya: '+name(state,item,o);};
  el.addEventListener('input',update);el.addEventListener('change',()=>{update();root.ASMachPreferences.setItem(key,JSON.stringify(values()));});update();
  return{element:el,values,name:ext=>name(state,item,values(),ext)};
 }
 root.ASMachReportDelivery={load,name,printParts,panel};
})(window);
