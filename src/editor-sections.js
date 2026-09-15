/* Shared visual structure. Existing live fields and their handlers are retained. */
(function(root){
 'use strict';
 function section(el,title){
  if(!el||el.dataset.managedSection&&el.querySelector(':scope > .es-heading'))return;el.dataset.managedSection='true';el.classList.add('es-section');
  const h=[...el.children].find(n=>n.tagName==='H3'),button=document.createElement('button');button.type='button';button.className='es-heading';button.setAttribute('aria-expanded','true');
  button.innerHTML='<span class="es-chevron" aria-hidden="true">▾</span><span class="es-title"></span><span class="es-status"></span>';button.querySelector('.es-title').textContent=title||h?.textContent||'Bilgiler';if(h)h.hidden=true;el.prepend(button);
  button.setAttribute('aria-expanded',String(!el.classList.contains('es-collapsed')));
  button.onclick=()=>{const collapsed=el.classList.toggle('es-collapsed');button.setAttribute('aria-expanded',String(!collapsed));button.querySelector('.es-chevron').textContent=collapsed?'▸':'▾';};
 }
 function expand(el){if(!el)return;el.classList.remove('es-collapsed');el.querySelector(':scope > .es-heading')?.setAttribute('aria-expanded','true');}
 function toolbar(container){if(!container||container.querySelector(':scope > .es-tools'))return;const bar=document.createElement('div');bar.className='es-tools';bar.innerHTML='<span>Bölümler</span><button type="button" data-expand>Tümünü aç</button><button type="button" data-collapse>Tümünü daralt</button>';container.prepend(bar);bar.querySelector('[data-expand]').onclick=()=>container.querySelectorAll('.es-section').forEach(expand);bar.querySelector('[data-collapse]').onclick=()=>container.querySelectorAll('.es-section').forEach(s=>{s.classList.add('es-collapsed');s.querySelector(':scope > .es-heading')?.setAttribute('aria-expanded','false');});}
 function badge(el,messages){if(!el)return;const b=el.querySelector(':scope > .es-heading .es-status');if(!b)return;b.textContent=messages.length?`${messages.length} uyarı`:'';b.title=messages.join('\n');b.classList.toggle('es-warning',messages.length>0);}
 function detail(record){const d=document.getElementById('acuiEditor');if(!d)return;d.classList.add('es-editor');const main=d.querySelector('.acui-editor-main');toolbar(main);main?.querySelectorAll('section.acui-section').forEach(s=>section(s,s.id==='acuiRolePlans'?'Operatör / kalite kontrol planları':undefined));
  const issues=root.ASMachInspectionPlan.checkInformation(record);const groups={identity:[],measure:[],gdt:[],control:[],review:root.ASMachRequirements.activeWarnings(record)};
  for(const i of issues){const key=['identity','type','requirement'].includes(i.code)?'identity':['method','frequency'].includes(i.code)?'control':i.code==='gdt'?'gdt':'measure';groups[key].push(i.label);}
  badge(main?.querySelector('.acui-identity'),groups.identity);badge(d.querySelector('#acuiNumericSection'),groups.measure);badge(d.querySelector('#acuiGdtSection'),groups.gdt);badge(d.querySelector('#acuiRolePlans'),record.rolePlans?groups.control:[]);badge(d.querySelector('#acuiControlSection'),record.rolePlans?[]:groups.control);badge(d.querySelector('#acuiWarningReview'),groups.review);
  root.ASMachCharacteristicWorkbench?.detail(record);
 }
 function ocr(){const fields=document.querySelector('.ocr-fields');if(!fields)return;if(!fields.dataset.sectionsReady){fields.dataset.sectionsReady='true';fields.classList.add('es-ocr-fields');const initial=[...fields.children];const groups=[['Kimlik ve gereklilik',['ocrRequirement','ocrCharacteristicType','ocrUnit']],['Ölçü, tolerans ve GD&T',['ocrNominal','ocrLowerTolerance','ocrUpperTolerance','ocrGeneralTolerance','ocrGdtField','ocrTypeExtras','ocrFitField']],['Değerlendirme / kontrol',['ocrEvaluationMethod','ocrInspectionMethod','ocrInspectionFrequency']]];
   groups[2][1].push('ocrFrequency','ocrFrequencyInterval','ocrFrequencyNote');
   for(const [title,ids] of groups){const box=document.createElement('section');box.className='es-ocr-group';for(const n of initial)if(ids.some(id=>n.id===id||n.querySelector('#'+id)))box.append(n);if(box.children.length){fields.append(box);section(box,title);}}for(const n of initial)if(n.parentElement===fields)fields.append(n);toolbar(fields);
  }
  const role=document.getElementById('ocrRolePlans');if(role)section(role,'Operatör / kalite kontrol planları');
  for(const s of fields.querySelectorAll('.es-section')){const missing=[];for(const f of s.querySelectorAll('input,select,textarea')){if(f.closest('[hidden]')||f.disabled||f.type==='checkbox')continue;if(['ocrRequirement','ocrUnit'].includes(f.id)&&!f.value.trim())missing.push('Bilgi eksik');if(f.id==='ocrNominal'&&!f.value.trim()&&document.getElementById('ocrCharacteristicType').value!=='GD&T')missing.push('Nominal eksik');}
   if(s.querySelector('#ocrUpperTolerance')){const profile=root.ASMachRequirements.fieldProfile(document.getElementById('ocrCharacteristicType').value);if(profile.tolerance&&document.getElementById('ocrEvaluationMethod').value!=='OK_NOT_OK'&&!document.getElementById('ocrUpperTolerance').value.trim()&&!document.getElementById('ocrLowerTolerance').value.trim())missing.push('Tolerans / kabul sınırı eksik');}
   if(s.querySelector('#ocrGdtSubtype')&&document.getElementById('ocrCharacteristicType').value==='GD&T'&&['','unknown'].includes(document.getElementById('ocrGdtSubtype').value))missing.push('GD&T türünü seçin');
   if(s.id==='ocrRolePlans'){const plans=root.ASMachOcrReviewControls?.frequency().rolePlans;if(plans){const error=root.ASMachRolePlans.validate({rolePlans:plans});if(error)missing.push(error);}}
   badge(s,missing);}
  root.ASMachCharacteristicWorkbench?.ocr();
 }
 function init(){const css=document.createElement('style');css.textContent=`
 .es-heading{width:100%;display:flex;gap:7px;align-items:center;text-align:left;border:0;border-bottom:1px solid #dce5ed;background:#eff5f8;color:#173c50;font:600 11px inherit;padding:7px 8px;cursor:pointer;border-radius:5px;margin-bottom:8px}.es-title{font-size:11px;font-weight:700}.es-status{margin-left:auto;font-size:10px}.es-warning{background:#fff1d8;color:#895000;border:1px solid #ead09e;padding:2px 6px;border-radius:4px}.es-collapsed>:not(.es-heading){display:none!important}.es-collapsed>.es-heading{margin-bottom:0}.es-heading:focus-visible{outline:2px solid #07899a}.es-tools{display:flex;align-items:center;gap:8px;font-size:10px;margin-bottom:7px;color:#5b7287}.es-tools button{border:1px solid #ccdce6;border-radius:4px;background:white;color:#31546b;padding:4px 7px;font-size:10px;cursor:pointer}
 #acuiEditor.es-editor{width:min(1120px,calc(100vw - 24px))!important}#acuiEditor.es-editor .acui-editor-layout{grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr)!important;gap:12px}#acuiEditor.es-editor .acui-editor-aside{grid-column:1;grid-row:1;position:sticky;top:0;align-self:start}#acuiEditor.es-editor .acui-editor-main{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:7px}#acuiEditor.es-editor .acui-snapshot{height:260px;max-height:34vh;object-fit:contain}#acuiEditor.es-editor .acui-section{padding:8px;margin:0;border-radius:6px}#acuiEditor.es-editor .acui-grid{gap:6px}#acuiEditor.es-editor .acui-field>span{font-size:9px}#acuiEditor.es-editor input:not([type=checkbox]),#acuiEditor.es-editor select{min-height:28px;padding:5px 6px;font-size:11px}#acuiEditor.es-editor textarea{min-height:44px;font-size:11px}#acuiEditor.es-editor .acui-head,#acuiEditor.es-editor .acui-foot{padding:10px 14px}#acuiEditor.es-editor .acui-content{padding:10px}#acuiEditor.es-editor .acui-head h2{font-size:16px}#acuiEditor.es-editor p,#acuiEditor.es-editor small{font-size:10px;line-height:1.4}#acuiEditor.es-editor .btn{min-height:27px;font-size:10px;padding:4px 7px}
 .es-ocr-fields{display:flex!important;flex-direction:column;gap:7px!important}.es-ocr-group{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;border:1px solid #dce5ed;padding:8px;border-radius:6px}.es-ocr-group>.es-heading{grid-column:1/-1}.es-ocr-group>.field{grid-column:span 3}.es-ocr-group>.field.full{grid-column:1/-1}.es-ocr-group>.ocr-measure-field{grid-column:span 2}.ocr-review-card .modal-body{padding:10px}.ocr-review-card .field input,.ocr-review-card .field select{height:28px;min-height:28px;font-size:11px}.ocr-review-card .field textarea{min-height:44px;height:44px;font-size:11px}.ocr-review-card .field label{font-size:9px}.ocr-review-card .btn{min-height:27px;font-size:10px;padding:4px 7px}.ocr-review-grid{gap:12px}.ocr-snapshot{position:sticky;top:0;align-self:start}.ocr-review-card .role-plan-host label{font-size:10px}
 /* Dense application shell: fixed command bars, narrow source pane, full-width fields. */
 #acuiEditor.es-editor,#ocrReviewModal .ocr-review-card{width:min(1240px,calc(100vw - 24px))!important;border-radius:8px;font-size:11px}
 #acuiEditor.es-editor .acui-head,#ocrReviewModal .modal-head{padding:8px 12px!important;min-height:48px}
 #acuiEditor.es-editor .acui-head h2,#ocrReviewModal .modal-head h3{font-size:14px;line-height:1.25;margin:2px 0 0}
 #acuiEditor.es-editor .acui-head p{display:none}
 #acuiEditor.es-editor .acui-eyebrow,#ocrReviewModal .modal-head small{font-size:9px;letter-spacing:.6px;margin:0}
 #acuiEditor.es-editor .acui-close{width:28px;height:28px;font-size:18px;padding:0}
 #acuiEditor.es-editor .acui-content,#ocrReviewModal .modal-body{padding:8px!important;background:#eef2f5}
 #acuiEditor.es-editor .acui-editor-layout,#ocrReviewModal .ocr-review-grid{display:grid;grid-template-columns:minmax(240px,290px) minmax(0,1fr)!important;gap:8px;align-items:start}
 #acuiEditor.es-editor .acui-editor-main,#ocrReviewModal .es-ocr-fields{min-width:0;align-items:stretch;gap:5px!important}
 #acuiEditor.es-editor .acui-editor-main>*,#ocrReviewModal .es-ocr-fields>*{width:100%;min-width:0;max-width:100%;box-sizing:border-box}
 #acuiEditor.es-editor .acui-section,#ocrReviewModal .es-section{padding:6px;margin:0;border-radius:3px;background:white}
 #acuiEditor.es-editor .es-heading,#ocrReviewModal .es-heading{min-height:26px;padding:4px 6px;margin-bottom:5px;border-radius:2px;line-height:16px}
 #acuiEditor.es-editor .es-heading .es-title,#ocrReviewModal .es-heading .es-title{font-size:11px}
 #acuiEditor.es-editor .es-tools,#ocrReviewModal .es-tools{margin:0;gap:5px;min-height:25px}
 #acuiEditor.es-editor .acui-grid{gap:5px 7px}
 #acuiEditor.es-editor .acui-field,#ocrReviewModal .field{gap:3px;margin:0}
 #acuiEditor.es-editor .acui-field>span,#ocrReviewModal .field>label{font-size:9px;line-height:12px}
 #acuiEditor.es-editor input:not([type=checkbox]),#acuiEditor.es-editor select,#ocrReviewModal input:not([type=checkbox]),#ocrReviewModal select{height:26px;min-height:26px;padding:3px 6px;font-size:11px;border-radius:3px;line-height:18px}
 #acuiEditor.es-editor textarea,#ocrReviewModal .field textarea{height:38px;min-height:38px;padding:4px 6px;font-size:11px;border-radius:3px}
 #acuiEditor.es-editor .btn,#ocrReviewModal .btn{min-height:26px;padding:4px 7px;font-size:10px;line-height:16px;border-radius:4px}
 #acuiEditor.es-editor p,#acuiEditor.es-editor small,#ocrReviewModal small,#ocrReviewModal .ocr-note{font-size:10px;line-height:1.3;margin:4px 0}
 #acuiEditor.es-editor .acui-actions{gap:5px;margin-top:5px;flex-wrap:wrap}
 #acuiEditor.es-editor .acui-snapshot{height:170px;max-height:24vh;padding:5px;margin:0}
 #acuiEditor.es-editor .acui-editor-aside{display:flex;flex-direction:column;gap:5px}
 #acuiEditor.es-editor .acui-editor-aside h3{font-size:11px;margin:0 0 5px}
 #acuiEditor.es-editor .acui-region-actions{gap:4px;margin-top:5px}
 #acuiEditor.es-editor .acui-information-check{padding:5px 7px;font-size:10px;border-radius:3px}
 #acuiEditor.es-editor .acui-information-check ul{margin:3px 0;padding-left:16px}
 #acuiEditor.es-editor .acui-foot,#ocrReviewModal .modal-actions{padding:7px 10px!important;gap:5px!important;background:#f8fafb;border-top:1px solid #ccd6df}
 #ocrReviewModal .snapshot-stage{height:190px!important;padding:4px}
 #ocrReviewModal .snapshot-toolbar,#ocrReviewModal .snapshot-placement{padding:6px;gap:4px}
 #ocrReviewModal .snapshot-toolbar button{font-size:10px;min-height:25px;padding:3px 6px}
 #ocrReviewModal .snapshot-toolbar small,#ocrReviewModal .snapshot-placement small{font-size:9px;line-height:1.25}
 #ocrReviewModal .ocr-snapshot{border-radius:3px;overflow:hidden}
 #ocrReviewModal .es-ocr-group{gap:5px 7px}
 #acuiEditor.es-editor .role-plan-host,#ocrReviewModal .role-plan-host{font-size:11px}
 #acuiEditor.es-editor fieldset,#ocrReviewModal fieldset{padding:6px;margin:4px 0;border-radius:3px;min-width:0;align-self:start}
 /* Dashboard cards keep ordinary entry fields close to their content width. */
 #ocrReviewModal .es-ocr-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:7px!important}
 #ocrReviewModal .es-ocr-fields>*{grid-column:1/-1}
 #ocrReviewModal .es-ocr-fields>.es-ocr-group{grid-column:auto;align-content:start}
 #ocrReviewModal .es-ocr-fields>.es-ocr-group:has(#ocrEvaluationMethod){grid-column:1/-1;grid-template-columns:repeat(12,minmax(0,1fr))}
 #ocrReviewModal .es-ocr-group:has(#ocrEvaluationMethod)>.field{grid-column:span 4}
 #ocrReviewModal .es-ocr-group:has(#ocrEvaluationMethod)>.field.full{grid-column:1/-1}
 #ocrReviewModal .es-ocr-group>.field:has(#ocrGeneralTolerance){grid-column:1/-1}
 #ocrReviewModal .field input:not([type=checkbox]),#ocrReviewModal .field select{height:25px;min-height:25px;padding:3px 5px}
 #ocrReviewModal .field textarea{height:40px;min-height:40px}
 #ocrReviewModal .es-section{padding:6px}
 #ocrReviewModal .es-ocr-group .field.full:has(#ocrRequirement){gap:4px}
 #ocrReviewModal .es-ocr-group .field.full:has(#ocrRequirement) .btn{min-height:23px}
 #ocrReviewModal .ocr-review-card{max-height:calc(100dvh - 24px)}
 @media(max-width:1000px){#ocrReviewModal .es-ocr-fields{grid-template-columns:minmax(0,1fr)}#ocrReviewModal .es-ocr-group:has(#ocrEvaluationMethod)>.field{grid-column:span 6}}
 @media(max-width:720px){#acuiEditor.es-editor .acui-editor-layout,#ocrReviewModal .ocr-review-grid{display:flex!important;flex-direction:column}#acuiEditor.es-editor .acui-editor-aside,#ocrReviewModal .ocr-snapshot{position:static;width:100%;order:0}#acuiEditor.es-editor .acui-editor-main,#ocrReviewModal .ocr-fields{width:100%;order:1}#acuiEditor.es-editor .acui-snapshot{height:120px}#ocrReviewModal .snapshot-stage{height:150px!important}}
 `;document.head.append(css);const m=document.getElementById('ocrReviewModal');if(m){m.addEventListener('input',ocr);m.addEventListener('change',ocr);new MutationObserver(()=>{if(m.classList.contains('is-visible'))ocr();}).observe(m,{attributes:true,attributeFilter:['class']});}
 document.addEventListener('invalid',e=>{const s=e.target.closest('.es-section');if(s)expand(s);},true);
 }
 root.ASMachEditorSections={init,detail,ocr,expand};
})(window);
