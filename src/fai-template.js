/* Fills the user's FAI-FORM.xlsx package in-place, retaining its styles, logos and field layout. */
(function(root){
 'use strict';
 const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const binary=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
 const text=v=>String(v??'');
 function setCell(sheet,ref,value,{formula,style}={}){
  const re=new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*?(?:/>|>[\\s\\S]*?</c>)'),old=sheet.match(re)?.[0];
  if(!old)throw new Error('FAI şablon hücresi bulunamadı: '+ref);
  const s=style??old.match(/\bs="(\d+)"/)?.[1]??0,numeric=typeof value==='number'&&Number.isFinite(value);
  const content=formula?`<f>${xml(formula)}</f><v>${xml(value)}</v>`:numeric?`<v>${value}</v>`:`<is><t xml:space="preserve">${xml(value)}</t></is>`;
  return sheet.replace(re,()=>`<c r="${ref}" s="${s}"${formula?' t="str"':numeric?'':' t="inlineStr"'}>${content}</c>`);
 }
 function setHeight(sheet,row,height){return sheet.replace(new RegExp('<row\\b([^>]*\\br="'+row+'"[^>]*)>'),(_,attrs)=>'<row'+attrs.replace(/\sht="[^"]*"/,'').replace(/\scustomHeight="[^"]*"/,'')+` ht="${height}" customHeight="1">`);}
 function cropPrint(sheet,last,col){
  sheet=sheet.replace(/<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g,(s,r)=>+r>last?'':s);
  sheet=sheet.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{const entries=[...body.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].filter(m=>Number(m[1].split(':').pop().match(/\d+/)[0])<=last);return `<mergeCells count="${entries.length}">${entries.map(m=>m[0]).join('')}</mergeCells>`;});
  sheet=sheet.replace(/<dimension ref="[^"]*"\/>/,`<dimension ref="A1:${col}${last}"/>`);
  if(!sheet.includes('<sheetPr'))sheet=sheet.replace(/(<worksheet\b[^>]*>)/,'$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  sheet=sheet.replace(/<pageSetup\b([^>]*)\/>/,(_,a)=>'<pageSetup'+a.replace(/\s(?:scale|fitToWidth|fitToHeight)="[^"]*"/g,'')+' fitToWidth="1" fitToHeight="1"/>');
  return sheet;
 }
 function numeric(v){return v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):v??'';}
 function requirement(i){
  if(i.requirement)return i.requirement;
  return [i.nominalValue,i.unit,[i.upperTolerance,i.lowerTolerance].some(v=>v!==''&&v!=null)?`(${i.upperTolerance??''}/${i.lowerTolerance??''})`:''].filter(v=>v!==''&&v!=null).join(' ');
 }
 function imageInfo(item,enabled){
  if(item.type==='GD&T')item={...item,snapshot:root.ASMachGdtReport?.image(item)||''};
  if(!enabled||item.type!=='GD&T'||!/^data:image\/png;base64,/.test(item.snapshot||''))return null;
  const bytes=binary(item.snapshot.split(',')[1]);if(bytes.length<24||bytes[0]!==137||bytes[1]!==80)return null;
  const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);if(!w||!h)return null;
  const ratio=Math.min(108/w,16/h);return {bytes,w:w*ratio,h:h*ratio};
 }
 function values(item,m,pic){return [text(item.number),[m.drawingNo,item.page?`S${item.page}`:'',item.zone].filter(Boolean).join(' / '),item.type==='GD&T'?'':item.specialDesignator||'',pic?'':requirement(item),numeric(item.result),item.toolingReference||root.ASMachReportBrand?.text(item.inspectionMethod)||item.inspectionMethod||'',item.nonconformanceNo||'',[item.comment,item.inspectionFrequencyLabel||''].filter(Boolean).join('\n')];}
 function paginate(records,m,images){
  const pages=[];let page=[],height=0;
  for(const item of records){const pic=imageInfo(item,images),v=values(item,m,pic),widths=[9,10,11,16,14,12,14,38];
   const lines=Math.max(...v.map((s,i)=>text(s).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/widths[i])),0)));
   const h=Math.max(27,pic?Math.ceil((pic.h+8)*.75):0,lines*11+6);
   if(h>325)throw new Error(`Karakteristik ${item.number}: metin bir form sayfasına sığmıyor. Açıklamayı kısaltın.`);
   if(page.length&&(height+h>325||page.length===31)){pages.push(page);page=[];height=0;}
   page.push({item,pic,values:v,height:h});height+=h;
  }
  if(page.length||!pages.length)pages.push(page);return pages;
 }
 function addPicture(out,sheetId,row,pic,number){
  const draw=`xl/drawings/drawing${sheetId}.xml`,relations=`xl/drawings/_rels/drawing${sheetId}.xml.rels`,name=`fai-snapshot-${sheetId}-${row}.png`,rid=`rIdSnapshot${row}`,id=sheetId*1000+100+row;
  out[`xl/media/${name}`]=pic.bytes;
  out[relations]=out[relations].replace('</Relationships>',`<Relationship Id="${rid}" Type="${rel}image" Target="../media/${name}"/></Relationships>`);
  const w=Math.round(pic.w*9525),h=Math.round(pic.h*9525);
  out[draw]=out[draw].replace('</xdr:wsDr>',`<xdr:oneCellAnchor><xdr:from><xdr:col>6</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${row-1}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="${w}" cy="${h}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="Karakteristik ${xml(number)} snapshot"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="${rel.slice(0,-1)}" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`);
 }
 function files(state,options={}){
  for(const r of state.annotations||[]){const errors=root.ASMachRequirements?.consistencyErrors?.(r)||[];if(errors.length)throw new Error(`#${r.number}: ${errors.join(' ')}`);}
  if(!root.ASMachFaiTemplateAssets)throw new Error('FAI-FORM şablonu bu sürüme gömülü değil. Güncel HTML dosyasını açın.');
  const out=Object.fromEntries(Object.entries(root.ASMachFaiTemplateAssets).map(([k,v])=>[k,v.text??binary(v.base64)]));
  const m={...(state.metadata||{}),...(state.metadata?.fai||{}),...(options.metadata||{})};
  const records=[...(state.annotations||[])].map(r=>({...r,comment:[r.comment,root.ASMachProduction?.description(state,r)].filter(Boolean).join('\n')})).sort(root.ASMachNumberOrder.records);
  const production=root.ASMachProduction?.data(state),parts=m.partType==='Assembly'?production?.components||[]:[];
  const pages=paginate(records,m,options.includeSnapshots!==false),print=[];
  const styleCache=new Map();
  function entryStyle(sheet,ref){
   const old=sheet.match(new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*'))?.[0].match(/\bs="(\d+)"/)?.[1]||'0';
   if(styleCache.has(old))return styleCache.get(old);
   const block=out['xl/styles.xml'].match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/),entries=[...block[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>m[0]);
   let xf=entries[+old].replace(/\sapplyAlignment="[^"]*"/,'');if(xf.endsWith('/>'))xf=xf.slice(0,-2)+'></xf>';
   xf=xf.replace(/<alignment\b[^>]*\/>/,'').replace(/<xf\b/,'<xf applyAlignment="1"').replace('</xf>','<alignment vertical="center" horizontal="center" wrapText="1"/></xf>');
   const id=entries.length;out['xl/styles.xml']=out['xl/styles.xml'].replace(block[0],`<cellXfs count="${id+1}">${block[1]}${xf}</cellXfs>`);styleCache.set(old,id);return id;
  }
  let s=out['xl/worksheets/sheet1.xml'];
  const fields={A4:'partNo',E4:'partName',J4:'serialNumber',N4:'fairIdentifier',A8:'partRevision',E8:'drawingNo',J8:'drawingRevision',N8:'additionalChanges',A12:'manufacturingReference',E12:'organizationName',J12:'supplierCode',N12:'purchaseOrder',E17:'reason',A33:'verifiedBy',N33:'verifiedDate',A36:'approvedBy',N36:'approvedDate',A39:'customerApproval',N39:'customerDate',A42:'comments'};
  for(const [ref,key] of Object.entries(fields))s=setCell(s,ref,m[key]??'');
  // These input cells are deliberately blank when the project has no declaration.
  s=setCell(s,'A16',m.partType==='Detail'?'Detay / Detail':m.partType==='Assembly'?'Montaj / Assembly':'');
  s=setCell(s,'I14',m.faiType==='Full FAI'?'X':'');s=setCell(s,'I15',m.faiType==='Partial FAI'?'X':'');
  s=setCell(s,'N14',m.baseline??'',m.baseline?{}:{formula:'IF(A4="","",CONCATENATE(A4,"/",A8))'});
  if(!m.baseline)s=setCell(s,'N14',m.partNo?`${m.partNo}/${m.partRevision||''}`:'',{formula:'IF(A4="","",CONCATENATE(A4,"/",A8))'});
  if(m.documentedNonconformance)s=setCell(s,'A30',`19. FAIR belgelenmiş uygunsuzluk içeriyor mu? / Does FAIR contain a Documented Nonconformance(s)?\n${m.documentedNonconformance}`);
  function assembly(sheet,page){for(let k=0;k<6;k++){const r=parts[page*6+k];for(const [j,col] of ['A','E','J','N'].entries())sheet=setCell(sheet,col+(24+k),r?[r.partNo,r.name,r.partType==='Assembly'?'Assembly':'Detail',r.fairIdentifier||''][j]:'');}return sheet;}
  if(m.partType!=='Detail')s=assembly(s,0);
  out['xl/worksheets/sheet1.xml']=cropPrint(s,47,'Q');print.push({name:'Form 1',col:'Q',last:47});
  const original2=out['xl/worksheets/sheet2.xml'],original3=out['xl/worksheets/sheet3.xml'];
  const common=(sheet,form)=>{const refs=form===3?['A4','I4','O4','S4']:['A4','E4','J4','N4'];for(let i=0;i<4;i++){const source=['A4','E4','J4','N4'][i],key=['partNo','partName','serialNumber','fairIdentifier'][i];sheet=setCell(sheet,refs[i],m[key]??'',{formula:`IF('Form 1'!${source}="","",'Form 1'!${source})`});}return sheet;};
  let nextId=4;
  function clone(base,name){const id=nextId++,p=`xl/worksheets/sheet${id}.xml`;
   out[p]=base===1?out['xl/worksheets/sheet1.xml']:base===2?original2:original3;
   out[`xl/worksheets/_rels/sheet${id}.xml.rels`]=out[`xl/worksheets/_rels/sheet${base}.xml.rels`].replace(`drawing${base}.xml`,`drawing${id}.xml`);
   out[`xl/drawings/drawing${id}.xml`]=root.ASMachFaiTemplateAssets[`xl/drawings/drawing${base}.xml`].text;
   out[`xl/drawings/_rels/drawing${id}.xml.rels`]=root.ASMachFaiTemplateAssets[`xl/drawings/_rels/drawing${base}.xml.rels`].text;
   out['xl/workbook.xml']=out['xl/workbook.xml'].replace('</sheets>',`<sheet name="${name}" sheetId="${id}" r:id="rIdFai${id}"/></sheets>`);
   out['xl/_rels/workbook.xml.rels']=out['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="rIdFai${id}" Type="${rel}worksheet" Target="worksheets/sheet${id}.xml"/></Relationships>`);
   out['[Content_Types].xml']=out['[Content_Types].xml'].replace('</Types>',`<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);return id;
  }
  // Material/process rows in the supplied form are three Excel rows high: 8–40.
  const f2=root.ASMachProduction?.form2(state)||{materials:[],tests:[]},materials=[...f2.materials,...records.filter(i=>['Malzeme','Proses'].includes(i.type))],tests=f2.tests,materialPages=Math.max(1,Math.ceil(materials.length/11),Math.ceil(tests.length/6));
  function fillForm2(sheet,page){sheet=common(sheet,2);materials.slice(page*11,page*11+11).forEach((r,k)=>{const values=root.ASMachProduction?.materialValues(r)||[requirement(r),'','','','',''];['A','E','H','J','N','P'].forEach((c,j)=>sheet=setCell(sheet,c+(8+3*k),values[j]||''));});tests.slice(page*6,page*6+6).forEach((r,k)=>{sheet=setCell(sheet,'A'+(43+2*k),[r.specification,r.revision].filter(Boolean).join(' / '));sheet=setCell(sheet,'H'+(43+2*k),r.reportNo||'');});return setCell(sheet,'A57',m.productComments??'');}
  s=fillForm2(original2,0);
  out['xl/worksheets/sheet2.xml']=cropPrint(s,65,'Q');print.push({name:'Form 2',col:'Q',last:65});
  pages.forEach((page,index)=>{
   const name=index?`Form 3 (${index+1})`:'Form 3',id=index?clone(3,name):3;let sheet=common(original3,3);
   page.forEach((entry,k)=>{const row=8+k;for(const [c,j] of ['A','C','E','G','I','K','M','O'].map((c,j)=>[c,j]))sheet=setCell(sheet,c+row,entry.values[j],{style:entryStyle(sheet,c+row)});sheet=setHeight(sheet,row,entry.height);if(entry.pic)addPicture(out,id,row,entry.pic,entry.item.number);});
   const last=Math.max(8,7+page.length);sheet=cropPrint(sheet,last,'U');
   sheet=sheet.replace(/<oddFooter>([\s\S]*?)<\/oddFooter>/,(_,original)=>`<oddFooter>${original}&amp;LForm 3 — ${index+1} / ${pages.length}</oddFooter>`);
   out[`xl/worksheets/sheet${id}.xml`]=sheet;print.push({name,col:'U',last});
  });
  for(let page=1;page<materialPages;page++){const name=`Form 2 (${page+1})`,id=clone(2,name);out[`xl/worksheets/sheet${id}.xml`]=cropPrint(fillForm2(original2,page),65,'Q');print.push({name,col:'Q',last:65});}
  for(let page=1;page<Math.ceil(parts.length/6);page++){const name=`Form 1 (${page+1})`,id=clone(1,name);out[`xl/worksheets/sheet${id}.xml`]=assembly(out['xl/worksheets/sheet1.xml'],page);print.push({name,col:'Q',last:47});}
  // The calc chain is obsolete after writing; Excel recalculates the preserved links on open.
  delete out['xl/calcChain.xml'];out['xl/_rels/workbook.xml.rels']=out['xl/_rels/workbook.xml.rels'].replace(/<Relationship\b[^>]*Type="[^"]*\/calcChain"[^>]*\/>/g,'');
  out['[Content_Types].xml']=out['[Content_Types].xml'].replace(/<Override\b[^>]*PartName="\/xl\/calcChain.xml"[^>]*\/>/g,'');
  out['xl/workbook.xml']=out['xl/workbook.xml'].replace(/<definedNames>[\s\S]*?<\/definedNames>/,'').replace('</sheets>','</sheets><definedNames>'+print.map((p,i)=>`<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(p.name)}'!$A$1:$${p.col}$${p.last}</definedName>`).join('')+'</definedNames>').replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>');
  // Unique object IDs also let non-Excel viewers retain every repeated template logo.
  for(const [path,data] of Object.entries(out)){const id=path.match(/^xl\/drawings\/drawing(\d+)\.xml$/)?.[1];if(id)out[path]=data.replace(/<xdr:cNvPr id="2"/,`<xdr:cNvPr id="${+id*1000+2}"`);}
  if(root.ASMachReportBrand){root.ASMachReportBrand.templateFiles(out);const brand=root.ASMachReportBrand.picture(root.ASMachReportBrand.logo(),0,0);if(brand)for(const name of Object.keys(out))if(/^xl\/media\/image\d+\.png$/.test(name))out[name]=brand.bytes;}
  return out;
 }
 root.ASMachFaiTemplate={files,paginate,setCell};
})(window);
