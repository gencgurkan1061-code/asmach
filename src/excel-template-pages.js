/* Fixed-form continuation sheets: preserve Excel page setup, names and footer cells. */
(function(root){
 'use strict';
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/package/2006/relationships',office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const parse=s=>new DOMParser().parseFromString(s,'application/xml'),xml=d=>new XMLSerializer().serializeToString(d),els=(d,n)=>[...d.getElementsByTagNameNS('*',n)];
 const dirname=p=>p.slice(0,p.lastIndexOf('/')+1),resolve=(base,p)=>{const parts=(p.startsWith('/')?p.slice(1):base+p).split('/'),out=[];for(const x of parts){if(x==='..')out.pop();else if(x&&x!=='.')out.push(x);}return out.join('/');};
 const relpath=p=>dirname(p)+'_rels/'+p.split('/').pop()+'.rels';
 const column=n=>{let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
 const rangeText=(name,a)=>"'"+name.replace(/'/g,"''")+"'!$"+column(a.c0)+'$'+(a.r0+1)+':$'+column(a.c1)+'$'+(a.r1+1);
 function shiftedToken(token,row,amount,expand=true){
  const match=String(token).match(/^(\$?[A-Z]{1,3})(\$?)(\d+)(?::(\$?[A-Z]{1,3})(\$?)(\d+))?$/);if(!match)return token;
  let first=+match[3],last=match[6]?+match[6]:null;
  if(last==null){if(first>=row)first+=amount;return match[1]+match[2]+first;}
  if(first>=row){first+=amount;last+=amount;}else if(last>=row||(expand&&last===row-1))last+=amount;
  return match[1]+match[2]+first+':'+match[4]+match[5]+last;
 }
 const shiftedRefs=(value,row,amount,expand=true)=>String(value||'').split(/(\s+)/).map(part=>shiftedToken(part,row,amount,expand)).join('');
 function shiftedFormula(value,row,amount){return String(value||'').replace(/(\$?[A-Z]{1,3})(\$?)(\d+)(?::(\$?[A-Z]{1,3})(\$?)(\d+))?/g,(all,c1,a1,r1,c2,a2,r2)=>shiftedToken(c1+a1+r1+(c2?':'+c2+a2+r2:''),row,amount,true));}
 function copiedFormula(value,delta){return String(value||'').replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g,(all,col,fixed,row)=>col+fixed+(fixed?row:+row+delta));}
 function insertRows(document,workbook,names,source,index,range,count,bindings){
  const amount=Math.max(0,count-(range.r1-range.r0+1));if(!amount)return range;const insertAt=range.r1+2,data=els(document,'sheetData')[0],rows=els(data,'row'),prototype=rows.find(item=>+item.getAttribute('r')===range.r0+1);if(!prototype)throw Error(source.name+': liste alanının ilk satırı bulunamadı.');
  for(const formula of els(document,'f')){formula.textContent=shiftedFormula(formula.textContent,insertAt,amount);if(formula.hasAttribute('ref'))formula.setAttribute('ref',shiftedRefs(formula.getAttribute('ref'),insertAt,amount));}
  for(const rowNode of rows){const old=+rowNode.getAttribute('r');if(old>=insertAt){rowNode.setAttribute('r',old+amount);for(const cell of els(rowNode,'c'))cell.setAttribute('r',shiftedToken(cell.getAttribute('r'),insertAt,amount,false));}}
 for(const [tag,attribute] of [['mergeCell','ref'],['conditionalFormatting','sqref'],['dataValidation','sqref'],['autoFilter','ref'],['hyperlink','ref'],['dimension','ref']])for(const node of els(document,tag))if(node.hasAttribute(attribute))node.setAttribute(attribute,shiftedRefs(node.getAttribute(attribute),insertAt,amount));
  for(const node of els(document,'brk'))if(node.hasAttribute('id')&&+node.getAttribute('id')>=insertAt)node.setAttribute('id',+node.getAttribute('id')+amount);
  const repeatedColumns=new Set(Object.entries(bindings||{}).filter(([,binding])=>binding.field&&root.ASMachExcelCellTemplate.repeats(binding.field)).map(([key])=>+key.split(':')[1]));
  const mergeHost=els(document,'mergeCells')[0],prototypeMerges=mergeHost?els(mergeHost,'mergeCell').map(node=>node.getAttribute('ref')).filter(ref=>{const parsed=area("'"+source.name.replace(/'/g,"''")+"'!"+ref);return parsed&&parsed.r0===range.r0&&parsed.r1===range.r0&&parsed.c0>=range.c0&&parsed.c1<=range.c1;}):[];
  const next=[...data.children].find(item=>+item.getAttribute('r')>=insertAt+amount)||null;
  for(let offset=0;offset<amount;offset++){
   const targetRow=insertAt+offset,clone=prototype.cloneNode(true);clone.setAttribute('r',targetRow);
   for(const cell of els(clone,'c')){const ref=cell.getAttribute('r'),col=ref.match(/^[A-Z]+/)[0],colNo=[...col].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;cell.setAttribute('r',col+targetRow);if(repeatedColumns.has(colNo))cell.replaceChildren();for(const formula of els(cell,'f')){formula.textContent=copiedFormula(formula.textContent,targetRow-(range.r0+1));for(const attr of ['t','ref','si'])formula.removeAttribute(attr);}}
   next?data.insertBefore(clone,next):data.append(clone);
  }
  if(mergeHost)for(let targetRow=range.r0+2;targetRow<=range.r1+1+amount;targetRow++)for(const ref of prototypeMerges){const nextRef=ref.replace(/\d+/g,String(targetRow));if(els(mergeHost,'mergeCell').some(node=>node.getAttribute('ref')===nextRef))continue;const merge=document.createElementNS(ns,'mergeCell');merge.setAttribute('ref',nextRef);mergeHost.append(merge);}
  if(mergeHost)mergeHost.setAttribute('count',String(els(mergeHost,'mergeCell').length));
  for(const name of names){if(name.hasAttribute('localSheetId')&&name.getAttribute('localSheetId')!==String(index))continue;const parsed=area(name.textContent);if(parsed?.name===source.name)name.textContent=rangeText(source.name,{...parsed,r0:parsed.r0>=insertAt-1?parsed.r0+amount:parsed.r0,r1:parsed.r0>=insertAt-1?parsed.r1+amount:parsed.r1>=insertAt-2?parsed.r1+amount:parsed.r1});}
  return{...range,r1:range.r1+amount};
 }
 function area(value){const m=String(value).match(/^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/);if(!m)return null;const col=s=>[...s].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;return{name:(m[1]||m[2]).replace(/''/g,"'"),r0:+m[4]-1,r1:+m[6]-1,c0:col(m[3]),c1:col(m[5])};}
 function expand(output,template,state){
  const workbook=parse(output['xl/workbook.xml']),relations=parse(output['xl/_rels/workbook.xml.rels']),types=parse(output['[Content_Types].xml']),originalSheets=els(workbook,'sheet'),names=els(workbook,'definedName'),plans=[];
  const quote=s=>"'"+s.replace(/'/g,"''")+"'";
  let nextSheet=Math.max(0,...originalSheets.map(s=>+s.getAttribute('sheetId')))+1;
  const used=new Set(originalSheets.map(s=>s.getAttribute('name').toLowerCase()));
  function contentCopy(from,to){const old=els(types,'Override').find(n=>n.getAttribute('PartName')==='/'+from);if(old){const n=old.cloneNode(true);n.setAttribute('PartName','/'+to);types.documentElement.append(n);}}
  function cloneLinks(from,to){const rp=relpath(from);if(!output[rp])return;const d=parse(output[rp]);for(const r of els(d,'Relationship')){if(r.getAttribute('TargetMode')==='External')continue;const target=resolve(dirname(from),r.getAttribute('Target'));if(/\/drawing$/.test(r.getAttribute('Type'))){let n=1;while(output['xl/drawings/asmach-page-'+n+'.xml'])n++;const dest='xl/drawings/asmach-page-'+n+'.xml';output[dest]=output[target];if(output[relpath(target)])output[relpath(dest)]=output[relpath(target)];r.setAttribute('Target','../drawings/asmach-page-'+n+'.xml');contentCopy(target,dest);}}output[relpath(to)]=xml(d);}
  template.sourceSheets.forEach((source,index)=>{
   const bindings=template.bindings[source.path]||{},definition=names.find(n=>n.getAttribute('name')==='ASMach_List'&&(n.getAttribute('localSheetId')===String(index)||(!n.hasAttribute('localSheetId')&&area(n.textContent)?.name===source.name)));
   if(!definition){plans.push({path:source.path,bindings});return;}
   const range=area(definition.textContent),print=names.find(n=>n.getAttribute('name')==='_xlnm.Print_Area'&&n.getAttribute('localSheetId')===String(index)),printRange=area(print?.textContent);
   if(!range||range.name!==source.name||range.r1<range.r0||range.c1<range.c0||!printRange||range.r0<printRange.r0||range.r1>printRange.r1||range.c0<printRange.c0||range.c1>printRange.c1)throw Error(source.name+': liste alanı tek yazdırma alanının içinde olmalı.');
   if(template.direction!=='rows')throw Error(source.name+': sayfalı liste için satırlar boyunca çoğaltmayı seçin.');
   const repeated=Object.entries(bindings).filter(([,b])=>b.field&&root.ASMachExcelCellTemplate.repeats(b.field));
   const collections=new Set(repeated.map(([,b])=>b.field.split('.')[0]));if(collections.size>1)throw Error(source.name+': aynı listede farklı kayıt koleksiyonları kullanılamaz.');
   for(const [key]of repeated){const [r,c]=key.split(':').map(Number);if(r!==range.r0||c<range.c0||c>range.c1)throw Error(source.name+': tekrarlanan alan kodları liste alanının ilk satırında olmalı.');}
   const count=repeated.length?root.ASMachExcelCellTemplate.recordsFor(repeated[0][1].field,state).length:0,capacity=range.r1-range.r0+1,pages=Math.max(1,Math.ceil(count/capacity));
   if(pages>200)throw Error('Devam sayfası sayısı 200 sınırını aşıyor; liste alanını büyütün.');
   const document=parse(output[source.path]);
   for(const m of els(document,'mergeCell')){const a=area(quote(source.name)+'!'+m.getAttribute('ref'));if(a&&a.r0<=range.r1&&a.r1>=range.r0&&a.c0<=range.c1&&a.c1>=range.c0&&a.r0!==a.r1)throw Error(source.name+': liste alanında dikey birleştirilmiş hücre kullanmayın.');}
   if(pages>1&&['tableParts','pivotTable','oleObjects'].some(n=>els(document,n).length))throw Error(source.name+': devam sayfasında Excel tablosu/pivot/nesne kullanılamıyor; normal hücre aralığı kullanın.');
   if(template.overflowMode==='expandRows'){
    const expanded=insertRows(document,workbook,names,source,index,range,count,bindings);output[source.path]=xml(document);plans.push({path:source.path,bindings,start:0,end:count,range:expanded});return;
   }
   const data=els(document,'sheetData')[0],prototypeRow=els(data,'row').find(r=>+r.getAttribute('r')===range.r0+1),merges=els(document,'mergeCell').map(m=>m.getAttribute('ref'));
   for(let row=range.r0+1;row<=range.r1;row++){
    let target=els(data,'row').find(r=>+r.getAttribute('r')===row+1);if(!target){target=document.createElementNS(ns,'row');target.setAttribute('r',row+1);const next=[...data.children].find(r=>+r.getAttribute('r')>row+1);next?data.insertBefore(target,next):data.append(target);}
    if(prototypeRow)for(const attr of ['ht','customHeight','s','customFormat'])if(!target.hasAttribute(attr)&&prototypeRow.hasAttribute(attr))target.setAttribute(attr,prototypeRow.getAttribute(attr));
    for(const ref of merges){const a=area(quote(source.name)+'!'+ref);if(!a||a.r0!==range.r0||a.r1!==range.r0||a.c0<range.c0||a.c1>range.c1)continue;const newRef=ref.replace(/\d+/g,String(row+1));if(els(document,'mergeCell').some(m=>m.getAttribute('ref')===newRef))continue;const m=document.createElementNS(ns,'mergeCell');m.setAttribute('ref',newRef);els(document,'mergeCells')[0].append(m);}
   }
   const mergeHost=els(document,'mergeCells')[0];if(mergeHost)mergeHost.setAttribute('count',els(mergeHost,'mergeCell').length);output[source.path]=xml(document);
   for(let page=0;page<pages;page++){
    let path=source.path;if(page){let number=nextSheet++;while(output['xl/worksheets/sheet'+number+'.xml'])number=nextSheet++;path='xl/worksheets/sheet'+number+'.xml';let name=source.name.slice(0,24)+' ('+(page+1)+')',suffix=2;while(used.has(name.toLowerCase()))name=source.name.slice(0,20)+' ('+(page+1)+'-'+suffix+++')';used.add(name.toLowerCase());
     const copy=document.cloneNode(true);for(const f of els(copy,'f'))f.textContent=f.textContent.split(quote(source.name)+'!').join(quote(name)+'!');output[path]=xml(copy);cloneLinks(source.path,path);contentCopy(source.path,path);
     let id=1;while(els(relations,'Relationship').some(r=>r.getAttribute('Id')==='rId'+id))id++;const r=relations.createElementNS(rel,'Relationship');r.setAttribute('Id','rId'+id);r.setAttribute('Type',office+'/worksheet');r.setAttribute('Target',path.slice(3));relations.documentElement.append(r);
     const sheet=originalSheets[index].cloneNode(true);sheet.setAttribute('name',name);sheet.setAttribute('sheetId',number);sheet.setAttributeNS(office,'r:id','rId'+id);const localIndex=els(workbook,'sheet').length;originalSheets[index].parentElement.append(sheet);
     for(const n of names.filter(n=>n.getAttribute('localSheetId')===String(index))){const copy=n.cloneNode(true);copy.setAttribute('localSheetId',localIndex);copy.textContent=copy.textContent.split(quote(source.name)+'!').join(quote(name)+'!').replace(new RegExp('^'+source.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'!'),quote(name)+'!');n.parentElement.append(copy);}
    }
    plans.push({path,bindings,start:page*capacity,end:(page+1)*capacity,range});
   }
  });
  let calc=els(workbook,'calcPr')[0];if(calc){calc.setAttribute('fullCalcOnLoad','1');calc.setAttribute('forceFullCalc','1');}
  output['xl/workbook.xml']=xml(workbook);output['xl/_rels/workbook.xml.rels']=xml(relations);output['[Content_Types].xml']=xml(types);return plans;
 }
 root.ASMachExcelTemplatePages={expand,area};
})(window);
