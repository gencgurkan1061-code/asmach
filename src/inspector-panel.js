/* Compact inspector. Move existing controls rather than duplicating data bindings. */
(function(root){
  'use strict';
  let instance;
  function mount(form,options={}){
    if(!form||form.dataset.inspectorReady||!form.querySelector('#balloonNumber'))return;
    const doc=form.ownerDocument,$=id=>form.querySelector('#'+id);
    const original={};for(const field of form.querySelectorAll('.field'))for(const input of field.querySelectorAll('input,select,textarea'))original[input.id]=field;
    original.selectionSnapshotImage=$('selectionSnapshotImage')?.closest('.field');
    const create=(tag,cls,html='')=>{const el=doc.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
    const move=(ids,target)=>ids.forEach(id=>{if(original[id])target.append(original[id]);});
    const header=create('div','ip-identity','<div class="ip-location"><strong id="ipTypeTitle">Seçili karakteristik</strong><span id="ipLocation"></span><span id="ipZone"></span></div>');
    header.prepend(original.balloonNumber);
    const nav=create('div','ip-tabs','<button type="button" id="ipDataTab" role="tab" aria-controls="ipDataPane" aria-selected="true">Genel</button><button type="button" id="ipControlTab" role="tab" aria-controls="ipControlPane" aria-selected="false" tabindex="-1">Denetleme</button><button type="button" id="ipStyleTab" role="tab" aria-controls="ipStylePane" aria-selected="false" tabindex="-1">Balonlama</button>');
    nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Balon özellikleri bölümleri');
    const scroll=create('div','ip-scroll');
    const data=create('div','ip-pane');data.id='ipDataPane';data.setAttribute('role','tabpanel');data.setAttribute('aria-labelledby','ipDataTab');
    const style=create('div','ip-pane');style.id='ipStylePane';style.setAttribute('role','tabpanel');style.setAttribute('aria-labelledby','ipStyleTab');style.hidden=true;
    const inspection=create('div','ip-pane');inspection.id='ipControlPane';inspection.setAttribute('role','tabpanel');inspection.setAttribute('aria-labelledby','ipControlTab');inspection.hidden=true;
    const requirement=create('section','ip-section ip-grid ip-classification');move(['characteristicType','selectedGdtSubtype'],requirement);data.append(requirement);
    const measurement=create('section','ip-section');measurement.id='ipMeasurement';
    const measurementHead=create('div','ip-section-head','<h3>Ölçü ve tolerans</h3>');move(['measurementUnit'],measurementHead);
    original.measurementUnit?.querySelector('input')?.setAttribute('aria-label','Ölçü birimi');
    const measurementGrid=create('div','ip-grid ip-three');move(['nominalValue','lowerTolerance','upperTolerance'],measurementGrid);measurement.append(measurementHead,measurementGrid);data.append(measurement);
    const description=create('section','ip-section ip-description');move(['requirement'],description);data.append(description);
    const control=create('section','ip-section','<h3>Kontrol</h3>'),controlGrid=create('div','ip-grid');move(['inspectionMethod','evaluationMethod','balloonStatus'],controlGrid);
    const frequency=create('div','ip-frequency','<span><small>Kontrol planı / sıklığı</small><strong id="ipFrequency"></strong></span><button type="button" class="ip-link" id="ipEditFrequency">Düzenle ↗</button>');control.append(controlGrid,frequency);inspection.append(control);
    const source=create('details','ip-source','<summary>Kaynak / OCR ve tolerans bilgisi</summary>'),sourceGrid=create('div','ip-grid');
    move(['selectionSnapshotImage','balloonPage','balloonZone','toleranceStandard'],sourceGrid);source.append(sourceGrid);data.append(source);
    if(original.balloonZone){const hint=original.balloonZone.querySelector('small');if(hint)hint.hidden=true;original.balloonZone.querySelector('#balloonZone').title='Zon otomatik bulunur. Manuel değişiklik için tüm karakteristik ayrıntılarını açın.';}
    const styleIntro=create('p','ip-note','Bu ayarlar yalnız seçili balonu değiştirir.');style.append(styleIntro);
    const dimensions=create('section','ip-section','<h3>Boyut ve yazı</h3>'),dimensionsGrid=create('div','ip-grid ip-three');move(['balloonSize','balloonFontSize','balloonOpacity'],dimensionsGrid);dimensions.append(dimensionsGrid);style.append(dimensions);
    const leader=create('section','ip-section','<h3>Bağlantı çizgisi</h3>'),leaderGrid=create('div','ip-grid');move(['balloonArrowEnabled','balloonArrowStyle'],leaderGrid);original.balloonArrowStyle?.classList.remove('full');leader.append(leaderGrid);style.append(leader);
    const color=create('section','ip-section','<h3>Renk</h3>'),colorGrid=create('div','ip-grid');move(['balloonColor'],colorGrid);color.append(colorGrid);style.append(color);
    const settings=create('button','btn ip-settings','Yöntem stillerini düzenle ↗');settings.type='button';settings.addEventListener('click',()=>options.onSettings?.());style.append(settings);
    for(const [id,label] of [['balloonNumber','Balon no'],['characteristicType','Karakteristik türü'],['requirement','Gereklilik / açıklama'],['nominalValue','Nominal'],['lowerTolerance','Alt tolerans'],['upperTolerance','Üst tolerans'],['measurementUnit','Birim'],['balloonSize','Çap (px)'],['balloonFontSize','Yazı (px)'],['balloonOpacity','Opaklık (%)'],['balloonZone','Zon'],['balloonPage','Sayfa'],['inspectionMethod','Kontrol yöntemi'],['evaluationMethod','Değerlendirme'],['balloonStatus','Durum'],['balloonArrowStyle','Ok ucu'],['balloonArrowEnabled','Ok gösterimi'],['balloonColor','Balon rengi'],['toleranceStandard','Tolerans kaynağı']]){
      const labelNode=original[id]?.querySelector(`label[for="${id}"]`);if(labelNode)labelNode.textContent=label;
    }
    for(const id of ['balloonSize','balloonFontSize'])original[id]?.querySelector('small')?.remove();
    // Preserve future extension fields if the host adds new inputs to the old grid.
    const grid=form.querySelector('.form-grid');if(grid)for(const child of [...grid.children])sourceGrid.append(child);
    const footer=create('div','ip-footer'),detail=$('acuiDetailsOpen'),actions=form.querySelector('.form-actions');
    if(detail){detail.textContent='Tüm karakteristik ayrıntıları ↗';footer.append(detail);}if(actions)footer.append(actions);
    scroll.append(data,inspection,style);form.replaceChildren(header,nav,scroll,footer);form.classList.add('ip-panel');form.dataset.inspectorReady='true';form.closest('.selection-panel')?.classList.add('ip-host');
    const tabs=[doc.getElementById('ipDataTab'),doc.getElementById('ipControlTab'),doc.getElementById('ipStyleTab')],panes=[data,inspection,style];
    function select(index,focus=false){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panes[i].hidden=i!==index;});scroll.scrollTop=0;if(focus)tabs[index].focus();}
    tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(index));tab.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();select(event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length,true);});});
    doc.getElementById('ipEditFrequency').addEventListener('click',()=>options.onFrequency?.());
    instance={form,doc,original,measurement,source};return instance;
  }
  function update(record,pageCount){
    if(!instance||!record)return;
    const {doc,original,measurement}=instance;
    doc.getElementById('ipLocation').textContent=`Sayfa ${record.page} / ${pageCount||1}`;
    doc.getElementById('ipTypeTitle').textContent=record.type||'Seçili karakteristik';
    doc.getElementById('ipZone').textContent=record.zone?`Zon ${record.zone}${record.zoneSource==='auto'?' · Otomatik':''}`:'Zon belirtilmedi';
    doc.getElementById('ipFrequency').textContent=record.rolePlans?Object.entries(record.rolePlans).filter(([,p])=>p.enabled).map(([role,p])=>`${root.ASMachRolePlans?.roles[role]||role}: ${p.inspectionMethod} · ${root.ASMachInspectionPlan.label(p)}`).join(' / '):root.ASMachInspectionPlan?.label(record)||'Belirtilmedi';
    const methodLabel=original.inspectionMethod?.querySelector('label[for="inspectionMethod"]');if(methodLabel)methodLabel.textContent=record.rolePlans?'Balon stili (kontrol planını değiştirmez)':'Kontrol yöntemi';
    const profile=root.ASMachRequirements?.fieldProfile(record.type);
    measurement.hidden=profile?!profile.numeric:['Not','Görsel','Malzeme','Proses','Datum','Diğer'].includes(record.type);
    if(original.nominalValue)original.nominalValue.hidden=profile?!profile.nominal:record.type==='GD&T';
    measurement.querySelector('.ip-grid').style.gridTemplateColumns=original.nominalValue?.hidden?'repeat(2,minmax(0,1fr))':'';
    if(original.selectionSnapshotImage)original.selectionSnapshotImage.hidden=!record.snapshot&&!record.ocrText;
    root.ASMachProjectWorkspace?.updateInspector(record);
    root.ASMachCharacteristicInspector?.update(record);
    root.ASMachCharacteristicWorkbench?.update(record);
  }
  root.ASMachInspectorPanel={mount,update};
})(window);
