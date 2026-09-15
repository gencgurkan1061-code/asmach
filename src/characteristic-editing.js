(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),num=x=>x!==''&&x!=null&&Number.isFinite(Number(String(x).replace(',','.'))),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const toleranceFields=['lowerTolerance','upperTolerance','lowerLimit','upperLimit','toleranceStandard'];
 const standards=[['','Genel tolerans seçin'],...['f','m','c','v'].flatMap(c=>['H','K','L'].map(g=>['ISO 2768-'+c+g,'ISO 2768-'+c+g+' · '+({f:'ince',m:'orta',c:'kaba',v:'çok kaba'}[c])+' (legacy)'])),['CUSTOM','Çizim bilgilerindeki özel tolerans']];
 const options=(values)=>values.map(v=>`<option value="${esc(v.value??v[0])}">${esc(v.label??v[1])}</option>`).join('');
 function planSummary(patch,methods){const names={inspectionMethod:'Yöntem',inspectionFrequency:'Sıklık',frequencyInterval:'Aralık (N)',frequencyNote:'Sıklık açıklaması',sampleMode:'Numune planı',sampleCount:'Numune adedi',sampleLevel:'Muayene seviyesi'};return Object.entries(patch).map(([k,v])=>{const label=k==='sampleMode'?({none:'Adet belirtilmedi',manual:'Manuel adet',table:'Tabloya göre',all:'%100 kontrol'})[v]:k==='inspectionFrequency'?root.ASMachInspectionPlan.FREQUENCIES.find(f=>f.value===v)?.label:k==='inspectionMethod'?methods.find(m=>m.value===v)?.label:v;return `${names[k]||k}: ${label||'Belirtilmedi'}`;}).join(' · ');}
 function general(record,standard,parse,referenceLength=0,replace=false){
   if(!standard)return{reason:'Genel tolerans seçilmedi.'};
   if(record.drawingStandard==='ASME'&&standard.startsWith('ISO'))return{reason:'ASME seçili: ISO genel toleransı uygulanmadı. Çizimin özel tolerans değerlerini kullanın.'};
   if(!['Uzunluk','Ölçü','Çap','Yarıçap','Pah','Açı'].includes(record.type)||record.fitClass||record.threadClass)return{reason:'Bu tür için genel tolerans uygulanmaz.'};
   if(!num(record.nominalValue))return{reason:'Geçerli nominal ölçü gerekli.'};
   if(record.type==='Açı' ? record.unit!=='°' : record.unit!=='mm')return{reason:'Ölçü birimi genel toleransla uyumlu değil.'};
   if(!replace&&(record.toleranceExplicit||toleranceFields.slice(0,4).some(k=>String(record[k]??'').trim()!=='')))return{reason:'Mevcut tolerans / limit korundu.'};
   if(record.type==='Açı'&&!(Number(referenceLength)>0))return{reason:'Açı için kısa kenar uzunluğunu girin.'};
   const raw=String(record.nominalValue).replace(',','.')+(record.type==='Açı'?'°':''),p=parse(raw,standard,record.type,Number(referenceLength));
   if(!p||!num(p.lowerTolerance)||!num(p.upperTolerance))return{reason:'Seçilen genel toleransta bu ölçü için değer bulunamadı. Özel tolerans ayarlarını veya ölçü aralığını kontrol edin.'};
   const patch=Object.fromEntries(toleranceFields.map(k=>[k,p[k]??'']));patch.toleranceExplicit=false;patch.referenceLength=record.type==='Açı'?Number(referenceLength):record.referenceLength;
   if(!num(p.lowerLimit)||!num(p.upperLimit)||Number(p.lowerLimit)>Number(p.upperLimit))return{reason:'Hesaplanan limitler geçerli değil; genel tolerans ayarlarını kontrol edin.'};
   return{patch};
 }
 function prepare(records,changes,parse){
   const updates=[],skips=[],errors=[];
   if(!Object.keys(changes.fields||{}).length&&!Object.keys(changes.roles||{}).length&&!changes.standard)return{updates,skips,errors};
   for(const source of records){const errorsBefore=errors.length;let r=clone(source);Object.assign(r,changes.fields||{});
     if(changes.fields?.type&&changes.fields.type!==source.type&&[source.type,r.type].some(t=>['GD&T','Diş','Geçme','Datum'].includes(t))){errors.push(`#${r.number}: GD&T, datum, diş ve geçme tür dönüşümünü sağ panelde doğrulayın. Bu kayıt değiştirilmeden bırakılacak.`);continue;}
     if(changes.fields?.type&&changes.fields.type!==source.type){const profile=root.ASMachRequirements.fieldProfile(r.type);if(!profile.numeric){for(const key of [...toleranceFields,'nominalValue','unit'])r[key]='';r.toleranceExplicit=false;r.evaluationMethod='OK_NOT_OK';}r.unit=changes.fields.unit!==undefined?compatibleUnit(r.type,changes.fields.unit):defaultUnitForType(r.type);}
     for(const [role,patch] of Object.entries(changes.roles||{})){r.rolePlans||={};const old=r.rolePlans[role]||{...root.ASMachRolePlans.blank(),inspectionMethod:source.inspectionMethod||'',inspectionFrequency:source.inspectionFrequency||'',frequencyInterval:source.frequencyInterval||'',frequencyNote:source.frequencyNote||''};r.rolePlans[role]={...old,...patch,enabled:true};if(patch.inspectionFrequency==='EACH_PART')r.rolePlans[role].sampleMode='all';if('frequencyInterval'in patch&&!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(r.rolePlans[role].inspectionFrequency))errors.push(`#${r.number}: ${role==='operator'?'Operatör':'Kalite'} için aralık değiştirmek üzere “Her N parçada / saatte” sıklığını seçin.`);if(!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(r.rolePlans[role].inspectionFrequency))r.rolePlans[role].frequencyInterval='';const e=root.ASMachInspectionPlan.validate(r.rolePlans[role]);if(e)errors.push(`#${r.number}: ${e}`);if('sampleMode'in patch||'sampleCount'in patch||'sampleLevel'in patch){const error=root.ASMachRolePlans.samplingError(r.rolePlans[role],role);if(error)errors.push(`#${r.number}: ${role==='operator'?'Operatör':'Kalite'}: ${error}`);}}
     if(Object.keys(changes.roles||{}).length){const error=root.ASMachRolePlans.validate(r);if(error)errors.push(`#${r.number}: ${error}`);}
     if(changes.standard){const result=general(r,changes.standard,parse,changes.referenceLength,changes.replace);if(result.patch){Object.assign(r,result.patch);r.manualFields=(r.manualFields||[]).filter(k=>!toleranceFields.includes(k));}else skips.push(`#${r.number}: ${result.reason}`);}
     if(errors.length>errorsBefore||JSON.stringify(r)===JSON.stringify(source))continue;
     r.manualFields=[...new Set([...(r.manualFields||[]),...Object.keys(changes.fields||{})])];
     r=root.ASMachRequirements.syncRequirement(r);
     if(JSON.stringify(r)!==JSON.stringify(source))updates.push({source,before:JSON.stringify(source),after:r});
   }return{updates,skips,errors};
 }
 function open(app,ids,settings={}){
   if(!settings.host&&root.ASMachFormatRibbon?.showBulk){root.ASMachFormatRibbon.showBulk(ids);return;}
   const collection=app.state.annotations,records=collection.filter(r=>ids.includes(r.id));if(!records.length)return;
   const d=document.createElement('dialog');d.id='acuiBulkEditor';d.className='acui-dialog asmach-modal';d.style.width='min(980px,calc(100vw - 24px))';
   const field=(key,label,control)=>`<label class="acui-bulk-field"><span><input type="checkbox" data-enable="${key}"> ${label}</span>${control}</label>`,inp=key=>`<input data-bulk="${key}" disabled>`,sel=(key,items)=>`<select data-bulk="${key}" disabled>${options(items)}</select>`;
   d.innerHTML=`<header class="acui-head"><div><h2>${records.length} karakteristiği toplu düzenle</h2><p>Yalnızca işaretlediğiniz alanlar değişir. Filtre dışında seçilmiş kayıtlar da kapsamdadır.</p></div><button class="acui-close" data-close aria-label="Kapat">×</button></header><div class="acui-content"><section class="acui-section"><h3>Karakteristik bilgileri</h3><div class="acui-bulk-grid">${field('type','Tür',sel('type',root.ASMachRequirements.TYPES.map(v=>[v,v])))}${field('unit','Birim',inp('unit'))}${field('zone','Zone',inp('zone'))}${field('specialDesignator','Özel karakteristik',inp('specialDesignator'))}${field('comment','Kontrol notu',inp('comment'))}</div><p class="acui-subtle">Tür veya birim değişikliği ölçü değerlerini dönüştürmez. Ölçüden metinsel türe geçişte sayısal alanlar temizlenir; sonuçlar ve manuel gereklilik metni korunur.</p></section><section class="acui-section"><h3>Genel tolerans</h3><div class="acui-bulk-grid">${field('standard','Genel tolerans uygula',sel('standard',standards))}<label>Kısa kenar (açı, mm)<input data-reference type="number" min="0" step="any"></label><label class="acui-check"><input data-replace type="checkbox"> Mevcut tolerans / limitleri de değiştir</label></div><p class="acui-subtle">GD&T, diş ve geçme kayıtlarına genel tolerans uygulanmaz. Her ölçü kendi nominal değerine göre hesaplanır.</p></section>${['operator','quality'].map(role=>`<section class="acui-section"><h3>${role==='operator'?'Operatör':'Kalite'} kontrol planı</h3><div class="acui-bulk-grid">${field(role+'Method','Yöntemi değiştir',sel(role+'Method',app.getMethods()))}${field(role+'Frequency','Sıklığı değiştir',sel(role+'Frequency',root.ASMachInspectionPlan.FREQUENCIES))}${field(role+'Interval','Aralığı (N) değiştir',`<input data-bulk="${role}Interval" type="number" min="1" step="1" disabled>`)}${field(role+'Note','Sıklık açıklaması',inp(role+'Note'))}${field(role+'Sampling','Numune adedini / planını değiştir',sel(role+'Sampling',[...(role==='operator'?[['none','Adet belirtilmedi (isteğe bağlı)']]:[]),['manual','Manuel adet'],['table','Tabloya göre'],['all','%100 kontrol']]))}<label>Numune adedi ${role==='operator'?'(isteğe bağlı)':''}<input data-bulk="${role}Count" type="number" min="1" step="1" disabled></label><label>Muayene seviyesi<select data-bulk="${role}Level" disabled>${options(root.ASMachRolePlans.levels.map(v=>[v,v]))}</select></label></div><p class="acui-subtle">Aralık: kontrolün kaç parçada / saatte tekrarlanacağı. Numune adedi: kontrol edilecek parça sayısı.${role==='operator'?' Operatörde sıklık ve numune adedi boş bırakılabilir.':''}</p></section>`).join('')}<div data-preview role="status">Değişecek alanları işaretleyip önizleyin.</div></div><footer class="acui-foot"><button class="btn" data-close>Vazgeç</button><button class="btn" data-preview-button>Değişiklikleri önizle</button><button class="btn primary" data-save disabled>Seçilenleri güncelle</button></footer>`;
   const style=document.createElement('style');style.textContent='#acuiBulkEditor .acui-bulk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#acuiBulkEditor label{display:grid;gap:5px;font-size:12px;min-width:0}#acuiBulkEditor input:not([type=checkbox]),#acuiBulkEditor select{width:100%;min-width:0;border:1px solid #cbdde6;border-radius:6px;padding:7px}#acuiBulkEditor input[type=checkbox]{width:14px;height:14px;margin:0;vertical-align:middle}#acuiBulkEditor [data-preview]{font-size:12px;white-space:pre-line}#acuiBulkEditor .acui-bulk-field:has(input:checked){color:#087c8b}@media(max-width:650px){#acuiBulkEditor .acui-bulk-grid{grid-template-columns:1fr 1fr}}';d.append(style);document.body.append(d);
   const desktopStyle=document.createElement('style');desktopStyle.textContent=`
    #acuiBulkEditor{padding:0;border:1px solid #9aaebb;border-radius:7px;max-height:calc(100vh - 28px);box-shadow:0 16px 55px #10233455;color:#19384a}
    #acuiBulkEditor .acui-head{background:#f0f4f7;color:#19384a;padding:9px 12px;border-bottom:1px solid #c5d2dc;min-height:0}
    #acuiBulkEditor .acui-head h2{font-size:14px;margin:0;line-height:20px}
    #acuiBulkEditor .acui-head p{font-size:11px;margin:3px 0 0;color:#526a7a}
    #acuiBulkEditor .acui-close{background:transparent;color:#19384a;border:1px solid #bdcbd5;border-radius:3px;width:28px;height:26px}
    #acuiBulkEditor .acui-content{padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow:auto;min-height:0;max-height:calc(100vh - 145px);background:#f6f8fa}
    #acuiBulkEditor .acui-section{margin:0;padding:9px;border:1px solid #ccd8e0;border-radius:4px;min-width:0;background:white}
    #acuiBulkEditor .acui-section:first-child,#acuiBulkEditor .acui-section:nth-child(2){grid-column:1/-1}
    #acuiBulkEditor .acui-section[hidden]{display:none}
    #acuiBulkEditor h3{font-size:12px;margin:0 0 7px;padding:0 0 5px;border-bottom:1px solid #e0e7ec}
    #acuiBulkEditor .acui-bulk-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 8px}
    #acuiBulkEditor .acui-section:nth-child(n+3) .acui-bulk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    #acuiBulkEditor label{font-size:11px;gap:3px;line-height:15px;align-content:start}
    #acuiBulkEditor label>span{display:flex;align-items:center;gap:4px;min-height:16px}
    #acuiBulkEditor input:not([type=checkbox]),#acuiBulkEditor select{height:27px;padding:3px 6px;border-radius:3px;font-size:11px;box-sizing:border-box}
    #acuiBulkEditor input[type=checkbox]{width:13px;height:13px;accent-color:#078a9b}
    #acuiBulkEditor label.acui-check{display:flex;align-items:center;gap:6px;align-self:end;min-height:27px}
    #acuiBulkEditor .acui-subtle{font-size:10px;line-height:14px;margin:6px 0 0}
    #acuiBulkEditor .acui-content{grid-auto-rows:min-content;gap:6px;padding:8px}
    #acuiBulkEditor .acui-section{padding:6px 8px}
    #acuiBulkEditor [data-preview]{grid-column:1/-1;padding:7px;border:1px solid #cbdde6;border-radius:3px;background:#edf6f8;font-size:11px;min-height:30px;max-height:150px;overflow:auto;box-sizing:border-box}
    #acuiBulkEditor .acui-foot{padding:8px 10px;gap:7px;background:#f0f4f7;border-top:1px solid #c5d2dc}
    #acuiBulkEditor .acui-foot .btn{height:29px;padding:4px 10px;font-size:11px;border-radius:3px}
    @media(max-width:700px){#acuiBulkEditor .acui-content{grid-template-columns:1fr}#acuiBulkEditor .acui-bulk-grid{grid-template-columns:1fr 1fr}}
   `;d.append(desktopStyle);d.setAttribute('aria-label','Karakteristikleri toplu düzenle');
   if(settings.plansOnly)d.querySelectorAll('.acui-content > section').forEach((s,i)=>{if(i<2)s.hidden=true;});
   let prepared=null;const get=k=>d.querySelector(`[data-bulk="${k}"]`).value,enabled=k=>d.querySelector(`[data-enable="${k}"]`).checked;
   for(const role of ['operator','quality'])for(const [suffix,key] of Object.entries({Method:'inspectionMethod',Frequency:'inspectionFrequency',Interval:'frequencyInterval',Note:'frequencyNote',Sampling:'sampleMode',Count:'sampleCount',Level:'sampleLevel'})){const values=records.map(r=>String((r.rolePlans?.[role]||r)[key]??''));const node=d.querySelector(`[data-bulk="${role+suffix}"]`);if(values.every(v=>v===values[0])&&(node.tagName!=='SELECT'||[...node.options].some(o=>o.value===values[0])))node.value=values[0];else if(['INPUT','TEXTAREA'].includes(node.tagName))node.placeholder='Karışık değerler';}
   d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{d.close();settings.onClosed?.();});d.addEventListener('close',()=>d.remove());
   d.addEventListener('input',()=>{prepared=null;d.querySelector('[data-save]').disabled=true;d.querySelector('[data-preview]').textContent='Alanlar değişti. Önizlemeyi güncelleyin.';});
   d.querySelectorAll('[data-enable]').forEach(c=>c.onchange=()=>{d.querySelector(`[data-bulk="${c.dataset.enable}"]`).disabled=!c.checked;});
   const intervals=event=>{for(const role of ['operator','quality']){if(event?.target.dataset.bulk===role+'Frequency'&&enabled(role+'Frequency'))d.querySelector(`[data-enable="${role}Interval"]`).checked=['EVERY_N_PIECES','EVERY_N_HOURS'].includes(get(role+'Frequency'));d.querySelector(`[data-bulk="${role}Interval"]`).disabled=!enabled(role+'Interval');d.querySelector(`[data-bulk="${role}Count"]`).disabled=!enabled(role+'Sampling')||get(role+'Sampling')!=='manual';d.querySelector(`[data-bulk="${role}Level"]`).disabled=!enabled(role+'Sampling')||get(role+'Sampling')!=='table';}};d.addEventListener('change',intervals);intervals();
   d.querySelector('[data-preview-button]').onclick=()=>{const changes={fields:{},roles:{}};for(const k of ['type','unit','zone','specialDesignator','comment'])if(enabled(k))changes.fields[k]=get(k).trim();for(const role of ['operator','quality']){const patch={};if(enabled(role+'Method'))patch.inspectionMethod=get(role+'Method');if(enabled(role+'Frequency')){patch.inspectionFrequency=get(role+'Frequency');}if(enabled(role+'Interval'))patch.frequencyInterval=get(role+'Interval');if(enabled(role+'Sampling')){patch.sampleMode=get(role+'Sampling');if(patch.sampleMode==='manual')patch.sampleCount=get(role+'Count').trim();else if(patch.sampleMode==='table')patch.sampleLevel=get(role+'Level');else if(patch.sampleMode==='none')patch.sampleCount='';}if(enabled(role+'Note'))patch.frequencyNote=get(role+'Note').trim();if(Object.keys(patch).length)changes.roles[role]=patch;}
     if(enabled('standard')){changes.standard=get('standard');if(!changes.standard){d.querySelector('[data-preview]').textContent='Genel tolerans seçin.';return;}changes.replace=d.querySelector('[data-replace]').checked;changes.referenceLength=d.querySelector('[data-reference]').value;}
     prepared=prepare(records,changes,app.parseRequirement);const p=prepared;const labels={type:'Tür',unit:'Birim',zone:'Zone',specialDesignator:'Özel karakteristik',comment:'Kontrol notu'};const summary=[...Object.entries(changes.fields).map(([k,v])=>`${labels[k]}: ${v||'(temizle)'}`),...Object.entries(changes.roles).map(([role,patch])=>`${role==='quality'?'Kalite':'Operatör'}: ${planSummary(patch,app.getMethods())}`),changes.standard?`Genel tolerans: ${changes.standard}`:''].filter(Boolean).join('\n');d.querySelector('[data-preview]').textContent=`${p.updates.length} kayıt güncellenecek. ${p.skips.length} tolerans işlemi atlandı.\n`+summary+'\n\n'+p.updates.map(u=>`#${u.after.number}: ${u.after.type} · ${u.after.nominalValue||'—'} ${u.after.unit||''} · ${u.after.lowerTolerance||'—'} / ${u.after.upperTolerance||'—'}`).join('\n')+'\n'+ (p.errors.length?'Değiştirilmeden bırakılacak hatalı kayıtlar:\n':'')+[...p.errors,...p.skips].join('\n');d.querySelector('[data-save]').disabled=!p.updates.length;d.querySelector('[data-save]').textContent=`${p.updates.length} kaydı güncelle`;d.querySelector('[data-preview]').scrollIntoView({block:'nearest'});};
   d.querySelector('[data-save]').onclick=()=>{if(!prepared||!prepared.updates.length)return;if(settings.canApply&&!settings.canApply()){d.querySelector('[data-preview]').textContent='Seçim değişti. Alanları yeniden seçin.';return;}if(app.state.annotations!==collection||prepared.updates.some(u=>!collection.includes(u.source)||JSON.stringify(u.source)!==u.before)){d.querySelector('[data-preview]').textContent='Kayıtlar değişti. Pencereyi kapatıp tekrar açın.';d.querySelector('[data-save]').disabled=true;return;}app.checkpoint();for(const u of prepared.updates){Object.assign(u.source,u.after);u.source.updatedAt=new Date().toISOString();const evaluation=root.ASMachRequirements.evaluate(u.source);u.source.resultStatus=evaluation.status||evaluation.result||'pending';app.recordChange?.('Karakteristik bilgileri toplu güncellendi',u.source);}app.renderAll();app.toast?.(`${prepared.updates.length} karakteristik güncellendi.`);d.close();settings.onApplied?.();};if(settings.host){settings.host.append(d);d.classList.add('format-embedded');d.show();}else d.showModal();return d;
 }
 function unitsForType(type){type=root.ASMachRequirements.normalizeType(type);const length=['mm','cm','m','µm','µin','nm','in'];return type==='Açı'?['°']:type==='Yüzey'?['µm','µin','nm','mm','cm','m','in','']:['Uzunluk','Çap','Yarıçap','Pah','Tolerans','GD&T','Diş','Geçme'].includes(type)?length:['',...length,'°'];}
 function compatibleUnit(type,current,preferred){const units=unitsForType(type);return units.includes(current)?current:units.includes(preferred)?preferred:units[0];}
 function defaultUnitForType(type,preferred=root.ASMachApp?.state.generalTolerance?.unit){type=root.ASMachRequirements.normalizeType(type);return type==='Yüzey'?'µm':type==='Açı'?'°':['Uzunluk','Çap','Yarıçap','Pah','Tolerans','GD&T','Diş','Geçme'].includes(type)?preferred==='in'?'in':'mm':'';}
 const pendingCorrections=new WeakSet();
 async function confirmCorrection(app,record,patch){
  if(pendingCorrections.has(record))return false;
  const before=JSON.stringify(record),documentKey=app.state.fileData;
  const revised={...record,...patch};
  if(record.limitDimension&&revised.type===record.type){
   const nominalChanged=String(revised.nominalValue)!==String(record.nominalValue),deviationChanged=['lowerTolerance','upperTolerance'].some(k=>String(revised[k])!==String(record[k]));
   if(nominalChanged&&!deviationChanged){
    revised.nominalSource='manual';revised.lowerLimit=record.lowerLimit;revised.upperLimit=record.upperLimit;
    for(const [tol,limit] of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])revised[tol]=String(revised.nominalValue).trim()&&String(record[limit]).trim()?String(Number((Number(record[limit])-Number(revised.nominalValue)).toFixed(12))):'';
   }else if(deviationChanged){revised.limitDimension=false;revised.nominalSource='';}
  }
  if(revised.type!==record.type){
   if(!['Uzunluk','Çap','Yarıçap','Pah','Tolerans'].includes(revised.type)||!['Uzunluk','Çap','Yarıçap','Pah','Tolerans'].includes(record.type)){revised.limitDimension=false;revised.nominalSource='';}
   revised.unit=defaultUnitForType(revised.type,app.state.generalTolerance?.unit);
   if(revised.type!=='Geçme')revised.fitClass='';
   if(revised.type!=='Diş'){revised.threadClass='';revised.threadPitch='';}
   if(revised.type!=='GD&T'){revised.gdtSubtype='';revised.gdtFrame=null;}
  }
  const next=root.ASMachRequirements.syncRequirement(revised,true);
  if(next.type==='GD&T')Object.assign(next,root.ASMachRequirements.withGdtSubtype(next));
  const labels={type:'Tür',unit:'Birim',nominalValue:'Nominal',lowerTolerance:'Alt tolerans',upperTolerance:'Üst tolerans',lowerLimit:'Alt limit',upperLimit:'Üst limit',requirement:'Gereklilik'};
  const changes=Object.entries(labels).filter(([k])=>String(record[k]??'')!==String(next[k]??''));
  if(!changes.length){app.renderAll();return false;}
  const errors=root.ASMachRequirements.consistencyErrors(next);
  if(errors.length){await root.ASMachMessages.alert(errors.join('\n'),'Düzeltmeyi kontrol edin');app.renderAll();return false;}
  pendingCorrections.add(record);
  try{
   const message=`Karakteristik #${record.number} için yapılacak düzeltmeler:\n\n`+changes.map(([k,label])=>`${label}\n  Eski: ${record[k]??'—'}\n  Yeni: ${next[k]??'—'}`).join('\n\n')+'\n\nGereklilik ölçü alanlarından yeniden oluşturulacak.'+(record.requirementMode==='manual'?' Elle yazılmış gereklilik metni de bu onayla değiştirilecek.':'')+'\nDiğer karakteristikler değişmez. İşlem geri alınabilir.';
   const accepted=await root.ASMachMessages.confirm(message,'Ölçü düzeltmesini onaylayın');
   if(!accepted){app.renderAll();return false;}
   if(app.selectedAnnotation()!==record||app.state.fileData!==documentKey||JSON.stringify(record)!==before){await root.ASMachMessages.alert('Seçili kayıt değişti. Düzeltme uygulanmadı; yeniden deneyin.');app.renderAll();return false;}
   app.checkpoint();Object.assign(record,next);record.resultStatus=root.ASMachRequirements.evaluate(record).status||'pending';app.recordChange('Ölçü ve gereklilik onayla güncellendi',record);app.renderAll();return true;
  }finally{pendingCorrections.delete(record);}
 }
 root.ASMachCharacteristicEditing={general,prepare,open,standards,options,confirmCorrection,unitsForType,defaultUnitForType,compatibleUnit};
})(window);
