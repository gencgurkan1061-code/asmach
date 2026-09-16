/* Controls in the selection review share the characteristic model and frequency enums. */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  const extraFields=[['threadPitch','DİŞ ADIMI'],['threadClass','DİŞ SINIFI'],['threadStandard','DİŞ STANDARDI'],['chamferAngle','PAH AÇISI (°)'],['chamferAngleTolerance','AÇI TOLERANSI (±°)'],['specialDesignator','YÜZEY PARAMETRESİ'],['datumRefs','DATUM TANIMI']];
  let config=null;
  let roleEditor=null;
  function profile(type){
    const p=root.ASMachRequirements.fieldProfile(type),gdt=type==='GD&T';
    return {...p,lower:p.numeric&&!gdt&&type!=='Diş',upper:p.numeric&&type!=='Diş',general:['Ölçü','Uzunluk','Çap','Yarıçap','Açı','Pah'].includes(type),
      extras:type==='Diş'?['threadPitch','threadClass','threadStandard']:type==='Pah'?['chamferAngle','chamferAngleTolerance']:type==='Yüzey'?['specialDesignator']:type==='Datum'?['datumRefs']:[]};
  }
  function frequency(){return{inspectionFrequency:$('ocrFrequency').value,frequencyInterval:$('ocrFrequencyInterval').value.trim(),frequencyNote:$('ocrFrequencyNote').value.trim(),...(roleEditor?{rolePlans:roleEditor.read()}: {})};}
  function frequencyLayout(){const v=$('ocrFrequency').value;$('ocrFrequencyInterval').closest('.field').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(v);$('ocrFrequencyNote').closest('.field').hidden=!['CUSTOM','EVERY_N_PIECES','EVERY_N_HOURS'].includes(v);}
  function start(options){
    config=options;const methodLabel=document.querySelector('label[for="ocrInspectionMethod"]'),frequencyLabel=document.querySelector('label[for="ocrFrequency"]');if(methodLabel)methodLabel.textContent='BALON STİLİ / ESKİ YÖNTEM';if(frequencyLabel)frequencyLabel.textContent='ESKİ KONTROL SIKLIĞI';
    if(root.ASMachRolePlans){let host=$('ocrRolePlans');if(!host){host=document.createElement('section');host.id='ocrRolePlans';$('ocrFrequency').closest('.field').parentElement.append(host);}roleEditor=root.ASMachRolePlans.mount(host,options.initial||{},options.methods,()=>root.ASMachApp?.state.metadata?.inspectionReport?.lotSize);}
    const select=$('ocrInspectionMethod');select.replaceChildren(...options.methods.map(m=>new Option(m.label,m.value)));select.value=options.getPending().previewMethod;
    select.onchange=()=>{const p=options.getPending();if(!p)return;p.previewMethod=select.value;p.methodManuallySelected=true;options.onMethod();};
    $('ocrFrequency').replaceChildren(...root.ASMachInspectionPlan.FREQUENCIES.map(m=>new Option(m.label,m.value)));
    const initial=root.ASMachInspectionPlan.normalize(options.initial||{});
    $('ocrFrequency').value=initial.inspectionFrequency;$('ocrFrequencyInterval').value=initial.frequencyInterval;$('ocrFrequencyNote').value=initial.frequencyNote;$('ocrFrequency').onchange=frequencyLayout;frequencyLayout();
    const extras=$('ocrTypeExtras');extras.replaceChildren();
    extraFields.forEach(([key,label])=>{const field=document.createElement('label');field.className='field';field.dataset.extraField=key;field.textContent=label;field.hidden=true;
      const input=document.createElement('input');input.type='text';input.id='ocrExtra_'+key;input.placeholder=key==='specialDesignator'?'Ra / Rz / Rq':'';field.append(input);extras.append(field);
      input.oninput=()=>{const pending=options.getPending();if(!pending)return;pending.structuredEdits={...pending.structuredEdits,[key]:input.value.trim()};pending.requirementMode='auto';options.onChange();};
    });
  }
  function render(parsed){
    if(!config)return;const p=profile(parsed.type);
    const show=(id,visible)=>{$(id).closest('.field').hidden=!visible;};
    show('ocrUnit',p.unit);show('ocrNominal',p.nominal);show('ocrLowerTolerance',p.lower);show('ocrUpperTolerance',p.upper);show('ocrGeneralTolerance',p.general);
    document.querySelector('label[for="ocrUpperTolerance"]').textContent=parsed.type==='GD&T'?'TOLERANS BÖLGESİ':'ÜST TOLERANS';
    document.querySelector('label[for="ocrNominal"]').textContent=parsed.type==='Yüzey'?'PÜRÜZLÜLÜK DEĞERİ':parsed.type==='Pah'?'PAH UZUNLUĞU':'NOMİNAL';
    $('ocrTypeExtras').hidden=!p.extras.length;
    extraFields.forEach(([key])=>{const input=$('ocrExtra_'+key);input.closest('.field').hidden=!p.extras.includes(key);if(document.activeElement!==input)input.value=config.getPending()?.structuredEdits?.[key]??parsed[key]??'';});
    const pending=config.getPending();
    let evidence=$('ocrMeasurementEvidence');if(!evidence){evidence=document.createElement('small');evidence.id='ocrMeasurementEvidence';evidence.style.cssText='display:block;grid-column:1/-1;padding:4px;color:#416276';$('ocrTypeExtras').after(evidence);}
    evidence.hidden=parsed.type==='GD&T';evidence.textContent=parsed.type==='GD&T'?'':parsed.nominalSource==='limit_midpoint'?'Nominal ve sapmalar alt/üst limitlerden hesaplandı; çizimdeki limitler korunur.':parsed.measurementEvidence?.fields?.unit?.source==='drawing_default'?'Birim çizim varsayılanından alındı; kaynak çizimle doğrulayın.':'';
    if(!p.numeric&&pending&&!pending.methodManuallySelected){const methods=root.ASMachInspectionPlan.suggestions($('ocrRecognizedText').value);const recommended=methods.find(m=>m.recommended&&config.methods.some(k=>k.value===m.value));if(recommended){pending.previewMethod=recommended.value;$('ocrInspectionMethod').value=recommended.value;config.onMethod();}}
  }
  function sanitize(record){const p=profile(record.type);if(!p.numeric)return{...record,nominalValue:'',lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:'',unit:'',toleranceStandard:'',toleranceExplicit:false};if(record.type==='GD&T')return{...record,nominalValue:'',lowerTolerance:record.upperTolerance!==''?'0':'',lowerLimit:'',upperLimit:record.upperTolerance};return record;}
  root.ASMachOcrReviewControls={start,render,frequency,profile,sanitize};
})(window);
