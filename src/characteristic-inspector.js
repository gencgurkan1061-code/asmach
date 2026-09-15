/* The property sheet edits existing records transactionally; OCR remains a draft. */
(function(root){
 'use strict';
 let app,form,source,ocr,ocrMessage,numberMessage,planHost,planSummary,planEditor,planUi;
 let recordStamp='',documentKey=null,revision=0,sourceEditor;const pages=new Map();
 const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
 const measureKeys=['type','nominalValue','nominalSource','limitDimension','decimalPlaces','unit','lowerTolerance','upperTolerance','lowerLimit','upperLimit','toleranceStandard','toleranceExplicit','toleranceAmbiguous','parseWarnings','fitClass','threadClass','threadPitch','gdtSubtype','gdtFrame','datumRefs','referenceLength','specialDesignator','quantity','evaluationMethod','callout'];
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;}
 function button(host,id,text,action){const b=node('button','btn',text);b.id=id;b.type='button';b.onclick=action;host.append(b);return b;}
 function init(bridge){
  app=bridge;form=$('selectionForm');if(!form?.classList.contains('ip-panel'))return;
  form.querySelector('[role=tablist]').setAttribute('aria-label','Karakteristik özelliği bölümleri');
  form.querySelector('[role=tablist]').addEventListener('click',()=>{if(app.state.inlineReselectionId)sourceEditor?.cancel();});
  $('autoDetectButton')?.addEventListener('click',()=>sourceEditor?.cancel(),true);
  form.addEventListener('keydown',e=>{if(e.key==='Escape'&&app.state.inlineReselectionId){e.preventDefault();e.stopPropagation();sourceEditor?.cancel();}},true);
  const number=$('balloonNumber'),field=number.closest('.field');field.classList.add('ci-number');
  number.addEventListener('change',e=>e.stopImmediatePropagation(),true);
  const numberActions=node('div','ci-number-actions');field.append(numberActions);
  const applyNumber=async()=>{const r=app.selectedAnnotation();if(!r)return;const id=r.id,value=number.value;const save=$('ciNumberApply');save.disabled=true;try{await app.changeBalloonNumber(id,value);}finally{save.disabled=false;numberHint();}};
  button(numberActions,'ciNumberApply','Uygula',applyNumber);
  button(numberActions,'ciNumberFree','Boş no',()=>{number.value=root.ASMachBalloonNumbering.next(app.state.annotations);numberHint();number.focus();});
  numberMessage=node('div','ci-number-hint');numberMessage.id='ciNumberHint';numberMessage.setAttribute('role','status');field.append(numberMessage);number.oninput=numberHint;
  number.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void applyNumber();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();number.value=app.selectedAnnotation()?.number||'';numberHint();}});
  const data=$('ipDataPane'),sourceSection=node('section','ip-section ci-source');sourceSection.append(node('h3','','Kaynak görüntü'));source=node('div','ci-source-editor');sourceSection.append(source);data.prepend(sourceSection);
  const textSection=node('section','ip-section ci-ocr'),label=node('label','field');ocr=node('textarea');ocr.id='ciOcrText';ocr.rows=2;ocr.setAttribute('aria-label','Algılanan metin');label.append(ocr);textSection.append(label);
  const textActions=node('div','ci-inline-actions');button(textActions,'ciApplyOcr','Metinden ölçüleri güncelle',()=>{const r=app.selectedAnnotation();if(!r)return;try{applyReading(r,{text:ocr.value,source:'Özellik panelinde elle düzeltilen OCR',confidence:0},false);}catch(e){ocrMessage.textContent=e.message;}});textSection.append(textActions);ocrMessage=node('p','ci-help','');ocrMessage.setAttribute('role','status');textSection.append(ocrMessage);sourceSection.after(textSection);
  const desc=form.querySelector('label[for=requirement]');if(desc)desc.textContent='Gereklilik açıklaması';
  const oldSource=form.querySelector('.ip-source');if(oldSource){oldSource.querySelector('summary').textContent='Sayfa, zon ve kaynak bilgisi';$('selectionSnapshotImage')?.closest('.field')?.setAttribute('hidden','');}
  setupAutomaticText(textActions);
  planHost=node('section','ip-section ci-inspection');planHost.append(node('h3','','Operatör / kalite kontrol planı'));planSummary=node('div','ci-plan-summary');planHost.append(planSummary);
  button(planHost,'ciEditPlans','Planı burada düzenle',openPlans);planEditor=node('div','ci-plan-editor');planEditor.hidden=true;planHost.append(planEditor);$('ipControlPane').prepend(planHost);
  form.querySelector('.ip-frequency').hidden=true;
  const style=node('style');style.textContent=`
   #selectionForm.ip-panel .ip-identity{padding:9px 10px;gap:10px;align-items:start}#selectionForm.ip-panel .ci-number{width:145px;flex-shrink:0}#selectionForm.ip-panel .ci-number input{height:30px!important;font-size:16px!important;border-radius:5px!important}
   .ci-number-actions{display:flex;gap:4px;margin-top:4px}.ci-number-actions .btn{flex:1;padding:3px 5px!important;min-height:24px!important;font-size:10px!important}.ci-number-hint{font-size:9px;color:#587588;line-height:1.3;margin-top:3px}.ci-number-hint[data-conflict=true]{color:#a26800}
   #selectionForm .ip-scroll{padding:8px;scrollbar-gutter:auto}#selectionForm .ip-pane{gap:7px}#selectionForm .ip-section{padding:8px;border-radius:6px}#selectionForm .ip-section h3{margin-bottom:6px}#selectionForm .ip-grid{gap:6px}#selectionForm .ip-tabs{gap:4px;padding:0 8px}#selectionForm .ip-tabs button{min-height:30px;font-size:11px}
   #selectionForm .field input,#selectionForm .field select{height:28px;min-height:28px;font-size:11px}#selectionForm .field textarea{min-height:44px;font-size:11px}#selectionForm .ip-source .selection-snapshot,#selectionForm #selectionOcrText{display:none!important}
   .ci-source-editor{display:grid;gap:5px}.ci-source-editor [hidden]{display:none!important}.ci-source-editor .btn{font-size:10px;padding:3px 6px;min-height:25px}.ci-source-editor .wf-source-viewport{border-color:#cbdce6}.ci-source-editor .wf-source-draft input{width:100%;padding:5px;border:1px solid #b8d4df;border-radius:4px;font-size:11px}.ci-inline-actions{display:flex;gap:5px;margin-top:5px}.ci-inline-actions .btn{font-size:10px;min-height:25px;padding:3px 7px}.ci-help{font-size:10px;line-height:1.4;color:#5a7486;margin:5px 0 0}#selectionForm .ci-ocr>label{font-size:10px;font-weight:600;color:#55718a}
   .ci-plan-summary{display:grid;gap:5px;margin-bottom:7px}.ci-role-card{display:grid;gap:3px;background:#f4f8fb;border:1px solid #d5e3eb;border-left:3px solid #1090a1;padding:7px;border-radius:4px;font-size:10px}.ci-role-card strong{font-size:11px}.ci-role-card span{color:#4b697d}.ci-plan-editor{padding-top:7px;display:grid;gap:6px}.ci-plan-editor .role-plan-host{font-size:10px}.ci-plan-editor .role-plan-host input:not([type=checkbox]),.ci-plan-editor .role-plan-host select{padding:4px;min-height:27px;font-size:11px}.ci-plan-editor .role-plan-host .btn{font-size:10px;padding:4px}.ci-plan-editor fieldset{padding:7px!important}.ci-plan-editor [data-plan-error]{font-size:11px;color:#a13732}.ci-inspection>#ciEditPlans{width:100%;font-size:11px;min-height:28px}
  `;document.head.append(style);
 }
 function numberHint(){if(!app)return;const r=app.selectedAnnotation();if(!r)return;const plan=app.planNumberChange(r.id,$('balloonNumber').value);numberMessage.dataset.conflict=String(!!plan?.conflict);numberMessage.textContent=plan?.error|| (plan?.conflict?'Numara kullanımda. Uygula ile değiş tokuş / taşıma seçebilirsiniz.':plan?.changes.length?'Enter veya Uygula ile kaydedin. Esc: vazgeç.':'Kayıtlı numara · Boş no: ilk kullanılmayan numara');$('ciNumberApply').disabled=!!plan?.error||!plan?.conflict&&!plan?.changes.length;}
 function summary(record){
  planSummary.replaceChildren();const plans=root.ASMachRolePlans.normalize(record);
  for(const role of ['operator','quality']){const p=plans?.[role],card=node('div','ci-role-card');card.append(node('strong','',root.ASMachRolePlans.roles[role]));
   if(p?.enabled){card.append(node('span','',`${app.methodLabel(p.inspectionMethod)} · ${root.ASMachInspectionPlan.label(p)}`));const sample=root.ASMachRolePlans.sample(p,app.state.metadata?.inspectionReport?.lotSize,role);card.append(node('span','',sample.optional?'Numune adedi isteğe bağlı':sample.error?(p.sampleMode==='all'?'%100 kontrol':p.sampleMode==='manual'?`Numune: ${p.sampleCount||'belirtilmedi'}`:`Tablo seviyesi: ${p.sampleLevel}`):`Numune: ${sample.count}`));}
   else card.append(node('span','',plans?'Etkin değil':'Ayrı plan tanımlanmamış'));planSummary.append(card);
  }
  if(!plans)planSummary.append(node('p','ci-help',`Mevcut kontrol: ${app.methodLabel(record.inspectionMethod)} · ${root.ASMachInspectionPlan.label(record)}. Planı açarak operatör / kaliteye aktarabilirsiniz.`));
 }
 function openPlans(){const r=app.selectedAnnotation();if(!r)return;const stamp=JSON.stringify(r),key=app.state.fileData;planEditor.replaceChildren();planEditor.hidden=false;$('ciEditPlans').hidden=true;const host=node('div');planEditor.append(host);planUi=root.ASMachRolePlans.mount(host,r,app.getMethods(),()=>app.state.metadata?.inspectionReport?.lotSize);const error=node('p');error.dataset.planError='';error.setAttribute('role','alert');planEditor.append(error);const actions=node('div','ci-inline-actions');planEditor.append(actions);
  button(actions,'ciPlanCancel','Vazgeç',()=>{planEditor.hidden=true;$('ciEditPlans').hidden=false;});
  button(actions,'ciPlanSave','Kontrol planını uygula',()=>{if(key!==app.state.fileData||app.selectedAnnotation()!==r||JSON.stringify(r)!==stamp){error.textContent='Kayıt değişti. Planı yeniden açın.';return;}const plans=planUi.read();if(!plans){planEditor.hidden=true;$('ciEditPlans').hidden=false;return;}const message=root.ASMachRolePlans.validate({rolePlans:plans},app.state.metadata?.inspectionReport?.lotSize||undefined);if(message){error.textContent=message;return;}app.checkpoint();r.rolePlans=plans;app.recordChange('Özellik panelinden kontrol planı güncellendi',r);app.renderAll();});
 }
 function setupAutomaticText(actions){
  $('ciApplyOcr').hidden=true;
  let timer,composing=false;
  const schedule=()=>{clearTimeout(timer);if(composing)return;const r=app.selectedAnnotation(),key=app.state.fileData,text=ocr.value,start=ocr.selectionStart,end=ocr.selectionEnd;
   ocrMessage.textContent='Ölçüler güncelleniyor…';timer=setTimeout(()=>{if(app.selectedAnnotation()!==r||app.state.fileData!==key||ocr.value!==text)return;if(text.trim()===String(r?.ocrText||'').trim()){ocrMessage.textContent='';return;}try{applyReading(r,{text,source:'Özellik panelinde elle düzeltilen OCR',confidence:0,quiet:true},false);if(document.activeElement===ocr)ocr.setSelectionRange(start,end);ocrMessage.textContent='';}catch(e){ocrMessage.textContent=e.message+' Mevcut ölçüler korundu.';}},500);
  };
  ocr.addEventListener('input',schedule);ocr.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});ocr.addEventListener('compositionend',()=>{composing=false;schedule();});
  const palette=node('div','ci-symbol-palette');palette.id='ciSymbols';palette.setAttribute('popover','auto');palette.setAttribute('aria-label','Teknik resim sembolleri');document.body.append(palette);
  let range=[0,0];const trigger=button(actions,'ciSymbolsButton','Ω Sembol ekle',()=>{});trigger.setAttribute('popovertarget','ciSymbols');trigger.onclick=()=>{range=[ocr.selectionStart,ocr.selectionEnd];const rect=trigger.getBoundingClientRect();palette.style.left=Math.max(8,Math.min(rect.left,innerWidth-320))+'px';palette.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-330))+'px';};
  const groups=[['Ölçü',[['Ø','Çap'],['R','Yarıçap'],['±','Artı / eksi'],['°','Derece'],['×','Çarpı / adet'],['′','Açı dakikası'],['″','Açı saniyesi'],['≤','Küçük veya eşit'],['≥','Büyük veya eşit'],['|','Çerçeve ayırıcı']]],['GD&T',root.ASMachRequirements.GDT_TYPES.map(g=>[g.symbol,g.name||g.label])],['Koşullar',[['Ⓜ','Maksimum malzeme'],['Ⓛ','Minimum malzeme'],['Ⓢ','Boyuttan bağımsız'],['Ⓟ','İzdüşüm tolerans bölgesi'],['Ⓕ','Serbest durum']]],['Yüzey ve diş',[['Ra','Ortalama pürüzlülük'],['Rz','Pürüzlülük yüksekliği'],['M','Metrik diş'],['⌴','Silindirik havşa'],['⌵','Konik havşa'],['↧','Derinlik'],['□','Kare'],['△','Üçgen'],['⌀','Çap (alternatif)']]]];
  for(const [title,symbols] of groups){palette.append(node('strong','',title));const grid=node('div','ci-symbol-grid');palette.append(grid);for(const [symbol,name] of symbols){const b=node('button','btn',symbol);b.type='button';b.title=name||symbol;b.setAttribute('aria-label',name||symbol);b.onclick=()=>{ocr.focus();ocr.setRangeText(symbol,range[0],range[1],'end');range=[ocr.selectionStart,ocr.selectionEnd];ocr.dispatchEvent(new Event('input',{bubbles:true}));palette.hidePopover();};grid.append(b);}}
  const style=node('style');style.textContent='.ci-symbol-palette{position:fixed;inset:auto;margin:0;width:300px;max-height:310px;overflow:auto;padding:10px;border:1px solid #b9d3df;border-radius:7px;background:#fff;color:#23475b;box-shadow:0 5px 22px #173c5033}.ci-symbol-palette strong{display:block;font-size:11px;margin:6px 0}.ci-symbol-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}.ci-symbol-grid .btn{min-height:30px;padding:3px;font-size:16px}html body #selectionForm #ciApplyOcr[hidden]{display:none!important}';document.head.append(style);
 }
 function applyReading(r,edit,replaceBox){
  if(app.selectedAnnotation()!==r||(!app.state.annotations.includes(r)&&app.state.controlledDraft?.record!==r))throw Error('Seçili karakteristik değişti.');
  const text=String(edit.text||'').trim();if(!text)throw Error('Algılanan metin boş olamaz.');
  const parsed=app.parseRequirement(text);
  if(parsed.toleranceAmbiguous)throw Error(parsed.parseWarnings.join(' '));
  if(root.ASMachRequirements.fieldProfile(parsed.type).numeric&&![parsed.nominalValue,parsed.upperTolerance,parsed.lowerLimit,parsed.upperLimit].some(v=>v!=null&&String(v).trim()))throw Error('Ölçü metni doğrulanamadı. Nominal, tolerans veya limitleri kontrol edin.');
  let next={...r,...Object.fromEntries(measureKeys.map(k=>[k,parsed[k]??(['toleranceExplicit','toleranceAmbiguous'].includes(k)?false:k==='parseWarnings'?[]:'')])),ocrText:text,recognitionSource:edit.source||'Elle düzeltilen OCR',detectionConfidence:edit.confidence||0,result:'',resultStatus:'pending',status:'needs_review'};
  Object.assign(next,{originalOcrText:r.originalOcrText||edit.rawText||r.ocrText||text,ocrNeedsReview:edit.needsReview===true,ocrReviewReason:edit.needsReview?String(edit.reviewReason||'OCR sonucunu kaynak görüntü ile kontrol edin.'):''});
  for(const key of ['chamferAngle','chamferAngleTolerance','angleFormat','lowerInclusive','upperInclusive'])next[key]=parsed[key]??(key.endsWith('Inclusive')?true:'');
  next.manualFields=(r.manualFields||[]).filter(k=>![...measureKeys,'requirement','chamferAngle','chamferAngleTolerance','angleFormat','lowerInclusive','upperInclusive'].includes(k));
  next=root.ASMachRequirements.syncRequirement({...next,requirement:text,requirementMode:'auto'},true);
  if(replaceBox){const b=edit.box;if(!b||![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.w<=0||b.h<=0||b.x<0||b.y<0||b.x+b.w>1.000001||b.y+b.h>1.000001)throw Error('Geçerli bir kutu seçin.');next.selectionBox=clone(b);next.snapshot=edit.snapshot;next.anchorX=b.x+b.w/2;next.anchorY=b.y+b.h/2;next.bubbleX=Math.min(.98,b.x+b.w+.025);next.bubbleY=Math.max(.02,b.y-.025);
   if(Number.isFinite(edit.sourceTextHeight))next.sourceTextHeight=edit.sourceTextHeight;
   const page=pages.get(r.page);if(page&&root.ASMachAutomaticGeometry&&!root.ASMachAutomaticGeometry.place(next,page.width,page.height,app.state.annotations.filter(a=>a.id!==r.id),root.ASMachBalloonPlacement?.inkSampler(page)))throw Error('Yeni kutunun yanında balon için yer bulunamadı. Daha uygun bir bölge seçin.');
  }
  const errors=root.ASMachRequirements.consistencyErrors(next);if(errors.length)throw Error(errors.join(' · '));
  if(String(next.lowerLimit??'')!==''&&String(next.upperLimit??'')!==''&&Number(next.lowerLimit)>Number(next.upperLimit))throw Error('Alt limit üst limitten büyük olamaz.');
  app.checkpoint();Object.assign(r,app.normalizeAnnotation(next));app.state.inlineReselectionId=null;app.recordChange(replaceBox?'Karakteristik kaynak kutusu ve ölçüleri yenilendi':'Algılanan metinden ölçüler güncellendi',r);recordStamp='';app.renderAll();if(!edit.quiet)app.toast('Karakteristik güncellendi. Ölçü alanları ve gereklilik yenilendi; numara ve kontrol planı korundu.');
 }
 function partialPatch(r,edit){
  let text=root.ASMachRequirements.normalize(edit.text||'');
  const number='(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  if(edit.scope==='nominal'){
   if(r.type==='GD&T')throw Error('GD&T için nominal değer yoktur; tolerans okumasını kullanın.');
   // The user's explicit nominal-only selection supplies the missing field
   // boundary for singleton glyphs; complete separate values still fail.
   if(/^(?:[ØR]\s*)?[+-]?\d(?:[ \t]+\d)+\s*°?$/.test(text))text=text.replace(/[ \t]/g,'');
   if(!new RegExp('^(?:[ØR]\\s*)?[+-]?'+number+'\\s*°?$').test(text))throw Error('Yalnızca nominal sayıyı seçin; diğer alanlar değiştirilmedi.');
   return {nominalValue:String(Number(text.replace(/[ØΦøR°\s]/g,'')))};
  }
  if(edit.scope!=='tolerance')throw Error('Okuma alanı seçilmedi.');
  if(r.type==='GD&T'){
   if(!new RegExp('^(?:Ø\\s*)?'+number+'$').test(text))throw Error('GD&T tolerans sayısı okunamadı.');
   return {upperTolerance:String(Number(text.replace(/Ø\s*/,''))),lowerTolerance:'0'};
  }
  if(new RegExp('^±\\s*'+number+'$').test(text)){const n=Number(text.replace(/[±\s]/g,''));return{lowerTolerance:String(-n),upperTolerance:String(n)};}
  if(!new RegExp('^[+-]?\\s*'+number+'(?:(?:\\s+|\\s*/\\s*)[+-]?\\s*'+number+')?$').test(text))throw Error('Tolerans işaretleri okunamadı; mevcut değerler korundu.');
  const tokens=text.match(new RegExp('[+-]?\\s*'+number,'g'))||[],values=tokens.map(v=>Number(v.replace(/\s/g,'')));
  if(values.length===2&&values[0]>=values[1])return {upperTolerance:String(values[0]),lowerTolerance:String(values[1])};
  if(values.length===1&&values[0]!==0)return values[0]<0?{lowerTolerance:String(values[0])}:{upperTolerance:String(values[0])};
  throw Error('Üst ve alt tolerans ayrıştırılamadı. İkisini üstten alta sırasıyla seçin.');
 }
 function applyPartial(r,edit){
  if(app.selectedAnnotation()!==r||(!app.state.annotations.includes(r)&&app.state.controlledDraft?.record!==r))throw Error('Seçili karakteristik değişti.');
  const patch=partialPatch(r,edit),next={...r,...patch,result:'',resultStatus:'pending',status:'needs_review'};
  Object.assign(next,{originalOcrText:r.originalOcrText||r.ocrText||edit.rawText||edit.text||'',ocrNeedsReview:edit.needsReview===true,ocrReviewReason:edit.needsReview?String(edit.reviewReason||'Bölgesel OCR sonucunu kaynak görüntü ile kontrol edin.'):''});
  if(edit.scope==='tolerance')Object.assign(next,{toleranceExplicit:true,toleranceStandard:'Bölgesel OCR',toleranceAmbiguous:false,parseWarnings:[]});
  if(r.limitDimension&&edit.scope==='nominal'){
   next.nominalSource='manual';for(const [tol,limit] of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])next[tol]=String(Number((Number(next[limit])-Number(next.nominalValue)).toFixed(12)));
  }else if(r.type!=='GD&T'){
   if(edit.scope==='tolerance'){next.limitDimension=false;next.nominalSource='';}
   for(const [tol,limit]of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])next[limit]=next.nominalValue!==''&&next[tol]!==''?String(Number((Number(next.nominalValue)+Number(next[tol])).toFixed(10))):'';
  }
  const errors=root.ASMachRequirements.consistencyErrors(next);if(errors.length)throw Error(errors.join(' · '));
  if(next.lowerLimit!==''&&next.upperLimit!==''&&Number(next.lowerLimit)>Number(next.upperLimit))throw Error('Alt limit üst limitten büyük olamaz.');
  next.manualFields=[...new Set([...(r.manualFields||[]),...Object.keys(patch)])].filter(k=>k!=='requirement');
  const synced=root.ASMachRequirements.syncRequirement({...next,requirementMode:'auto'},true);synced.ocrText=synced.requirement;synced.recognitionSource=(edit.scope==='nominal'?'Nominal':'Tolerans')+' · bölgesel OCR';
  app.checkpoint();Object.assign(r,app.normalizeAnnotation(synced));app.state.inlineReselectionId=null;app.recordChange('Seçilen alandan '+edit.scope+' OCR güncellendi',r);recordStamp='';app.renderAll();
 }
 function applyCrop(r,edit){
  if(app.selectedAnnotation()!==r||(!app.state.annotations.includes(r)&&app.state.controlledDraft?.record!==r))throw Error('Seçili karakteristik değişti.');
  const b=edit.box;if(!b||![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.w<=0||b.h<=0||b.x<0||b.y<0||b.x+b.w>1.000001||b.y+b.h>1.000001)throw Error('Geçerli bir kırpma alanı seçin.');
  const center=b.points?.length===4?{x:b.points.reduce((sum,p)=>sum+p.x,0)/4,y:b.points.reduce((sum,p)=>sum+p.y,0)/4}:{x:b.x+b.w/2,y:b.y+b.h/2},next={...r,selectionBox:clone(b),snapshot:edit.snapshot||r.snapshot,anchorX:center.x,anchorY:center.y};
  // The crop is measured on a 360-DPI detail image, while sourceTextHeight is
  // the nominal glyph height in page pixels. Preserve that nominal measurement:
  // crop padding, tolerances and preview resolution must not resize the balloon.
  const page=pages.get(r.page),canvas=app.elements?.sourceCanvas;root.ASMachBalloonPlacement?.autoStyle(next,page?.width||canvas?.width||1,page?.height||canvas?.height||1);
  app.checkpoint();Object.assign(r,app.normalizeAnnotation(next));app.state.inlineReselectionId=null;app.recordChange('Karakteristik kaynak kutusu kırpıldı',r);recordStamp='';app.renderAll();app.toast('Aday ayrıntısı seçilen alana kırpıldı; ölçü ve kontrol bilgileri korundu.');
 }
 async function highResolutionDetail(r,box){
  if(!app.captureExact)return'';const captured=await app.captureExact(box,r.page);if(!box.points?.length||!app.loadImage||!root.ASMachSnapshots?._test?.extract)return captured;
  const image=await app.loadImage(captured),canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;canvas.getContext('2d').drawImage(image,0,0);const points=box.points.map(p=>({x:(p.x-box.x)/box.w*canvas.width,y:(p.y-box.y)/box.h*canvas.height})),cx=points.reduce((s,p)=>s+p.x,0)/4,cy=points.reduce((s,p)=>s+p.y,0)/4,w=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),h=Math.hypot(points[3].x-points[0].x,points[3].y-points[0].y),angle=Math.atan2(points[1].y-points[0].y,points[1].x-points[0].x)*180/Math.PI;return root.ASMachSnapshots._test.extract(canvas,{cx,cy,w,h,angle}).toDataURL('image/png');
 }
 async function update(r){
  if(!form)return;const key=app.state.pdfDoc||app.state.fileData;if(documentKey!==key){pages.clear();documentKey=key;recordStamp='';}
  const stamp=r?JSON.stringify(r):'';if(r&&recordStamp===stamp)return;recordStamp=stamp;const token=++revision;sourceEditor?.dispose();sourceEditor=null;
  if(!r){source.replaceChildren();return;}ocr.value=r.ocrText||'';ocrMessage.textContent=r.ocrNeedsReview?(r.ocrReviewReason||'OCR sonucunu kaynak görüntü ile kontrol edin.'):'';numberHint();summary(r);planEditor.hidden=true;$('ciEditPlans').hidden=false;
  source.textContent='Kaynak sayfa hazırlanıyor…';
  const current=()=>revision===token&&documentKey===key&&app.selectedAnnotation()===r&&JSON.stringify(r)===stamp;
  try{
   if(!pages.has(r.page)){const canvas=document.createElement('canvas');if(app.state.pdfDoc){const page=await app.state.pdfDoc.getPage(r.page),v=page.getViewport({scale:1.5});canvas.width=v.width;canvas.height=v.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;}else{canvas.width=app.elements.sourceCanvas.width;canvas.height=app.elements.sourceCanvas.height;canvas.getContext('2d').drawImage(app.elements.sourceCanvas,0,0);}if(!current())return;pages.set(r.page,canvas);}
   if(!current())return;const box=r.selectionBox||{x:Math.max(0,Math.min(.94,r.anchorX-.03)),y:Math.max(0,Math.min(.96,r.anchorY-.02)),w:.06,h:.04};let detailSnapshot='';try{detailSnapshot=await highResolutionDetail(r,box);}catch{/* Cached page crop remains available as a safe fallback. */}if(!current())return;const candidate={page:r.page,box,parsed:r,text:r.ocrText||r.requirement,pageImage:pages.get(r.page),snapshot:r.snapshot,detailSnapshot};source.replaceChildren();
   sourceEditor=root.ASMachCandidateSource.mount(source,{candidate,candidates:[candidate],isCurrent:current,parse:text=>app.parseRequirement(text,undefined,r.type==='Not'?'Not':''),onSelectionChange:selecting=>{if(selecting&&current())app.state.inlineReselectionId=r.id;else if(app.state.inlineReselectionId===r.id)app.state.inlineReselectionId=null;app.renderOverlay();},recognize:async edit=>{const result=await root.ASMachCandidateCorrection.recognize(app,candidate,edit);if(!current())throw Error('Kayıt veya belge değişti; sonuç uygulanmadı.');return result;},applyPartial:edit=>{if(!current())throw Error('Kayıt değişti.');applyPartial(r,edit);},crop:edit=>{if(!current())throw Error('Kayıt değişti.');applyCrop(r,edit);},apply:edit=>{if(!current())throw Error('Kayıt değişti.');applyReading(r,edit,true);}});
  }catch(e){if(current())source.textContent='Kaynak görüntü açılamadı: '+e.message;}
 }
 root.ASMachCharacteristicInspector={init,update,applyReading,applyPartial,applyCrop,partialPatch,cancelSource:()=>sourceEditor?.cancel()};
})(window);
