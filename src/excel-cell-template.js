/* XLTX templates are designed in Microsoft Excel; this module only defines safe field tokens. */
(function(root){
 'use strict';
 const fields=[
  ['project.partNo','Proje · Parça numarası'],['project.projectName','Proje · Proje adı'],['project.partName','Proje · Parça adı'],['project.partRevision','Proje · Parça revizyonu'],['project.drawingNo','Proje · Resim numarası'],['project.drawingRevision','Proje · Resim revizyonu'],['project.customer','Proje · Müşteri'],['project.preparedBy','Proje · Hazırlayan'],
  ['document.fileName','Belge · Dosya adı'],
  ...Object.entries({number:'Balon numarası',type:'Tür',requirement:'Gereklilik',nominalValue:'Nominal',lowerTolerance:'Alt tolerans',upperTolerance:'Üst tolerans',lowerLimit:'Alt limit',upperLimit:'Üst limit',unit:'Birim',inspectionMethod:'Kontrol yöntemi',inspectionFrequency:'Kontrol sıklığı',characteristicClass:'Sınıflandırma',page:'Sayfa',zone:'Bölge',resultValue:'Ölçüm sonucu',status:'Durum',referenceLocation:'Referans lokasyonu',specialDesignator:'Özel sınıf işareti',result:'Ölçüm sonucu (FAI)',nonconformanceNo:'Uygunsuzluk no',comment:'Yorum'}).map(([key,label])=>['record.'+key,'Karakteristik · '+label])
 ];
 const add=(prefix,category,items)=>Object.entries(items).forEach(([key,label])=>fields.push([prefix+'.'+key,category+' · '+label]));
 add('project.fai','FAI / Kimlik ve onay',{fairIdentifier:'FAIR no',partType:'Detay / montaj',faiType:'Tam / kısmi FAI',serialNumber:'Seri / parti no',purchaseOrder:'Satın alma siparişi',manufacturingReference:'Üretim referansı',organizationName:'Kuruluş',supplierCode:'Tedarikçi kodu',baseline:'Esas alınan parça / revizyon',reason:'FAI gerekçesi',additionalChanges:'Ek değişiklikler',documentedNonconformance:'Belgelenmiş uygunsuzluk',verifiedBy:'Doğrulayan',verifiedDate:'Doğrulama tarihi',approvedBy:'Onaylayan',approvedDate:'Onay tarihi',customerApproval:'Müşteri onayı',customerDate:'Müşteri onay tarihi',comments:'Form 1 açıklamaları',productComments:'Form 2 açıklamaları'});
 add('project.inspectionReport','Sipariş / Rapor',{workOrder:'İş emri',orderQuantity:'Sipariş adedi',lotSize:'Parti adedi',documentNo:'Rapor no',reportRevision:'Rapor revizyonu',lotSerial:'Parti / seri',equipmentId:'Cihaz no'});
 add('record','Karakteristik',{toolingReference:'Tasarlanmış / nitelendirilmiş takım referansı',operation:'Operasyon',frequencyInterval:'Sıklık aralığı',frequencyNote:'Sıklık notu',reaction:'Reaksiyon planı',controlNote:'Kontrol notu'});
 const planFields={enabled:'Etkin kontrol',inspectionMethod:'Kontrol yöntemi',inspectionFrequency:'Kontrol sıklığı',frequencyInterval:'Sıklık aralığı',frequencyNote:'Sıklık notu',sampleMode:'Numune seçimi',sampleLevel:'Numune seviyesi',sampleCount:'Numune adedi',sampleStandard:'Numune standardı',sampleStandardNote:'Standart / revizyon notu',operation:'Operasyon',reaction:'Reaksiyon planı'};
 add('record.operator','Operatör kontrolü',planFields);add('record.quality','Kalite kontrolü',planFields);
 add('component','Montaj / Parçalar',{position:'Pozisyon',partNo:'Parça no',name:'Ad',revision:'Revizyon',quantity:'Miktar',unit:'Birim',partType:'Parça türü',supplier:'Tedarikçi',lot:'Parti',fairIdentifier:'FAIR no',certificateNo:'Sertifika no'});
 add('material','Malzeme / Proses / Test',{kind:'Kayıt türü',name:'Ad',specification:'Şartname',revision:'Revizyon',classification:'Sınıf',code:'Kod',materialForm:'Malzeme formu',supplier:'Tedarikçi',lot:'Parti / ısı no',certificateNo:'Sertifika no',customerApproval:'Müşteri onayı',acceptance:'Kabul kriteri',reportNo:'Test raporu',notes:'Notlar'});
 add('operation','Operasyonlar',{code:'Kod',name:'Ad',description:'Açıklama',workcenter:'Tezgâh',subcontractor:'Dış proses',instruction:'Talimat',revision:'Revizyon',owner:'Sorumlu'});
  add('evidence','Muayene kayıtları',{characteristicId:'Karakteristik kimliği',controlId:'Kontrol planı kimliği',operationId:'Operasyon kimliği',lot:'Parti / seri',sample:'Numune no',date:'Muayene tarihi',result:'Sonuç',status:'Değerlendirme',documentNo:'Kanıt / rapor no',inspector:'Kontrol eden',notes:'Açıklama'});
 add('record.common','Ortak kontrol',planFields);
 add('component','Montaj / Parçalar',{parentId:'Üst montaj kimliği',supply:'Temin şekli',materialReference:'Malzeme referansı'});
 add('material','Malzeme / Proses / Test',{componentId:'İlgili parça kimliği'});
 add('operation','Operasyonlar',{componentId:'İlgili parça kimliği'});
 add('control','Üretim kontrol kayıtları',{code:'Kontrol kodu',name:'Kontrol adı',sourceId:'Kaynak kayıt kimliği',componentId:'Parça kimliği',operationId:'Operasyon kimliği',acceptance:'Kabul kriteri'});
 const collections={record:'annotations',component:'components',material:'records',operation:'operations',evidence:'evidence',control:'controls'};
 add('record','Görsel alanlar',{balloonImage:'Balon numarası (görsel)',classificationImage:'Karakteristik sınıfı (görsel)'});
 add('record','Karakteristik',{evaluationMethod:'Değerlendirme türü (Değer / OK-NOT OK)'});
 const known=new Set(fields.map(f=>f[0]));
 function recordsFor(field,state){const kind=field.split('.')[0],items=kind==='record'?[...(state.annotations||[])].sort(root.ASMachNumberOrder.records):collections[kind]?(state.metadata?.production?.[collections[kind]]||[]):[null];return items.length?items:[null];}
 const repeats=field=>Object.hasOwn(collections,field.split('.')[0]);
 const numericFields=new Set(['record.nominalValue','record.lowerTolerance','record.upperTolerance','record.lowerLimit','record.upperLimit','record.resultValue','record.result']);
 function numericValue(value,separator='auto'){
  if(typeof value==='number')return Number.isFinite(value)?value:'';
  if(typeof value!=='string'||!value.trim())return value??'';
  let candidate=value.trim().replace(/\u2212/g,'-');
  // App values use dot decimals. Single dot/comma inputs are always decimal,
  // never silently interpreted as thousands (10.100 must not become 10100).
  if(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(candidate)){
   const mode=separator==='auto'?(candidate.lastIndexOf(',')>candidate.lastIndexOf('.')?'comma':'dot'):separator;
   if(mode==='comma'&&/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(candidate))candidate=candidate.replace(/\./g,'');
   else if(mode==='dot'&&/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(candidate))candidate=candidate.replace(/,/g,'');
   else return value; // Keep notes, ranges, units and ambiguous values intact.
  }
  const n=Number(candidate.replace(',','.'));return Number.isFinite(n)?n:value;
 }
 function resolve(field,state,record,decimalSeparator='auto'){
  record=record||{};
  if(!known.has(field))throw Error('Desteklenmeyen şablon alanı: '+field);
  // AS9102 field 7 is a special-characteristic designator. The geometric
  // characteristic symbol belongs to the visual feature-control frame in
  // field 8 and must not be repeated as a font-dependent glyph here.
  if(field==='record.specialDesignator'&&record.type==='GD&T')return '';
  if(field==='record.evaluationMethod')return record.evaluationMethod==='OK_NOT_OK'?'OK / NOT OK':record.evaluationMethod==='VALUE'?'Değer':record.type==='Not'?'OK / NOT OK':record.id||record.number?'Değer':'';
  const [kind,...path]=field.split('.');let value=kind==='project'?state.metadata:kind==='document'?state:record;
  if(kind==='record'&&['operator','quality'].includes(path[0])){const role=path.shift(),p=root.ASMachRolePlans?.normalize(record)?.[role];if(!p?.enabled)return path[0]==='enabled'?false:'';value=p;}
  if(kind==='record'&&path[0]==='common'){path.shift();if(record.commonPlanEnabled===false||record.commonPlanEnabled!==true&&record.rolePlans)return path[0]==='enabled'?false:'';value={...record.commonSampling,...record,enabled:true};}
  if(kind==='record'&&field.split('.').length===2&&Object.hasOwn(planFields,path[0])){const plans=root.ASMachRolePlans?.normalize(record);if(plans)value={[path[0]]:[...new Set(Object.values(plans).filter(p=>p.enabled).map(p=>p[path[0]]).filter(v=>v!==''&&v!=null))].join(' / ')};}
  for(const key of path)value=value&&Object.hasOwn(value,key)?value[key]:undefined;
  if(kind==='record'&&field==='record.referenceLocation'&&!value)value=[state.metadata?.drawingNo,record?.page?'Sayfa '+record.page:'',record?.zone].filter(Boolean).join(' / ');
  if(kind==='record'&&field==='record.result'&&value==null)value=record?.resultValue;
  if(path.at(-1)==='inspectionMethod')value=root.ASMachApp?.getMethods?.().find(m=>m.value===value)?.label??value;
  if(value!=null&&typeof value==='object')throw Error('Şablon alanı tek değer içermeli: '+field);
  return numericFields.has(field)?numericValue(value,decimalSeparator):value??'';
 }
 const preset=(name,title,columns)=>{
  const cells={'0:0':{text:title,bold:true},'1:0':{text:'Parça No'},'1:1':{field:'project.partNo'},'2:0':{text:'Teknik resim'},'2:1':{field:'document.fileName'}};
  columns.forEach(([field,label],column)=>{cells['4:'+column]={text:label,bold:true};cells['5:'+column]={field:'record.'+field};});
  return {name,direction:'rows',repeat:5,cells};
 };
 const presets=()=>{
  const items=[
  preset('Ölçüm Kontrol Raporu','ÖLÇÜM KONTROL RAPORU',[['number','Balon No'],['type','Tür'],['requirement','Gereklilik'],['nominalValue','Nominal'],['lowerTolerance','Alt Tolerans'],['upperTolerance','Üst Tolerans'],['result','Sonuç']]),
  preset('Kontrol Planı','KONTROL PLANI',[['number','Balon No'],['requirement','Gereklilik'],['inspectionMethod','Kontrol Yöntemi'],['inspectionFrequency','Kontrol Sıklığı'],['comment','Not']]),
  preset('Ara Kontrol Raporu','ARA KONTROL RAPORU',[['number','Balon No'],['page','Sayfa'],['zone','Bölge'],['requirement','Gereklilik'],['lowerLimit','Alt Limit'],['upperLimit','Üst Limit'],['result','Sonuç'],['status','Durum']])
  ];
  const fai=preset('FAI · Karakteristik doğrulama (Rev C alanları)','FAI KARAKTERİSTİK DOĞRULAMA',[['number','5. Karakteristik no'],['referenceLocation','6. Referans lokasyonu'],['specialDesignator','7. Karakteristik işareti'],['requirement','8. Gereklilik'],['result','9. Sonuç'],['toolingReference','10. Tasarlanmış / nitelendirilmiş takım'],['nonconformanceNo','11. Uygunsuzluk no'],['comment','12. Ek bilgi / yorum']]);
  Object.assign(fai.cells,{'1:0':{text:'1. Parça no'},'1:2':{text:'2. Parça adı'},'1:3':{field:'project.partName'},'2:0':{text:'3. Seri no'},'2:1':{field:'project.fai.serialNumber'},'2:2':{text:'4. FAIR no'},'2:3':{field:'project.fai.fairIdentifier'},'3:0':{text:'AS9102C alan eşlemesi · Kurum / müşteri şartları ayrıca doğrulanmalıdır.'}});
  fai.category='FAI';fai.source='https://iaqg.org/standards/forms/';items.push(fai);
  for(const [role,label] of [['operator','Operatör'],['quality','Kalite']]){const t=preset(label+' · Kontrol ve numune planı',label.toLocaleUpperCase('tr-TR')+' KONTROL PLANI',[['number','Balon no'],['requirement','Gereklilik'],[role+'.enabled','Kontrol etkin'],[role+'.inspectionMethod','Yöntem'],[role+'.inspectionFrequency','Sıklık'],[role+'.sampleMode','Numune seçimi'],[role+'.sampleCount','Manuel numune adedi'],[role+'.reaction','Reaksiyon']]);t.category='Kontrol planları';items.push(t);}
  const evidence=preset('Muayene · İzlenebilirlik kaydı','MUAYENE İZLENEBİLİRLİK KAYDI',[]);[['date','Muayene tarihi'],['lot','Parti / seri'],['sample','Numune'],['characteristicId','Karakteristik kimliği'],['result','Ölçülen sonuç'],['status','Değerlendirme'],['inspector','Kontrol eden'],['documentNo','Kanıt / rapor no']].forEach(([key,label],i)=>{evidence.cells['4:'+i]={text:label,bold:true};evidence.cells['5:'+i]={field:'evidence.'+key};});evidence.category='Muayene';items.push(evidence);
  if(root.ASMachFai837Template)items.push({...root.ASMachFai837Template.preset(),category:'FAI'});return items;
 };
 function model(template,state,tokens=false){
  const cells=[],used=new Set();let rows=1,cols=1;
  for(const [address,cell] of Object.entries(template.cells)){const [r,c]=address.split(':').map(Number),recordField=!!cell.field&&repeats(cell.field),axis=template.direction==='rows'?r:c;if(recordField&&axis!==template.repeat)throw Error('Karakteristik alanları tekrar satırında olmalı.');const records=cell.field?recordsFor(cell.field,state):[null],count=recordField&&!tokens?records.length:1;
   for(let index=0;index<count;index++){let rr=r,cc=c;if(!tokens&&recordField){if(template.direction==='rows')rr+=index;else cc+=index;}const key=rr+':'+cc;if(used.has(key))throw Error('Tekrarlanan alanlar çakışıyor.');used.add(key);let value=cell.text||'';if(cell.field){value=tokens?'{{'+cell.field+'}}':resolve(cell.field,state,records[index]);}cells.push({r:rr,c:cc,rs:1,cs:1,value,style:cell.bold?2:0});rows=Math.max(rows,rr+1);cols=Math.max(cols,cc+1);}
  }
  for(const cell of cells)if(cell.c===0&&[0,3].includes(cell.r)&&!cells.some(other=>other.r===cell.r&&other.c>0))cell.cs=cols;
  return {branded:true,sheets:[{name:'Rapor',n:cols,lastRow:rows,cells,colWidth:24,widths:Array(cols).fill(24),heights:Object.fromEntries(Array.from({length:rows},(_,i)=>[i,i===4?66:i>=5?42:30])),images:[],breaks:[],landscape:true,paperSize:9}]};
 }
 function files(template,state,asTemplate){if(template.format==='fai837')return root.ASMachFai837Template.files(template,state,asTemplate);const output=root.ASMachExcelReports.files(model(template,state,asTemplate));if(asTemplate)output['[Content_Types].xml']=output['[Content_Types].xml'].replace('spreadsheetml.sheet.main+xml','spreadsheetml.template.main+xml');return output;}
 function blob(template,state){return root.ASMachWorkflow.zipStored(files(template,state,true));}
 function open(app,templateId){if(!root.ASMachDesktop?.editExcelTemplate){app.toast('XLTX şablon düzenleyicisi Windows masaüstü sürümünde kullanılabilir.',true);return Promise.resolve(false);}return root.ASMachDesktop.editExcelTemplate(templateId,fields);}
 async function pickEditor(app){
  if(!root.ASMachDesktop?.listExcelTemplates)return app.toast('Şablon düzenleyici, Excel kurulu Windows masaüstü uygulamasında kullanılabilir.',true);
  const prior=document.getElementById('excelTemplatePicker');if(prior){prior.focus();return;}
  try{const items=await root.ASMachDesktop.listExcelTemplates();
   const dialog=document.createElement('dialog');dialog.id='excelTemplatePicker';dialog.style.cssText='width:370px;max-width:90vw;padding:16px;border:1px solid #bed4df;border-radius:8px;color:#23485f;font:13px Segoe UI';
   dialog.innerHTML='<form method="dialog"><h3 style="margin:0 0 12px">Şablon Düzenleyici</h3><label>Şablon<select aria-label="Düzenlenecek şablon" style="display:block;width:100%;margin:6px 0 14px;padding:7px"></select></label><p>Mevcut şablonu doğrudan düzenleyin. Kaydet ve kapat ile aynı dosyaya kaydedin. Bilgisayardan açılan dosyalar kütüphaneye kopyalanmaz.</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" value="cancel">Vazgeç</button><button class="btn" type="button" data-file>Dosya aç…</button><button class="btn primary" type="button" data-open>Şablonu düzenle</button></div></form>';
   const select=dialog.querySelector('select');for(const item of items)select.append(new Option(item.name,item.id));select.disabled=!items.length;
   const launch=async(button,id)=>{button.disabled=true;try{await open(app,id);dialog.close();}catch(e){app.toast(e.message,true);}finally{button.disabled=false;}};
   const libraryButton=dialog.querySelector('[data-open]');libraryButton.disabled=!items.length;libraryButton.onclick=()=>launch(libraryButton,select.value);
   const fileButton=dialog.querySelector('[data-file]');fileButton.onclick=()=>launch(fileButton,null);
   dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
  }catch(e){app.toast(e.message,true);}
 }
 root.ASMachExcelCellTemplate={fields,presets,model,files,blob,open,pickEditor,resolve,recordsFor,repeats};
})(window);
