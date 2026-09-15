/* One undoable update to captured IDs; dimensional values and positions are untouched. */
(function(root){
 'use strict';
 const KEEP='__KEEP__';let app,dialog,targets=[],recordsAtOpen;
 function apply(bridge,ids,values){
   if(bridge.state.annotations.some(r=>ids.includes(r.id)&&r.rolePlans))return{error:'Kalite / operatör planı bulunan kayıtları sorumlu bazlı toplu düzenleyin.'};
   const method=values.method??KEEP,frequency=values.frequency??KEEP,patch={};
   if(method!==KEEP&&!bridge.getMethods().some(m=>m.value===method))return{error:'Geçerli bir kontrol yöntemi seçin.'};
   if(frequency!==KEEP){
     Object.assign(patch,{inspectionFrequency:frequency,frequencyInterval:['EVERY_N_PIECES','EVERY_N_HOURS'].includes(frequency)?String(values.interval||'').trim():'',frequencyNote:['CUSTOM','EVERY_N_PIECES','EVERY_N_HOURS'].includes(frequency)?String(values.note||'').trim():''});
     const error=root.ASMachInspectionPlan.validate(patch);if(error)return{error};
   }
   const selected=new Set(ids),records=bridge.state.annotations.filter(r=>selected.has(r.id)&&(method!==KEEP&&r.inspectionMethod!==method||Object.entries(patch).some(([key,value])=>String(r[key]??'')!==value)));
   if(!records.length)return{changed:0};
   bridge.checkpoint();for(const record of records){
     if(method!==KEEP&&record.inspectionMethod!==method)bridge.applyMethodStyle(record,method);
     Object.assign(record,patch);record.manualFields=[...new Set([...(record.manualFields||[]),...Object.keys(patch),...(method!==KEEP?['inspectionMethod']:[])])];
     bridge.recordChange('Seçili balonların kontrol planı topluca değiştirildi',record);
   }bridge.renderAll();return{changed:records.length};
 }
 function init(bridge){app=bridge;}
 function open(ids){
   if(root.ASMachCharacteristicEditing&&app.state.annotations.some(r=>ids.includes(r.id)&&r.rolePlans))return root.ASMachCharacteristicEditing.open(app,ids,{plansOnly:true});
   targets=[...new Set(ids)].filter(id=>app.state.annotations.some(r=>r.id===id));if(targets.length<2)return;recordsAtOpen=app.state.annotations;
   if(!dialog){
     dialog=document.createElement('dialog');dialog.style.cssText='width:min(520px,94vw);border:1px solid #bdd6de;border-radius:16px;padding:24px;box-shadow:0 25px 80px #00172e66;color:#153247';
     dialog.className='asmach-modal bulk-plan-dialog';
     dialog.innerHTML='<form id="bulkPlanForm"><h2 style="margin:0 0 8px;font-size:20px">Toplu kontrol planı</h2><p id="bulkPlanCount"></p><div style="display:grid;gap:12px"><label>Kontrol yöntemi<select id="bulkPlanMethod" style="display:block;width:100%;padding:10px;margin-top:5px"></select></label><label>Kontrol sıklığı<select id="bulkPlanFrequency" style="display:block;width:100%;padding:10px;margin-top:5px"></select></label><label id="bulkPlanIntervalField" hidden>Her N parçada<input id="bulkPlanInterval" type="number" min="1" step="1" style="display:block;padding:9px;width:100%;box-sizing:border-box"></label><label id="bulkPlanNoteField" hidden>Kontrol planı açıklaması<input id="bulkPlanNote" type="text" style="display:block;padding:9px;width:100%;box-sizing:border-box"></label></div><p style="font-size:12px;color:#607888;line-height:1.5">Değiştirme seçili alanlar korunur. Yöntemi değiştirirseniz ilgili balon stili de uygulanır. Ölçü, tolerans ve balon konumları değişmez.</p><p id="bulkPlanError" role="alert" style="color:#b32839"></p><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" id="bulkPlanCancel">Vazgeç</button><button type="submit" class="btn primary">Seçilenlere uygula</button></div></form>';
     document.body.append(dialog);const $=id=>document.getElementById(id);$('bulkPlanForm').noValidate=true;
     const remove=document.createElement('button');remove.id='bulkPlanDelete';remove.type='button';remove.className='btn danger';remove.textContent='Seçilenleri sil';remove.style.marginRight='auto';$('bulkPlanCancel').before(remove);
     remove.onclick=()=>{if(app.state.annotations!==recordsAtOpen){$('bulkPlanError').textContent='Çizim değişti. Balonları yeniden seçin.';return;}const ids=[...targets];dialog.close();void app.removeAnnotations?.(ids);};
     $('bulkPlanCancel').onclick=()=>dialog.close();
     $('bulkPlanFrequency').onchange=()=>{const f=$('bulkPlanFrequency').value;$('bulkPlanIntervalField').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(f);$('bulkPlanNoteField').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS','CUSTOM'].includes(f);};
     $('bulkPlanForm').onsubmit=event=>{event.preventDefault();if(app.state.annotations!==recordsAtOpen){$('bulkPlanError').textContent='Çizim değişti. Balonları yeniden seçin.';return;}
       const result=apply(app,targets,{method:$('bulkPlanMethod').value,frequency:$('bulkPlanFrequency').value,interval:$('bulkPlanInterval').value,note:$('bulkPlanNote').value});
       if(result.error){$('bulkPlanError').textContent=result.error;return;}dialog.close();app.toast(result.changed?`${result.changed} balonun kontrol planı güncellendi.`:'Değişiklik yapılmadı.');};
   }
   const $=id=>document.getElementById(id),options=(node,items)=>{node.replaceChildren(new Option('Değiştirme — mevcut değerleri koru',KEEP),...items.map(m=>new Option(m.label,m.value)));node.value=KEEP;};
   options($('bulkPlanMethod'),app.getMethods());options($('bulkPlanFrequency'),root.ASMachInspectionPlan.FREQUENCIES);
   $('bulkPlanInterval').value='';$('bulkPlanNote').value='';$('bulkPlanError').textContent='';$('bulkPlanIntervalField').hidden=true;$('bulkPlanNoteField').hidden=true;
   const chosen=app.state.annotations.filter(r=>targets.includes(r.id));$('bulkPlanCount').textContent=`${targets.length} seçili balon · ${chosen.slice(0,12).map(r=>'#'+r.number).join(', ')}${targets.length>12?'…':''}`;
   if(root.ASMachRolePlans){let button=$('bulkRolePlans');if(!button){button=document.createElement('button');button.type='button';button.className='btn';button.id='bulkRolePlans';button.textContent='Kalite / Operatör planlarını toplu düzenle';$('bulkPlanCount').after(button);}button.onclick=()=>{const ids=[...targets];dialog.close();root.ASMachCharacteristicEditing.open(app,ids,{plansOnly:true});};}
   dialog.showModal();$('bulkPlanMethod').focus();
 }
 root.ASMachBulkPlan={init,open,apply,KEEP};
})(window);
