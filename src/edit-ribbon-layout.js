(function(root){
 'use strict';
 function init(){
  const panel=document.getElementById('rbPanel-format'),bar=panel?.querySelector('.fr-bar'),defaults=panel?.querySelector('.rd-defaults');
  if(!bar||!defaults)return;
  panel.classList.add('office-edit-ribbon');
  if(!document.getElementById('ribbonTemplateEditor')){const group=document.createElement('div');group.className='rb-group';const tools=document.createElement('div');tools.className='rb-tools';const button=document.createElement('button');button.id='ribbonTemplateEditor';button.type='button';button.className='btn';button.title='Excel şablon düzenleyicisini aç';button.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px';const icon=document.createElement('img');icon.src=root.ASMachEditIcons.template;icon.alt='';icon.width=24;icon.height=24;button.append(icon,document.createTextNode('Şablon Düzenleyici'));button.onclick=()=>root.ASMachExcelCellTemplate.pickEditor(root.ASMachApp);tools.append(button);const caption=document.createElement('div');caption.className='rb-caption';caption.textContent='Excel şablonları';group.append(tools,caption);panel.append(group);}
  defaults.querySelectorAll('.rd-section').forEach((group,index)=>{if(index>1)group.classList.add('edit-defaults-hidden');});
  defaults.querySelector('[aria-controls="rd-popup-0"]')?.classList.add('edit-defaults-hidden');
  const classLabel=document.createElement('label');classLabel.textContent='Karakteristik sınıfı';const classSelect=document.createElement('select');classSelect.id='ribbonCharacteristicClass';classSelect.setAttribute('aria-label','Karakteristik sınıfı');classLabel.append(classSelect);defaults.querySelectorAll('.rd-section')[1]?.append(classLabel);
  const syncClass=()=>{const source=document.getElementById('characteristicClass');if(!source)return;const options=source.innerHTML;if(classSelect.innerHTML!==options)classSelect.innerHTML=options;classSelect.value=source.value;classSelect.disabled=!root.ASMachApp?.selectedAnnotation();classSelect.title='Seçili karakteristiğin sınıfı';};
  classSelect.onchange=()=>{const source=document.getElementById('characteristicClass');if(source){source.value=classSelect.value;source.dispatchEvent(new Event('change',{bubbles:true}));syncClass();}};
  const watchClass=()=>{const source=document.getElementById('characteristicClass');if(!source)return false;new MutationObserver(syncClass).observe(source,{childList:true,subtree:true});syncClass();return true;};
  if(!watchClass()){const pending=new MutationObserver(()=>{if(watchClass())pending.disconnect();});pending.observe(document.body,{childList:true,subtree:true});}
  const numberingButton=document.getElementById('viewNumberingButton'),numberingGroup=numberingButton?.closest('.rb-group');
  if(numberingButton&&numberingGroup){const icon=numberingButton.querySelector('svg,img');numberingButton.replaceChildren();if(icon)numberingButton.append(icon);numberingButton.append(document.createTextNode('Balon sırası'));numberingButton.title='Görünüşleri düzenle ve balon numaralarının sırasını belirle · R';numberingButton.setAttribute('aria-label','Balon sırası');numberingButton.setAttribute('aria-keyshortcuts','R');bar.append(numberingButton);numberingGroup.remove();}
  document.querySelector('.toolbar')?.classList.remove('rb-collapsed');
  const templateButton=document.getElementById('ribbonTemplateEditor'),templateGroup=templateButton?.closest('.rb-group');
  if(templateButton){templateButton.removeAttribute('style');templateButton.setAttribute('aria-label','Şablon Düzenleyici');if(numberingButton?.parentElement===bar)numberingButton.after(templateButton);else bar.append(templateButton);templateGroup?.remove();}
  document.querySelector('.rb-collapse')?.remove();
  const settingsPanel=document.getElementById('rbPanel-view'),settingsButton=document.getElementById('appSettingsButton'),helpButton=document.getElementById('helpButton');
  if(settingsPanel&&settingsButton&&helpButton){
   const oldStyle=document.getElementById('balloonSettingsButton')?.closest('.rb-group');if(oldStyle)oldStyle.classList.add('ribbon-retired-group');
   const tools=settingsButton.closest('.rb-tools');
   const license=document.createElement('button');license.id='ribbonLicenseButton';license.type='button';license.className='btn';license.onclick=()=>root.ASMachLicenseCenter?.open();
   const about=document.createElement('button');about.id='ribbonAboutButton';about.type='button';about.className='btn';about.dataset.workspaceTrigger='about';about.onclick=()=>root.ASMachAbout?.open();
   tools.append(license,about,helpButton);
   for(const [button,key,title]of [[settingsButton,'settings','Ayarlar'],[license,'license','Lisans'],[about,'about','Hakkında'],[helpButton,'help','Yardım']]){const img=document.createElement('img');img.src=root.ASMachEditIcons[key];img.alt='';img.width=24;img.height=24;button.replaceChildren(img,document.createTextNode(title));button.title=title;button.setAttribute('aria-label',title);}
   settingsButton.closest('.rb-group').querySelector('.rb-caption').textContent='Ayarlar ve destek';
   document.getElementById('rbTab-help').hidden=true;
  }
  // Keep the same controls and change handlers, without expanding contextual bars.
  const scanTools=document.getElementById('boxOcrModeButton')?.closest('.rb-tools');
  if(scanTools){
   for(const [id,title] of [['boxScanMode','Ekleme şekli'],['boxContentMode','Algılama türü']]){
    const source=document.getElementById(id),choices=document.querySelector('[data-for="'+id+'"]')?.closest('.qt-options');
    if(!source)continue;
    const oldGroup=choices?.closest('.rb-group');if(oldGroup)oldGroup.classList.add('ribbon-retired-group');
    source.hidden=true;
    if(!choices)continue;
    choices.classList.remove('qt-options');choices.classList.add('ribbon-choice-grid');
    if(id==='boxContentMode')choices.classList.add('ribbon-choice-grid-four');
    choices.setAttribute('aria-label',title);
    for(const button of choices.querySelectorAll('button')){const mark=document.createElement('span');mark.className='ribbon-choice-check';mark.setAttribute('aria-hidden','true');button.append(mark);}
    const group=document.createElement('section');group.className='rb-group';const tools=document.createElement('div');tools.className='rb-tools';tools.append(choices);const caption=document.createElement('div');caption.className='rb-caption';caption.textContent=title;group.append(tools,caption);scanTools.closest('.rb-panel').append(group);
    const after=id==='boxScanMode'?scanTools.closest('.rb-group'):document.querySelector('.ribbon-choice-grid:not(.ribbon-choice-grid-four)').closest('.rb-group');after.after(group);
   }
  }
  const projectGroup=document.getElementById('projectSetupButton')?.closest('.rb-group');if(projectGroup)projectGroup.parentElement.prepend(projectGroup);
  const visibility=document.getElementById('extractedVisibilityButton'),editTools=document.getElementById('undoButton')?.closest('.rb-tools');
  if(visibility&&editTools){const previous=visibility.closest('.rb-group');editTools.append(visibility);previous?.remove();}
  const manual=document.getElementById('manualToolsButton'),manualOptions=document.getElementById('manualToolOptions');
  if(manual&&manualOptions){
   manualOptions.classList.add('ribbon-retired-options');
   const label=document.createElement('label');label.className='ribbon-manual-field';label.textContent='Tür';
   const select=document.createElement('select');select.id='ribbonManualType';select.setAttribute('aria-label','Karakteristik ekleme türü');
   for(const [value,text]of [['addModeButton','Balon'],['acuiCreateManual','Ölçü'],['acuiCreateGdt','GD&T'],['acuiCreateNote','Not']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
   select.onchange=()=>document.getElementById(select.value)?.click();label.append(select);manual.after(label);
   document.addEventListener('click',e=>{const id=e.target.closest('button')?.id;if(id==='manualToolsButton')select.value='addModeButton';else if([...select.options].some(o=>o.value===id))select.value=id;},true);
  }
  const buttons=[...bar.querySelectorAll('button')];
  for(const button of buttons){
   const key=button.dataset.mode==='style'?'balloon':button.dataset.mode==='bulk'?'list':'brush';
   const label=button.textContent,preserved=['viewNumberingButton','ribbonTemplateEditor'].includes(button.id)?button.querySelector('svg,img')?.cloneNode(true):null,img=preserved||document.createElement('img'),text=document.createElement('span');
   if(!preserved)img.src=root.ASMachEditIcons[key];img.setAttribute('aria-hidden','true');img.setAttribute('width','32');img.setAttribute('height','32');text.textContent=label;
   button.title=label;button.setAttribute('aria-label',label);button.replaceChildren(img,text);
  }
  bar.setAttribute('role','group');bar.setAttribute('aria-label','Seçili karakteristikleri düzenle');
  const caption=document.createElement('span');caption.className='office-group-caption';caption.textContent='Düzenleme';bar.append(caption);
   defaults.querySelectorAll('.rd-section').forEach((group,index)=>{const legend=group.querySelector('legend');const title=document.createElement('span');title.className='office-group-caption';title.textContent=index===0?'Yeni kayıtlar · Balon':index===1?'Yeni kayıtlar · Ölçü ve tolerans':legend.textContent;group.append(title);});
  const style=document.createElement('style');style.textContent=`
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon{display:flex!important;align-items:stretch!important;flex-wrap:nowrap!important;gap:0!important;padding:8px 8px 4px!important;background:#fff!important;overflow-x:auto!important;max-height:none!important}
   html body #rbPanel-format.office-edit-ribbon .fr-bar{display:flex;position:relative;flex:0 0 274px;align-items:flex-start;gap:3px;margin:0 0 0 0;padding:0 10px 24px 0;border-right:1px solid #d9e2e9;box-sizing:border-box}
   html body #rbPanel-format.office-edit-ribbon .fr-bar button{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:7px;width:82px;height:84px;min-height:84px;padding:7px 4px;border:1px solid transparent;border-radius:4px;background:transparent;color:#19394b;font-size:12px;line-height:16px;white-space:normal;box-shadow:none}
   html body #rbPanel-format.office-edit-ribbon .fr-bar button:hover{background:#e9f5fa;border-color:#c5e0ed}
   html body #rbPanel-format.office-edit-ribbon .fr-bar button:focus-visible{outline:2px solid #008ca0;outline-offset:-2px}
   html body #rbPanel-format.office-edit-ribbon .fr-bar :is(img,svg.tool-icon){width:32px;height:32px;object-fit:contain;flex:none}
   html body #rbPanel-format.office-edit-ribbon [data-count]{position:absolute;right:12px;bottom:4px;font-size:10px;font-weight:500;color:#5c788b;background:#eef5f8;padding:0 4px;border-radius:3px}
   html body #rbPanel-format.office-edit-ribbon .office-group-caption{position:absolute;bottom:3px;left:8px;right:8px;text-align:center;font-size:11px;line-height:16px;color:#567184;pointer-events:none;font-weight:400}
   html body #rbPanel-format.office-edit-ribbon .fr-bar>.office-group-caption{text-align:left;left:7px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-defaults{display:flex!important;flex:1 0 auto!important;align-items:stretch!important;flex-wrap:nowrap!important;width:auto!important;padding:0!important;margin:0!important;gap:0!important;border:0!important;background:transparent!important}
   html body #rbPanel-format.office-edit-ribbon .rd-caption,html body #rbPanel-format.office-edit-ribbon .rd-section legend{display:none!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section{position:relative;display:grid!important;grid-template-columns:1fr;grid-auto-rows:26px;align-content:start!important;gap:3px!important;padding:0 12px 24px!important;border:0!important;border-right:1px solid #d9e2e9!important;min-width:0;max-width:none!important;flex:none;min-height:108px;box-sizing:border-box}
   html body #rbPanel-format.office-edit-ribbon .rd-section:last-child{border-right:0!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section{height:108px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section>.office-group-caption{position:absolute!important;top:auto!important;bottom:3px!important;left:8px!important;right:8px!important;transform:none!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section label{display:flex!important;flex-wrap:nowrap!important;align-items:center;justify-content:space-between;gap:9px;font-size:11px;white-space:nowrap;color:#25465a}
   html body #rbPanel-format.office-edit-ribbon .rd-section select{width:145px!important;max-width:none!important;height:25px;min-height:25px;font-size:11px;background:#fff;border:1px solid #ccdae3;border-radius:3px}
   html body #rbPanel-format.office-edit-ribbon .rd-section:first-of-type{grid-template-columns:repeat(3,auto)!important;grid-template-rows:repeat(2,21px);grid-auto-flow:column;column-gap:8px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section:first-of-type label:has(#rd-size),html body #rbPanel-format.office-edit-ribbon .rd-section:first-of-type label:has(#rd-fontSize),html body #rbPanel-format.office-edit-ribbon .rd-section:first-of-type label:has(#rd-arrowEnabled),html body #rbPanel-format.office-edit-ribbon .rd-section:first-of-type label:has(#rd-boxLineStyle){grid-template-columns:70px 90px!important}
   html body #rbPanel-format.office-edit-ribbon :is(#rd-size,#rd-fontSize,#rd-arrowEnabled,#rd-boxLineStyle){width:90px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(2){grid-template-columns:145px 233px;column-gap:12px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(2) label:nth-of-type(3){grid-column:2;grid-row:1}
   html body #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(2)>button{grid-column:2;grid-row:2;justify-self:end}
   html body #rbPanel-format.office-edit-ribbon #rd-unit,html body #rbPanel-format.office-edit-ribbon #rd-decimalPlaces{width:70px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(3) select{width:112px!important}
   html body #rbPanel-format.office-edit-ribbon .rd-section>button{height:25px;min-height:25px;padding:2px 8px;font-size:11px;white-space:nowrap;background:#fff;border:1px solid #ccdae3;border-radius:3px}
   html body #rbPanel-format.office-edit-ribbon .rd-section>button:hover{background:#e9f5fa;border-color:#b0d3e1}
  `;
  // A panel's hidden state must win over presentation rules on its ID.
  style.textContent+=`
   html body .toolbar.excel-ribbon .rb-panels>.rb-panel[hidden],html body .excel-ribbon #rbPanel-format.office-edit-ribbon[hidden]{display:none!important}
   html body .toolbar.excel-ribbon .rb-panels>.rb-panel:not([hidden]){height:94px!important;min-height:94px!important;max-height:94px!important;box-sizing:border-box!important;padding:5px 8px!important;flex-wrap:nowrap!important;align-items:stretch!important;gap:0!important;background:#fff!important;overflow-x:auto!important;overflow-y:hidden!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar{flex-basis:320px;padding-bottom:17px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar button{width:75px;height:64px!important;min-height:64px!important;gap:3px;padding:2px 4px!important;font-size:11px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar :is(img,svg.tool-icon){width:25px;height:25px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section{height:82px!important;min-height:82px!important;grid-auto-rows:21px;gap:2px!important;padding:0 10px 17px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section select,html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section>button{height:21px!important;min-height:21px!important;padding:1px 4px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .office-group-caption{bottom:0!important;font-size:10px}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format)>.rb-group{flex:0 0 auto!important;position:relative;justify-content:space-between!important;padding:0 9px!important;border:0!important;border-right:1px solid #d9e2e9!important;border-radius:0!important;background:transparent!important}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-caption{display:block!important;font-size:10px;line-height:16px;color:#567184;text-align:center}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools{height:65px;flex-wrap:nowrap!important;align-items:flex-start!important;gap:3px}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools>.btn{display:flex!important;flex-direction:column!important;justify-content:center;align-items:center;width:84px;max-width:100px!important;height:64px!important;min-height:64px!important;padding:3px 4px!important;gap:4px!important;border:1px solid transparent;background:transparent;color:#23465b;box-shadow:none;white-space:normal!important;line-height:14px}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools>.btn:hover{background:#e9f5fa;border-color:#c5e0ed}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools>.btn:is(.mode-active,[aria-pressed=true]){background:#dff2f6;border-color:#9dccd6}
   html body .toolbar.excel-ribbon .rb-tools>.btn>svg.tool-icon,html body .toolbar.excel-ribbon .rb-tools>.btn>img{width:24px!important;height:24px!important;min-width:24px!important;max-width:24px!important;flex:0 0 24px!important;object-fit:contain}
   html body .toolbar.excel-ribbon .rb-panel :is(kbd,.qt-key){display:none!important}
   html body .toolbar.excel-ribbon.rb-no-tools:not(.rb-collapsed) .rb-panels{display:block!important}
   html body .toolbar.excel-ribbon.rb-collapsed .rb-panels{display:none!important}
   html body .toolbar.excel-ribbon #rbPanel-drawing :is(#undoButton,#redoButton){display:flex!important;flex-direction:column!important;align-items:center;justify-content:center;width:70px;height:64px!important;min-height:64px!important;gap:4px!important;white-space:normal!important;background:transparent;border:1px solid transparent;padding:3px!important}
   html body .toolbar.excel-ribbon #rbPanel-drawing :is(#undoButton,#redoButton) svg{width:24px!important;height:24px!important;min-width:24px!important;max-width:24px!important;flex:0 0 24px!important}
   html body .toolbar.excel-ribbon .ribbon-retired-group,html body .toolbar.excel-ribbon .ribbon-retired-options{display:none!important}
   html body .toolbar.excel-ribbon #rbTab-help[hidden]{display:none!important}
   html body .toolbar.excel-ribbon #rbPanel-view #helpButton{border-radius:4px!important;font-weight:400!important}
   html body .toolbar.excel-ribbon .ribbon-compact-fields{display:grid;gap:5px;padding:4px 2px;align-self:center}
   html body .toolbar.excel-ribbon .ribbon-compact-fields label{display:grid;grid-template-columns:72px 104px;gap:6px;align-items:center;font-size:11px;white-space:nowrap}
   html body .toolbar.excel-ribbon .ribbon-compact-fields select,html body .toolbar.excel-ribbon .ribbon-manual-field select{display:block!important;width:104px;height:24px;min-height:24px;padding:2px 5px;background:#fff;color:#24465b;border:1px solid #cbdce6;border-radius:4px;font-size:11px}
   html body .toolbar.excel-ribbon .ribbon-manual-field{display:flex;flex-direction:column;align-self:center;gap:4px;font-size:11px;padding:0 4px}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format)>.rb-group{padding:0 6px!important}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools>.btn{width:74px!important;font-size:10px!important}
   /* Always-visible compact ribbon: 94px -> 66px (30% reduction). */
   html body .toolbar.excel-ribbon .rb-panels{display:block!important}
   html body .toolbar.excel-ribbon .rb-collapse{display:none!important}
   html body .toolbar.excel-ribbon .rb-panels>.rb-panel:not([hidden]){height:66px!important;min-height:66px!important;max-height:66px!important;padding:3px 6px!important}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools{height:46px!important}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-tools>.btn,html body .toolbar.excel-ribbon #rbPanel-drawing :is(#undoButton,#redoButton){height:44px!important;min-height:44px!important;padding:1px 3px!important;gap:1px!important;font-size:10px!important;line-height:12px!important}
   html body .toolbar.excel-ribbon .rb-tools>.btn>svg.tool-icon,html body .toolbar.excel-ribbon .rb-tools>.btn>img,html body .toolbar.excel-ribbon #rbPanel-drawing :is(#undoButton,#redoButton) svg{width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;flex:0 0 18px!important}
   html body .toolbar.excel-ribbon .rb-panel:not(#rbPanel-format) .rb-caption{font-size:9px!important;line-height:12px!important}
   html body .toolbar.excel-ribbon .ribbon-compact-fields{gap:2px;padding:0}
   html body .toolbar.excel-ribbon .ribbon-compact-fields select,html body .toolbar.excel-ribbon .ribbon-manual-field select{height:20px;min-height:20px;padding:0 4px}
   html body .toolbar.excel-ribbon .ribbon-manual-field{gap:1px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar{padding-bottom:12px;flex:0 0 400px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar>button{flex:0 0 75px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar button{height:44px!important;min-height:44px!important;gap:1px!important;padding:0 3px!important;line-height:12px!important;font-size:10px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .fr-bar :is(img,svg.tool-icon){width:18px;height:18px}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon #viewNumberingButton>svg.tool-icon{width:22px!important;height:22px!important;min-width:22px!important;max-width:22px!important;flex:0 0 22px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section{height:60px!important;min-height:60px!important;grid-auto-rows:20px;padding-bottom:13px!important;gap:1px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(3){grid-template-columns:200px 115px;column-gap:7px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(3)>button{grid-column:2;grid-row:1 / span 2;align-self:center}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .office-group-caption{font-size:9px!important;line-height:12px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon [data-count]{font-size:9px;bottom:0}
   html body .toolbar.excel-ribbon .ribbon-choice-grid{display:grid!important;grid-template-columns:110px;grid-template-rows:21px 21px;gap:2px;align-self:center;padding:0;background:transparent;border:0}
   html body .toolbar.excel-ribbon .ribbon-choice-grid-four{grid-template-columns:100px 86px}
   html body .toolbar.excel-ribbon .ribbon-choice-grid>.qt-choice{display:flex!important;align-items:center;justify-content:flex-start;gap:4px!important;padding:1px 4px!important;min-height:21px!important;height:21px!important;border:1px solid #d7e3eb;border-radius:3px;background:#fff;font-size:10px!important;white-space:nowrap;box-shadow:none!important}
   html body .toolbar.excel-ribbon .ribbon-choice-grid>.qt-choice svg{width:13px!important;height:13px!important;min-width:13px!important;max-width:13px!important;flex:0 0 13px!important}
   html body .toolbar.excel-ribbon .ribbon-choice-check{width:11px;height:11px;border:1px solid #92acba;border-radius:2px;margin-left:auto;display:flex;align-items:center;justify-content:center;flex:none;font-size:10px;line-height:11px}
   html body .toolbar.excel-ribbon .ribbon-choice-grid>.qt-choice[aria-pressed=true]{background:#e4f4f7!important;border-color:#71bac6!important;color:#006b7c}
   html body .toolbar.excel-ribbon .qt-choice[aria-pressed=true]>.ribbon-choice-check{background:#008c9e;border-color:#008c9e;color:white}
   html body .toolbar.excel-ribbon .qt-choice[aria-pressed=true]>.ribbon-choice-check::after{content:'✓'}
    html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group{flex:0 0 88px;padding:0 6px;justify-content:space-between;border-right:1px solid #d9e2e9;background:#fff!important;border-radius:0!important;box-shadow:none!important}
   html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group .rb-tools{height:44px}
    html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group .btn,html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group #viewNumberingButton:not(:hover){display:flex;flex-direction:column;align-items:center;justify-content:center;height:44px!important;min-height:44px!important;width:84px;padding:1px 3px!important;gap:2px!important;background:transparent!important;border:1px solid transparent!important;box-shadow:none!important;font-size:10px!important;line-height:12px}
   html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group .btn:hover{background:#e9f5fa;border-color:#c5e0ed}
   html body .toolbar.excel-ribbon #rbPanel-format .edit-numbering-group .rb-caption{display:block!important;text-align:center;font-size:9px;line-height:12px;color:#567184}
   html body .toolbar.excel-ribbon #rbPanel-format .edit-defaults-hidden{display:none!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(2){grid-template-columns:155px 275px!important;column-gap:16px!important}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section:nth-of-type(2) label:nth-of-type(4){grid-column:2;grid-row:2}
   html body .excel-ribbon #rbPanel-format.office-edit-ribbon .rd-section label{gap:8px!important}
  `;document.head.append(style);
 }
 root.ASMachEditRibbonLayout={init};
})(window);
