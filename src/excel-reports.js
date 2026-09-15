/* AS9102C field numbering checked against IAQG's January 2024 Forms 1–3.
   Reference: https://iaqg.org/standards/forms/ . Unknown approvals stay blank. */
(function(root){
  'use strict';
  const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const col=n=>{let s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);return s;};
  const cellRef=(r,c)=>col(c)+(r+1);
  const asNumber=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):v??'';
  function sheet(name,n,landscape=false){return{name,n,landscape,cells:[],images:[],heights:{},breaks:[],lastRow:0,colWidth:3.4};}
  function put(s,r,c,cs,rs,value='',style=0){s.cells.push({r,c,cs,rs,value,style});s.lastRow=Math.max(s.lastRow,r+rs);}
  function field(s,r,c,cs,number,label,value='',rs=2){put(s,r,c,cs,rs,`${number}. ${label}\n${value??''}`,0);}
  function heading(s,title,page=1,total=1,offset=0){put(s,offset,0,s.n,1,title,1);put(s,offset+1,0,s.n,1,`AS9102C     Sheet ${page} of ${total}`,3);put(s,offset+2,0,s.n,1,'',3);s.heights[offset]=24;s.heights[offset+2]=8;}
  function common(s,m,r=3){const n=s.n/4;[['Part Number',m.partNo],['Part Name',m.partName],['Serial Number',m.serialNumber],['FAIR Identifier',m.fairIdentifier]].forEach(([label,value],i)=>field(s,r,i*n,n,i+1,label,value));}
  function image(s,item,r,c,cs,height=80){
    if(item.type!=='GD&T')return false;item={...item,snapshot:root.ASMachGdtReport?.image(item)||''};height=Math.min(height,16);
    if(!/^data:image\/png;base64,/.test(item.snapshot||''))return false;
    const raw=atob(item.snapshot.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    if(bytes.length<24||bytes[0]!==137||bytes[1]!==80)return false;
    const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);if(!w||!h)return false;
    const maxWidth=cs*(s.colWidth*7+5)-10,ratio=Math.min(maxWidth/w,height/h);
    s.images.push({r,c,bytes,dataUrl:item.snapshot,width:w*ratio,height:h*ratio,name:`GD&T ${item.number}`});return true;
  }
  function build(state,options={}){
    for(const r of state.annotations||[]){const errors=root.ASMachRequirements?.consistencyErrors?.(r)||[];if(errors.length)throw new Error(`#${r.number}: ${errors.join(' ')}`);}
    const m={...(state.metadata||{}),...((state.metadata||{}).fai||{}),...(options.metadata||{})};
    const records=[...(state.annotations||[])].map(r=>({...r,comment:[r.comment,root.ASMachProduction?.description(state,r)].filter(Boolean).join('\n')})).sort(root.ASMachNumberOrder.records);
    const mode=options.mode||'as9102c',sheets=[];
    if(mode==='as9102c'){
      const s=sheet('Form 1',24);sheets.push(s);heading(s,'FORM 1 – PART NUMBER ACCOUNTABILITY');common(s,m);
      [['Part Revision Level',m.partRevision],['Drawing Number',m.drawingNo],['Drawing Revision Level',m.drawingRevision],['Additional Changes',m.additionalChanges]].forEach(([l,v],i)=>field(s,5,i*6,6,i+5,l,v));
      [['Manufacturing Process Reference',m.manufacturingReference],['Organization Name',m.organizationName],['Supplier Code',m.supplierCode],['Purchase Order Number',m.purchaseOrder]].forEach(([l,v],i)=>field(s,7,i*6,6,i+9,l,v));
      field(s,9,0,6,13,'Detail / Assembly',m.partType,4);
      field(s,9,6,18,14,'Full FAI / Partial FAI',`${m.faiType||''}\nBaseline Part Number (including revision level): ${m.baseline||''}\nReason for Full / Partial FAI: ${m.reason||''}`,4);
      put(s,13,0,24,1,'Detail part: continue at field 19. Assembly: complete the INDEX below.',3);
      put(s,14,0,24,1,'INDEX of part numbers or sub-assembly numbers',2);
      ['15. Part Number','16. Part Name','17. Part Type','18. FAIR Identifier'].forEach((v,i)=>put(s,15,i*6,6,1,v,2));
      const parts=m.partType==='Assembly'?root.ASMachProduction?.data(state).components||[]:[],count=Math.max(7,parts.length),shift=count-7;
      for(let k=0;k<count;k++){const r=16+k,p=parts[k];s.heights[r]=23;[p?.partNo,p?.name,p?.partType,p?.fairIdentifier].forEach((v,i)=>put(s,r,i*6,6,1,v||''));}
      field(s,23+shift,0,24,19,'Does FAIR Contain a Documented Nonconformance(s)?  Yes / No',m.documentedNonconformance);
      for(const [r,n,label,key,dateKey] of [[25,20,'FAIR Verified By','verifiedBy','verifiedDate'],[27,22,'FAIR Reviewed/Approved By','approvedBy','approvedDate'],[29,24,'Customer Approval','customerApproval','customerDate']]){field(s,r+shift,0,18,n,label,m[key]);field(s,r+shift,18,6,n+1,'Date',m[dateKey]);}
      field(s,31+shift,0,24,26,'Comments',m.comments,3);
    }
    if(mode==='as9102c'){
      const s=sheet('Form 2',24);sheets.push(s);heading(s,'FORM 2 – PRODUCT ACCOUNTABILITY');common(s,m);
      put(s,5,0,24,1,'',3);s.heights[5]=8;
      const spans=[5,4,3,4,4,4],labels=['5. Material or Process Name','6. Specification Number','7. Code','8. Supplier','9. Customer Approval Verification','10. Certificate of Conformance Number'];
      let c=0;labels.forEach((v,i)=>{put(s,6,c,spans[i],2,v,2);c+=spans[i];});
      const f2=root.ASMachProduction?.form2(state)||{materials:[],tests:[]},materials=[...f2.materials,...records.filter(i=>['Malzeme','Proses'].includes(i.type))];
      for(let k=0;k<Math.max(10,materials.length);k++){const r=8+k,item=materials[k];s.heights[r]=30;c=0;(item?(root.ASMachProduction?.materialValues(item)||[item.requirement||'','','','','','']):Array(6).fill('')).forEach((v,i)=>{put(s,r,c,spans[i],1,v);c+=spans[i];});}
      const r=8+Math.max(10,materials.length);put(s,r,0,12,2,'11. Functional Test Procedure Number',2);put(s,r,12,12,2,'12. Acceptance Report Number',2);
      for(let k=0;k<Math.max(4,f2.tests.length);k++){const t=f2.tests[k];put(s,r+2+k,0,12,1,t?[t.specification,t.revision].filter(Boolean).join(' / '):'');put(s,r+2+k,12,12,1,t?.reportNo||'');}
      field(s,r+2+Math.max(4,f2.tests.length),0,24,13,'Comments',m.productComments,3);
    }
    if(mode==='as9102c'||mode==='form3'){
      const s=sheet('Form 3',32,true);sheets.push(s);const pageSize=6,pages=Math.max(1,Math.ceil(records.length/pageSize));
      const spans=[2,3,3,8,4,4,3,5],labels=['5. Char. No.','6. Reference Location','7. Characteristic Designator','8. Requirement','9. Results','10. Designed / Qualified Tooling','11. Nonconformance Number','12. Additional Data / Comments'];
      for(let page=0;page<pages;page++){
        const offset=page*15;heading(s,'FORM 3 – CHARACTERISTIC ACCOUNTABILITY, VERIFICATION AND COMPATIBILITY EVALUATION',page+1,pages,offset);common(s,m,offset+3);
        put(s,offset+5,0,16,1,'Characteristic Accountability',2);put(s,offset+5,16,11,1,'Inspection / Test Results',2);put(s,offset+5,27,5,1,'',2);
        let c=0;labels.forEach((v,i)=>{put(s,offset+6,c,spans[i],1,v,2);c+=spans[i];});s.heights[offset+6]=62;
        for(let k=0;k<pageSize;k++){
          const item=records[page*pageSize+k],r=offset+7+k;s.heights[r]=44;
          const pic=item&&item.type==='GD&T'&&image(s,item,r,8,8,48);
          const values=item?[String(item.number),[m.drawingNo,item.page?`Sheet ${item.page}`:'',item.zone].filter(Boolean).join(' / '),item.type==='GD&T'?'':item.specialDesignator||'',pic?'':item.requirement,asNumber(item.result),item.toolingReference||'',item.nonconformanceNo||'',item.comment||'']:Array(8).fill('');
          c=0;values.forEach((v,i)=>{put(s,r,c,spans[i],1,v);c+=spans[i];});
        }
        put(s,offset+13,0,32,1,'AS9102C · Form 3 · January 2024 field layout',3);
        put(s,offset+14,0,32,1,'',3);s.heights[offset+14]=8;
        if(page<pages-1)s.breaks.push(offset+15);
      }
    } else {
      const gdt=mode==='gdt',list=gdt?records.filter(i=>i.type==='GD&T'):records,s=sheet(gdt?'GDT Görselleri':'Ölçüm Raporu',36,true);sheets.push(s);
      put(s,0,0,36,1,gdt?'GD&T görsel kontrol raporu':'Ölçüm kontrol raporu',1);s.heights[0]=24;
      put(s,1,0,36,1,`${m.partNo||''}   ${m.drawingNo||state.fileName||''}   Rev: ${m.drawingRevision||''}`,3);
      const spans=[2,3,3,7,3,3,3,3,4,5],labels=['Balon','Sayfa / Zon','Tür','Gereklilik','Nominal','Alt tol.','Üst tol.','Sonuç','Yöntem','Üretilen GD&T'];
      let c=0;labels.forEach((v,i)=>{put(s,3,c,spans[i],1,v,2);c+=spans[i];});s.heights[3]=30;s.freeze=4;
      list.forEach((item,i)=>{const r=i+4;s.heights[r]=74;c=0;const values=[String(item.number),`${item.page||''} / ${item.zone||''}`,item.type,item.requirement,asNumber(item.nominalValue),asNumber(item.lowerTolerance),asNumber(item.upperTolerance),asNumber(item.result),item.rolePlans?Object.entries(item.rolePlans).filter(([,p])=>p.enabled).map(([role,p])=>`${root.ASMachRolePlans?.roles[role]||role}: ${p.inspectionMethod}`).join(' / '):item.inspectionMethod||'',''];values.forEach((v,j)=>{put(s,r,c,spans[j],1,v);c+=spans[j];});image(s,item,r,31,5,88);});
    }
    const model={sheets,mode};return root.ASMachReportBrand?.decorate(model)||model;
  }
  const styles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  function files(model){
    root.ASMachReportBrand?.decorate(model);
    const ns='http://schemas.openxmlformats.org/',rel=ns+'officeDocument/2006/relationships/',main=ns+'spreadsheetml/2006/main',relation=body=>`<Relationships xmlns="${ns}package/2006/relationships">${body}</Relationships>`;
    const out={'_rels/.rels':relation(`<Relationship Id="rId1" Type="${rel}officeDocument" Target="xl/workbook.xml"/>`),'xl/styles.xml':styles.replace('<cellXfs count="4">','<cellXfs count="5">').replace('<xf numFmtId="0" fontId="0" fillId="0" borderId="1"','<xf numFmtId="0" fontId="0" fillId="0" borderId="0"').replace('</cellXfs>','<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>')};
    let types=`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`;
    out['xl/workbook.xml']=`<workbook xmlns="${main}" xmlns:r="${rel.slice(0,-1)}"><bookViews><workbookView/></bookViews><sheets>${model.sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${model.sheets.map((s,i)=>`<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(s.name.replace(/'/g,"''"))}'!$A$1:$${col(s.n-1)}$${s.lastRow}</definedName>`).join('')}${model.sheets.map((s,i)=>s.printTitles?`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xml(s.name.replace(/'/g,"''"))}'!${s.printTitles}</definedName>`:'').join('')}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
    out['xl/_rels/workbook.xml.rels']=relation(model.sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${rel}worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rIdStyles" Type="${rel}styles" Target="styles.xml"/>`);
    model.sheets.forEach((s,index)=>{
      const id=index+1,rows=new Map(),merges=[];
      for(const cell of s.cells){
        if(cell.cs>1||cell.rs>1)merges.push(`${cellRef(cell.r,cell.c)}:${cellRef(cell.r+cell.rs-1,cell.c+cell.cs-1)}`);
        for(let r=cell.r;r<cell.r+cell.rs;r++)for(let c=cell.c;c<cell.c+cell.cs;c++){
          const first=r===cell.r&&c===cell.c,v=first?cell.value:'',numeric=typeof v==='number'&&Number.isFinite(v),formula=v&&typeof v==='object'&&typeof v.formula==='string';
          const entry=`<c r="${cellRef(r,c)}" s="${cell.style===0?4:cell.style}"${formula?(typeof v.value==='number'?'':' t="str"'):numeric?'':' t="inlineStr"'}>${formula?`<f>${xml(v.formula)}</f><v>${xml(v.value??'')}</v>`:numeric?`<v>${v}</v>`:`<is><t xml:space="preserve">${xml(v)}</t></is>`}</c>`;
          if(!rows.has(r))rows.set(r,[]);rows.get(r).push({c,entry});
        }
      }
      const picturePart=s.images.length?`<drawing r:id="rIdSnapshot"/>`:'';
      out[`xl/worksheets/sheet${id}.xml`]=`<worksheet xmlns="${main}" xmlns:r="${rel.slice(0,-1)}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${cellRef(s.lastRow-1,s.n-1)}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${s.freeze?`<pane ySplit="${s.freeze}" topLeftCell="A${s.freeze+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${s.widths?s.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join(""):`<col min="1" max="${s.n}" width="${s.colWidth}" customWidth="1"/>`}</cols><sheetData>${[...rows].sort((a,b)=>a[0]-b[0]).map(([r,cells])=>`<row r="${r+1}" ht="${s.heights[r]||18}" customHeight="1">${cells.sort((a,b)=>a.c-b.c).map(c=>c.entry).join('')}</row>`).join('')}</sheetData>${merges.length?`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.55" header="0.1" footer="0.2"/><pageSetup paperSize="${s.paperSize||1}" orientation="${s.landscape?'landscape':'portrait'}" fitToWidth="1" fitToHeight="${s.breaks.length||s.freeze?'0':'1'}"/>${s.footer?`<headerFooter><oddFooter>&amp;L${xml(s.footer)}&amp;RPage / Sayfa &amp;P / &amp;N</oddFooter></headerFooter>`:''}${s.breaks.length?`<rowBreaks count="${s.breaks.length}" manualBreakCount="${s.breaks.length}">${s.breaks.map(n=>`<brk id="${n}" max="16383" man="1"/>`).join('')}</rowBreaks>`:''}${picturePart}</worksheet>`;
      types+=`<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
      if(s.images.length){
        types+=`<Override PartName="/xl/drawings/drawing${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
        out[`xl/worksheets/_rels/sheet${id}.xml.rels`]=relation(`<Relationship Id="rIdSnapshot" Type="${rel}drawing" Target="../drawings/drawing${id}.xml"/>`);
        out[`xl/drawings/_rels/drawing${id}.xml.rels`]=relation(s.images.map((p,i)=>`<Relationship Id="rId${i+1}" Type="${rel}image" Target="../media/s${id}image${i+1}.png"/>`).join(''));
        out[`xl/drawings/drawing${id}.xml`]=`<xdr:wsDr xmlns:xdr="${ns}drawingml/2006/spreadsheetDrawing" xmlns:a="${ns}drawingml/2006/main" xmlns:r="${rel.slice(0,-1)}">${s.images.map((p,i)=>{
          out[`xl/media/s${id}image${i+1}.png`]=p.bytes;const cx=Math.round(p.width*9525),cy=Math.round(p.height*9525);
          return `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.c}</xdr:col><xdr:colOff>47625</xdr:colOff><xdr:row>${p.r}</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="${xml(p.name)}" descr="${xml(p.name)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
        }).join('')}</xdr:wsDr>`;
      }
    });
    out['[Content_Types].xml']=`<Types xmlns="${ns}package/2006/content-types">${types}</Types>`;return out;
  }
  function open(app){
    if(!app.state.annotations.length)return app.toast('Önce karakteristik ekleyin.',true);
    const modal=document.createElement('div');modal.className='wf-dialog open';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const saved=app.state.metadata.fai||{},fields=[['partName','Parça adı'],['serialNumber','Seri numarası'],['fairIdentifier','FAIR numarası'],['organizationName','Kuruluş adı'],['supplierCode','Tedarikçi kodu'],['purchaseOrder','Sipariş numarası'],['manufacturingReference','Üretim proses referansı'],['additionalChanges','Ek değişiklikler'],['baseline','Temel parça / revizyon'],['reason','Tam / kısmi FAI gerekçesi']];
    modal.innerHTML=`<div class="wf-card" style="max-width:760px"><div class="wf-head"><b>Excel raporu</b><button class="btn" data-close>Kapat</button></div><div class="wf-body"><div class="wf-tools"><label>Rapor türü<select data-mode><option value="as9102c">AS9102 Rev C — Form 1, 2 ve 3</option><option value="form3">AS9102 Rev C — Yalnız Form 3</option><option value="inspection">Genel ölçüm kontrol raporu</option><option value="gdt">GD&T görsel raporu</option></select></label><label><span>Görseller</span><span><input data-images type="checkbox" checked disabled> Oluşturulan GD&amp;T çerçeveleri</span></label></div><details open><summary>FAI ortak bilgileri</summary><div class="wf-tools" style="margin-top:12px">${fields.map(([key,label])=>`<label style="flex:1 1 210px">${label}<input data-field="${key}" value="${xml(saved[key]||'')}"></label>`).join('')}<label>Parça türü<select data-field="partType"><option value="">Seçilmedi</option><option>Detail</option><option>Assembly</option></select></label><label>FAI kapsamı<select data-field="faiType"><option value="">Seçilmedi</option><option>Full FAI</option><option>Partial FAI</option></select></label></div></details><p class="wf-note">Form 1–2’de bilinmeyen sertifika, onay, tarih ve imza alanları boş kalır; Excel’de tamamlayın. Kontrol yöntemi, nitelendirilmiş takım numarası yerine yazılmaz.</p><p class="wf-note">Resmî alan adları ve numaraları IAQG 9102C formlarına göre düzenlenmiştir. Standardın lisanslı nüshası ve müşteri şartları ayrıca gereklidir. <a href="https://iaqg.org/standards/forms/" target="_blank" rel="noopener">Resmî formlar</a></p></div><div class="wf-foot"><span data-status class="wf-note"></span><button class="btn primary" data-export>Excel oluştur ve kaydet</button></div></div>`;
    const modeSelect=modal.querySelector('[data-mode]');
    if(root.ASMachFaiTemplateAssets){modeSelect.insertAdjacentHTML('afterbegin','<option value="fai-template">FAI-FORM — Şablonunuz (Form 1, 2 ve 3)</option>');modeSelect.value='fai-template';}
    const templateNote=document.createElement('p');templateNote.className='wf-note';templateNote.textContent='FAI-FORM: Paylaştığınız şablonun alanları korunur; Şenyüz Makine logosu kullanılır. Karakteristikler Form 3’e, GD&T görselleri Gereksinim alanına yazılır. Uzun listelerde devam sayfaları eklenir. Kontrol Ekipmanı alanına takım referansı; yoksa seçtiğiniz kontrol yöntemi yazılır.';templateNote.hidden=modeSelect.value!=='fai-template';modal.querySelector('.wf-body').append(templateNote);modeSelect.onchange=()=>{templateNote.hidden=modeSelect.value!=='fai-template';};
    document.body.append(modal);for(const key of ['partType','faiType'])modal.querySelector(`[data-field="${key}"]`).value=saved[key]||'';
    const close=()=>modal.remove();modal.querySelector('[data-close]').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};modal.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape')close();};
    modal.querySelector('[data-export]').onclick=async()=>{
      const button=modal.querySelector('[data-export]');button.disabled=true;
      try{
        const metadata={};modal.querySelectorAll('[data-field]').forEach(input=>metadata[input.dataset.field]=input.value.trim());
        app.state.metadata.fai={...saved,...metadata};app.recordChange('FAI rapor bilgileri güncellendi');
        const mode=modal.querySelector('[data-mode]').value,reportState={...app.state,annotations:app.state.annotations.map(item=>({...item,inspectionMethod:app.methodLabel?.(item.inspectionMethod)||item.inspectionMethod}))},options={mode,metadata,includeSnapshots:modal.querySelector('[data-images]').checked};
        const output=mode==='fai-template'?root.ASMachFaiTemplate.files(reportState,options):files(build(reportState,options));
        await app.saveBlob(root.ASMachWorkflow.zipStored(output),`${app.baseName(app.state.fileName)}_${mode==='fai-template'?'FAI-FORM':mode==='as9102c'?'AS9102C_Form1-2-3':mode}.xlsx`,'Excel raporu',{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']});
        close();
      }catch(error){modal.querySelector('[data-status]').textContent=error.message;}finally{button.disabled=false;}
    };
  }
  root.ASMachExcelReports={build,files,open,cellRef};
})(window);
