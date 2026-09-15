(function(root){
  'use strict';
  const FREQUENCIES=Object.freeze([
    {value:'',label:'Belirtilmedi'}, {value:'EACH_PART',label:'%100 — Her parça'},
    {value:'FIRST_PIECE',label:'İlk parça'}, {value:'LAST_PIECE',label:'Son parça'},
    {value:'FIRST_LAST',label:'İlk ve son parça'}, {value:'PER_LOT',label:'Her parti'},
    {value:'PER_SHIFT',label:'Her vardiya'}, {value:'HOURLY',label:'Saatlik'},
    {value:'EVERY_N_PIECES',label:'Her N parçada'}, {value:'EVERY_N_HOURS',label:'Her N saatte'}, {value:'CUSTOM',label:'Özel kontrol planı'}
  ].map(Object.freeze));
  const NOTE_METHODS=Object.freeze([
    {value:'GÖRSEL_KONTROL',label:'Görsel kontrol'},
    {value:'DOKÜMAN_KONTROLÜ',label:'Doküman / sertifika kontrolü'},
    {value:'PROSES_DOĞRULAMA',label:'Proses doğrulama'},
    {value:'FONKSİYON_KONTROLÜ',label:'Fonksiyon kontrolü'}
  ].map(Object.freeze));
  function normalize(item){
    const known=FREQUENCIES.some(f=>f.value===item.inspectionFrequency),raw=String(item.inspectionFrequency||'');
    return {inspectionFrequency:known?raw:raw?'CUSTOM':'',frequencyInterval:String(item.frequencyInterval??''),frequencyNote:String(item.frequencyNote||(!known?raw:''))};
  }
  function validate(item){
    if(item.rolePlans)return root.ASMachRolePlans?.validate(item)||'';
    if(!FREQUENCIES.some(f=>f.value===item.inspectionFrequency))return 'Geçerli bir kontrol sıklığı seçin.';
    if(['EVERY_N_PIECES','EVERY_N_HOURS'].includes(item.inspectionFrequency)&&(!Number.isSafeInteger(Number(item.frequencyInterval))||Number(item.frequencyInterval)<1))return 'Aralık için 1 veya daha büyük bir tam sayı girin.';
    if(item.inspectionFrequency==='CUSTOM'&&!String(item.frequencyNote||'').trim())return 'Özel kontrol planını açıklayın.';
    return '';
  }
  function label(item){const f=normalize(item);return f.inspectionFrequency==='EVERY_N_HOURS'?`Her ${f.frequencyInterval||'N'} saatte`:f.inspectionFrequency==='EVERY_N_PIECES'?`Her ${f.frequencyInterval||'N'} parçada`:f.inspectionFrequency==='CUSTOM'?f.frequencyNote||'Özel kontrol planı':FREQUENCIES.find(o=>o.value===f.inspectionFrequency).label;}
  function suggestions(requirement){
    const text=String(requirement||'').toLocaleLowerCase('tr-TR');
    const recommended=/sertifika|belge|rapor|malzeme|certificate/.test(text)?'DOKÜMAN_KONTROLÜ':/ısıl|kaplama|proses|boya|ısıl işlem|heat treat/.test(text)?'PROSES_DOĞRULAMA':/fonksiyon|çalışma|sızdırmaz|function/.test(text)?'FONKSİYON_KONTROLÜ':'GÖRSEL_KONTROL';
    return NOTE_METHODS.map(m=>({...m,recommended:m.value===recommended})).sort((a,b)=>Number(b.recommended)-Number(a.recommended));
  }
  // Planning readiness only: measured results and approval status are never required.
  function checkInformation(item,context={}){
    const issues=[], present=v=>v!=null&&String(v).trim()!=='', num=v=>present(v)&&Number.isFinite(Number(String(v).replace(',','.')));
    const add=(code,field,label)=>issues.push({code,field,label});
    const api=root.ASMachRequirements, profile=api?.fieldProfile?.(item.type);
    if(!present(item.number))add('identity','number','Balon numarası eksik');
    if(!Number.isInteger(Number(item.page))||Number(item.page)<1||(context.pageCount&&Number(item.page)>context.pageCount))add('identity','page','Geçerli çizim sayfası seçin');
    if(!present(item.type)||api?.TYPES&&!api.TYPES.includes(item.type))add('type','type','Karakteristik türünü seçin');
    if(!present(item.requirement))add('requirement','requirement','Gereklilik / açıklama eksik');
    if(!present(item.inspectionMethod))add('method','inspectionMethod','Kontrol yöntemi eksik');
    else if(context.methods&&!context.methods.some(m=>(m.value??m)===item.inspectionMethod))add('method','inspectionMethod','Kontrol yöntemi artık tanımlı değil');
    if(!present(item.inspectionFrequency))add('frequency','inspectionFrequency','Kontrol sıklığı eksik');
    else {const error=validate(item);if(error)add('frequency',item.inspectionFrequency==='CUSTOM'?'frequencyNote':item.inspectionFrequency==='EVERY_N_PIECES'?'frequencyInterval':'inspectionFrequency',error);}
    const numeric=profile?profile.numeric:!['Not','Malzeme','Proses','Datum','Diğer'].includes(item.type);
    if(numeric){
      const bounds=num(item.lowerLimit)||num(item.upperLimit);
      if((profile?profile.nominal:item.type!=='GD&T')&&!num(item.nominalValue)&&!bounds)add('nominal','nominalValue','Nominal veya limit ölçü eksik');
      if(!present(item.unit))add('unit','unit','Ölçü birimi eksik');
      if((!profile||profile.tolerance)&&item.evaluationMethod!=='OK_NOT_OK'&&!bounds&&!num(item.lowerTolerance)&&!num(item.upperTolerance))add('tolerance','upperTolerance','Tolerans / kabul sınırı eksik');
      for(const [key,name] of [['nominalValue','Nominal'],['lowerTolerance','Alt tolerans'],['upperTolerance','Üst tolerans'],['lowerLimit','Alt limit'],['upperLimit','Üst limit']]){
        if(present(item[key])&&!num(item[key]))add('inconsistent',key,`${name}: geçerli sayı girin`);
      }
      for(const [low,high,name] of [['lowerTolerance','upperTolerance','Alt tolerans üst toleranstan'],['lowerLimit','upperLimit','Alt limit üst limitten']]){
        if(num(item[low])&&num(item[high])&&Number(String(item[low]).replace(',','.'))>Number(String(item[high]).replace(',','.')))add('inconsistent',low,`${name} büyük`);
      }
    }
    for(const error of api?.consistencyErrors?.(item)||[])add('inconsistent','lowerLimit',error);
    if(item.type==='GD&T'&&!api?.GDT_TYPES?.some(t=>t.value===item.gdtSubtype))add('gdt','gdtSubtype','GD&T türünü seçin');
    if(item.rolePlans){for(let i=issues.length-1;i>=0;i--)if(['method','frequency'].includes(issues[i].code))issues.splice(i,1);const error=root.ASMachRolePlans?.validate(item);if(error)add('frequency','rolePlans',error);else if(!Object.values(item.rolePlans).some(p=>p.enabled))add('frequency','rolePlans','Operatör veya kalite kontrol planını etkinleştirin');}
    return issues;
  }
  root.ASMachInspectionPlan={FREQUENCIES,NOTE_METHODS,normalize,validate,label,suggestions,checkInformation};
})(window);
