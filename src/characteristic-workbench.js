/* Desktop property workspaces: relocate live controls, never duplicate record state. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),pref='asmach.characteristic.workspace.v1';
 let app,settings={},inspectorTabs,detailTabs,ocrTabs,ready=false;
 function el(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;}
 function button(text,fn){const b=el('button','btn',text);b.type='button';b.onclick=fn;return b;}
 function remember(){try{root.ASMachPreferences.setItem(pref,JSON.stringify(settings));}catch{}}
 function menu(trigger,items,id){
  const popup=el('div','cw-menu');popup.id=id;popup.setAttribute('popover','auto');
  trigger.setAttribute('popovertarget',id);trigger.setAttribute('aria-expanded','false');
  trigger.after(popup);items.forEach(n=>popup.append(n));
  popup.addEventListener('beforetoggle',e=>{if(e.newState==='open'){const r=trigger.getBoundingClientRect();popup.style.left=Math.max(8,Math.min(innerWidth-220,r.left))+'px';popup.style.top=Math.max(8,Math.min(innerHeight-130,r.bottom+5))+'px';}});
  popup.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(popup.matches(':popover-open'))));
  popup.addEventListener('click',e=>{if(e.target.closest('button'))popup.hidePopover();});
  return popup;
 }
 // Hide only the group wrapper. Field-specific hidden flags belong to the data model.
 function tabs(host,entries,id){
  const nav=el('div','cw-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label',id==='cwInspector'?'Özellik bölümleri':'Düzenleme bölümleri');host.prepend(nav);
  let active=0;
  const buttons=entries.map(([name,pane],i)=>{pane.id ||= id+'Pane'+i;pane.classList.add('cw-pane');const b=button(name,()=>select(i));b.id=id+'Tab'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',pane.id);pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',b.id);nav.append(b);return b;});
  function select(i,focus=false){if(id==='cwInspector'&&i===1&&$('cwInlineSource')){select(3,focus);setSourceOpen(true);return;}active=i;entries.forEach(([,pane],j)=>pane.classList.toggle('cw-tab-hidden',j!==i));buttons.forEach((b,j)=>{b.setAttribute('aria-selected',String(j===i));b.tabIndex=j===i?0:-1;});if(focus)buttons[i].focus();root.ASMachCharacteristicInspector?.cancelSource?.();}
  nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const visible=buttons.map((b,i)=>b.hidden?-1:i).filter(i=>i>=0),pos=visible.indexOf(active);select(e.key==='Home'?visible[0]:e.key==='End'?visible.at(-1):visible[(pos+(e.key==='ArrowRight'?1:visible.length-1))%visible.length],true);});
  select(0);return {nav,select,entries,showAll(){entries.forEach(([,p])=>p.classList.remove('cw-tab-hidden'));buttons.forEach(b=>b.setAttribute('aria-selected','false'));if(id==='cwInspector'&&$('cwInlineSource'))setSourceOpen(true);},reveal(n){const i=entries.findIndex(([,p])=>p.contains(n));if(i>=0)select(i);}};
 }
 function resize(handle,read,write,save,direction=1){
  handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.tabIndex=0;
  handle.addEventListener('pointerdown',e=>{e.preventDefault();const start=e.clientX,width=read();handle.setPointerCapture(e.pointerId);const move=x=>write(width+(x.clientX-start)*direction),end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);save();};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);});
  handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();write(e.key==='Home'?360:read()+(e.key==='ArrowRight'?16:-16)*direction);save();});
 }
 function setupInspector(){
  const form=$('selectionForm'),scroll=form?.querySelector('.ip-scroll');if(!scroll)return;
  form.classList.add('cw-inspector');
  const groups=['Data','Source','Control','Style'].map(k=>[$('ip'+k+'Tab'),$('ip'+k+'Pane')]);
  const oldTools=form.querySelector('.ic-section-tools');oldTools.hidden=true;
  // Keep legacy section heading IDs as aliases for existing commands and integrations.
  inspectorTabs=tabs(form,[['Genel',groups[0][1].parentElement],['Kaynak',groups[1][1].parentElement],['Denetleme',groups[2][1].parentElement],['Balon',groups[3][1].parentElement]],'cwInspector');
  for(let i=0;i<groups.length;i++){const [b,p]=groups[i];p.hidden=false;b.hidden=true;b.onclick=()=>inspectorTabs.select(i);}
  const identity=form.querySelector('.ip-identity');identity.after(inspectorTabs.nav);
  const sectionMenu=button('Bölümler ▾');inspectorTabs.nav.after(sectionMenu);sectionMenu.classList.add('cw-sections-button');
  menu(sectionMenu,[button('Tümünü aç',()=>inspectorTabs.showAll()),button('Tümünü daralt',()=>{setSourceOpen(false);inspectorTabs.entries.forEach(([,p])=>p.classList.add('cw-tab-hidden'));inspectorTabs.nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected','false'));})],'cwInspectorSections');
  const num=form.querySelector('.ci-number'),actions=form.querySelector('.ci-number-actions');identity.append(num);num.append(...actions.children);actions.remove();
  // User-provided SVG Repo artwork; inherit button colors, including disabled states.
  const numberIcon=body=>'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="currentColor" style="display:block;flex-shrink:0;pointer-events:none">'+body+'</svg>';
  $('ciNumberFree').innerHTML=numberIcon('<path d="M12,23A11,11,0,1,0,1,12,11.013,11.013,0,0,0,12,23ZM12,3a9,9,0,1,1-9,9A9.01,9.01,0,0,1,12,3Zm2,9L8,16V8Zm3,4H15V8h2Z"/>');$('ciNumberFree').title='İlk kullanılmayan numarayı öner';$('ciNumberFree').setAttribute('aria-label','İlk kullanılmayan karakteristik numarasını öner');
  $('ciNumberApply').innerHTML=numberIcon('<path d="M12,2C6.5,2,2,6.5,2,12s4.5,10,10,10s10-4.5,10-10S17.5,2,12,2z M12,20c-4.5,0-8-3.5-8-8s3.5-8,8-8s8,3.5,8,8S16.5,20,12,20z"/><polygon points="9.8,16.8 6.1,13.2 7.5,11.7 9.8,14 15.5,7.9 17,9.3"/>');$('ciNumberApply').title='Numarayı uygula (Enter)';$('ciNumberApply').setAttribute('aria-label','Karakteristik numarasını uygula');
  const numberLabel=num.querySelector('label[for=balloonNumber]');if(numberLabel)numberLabel.textContent='Kar. No';$('balloonNumber').setAttribute('aria-label','Karakteristik numarası');
  const thumb=el('div','cw-balloon-thumb');thumb.id='cwBalloonThumb';thumb.title='Kayıtlı balon görünümü';num.prepend(thumb);
  const title=el('strong','cw-record-title');title.id='cwRecordTitle';const location=form.querySelector('.ip-location');location.prepend(title);
  const nav=el('div','cw-record-nav');nav.append(button('‹',()=>navigate(-1)),button('›',()=>navigate(1)));nav.children[0].setAttribute('aria-label','Önceki karakteristik');nav.children[1].setAttribute('aria-label','Sonraki karakteristik');num.append(nav);
  nav.children[0].innerHTML=numberIcon('<polygon points="17.2,23.7 5.4,12 17.2,0.3 18.5,1.7 8.4,12 18.5,22.3"/>');nav.children[1].innerHTML=numberIcon('<polygon points="6.8,23.7 5.4,22.3 15.7,12 5.4,1.7 6.8,0.3 18.5,12"/>');
  for(const b of nav.children){b.title=b.getAttribute('aria-label');b.querySelector('svg').setAttribute('width','16');b.querySelector('svg').setAttribute('height','16');}
  form.querySelector('.ip-source')&&$('ipSourcePane').append(form.querySelector('.ip-source'));
  const frame=el('div','acui-gdt cw-gdt');frame.id='cwInspectorGdt';$('ipDataPane').querySelector('.ip-classification').append(frame);
  const mode=el('small','cw-mode');mode.id='cwRequirementMode';form.querySelector('.ip-description').prepend(mode);
  $('ipMeasurement').querySelector('h3').textContent='Değerler';
  compactFields(form);
  const positions=el('section','cw-position');positions.innerHTML='<strong>Balon konumu</strong><div class="cw-position-grid"></div><small>Yönler sayfaya göredir. Seçtiğiniz tarafta yer yoksa mevcut konum korunur. Yeni balonlarda sol taraf tercih edilir.</small>';
  const positionsGrid=positions.querySelector('div');
  for(const [value,label,glyph] of [['top-left','Sol üst','↖'],['top','Üst','↑'],['top-right','Sağ üst','↗'],['left','Sol','←'],['','Karakteristik','Ölçü'],['right','Sağ','→'],['bottom-left','Sol alt','↙'],['bottom','Alt','↓'],['bottom-right','Sağ alt','↘']]){if(!value){positionsGrid.append(el('span','',glyph));continue;}const b=button(glyph,async()=>{const r=app.selectedAnnotation();if(!r)return;if(r.page!==app.state.currentPage&&!app.state.controlledDraft)await app.focusAnnotation(r.id);app.setBalloonSide(value);});b.title=label;b.setAttribute('aria-label','Balonu '+label.toLocaleLowerCase('tr')+' konuma yerleştir');positionsGrid.append(b);}
  $('ipStylePane').prepend(positions);
  const positionStyle=el('style');positionStyle.textContent='.cw-position{display:grid;gap:7px;margin:8px 0;padding:8px;border:1px solid #cbdde6;border-radius:5px}.cw-position-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.cw-position-grid .btn{height:30px;min-height:30px;padding:2px;font-size:18px}.cw-position-grid span{text-align:center;align-self:center;font-size:11px}.cw-position small{font-size:10px;color:#527187}';document.head.append(positionStyle);
  inlineSource(form);
  const footer=form.querySelector('.ip-footer'),row=form.querySelector('.form-actions');
  const duplicate=$('duplicateButton'),repeat=$('repeatCharacteristicButton');
  const legacy=el('div');legacy.hidden=true;legacy.append(duplicate,repeat);footer.append(legacy);
  const quantityLabel=el('label','cw-quantity','Miktar'),quantity=el('input');quantity.id='cwQuantity';quantity.type='number';quantity.min='1';quantity.max='1000';quantity.step='1';quantity.setAttribute('aria-label','Karakteristik miktarı');quantity.title='1: ana kayıt. 2 ve üzeri: bu sayıda alt numaralı liste kaydı; çizime balon eklenmez.';quantityLabel.append(quantity);row.prepend(quantityLabel);
  quantity.onchange=async()=>{const r=app.selectedAnnotation();if(!r)return;try{if(app.state.controlledDraft){const count=Number(quantity.value);if(!Number.isInteger(count)||count<1||count>1000)throw Error('Miktar 1–1000 arasında olmalı.');r.quantity=count;if($('cwQuantityBalloons'))$('cwQuantityBalloons').disabled=count<2;quantity.setCustomValidity('');return;}await root.ASMachRepeatedCharacteristics.setQuantity(app,r.id,Number(quantity.value));quantity.setCustomValidity('');update(app.selectedAnnotation());}catch(e){quantity.setCustomValidity(e.message);quantity.reportValidity();}};quantity.oninput=()=>quantity.setCustomValidity('');
  const quantityToggle=el('label','cw-quantity','Çoklu balon'),quantityCheck=el('input');quantityCheck.id='cwQuantityBalloons';quantityCheck.type='checkbox';quantityCheck.title='Açık: miktar kadar .1, .2 balonu. Kapalı: çizimde tek ana numara; liste kayıtları korunur.';quantityToggle.prepend(quantityCheck);quantityLabel.after(quantityToggle);quantityCheck.onchange=()=>{const r=app.selectedAnnotation();if(app.state.controlledDraft&&r){r.showQuantityBalloons=quantityCheck.checked;return;}if(r)root.ASMachRepeatedCharacteristics.showBalloons(app,r.id,quantityCheck.checked);};
  $('centerBubbleButton').textContent='Çizimde göster';$('acuiDetailsOpen').textContent='Ayrıntılı düzenle ↗';footer.append(row);
  const inspector=form.closest('.inspector'),handle=el('div','cw-inspector-resize');handle.setAttribute('aria-label','Özellik paneli genişliği');inspector.prepend(handle);
  const set=w=>{settings.inspector=Math.round(Math.max(320,Math.min(520,innerWidth*.46,w)));document.documentElement.style.setProperty('--cw-inspector-width',settings.inspector+'px');handle.setAttribute('aria-valuenow',settings.inspector);};
  set(settings.inspector||360);resize(handle,()=>inspector.getBoundingClientRect().width,set,remember,-1);
 }
 function navigate(offset){
  const records=app.state.annotations,index=records.findIndex(r=>r.id===app.state.selectedId),next=records[index+offset];if(!next)return;
  root.ASMachCharacteristicInspector?.cancelSource?.();void app.focusAnnotation(next.id);
 }
 function update(record){
  updateLocalStyle(record);
  if(record&&$('measurementUnit')){
   const unitControl=$('measurementUnit'),type=root.ASMachRequirements.normalizeType(record.type);
   const choices=root.ASMachCharacteristicEditing.unitsForType(type);
   const current=String(record.unit??'');const key=JSON.stringify([type,current]);
   if(unitControl.dataset.unitOptions!==key){unitControl.replaceChildren();for(const value of choices){const option=el('option','',value||'—');option.value=value;unitControl.append(option);}if(!choices.includes(current)){const option=el('option','','Birim seçin');option.value='';option.disabled=true;unitControl.prepend(option);}unitControl.dataset.unitOptions=key;}
   unitControl.value=choices.includes(current)?current:'';unitControl.title='Türe uygun birimler. Birim değişikliği sayısal değerleri dönüştürmez.';
   let precision=$('cwDecimalPlaces');
   if(!precision){
    const unit=$('measurementUnit'),wrap=el('div','cw-unit-precision');unit.after(wrap);wrap.append(unit);
    precision=el('select');precision.id='cwDecimalPlaces';precision.setAttribute('aria-label','Ondalık basamak');precision.title='Ondalık basamak: anlamlı hassasiyet korunur, eksik basamaklar sıfırla tamamlanır.';
    for(const [value,label] of [['','Oto'],...Array.from({length:7},(_,i)=>[String(i),i?'.'+'0'.repeat(i-1)+'1':'1'])]){const o=el('option','',label);o.value=value;precision.append(o);}wrap.append(precision);
    precision.onchange=()=>{const selected=app.selectedAnnotation();if(!selected)return;app.checkpoint();const decimalPlaces=precision.value===''?null:Number(precision.value),updated=root.ASMachRequirements.syncRequirement({...selected,decimalPlaces,requirementMode:'auto'},true);Object.assign(selected,updated);app.recordChange('Ondalık gösterim ve gereklilik güncellendi',selected);app.renderAll();};
    const css=el('style');css.textContent='.cw-unit-precision{grid-column:2!important;grid-row:1!important;display:flex;gap:4px;min-width:0}html body #selectionForm.cw-inspector.cw-dense .ip-classification .field.cw-unit{display:grid!important;align-items:center!important}.cw-unit>label,.cw-unit>.cw-field-label{grid-column:1!important;grid-row:1!important;align-self:center!important}.cw-unit-precision #measurementUnit{width:40px!important;min-width:0!important}.cw-unit-precision select{width:53px!important;min-width:0!important;padding:3px!important}html body #selectionForm.cw-inspector.cw-dense .ip-classification{grid-template-columns:minmax(0,1fr) 129px!important}';document.head.append(css);
   }
   precision.value=record.decimalPlaces??'';
  }
  if($('cwQuantity')&&record){const parent=record.parentCharacteristicId?app.state.annotations.find(r=>r.id===record.parentCharacteristicId)||record:record,children=app.state.annotations.filter(r=>!r.measurementComponent&&r.parentCharacteristicId===parent.id);$('cwQuantity').value=children.length?children.length+1:parent.quantity||1;$('cwQuantity').title='Toplam karakteristik adedi. 2 için .1 ve .2 oluşturulur.';if($('cwQuantityBalloons')){$('cwQuantityBalloons').checked=!!parent.showQuantityBalloons;$('cwQuantityBalloons').disabled=Number(parent.quantity)<2;}}
  if(!ready||!record)return;$('cwRecordTitle').textContent='Karakteristik #'+record.number;
  updateBalloonThumb(record);
  const nav=document.querySelector('.cw-record-nav'),i=app.state.annotations.findIndex(r=>r.id===record.id);nav.children[0].disabled=i<=0;nav.children[1].disabled=i>=app.state.annotations.length-1;
  $('cwRequirementMode').textContent=record.requirementMode==='manual'?'Elle düzenlenen gereklilik':'Alanlardan oluşturulan gereklilik';
  const frame=$('cwInspectorGdt');frame.replaceChildren();frame.hidden=record.type!=='GD&T';
  if(!frame.hidden)frame.innerHTML=root.ASMachGdtReport.markup(record,30);
  document.querySelectorAll('option[value="parallelism"]').forEach(o=>o.textContent=o.textContent.replace(/∥|‖/g,'//'));
  updateFields(record);
  $('cwSourceCaption').textContent='#'+record.number+' · Sayfa '+record.page+(record.zone?' · '+record.zone:'');
 }
 function setSourceOpen(open){const content=$('ipSourcePane'),restore=!open&&(content.contains(document.activeElement)||document.activeElement===$('cwSourceGrow'));content.hidden=!open;$('cwSourceToggle').setAttribute('aria-expanded',String(open));$('cwSourceGrow').hidden=!open;settings.sourceOpen=open;remember();if(!open)root.ASMachCharacteristicInspector?.cancelSource?.();if(restore)$('cwSourceToggle').focus();}
 function inlineSource(form){
  const pane=$('ipSourcePane'),old=pane.parentElement,fold=el('section','cw-inline-source');fold.id='cwInlineSource';
  const header=el('div','cw-source-heading'),toggle=button('Kaynak görüntüsü',()=>setSourceOpen(pane.hidden));toggle.id='cwSourceToggle';toggle.setAttribute('aria-controls',pane.id);
  const caption=el('span','cw-source-caption');caption.id='cwSourceCaption';caption.hidden=true;toggle.append(caption);
  const grow=button('Genişlet',()=>{const expanded=fold.classList.toggle('cw-source-large');grow.title=expanded?'Küçült':'Genişlet';grow.setAttribute('aria-label',grow.title);grow.setAttribute('aria-pressed',String(expanded));settings.sourceLarge=expanded;remember();});grow.id='cwSourceGrow';grow.setAttribute('aria-pressed',String(!!settings.sourceLarge));if(settings.sourceLarge){fold.classList.add('cw-source-large');grow.textContent='Küçült';}
  fold._sourceGrow=grow;grow.title='Genişlet / küçült';grow.setAttribute('aria-label','Kaynak görüntüsünü genişlet / küçült');grow.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
  header.append(toggle,grow);fold.append(header,pane);$('ipDataPane').prepend(fold);old.hidden=true;
  $('cwInspectorTab1').hidden=true;$('cwInspectorTab1').removeAttribute('role');pane.removeAttribute('aria-labelledby');pane.setAttribute('aria-labelledby',toggle.id);pane.setAttribute('role','region');
  const ocr=form.querySelector('.ci-ocr'),text=el('section','cw-source-text');ocr.before(text);text.append(ocr);
  const metadata=form.querySelector('details.ip-source');if(metadata){const info=el('section','ip-source cw-source-info');for(const child of [...metadata.children])if(child.tagName!=='SUMMARY')info.append(child);metadata.replaceWith(info);}
  setSourceOpen(settings.sourceOpen===true);
  // Label text nodes must occupy a predictable grid cell, including wrapped labels.
  form.querySelectorAll('label.field').forEach(label=>{const text=[...label.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());if(text.length){const span=el('span','cw-field-label',text.map(n=>n.textContent.trim()).join(' '));text.forEach(n=>n.remove());label.prepend(span);}});
  const general=form.querySelector('.ic-advanced'),body=el('div','cw-general-body');for(const n of [...general.children])if(n.tagName!=='SUMMARY')body.append(n);general.append(body);
 }
 const extraSpecs=[['chamferAngle','Pah açısı (°)',['Pah'],true],['chamferAngleTolerance','Açı ± (°)',['Pah'],true],['threadPitch','Diş adımı',['Diş'],true],['threadClass','Diş sınıfı',['Diş'],false],['threadStandard','Diş standardı',['Diş'],false],['fitClass','Geçme sınıfı',['Geçme'],false],['specialDesignator','Yüzey parametresi',['Yüzey'],false]];
 const threadStandards=['ISO 261','ISO 261 / ISO 965-1','ISO 2902','ISO 2902 / ISO 2903','ASME B1.1','ASME B1.20.1','ASME B1.20.3','ISO 228-1','ISO 7-1'];
 function compactFields(form){
  form.classList.add('cw-dense');
  const classification=form.querySelector('.ip-classification'),unit=$('measurementUnit').closest('.field');classification.append(unit);unit.classList.add('cw-unit');
  $('characteristicType').closest('.field').classList.add('cw-type');
  const section=el('section','ip-section ip-grid cw-type-fields');section.id='cwTypeFields';$('ipMeasurement').after(section);
  for(const [key,label,types,numeric] of extraSpecs){const field=el('label','field',label),input=el(key==='threadStandard'?'select':'input');input.id='cwExtra_'+key;if(key!=='threadStandard')input.type='text';input.setAttribute('aria-label',label);if(numeric)input.inputMode='decimal';field.append(input);section.append(field);
   if(key==='threadStandard'){field.style.gridColumn='1 / -1';for(const value of ['',...threadStandards]){const option=el('option','',value||'Belirtilmedi');option.value=value;input.append(option);}input.title='Diş standardını seçin. Özel bir standart karakteristik ayrıntılarından girilebilir.';}
   input.addEventListener('change',()=>{const r=app.selectedAnnotation();if(!r||!types.includes(r.type))return;const value=input.value.trim(),normalized=value.replace(',','.');
    if(numeric&&value&&(!Number.isFinite(Number(normalized))||Number(normalized)<0||(key==='chamferAngle'&&Number(normalized)>180))){input.setCustomValidity('Geçerli, negatif olmayan bir değer girin. Açı en fazla 180° olabilir.');input.reportValidity();return;}input.setCustomValidity('');
    app.checkpoint();let next={...r,[key]:numeric?normalized:value,manualFields:[...new Set([...(r.manualFields||[]),key])]};next=root.ASMachRequirements.syncRequirement(next,true);Object.assign(r,next);app.recordChange('Türe özel alan ve gereklilik güncellendi',r);app.renderAll();
   });input.addEventListener('input',()=>input.setCustomValidity(''));
  }
  const menuButton=form.querySelector('.cw-sections-button');inspectorTabs.nav.append(menuButton);menuButton.textContent='⋯';menuButton.title='Bölümleri aç / daralt';menuButton.setAttribute('aria-label','Bölüm seçenekleri');
  setupGdtFields();
  const surfaceInput=$('cwExtra_specialDesignator');
  if(surfaceInput){const choices=el('datalist');choices.id='cwSurfaceParameters';for(const value of ['Ra','Rz','Rq','Rt','Rp','Rv','Rmax','RzJIS','RMS','CLA','RSm','Rsk','Rku','Wa','Wq','Wt','Pa','Pq','Pt']){const option=el('option');option.value=value;choices.append(option);}surfaceInput.setAttribute('list',choices.id);surfaceInput.placeholder='Ra, Rz…';surfaceInput.title='Yüzey parametresi; ölçü birimini ayrı Birim alanından seçin.';surfaceInput.after(choices);}
  setupStandards();
  setupCalloutFields();
  const hint=$('ciNumberHint');hint.title='Balon numarasını Uygula ile kaydedin. İlk boş no kullanılmayan numarayı önerir.';
  const help=$('ipExtended').querySelector(':scope>small');if(help){help.title=help.textContent;help.classList.add('cw-limit-help');}
 }
 function updateFields(record){
  updateCalloutFields(record);
  updateStandards(record);
  updateGdtFields(record);
  let angleMode=$('cwAngleFormat');
  if(!angleMode){
    const field=el('label','field');field.id='cwAngleFormatField';field.append(el('span','cw-field-label','Açı girişi'));angleMode=el('select');angleMode.id='cwAngleFormat';angleMode.setAttribute('aria-label','Açı giriş ve gösterim biçimi');
    for(const [v,t] of [['decimal','Ondalık derece (°)'],['dms','Derece · dakika · saniye (° ′ ″)']]){const o=el('option','',t);o.value=v;angleMode.append(o);}field.append(angleMode);$('ipMeasurement').before(field);
    angleMode.onchange=()=>{const r=app.selectedAnnotation();if(!r)return;app.checkpoint();Object.assign(r,root.ASMachRequirements.syncRequirement({...r,angleFormat:angleMode.value,unit:'°'},true));app.recordChange('Açı giriş biçimi ve gereklilik güncellendi',r);app.renderAll();};
  }
  $('cwAngleFormatField').hidden=record.type!=='Açı';angleMode.value=record.angleFormat||'decimal';
  for(const key of ['nominalValue','lowerTolerance','upperTolerance']){const input=$(key);input.setCustomValidity('');input.inputMode=record.type==='Açı'?'text':'decimal';input.placeholder=record.type==='Açı'&&record.angleFormat==='dms'?'0° 0′ 0″':'';if(record.type==='Açı'&&record.angleFormat==='dms')input.value=root.ASMachRequirements.formatAngle(record[key]);}
  const type=record.type,profile=root.ASMachRequirements.fieldProfile(type),form=$('selectionForm');
  form.dataset.characteristicType=type;
  $('measurementUnit').closest('.field').hidden=!profile.unit;
  for(const [key,,types] of extraSpecs){const input=$('cwExtra_'+key);input.closest('.field').hidden=!types.includes(type);const value=String(record[key]??'');
   if(key==='threadStandard'){input.querySelectorAll('[data-custom-standard]').forEach(option=>option.remove());if(value&&!threadStandards.includes(value)){const option=el('option','',value);option.value=value;option.dataset.customStandard='true';input.append(option);}}
   input.value=value;input.setCustomValidity('');}
  $('cwTypeFields').hidden=!extraSpecs.some(s=>s[2].includes(type));
  $('lowerTolerance').closest('.field').hidden=!profile.numeric||['GD&T','Diş'].includes(type);
  $('upperTolerance').closest('.field').hidden=!profile.numeric||type==='Diş';
  form.querySelector('label[for=upperTolerance]').textContent=type==='GD&T'?'Tolerans':'Üst tol.';
  const derivedNominal=record.nominalSource==='limit_midpoint';
  form.querySelector('label[for=nominalValue]').textContent=derivedNominal?'Nominal*':type==='Pah'?'Pah boyu':type==='Diş'?'Çap':type==='Yüzey'?'Pürüzlülük':'Nominal';
  $('nominalValue').title=derivedNominal?'Alt ve üst limitin orta noktasından hesaplandı; çizimden ayrı bir nominal okunmadı.':'';
  let nominalHint=$('cwDerivedNominalHint');
  if(!nominalHint){nominalHint=el('small','ci-help');nominalHint.id='cwDerivedNominalHint';nominalHint.style.cssText='grid-column:1/-1;margin:0;color:#526d80;font-size:10px;line-height:1.3';$('nominalValue').closest('.cw-value-line')?.after(nominalHint);}
  nominalHint.hidden=!derivedNominal;nominalHint.textContent=derivedNominal?'* Nominal, limitlerin orta noktasından hesaplandı.':'';
  form.querySelector('label[for=requirement]').textContent=type==='Datum'?'Datum tanımı':type==='Not'?'Not metni':'Gereklilik';
  $('ipMeasurement').querySelector('.ip-grid').style.gridTemplateColumns=type==='GD&T'?'minmax(0,1fr)':'';
  // Selection of another type changes presentation, not the stored values for hidden fields.
 }
 function setupGdtFields(){
  const section=el('section','ip-section cw-gdt-fields');section.id='cwGdtFields';$('ipDataPane').querySelector('.ip-classification').after(section);
  const tolerance=$('upperTolerance').closest('.field'),home=el('span');home.id='cwToleranceHome';home.hidden=true;tolerance.before(home);
  const add=(id,label,items)=>{const field=el('label','field',label),input=el('select');input.id=id;input.setAttribute('aria-label',label);for(const [value,text] of items){const option=el('option','',text);option.value=value;input.append(option);}field.append(input);section.append(field);return input;};
  const zone=add('cwGdtZone','Bölge',[['','Çap işareti yok'],['diameter','Ø Çaplı bölge']]);
  const material=add('cwGdtMaterial','Malzeme',[['','Belirtilmedi'],['Ⓜ','Ⓜ Maksimum malzeme'],['Ⓛ','Ⓛ Minimum malzeme'],['Ⓢ','Ⓢ Boyuttan bağımsız']]);
  const commit=()=>{const r=app.selectedAnnotation();if(r?.type!=='GD&T')return;app.checkpoint();const frame={...(r.gdtFrame||{}),diameter:zone.value==='diameter',modifiers:[...(r.gdtFrame?.modifiers||[]).filter(m=>!['Ⓜ','Ⓛ','Ⓢ'].includes(m)),...(material.value?[material.value]:[])]};Object.assign(r,root.ASMachRequirements.syncRequirement(root.ASMachRequirements.withGdtSubtype({...r,gdtFrame:frame,manualFields:[...new Set([...(r.manualFields||[]),'gdtFrame'])]}),true));app.recordChange('GD&T tolerans bölgesi güncellendi',r);app.renderAll();};
  zone.onchange=commit;material.onchange=commit;
  const toleranceRow=el('div','cw-gdt-row');toleranceRow.id='cwGdtToleranceRow';section.prepend(toleranceRow);toleranceRow.append(material.closest('.field'));material.closest('.field').classList.add('cw-gdt-condition');
  for(let i=0;i<3;i++){const control=add('cwGdtDatum'+i,'Datum '+(i+1),[['','Koşul yok'],['Ⓜ','Ⓜ Maksimum malzeme'],['Ⓛ','Ⓛ Minimum malzeme']]);control.onchange=()=>{const r=app.selectedAnnotation();if(r?.type!=='GD&T')return;const tokens=root.ASMachRequirements.datumTokens(r.datumRefs||'');if(!tokens[i])return;tokens[i]=tokens[i].replace(/[ⓂⓁ]/g,'')+control.value;app.checkpoint();Object.assign(r,root.ASMachRequirements.syncRequirement(root.ASMachRequirements.withGdtSubtype({...r,datumRefs:tokens.join(' | '),manualFields:[...new Set([...(r.manualFields||[]),'datumRefs'])]}),true));app.recordChange('Datum malzeme koşulu güncellendi',r);app.renderAll();};}
  const hint=el('small','ci-help','İşaretin seçilen tür ve çizim standardına uygunluğunu kontrol edin. Ek tolerans otomatik hesaplanmaz.');hint.hidden=true;section.append(hint);material.closest('.field').title=hint.textContent;
  const datumHelp=el('small','ci-help','Datum koşulu için harften sonra Ⓜ veya Ⓛ ekleyebilirsiniz: AⓂ | B | C.');section.append(datumHelp);
  datumHelp.hidden=true;
  for(let i=0;i<3;i++){const condition=$('cwGdtDatum'+i),row=el('div','cw-gdt-row'),label=el('label','field','Datum '+(i+1)),input=el('input');input.id='cwGdtRef'+i;input.setAttribute('aria-label','Datum '+(i+1)+' referansı');input.placeholder=['A','B','C'][i];label.append(input);condition.closest('.field').before(row);row.append(label,condition.closest('.field'));condition.closest('.field').classList.add('cw-gdt-condition');
   const save=()=>{const r=app.selectedAnnotation();if(r?.type!=='GD&T')return;const refs=[0,1,2].map(j=>$('cwGdtRef'+j).value.trim().toUpperCase());if(refs.some((v,j)=>v&&!/^[A-Z](?:-[A-Z])?$/.test(v)||v&&refs.slice(0,j).includes(''))){input.setCustomValidity('Datumları sırayla A veya A-B biçiminde girin.');input.reportValidity();return;}input.setCustomValidity('');const old=root.ASMachRequirements.datumTokens(r.datumRefs||'');const tokens=refs.map((v,j)=>v?v+[...(old[j]||'')].filter(m=>['Ⓢ','Ⓟ','Ⓕ'].includes(m)).join('')+$('cwGdtDatum'+j).value:'').filter(Boolean);app.checkpoint();Object.assign(r,root.ASMachRequirements.syncRequirement(root.ASMachRequirements.withGdtSubtype({...r,datumRefs:tokens.join(' | '),manualFields:[...new Set([...(r.manualFields||[]),'datumRefs'])]}),true));app.recordChange('GD&T datumları güncellendi',r);app.renderAll();};input.onchange=save;input.oninput=()=>input.setCustomValidity('');condition.onchange=save;
  }
  const distribution=add('cwProfileDistribution','Dağılım',[['','Eşit dağılım'],['Ⓤ','Eşit olmayan dağılım · ASME'],['UZ','Eşit olmayan dağılım · ISO']]),offsetLabel=el('label','field','Dağılım değeri'),offset=el('input');offset.id='cwProfileOffset';offset.inputMode='decimal';offset.setAttribute('aria-label','Profil dağılım değeri');offsetLabel.append(offset);section.append(offsetLabel);
  distribution.closest('.field').classList.add('cw-distribution-field');offsetLabel.classList.add('cw-distribution-field');
  const saveDistribution=()=>{const r=app.selectedAnnotation();if(r?.type!=='GD&T')return;const v=offset.value.trim().replace(',','.');if(distribution.value&&(!v||!Number.isFinite(Number(v))||(distribution.value==='Ⓤ'&&(Number(v)<0||Number(v)>Number(r.upperTolerance))))){offset.setCustomValidity('Geçerli dağılım değeri girin. ASME U değeri 0 ile toplam tolerans arasında olmalı.');offset.reportValidity();return;}offset.setCustomValidity('');app.checkpoint();const frame={...r.gdtFrame,distribution:distribution.value?{symbol:distribution.value,value:v}:null};Object.assign(r,root.ASMachRequirements.syncRequirement(root.ASMachRequirements.withGdtSubtype({...r,gdtFrame:frame}),true));app.recordChange('Profil dağılımı güncellendi',r);app.renderAll();};distribution.onchange=()=>{offsetLabel.hidden=!distribution.value;if(distribution.value&&!offset.value){offset.focus();return;}saveDistribution();};offset.onchange=saveDistribution;offset.oninput=()=>offset.setCustomValidity('');
  section.append($('cwInspectorGdt'));const description=$('ipDataPane').querySelector('.ip-description'),descriptionHome=el('span');descriptionHome.id='cwDescriptionHome';descriptionHome.hidden=true;description.before(descriptionHome);
 }
 function updateGdtFields(record){
  const section=$('cwGdtFields');if(!section)return;section.hidden=record.type!=='GD&T';const tolerance=$('upperTolerance').closest('.field'),description=$('selectionForm').querySelector('.ip-description');if(section.hidden){const valueLine=$('cwCharacteristicInfo')?.querySelector('.cw-value-line');if(valueLine)valueLine.append(tolerance);else $('cwToleranceHome').after(tolerance);$('cwDescriptionHome').after(description);return;}$('cwGdtToleranceRow').prepend(tolerance);section.after(description);
  const subtype=record.gdtSubtype||record.gdtFrame?.subtype,frame=record.gdtFrame||{};
  const distribution=$('cwProfileDistribution');distribution.closest('.field').hidden=!['profile','profile_surface'].includes(subtype)&&!frame.distribution;distribution.value=frame.distribution?.symbol||'';for(const o of distribution.options)o.disabled=!!o.value&&((record.drawingStandard==='ISO'&&o.value==='Ⓤ')||(record.drawingStandard==='ASME'&&o.value==='UZ'));$('cwProfileOffset').value=frame.distribution?.value||'';$('cwProfileOffset').closest('.field').hidden=!frame.distribution;distribution._refreshIcon?.();
  $('cwGdtZone').value=frame.diameter?'diameter':'';$('cwGdtMaterial').value=(frame.modifiers||[]).find(m=>['Ⓜ','Ⓛ','Ⓢ'].includes(m))||'';
  const materialAllowed=['position','straightness','flatness','parallelism','perpendicularity','angularity'].includes(subtype);for(const option of $('cwGdtMaterial').options)option.disabled=!!option.value&&(!materialAllowed||(record.drawingStandard==='ASME'&&option.value==='Ⓢ'));
  $('cwGdtMaterial').title=materialAllowed?'Ölçü özelliğine ve çizim standardına göre doğrulayın.':'Bu türde yeni malzeme koşulu seçimi kapalıdır; önceki koşul varsa inceleyin veya temizleyin.';
  // Keep existing annotations editable even when they need review after a type change.
  const zoneTypes=['position','straightness','perpendicularity','parallelism','angularity','concentricity'];
  $('cwGdtZone').closest('.field').hidden=!zoneTypes.includes(subtype)&&!frame.diameter;
  const tokens=root.ASMachRequirements.datumTokens(record.datumRefs||'');for(let i=0;i<3;i++){const control=$('cwGdtDatum'+i);control.closest('.field').hidden=false;control.value=[...(tokens[i]||'')].find(m=>['Ⓜ','Ⓛ'].includes(m))||'';control.disabled=!tokens[i];control.title=tokens[i]||'';$('cwGdtRef'+i).value=(tokens[i]||'').replace(/[ⓂⓁⓈⓅⒻ]/g,'');}
  for(const id of ['cwGdtMaterial','cwGdtDatum0','cwGdtDatum1','cwGdtDatum2'])$(id)._refreshIcon?.();
 }
 function setupCalloutFields(){
  const box=el('details','cw-callout-fields');box.id='cwCalloutFields';box.append(el('summary','','Özel ölçü bilgileri'));const grid=el('div','ip-grid');box.append(grid);$('ipDataPane').append(box);
  for(const [key,label,flag] of [['depth','Derinlik'],['pitchCircleDiameter','PCD çapı'],['basic','Temel ölçü',true],['reference','Referans ölçü',true],['spherical','Küresel ölçü',true],['through','Boydan boya',true],['equallySpaced','Eşit aralıklı',true]]){const field=el('label','field',label),input=el('input');input.dataset.callout=key;input.type=flag?'checkbox':'text';input.setAttribute('aria-label',label);field.append(input);grid.append(field);input.onchange=()=>{const r=app.selectedAnnotation();if(!r)return;const value=flag?input.checked:input.value.trim().replace(',','.');if(!flag&&value&&(!Number.isFinite(Number(value))||Number(value)<0)){input.setCustomValidity('Pozitif sayısal değer girin.');input.reportValidity();return;}input.setCustomValidity('');commitCallout(r,key,value);};}
 }
 function commitCallout(record,key,value){
  app.checkpoint();
  Object.assign(record,root.ASMachRequirements.syncRequirement({...record,callout:{...(record.callout||{}),[key]:value},manualFields:[...new Set([...(record.manualFields||[]),'callout'])]},true));
  app.recordChange('Özel ölçü bilgisi ve gereklilik güncellendi',record);app.renderAll();
 }
 function updateBalloonThumb(record){const host=$('cwBalloonThumb');if(!host)return;const group=[...document.querySelectorAll('#overlay .balloon-group, svg .balloon-group')].find(g=>g.dataset.id===record.id);host.replaceChildren();const nodes=group?[...group.children].filter(n=>n.dataset.role==='bubble'||n.querySelector('[data-role="bubble"]')||n.classList.contains('classification-marker')):[];
  if(nodes.length){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Balon '+record.number+' önizlemesi');svg.style.opacity=record.opacity??1;const boxes=nodes.map(n=>n.getBBox()),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));svg.setAttribute('viewBox',`${x-4} ${y-4} ${right-x+8} ${bottom-y+8}`);for(const node of nodes){const copy=node.cloneNode(true);copy.removeAttribute('data-role');copy.style.pointerEvents='none';svg.append(copy);}host.append(svg);}else{host.innerHTML=root.ASMachBalloonAppearance.preview(record,record.number,true);}
 }
 function updateCalloutFields(record){const box=$('cwCalloutFields');if(!box)return;
  if(!box.querySelector('[data-callout=secondaryDiameter]')){const grid=box.querySelector('.ip-grid');for(const [key,label,kind] of [['holeForm','Delik biçimi','select'],['countersinkAngle','Havşa açısı (°)','text'],['secondaryDiameter','İkinci çap','text'],['secondaryThrough','İkinci çap boydan boya','checkbox']]){const field=el('label','field',label),input=el(kind==='select'?'select':'input');input.dataset.callout=key;if(kind==='select'){for(const [v,t] of [['','Belirtilmedi'],['counterbore','Silindirik havşa'],['countersink','Konik havşa'],['spotface','Alın havşası']]){const o=el('option','',t);o.value=v;input.append(o);}}else input.type=kind;input.setAttribute('aria-label',label);field.append(input);grid.append(field);input.onchange=()=>{const r=app.selectedAnnotation();if(!r)return;const value=kind==='checkbox'?input.checked:input.value.trim().replace(',','.');if(kind==='text'&&value&&(!Number.isFinite(Number(value))||Number(value)<=0||(key==='countersinkAngle'&&Number(value)>180))){input.setCustomValidity('Geçerli pozitif değer girin; açı en fazla 180° olabilir.');input.reportValidity();return;}input.setCustomValidity('');commitCallout(r,key,value);};}}
  const data=record.callout||{},type=record.type;
  const dimensional=['Uzunluk','Ölçü','Çap','Yarıçap','Pah','Açı','Diş','Geçme'].includes(type);
  const hole=['Çap','Diş','Geçme'].includes(type);
  const applicable={basic:dimensional,reference:dimensional,depth:hole,pitchCircleDiameter:['Çap','Diş','Geçme','Açı'].includes(type),spherical:['Çap','Yarıçap'].includes(type),through:hole,equallySpaced:['Çap','Diş','Geçme','Açı'].includes(type),holeForm:hole,countersinkAngle:hole&&(data.holeForm==='countersink'||!!data.countersinkAngle),secondaryDiameter:hole,secondaryThrough:hole&&!!data.secondaryDiameter};
  box.hidden=!Object.values(applicable).some(Boolean);
  box.querySelectorAll('[data-callout]').forEach(n=>{n.closest('.field').hidden=!applicable[n.dataset.callout];if(n.type==='checkbox')n.checked=!!data[n.dataset.callout];else n.value=data[n.dataset.callout]??'';});
 }
 function modifierIcon(value){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('aria-hidden','true');
  const paths={'Ⓜ':'M7 17V7L12 13L17 7V17','Ⓛ':'M9 7V17H16','Ⓢ':'M16 8C10 4 5 10 12 12C20 14 14 20 8 16','Ⓤ':'M8 7V14C8 19 16 19 16 14V7','UZ':'M3 7V14C3 19 10 19 10 14V7M14 7H21L14 17H21'};
  if(paths[value]&&value!=='UZ'){const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','10');svg.append(circle);}const path=document.createElementNS(ns,'path');path.setAttribute('d',paths[value]||'M7 12H17');svg.append(path);svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linejoin','round');return svg;
 }
 function iconSelect(select){
  const wrap=el('div','cw-icon-select'),trigger=button('',()=>{}),menu=el('div','cw-icon-menu');select.after(wrap);wrap.append(select,trigger);select.classList.add('cw-native-store');select.tabIndex=-1;select.setAttribute('aria-hidden','true');menu.id=select.id+'Menu';menu.setAttribute('popover','auto');document.body.append(menu);trigger.setAttribute('popovertarget',menu.id);trigger.setAttribute('aria-label',select.getAttribute('aria-label')+' seçimi');
  const label=o=>o.textContent.replace(/[ⓂⓁⓈ]/g,'').trim();
  select._refreshIcon=()=>{trigger.replaceChildren(modifierIcon(select.value),el('span','',label(select.selectedOptions[0]||{textContent:'Belirtilmedi'})),el('span','','▾'));trigger.disabled=select.disabled;trigger.title=label(select.selectedOptions[0]||{textContent:''});};
  trigger.onclick=()=>{menu.replaceChildren();const rect=trigger.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-280))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+3,innerHeight-230))+'px';for(const option of select.options){const b=button('',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));select._refreshIcon();menu.hidePopover();trigger.focus();});b.append(modifierIcon(option.value),el('span','',label(option)));b.disabled=option.disabled;b.setAttribute('aria-label',label(option));menu.append(b);}};select.addEventListener('change',select._refreshIcon);select._refreshIcon();
 }
 function setupStandards(){
  const field=el('label','field','Standart'),select=el('select');select.id='cwDrawingStandard';select.setAttribute('aria-label','Çizim standardı');for(const [v,t] of [['','Belirtilmedi'],['ISO','ISO GPS'],['ASME','ASME Y14.5']]){const o=el('option','',t);o.value=v;select.append(o);}field.append(select);$('ipDataPane').querySelector('.ip-classification').before(field);
  select.onchange=()=>{const r=app.selectedAnnotation();if(!r)return;app.checkpoint();r.drawingStandard=select.value;app.recordChange('Karakteristik çizim standardı güncellendi',r);app.renderAll();};
  for(const id of ['cwGdtMaterial','cwGdtDatum0','cwGdtDatum1','cwGdtDatum2','cwProfileDistribution'])iconSelect($(id));
  const note=el('small','ci-help');note.id='cwStandardSupport';$('ipDataPane').querySelector('.ip-classification').append(note);note.style.gridColumn='1 / -1';
 }
 function updateStandards(record){
  if(!$('cwDrawingStandard'))return;$('cwDrawingStandard').value=record.drawingStandard||'';
  const text=record.drawingStandard==='ASME'?'ASME Y14.5: sayısal genel tolerans için çizim antetindeki değerler kullanılır. ISO tablosu otomatik uygulanmaz.':record.type==='GD&T'?'ISO 1101 / ISO 22081: geometrik değer ve kapsam çizimden girilir. H/K/L, her GD&T türüne otomatik uygulanmaz.':['Diş','Geçme'].includes(record.type)?'Diş / geçme toleransı ilgili sınıf alanından tanımlanır; genel boyut toleransı uygulanmaz.':record.type==='Yüzey'?'Yüzey pürüzlülüğü kendi gereklilik değeriyle tanımlanır; ISO 2768 uygulanmaz.':'Genel tolerans: desteklenen boyutlarda ISO 2768 sınıfları veya çizimin özel değerleri.';
  $('cwStandardSupport').textContent=text;$('cwStandardSupport').hidden=true;$('cwDrawingStandard').title=text;
  const choice=$('ipGeneralChoice');for(const o of choice.options)o.disabled=record.drawingStandard==='ASME'&&o.value.startsWith('ISO');if(choice.selectedOptions[0]?.disabled)choice.value='';
 }
 function editorShell(container,main,aside,kind){
  if(container.dataset.workbench)return;container.dataset.workbench=kind;container.classList.add('cw-editor');
  const layout=main.parentElement;layout.classList.add('cw-layout');aside.classList.add('cw-source');main.classList.add('cw-main');
  const handle=el('div','cw-source-resize');handle.setAttribute('aria-label','Kaynak görüntüsü genişliği');aside.after(handle);
  const set=w=>{settings.source=Math.round(Math.max(240,Math.min(480,w)));container.style.setProperty('--cw-source-width',settings.source+'px');handle.setAttribute('aria-valuenow',settings.source);};set(settings.source||320);resize(handle,()=>aside.getBoundingClientRect().width,set,remember);
  const head=container.querySelector('.modal-head,.acui-head'),headTools=el('div','cw-window-actions');
  const maximize=button('⛶',()=>{container.classList.toggle('cw-maximized');maximize.setAttribute('aria-pressed',String(container.classList.contains('cw-maximized')));settings.maximized=container.classList.contains('cw-maximized');remember();});maximize.title='Çalışma alanını büyüt / geri yükle';maximize.setAttribute('aria-label',maximize.title);maximize.setAttribute('aria-pressed',String(!!settings.maximized));headTools.append(maximize);head.append(headTools);if(settings.maximized)container.classList.add('cw-maximized');
  const note=el('span','cw-draft-status','Taslak · Kaydet ile uygulanır');note.setAttribute('role','status');headTools.prepend(note);
  container.addEventListener('input',()=>note.textContent='Kaydedilmemiş değişiklikler');
  container.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();if(kind==='ocr')$('ocrReviewConfirmButton').click();else container.querySelector('button[type=submit]').click();}},true);
 }
 function arrange(main,kind){
  if(main._cwTabs)return main._cwTabs;
  const entries=['Ölçü ve tolerans','Kontrol planı','OCR ve ayrıntılar'].map(name=>{const p=el('div','cw-edit-pane');main.append(p);return[name,p];});
  const t=tabs(main,entries,kind==='ocr'?'cwOcr':'cwDetail');main._cwTabs=t;
  const tools=main.querySelector(':scope > .es-tools');if(tools){tools.classList.add('cw-fold-tools');const trigger=button('Bölümler ▾');t.nav.append(trigger);menu(trigger,[...tools.querySelectorAll('button')],kind+'SectionsMenu');tools.remove();}
  return t;
 }
 function detail(){
  if(!ready)return;const dialog=$('acuiEditor'),main=dialog?.querySelector('.acui-editor-main'),aside=dialog?.querySelector('.acui-editor-aside');if(!main)return;
  editorShell(dialog,main,aside,'detail');detailTabs=arrange(main,'detail');const panes=detailTabs.entries.map(e=>e[1]);
  for(const n of [...main.children]){if(n.matches('.cw-edit-pane,.cw-tabs,.es-tools,.cw-validation'))continue;const group=n.matches('#acuiRolePlans,.acui-legacy,#acuiControlSection')?1:n.matches('.acui-extra,#acuiWarningReview')?2:0;panes[group].append(n);}
  // Role-plan hosts are re-rendered in place by the existing model on every opening.
  dialog.querySelectorAll('.es-section').forEach(s=>{s.querySelector(':scope>.es-heading')?.setAttribute('title','Bölümü aç / daralt');});
  const validation=$('acuiValidation');validation.classList.add('cw-validation');detailTabs.nav.after(validation);
 }
 function ocr(){
  if(!ready)return;const modal=$('ocrReviewModal'),card=modal.querySelector('.ocr-review-card'),main=modal.querySelector('.ocr-fields'),aside=modal.querySelector('.ocr-snapshot');
  editorShell(card,main,aside,'ocr');ocrTabs=arrange(main,'ocr');const panes=ocrTabs.entries.map(e=>e[1]);
  for(const n of [...main.children]){if(n.matches('.cw-edit-pane,.cw-tabs,.es-tools,.cw-validation'))continue;const group=n.matches('#ocrRolePlans')||n.querySelector('#ocrEvaluationMethod')?1:n.matches('.ocr-source,#ocrStatusText')?2:0;panes[group].append(n);}
  // The role control may initially be appended inside the legacy evaluation group.
  const role=$('ocrRolePlans');if(role&&role.parentElement!==panes[1])panes[1].prepend(role);
  const crop=aside.querySelector('[data-crop]');if(crop)crop.textContent='Seçimi uygula';
  if(!$('cwOcrNotice')){const notice=el('div','cw-validation cw-live-status');notice.id='cwOcrNotice';notice.hidden=true;notice.setAttribute('role','status');ocrTabs.nav.after(notice);main.addEventListener('input',()=>{notice.hidden=true;});}
 }
 function setupLocalStyle(){
  const host=el('div');host.id='cwLocalStyle';
  const specs=[['Balon görünümü',[['shape','Şekil',['circle:Daire','square:Kare','hexagon:Altıgen']],['balloonFill','Dolgu','color'],['balloonOpacity','Opaklık (%)','opacity'],['balloonLineStyle','Çizgi',['solid:Düz','dashed:Kesikli','dotted:Noktalı']],['balloonLineWidth','Kalınlık (px)','width']]],['Yazı görünümü',[['textColor','Renk','color'],['textOpacity','Opaklık (%)','opacity'],['fontWeight','Stil',['400:Normal','700:Kalın','800:Çok kalın']]]],['Ölçü kutusu',[['boxColor','Çizgi rengi','color'],['boxFill','Dolgu rengi','color'],['boxFillOpacity','Dolgu (%)','opacity'],['boxOpacity','Opaklık (%)','opacity'],['boxLineStyle','Çizgi',['solid:Düz','dashed:Kesikli','dotted:Noktalı','none:Gizle']],['boxLineWidth','Kalınlık (px)','width']]],['Bağlantı ayrıntıları',[['boxGap','Kutudan uzaklık (px)','gap'],['arrowSize','Ok boyutu (px)','arrow'],['leaderColor','Renk','color'],['leaderOpacity','Opaklık (%)','opacity'],['leaderLineStyle','Çizgi',['solid:Düz','dashed:Kesikli','dotted:Noktalı']],['leaderLineWidth','Kalınlık (px)','width']]]];
    for(const [title,fields] of specs){const section=el('section'),heading=el('h4','',title);section.append(heading);for(const [key,label,kind] of fields){const row=el('label','',label),input=el(Array.isArray(kind)?'select':'input');input.dataset.localStyle=key;if(Array.isArray(kind)){for(const option of kind){const [v,t]=option.split(':');const o=el('option','',t);o.value=v;input.append(o);}}else{input.type=kind==='color'?'color':'number';if(kind!=='color'){input.min=kind==='opacity'||kind==='gap'?0:kind==='arrow'?4:.5;input.max=kind==='gap'?500:kind==='opacity'?100:kind==='arrow'?40:12;input.step=kind==='width'?.1:1;}}input.dataset.percent=String(kind==='opacity');input.onchange=()=>{const r=app.selectedAnnotation();if(!r)return;let value=input.value;if(input.type==='number'){if(value===''||!input.checkValidity()){input.reportValidity();return;}value=Number(value)/(kind==='opacity'?100:1);}if(key==='fontWeight')value=Number(value);app.checkpoint();root.ASMachRoleAppearance?.setMode(app.state,r,'fixed','');r[key]=value;app.recordChange('Seçili balon görünümü sabitlendi',r);app.renderAll();};row.append(input);section.append(row);}host.append(section);}
  $('ipStylePane').append(host);const style=el('style');style.textContent='#cwLocalStyle section{border-top:1px solid #d7e3eb;padding:7px 0}#cwLocalStyle h4{font-size:11px;margin:3px 0 7px}#cwLocalStyle label{display:grid!important;grid-template-columns:1fr 120px;align-items:center;gap:8px;font-size:11px;margin:4px 0}#cwLocalStyle input,#cwLocalStyle select{height:28px!important;min-height:28px!important;width:100%;font-size:11px}#cwLocalStyle input[type=color]{width:44px;padding:2px;justify-self:start}';document.head.append(style);
 }
  function updateLocalStyle(record){if(!record)return;const displayed=root.ASMachRoleAppearance?.effective(app.state,record)||record,values={...displayed,...root.ASMachBalloonAppearance.normalize(displayed)};document.querySelectorAll('[data-local-style]').forEach(f=>{const k=f.dataset.localStyle;f.value=f.type==='color'?(values[k]||displayed.color||'#07899a'):f.dataset.percent==='true'?Math.round(values[k]*100):values[k]??'circle';});}
 function init(bridge){
  app=bridge;try{settings=JSON.parse(root.ASMachPreferences.getItem(pref))||{};}catch{}
  const style=el('style');style.id='cwDesktopStyle';style.textContent=css;document.head.append(style);setupInspector();setupLocalStyle();ready=true;
  const modal=$('ocrReviewModal');let wasOpen=false,opener=null;const inertBefore=new Map();
  new MutationObserver(()=>{const open=modal.classList.contains('is-visible');if(open===wasOpen)return;wasOpen=open;
   document.body.classList.toggle('cw-ocr-open',open);if(open){opener=document.activeElement;root.ASMachEditorSections.ocr();ocrTabs?.select(0);if($('cwOcrNotice'))$('cwOcrNotice').hidden=true;for(const n of document.querySelectorAll('.topbar,.workspace,#workspaceTabs'))if(!n.contains(modal)){inertBefore.set(n,n.inert);n.inert=true;}requestAnimationFrame(()=>modal.querySelector('.cw-tabs button')?.focus());}else {inertBefore.forEach((v,n)=>n.inert=v);inertBefore.clear();if(opener?.isConnected)opener.focus({preventScroll:true});}
  }).observe(modal,{attributes:true,attributeFilter:['class']});
  modal.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){if(modal.querySelector(':popover-open'))return;e.preventDefault();$('ocrReviewCancelButton').click();return;}if(e.key!=='Tab')return;const nodes=[...modal.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  const d=$('acuiEditor');d?.addEventListener('close',()=>{if(d.querySelector('.cw-draft-status'))d.querySelector('.cw-draft-status').textContent='Taslak · Kaydet ile uygulanır';});
  const notifications=$('toastStack');if(notifications)new MutationObserver(changes=>{if(!modal.classList.contains('is-visible'))return;const latest=changes.flatMap(c=>[...c.addedNodes]).filter(n=>n.nodeType===1).at(-1),notice=$('cwOcrNotice');if(!latest||!notice)return;notice.textContent=latest.textContent;notice.hidden=false;notice.classList.toggle('cw-error',latest.classList.contains('error'));}).observe(notifications,{childList:true});
  document.addEventListener('invalid',e=>{const n=e.target;if($('selectionForm').contains(n))inspectorTabs?.reveal(n);if($('acuiEditor')?.contains(n))detailTabs?.reveal(n);if(modal.contains(n))ocrTabs?.reveal(n);},true);
 }
 const css=`
 .cw-tab-hidden{display:none!important}.cw-tabs{display:flex;gap:3px;align-items:center;padding:7px 8px;background:#fff;border-bottom:1px solid #d7e2ea;flex-shrink:0}.cw-tabs>.btn{font:600 12px 'Segoe UI',sans-serif;min-height:32px;padding:5px 11px;border:1px solid transparent;background:transparent;color:#5a7080;border-radius:5px;white-space:nowrap}.cw-tabs>.btn[aria-selected=true]{color:#087c8e;background:#e7f5f8;border-color:#b9dfe5}.cw-tabs button:focus-visible,.cw-menu button:focus-visible{outline:2px solid #00899b;outline-offset:-2px}.cw-menu[popover]{position:fixed;inset:auto;margin:0;width:212px;padding:5px;background:#fff;border:1px solid #c6d7e0;border-radius:7px;box-shadow:0 7px 24px #16384c24;color:#284c61}.cw-menu .btn{display:flex;width:100%;text-align:left;justify-content:flex-start;border:0;background:white;min-height:32px;font-size:12px}.cw-menu .btn:hover{background:#edf6f9}
 html body #selectionForm.cw-inspector .ci-number>label{grid-column:1;grid-row:1}html body #selectionForm.cw-inspector .ci-number>input{grid-column:2;grid-row:1}html body #selectionForm.cw-inspector .ci-number>#ciNumberApply{grid-column:3;grid-row:1}html body #selectionForm.cw-inspector .ci-number>#ciNumberFree{grid-column:4;grid-row:1}html body #selectionForm.cw-inspector .ci-number>.ci-number-hint{grid-column:1/-1;grid-row:2}
 html body .cw-editor .modal-head,html body .cw-editor .acui-head,html body .cw-editor .modal-head h3,html body .cw-editor .acui-head h2{color:#1c3e53!important}html body .cw-editor .acui-eyebrow{color:#588094!important}html body .cw-editor .cw-window-actions .btn,html body .cw-editor .acui-close{color:#385d73!important;background:#f4f8fa!important;border:1px solid #c8dbe6!important}html body .cw-editor .cw-validation{flex-shrink:0;max-height:100px;overflow:auto;margin:8px 12px 0;padding:8px 10px}
 .snapshot-view-tools{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin:7px 0}.snapshot-view-tools output{min-width:37px;text-align:center;color:#526f83;font-size:11px}.cw-editor .snapshot-actions{flex-wrap:wrap}.cw-editor .snapshot-controls small:after{content:' · Ctrl + tekerlek: yakınlaştır · Alt + sürükle: kaydır'}
 body.cw-ocr-open #toastStack{display:none!important}.cw-live-status{font-size:12px;line-height:1.45;background:#e8f5f8;border:1px solid #b7dde4;color:#176378;border-radius:5px}.cw-live-status.cw-error{background:#fff3df;border-color:#ecc78e;color:#825019}
 #selectionForm.cw-inspector{font:12px 'Segoe UI',sans-serif}.cw-inspector .ic-group{border:0!important;border-radius:0!important;background:transparent!important;margin:0!important}.cw-inspector .ic-heading{display:none!important}#selectionForm.cw-inspector .ip-identity{display:grid;grid-template-columns:1fr auto;padding:9px 12px;gap:7px}#selectionForm.cw-inspector .ip-location{grid-column:1;grid-row:1;display:flex;flex-wrap:wrap;gap:3px 8px;font-size:11px}#selectionForm.cw-inspector .ip-location .cw-record-title{width:100%;font-size:14px;color:#18394e}.cw-record-nav{grid-column:2;grid-row:1;display:flex;align-self:start;gap:3px}.cw-record-nav .btn{min-width:29px;min-height:29px;padding:2px;font-size:20px}#selectionForm.cw-inspector .ci-number{width:100%;grid-column:1/-1;display:grid;grid-template-columns:52px minmax(50px,1fr) auto auto;gap:5px}#selectionForm.cw-inspector .ci-number-hint{grid-column:1/-1;font-size:10px;line-height:1.35}#selectionForm.cw-inspector .ci-number>.btn{font-size:11px;min-height:29px;padding:4px 7px}.cw-inspector .cw-tabs{padding:5px 9px;border-bottom:0}.cw-inspector .cw-tabs>.btn{flex:1;padding:5px 8px}.cw-sections-button{align-self:flex-end;margin:0 9px 4px!important;font-size:10px!important;min-height:23px!important;background:transparent!important;border:0!important}#selectionForm.cw-inspector .ip-scroll{padding:0 11px 10px}#selectionForm.cw-inspector .ip-pane{padding:9px 0;gap:12px}#selectionForm.cw-inspector .ip-section{padding:0}.cw-inspector .ip-section input,.cw-inspector .ip-section select{font-family:'Segoe UI',sans-serif!important}.cw-inspector .cw-gdt{grid-column:1/-1;overflow:auto;margin:3px 0}.cw-mode{display:block;font-size:10px;color:#68808f;margin-bottom:6px}.cw-inspector .ci-plan-summary{grid-template-columns:1fr!important}.cw-inspector .rp-cards{grid-template-columns:1fr!important}#selectionForm.cw-inspector .ip-footer{flex-shrink:0;padding:8px 10px;display:grid;gap:6px}#selectionForm.cw-inspector .ip-footer>#acuiDetailsOpen{width:100%;min-height:32px}#selectionForm.cw-inspector .form-actions{display:flex;flex-wrap:wrap;gap:5px;margin:0}.cw-inspector .form-actions>.btn{flex:1}.cw-inspector #deleteButton{flex:0 0 40px!important}.inspector-head #inspectorCount:before{content:'Toplam ';white-space:pre}.inspector-head #inspectorCount{white-space:nowrap;font-size:10px;font-weight:600;background:transparent}.inspector{position:relative}.cw-inspector-resize{position:absolute;left:0;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:5}.cw-inspector-resize:hover,.cw-inspector-resize:focus-visible{background:#0a96a6}
 @media(min-width:901px){html body .workspace:has(>.inspector){grid-template-columns:minmax(0,1fr) var(--cw-inspector-width,360px)}}
 html body #acuiEditor.cw-editor,html body #ocrReviewModal .cw-editor{width:min(1260px,calc(100vw - 24px))!important;height:min(820px,calc(100dvh - 24px));max-height:calc(100dvh - 24px)!important;padding:0!important;overflow:hidden!important;border:1px solid #b8cbd7;border-radius:9px;background:#f3f6f8;color:#24465b;font:12px 'Segoe UI',sans-serif;box-shadow:0 18px 70px #112f4f40}
 html body #acuiEditor.cw-editor.cw-maximized,html body #ocrReviewModal .cw-editor.cw-maximized{width:calc(100vw - 24px)!important;height:calc(100dvh - 24px)!important}
 html body .cw-editor>.modal-head,html body .cw-editor>.acui-head{display:flex!important;align-items:center;gap:8px;padding:10px 14px!important;min-height:60px;background:#fff;border-bottom:1px solid #cedde6;flex-shrink:0;position:relative}.cw-editor .modal-head>small{display:none!important}.cw-editor .modal-head h3,.cw-editor .acui-head h2{font-size:16px!important;line-height:1.3!important;flex:1}.cw-window-actions{display:flex;gap:8px;align-items:center;margin-left:auto}.cw-draft-status{font-size:11px;color:#687f90}.cw-window-actions .btn{min-width:30px;font-size:18px!important;padding:3px!important}.cw-editor .acui-close{order:3}
 html body #acuiEditor.cw-editor .acui-content,html body #ocrReviewModal .cw-editor .modal-body{padding:0!important;overflow:hidden!important;display:flex;flex:1;min-height:0!important}
 html body #acuiEditor.cw-editor .cw-layout,html body #ocrReviewModal .cw-editor .cw-layout{display:grid!important;grid-template-columns:var(--cw-source-width,320px) 7px minmax(0,1fr)!important;gap:0!important;align-items:stretch!important;width:100%;height:100%;min-height:0;overflow:hidden}
 html body .cw-editor .cw-source{grid-column:1!important;grid-row:1!important;position:static!important;min-width:0;min-height:0;max-height:100%;overflow:auto;align-self:stretch!important;padding:12px!important;border:0!important;border-radius:0!important;background:#eaf0f4;display:flex!important;flex-direction:column;gap:9px}.cw-source-resize{grid-column:2;grid-row:1;cursor:ew-resize;background:#e5edf2;border-inline:1px solid #d7e2e9}.cw-source-resize:hover,.cw-source-resize:focus-visible{background:#6fb8c3}
 html body #acuiEditor.cw-editor .cw-main,html body #ocrReviewModal .cw-editor .cw-main{grid-column:3!important;grid-row:1!important;display:flex!important;flex-direction:column;gap:0!important;min-height:0!important;overflow:hidden;min-width:0;align-items:stretch!important;background:#f6f8fa}.cw-editor .cw-tabs{padding:9px 12px!important;gap:4px}.cw-editor .cw-tabs>.btn{min-height:33px!important;font-size:12px!important;padding:5px 10px!important}.cw-editor .cw-tabs>.btn[popovertarget]{margin-left:auto;font-size:10px!important}.cw-editor .cw-edit-pane{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-gutter:stable}.cw-editor .cw-edit-pane>*{flex-shrink:0;min-width:0;max-width:100%;order:initial!important}
 html body #acuiEditor.cw-editor .acui-section,html body #ocrReviewModal .cw-editor .es-section{padding:10px!important;border:1px solid #d8e3ea;border-radius:6px!important;background:#fff;margin:0!important}html body .cw-editor .es-heading{padding:5px 0 8px!important;border-radius:0!important;background:white!important;margin-bottom:8px!important;min-height:27px!important}html body .cw-editor .es-title{font-size:12px!important;color:#294d63}html body .cw-editor .field>label,html body .cw-editor .acui-field>span{font-size:11px!important;line-height:1.35!important;font-weight:500;text-transform:none}
 html body #acuiEditor.cw-editor input:not([type=checkbox]),html body #acuiEditor.cw-editor select,html body #ocrReviewModal .cw-editor input:not([type=checkbox]),html body #ocrReviewModal .cw-editor select{height:31px!important;min-height:31px!important;border-radius:4px;padding:5px 7px!important;font:12px 'Segoe UI',sans-serif!important}html body #acuiEditor.cw-editor textarea,html body #ocrReviewModal .cw-editor textarea{height:54px!important;min-height:44px!important;font:12px/1.4 'Segoe UI',sans-serif!important;padding:6px 7px!important}html body .cw-editor .btn{min-height:29px!important;font:11px 'Segoe UI',sans-serif!important;padding:5px 8px!important}html body .cw-editor small,html body .cw-editor p{font-size:11px!important;line-height:1.45!important}
 html body #ocrReviewModal .cw-editor .es-ocr-group{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:9px!important}html body #ocrReviewModal .cw-editor .es-ocr-group>.field{grid-column:span 3!important}html body #ocrReviewModal .cw-editor .es-ocr-group>.ocr-measure-field{grid-column:span 2!important}html body #ocrReviewModal .cw-editor .es-ocr-group>.field.full,html body #ocrReviewModal .cw-editor .es-ocr-group>.es-heading,html body #ocrReviewModal .cw-editor .field:has(#ocrGeneralTolerance){grid-column:1/-1!important}html body #ocrReviewModal .cw-editor .snapshot-stage{height:clamp(190px,32vh,310px)!important}.cw-editor .snapshot-placement{padding:9px!important;background:#fff;border-radius:5px}.cw-editor .snapshot-controls{padding:0 0 8px}.cw-editor .snapshot-actions{display:flex;flex-wrap:wrap;gap:4px}.cw-editor .snapshot-footer{display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap}html body #acuiEditor.cw-editor .acui-snapshot{height:240px;max-height:35vh}.cw-editor .acui-legacy{padding:10px!important;background:white}.cw-editor .acui-legacy summary{cursor:pointer;font-size:12px}.cw-editor .acui-legacy #acuiControlSection{margin-top:8px!important}.cw-editor .es-tools{display:none!important}
 html body #acuiEditor.cw-editor>.acui-foot,html body #ocrReviewModal .cw-editor>.modal-actions{min-height:54px;flex-shrink:0;max-height:30vh;padding:9px 12px!important;display:flex;align-items:center;gap:7px!important;background:#fff;border-top:1px solid #cbdbe5}.cw-editor #ocrReviewCancelButton{margin-right:auto}html body .cw-editor .acui-foot-note{font-size:11px;color:#698191;flex:1}.cw-editor .role-plan-host .rp-cards{gap:9px}.cw-editor .role-plan-host .rp-fields{gap:8px}.cw-editor .cw-tab-hidden{display:none!important}.cw-editor .es-collapsed>:not(.es-heading){display:none!important}
 body.cw-ocr-open .toolbar,body.cw-ocr-open .topbar{pointer-events:none!important}body.cw-ocr-open #ocrReviewModal{position:fixed;inset:0;background:#132c486b;isolation:isolate}
 @media(max-width:1000px){html body .cw-editor{--cw-source-width:260px!important}.cw-editor .cw-draft-status{display:none}.cw-editor .cw-tabs{flex-wrap:wrap}.cw-editor .role-plan-host .rp-cards{grid-template-columns:1fr}}
 @media(max-width:700px){html body #acuiEditor.cw-editor .acui-content,html body #ocrReviewModal .cw-editor .modal-body{overflow:auto!important}html body #acuiEditor.cw-editor .cw-layout,html body #ocrReviewModal .cw-editor .cw-layout{display:flex!important;flex-direction:column;height:auto;overflow:visible}.cw-editor .cw-source{max-height:260px!important;flex-shrink:0}.cw-source-resize{display:none}.cw-editor .cw-main{overflow:visible!important;flex-shrink:0}.cw-editor .cw-edit-pane{overflow:visible;flex-shrink:0}.cw-editor .cw-tabs{position:sticky;top:0;z-index:2}.cw-editor .acui-foot-note{display:none}.cw-editor .rp-cards{grid-template-columns:1fr}.cw-editor .cw-window-actions{margin-left:auto}html body #acuiEditor.cw-editor #acuiNumericSection .acui-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;
 const denseCss=`
 html body #selectionForm.cw-inspector.cw-dense .ip-identity{padding:5px 8px;gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .ip-location{font-size:10px;gap:1px 6px}
 html body #selectionForm.cw-inspector.cw-dense .cw-record-title{font-size:12px}
 html body #selectionForm.cw-inspector.cw-dense .cw-record-nav .btn{min-height:24px;height:24px;min-width:26px;font-size:16px}
 html body #selectionForm.cw-inspector.cw-dense .ci-number{grid-template-columns:45px minmax(48px,1fr) auto auto;gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .ci-number input{min-height:25px!important;height:25px!important;font-size:14px!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>.btn{min-height:25px;height:25px;font-size:10px;padding:2px 5px}
 html body #selectionForm.cw-inspector.cw-dense .ci-number-hint{font-size:9px;line-height:12px;margin:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-tabs{padding:4px 7px;gap:2px;min-height:32px;border-bottom:1px solid #dce7ed}
 html body #selectionForm.cw-inspector.cw-dense .cw-tabs>.btn{min-height:25px;font-size:11px;padding:3px 5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-tabs>.cw-sections-button{flex:0 0 24px;margin:0!important;font-size:16px!important;min-height:25px!important}
 html body #selectionForm.cw-inspector.cw-dense .ip-scroll{padding:0 8px 5px}
 html body #selectionForm.cw-inspector.cw-dense .ip-pane{padding:6px 0;gap:6px}
 html body #selectionForm.cw-inspector.cw-dense .ip-section+.ip-section{padding-top:6px}
 html body #selectionForm.cw-inspector.cw-dense .ip-section h3{font-size:10px;margin:0 0 4px}
 html body #selectionForm.cw-inspector.cw-dense .field{grid-template-columns:60px minmax(0,1fr);gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .field>label,html body #selectionForm.cw-inspector.cw-dense label.field{font-size:10px;line-height:1.25}
 html body #selectionForm.cw-inspector.cw-dense .field input,html body #selectionForm.cw-inspector.cw-dense .field select{height:25px;min-height:25px;padding:2px 5px;font-size:11px;border-radius:3px}
 html body #selectionForm.cw-inspector.cw-dense .field textarea{height:38px;min-height:34px;padding:3px 5px;font-size:11px}
 html body #selectionForm.cw-inspector.cw-dense #nominalValue{font-size:12px}
 html body #selectionForm.cw-inspector.cw-dense .ip-grid{gap:5px}
 html body #selectionForm.cw-inspector.cw-dense .ip-classification{grid-template-columns:minmax(0,1fr) 78px;gap:5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-type{grid-column:1;grid-template-columns:26px minmax(0,1fr)}
 html body #selectionForm.cw-inspector.cw-dense .cw-unit{grid-column:2;grid-row:1;grid-template-columns:26px minmax(0,1fr)}
 html body #selectionForm.cw-inspector.cw-dense .cw-unit label{display:block}
 html body #selectionForm.cw-inspector.cw-dense #selectedGdtField{grid-column:1/-1;grid-template-columns:60px minmax(0,1fr)}
 html body #selectionForm.cw-inspector.cw-dense #ipMeasurement>.ip-section-head{display:none}
 html body #selectionForm.cw-inspector.cw-dense .ip-grid .field:not(.ic-wide){grid-template-columns:40px minmax(0,1fr);gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .cw-type-fields .field{grid-template-columns:60px minmax(0,1fr)!important}
 html body #selectionForm.cw-inspector.cw-dense .cw-limit-help{display:none}
 html body #selectionForm.cw-inspector.cw-dense .ic-advanced{margin-top:5px;padding-top:3px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .ic-advanced>summary{grid-column:1/-1;font-size:10px;padding:2px 0}
 html body #selectionForm.cw-inspector.cw-dense .ic-advanced:not([open])>:not(summary){display:none!important}
 html body #selectionForm.cw-inspector.cw-dense .ic-advanced>.field{margin:0;grid-column:1/-1;grid-template-columns:66px minmax(0,1fr)}
 html body #selectionForm.cw-inspector.cw-dense .ic-check{grid-column:1;font-size:9px;margin:0;gap:4px;align-self:center}
 html body #selectionForm.cw-inspector.cw-dense #ipApplyGeneral{grid-column:2;width:auto;margin:0;min-height:25px;padding:3px 5px;font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense #ipLimitMessage{grid-column:1/-1;font-size:9px!important;margin:0;line-height:1.25;overflow-wrap:anywhere}
 html body #selectionForm.cw-inspector.cw-dense .cw-mode{font-size:9px;margin-bottom:3px}
 html body #selectionForm.cw-inspector.cw-dense .ci-help{font-size:9px;margin:3px 0 0}
 html body #selectionForm.cw-inspector.cw-dense #ipDatumFields small{font-size:9px}
 html body #selectionForm.cw-inspector.cw-dense .ip-footer{padding:5px 7px;gap:4px}
 html body #selectionForm.cw-inspector.cw-dense .ip-footer .btn{min-height:26px!important;padding:3px 5px!important;font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense #acuiDetailsOpen{margin-bottom:0}
 html body #selectionForm.cw-inspector.cw-dense{--cw-label:64px}
 html body #selectionForm.cw-inspector.cw-dense .field,
 html body #selectionForm.cw-inspector.cw-dense .ip-grid .field:not(.ic-wide),
 html body #selectionForm.cw-inspector.cw-dense .cw-type-fields .field,
 html body #selectionForm.cw-inspector.cw-dense #selectedGdtField{grid-template-columns:var(--cw-label) minmax(0,1fr)!important;gap:5px}
 html body #selectionForm.cw-inspector.cw-dense .ip-classification .field.cw-unit{grid-template-columns:27px minmax(0,1fr)!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number{grid-template-columns:59px minmax(48px,1fr) auto auto!important}
 html body #selectionForm.cw-inspector.cw-dense .cw-field-label{font-size:10px;line-height:1.25;align-self:center;color:#567287}
 html body #selectionForm.cw-inspector.cw-dense .ic-advanced{display:block}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body{display:grid;grid-template-columns:var(--cw-label) minmax(0,1fr);column-gap:5px;row-gap:6px;padding-top:5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body>.field{grid-column:1/-1;margin:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body>.ic-check{grid-column:2;display:flex!important;align-items:center!important;margin:0!important;font-size:10px;gap:5px;line-height:1.35}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body>.ic-check input{width:13px;height:13px;min-height:13px;margin:0;flex-shrink:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body>#ipApplyGeneral{grid-column:2;margin:0;white-space:normal;justify-self:start;min-height:25px;padding:3px 8px;font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense .cw-general-body>#ipLimitMessage{grid-column:2;margin:0;line-height:1.4}
 html body #selectionForm.cw-inspector.cw-dense .requirement-actions{margin-left:calc(var(--cw-label) + 5px)}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source{border:1px solid #c9dce6;border-radius:5px;background:#fff;overflow:hidden}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-heading{display:flex;align-items:center;gap:4px;padding:3px 5px;background:#eaf3f7}
 html body #selectionForm.cw-inspector.cw-dense #cwSourceToggle{display:flex;align-items:center;flex-wrap:wrap;gap:3px 7px;flex:1;text-align:left;justify-content:flex-start;padding:3px 0;min-height:26px;background:transparent;border:0;color:#24566e;font-size:11px}
 #cwSourceToggle:before{content:'▸'}#cwSourceToggle[aria-expanded=true]:before{content:'▾'}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-caption{font-size:9px;color:#618092;font-weight:400}
 html body #selectionForm.cw-inspector.cw-dense #cwSourceGrow{font-size:10px;min-height:24px;padding:2px 5px}
 html body #selectionForm.cw-inspector.cw-dense #ipSourcePane{padding:7px;gap:7px}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .wf-source-viewport{height:185px;border-radius:3px;background:#f1f5f8}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-large .wf-source-viewport{height:min(390px,55vh)}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .wf-source-tools{gap:3px}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .wf-source-tools .btn{min-height:25px;padding:3px 5px;font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .wf-source-zoom{justify-content:flex-start;padding:3px 0}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .wf-source-hint{font-size:9px;line-height:1.35}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text{border-top:1px solid #dce7ed;padding-top:5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text>summary{font-size:10px;color:#176a80;cursor:pointer;padding:2px 0}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .ci-ocr{padding-top:6px}
 html body #selectionForm.cw-inspector.cw-dense .cw-inline-source .ip-source summary{font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .ci-ocr{padding:0;border:0;background:transparent}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-info{padding:5px 0 0;border:0;border-top:1px solid #dce7ed}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-info .field[hidden],html body #selectionForm.cw-inspector.cw-dense .cw-source-info .field:has(#selectionSnapshotImage){display:none!important}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-info>.ip-grid{grid-template-columns:minmax(0,1fr);gap:6px;padding:0;margin:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-info .field{grid-column:1/-1!important;margin:0;align-items:center}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-info .field input{width:100%;min-width:0;max-width:none;box-sizing:border-box}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .ci-inline-actions,
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .ci-help{margin-left:calc(var(--cw-label) + 5px)}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .ci-inline-actions{margin-top:5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text #ciApplyOcr{min-height:25px;padding:3px 7px;font-size:10px;white-space:normal;text-align:left}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-text .field{margin:0;align-items:start}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-preview{position:relative;min-width:0}
 html body #selectionForm[id].cw-inspector.cw-dense #cwSourceToggle{font-weight:700!important;font-size:12px!important;color:#20485d;min-height:24px;padding:0!important}
 html body #selectionForm[id].cw-inspector.cw-dense #cwInlineSource>.cw-source-heading{border:1px solid #c5dce7!important;padding:4px 7px!important;min-height:29px!important;box-sizing:border-box}
 html body #selectionForm[id].cw-inspector.cw-dense .cw-source-preview>#cwSourceGrow{position:absolute;top:6px;right:18px;z-index:4;display:grid;place-items:center;width:27px;height:27px;padding:3px;background:#fff;border:1px solid #c5dce7;border-radius:4px}
 html body #selectionForm[id].cw-inspector.cw-dense .cw-source-info>.ip-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)!important;gap:5px}
 html body #selectionForm[id].cw-inspector.cw-dense .cw-source-info .field:has(#balloonPage),html body #selectionForm[id].cw-inspector.cw-dense .cw-source-info .field:has(#balloonZone){grid-column:auto!important;grid-template-columns:38px minmax(0,1fr)!important}
 html body #selectionForm[id].cw-inspector.cw-dense .ci-ocr .field:has(#ciOcrText){display:block!important}
 html body #selectionForm[id].cw-inspector.cw-dense .wf-source-zoom-range{width:110px!important;min-width:70px;max-width:140px;height:18px;min-height:0;padding:0;accent-color:#008c9f}
 html body #selectionForm[id].cw-inspector.cw-dense .wf-source-zoom{flex-wrap:nowrap;align-items:center;gap:4px;padding:3px 6px!important}
 html body #selectionForm[id].cw-inspector.cw-dense .wf-source-tools .btn svg,html body #selectionForm[id].cw-inspector.cw-dense .wf-source-tools .btn img{width:18px;height:18px;object-fit:contain;max-width:none;border:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-preview>.wf-source-tools{position:absolute;z-index:2;top:5px;left:5px;right:18px;width:max-content;max-width:calc(100% - 23px);padding:2px;border:1px solid #d4e2e9;border-radius:4px;background:rgba(255,255,255,.94);box-shadow:0 1px 4px #18394b18}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-preview>.wf-source-zoom{top:auto;bottom:18px;left:auto;right:18px}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-preview .wf-source-tools .btn{min-height:21px;height:21px;padding:1px 4px;font-size:9px}
 html body #selectionForm.cw-inspector.cw-dense .cw-source-preview .wf-source-zoom-value{min-width:32px;font-size:9px}
 html body #selectionForm.cw-inspector.cw-dense .cw-gdt-row{display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:5px;align-items:center;margin-bottom:5px}
 html body #selectionForm.cw-inspector.cw-dense .cw-gdt-row .field{margin:0;min-width:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-gdt-row .cw-gdt-condition{display:block!important;font-size:0!important}
 html body #selectionForm.cw-inspector.cw-dense .cw-gdt-condition>.cw-field-label{display:none}
 html body #selectionForm.cw-inspector.cw-dense .cw-gdt-condition select{width:100%;min-width:0}
 html body #selectionForm.cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDatumFields{display:none!important}
 html body #selectionForm.cw-inspector.cw-dense #cwGdtFields #cwInspectorGdt{margin-top:7px}
 .cw-icon-select{position:relative;min-width:0}.cw-icon-select .cw-native-store{position:absolute!important;opacity:0;width:1px!important;height:1px!important;min-height:1px!important;pointer-events:none}
 html body #selectionForm .cw-icon-select>button{display:flex;align-items:center;gap:4px;width:100%;min-height:27px;padding:2px 4px;font-size:10px;color:#174357;background:white;border:1px solid #c1d7e3;border-radius:4px}
 .cw-icon-select>button svg,.cw-icon-menu svg{flex-shrink:0}.cw-icon-select>button span:first-of-type{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left}
 .cw-icon-menu{inset:auto;position:fixed;margin:0;width:264px;max-height:220px;overflow:auto;padding:5px;background:white;border:1px solid #bdd5df;border-radius:5px;box-shadow:0 5px 20px #12334433}
 .cw-icon-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:6px;border:0;background:white;text-align:left;font-size:12px;color:#173c50}.cw-icon-menu button:hover,.cw-icon-menu button:focus-visible{background:#e1f4f7}
 html body #selectionForm.cw-inspector.cw-dense #cwGdtFields .ci-help[hidden],html body #selectionForm #cwStandardSupport[hidden]{display:none!important}
 html body #selectionForm.cw-inspector.cw-dense #cwGdtFields .cw-distribution-field:not([hidden]){display:grid!important;grid-template-columns:var(--cw-label) minmax(0,1fr)!important;gap:5px;align-items:center;margin:5px 0}
 html body #selectionForm.cw-inspector.cw-dense #cwGdtFields .cw-distribution-field>.cw-icon-select{grid-column:2;min-width:0;width:100%}
 html body #selectionForm.cw-inspector.cw-dense #cwGdtFields .cw-distribution-field>.cw-field-label{grid-column:1;grid-row:1}
 html body .inspector:has(#selectionForm.cw-inspector)>.inspector-head{display:none!important}
 html body #selectionForm.cw-inspector.cw-dense .ip-identity{padding:5px 8px;gap:4px;align-items:center}
 html body #selectionForm.cw-inspector.cw-dense .cw-record-title{display:none}
 html body #selectionForm.cw-inspector.cw-dense .ip-location{align-items:center;gap:2px 5px;font-size:10px;min-width:0;padding:0}
 html body #selectionForm.cw-inspector.cw-dense .cw-record-nav{align-self:center}
 html body #selectionForm.cw-inspector.cw-dense .ci-number{grid-template-columns:48px 42px 64px 26px 26px!important;justify-content:start;align-items:center;gap:4px!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>#cwBalloonThumb{grid-column:1;grid-row:1}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>label{grid-column:2;grid-row:1;white-space:nowrap}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>input{grid-column:3;grid-row:1}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>#ciNumberApply{grid-column:4;grid-row:1}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>#ciNumberFree{grid-column:5;grid-row:1;display:flex;align-items:center;justify-content:center}
 html body #selectionForm.cw-inspector.cw-dense .ci-number input{width:100%!important;min-width:0;text-align:center}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>.btn{width:100%;padding:2px!important}
 .cw-balloon-thumb{height:34px;width:48px;display:flex;align-items:center;justify-content:center;pointer-events:none}.cw-balloon-thumb svg{width:100%;height:100%}
 html body #selectionForm.cw-inspector.cw-dense .ip-location{display:none!important}
 html body #selectionForm.cw-inspector.cw-dense .ip-identity{display:block!important;min-height:58px;box-sizing:border-box}
 html body #selectionForm.cw-inspector.cw-dense .ci-number{display:flex!important;flex-wrap:nowrap;width:100%;min-width:0;gap:4px!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>#cwBalloonThumb{width:70px;height:46px;flex:0 0 70px}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>label{flex:0 0 auto;font-size:10px}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>input{flex:1 1 44px;width:44px!important;min-width:36px!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>.btn{flex:0 0 26px;width:26px!important;min-width:26px!important}
 html body #selectionForm.cw-inspector.cw-dense .ci-number>.cw-record-nav{display:flex;position:static!important;flex:0 0 auto;gap:3px;margin-left:auto}
 html body #selectionForm.cw-inspector.cw-dense .ci-number-hint:not([data-conflict=true]){display:none}
 html body #selectionForm.cw-inspector.cw-dense .ci-number-hint[data-conflict=true]{display:block;color:#986000}
 html body .inspector:has(#selectionForm.cw-inspector){display:flex;flex-direction:column;min-height:0;overflow:hidden;padding-bottom:0!important}
 html body .inspector>.selection-panel:has(#selectionForm.cw-inspector){display:flex;flex-direction:column;flex:1 1 0%;min-height:0;max-height:none;height:auto;padding:0;overflow:hidden}
 html body #selectionForm.cw-inspector.is-visible{flex:1 1 0%;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
 html body #selectionForm.cw-inspector .ip-scroll{flex:1 1 0%;min-height:0;overflow-y:auto}
 html body #selectionForm.cw-inspector .ip-footer{margin-top:auto;flex:0 0 auto;background:white;border-top:1px solid #cbdde6}
 html body #selectionForm.cw-inspector .cw-quantity{display:flex;align-items:center;gap:5px;font-size:10px;flex:0 0 auto}
 html body #selectionForm.cw-inspector .cw-quantity input{width:56px;height:26px;min-height:26px;padding:2px 4px;border:1px solid #bdd7e3;border-radius:4px}
 `;
 let draftGuard=null,draftGuardObserver=null;const guardedNodes=new Map();
 function positionDraftGuard(){const panel=$('selectionForm')?.closest('.inspector');if(!draftGuard||!panel)return;draftGuard.style.width=Math.max(0,Math.min(innerWidth,panel.getBoundingClientRect().left))+'px';}
 const draftShortcutBlocked=()=>[...document.querySelectorAll('dialog[open]')].some(d=>!d.classList.contains('gt-palette')&&(d.matches(':modal')||(!d.classList.contains('wt-panel')&&d.getClientRects().length>0)));
 function syncDraftGuard(){
  const form=$('selectionForm'),panel=form?.closest('.inspector');if(!panel)return;
  $('acuiDetailsOpen')?.remove();
  const footer=form.querySelector('.ip-footer'),description=form.querySelector('.ip-description'),advanced=form.querySelector('.ic-advanced'),extra=$('cwCalloutFields');
  if(inspectorTabs&&extra){
   const source=$('cwInlineSource'),style=$('ipStylePane'),generalPane=$('ipDataPane');if(source&&generalPane&&generalPane.firstElementChild!==source)generalPane.prepend(source);
   if(style&&$('cwLocalStyle')&&!style.dataset.grouped){
    style.dataset.grouped='true';const local=[...$('cwLocalStyle').children],base=[...style.querySelectorAll(':scope>.ip-section')],position=style.querySelector('.cw-position');
    const groups=[['Balon konumu',[position]],['Boyut ve yazı',[base[0],local[1]]],['Balon görünümü',[base[2],local[0],style.querySelector('.ip-settings')]],['Bağlantı çizgisi',[base[1],local[3]]],['Ölçü kutusu',[local[2]]]];
    for(const [title,items]of groups){const group=el('details','cw-style-group'),heading=el('summary','',title),grid=el('div','cw-style-grid');group.append(heading,grid);for(const item of items.filter(Boolean)){item.querySelectorAll(':scope>h3,:scope>h4,:scope>strong').forEach(h=>h.remove());grid.append(item);}style.append(group);}
    style.querySelector(':scope>.ip-note')?.remove();position?.querySelector('small')?.remove();$('cwLocalStyle').remove();
   }
   if(advanced&&advanced.nextElementSibling!==extra)advanced.after(extra);
   $('cwInspectorTab3').textContent='Balonlama';
  }
  if(inspectorTabs&&!$('cwCharacteristicInfo')){
   const group=el('details','cw-characteristic-info');group.id='cwCharacteristicInfo';group.open=true;group.append(el('summary','','Karakteristik bilgileri'));const body=el('div','cw-characteristic-body');group.append(body);$('cwInlineSource').after(group);
   const metadata=el('section','cw-characteristic-meta');
   for(const [id,cls] of [['balloonPage','cw-meta-page'],['balloonZone','cw-meta-zone'],['toleranceStandard','cw-meta-tolerance']]){const field=$(id)?.closest('.field');if(field){field.classList.add(cls);metadata.append(field);}}
   for(const selector of ['.ip-classification','#cwGdtFields','#ipMeasurement','#cwTypeFields','#ipExtended','#cwCalloutFields','#ipDatumFields']){const node=form.querySelector(selector);if(node)body.append(node);}
   const classField=$('characteristicClass')?.closest('.field'),classification=form.querySelector('.ip-classification');if(classField&&classification){classField.classList.add('cw-class-field');classification.append(classField);}
   const evaluation=$('evaluationMethod')?.closest('.field');if(evaluation){evaluation.classList.add('cw-evaluation-field');body.append(evaluation);}
   if(advanced)body.append(advanced);
   if(metadata.children.length)body.append(metadata);
   const oldReplace=$('ipReplaceTolerance').closest('label');oldReplace.style.setProperty('display','none','important');$('ipApplyGeneral').style.setProperty('display','none','important');const scope=el('small','cw-general-scope','Enum seçimi otomatik uygulanır · Kapsam: seçili karakteristik');$('ipApplyGeneral').before(scope);
    const nominal=$('nominalValue').closest('.field'),unit=$('measurementUnit').closest('.field'),lowerTolerance=$('lowerTolerance').closest('.field'),upperTolerance=$('upperTolerance').closest('.field');const row=el('div','cw-value-line');nominal.before(row);row.append(nominal,unit,lowerTolerance,upperTolerance);
    const css=el('style');css.textContent='html body #selectionForm[id] #cwCharacteristicInfo{margin:3px 0;border:0;padding:0}html body #selectionForm[id] #cwCharacteristicInfo>summary{font-size:12px;font-weight:700;padding:6px 7px;min-height:29px;box-sizing:border-box;background:#eaf3f7;border:1px solid #c5dce7;cursor:pointer}html body #selectionForm[id] .cw-characteristic-body{padding:5px 0;display:grid;gap:5px}html body #selectionForm[id] .cw-characteristic-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 6px;width:100%;min-width:0;padding-top:5px;border-top:1px solid #e1eaef;box-sizing:border-box}html body #selectionForm[id] .cw-characteristic-meta>.field{min-width:0;width:100%;box-sizing:border-box}html body #selectionForm[id] .cw-characteristic-meta>.cw-meta-page{grid-column:1}html body #selectionForm[id] .cw-characteristic-meta>.cw-meta-zone{grid-column:2;grid-template-columns:42px minmax(0,1fr)!important}html body #selectionForm[id] .cw-characteristic-meta>.cw-meta-tolerance{grid-column:1/-1}html body #selectionForm[id] .cw-characteristic-body .ip-classification{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}html body #selectionForm[id] .cw-class-field{grid-column:2!important;grid-template-columns:32px minmax(0,1fr)!important}html body #selectionForm[id] .cw-value-line{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:5px}html body #selectionForm[id] .cw-value-line>.field{grid-column:auto!important;min-width:0}html body #selectionForm[id] .cw-evaluation-field{grid-template-columns:110px minmax(0,1fr)!important}html body #selectionForm[id] .cw-characteristic-body .cw-gdt{grid-column:1/-1}';document.head.append(css);
  }
  if($('cwCharacteristicInfo')&&advanced)advanced.hidden=$('ipExtended').hidden;
  if($('cwCharacteristicInfo')){
   const info=$('cwCharacteristicInfo'),pane=$('ipDataPane');info.querySelector(':scope>summary').textContent='Karakteristik';const toggle=$('cwSourceToggle');for(const n of toggle.childNodes)if(n.nodeType===3)n.textContent='OCR';
   if(advanced){if(info.nextElementSibling!==advanced)info.after(advanced);advanced.querySelector('summary').textContent='Genel tolerans';}
   if(extra){if((advanced||info).nextElementSibling!==extra)(advanced||info).after(extra);extra.querySelector('summary').textContent='Özel ölçü';}
   pane.classList.add('cw-unified-grid');
   if(!$('cwUnifiedGridStyle')){const css=el('style');css.id='cwUnifiedGridStyle';css.textContent=`
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid{font-family:"Segoe UI",Arial,sans-serif!important;font-size:11px!important;line-height:1.35;display:flex;flex-direction:column;gap:3px!important;align-items:stretch}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(label,input,select,textarea,button,summary,h3,.cw-field-label){font-family:inherit!important;font-size:11px!important;line-height:1.35!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid>:is(details,section){margin:0!important;flex:0 0 auto}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(#cwInlineSource>.cw-source-heading,#cwCharacteristicInfo>summary,.ic-advanced>summary,#cwCalloutFields>summary){margin:0!important;padding:5px 8px!important;min-height:29px!important;height:29px;box-sizing:border-box;border:1px solid #c5dce7!important;border-radius:3px!important;background:#eaf3f7!important;color:#23485f;font-weight:700!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwSourceToggle{font-size:11px!important;min-height:0!important;font-weight:700!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(.cw-characteristic-body,.cw-general-body,#cwCalloutFields>.ip-grid){padding:5px 4px!important;gap:4px!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-general-scope{grid-column:1/-1!important;color:#527187;font-size:10px;line-height:1.35}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(.ip-grid,.ip-classification,.cw-value-line){column-gap:8px!important;row-gap:4px!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-value-line{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field{margin:0!important;min-width:0;align-items:center;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(.ip-grid,.ip-classification,.cw-value-line)>.field:nth-child(2),html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-class-field{grid-template-columns:40px minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field :is(input:not([type=checkbox]):not([type=range]),select){height:27px!important;min-height:27px!important;box-sizing:border-box;min-width:0;max-width:100%;width:100%;padding:3px 5px!important;border-radius:3px!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-unit-precision{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px;min-width:0}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-unit-precision :is(#measurementUnit,#cwDecimalPlaces){width:100%!important;min-width:0!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(.ip-section h3,.ip-section-head){margin:3px 0!important;padding:0!important;font-weight:600!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid [hidden]{display:none!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field:has(#lowerTolerance){grid-template-columns:76px minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field:has(#upperTolerance),html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field:has([data-limit=upperLimit]),html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field:has(#cwExtra_chamferAngleTolerance),html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-class-field,html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .field:has(#measurementUnit){grid-template-columns:48px minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .cw-characteristic-body>.ip-section{padding:0!important;margin:0!important;border:0!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo{--cw-field-label:76px}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-unit-precision select{padding-inline:2px!important;flex:1 1 0}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-unit-precision #measurementUnit{flex-grow:1.2}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo :is(.ip-classification,.cw-value-line,#ipMeasurement>.ip-grid,#ipExtended>.ip-grid,#cwTypeFields){display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;column-gap:8px!important;row-gap:4px!important;width:100%;box-sizing:border-box;min-width:0}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-characteristic-meta{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;column-gap:6px!important;row-gap:4px!important;width:100%;box-sizing:border-box;min-width:0}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-characteristic-meta>.cw-meta-zone{grid-template-columns:42px minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-characteristic-meta>.cw-meta-tolerance{grid-column:1/-1!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field{display:grid;grid-template-columns:var(--cw-field-label) minmax(0,1fr)!important;column-gap:5px!important;min-width:0;width:100%;box-sizing:border-box}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field>:is(label,.cw-field-label){min-width:0;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;line-height:1.25!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .ip-classification>.cw-type{grid-column:1!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field:has(#lowerTolerance){grid-column:1!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field:has(#upperTolerance){grid-column:2!important}
    html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field :is(input:not([type=checkbox]),select){width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo#cwCharacteristicInfo{--cw-field-label:76px!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo#cwCharacteristicInfo .field{grid-template-columns:var(--cw-field-label) minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo#cwCharacteristicInfo .field>:is(label,.cw-field-label){grid-column:1!important;grid-row:1!important;text-align:left!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo#cwCharacteristicInfo .field>:is(input,select,.cw-unit-precision){grid-column:2!important;grid-row:1!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo .ip-classification>.cw-type{grid-row:1!important;grid-column:1!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-class-field{grid-row:1!important;grid-column:2!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo #selectedGdtField{display:grid!important;grid-row:2!important;grid-column:1/-1!important;align-items:center}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo #selectedGdtField>label{grid-column:1!important;grid-row:1!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo #selectedGdtField>div{grid-column:2!important;grid-row:1!important;min-width:0}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo #cwGdtFields{display:flex;flex-direction:column;gap:4px!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-gdt-row{display:grid!important;grid-template-columns:var(--cw-field-label) repeat(2,minmax(0,1fr))!important;gap:5px!important;align-items:center;margin:0!important;min-width:0}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo#cwCharacteristicInfo .cw-gdt-row>.field:first-child{grid-column:1/3!important;grid-row:1!important;display:grid!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-gdt-row>.cw-gdt-condition{grid-column:3!important;grid-row:1!important;display:block!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo :is(#ipMeasurement>.ip-grid,.cw-value-line){grid-template-columns:minmax(0,1fr)!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-unit{grid-column:1/-1!important;grid-row:auto!important}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo #cwInspectorGdt{margin:2px 0 2px calc(var(--cw-field-label) + 5px)!important;max-width:calc(100% - var(--cw-field-label) - 5px);overflow:auto}
    html body #selectionForm[id].cw-inspector.cw-dense[data-characteristic-type="GD&T"] #ipDataPane.cw-unified-grid #cwCharacteristicInfo :is(.cw-icon-select>button,#selectedGdtField button){height:27px!important;min-height:27px!important;box-sizing:border-box;border-radius:3px!important}
   `;document.head.append(css);}
  }
   if($('cwCharacteristicInfo')&&$('cwDrawingStandard')){$('cwDrawingStandard').closest('.field').hidden=true;}
  if(footer&&description&&description.nextElementSibling!==footer)footer.before(description);
  const multi=$('cwQuantityBalloons');if(multi){const label=multi.parentElement;for(const n of label.childNodes)if(n.nodeType===3)n.textContent='';multi.setAttribute('aria-label','Miktar kadar balon göster');label.title='Miktar kadar balon göster';label.classList.add('cw-balloon-toggle');if(!label.querySelector('svg'))label.insertAdjacentHTML('beforeend','<svg viewBox="0 0 28 24" width="28" height="24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M15 15l7 6h4"/><path d="M9 7l2-1v8M8 14h6"/></svg>');}
  for(const [id,key,label] of [['centerBubbleButton','g','Çizimde göster'],['acuiDetailsOpen','e','Ayrıntılı düzenle'],['deleteButton','Delete','Kaydı sil']]){const b=$(id);if(b&&!b.dataset.footerShortcut){b.dataset.footerShortcut='true';b.title=label+' · Alt+'+key;b.setAttribute('aria-keyshortcuts','Alt+'+key);const k=el('small','',key==='Delete'?'Del':key.toUpperCase());b.append(k);}}
  if(!document.getElementById('cwFinalFooter')){const css=el('style');css.id='cwFinalFooter';css.textContent=`
   html body #acuiEditor{display:none!important}
   html body #selectionForm[id] .cw-style-group{margin:0 0 3px;border:1px solid #c6d9e3;border-radius:4px;background:#fff}
   html body #selectionForm[id] .cw-style-group>summary{padding:7px 9px;background:#eaf3f7;color:#24566e;font-size:11px;font-weight:700;cursor:pointer}
   html body #selectionForm[id] .cw-style-grid{padding:6px;display:grid;gap:6px}
   html body #selectionForm[id] .cw-style-grid>section{margin:0!important;padding:0!important;border:0!important}
   html body #selectionForm[id] .cw-style-grid label:has([data-local-style]){display:grid!important;grid-template-columns:minmax(0,1fr) 110px;align-items:center;gap:6px;font-size:11px;margin:4px 0}
   html body #selectionForm[id] .cw-style-grid [data-local-style]{width:100%;height:27px;min-height:27px;box-sizing:border-box}
   html body #selectionForm[id] .cw-style-grid input[type=color]{width:44px;padding:2px}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-sections-button{display:none!important}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-heading,html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-extra>summary{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:29px;margin:0!important;padding:5px 9px!important;border:1px solid #bdcdd6!important;border-radius:0!important;background:#edf1f4;color:#173c50;font-size:12px;font-weight:750;text-align:left;cursor:pointer;box-sizing:border-box;list-style:none}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-heading:after,html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-extra>summary:after{content:'▾';font-size:11px;color:#527183}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-heading[aria-expanded=true],html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-extra[open]>summary{background:#d8f1f3;color:#005e70}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-heading[aria-expanded=true]:after,html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-extra[open]>summary:after{content:'▴'}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-accordion-heading:focus-visible{outline:2px solid #008b9b;outline-offset:-2px}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-scroll{display:block!important}
   html body #selectionForm[id].cw-inspector.cw-dense :is(.ip-section h3,.cw-source-heading,.ic-advanced>summary){font-weight:700!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-scroll{padding:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-pane{padding:0!important;margin:0!important;gap:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwInlineSource{margin:0!important;padding:0!important;border:0!important;border-radius:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwInlineSource>.cw-source-heading{margin:0!important;border-radius:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-tabs{padding-left:0!important;padding-right:0!important;margin:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-pane :is(.ip-grid,.ip-section,.ip-classification){margin-left:0!important;margin-right:0!important;padding-left:0!important;padding-right:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-tabs{display:flex;gap:3px;padding:4px 7px;min-height:34px;background:#eaf1f5;border-bottom:1px solid #cadbe5}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-tabs>[role=tab]{flex:1;min-height:26px;border:1px solid transparent;border-radius:4px;background:transparent;color:#4a6477;font-weight:500}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-tabs>[role=tab][aria-selected=true]{background:#fff;color:#007f92;border-color:#b9d6df;box-shadow:0 1px 2px #17374718;font-weight:650}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-pane>.ip-section{margin:0;padding:4px 0;border-top:0}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-grid{gap:4px 6px}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-pane .field{margin-top:0;margin-bottom:0}
   html body #selectionForm[id].cw-inspector.cw-dense :is(.cw-source-heading,.ic-advanced>summary,#cwCalloutFields>summary){margin:3px 0!important;padding:4px 7px!important;min-height:29px;border-radius:4px}
   html body #selectionForm[id].cw-inspector.cw-dense :is(.ic-advanced,#cwCalloutFields){margin:3px 0!important;padding:0!important;border:0}
   html body #selectionForm[id].cw-inspector.cw-dense .ci-source{padding:0!important;margin:0 0 3px!important;border:0!important;background:transparent}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-general-body{padding:4px 0}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-evaluation-field{grid-template-columns:96px minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-evaluation-field>label{white-space:nowrap!important;word-break:normal!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-value-line>.field:has(#nominalValue){grid-column:1!important;grid-row:1!important;order:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-value-line>.field:has(#measurementUnit){grid-column:2!important;grid-row:1!important;order:1!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-value-line>.field:has(#lowerTolerance){grid-column:1!important;grid-row:2!important;order:2!important;grid-template-columns:var(--cw-field-label) minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-value-line>.field:has(#upperTolerance){grid-column:2!important;grid-row:2!important;order:3!important;grid-template-columns:42px minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwCharacteristicInfo .cw-value-line{grid-template-columns:minmax(0,calc(50% - 23px)) minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #cwDecimalPlaces{width:65px!important}
   html body #selectionForm[id].cw-inspector.cw-dense .cw-unit-precision #measurementUnit{width:60px!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-classification{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(#cwSourceToggle,#cwCharacteristicInfo>summary,.ic-advanced>summary,#cwCalloutFields>summary){display:flex!important;align-items:center!important;gap:5px!important;font-size:10px!important;list-style:none!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid summary::-webkit-details-marker{display:none!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid :is(#cwSourceToggle,#cwCharacteristicInfo>summary,.ic-advanced>summary,#cwCalloutFields>summary):before{content:'▸';display:inline-block;width:10px;flex:0 0 10px;text-align:center;font-size:9px;line-height:1}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwSourceToggle[aria-expanded=true]:before,html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo[open]>summary:before,html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid .ic-advanced[open]>summary:before,html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCalloutFields[open]>summary:before{content:'▾'}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo{--cw-field-label:62px!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo :is(.ip-classification,.cw-value-line,#ipMeasurement>.ip-grid,#ipExtended>.ip-grid,#cwTypeFields){column-gap:6px!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field{column-gap:4px!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field>:is(label,.cw-field-label){font-size:10px!important;line-height:1.18!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo :is(.ip-grid,.ip-classification,.cw-value-line)>.field:nth-child(2),html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-class-field{grid-template-columns:42px minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .field:has(#cwDrawingStandard){grid-template-columns:88px minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense #ipDataPane.cw-unified-grid #cwCharacteristicInfo .cw-evaluation-field{grid-template-columns:84px minmax(0,1fr)!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-description{flex:0 0 auto;padding:5px 7px!important;border-top:1px solid #d6e1e8!important;margin:0!important;background:#f6f9fb!important}
   #selectionForm[id] .ip-description button,#selectionForm[id] .ip-description small,#selectionForm[id] .ip-description .ci-help{display:none!important}
   #selectionForm[id] .ip-description textarea{height:52px!important;min-height:40px!important;max-height:90px}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-footer{flex-wrap:nowrap!important;gap:3px!important;padding:5px!important;margin-top:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-footer .cw-quantity{flex:0 0 auto!important;min-width:0!important;gap:3px!important;font-size:9px}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-footer #cwQuantity{flex:0 0 38px!important;width:38px!important;max-width:38px!important}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-footer #cwQuantityBalloons{width:14px!important;height:14px!important;min-height:0!important;padding:0!important}
   html body #selectionForm[id].cw-inspector.cw-dense #controlledDraftActions{flex:0 0 auto!important;margin-left:auto!important}
   html body #selectionForm[id].cw-inspector.cw-dense #controlledDraftActions .btn{width:44px!important;min-width:44px!important;flex:0 0 44px!important;height:34px!important;gap:3px!important;padding:4px!important;border-radius:7px!important;display:inline-flex;align-items:center;justify-content:center}
   #selectionForm[id] #controlledDraftActions [data-accept]{background:#087f48!important;border:1px solid #06683b!important;color:white!important}
   #selectionForm[id] #controlledDraftActions [data-discard]{background:#fff5f4!important;border:1px solid #e8b8b2!important;color:#ac3429!important}
   #selectionForm[id] #controlledDraftActions .btn:hover{filter:brightness(.94)}
   #selectionForm[id] #controlledDraftActions .btn:focus-visible{outline:2px solid #008b9b!important;outline-offset:2px}
   #selectionForm[id] .ip-footer kbd,#selectionForm[id] .ip-footer [data-footer-shortcut] small{display:none!important}
   #selectionForm[id] .cw-balloon-toggle{position:relative!important;display:inline-flex!important;align-items:center;justify-content:center;min-width:32px!important;height:32px!important;padding:1px!important;border:1px solid #bed2df;border-radius:6px;color:#52748a;background:white;cursor:pointer}
   html body #selectionForm[id].cw-inspector.cw-dense .ip-footer .cw-balloon-toggle #cwQuantityBalloons{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:0!important;margin:0!important;cursor:pointer}
   #selectionForm[id] .cw-balloon-toggle:has(input:checked){color:#007f92;background:#dff5f8;border-color:#008b9b;box-shadow:inset 0 -2px #008b9b}
   #selectionForm[id] .cw-balloon-toggle:has(input:focus-visible){outline:2px solid #008b9b;outline-offset:2px}
   #selectionForm[id] .cw-balloon-toggle:has(input:disabled){opacity:.45;cursor:default}
  `;document.head.append(css);}
  const pending=!!app?.state.controlledDraft;
  if(!pending){draftGuardObserver?.disconnect();draftGuardObserver=null;guardedNodes.forEach((value,node)=>node.inert=value);guardedNodes.clear();draftGuard?.remove();draftGuard=null;return;}
  if(!draftGuard){draftGuard=el('div');draftGuard.id='cwDraftGuard';draftGuard.style.cssText='position:fixed;inset:0 auto 0 0;background:#10243466;z-index:1900;cursor:not-allowed';document.body.append(draftGuard);
   draftGuardObserver=new ResizeObserver(positionDraftGuard);draftGuardObserver.observe(panel);if(panel.parentElement)draftGuardObserver.observe(panel.parentElement);
   for(let node=panel;node&&node!==document.body;node=node.parentElement){for(const sibling of node.parentElement.children){if(sibling===node||sibling===draftGuard||['SCRIPT','STYLE','DIALOG'].includes(sibling.tagName)||sibling.matches('.gt-palette,#gdtImageOptions,.cw-icon-menu'))continue;guardedNodes.set(sibling,sibling.inert);sibling.inert=true;}}
  }
  positionDraftGuard();
  const accept=$('controlledDraftActions')?.querySelector('[data-accept]'),cancel=$('controlledDraftActions')?.querySelector('[data-discard]');
  if(accept){accept.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><kbd aria-hidden="true">↵</kbd>';accept.setAttribute('aria-label','Onayla ve listeye ekle');accept.setAttribute('aria-keyshortcuts','Enter');accept.title='Onayla ve listeye ekle (Enter)';}
  if(cancel){cancel.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><kbd aria-hidden="true">⌫</kbd>';cancel.setAttribute('aria-label','Kontrollü seçimi iptal et');cancel.setAttribute('aria-keyshortcuts','Backspace');cancel.title='Kontrollü seçimi iptal et (Backspace — yazı alanı dışında)';}
  document.head.append(guardCss);
  if(!panel.contains(document.activeElement)&&!draftShortcutBlocked())accept?.focus({preventScroll:true});
 }
 document.addEventListener('keydown',e=>{
  if(e.target.closest('.acui-cell-dialog'))return;
  if(e.altKey&&!e.ctrlKey&&!e.shiftKey&&!e.repeat&&$('selectionForm')?.contains(e.target)){const id={g:'centerBubbleButton',e:'acuiDetailsOpen',Delete:'deleteButton'}[e.key];const b=id&&$(id);if(b&&!b.disabled){e.preventDefault();b.click();return;}}
  if(!app?.state.controlledDraft||draftShortcutBlocked()||!['Enter','Backspace'].includes(e.key)||e.isComposing||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey)return;
  const target=e.target,editable=target.closest('input,textarea,select,[contenteditable="true"]');
  if(e.key==='Backspace'&&editable)return;
  if(e.key==='Enter'&&target.closest('textarea,select,[contenteditable="true"],button'))return;
  e.preventDefault();e.stopImmediatePropagation();const draft=app.state.controlledDraft;
  if(e.key==='Enter'&&editable)editable.blur();
  queueMicrotask(()=>{if(app.state.controlledDraft!==draft||draftShortcutBlocked())return;$('controlledDraftActions')?.querySelector(e.key==='Enter'?'[data-accept]':'[data-discard]')?.click();});
 },true);
 root.addEventListener('resize',syncDraftGuard);
 const guardCss=el('style');guardCss.textContent='html body #selectionForm.cw-inspector.cw-dense .ip-footer{flex-wrap:wrap!important}html body #selectionForm.cw-inspector.cw-dense .ip-footer .cw-quantity{flex:0 0 80px!important;min-width:80px!important}html body #selectionForm.cw-inspector.cw-dense #cwQuantity{width:44px!important;flex:0 0 44px!important}html body #selectionForm.cw-inspector.cw-dense #controlledDraftActions .btn{width:auto!important;min-width:95px!important;flex:1 1 95px!important;height:34px!important;font-size:11px!important;padding:4px 8px!important}html body #selectionForm.cw-inspector.cw-dense #controlledDraftActions{flex:1 0 100%!important}#controlledDraftActions>div{display:flex;width:100%}';document.head.append(guardCss);
 guardCss.textContent+='#controlledDraftActions .btn{display:flex!important;align-items:center;justify-content:space-between;gap:8px}#controlledDraftActions kbd{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;padding:3px 6px;border:1px solid currentColor;border-bottom-width:2px;border-radius:4px;background:#ffffff22;font:600 10px Segoe UI,sans-serif;line-height:15px}';
 const baseInit=init;
 root.ASMachCharacteristicWorkbench={init(bridge){baseInit(bridge);const s=el('style');s.id='cwDenseInspectorStyle';s.textContent=denseCss+`
 html body #selectionForm[id].cw-inspector :is(label,.cw-field-label,.field>span,summary,legend,h3,h4,.gt-ocr-heading,.cw-tabs [role=tab]){font-weight:700!important;color:#25485f!important}
 html body #selectionForm[id].cw-inspector label>span:not(.gt-editor):not(.gt-rich){font-weight:700!important}
 html body #selectionForm[id].cw-inspector :is(input:not(#balloonNumber),select,textarea,[contenteditable=true]){font-weight:400!important}
 `;document.head.append(s);},detail,ocr,update,syncDraftGuard};
})(window);
