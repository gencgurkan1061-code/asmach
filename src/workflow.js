/* ASMach local detection, review queue and workbook export. */
(function () {
  'use strict';
  const orderIcons={"rows":"<svg aria-hidden=\"true\" focusable=\"false\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\r\n<path d=\"M4 8L3.29289 7.29289L2.58579 8L3.29289 8.70711L4 8ZM19 10C19 10.5523 19.4477 11 20 11C20.5523 11 21 10.5523 21 10H19ZM7.29289 3.29289L3.29289 7.29289L4.70711 8.70711L8.70711 4.70711L7.29289 3.29289ZM3.29289 8.70711L7.29289 12.7071L8.70711 11.2929L4.70711 7.29289L3.29289 8.70711ZM4 9H18V7H4V9ZM18 9C18.5523 9 19 9.44772 19 10H21C21 8.34315 19.6569 7 18 7V9Z\" fill=\"currentColor\"/>\r\n<path d=\"M20 16L20.7071 15.2929L21.4142 16L20.7071 16.7071L20 16ZM5 16L5 17L5 17L5 16ZM2 14C2 13.4477 2.44772 13 3 13C3.55228 13 4 13.4477 4 14L2 14ZM16.7071 11.2929L20.7071 15.2929L19.2929 16.7071L15.2929 12.7071L16.7071 11.2929ZM20.7071 16.7071L16.7071 20.7071L15.2929 19.2929L19.2929 15.2929L20.7071 16.7071ZM20 17L5 17L5 15L20 15L20 17ZM5 17C3.34315 17 2 15.6569 2 14L4 14C4 14.5523 4.44772 15 5 15L5 17Z\" fill=\"currentColor\"/>\r\n</svg>","columns":"<svg aria-hidden=\"true\" focusable=\"false\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\r\n<path d=\"M8 20L7.29289 20.7071L8 21.4142L8.70711 20.7071L8 20ZM14 5C14.5523 5 15 4.55228 15 4C15 3.44772 14.5523 3 14 3L14 5ZM3.29289 16.7071L7.29289 20.7071L8.70711 19.2929L4.70711 15.2929L3.29289 16.7071ZM8.70711 20.7071L12.7071 16.7071L11.2929 15.2929L7.29289 19.2929L8.70711 20.7071ZM9 20L9 8L7 8L7 20L9 20ZM12 5L14 5L14 3L12 3L12 5ZM9 8C9 6.34315 10.3431 5 12 5L12 3C9.23858 3 7 5.23858 7 8L9 8Z\" fill=\"currentColor\"/>\r\n<path d=\"M16 10L15.2929 9.29289L16 8.58579L16.7071 9.29289L16 10ZM16 18L17 18L16 18ZM14 21C13.4477 21 13 20.5523 13 20C13 19.4477 13.4477 19 14 19L14 21ZM11.2929 13.2929L15.2929 9.29289L16.7071 10.7071L12.7071 14.7071L11.2929 13.2929ZM16.7071 9.29289L20.7071 13.2929L19.2929 14.7071L15.2929 10.7071L16.7071 9.29289ZM17 10L17 18L15 18L15 10L17 10ZM17 18C17 19.6569 15.6569 21 14 21L14 19C14.5523 19 15 18.5523 15 18L17 18Z\" fill=\"currentColor\"/>\r\n</svg>","clockwise":"<svg aria-hidden=\"true\" focusable=\"false\" fill=\"currentColor\" version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" \n\t width=\"16\" height=\"16\" viewBox=\"0 0 92 92\" enable-background=\"new 0 0 92 92\" xml:space=\"preserve\">\n<path id=\"XMLID_275_\" d=\"M86.9,41.8L73,55.8c-0.8,0.8-1.8,1.2-2.9,1.2s-2.1-0.4-2.9-1.2l-13.8-14c-1.5-1.6-1.5-4.1,0-5.7\n\tc1.6-1.5,4.1-1.5,5.7,0l7.7,7.8c-1-14.5-12.9-26-27.4-26C24.3,18,12,30.6,12,46s12.3,28,27.5,28c5.6,0,11-1.7,15.5-4.9\n\tc1.8-1.3,4.3-0.8,5.6,1c1.3,1.8,0.8,4.3-1,5.6C53.7,79.8,46.7,82,39.5,82C19.9,82,4,65.9,4,46s15.9-36,35.5-36\n\tc18.4,0,33.6,14.3,35.3,32.6l6.3-6.4c1.6-1.6,4.1-1.6,5.7,0C88.4,37.7,88.4,40.2,86.9,41.8z\"/>\n</svg>"};
  function mountOrderIcons(select){
    select.hidden=true;select.style.display='none';const wrap=document.createElement('span'),trigger=document.createElement('button'),menu=document.createElement('div');wrap.className='wf-order-icons';trigger.type='button';trigger.className='btn';trigger.id='wfOrderTrigger';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-controls','wfOrderMenu');menu.id='wfOrderMenu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Balon sırası');menu.hidden=true;wrap.append(trigger,menu);select.after(wrap);
    const labels={rows:'Satır satır',columns:'Sütun sütun',clockwise:'Saat yönü'},buttons=[];
    const close=focus=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();};
    for(const [value,title]of Object.entries(labels)){const b=document.createElement('button');b.type='button';b.dataset.order=value;b.setAttribute('role','menuitemradio');b.innerHTML=orderIcons[value]+'<span>'+title+'</span>';b.onclick=e=>{e.preventDefault();if(select.disabled)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));close(true);};menu.append(b);buttons.push(b);}
    select.syncIcon=()=>{const value=labels[select.value]?select.value:'rows';trigger.innerHTML=orderIcons[value]+'<span>'+labels[value]+'</span><span aria-hidden="true">▾</span>';trigger.setAttribute('aria-label','Balon sırası: '+labels[value]);trigger.disabled=select.disabled;buttons.forEach(b=>b.setAttribute('aria-checked',String(b.dataset.order===value)));if(select.disabled)close(false);};
    const open=()=>{if(select.disabled)return;menu.hidden=false;trigger.setAttribute('aria-expanded','true');buttons.find(b=>b.dataset.order===select.value)?.focus();};trigger.onclick=e=>{e.preventDefault();menu.hidden?open():close(false);};trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();open();}};menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const i=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowDown'?1:2))%3;buttons[next].focus();}else if(e.key==='Tab')close(false);};document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close(false);});
    const style=document.createElement('style');style.textContent='.wf-order-icons{position:relative;display:inline-flex}.wf-order-icons svg{width:16px;height:16px;flex:none}.wf-order-icons button{display:flex;align-items:center;gap:7px;white-space:nowrap}.wf-order-icons #wfOrderMenu{position:absolute;bottom:calc(100% + 5px);right:0;z-index:20;min-width:155px;padding:4px;border:1px solid #b9cdda;border-radius:5px;background:white;box-shadow:0 5px 20px #1d405133}.wf-order-icons #wfOrderMenu[hidden]{display:none!important}.wf-order-icons #wfOrderMenu button{width:100%;padding:7px;border:0;border-radius:3px;background:white;color:#25465d;text-align:left;font-size:11px}.wf-order-icons #wfOrderMenu [aria-checked=true]{background:#d9f2f5;font-weight:700}.wf-order-icons #wfOrderMenu button:focus-visible{outline:2px solid #008b9d;outline-offset:-2px}';document.head.append(style);close(false);select.syncIcon();
  }
  let app, panel, candidates = [], cancelled = false, ocrActive=false, scanArea=null, documentKey=null;
  let groupByType=true;
  let queueStamp='',savedCount=0,selectedViewIds=null,selectionDocumentKey=null;
  const savedRows=new Map(),pageAssets=new Map();let deletedBatch=null;
  function addedCandidates(){
    const legacyIds=new Set((app.state.auditLog||[]).filter(e=>e.action==='Otomatik tespitten karakteristik eklendi').map(e=>e.id));
    const views=app.state.metadata?.viewNumbering?.views||[];
    return app.state.annotations.filter(a=>(a.autoDetected||legacyIds.has(a.id))&&a.selectionBox).map(a=>{
      let c=savedRows.get(a.id);if(!c){c={};savedRows.set(a.id,c);}
      const b=a.selectionBox,view=views.find(v=>v.id===a.detectionViewId)||views.find(v=>Number(v.page)===a.page&&b.x+b.w/2>=v.box.x&&b.x+b.w/2<=v.box.x+v.box.w&&b.y+b.h/2>=v.box.y&&b.y+b.h/2<=v.box.y+v.box.h);
      Object.assign(c,{reviewStatus:a.candidateReviewStatus||'',originalText:a.originalOcrText||a.ocrText||a.requirement,addedId:a.id,savedNumber:a.number,selected:false,page:a.page,box:b,scanRegion:view,parsed:a,reviewed:a,text:a.ocrText||a.requirement,snapshot:a.snapshot||'',confidence:a.detectionConfidence,source:a.recognitionSource,plan:{inspectionMethod:a.inspectionMethod,inspectionFrequency:a.inspectionFrequency,frequencyInterval:a.frequencyInterval,frequencyNote:a.frequencyNote,rolePlans:a.rolePlans}},pageAssets.get(a.page)||{});
      return c;
    });
  }
  async function removeCandidates(targets){
    if(el('wfRun').disabled)return;
    const exact=[...new Set(targets)].filter(c=>candidates.includes(c));if(!exact.length)return;
    if(!await window.ASMachMessages.confirm(`${exact.length} algılama adayı listeden silinsin mi?\nKarakteristiğe eklenmiş kayıtlar ve çizim değişmeyecek. Silme işlemini geri alabilirsiniz.`))return;
    deletedBatch={key:documentKey,rows:exact.map(c=>({c,index:candidates.indexOf(c)}))};
    candidates=candidates.filter(c=>!exact.includes(c));renderCandidates();app.toast(`${exact.length} aday silindi. “Silmeyi geri al” ile geri yükleyebilirsiniz.`);
  }
  function undoCandidateDelete(){
    if(el('wfRun').disabled||!deletedBatch||deletedBatch.key!==documentKey)return;
    for(const {c,index} of deletedBatch.rows.sort((a,b)=>a.index-b.index))if(!candidates.some(other=>other.page===c.page&&overlap(other.box,c.box)>.6)&&!app.state.annotations.some(a=>a.page===c.page&&a.selectionBox&&overlap(a.selectionBox,c.box)>.6))candidates.splice(Math.min(index,candidates.length),0,c);
    deletedBatch=null;renderCandidates();app.toast('Son aday silme işlemi geri alındı.');
  }
  const queueFields=['reviewStatus','originalText','selected','page','box','scanRegion','geometryNote','text','parsed','confidence','source','snapshot','sourceTextHeight','plan','reviewed','forcedType','forcedGdtSubtype'];
  function exportQueue(){if(documentKey!==(app.state.pdfDoc||app.state.fileData))return [];return candidates.map(c=>Object.fromEntries(queueFields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));}
  function restoreQueue(rows){savedRows.clear();pageAssets.clear();deletedBatch=null;documentKey=app.state.pdfDoc||app.state.fileData;scanArea=null;candidates=(Array.isArray(rows)?rows:[]).slice(0,2000).filter(c=>Number.isInteger(c.page)&&c.page>=1&&c.page<=app.state.pageCount&&c.box&&[c.box.x,c.box.y,c.box.w,c.box.h].every(Number.isFinite)&&c.box.w>0&&c.box.h>0).map(c=>({...JSON.parse(JSON.stringify(c)),snapshot:/^data:image\//i.test(c.snapshot||'')?c.snapshot:'',parsed:c.parsed||app.parseRequirement(c.text||''),plan:c.plan||defaultPlan()}));queueStamp=JSON.stringify(exportQueue());}
  async function hydrateQueue(list=candidates){const pages=new Map(),key=documentKey;for(const c of list){if(c.pageImage)continue;if(!pages.has(c.page)){const canvas=document.createElement('canvas');if(app.state.pdfDoc){const page=await app.state.pdfDoc.getPage(c.page),v=page.getViewport({scale:1.5});canvas.width=v.width;canvas.height=v.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;}else{canvas.width=app.elements.sourceCanvas.width;canvas.height=app.elements.sourceCanvas.height;canvas.getContext('2d').drawImage(app.elements.sourceCanvas,0,0);}if(key!==(app.state.pdfDoc||app.state.fileData))throw new Error('Belge değişti.');pages.set(c.page,{pageImage:canvas,ink:window.ASMachBalloonPlacement?.inkSampler(canvas)});}Object.assign(c,pages.get(c.page));}}
  function openPlanBatch(targets){
    if(!targets.length)return app.toast('Önce aday seçin.',true);
    const before=targets.map(c=>JSON.stringify(c.plan)),key=documentKey;
    const records=targets.map((c,i)=>({...JSON.parse(JSON.stringify(c.plan)),id:'candidate-plan-'+i,number:String(i+1),type:c.parsed.type,requirement:c.text}));
    const proxy={...app,state:{...app.state,annotations:records},checkpoint(){},recordChange(){},renderAll(){}};
    window.ASMachCharacteristicEditing.open(proxy,records.map(r=>r.id),{plansOnly:true,onApplied(){if(key!==documentKey||targets.some((c,i)=>!candidates.includes(c)||JSON.stringify(c.plan)!==before[i]))return app.toast('Adaylar değişti; plan uygulanmadı.',true);targets.forEach((c,i)=>c.plan.rolePlans=records[i].rolePlans);renderCandidates();}});
  }
  const collapsedTypes=new Set();
  const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  function stopScan(){cancelled=true;if(ocrActive)void window.ASMachOCR.terminate();el('wfProgress').textContent='Durduruluyor… Bulunan ölçüler korunacak.';}
  const el = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = (value) => String(value ?? '').trim() !== '' && Number.isFinite(Number(value));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function init(bridge) {
    app = bridge;
    const button = document.createElement('button'); button.className = 'btn'; button.id = 'autoDetectButton'; button.textContent = 'Otomatik tespit';
    app.elements.boxOcrModeButton.after(button); button.onclick = ()=>open();
    const excel = document.createElement('button'); excel.className = 'btn'; excel.id = 'excelExportButton'; excel.textContent = 'Excel raporları';
    app.elements.csvButton.after(excel); excel.onclick = () => window.ASMachExcelReports.open(app);
    const style = document.createElement('style'); style.textContent = `.wf-dialog{position:fixed;inset:0;z-index:1000;background:#08182799;display:none;align-items:center;justify-content:center;padding:20px}.wf-dialog.open{display:flex}.wf-card{width:min(1040px,96vw);max-height:92vh;background:white;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 24px 90px #001d3455;overflow:hidden}.wf-head{padding:18px 22px;background:#073044;color:white;display:flex;align-items:center;justify-content:space-between}.wf-body{padding:16px 22px;overflow:auto;min-height:0}.wf-tools{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin-bottom:12px}.wf-tools label{display:grid;gap:5px;font-size:12px}.wf-tools select,.wf-tools input{border:1px solid #d6e2eb;border-radius:7px;padding:7px;background:white}.wf-table{width:100%;border-collapse:collapse;font-size:12px}.wf-table td,.wf-table th{border-bottom:1px solid #e0e8ef;padding:8px;text-align:left}.wf-table img{max-width:110px;max-height:40px}.wf-table input[type=text]{width:100%;min-width:130px;border:1px solid #d5e1e8;border-radius:5px;padding:5px}.wf-foot{padding:14px 22px;display:flex;justify-content:space-between;gap:10px;background:#f5f8fa}.wf-note{font-size:12px;color:#576b7c;margin:8px 0}.wf-badge{padding:3px 6px;border-radius:5px;background:#edf5fa}.wf-warning{background:#fff4d9;color:#875500}.status.needs_review{background:#fff3d8;color:#8a5700}.status.approved,.status.pass{background:#e6f6ee;color:#087949}.status.fail,.status.rejected{background:#ffebed;color:#b2253d}.status.measured{background:#eaf1ff;color:#2c58a4}.toolbar{flex-wrap:wrap;gap:5px}.toolbar .btn{padding:7px 10px;font-size:12px}.busy-overlay{z-index:1400}`;
    document.head.append(style);
    panel = document.createElement('div'); panel.className = 'wf-dialog'; panel.id = 'automaticReviewModal'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    panel.innerHTML = `<div class="wf-card"><div class="wf-head"><div><b>Otomatik ölçü tespiti</b><div style="font-size:12px;opacity:.8;margin-top:4px">Adayları gözden geçirin, seçtiklerinizi karakteristik olarak kaydedin.</div></div><button class="btn" id="wfClose">Kapat</button></div><div class="wf-body"><div class="wf-tools"><label>Taranacak sayfalar<select id="wfScope"><option value="current">Geçerli sayfa</option><option value="all">Tüm sayfalar</option></select></label><label>Algılama kalitesi<select id="wfDpi"><option value="300">300 DPI</option><option value="360" selected>360 DPI</option><option value="450">450 DPI</option></select></label><label>En düşük güven (%)<input id="wfConfidence" type="number" min="0" max="100" value="40" style="width:95px"></label><button class="btn primary" id="wfRun">Taramayı başlat</button><button class="btn" id="wfStop" disabled>Durdur</button></div><p class="wf-note" id="wfProgress">Her ölçü için kaynak bölge ve güven oranı saklanır. Aynı sayfadaki aynı bölge yeniden eklenmez.</p><label class="wf-note"><input id="wfSelectAll" type="checkbox" checked> Tüm adayları seç</label><table class="wf-table"><thead><tr><th></th><th>Sayfa</th><th>Kaynak bölge</th><th>Algılanan metin</th><th>Tür / ölçü</th><th>Güven</th></tr></thead><tbody id="wfRows"><tr><td colspan="6">Taramaya hazır.</td></tr></tbody></table></div><div class="wf-foot"><label>Kontrol yöntemi <select id="wfMethod" style="max-width:220px;padding:6px"></select></label><button class="btn primary" id="wfAccept" disabled>Seçilenleri kaydet</button></div></div>`;
    document.body.append(panel);
    panel.querySelector('.wf-head b').textContent='Otomatik ölçü tespiti · R46';
    panel.querySelector('thead th:nth-child(5)').textContent='Tür · yöntem · sıklık';
    const reviewStyle=document.createElement('style');reviewStyle.textContent='.wf-card{width:min(1420px,98vw)}.wf-foot{flex-wrap:wrap;align-items:end}.wf-foot label{display:grid;gap:4px;font-size:11px}.wf-foot input,.wf-foot select,.wf-table select{padding:6px;border:1px solid #d5e1e8;border-radius:6px;max-width:190px}.wf-table select{width:100%;margin-bottom:5px}.wf-table .wf-plan{min-width:175px}.wf-table .wf-preview{border:1px solid #d5e1e8;background:#f7fbfc;border-radius:7px;cursor:zoom-in;padding:6px;color:#08788b}.wf-table{min-width:950px}.wf-note{line-height:1.4}';document.head.append(reviewStyle);
    panel.querySelector('.wf-foot').innerHTML=`<label>Kontrol yöntemi<select id="wfMethod">${app.getMethods().map(m=>`<option value="${esc(m.value)}">${esc(m.label)}</option>`).join('')}</select></label><label>Kontrol sıklığı<select id="wfFrequency">${frequencyOptions('')}</select></label><label id="wfIntervalLabel" hidden>Her N parçada<input id="wfInterval" type="number" min="1" step="1" style="width:90px"></label><label id="wfNoteLabel" hidden>Plan açıklaması<input id="wfFrequencyNote" type="text"></label><button class="btn" id="wfPlanSelected">Seçilenlere uygula</button><button class="btn" id="wfPlanAll">Tüm adaylara uygula</button><button class="btn primary" id="wfAccept" disabled>Seçilenleri kaydet</button>`;
    el('wfFrequency').onchange=()=>{el('wfIntervalLabel').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS'].includes(el('wfFrequency').value);el('wfNoteLabel').hidden=!['EVERY_N_PIECES','EVERY_N_HOURS','CUSTOM'].includes(el('wfFrequency').value);};
    el('wfPlanSelected').onclick=()=>applyPlan(false);el('wfPlanAll').onclick=()=>applyPlan(true);
    const rolesButton=document.createElement('button');rolesButton.type='button';rolesButton.className='btn';rolesButton.textContent='Kalite / Operatör · toplu plan';rolesButton.onclick=()=>openPlanBatch(candidates.filter(c=>c.selected));panel.querySelector('.wf-foot').append(rolesButton);
    const grouping=document.createElement('label');grouping.className='wf-note';grouping.innerHTML='<input id="wfGroupType" type="checkbox" checked> Türe göre grupla';el('wfSelectAll').closest?.('label')?.after(grouping);
    // DOM adapters and older layouts may not provide a parent label.
    if(!el('wfGroupType'))panel.querySelector('.wf-tools').append(grouping);
    el('wfGroupType').onchange=event=>{groupByType=event.target.checked;renderCandidates();};
    reviewStyle.textContent+='.wf-group th{background:#eaf5f8;padding:10px 8px}.wf-group button{border:0;background:transparent;color:#175b70;font-weight:700;cursor:pointer}.wf-group small{font-weight:400;margin-left:8px;color:#597482}';
    el('wfRows').onclick=event=>{const toggle=event.target.closest('[data-group-toggle]');if(toggle?.dataset.groupToggle!==undefined){const type=toggle.dataset.groupToggle;collapsedTypes.has(type)?collapsedTypes.delete(type):collapsedTypes.add(type);renderCandidates();return;}const button=event.target.closest('[data-preview]');if(button)previewCandidate(Number(button.dataset.preview));};
    el('wfConfidence').value='75';el('wfDpi').value='300';
    const meter=document.createElement('div');meter.innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px"><strong id="wfPercent">Hazır</strong><span id="wfElapsed"></span></div><progress id="wfMeter" max="100" value="0" aria-label="Otomatik ölçü tarama ilerlemesi" style="width:100%;height:12px;accent-color:#008b9d"></progress>';
    meter.style.cssText='position:sticky;top:-16px;background:white;z-index:2;padding:8px 0';panel.querySelector('.wf-tools').after(meter);
    el('wfClose').style.color='#17354b';
    const detail = document.createElement('label');
    detail.innerHTML = '<input id="wfDetailed" type="checkbox"> Ayrıntılı tarama · Ek bölgeler (daha yavaş)';
    panel.querySelector('.wf-tools').append(detail);
    const reselect=document.createElement('button');reselect.id='wfReselect';reselect.className='btn';reselect.textContent='Görünüş ekle';reselect.title='PDF önizlemesinde görünüş alanını seçin.';reselect.onclick=()=>{if(!el('wfRun').disabled)return open(true);};panel.querySelector('.wf-tools').append(reselect);
    el('wfClose').onclick = () => { if (el('wfRun').disabled) stopScan(); else panel.classList.remove('open'); };
    el('wfRun').onclick = scan; el('wfStop').onclick = stopScan;
    el('wfSelectAll').onchange = (event) => { candidates.forEach((c) => c.selected = event.target.checked&&!candidateError(c)); renderCandidates(); };
    el('wfRows').onchange = (event) => {
      if(event.target.dataset?.groupSelect!==undefined){const type=event.target.dataset.groupSelect;candidates.filter(c=>c.parsed.type===type).forEach(c=>c.selected=event.target.checked&&!candidateError(c));renderCandidates();return;}
      const row = event.target.closest('[data-index]'); if (!row) return;
      const item = candidates[Number(row.dataset.index)];
      if(!item)return;
      if (event.target.type === 'checkbox') item.selected = event.target.checked;
      else if(event.target.dataset?.field){const key=event.target.dataset.field;
        if(key==='type'){item.forcedType=event.target.value;parseCandidate(item);}
        else if(key==='gdtSubtype'){item.forcedGdtSubtype=event.target.value;parseCandidate(item);}
        else if(['inspectionMethod','inspectionFrequency','frequencyInterval','frequencyNote'].includes(key))item.plan[key]=event.target.value;
      }else { item.text = event.target.value;parseCandidate(item);if(technicalScore(item.text)<35){item.selected=false;app.toast('Yalnızca ölçü içeren adaylar kaydedilebilir.',true);} }
      renderCandidates();
    };
    el('wfAccept').onclick = accept;
    window.addEventListener('asmach:views-changed',()=>{if(!panel?.classList.contains('open'))return;syncScanViews();renderCandidates();});
  }
  function selectViewPreview(){return new Promise(resolve=>{
    const d=document.createElement('dialog');d.id='wfViewPreview';d.setAttribute('aria-label','Görünüş seç · PDF önizleme');
    d.innerHTML=`<header><strong>Görünüş seç · PDF önizleme</strong><button type="button" data-close aria-label="Kapat">×</button></header><nav><label>Sayfa <select data-page></select></label><button type="button" data-zoom="out" title="Ctrl + −">−</button><output data-percent></output><button type="button" data-zoom="in" title="Ctrl + +">+</button><button type="button" data-zoom="fit">Ekrana sığdır · Ctrl+0</button><button type="button" data-zoom="actual">1:1 · Ctrl+1</button></nav><div class="vp-scroll" tabindex="0" aria-label="PDF görünüş alanını sürükleyerek seçin"><div class="vp-sheet"><canvas></canvas><div class="vp-box" hidden></div></div></div><footer><span data-status>Görünüş sınırını sürükleyerek çizin. Ctrl+tekerlek: yakınlaştır · Ctrl+yön: kaydır</span><button type="button" data-close>İptal · Esc</button><button type="button" data-accept disabled>Görünüşü ekle · Enter</button></footer>`;
    const css=document.createElement('style');css.textContent=`#wfViewPreview{position:fixed;inset:0;margin:auto;width:min(1100px,92vw);height:85vh;max-width:96vw;max-height:94vh;min-width:460px;min-height:320px;padding:0;border:1px solid #91a8b9;border-radius:6px;box-shadow:0 16px 60px #132c4f55;resize:both;overflow:hidden;color:#234355;background:#f2f6f9}#wfViewPreview[open]{display:flex;flex-direction:column}#wfViewPreview::backdrop{background:#152e4222}#wfViewPreview header,#wfViewPreview nav,#wfViewPreview footer{display:flex;align-items:center;gap:8px;padding:8px 12px;flex-shrink:0;background:#eef4f7;border-bottom:1px solid #c4d5df}#wfViewPreview header{cursor:move;touch-action:none;justify-content:space-between;font-size:13px}#wfViewPreview nav,#wfViewPreview footer{font-size:11px;flex-wrap:wrap}#wfViewPreview button,#wfViewPreview select{border:1px solid #b7ceda;background:white;color:#234355;border-radius:4px;padding:5px 9px}#wfViewPreview button:disabled{opacity:.45}#wfViewPreview [data-accept]{background:#008b9d;color:white}#wfViewPreview footer span{flex:1}#wfViewPreview .vp-scroll{flex:1;min-height:0;overflow:auto;padding:12px;background:#dce5eb}#wfViewPreview .vp-sheet{position:relative;width:max-content;margin:auto;background:white;touch-action:none;cursor:crosshair}#wfViewPreview canvas{display:block}#wfViewPreview .vp-box{position:absolute;border:2px solid #0096aa;background:#00a8c426;pointer-events:none;box-sizing:border-box}#wfViewPreview output{min-width:42px;text-align:center}`;d.append(css);document.body.append(d);d.showModal();
    const canvas=d.querySelector('canvas'),sheet=d.querySelector('.vp-sheet'),scroll=d.querySelector('.vp-scroll'),rect=d.querySelector('.vp-box'),pageSelect=d.querySelector('[data-page]'),accept=d.querySelector('[data-accept]'),status=d.querySelector('[data-status]');let page=app.state.currentPage||1,zoom=1,box=null,closed=false,sequence=0,task=null;
    const pages=app.state.pdfDoc?.numPages||1;for(let n=1;n<=pages;n++)pageSelect.append(new Option(n+' / '+pages,n));pageSelect.value=page;
    function finish(value){if(closed)return;closed=true;sequence++;task?.cancel?.();d.close();d.remove();resolve(value);}
    function paint(){canvas.style.width=canvas.width*zoom+'px';canvas.style.height=canvas.height*zoom+'px';d.querySelector('[data-percent]').textContent=Math.round(zoom*100)+'%';rect.hidden=!box;if(box){rect.style.left=box.x*100+'%';rect.style.top=box.y*100+'%';rect.style.width=box.w*100+'%';rect.style.height=box.h*100+'%';}accept.disabled=!box||box.w<.005||box.h<.005;}
    function setZoom(z){const x=(scroll.scrollLeft+scroll.clientWidth/2)/zoom,y=(scroll.scrollTop+scroll.clientHeight/2)/zoom;zoom=Math.min(6,Math.max(.1,z));paint();scroll.scrollLeft=x*zoom-scroll.clientWidth/2;scroll.scrollTop=y*zoom-scroll.clientHeight/2;}
    function fit(){setZoom(Math.min((scroll.clientWidth-24)/canvas.width,(scroll.clientHeight-24)/canvas.height));}
    async function load(){const seq=++sequence;box=null;accept.disabled=true;sheet.style.pointerEvents='none';status.textContent='Sayfa hazırlanıyor…';task?.cancel?.();try{const buffer=document.createElement('canvas');if(app.state.pdfDoc){const pdf=await app.state.pdfDoc.getPage(page);if(seq!==sequence)return;const viewport=pdf.getViewport({scale:1.5});buffer.width=Math.ceil(viewport.width);buffer.height=Math.ceil(viewport.height);task=pdf.render({canvasContext:buffer.getContext('2d'),viewport});await task.promise;}else{const source=app.elements.sourceCanvas;buffer.width=source.width;buffer.height=source.height;buffer.getContext('2d').drawImage(source,0,0);}if(closed||seq!==sequence)return;canvas.width=buffer.width;canvas.height=buffer.height;canvas.getContext('2d').drawImage(buffer,0,0);sheet.style.pointerEvents='';fit();status.textContent='Sınırı sürükleyerek çizin · Ctrl+tekerlek / Ctrl+±: zoom · Ctrl+yön: kaydır';}catch(e){if(seq===sequence&&!closed)status.textContent='Sayfa açılamadı: '+e.message;}}
    pageSelect.onchange=()=>{page=Number(pageSelect.value);load();};d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>finish({cancelled:true}));d.oncancel=e=>{e.preventDefault();finish({cancelled:true});};accept.onclick=()=>{if(!accept.disabled)finish({page,box:{...box}});};
    d.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>b.dataset.zoom==='fit'?fit():setZoom(b.dataset.zoom==='actual'?1:zoom*(b.dataset.zoom==='in'?1.2:1/1.2)));
    scroll.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();setZoom(zoom*(e.deltaY<0?1.12:1/1.12));},{passive:false});
    d.addEventListener('keydown',e=>{if(e.ctrlKey&&['+','=','-','0','1','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='0')fit();else if(e.key==='1')setZoom(1);else if(e.key.startsWith('Arrow'))scroll.scrollBy({left:e.key==='ArrowLeft'?-80:e.key==='ArrowRight'?80:0,top:e.key==='ArrowUp'?-80:e.key==='ArrowDown'?80:0});else setZoom(zoom*(e.key==='-'?1/1.2:1.2));}else if(e.key==='Enter'&&e.target.tagName!=='SELECT'){e.preventDefault();accept.click();}},true);
    sheet.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const bounds=sheet.getBoundingClientRect(),point=e=>({x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))}),start=point(e);sheet.setPointerCapture(e.pointerId);box={...start,w:0,h:0};paint();sheet.onpointermove=e=>{const end=point(e);box={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};paint();};sheet.onpointerup=()=>{sheet.onpointermove=null;};sheet.onpointercancel=()=>{sheet.onpointermove=null;box=null;paint();};};
    const header=d.querySelector('header');header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();const b=d.getBoundingClientRect(),x=e.clientX,y=e.clientY;d.style.margin='0';d.style.inset='auto';d.style.left=b.left+'px';d.style.top=b.top+'px';header.setPointerCapture(e.pointerId);header.onpointermove=e=>{d.style.left=Math.max(0,Math.min(innerWidth-d.offsetWidth,b.left+e.clientX-x))+'px';d.style.top=Math.max(0,Math.min(innerHeight-40,b.top+e.clientY-y))+'px';};header.onpointerup=header.onpointercancel=()=>header.onpointermove=null;};load();
  });}
  async function open(newArea=false) {
    if (!app.state.fileData) return app.toast('Önce Yeni Proje oluşturun.', true);
    const key=app.state.pdfDoc||app.state.fileData;if(documentKey!==key){documentKey=key;candidates=[];scanArea=null;savedCount=0;selectedViewIds=null;savedRows.clear();pageAssets.clear();deletedBatch=null;}
    try{await hydrateQueue([...candidates,...addedCandidates()]);}catch(e){return app.toast('Bekleyen adayların çizimi hazırlanamadı: '+e.message,true);}
    const projectDefaults=app.state.metadata?.projectDefaults;
    if(!newArea&&!scanArea&&!candidates.length){const v=app.state.metadata?.viewNumbering?.views?.find(v=>Number(v.page)===Number(app.state.currentPage));if(v)scanArea={...v,box:{...v.box}};}
    if(!candidates.length&&projectDefaults){el('wfDpi').value=projectDefaults.dpi||'300';if(projectDefaults.scope!=='area'){scanArea=null;el('wfScope').innerHTML='<option value="current">Geçerli sayfa</option><option value="all">Tüm sayfalar</option>';el('wfScope').value=projectDefaults.scope||'current';}}
    if(newArea){const chosen=await selectViewPreview();if(!chosen||key!==(app.state.pdfDoc||app.state.fileData))return;if(chosen.cancelled){renderCandidates();panel.classList.add('open');el('wfReselect').focus();return;}scanArea=chosen;el('wfScope').innerHTML=`<option value="current">Seçilen alan · Sayfa ${scanArea.page}</option>`;}
    renderCandidates();
    el('wfProgress').textContent = scanArea?'Yalnızca seçtiğiniz alan taranacak. Sınırın dışındaki antet ve ölçüler işleme alınmaz. Kutular ve yazı yönü otomatik düzenlenir.':'Yalnızca ölçüler taranır. Sonuçları kaydetmeden önce kontrol edin.';
    if(candidates.length)el('wfProgress').textContent=`${candidates.length} bekleyen aday korundu. Yeni alan taramaları bu listeye eklenir. Liste, bu belge açık kaldığı sürece korunur.`;
    for(const c of candidates)if(c.scanRegion)c.scanRegion=window.ASMachViewNumbering?.registerScanArea(app,c.scanRegion)||c.scanRegion;
    if(scanArea){scanArea=window.ASMachViewNumbering?.registerScanArea(app,scanArea)||scanArea;if(newArea&&selectedViewIds)selectedViewIds.add(scanArea.id);}
    syncScanViews();renderCandidates();
    el('wfPercent').textContent='Hazır';el('wfMeter').value=0;el('wfElapsed').textContent='';
    panel.classList.add('open');
  }
  function syncScanViews(){const views=window.ASMachViewNumbering?.ensureViews(app)||app.state.metadata?.viewNumbering?.views||[],scope=el('wfScope'),old=scope.value;const activeId=scanArea&&(scanArea.id||window.ASMachViewNumbering.regionId(scanArea)),active=activeId&&views.find(v=>(v.id||window.ASMachViewNumbering.regionId(v))===activeId);if(active)scanArea={...active,box:{...active.box}};else if(activeId)scanArea=null;for(const c of [...candidates,...addedCandidates()]){const id=c.scanRegion?.id;if(!id)continue;const live=views.find(v=>v.id===id);if(live)c.scanRegion={...live,box:{...live.box}};else delete c.scanRegion;}scope.innerHTML='<option value="current">Geçerli sayfa</option><option value="all">Tüm sayfalar</option>'+views.map((v,i)=>`<option value="view:${i}">${esc(v.name)} · Sayfa ${v.page}</option>`).join('');const i=scanArea?views.findIndex(v=>(v.id||window.ASMachViewNumbering.regionId(v))===(scanArea.id||window.ASMachViewNumbering.regionId(scanArea))):-1;scope.value=i>=0?'view:'+i:old==='all'?'all':'current';scope.onchange=()=>{if(scope.value.startsWith('view:')){const v=views[Number(scope.value.slice(5))];scanArea={...v,box:{...v.box}};}else scanArea=null;};}
  function frequencyOptions(value){return (window.ASMachInspectionPlan?.FREQUENCIES||[{value:'',label:'Belirtilmedi'}]).map(f=>`<option value="${esc(f.value)}" ${f.value===value?'selected':''}>${esc(f.label)}</option>`).join('');}
  function defaultPlan(){return{inspectionMethod:el('wfMethod').value||app.getMethods()[0]?.value||'',inspectionFrequency:el('wfFrequency').value,frequencyInterval:el('wfInterval').value,frequencyNote:el('wfFrequencyNote').value};}
  function applyPlan(all){if(candidates.some(c=>(all||c.selected)&&c.plan.rolePlans))return openPlanBatch(candidates.filter(c=>all||c.selected));const plan=defaultPlan(),error=window.ASMachInspectionPlan?.validate(plan);if(error)return app.toast(error,true);let count=0;candidates.forEach(c=>{if(all||c.selected){c.plan={...c.plan,...plan};count++;}});renderCandidates();app.toast(`${count} adayın kontrol planı güncellendi.`);}
  function parseCandidate(c){
    delete c.reviewed;
    let parsed=c.forcedType&&app.parseTechnicalRequirement?app.parseTechnicalRequirement(c.text,app.state.generalTolerance?.standard||'',c.forcedType):app.parseRequirement(c.text);if(c.forcedType){parsed.type=c.forcedType;const profile=window.ASMachRequirements.fieldProfile(parsed.type);
      if(!profile.numeric)Object.assign(parsed,{nominalValue:'',lowerTolerance:'',upperTolerance:'',lowerLimit:'',upperLimit:'',unit:'',evaluationMethod:'OK_NOT_OK'});
      else parsed.unit=parsed.type==='Açı'?'°':'mm';
      if(parsed.type!=='GD&T')Object.assign(parsed,{gdtFrame:null,gdtSubtype:'',datumRefs:''});
      else {parsed.nominalValue='';parsed=window.ASMachRequirements.withGdtSubtype(parsed,c.forcedGdtSubtype||parsed.gdtSubtype||'unknown');}
    }if(parsed.type==='GD&T'&&c.forcedGdtSubtype!==undefined)parsed=window.ASMachRequirements.withGdtSubtype(parsed,c.forcedGdtSubtype);c.parsed=parsed;delete c.saveIssue;
  }
  function makeItem(c,number){
    const record=c.reviewed?window.ASMachRequirements.syncRequirement({...c.reviewed}):window.ASMachRequirements.syncRequirement({...c.parsed,requirement:c.text,requirementMode:'auto',ocrText:c.text},true);
    const item=app.normalizeAnnotation({...record,...c.plan,candidateReviewStatus:c.reviewStatus||'',originalOcrText:c.originalText||c.text,manualFields:[...(record.manualFields||[]),...(c.forcedType?['type']:[]),...(c.forcedGdtSubtype!==undefined?['gdtSubtype']:[])],number,page:c.page,sheetNo:c.page,snapshot:c.snapshot,selectionBox:c.box,sourceTextHeight:c.sourceTextHeight,anchorX:c.box.x+c.box.w/2,anchorY:c.box.y+c.box.h/2,bubbleX:clamp(c.box.x+c.box.w+.03,.03,.97),bubbleY:clamp(c.box.y-.03,.03,.97),status:'needs_review',detectionConfidence:c.confidence,recognitionSource:c.source});
    if(c.reviewed){item.boxDirection=c.reviewed.boxDirection;item.boxGap=c.reviewed.boxGap;if(c.reviewed.reviewBalloonPosition)item.reviewBalloonPosition={...c.reviewed.reviewBalloonPosition};}
    app.applyMethodStyle(item,c.plan.inspectionMethod);if(!c.reviewed)window.ASMachBalloonPlacement.applyNewDefaults(item);if(!c.reviewed)window.ASMachBalloonPlacement.autoStyle(item,c.pageImage?.width||app.elements.sourceCanvas.width,c.pageImage?.height||app.elements.sourceCanvas.height);else {if(c.reviewed.size)item.size=c.reviewed.size;if(c.reviewed.fontSize)item.fontSize=c.reviewed.fontSize;}return item;
  }
  function sourceCorrection(c){
    const key=app.state.pdfDoc||app.state.fileData;
    const current=()=>candidates.includes(c)&&(app.state.pdfDoc||app.state.fileData)===key&&!el('wfRun').disabled;
    return {
      parse:text=>app.parseRequirement(text),
      async recognize(edit){if(!current())throw new Error('Aday listesi değişti.');const result=await window.ASMachCandidateCorrection.recognize(app,c,edit);if(!current())throw new Error('Belge veya tarama değişti.');return result;},
      apply(edit){
        if(!current())throw new Error('Aday listesi değişti.');
        const b=edit.box;
        if(!b||![b.x,b.y,b.w,b.h].every(Number.isFinite)||b.x<0||b.y<0||b.w<=0||b.h<=0||b.x+b.w>1.000001||b.y+b.h>1.000001)throw new Error('Geçerli bir kutu seçin.');
        if(technicalScore(edit.text)<35)throw new Error('Geçerli bir ölçü metni girin veya yeniden tanıyın.');
        const next={...c,box:{...b},snapshot:edit.snapshot,text:edit.text,confidence:edit.confidence,source:edit.source,sourceTextHeight:edit.sourceTextHeight??c.sourceTextHeight,plan:{...c.plan}};
        delete next.forcedType;delete next.forcedGdtSubtype;parseCandidate(next);
        const error=candidateError(next);if(error)throw new Error(error);
        delete next.saveIssue;
        Object.assign(c,next,{geometryNote:'Kaynak görüntüde kutu ve ölçü düzeltildi'});delete c.reviewed;delete c.saveIssue;delete c.forcedType;delete c.forcedGdtSubtype;
        window.ASMachSharedCandidateInspector?.invalidate(c);
        renderCandidates();app.toast('Aday güncellendi. Kontrol planı ve diğer adaylar korundu.');
      }
    };
  }
  function previewCandidate(index){
    window.ASMachCandidateDashboard?.select(index);
  }

  function candidateGroupsByType(list){
    const groups=new Map();list.forEach((c,index)=>{const type=c.parsed.type||'Diğer';if(!groups.has(type))groups.set(type,[]);groups.get(type).push(index);});
    return [...groups].sort((a,b)=>a[0].localeCompare(b[0],'tr')).map(([type,indices])=>({type,indices}));
  }
  const numeric = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const units = '(?:mm|in(?:ch)?|["°′″])';
  const datumSymbols = 'ⓂⓁⓈⓅⒻ';
  const normalized = (text) => window.ASMachRequirements?.normalize(text) || String(text || '').trim();
  const parseRequirement = (text) => app?.parseRequirement(text) || window.ASMachRequirements?.parse(text) || {};

  // Parsing a useful prefix is sufficient in an editable selection, but automatic
  // detection must account for the whole candidate or it can swallow the next dimension.
  function completeRequirement(text, parsed) {
    let value = normalized(text);
    value = value.replace(/^\d+\s*[x×]\s*(?=(?:Ø|R|M|C)\s*\d)/i, '');
    if (['Not','Malzeme','Proses','Datum','Görsel','Diğer'].includes(parsed.type)) return false;
    if (parsed.type === 'GD&T') {
      if (parsed.gdtFrame?.tolerance === '' || !parsed.gdtFrame) return false;
      const symbol = parsed.gdtFrame.symbol;
      const explicit = value.replace(/^[^⌖⏥⏤―⟂∥○⌭⌓⌒⌰↗⌯◎∠]*?(?=[⌖⏥⏤―⟂∥○⌭⌓⌒⌰↗⌯◎∠])/, '');
      // Preserve the OCR ± notation for review; the requirements engine supplies
      // the zone magnitude and warning, rather than treating it as size deviations.
      const frame = new RegExp(`^[⌖⏥⏤―⟂∥○⌭⌓⌒⌰↗⌯◎∠]\\s*[|:]?\\s*Ø?\\s*(?:±\\s*)?${numeric}[${datumSymbols}]*(?:[|\\s]*[A-Z](?:-[A-Z])?[${datumSymbols}]*){0,3}(?:\\s*mm)?$`, 'i');
      if (frame.test(explicit)) return true;
      // Keyword-based GD&T still has to end after its tolerance and datum cells.
      const keyword = value.replace(/^(?:TRUE\s+POSITION|SURFACE\s+PROFILE|TOTAL\s+RUNOUT|POSITION|POS|FLATNESS|STRAIGHTNESS|PERPENDICULAR(?:ITY)?|PERP|PARALLEL(?:ISM)?|CIRCULARITY|ROUNDNESS|CYLINDRICITY|PROFILE|RUNOUT|SYMMETRY|CONCENTRIC(?:ITY)?|ANGULARITY|KONUM|DÜZLEMSELLİK|DOĞRUSALLIK|DİKLİK|PARALELLİK|YUVARLAKLIK|SİLİNDİRİKLİK|YÜZEY\s+PROFİLİ|PROFİL|TOPLAM\s+SALGI|SALGI|SİMETRİ|EŞMERKEZLİLİK|AÇISALLIK)\b/i, symbol);
      return keyword !== value && frame.test(keyword);
    }
    const fits = new RegExp(`^(?:Ø\\s*)?${numeric}\\s*[A-WYZa-wyz]{1,2}\\d{1,2}(?:\\s*\\/\\s*[A-WYZa-wyz]{1,2}\\d{1,2})?$`);
    if (parsed.type === 'Geçme' || parsed.fitClass) return fits.test(value);
    if (parsed.type === 'Diş' && /^(NPTF|NPTR|NPSC|NPSM|NPSL|NPT)$/.test(parsed.threadClass || '')) return !parsed.toleranceAmbiguous && Number(parsed.nominalValue)>0 && /^\d+(?:\.\d+)? TPI$/.test(parsed.threadPitch || '');
    if (parsed.type === 'Diş') return new RegExp(`^(?:M\\s*${numeric}(?:\\s*[x×]\\s*${numeric})?(?:\\s*-?\\s*\\d+[HhGg])?|(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|${numeric})\\s*-\\s*\\d+\\s*(?:UNC|UNF|UNEF)(?:\\s*-?\\s*[123][AB])?)$`, 'i').test(value);
    if (parsed.type === 'Pah') return new RegExp(`^(?:(?:PAH\\s*:?\\s*)?${numeric}(?:\\s*±\\s*${numeric})?\\s*[x×]\\s*${numeric}\\s*(?:°|DEG|DERECE)(?:\\s*±\\s*${numeric}\\s*(?:°|DEG|DERECE)?)?|(?:C|PAH\\s*:?\\s*)${numeric})$`, 'i').test(value);
    if (parsed.type === 'Yüzey') return new RegExp(`^R\\s*[AZQ]\\s*(?:(?:<=|≤|<|MAX)\\s*)?${numeric}(?:\\s*(?:MAX|µm|um))?$`, 'i').test(value);
    if (parsed.type === 'Açı') {const angle=window.ASMachRequirements.parseAngularCallout(text);return Boolean(angle&&!angle.error);}
    const nominal = `(?:Ø|R|DIA(?:METER)?|ÇAP)?\\s*${numeric}`;
    const pair = `\\(?\\s*(?:[+-]${numeric}|0(?:\\.0+)?)\\s*(?:[/;]\\s*|\\s+|(?=[+-]))(?:[+-]${numeric}|0(?:\\.0+)?)\\s*\\)?`;
    const tolerance = `(?:±\\s*${numeric}|${pair}|[+-]${numeric})`;
    const dimensional = new RegExp(`^${nominal}(?:\\s*${units})?(?:\\s*${tolerance})?(?:\\s*${units})?$`, 'i');
    if (dimensional.test(value)) return true;
    const limited = new RegExp(`^(?:${nominal}\\s*(?:MAX|MIN)|(?:MAX|MIN|<=|>=|≤|≥|<|>)\\s*:?\\s*${nominal}|${nominal}\\s*(?:\\/|\\.\\.|…|TO|İLE)\\s*${numeric})(?:\\s*${units})?$`, 'i');
    if (limited.test(value)) return true;
    return /\b(?:MIN|MAX|ALT|ÜST|LIMITS?|SINIR)\b/i.test(value) && (value.match(new RegExp(numeric, 'g')) || []).length === 2 && parsed.toleranceExplicit;
  }

  function technicalScore(text) {
    if (!text || text.length > 160) return 0;
    const p = parseRequirement(text);
    if(p.type==='Yüzey'&&/\d/.test(text))return p.nominalValue!==''||p.lowerLimit!==''||p.upperLimit!==''?85:45;
    if (!completeRequirement(text, p)) return 0;
    if (['Not','Malzeme','Proses','Datum'].includes(p.type)) return 40;
    if (p.type === 'GD&T') return 110 + (p.gdtFrame?.datums.length || 0) * 4;
    let score = 35;
    if (['Çap','Yarıçap','Diş','Pah','Geçme','Yüzey','Açı'].includes(p.type)) score += 25;
    if (p.toleranceExplicit) score += 45;
    if (p.toleranceExplicit && (/[+-]\s*\d[\s\S]*[+-]\s*\d/.test(normalized(text)) || (/[+/;-]/.test(text) && (text.match(new RegExp(numeric,'g')) || []).length===3))) score += 8;
    return score;
  }
  function overlap(a,b) {
    const w = Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    const h = Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    return w*h/Math.max(.0000001,Math.min(a.w*a.h,b.w*b.h));
  }
  function readingBox(word) {
    const angle = ((Math.round(Number(word.angle || 0) / 90) * 90) % 360 + 360) % 360;
    if (angle === 90) return { x: 1-word.y-word.h, y: word.x, w: word.h, h: word.w, angle };
    if (angle === 180) return { x: 1-word.x-word.w, y: 1-word.y-word.h, w: word.w, h: word.h, angle };
    if (angle === 270) return { x: word.y, y: 1-word.x-word.w, w: word.h, h: word.w, angle };
    return { x: word.x, y: word.y, w: word.w, h: word.h, angle };
  }
  function unionWords(words, text) {
    const x = Math.min(...words.map(w => w.x)), y = Math.min(...words.map(w => w.y));
    const first=words[0],nominalBox=first.nominalBox||{x:first.x,y:first.y,w:first.w,h:first.h,angle:first.angle??first.readingAngle??0,text:first.text};
    return { ...first, text: text || words.map(w => w.text).join(' '), nominalBox, x, y,
      w: Math.max(...words.map(w => w.x+w.w))-x, h: Math.max(...words.map(w => w.y+w.h))-y,
      confidence: Math.min(...words.map(w => Number(w.confidence ?? 100))) };
  }
  function canContinue(text, nextText) {
    const parsed = parseRequirement(text);
    if (!completeRequirement(text, parsed)) return true;
    if (parsed.type === 'GD&T') return /^[|\s]*[A-Z](?:-[A-Z])?[ⓂⓁⓈⓅⒻ]*\s*$/i.test(nextText);
    // A new unsigned nominal or dimension symbol starts a separate characteristic.
    return /^(?:±|[+\-/;)]|[x×]|°|mm\b|in\b|MAX\b|MIN\b|[A-WYZa-wyz]{1,2}\d{1,2}\b|0(?:\.0+)?$)/i.test(nextText.trim());
  }
  function candidateGroups(words, lines = []) {
    words=words.map(w=>({...w,text:String(w.text||'').replace(/[º˚]/g,'°')}));
    const consumed=new Set();for(const w of words){if(!/^\d+(?:[.,]\d+)?$/.test(w.text))continue;const a=readingBox(w),mark=words.find(m=>{if(consumed.has(m)||m.text.trim()!=='°')return false;const b=readingBox(m);return a.angle===b.angle&&b.x>=a.x+a.w*.8&&b.x-a.x-a.w<Math.max(.003,a.h*.65)&&b.y>=a.y-a.h*.5&&b.y+b.h<=a.y+a.h*.85;});if(mark){Object.assign(w,unionWords([w,mark],w.text+'°'));consumed.add(mark);}}words=words.filter(w=>!consumed.has(w));
    const all = words.filter((w) => w.text?.trim() && w.w > 0 && w.h > 0).map(w => ({ ...w, text: normalized(w.text) }));
    const groups = [...all, ...lines.filter(line => line.text?.trim() && line.w > 0 && line.h > 0)];
    const boxes=new Map(all.map(word=>[word,readingBox(word)])),buckets=new Map(),cell=.025;
    all.forEach(word=>{const b=boxes.get(word),key=`${b.angle}:${Math.floor(b.x/cell)}:${Math.floor((b.y+b.h/2)/cell)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(word);});
    function nearby(origin,prior,reach=1.6){const result=[],y=origin.y+origin.h/2;
      for(let ix=Math.floor((prior.x+prior.w*.45)/cell);ix<=Math.floor((prior.x+prior.w+Math.max(.012,origin.h*reach))/cell);ix++)for(let iy=Math.floor((y-origin.h*1.6)/cell);iy<=Math.floor((y+origin.h*1.6)/cell);iy++)result.push(...(buckets.get(`${origin.angle}:${ix}:${iy}`)||[]));return result;
    }
    for (const first of all) {
      if (/^(?:±|[+-]\s*(?:\d|\.))/.test(first.text)) continue;
      const used = [first];
      let current = first;
      for (let step=0; step<7; step++) {
        const prior = boxes.get(current), origin = boxes.get(first);
        const next = nearby(origin,prior).filter(word => !used.includes(word)).map(word => ({word, box:boxes.get(word)}))
          .filter(({word,box}) => box.angle===origin.angle && box.x >= prior.x+prior.w*.45 && box.x-prior.x-prior.w < Math.max(.012,origin.h*1.6)
            && Math.abs(box.y+box.h/2-origin.y-origin.h/2) <= Math.max(origin.h,box.h)*.55
            && (!word.lineId || !current.lineId || word.lineId===current.lineId))
          .sort((a,b) => a.box.x-b.box.x || (b.word.confidence??0)-(a.word.confidence??0))[0]?.word;
        if (!next || !canContinue(used.map(word=>word.text).join(' '),next.text)) break;
        used.push(next); current=next;
        groups.push(unionWords(used));
      }
      // Superscript/subscript deviations are separate lines. Both signed values
      // must occupy one nearby column, so adjacent unsigned dimensions cannot join.
      const origin = boxes.get(first);
      if (new RegExp(`^(?:Ø|R)?\\s*${numeric}(?:°)?$`, 'i').test(first.text)) {
        const deviations = nearby(origin,origin,3.5).filter(word => word!==first && new RegExp(`^(?:[+-]${numeric}|0(?:\\.0+)?)$`).test(word.text))
          .map(word => ({word,box:readingBox(word)}))
          .filter(({box}) => box.angle===origin.angle && box.x >= origin.x+origin.w*.45 && box.x-origin.x-origin.w < Math.max(.012,origin.h*3.5) && box.h<=origin.h*1.05
            && Math.abs(box.y+box.h/2-origin.y-origin.h/2) < origin.h*1.3)
          .sort((a,b) => a.box.y-b.box.y);
        if (deviations.length===2 && deviations.some(entry=>/^[+-]/.test(entry.word.text))) {
          const [a,b]=deviations.map(entry=>entry.box);
          const aligned=Math.min(Math.abs(a.x-b.x),Math.abs(a.x+a.w-b.x-b.w),Math.abs(a.x+a.w/2-b.x-b.w/2))<origin.h*.65;
          const near=Math.min(a.x,b.x)-origin.x-origin.w<Math.max(.012,origin.h*1.5);
          const stacked=Math.abs(a.y+a.h/2-b.y-b.h/2)>Math.min(a.h,b.h)*.5;
          if(aligned&&near&&stacked)groups.push({...unionWords([first,...deviations.map(entry=>entry.word)], `${first.text} ${deviations[0].word.text} / ${deviations[1].word.text}`),retainBounds:true});
        }
      }
    }
    return groups;
  }
  function rankCandidates(sources, minConfidence = 0) {
    const diameters=sources.filter(w=>w.visualDiameter).map(w=>({word:w,nominal:parseRequirement(w.text).nominalValue}));
    return sources.map(w=>{
      const parsed=parseRequirement(w.text);
      // A confirmed prefix on the nominal also belongs to its full tolerance group.
      // Otherwise the short symbol-confirmed candidate suppresses the complete one.
      if(parsed.toleranceExplicit&&['Çap','Uzunluk'].includes(parsed.type)){
        const proof=diameters.find(d=>d.nominal===parsed.nominalValue&&overlap(d.word,w)>.85);
        if(proof){const merged=unionWords([w,proof.word],parsed.type==='Çap'?w.text:'Ø'+w.text);w={...merged,visualDiameter:true,retainBounds:true,readingAngle:proof.word.readingAngle};}
      }
      return{...w,score:technicalScore(w.text)};
    })
      .filter(w=>w.visualGdt || w.score>=35 && (w.confidence??0)>=minConfidence)
      .sort((a,b)=>Number(Boolean(b.visualGdt))-Number(Boolean(a.visualGdt)) || Number(Boolean(b.visualSurface))-Number(Boolean(a.visualSurface)) || Number(Boolean(b.visualDiameter))-Number(Boolean(a.visualDiameter)) || b.score-a.score || (b.confidence??0)-(a.confidence??0) || a.text.length-b.text.length);
  }
  async function pageSources(pdfWords, snapshot, progress, options={}) {
    const sources = candidateGroups(pdfWords).map(w=>({...w,source:'PDF metin katmanı'}));
    // Title-only / hybrid PDFs still need OCR. Distributed dimensional text can use the fast path.
    if(!options.detailed&&window.ASMachDimensionFilter?.searchable(sources,technicalScore))return{sources,warning:'',evidenceWords:pdfWords,evidenceLines:[],textOnly:true};
    ocrActive=true;let recognized;
    try{recognized=await window.ASMachOCR.detect(snapshot,{angles:[0,90,270],detailed:false,recoverTolerance:true,onProgress:progress,shouldCancel:()=>cancelled});}finally{ocrActive=false;}
    if(cancelled)return{sources,warning:'',evidenceWords:[],evidenceLines:[]};
    if (recognized.error && !sources.some(w=>technicalScore(w.text)>=35)) throw new Error(recognized.error);
    if (!recognized.error) sources.push(...candidateGroups(recognized.words || [],recognized.lines || []).map(w=>({...w,source:'Yerel OCR'})));
    return {sources, warning: recognized.error || '',evidenceWords:recognized.evidenceWords||recognized.words||[],evidenceLines:recognized.evidenceLines||recognized.lines||[]};
  }
  async function scan() {
    if(el('wfRun').disabled)return;
    const sharedViews=app.state.metadata?.viewNumbering?.views||[],selectedViews=sharedViews.filter(v=>selectedViewIds===null||selectedViewIds.has(v.id||window.ASMachViewNumbering.regionId(v)));
    if(window.ASMachCandidateDashboard&&!selectedViews.length)return app.toast('Soldan en az bir görünüş seçin. Görünüş yoksa önce Görünüş ekle düğmesini kullanın.',true);
    const {state} = app; cancelled=false; renderCandidates();
    el('wfSelectAll').checked=true;
    el('wfRun').disabled=true; el('wfStop').disabled=false; el('wfAccept').disabled=true;
    const fallbackPages=scanArea?[scanArea.page]:el('wfScope').value==='all'?Array.from({length:state.pageCount},(_,i)=>i+1):[state.currentPage];
    const jobs=selectedViews.length?selectedViews.map(v=>({page:Number(v.page),box:{...v.box},name:v.name})):fallbackPages.map(page=>({page,box:scanArea?.box||{x:0,y:0,w:1,h:1}})),pages=jobs.map(j=>j.page),geometry=window.ASMachAutomaticGeometry;
    const minConfidence=clamp(Number(el('wfConfidence').value)||0,0,100), dpi=Number(el('wfDpi').value)||360;
    const scanWarnings = [],detailed=el('wfDetailed').checked,started=Date.now();let percent=0,rejected=0;
    const tick=()=>{el('wfElapsed').textContent=`${Math.round((Date.now()-started)/1000)} sn · ${candidates.length} ölçü`;};
    const timer=setInterval(tick,1000);tick();el('wfMeter').value=0;
    const settings=['wfScope','wfDpi','wfConfidence','wfDetailed','wfReselect','wfPlanSelected'];
    function update(index,fraction,message){percent=Math.max(percent,Math.min(99,(index+fraction)/pages.length*100));el('wfMeter').value=percent;el('wfPercent').textContent=`%${Math.floor(percent)} · Görünüş ${index+1}/${jobs.length}`;el('wfProgress').textContent=(jobs[index].name?jobs[index].name+' · ':'')+message;tick();}
    try {
      settings.forEach(id=>{const control=el(id);if(control)control.disabled=true;});
      el('wfPercent').textContent='Tarama hazırlanıyor…';
      for (let pageIndex=0;pageIndex<pages.length;pageIndex++) {
        const pageNumber=pages[pageIndex],region=jobs[pageIndex].box;
        if (cancelled) break;
        const progress=message=>update(pageIndex,.12+(detailed?.38:.68)*(typeof message==='object'?message.progress||0:0),`Sayfa ${pageNumber} · ${typeof message==='string'?message:message.detail||message.status||'Taranıyor'}`);
        let pdfWords=[],pageWords=[];
        update(pageIndex,.01,'PDF metni ve ölçü yapıları okunuyor…');await yieldUI();
        if(state.pdfDoc) {
          const page=await state.pdfDoc.getPage(pageNumber), viewport=page.getViewport({scale:1.5});
          const content=await page.getTextContent();
          pageWords=content.items.map((item)=>app.mapPdfTextBox(item,viewport)).filter(Boolean).map((w)=>({...w,readingAngle:(w.angle||0)*180/Math.PI,angle:((360-Math.round((w.angle||0)*180/Math.PI/90)*90)%360+360)%360,confidence:100}));
          pdfWords=geometry?pageWords.filter(w=>geometry.inside(w,region)).map(w=>geometry.toLocal(w,region)):pageWords;
        }
        if(cancelled)break;update(pageIndex,.07,'Görüntü hazırlanıyor…');
        const snapshot=await window.ASMachOCR.capture({pdfDoc:state.pdfDoc,page:pageNumber,canvas:app.elements.sourceCanvas,box:region,dpi:detailed?Math.max(dpi,450):dpi,padding:0});
        const image=await app.loadImage(snapshot);
        const pageImage=document.createElement('canvas');pageImage.width=app.elements.sourceCanvas.width;pageImage.height=app.elements.sourceCanvas.height;
        // Keep one shared page raster per batch, not a separate wide bitmap for every row.
        if(pageNumber===state.currentPage)pageImage.getContext('2d').drawImage(app.elements.sourceCanvas,0,0);
        else if(state.pdfDoc){const pdfPage=await state.pdfDoc.getPage(pageNumber),viewport=pdfPage.getViewport({scale:1.5});pageImage.width=viewport.width;pageImage.height=viewport.height;await pdfPage.render({canvasContext:pageImage.getContext('2d'),viewport}).promise;}
        const ink=window.ASMachBalloonPlacement?.inkSampler(pageImage);
        const scanRegion=window.ASMachViewNumbering?.registerScanArea(app,{page:pageNumber,box:region})||{page:pageNumber,box:{...region},id:pageNumber+':'+[region.x,region.y,region.w,region.h].map(n=>Number(n).toFixed(5)).join(':')};
        if(cancelled)break;
        const {sources,warning,evidenceWords=[],evidenceLines=[],textOnly}=await pageSources(pdfWords,snapshot,progress,{detailed});
        if(warning)scanWarnings.push(`Sayfa ${pageNumber}: yalnızca PDF metni okundu (${warning}).`);
        if(cancelled)break;
        if(!warning && detailed) {
          for(let tile=0;tile<4&&!cancelled;tile++) {
            const region={x:(tile%2)*.46,y:Math.floor(tile/2)*.46,w:.54,h:.54};
            update(pageIndex,.5+tile*.075,`Ek bölge ${tile+1}/4`);await yieldUI();
            // Reuse the page raster; do not render the entire PDF again for every tile.
            const crop=document.createElement('canvas');crop.width=Math.ceil(image.width*region.w);crop.height=Math.ceil(image.height*region.h);crop.getContext('2d').drawImage(image,region.x*image.width,region.y*image.height,crop.width,crop.height,0,0,crop.width,crop.height);
            let result;ocrActive=true;try{result=await window.ASMachOCR.detect(crop,{angles:[0,90,270],detailed:false,shouldCancel:()=>cancelled,onProgress:m=>update(pageIndex,.5+(tile+(m.progress||0))*.075,`Bölge ${tile+1}/4 · ${m.detail||m.status}`)});}finally{ocrActive=false;}
            if(cancelled)break;
            if(result.error){scanWarnings.push(`Sayfa ${pageNumber}, bölge ${tile+1}: ${result.error}`);break;}
            const map=w=>({...w,x:region.x+w.x*region.w,y:region.y+w.y*region.h,w:w.w*region.w,h:w.h*region.h});
            sources.push(...candidateGroups((result.words||[]).map(map),(result.lines||[]).map(map)).map(w=>({...w,source:'Yerel OCR · bölgesel'})));
            evidenceWords.push(...(result.evidenceWords||result.words||[]).map(map));evidenceLines.push(...(result.evidenceLines||result.lines||[]).map(map));
          }
        }
        if(!cancelled&&window.ASMachAutomaticSymbols){
          const recovered=await window.ASMachAutomaticSymbols.enrich(image,sources.filter(w=>technicalScore(w.text)>=35),{
            shouldCancel:()=>cancelled,onProgress:message=>update(pageIndex,.8,message),
            read:async(cell,options)=>{if(cancelled)return{text:'',error:'Durduruldu'};ocrActive=true;try{return await window.ASMachOCR.recognize(cell,options);}finally{ocrActive=false;}}
          });sources.push(...recovered);
        }
        if(cancelled)break;update(pageIndex,.81,'Ölçüler ve grafik semboller doğrulanıyor');await yieldUI();
        state.zoneMaps ||= {};
        const grid=window.ASMachZones?.infer([...pageWords,...evidenceWords.map(w=>geometry?geometry.toPage(w,region):w)]);
        if(grid?.horizontal||grid?.vertical)state.zoneMaps[pageNumber]=grid;
        const ranked=rankCandidates(sources,minConfidence).filter(w=>(!geometry||geometry.inside(w,{x:0,y:0,w:1,h:1}))&&!window.ASMachZones?.isLabel(grid,geometry?geometry.toPage(w,region):w));
        const filter=window.ASMachDimensionFilter,context=filter?.context(pdfWords,evidenceWords,evidenceLines,image);
        if(context)context.selectedArea=Boolean(scanArea);
        for(let sourceIndex=0;sourceIndex<ranked.length;sourceIndex++) {
          if(cancelled)break;const source=ranked[sourceIndex];
          if(sourceIndex%30===0){update(pageIndex,.82+.17*sourceIndex/Math.max(1,ranked.length),`Ölçü doğrulama ${sourceIndex}/${ranked.length} · ${rejected} ilgisiz aday elendi`);renderCandidates();await yieldUI();}
          if(candidates.length>=2000) break;
          if(filter?.rejectReason(source,context)){rejected++;continue;}
          const box=geometry?geometry.toPage({x:source.x,y:source.y,w:source.w,h:source.h},region):{x:source.x,y:source.y,w:source.w,h:source.h};
          if(candidates.some((c)=>c.page===pageNumber && overlap(c.box,box)>.6)) continue;
          if(state.annotations.some((c)=>c.page===pageNumber && c.selectionBox && overlap(c.selectionBox,box)>.6)) continue;
          const refined=source.visualGdt?{box:{...box,points:source.points.map(p=>({x:region.x+p.x*region.w,y:region.y+p.y*region.h})),rotation:source.readingAngle},snapshot:source.snapshot,note:'GD&T çerçevesi ve hücreler doğrulandı'}:geometry?.refine(image,source,region);
          let snapshot=refined?.snapshot;
          if(!snapshot){const cropped=document.createElement('canvas');cropped.width=Math.max(2,Math.ceil(source.w*image.width));cropped.height=Math.max(2,Math.ceil(source.h*image.height));cropped.getContext('2d').drawImage(image,source.x*image.width,source.y*image.height,cropped.width,cropped.height,0,0,cropped.width,cropped.height);snapshot=cropped.toDataURL('image/png');}
          const parsed=app.parseRequirement(source.text);if(state.metadata?.projectDefaults?.types&&!state.metadata.projectDefaults.types.includes(parsed.type))continue;
          const nominalSource=source.nominalBox||source,nominalHeight=window.ASMachBalloonPlacement?.nominalTextHeight(nominalSource,parsed.nominalValue,region.w*pageImage.width,region.h*pageImage.height);
          const glyphHeight=source.visualGdt&&Number.isFinite(source.sourceTextHeight)?source.sourceTextHeight:Number.isFinite(refined?.sourceTextHeightRatio)?refined.sourceTextHeightRatio*pageImage.width:null;
          const sourceTextHeight=window.ASMachBalloonPlacement.verifiedTextHeight(nominalHeight,glyphHeight);
          candidates.push({selected:!source.visualSurface&&source.confidence>=minConfidence&&technicalScore(source.text)>=35,page:pageNumber,box:refined?.box||box,sourceTextHeight,scanRegion,geometryNote:(source.visualDiameter?'Çap simgesi ve sınırlar doğrulandı':refined?.note)||'',text:source.text,parsed,confidence:source.confidence,source:source.source,snapshot,plan:defaultPlan(),pageImage,ink});
        }
        candidates.sort((a,b)=>a.page-b.page || a.box.y-b.box.y || a.box.x-b.box.x);renderCandidates();
      }
      app.renderAll();
      if(!cancelled){el('wfMeter').value=100;el('wfPercent').textContent='%100 · Tamamlandı';}else el('wfPercent').textContent=`%${Math.floor(percent)} · Durduruldu`;
      el('wfProgress').textContent=`${cancelled?'Tarama durduruldu. ':''}${candidates.length} ölçü adayı bulundu. ${rejected} ilgisiz / belirsiz aday elendi. Sonuçları kontrol edin; eksik ölçüleri kutu seçimiyle ekleyebilirsiniz. ${scanWarnings.join(' ')}`;
    } catch(error) { el('wfProgress').textContent=cancelled?'Tarama durduruldu.':error.message;el('wfPercent').textContent=cancelled?'Durduruldu':'Tarama tamamlanamadı';if(!cancelled)app.toast(error.message,true); }
    finally { clearInterval(timer);tick();ocrActive=false;settings.forEach(id=>{const control=el(id);if(control)control.disabled=false;});el('wfRun').disabled=false;el('wfStop').disabled=true;renderCandidates(); }
  }
  function planCandidateNumbers(){
    const mode=app.state.metadata.candidateNumberingOrder||'rows',views=app.state.metadata.viewNumbering?.views||[];
    const groups=new Map();candidates.forEach((c,i)=>{delete c.plannedNumber;if(!c.selected)return;const key=c.scanRegion?.id||'page:'+c.page;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id:String(i),selectionBox:c.box,c});});
    const rank=key=>{const i=views.findIndex(v=>(v.id||window.ASMachViewNumbering.regionId(v))===key);return i<0?views.length:i;};
    const used=new Set(app.state.annotations.map(a=>Number(a.number)));let number=1;
    for(const [key,rows] of [...groups].sort((a,b)=>a[1][0].c.page-b[1][0].c.page||rank(a[0])-rank(b[0]))){
      const view=views.find(v=>(v.id||window.ASMachViewNumbering.regionId(v))===key),image=rows[0].c.pageImage;
      const ordered=window.ASMachViewNumbering?.ordered(rows,mode,view?.box||rows[0].c.scanRegion?.box||{x:0,y:0,w:1,h:1},image?image.width/image.height:1)||rows;
      for(const row of ordered){while(used.has(number))number++;row.c.plannedNumber=number;used.add(number++);}
    }
  }
  function renderCandidates() {
    planCandidateNumbers();
    candidates.forEach(c=>window.ASMachCandidateTable?.applyMissingGeneral(c,app));
    const currentDocument=app.state.pdfDoc||app.state.fileData;if(selectionDocumentKey!==currentDocument){selectionDocumentKey=currentDocument;selectedViewIds=null;}
    const nextStamp=JSON.stringify(exportQueue());if(queueStamp!==nextStamp){queueStamp=nextStamp;window.ASMachRecovery?.mark();}
    el('wfSelectAll').checked=candidates.length>0&&candidates.every(c=>c.selected);el('wfSelectAll').indeterminate=candidates.some(c=>c.selected)&&!el('wfSelectAll').checked;
    const rowHtml=(c,index)=>`<tr data-index="${index}"><td><input type="checkbox" ${c.selected?'checked':''} aria-label="Adayı seç"></td><td>${c.page}</td><td><button class="wf-preview" data-preview="${index}" aria-label="Ölçüyü çizimde büyüt"><img src="${esc(c.snapshot)}" alt="Kaynak ölçü"><div>${esc(c.geometryNote||'Çizimde göster')} ↗</div></button></td><td><input type="text" value="${esc(c.text)}" aria-label="Algılanan metin"><div class="wf-note">${esc(c.parsed.nominalValue||'')} ${esc(c.parsed.lowerTolerance||'')} / ${esc(c.parsed.upperTolerance||'')}</div></td><td class="wf-plan"><select data-field="type" aria-label="Karakteristik türü">${window.ASMachRequirements.TYPES.map(t=>`<option ${t===c.parsed.type?'selected':''}>${esc(t)}</option>`).join('')}</select>${c.parsed.type==='GD&T'?`<select data-field="gdtSubtype" aria-label="GD&T türü">${window.ASMachRequirements.gdtOptions(c.parsed.gdtSubtype).map(t=>`<option value="${esc(t.value)}" ${t.value===c.parsed.gdtSubtype?'selected':''}>${esc(t.label)}</option>`).join('')}</select>`:''}<select data-field="inspectionMethod" aria-label="Kontrol yöntemi">${app.getMethods().map(m=>`<option value="${esc(m.value)}" ${m.value===c.plan.inspectionMethod?'selected':''}>${esc(m.label)}</option>`).join('')}</select><select data-field="inspectionFrequency" aria-label="Kontrol sıklığı">${frequencyOptions(c.plan.inspectionFrequency)}</select>${['EVERY_N_PIECES','EVERY_N_HOURS'].includes(c.plan.inspectionFrequency)?`<input type="number" data-field="frequencyInterval" min="1" step="1" value="${esc(c.plan.frequencyInterval)}" aria-label="Kaç parçada bir">`:''}${c.plan.inspectionFrequency==='CUSTOM'?`<input type="text" data-field="frequencyNote" value="${esc(c.plan.frequencyNote)}" aria-label="Özel plan açıklaması">`:''}</td><td><span class="wf-badge ${c.confidence<70?'wf-warning':''}">%${Math.round(c.confidence||0)}</span></td></tr>`;
    el('wfRows').innerHTML=!candidates.length?'<tr><td colspan="6">Bekleyen aday yok. Yeni bir alan seçerek taramaya devam edebilirsiniz.</td></tr>':!groupByType?candidates.map(rowHtml).join(''):candidateGroupsByType(candidates).map(({type,indices})=>{
      const selected=indices.filter(i=>candidates[i].selected).length,closed=collapsedTypes.has(type);
      return `<tr class="wf-group"><th colspan="6"><input type="checkbox" data-group-select="${esc(type)}" ${selected===indices.length?'checked':''} aria-label="${esc(type)} grubunu seç"><button type="button" data-group-toggle="${esc(type)}" aria-expanded="${!closed}">${closed?'▸':'▾'} ${esc(type)}</button><small>${indices.length} aday · ${selected} seçili</small></th></tr>`+(closed?'':indices.map(i=>rowHtml(candidates[i],i)).join(''));
    }).join('');
    el('wfRows').querySelectorAll?.('[data-group-select]').forEach(input=>{const items=candidates.filter(c=>c.parsed.type===input.dataset.groupSelect),selected=items.filter(c=>c.selected).length;input.indeterminate=selected>0&&selected<items.length;});
    candidates.forEach((c,index)=>{if(c.saveIssue)el('wfRows').querySelector?.(`[data-index="${index}"]`)?.insertAdjacentHTML?.('afterend',`<tr><td colspan="6" role="alert" style="color:#a42939;background:#fff1f2;padding:10px">${esc(c.saveIssue)}</td></tr>`);});
    el('wfAccept').disabled=el('wfRun').disabled || !candidates.some((c)=>c.selected);
    if(window.ASMachRolePlans)el('wfRows').querySelectorAll?.('tr[data-index]').forEach(row=>{const c=candidates[Number(row.dataset.index)],button=document.createElement('button');if(c.plan.rolePlans)row.querySelectorAll('[data-field=inspectionMethod],[data-field=inspectionFrequency],[data-field=frequencyInterval],[data-field=frequencyNote]').forEach(n=>{n.disabled=true;n.title='Sorumlu bazlı plan için Kalite / Operatör düğmesini kullanın.';});button.className='btn';button.type='button';button.textContent='Kalite / Operatör';button.onclick=()=>window.ASMachRolePlans.open(app,c.plan,plans=>{if(candidates.includes(c)){c.plan.rolePlans=plans;renderCandidates();}});row.querySelector('.wf-plan')?.append(button);});
    el('wfAccept').textContent=`Seçilenleri kaydet (${candidates.filter(c=>c.selected).length})`;
    for(const c of candidates)if(c.pageImage)pageAssets.set(c.page,{pageImage:c.pageImage,ink:c.ink});
    const added=addedCandidates();
    if(!el('wfNumberOrder')){
      const label=document.createElement('label');label.style.cssText='display:flex;gap:6px;align-items:center;font-size:11px';label.textContent='Balon sırası';
      const select=document.createElement('select');select.id='wfNumberOrder';select.setAttribute('aria-label','Yeni balonların sıralama yönü');
      for(const [value,text] of [['rows','Satır satır'],['columns','Sütun sütun'],['clockwise','Saat yönü']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
      select.onchange=()=>{app.state.metadata.candidateNumberingOrder=select.value;window.ASMachRecovery?.mark();renderCandidates();};label.append(select);el('wfAccept').before(label);
      label.title='Seçili adaylara görünüş sırasıyla uygulanır. Kayıtlı numaralar korunur; boş numaralar kullanılır.';
      mountOrderIcons(select);
    }
    el('wfNumberOrder').value=app.state.metadata.candidateNumberingOrder||'rows';el('wfNumberOrder').disabled=el('wfRun').disabled;el('wfNumberOrder').syncIcon?.();
    if(window.ASMachCandidateDashboard)el('wfRows').insertAdjacentHTML?.('beforeend',added.map((c,i)=>rowHtml(c,candidates.length+i)).join(''));
window.ASMachCandidateDashboard?.render({panel,candidates:[...candidates,...added],savedCount,addedCount:added.length,onDraftSaved:(c,r)=>{r.candidateReviewStatus=c.reviewStatus||'';r.originalOcrText=c.originalText||c.text;c.addedId=r.id;c.savedNumber=r.number;c.saved=true;c.selected=false;candidates=candidates.filter(a=>a!==c);savedCount++;renderCandidates();},removeCandidates,undoCandidateDelete,canUndoDelete:deletedBatch?.key===documentKey,refresh:renderCandidates,selectedViewIds,toggleScanView,removeView,sourceCorrection,applyBulk:applyCandidatePatch,error:c=>c.saveIssue||candidateError(c),preview:previewCandidate,app});
    el('wfAccept').before(el('wfNumberOrder').parentElement);
  }
  function toggleScanView(id){if(el('wfRun').disabled)return;const ids=(app.state.metadata?.viewNumbering?.views||[]).map(v=>v.id||window.ASMachViewNumbering.regionId(v));if(selectedViewIds===null)selectedViewIds=new Set(ids);if(id==='all')selectedViewIds=ids.every(key=>selectedViewIds.has(key))?new Set():new Set(ids);else selectedViewIds.has(id)?selectedViewIds.delete(id):selectedViewIds.add(id);renderCandidates();}
  function applyCandidatePatch(patch){
    if(el('wfRun').disabled)return;
    const targets=candidates.filter(c=>c.selected);if(!targets.length)return app.toast('Önce aday seçin.',true);
    if(!patch.type&&!patch.method&&!patch.frequency)return app.toast('Uygulanacak alanı seçin.',true);
    if((patch.method||patch.frequency)&&targets.some(c=>c.plan.rolePlans))return app.toast('Sorumlu bazlı plan içeren adaylar için Kalite / Operatör toplu planını kullanın. Hiçbir aday değiştirilmedi.',true);
    const drafts=[];try{for(const c of targets){const draft={...c,plan:JSON.parse(JSON.stringify(c.plan))};if(patch.type){draft.forcedType=patch.type;parseCandidate(draft);}if(patch.method)draft.plan.inspectionMethod=el('wfMethod').value;if(patch.frequency)Object.assign(draft.plan,{inspectionFrequency:el('wfFrequency').value,frequencyInterval:el('wfInterval').value,frequencyNote:el('wfFrequencyNote').value});if(patch.method||patch.frequency){const error=window.ASMachInspectionPlan?.validate(draft.plan);if(error)throw new Error(error);}delete draft.saveIssue;drafts.push(draft);}}catch(e){return app.toast(e.message+' Hiçbir aday değiştirilmedi.',true);}
    targets.forEach((c,i)=>Object.assign(c,drafts[i]));renderCandidates();app.toast(`${targets.length} seçili aday güncellendi. Seçilmeyen alanlar korundu.`);
  }
  async function removeView(id){
    if(el('wfRun').disabled)return;
    const views=app.state.metadata?.viewNumbering?.views||[],view=views.find(v=>(v.id||window.ASMachViewNumbering.regionId(v))===id);if(!view)return;
    const inside=r=>{const p=window.ASMachViewNumbering.center(r),b=view.box;return Number(r.page)===Number(view.page)&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;};
    const measurements=app.state.annotations.filter(inside).length,linked=candidates.filter(c=>c.scanRegion?.id===id),pending=candidates.filter(c=>c.scanRegion?.id===id||inside({...c,selectionBox:c.box})).length;
    if(!await window.ASMachMessages.confirm(`${view.name||'Görünüş'} silinsin mi?${measurements||pending?`\nBu alanda ${measurements} kayıtlı ölçü ve ${pending} bekleyen aday var.`:''}\nYalnızca görünüş kaldırılacak; ölçüler ve adaylar korunacak. Numara sıralaması değişmeyecek.`))return;
    app.checkpoint();window.ASMachViewNumbering.removeSharedView(app,id);linked.forEach(c=>delete c.scanRegion);if(scanArea&&(scanArea.id||window.ASMachViewNumbering.regionId(scanArea))===id)scanArea=null;
    syncScanViews();renderCandidates();app.renderAll();
  }
  function candidateError(c) {
    const p=c.reviewed||c.parsed;
    if(/[°º˚]/.test(c.text)&&!/[x×]/i.test(c.text)&&p?.type==='Uzunluk')return 'Derece işareti var; karakteristik türünü Açı olarak doğrulayın.';
    if(p?.parseWarnings?.some(w=>/Açı girişini/.test(w)))return p.parseWarnings.find(w=>/Açı girişini/.test(w));
    if(p?.toleranceAmbiguous)return p.parseWarnings?.find(w=>w.includes('Tolerans işareti'))||'Tolerans işaretlerini doğrulayın.';
    if(p?.type==='GD&T'){
      const subtype=p.gdtSubtype||p.gdtFrame?.subtype;
      if(!window.ASMachRequirements.GDT_TYPES.some(t=>t.value===subtype))return 'GD&T türünü seçin.';
      const zone=p.upperTolerance??p.gdtFrame?.tolerance;
      if(String(zone??'').trim()===''||!Number.isFinite(Number(String(zone).replace(',','.')))||Number(String(zone).replace(',','.'))<0)return 'GD&T tolerans bölgesini kontrol edin.';
      if(p.gdtFrame?.datums?.some(d=>!d.reference))return 'Okunamayan GD&T datumunu düzeltin.';
      return '';
    }
    return technicalScore(c.text)>=35?'':'Ölçü metni doğrulanamadı; türü, toleransı ve datumları kontrol edin.';
  }
  function accept() {
    window.ASMachSharedCandidateInspector?.park();
    planCandidateNumbers();
    const requested=candidates.filter(c=>c.selected&&c.reviewStatus!=='rejected');
    requested.forEach(c=>c.saveIssue=candidateError(c));
    const selected=requested.filter(c=>!c.saveIssue);
    const invalid=requested.length-selected.length;
    if(!selected.length){
      if(invalid){const message='Seçilen ölçü / GD&T metni doğrulanamadı. Önizlemede türü, toleransı ve datumları kontrol edin.';el('wfProgress').textContent=message;renderCandidates();app.toast(message,true);}
      return;
    }
    for(const c of selected){const error=window.ASMachInspectionPlan?.validate(c.plan);if(error){c.saveIssue=error;el('wfProgress').textContent=error;renderCandidates();return app.toast(error,true);}}
    let placed=0;const geometry=window.ASMachAutomaticGeometry;
    for(const c of selected) {
      // Recheck at save time: the queue may have stayed open while another
      // workflow added this source region. Visibility never changes OCR pixels.
      if(app.state.annotations.some(r=>!r.listOnly&&r.page===c.page&&r.selectionBox&&overlap(r.selectionBox,c.box)>.6)){
        c.saveIssue='Bu ölçü bölgesi zaten karakteristik olarak eklenmiş. Tekrar eklenmedi.';continue;
      }
      let item;
      try{
        item=makeItem(c,c.plannedNumber);
        if(geometry&&!geometry.place(item,c.pageImage.width,c.pageImage.height,app.state.annotations,c.ink)){c.saveIssue='Balona yakında yer bulunamadı. Önizlemeyi açıp balonu sürükleyin veya daha küçük bir yöntem stili seçin.';continue;}
      }catch(error){c.saveIssue='Aktarım tamamlanamadı: '+String(error.message||error);continue;}
      if(!placed)app.checkpoint();placed++;window.ASMachProjectWorkspace?.defaults(item);item.autoDetected=true;item.detectionViewId=c.scanRegion?.id||'';app.state.annotations.push(item);app.recordChange('Otomatik tespitten karakteristik eklendi',item);c.saved=true;
    }
    if(placed)window.ASMachBalloonPlacement?.stabilizeAutoStyles(app.state.annotations);
    savedCount+=placed;candidates=candidates.filter(c=>!c.saved);
    const invalidMessage=invalid?` ${invalid} seçili adayın ölçü / GD&T metni doğrulanamadı; önizlemede düzeltin.`:'';
    el('wfProgress').textContent=`${placed} kaydedildi · ${candidates.length} aday listede korunuyor. ${selected.length>placed?'Aktarılamayan adayın altındaki açıklamayı kontrol edin.':'Yeni alan seçerek veya kalan adayları seçerek devam edebilirsiniz.'}${invalidMessage}`;renderCandidates();
    app.renderAll();app.toast(`${placed} karakteristik kutunun yanına kısa bağlantıyla eklendi.${selected.length>placed?' Yerleşemeyen adaylar listede kaldı.':''}${invalidMessage}`);
  }

  const columns=[['Char No','number'],['Sheet','sheetNo'],['Page','page'],['Zone','zone'],['Characteristic Type','type'],['Reference Location','zone'],['Requirement','requirement'],['Nominal','nominalValue'],['Lower Tolerance','lowerTolerance'],['Upper Tolerance','upperTolerance'],['Lower Limit','lowerLimit'],['Upper Limit','upperLimit'],['Units','unit'],['Datum Reference','datumRefs'],['Special Characteristic','specialDesignator'],['Inspection Method','inspectionMethod'],['Evaluation','evaluationMethod'],['Result','result'],['Result Status','resultStatus'],['Status','status'],['Nonconformance No','nonconformanceNo'],['Comments','comment'],['Tolerance Source','toleranceStandard'],['Fit Class','fitClass'],['Thread Pitch','threadPitch'],['Thread Standard','threadStandard'],['Quantity','quantity'],['OCR Confidence','detectionConfidence'],['OCR Source','recognitionSource']];
  function rows() { return [...app.state.annotations].sort(window.ASMachNumberOrder.records).map((item)=>columns.map(([,key])=>key==='inspectionMethod'?(item.rolePlans?Object.entries(item.rolePlans).filter(([,p])=>p.enabled).map(([role,p])=>`${window.ASMachRolePlans.roles[role]}: ${app.methodLabel(p.inspectionMethod)} / ${window.ASMachInspectionPlan.label(p)}`).join(' | '):app.methodLabel(item[key])):key==='status'?app.statusLabel(item[key]):item[key]??'')); }
  function exportCsv() {
    const safe=(v)=>{const s=String(v??'');return !finite(s)&&/^[=+\-@\t\r]/.test(s)?"'"+s:s;};
    const csv=[columns.map(c=>c[0]),...rows()].map(row=>row.map(v=>'"'+safe(v).replaceAll('"','""')+'"').join(';')).join('\r\n');
    return app.saveBlob(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),app.baseName(app.state.fileName)+'_karakteristikler.csv','Karakteristik listesi',{'text/csv':['.csv']});
  }
  function workbookFiles() {
    const meta=app.state.metadata;
    const header=[['Technical Drawing No',meta.drawingNo||app.state.fileName],['Drawing Revision',meta.drawingRevision||''],['Part No',meta.partNo||''],['Part Revision',meta.partRevision||''],['Customer',meta.customer||''],['Prepared By',meta.preparedBy||''],['Export Date',new Date().toISOString()],['Description',meta.description||''],[],columns.map(c=>c[0])];
    const audit=[['Tarih','İşlem','Karakteristik','Kullanıcı'],...app.state.auditLog.map(row=>[row.at,row.action,row.number,row.by])];
    const xml=(s)=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const col=(n)=>{let s='';do{s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)-1;}while(n>=0);return s;};
    const sheet=(data,freeze)=>`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="28" width="19" customWidth="1"/><col min="7" max="7" width="42" customWidth="1"/></cols><sheetData>${data.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>`<c r="${col(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData>${freeze===10?`<autoFilter ref="A10:AB${Math.max(10,data.length)}"/>`:''}</worksheet>`;
    const files = {'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="AS9102 Form 3" sheetId="1" r:id="rId1"/><sheet name="Islem Gecmisi" sheetId="2" r:id="rId2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml':sheet([...header,...rows()],10),'xl/worksheets/sheet2.xml':sheet(audit,1)};
    addSnapshotImages(files);
    return files;
  }
  function addSnapshotImages(files) {
    const records=[...app.state.annotations].sort(window.ASMachNumberOrder.records);
    const pictures=[];
    for(const [index,item] of records.entries()){
      const snapshot=window.ASMachGdtReport?.image(item)||'';
      if(item.type!=='GD&T'||!/^data:image\/png;base64,/.test(snapshot||''))continue;
      const binary=atob(snapshot.split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      if(bytes.length<24)continue;
      const view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
      if(!width||!height)continue;
      const ratio=Math.min(300/width,16/height),id=pictures.length+1,row=index+10;
      files[`xl/media/snapshot${id}.png`]=bytes;
      pictures.push({id,row,cx:Math.round(width*ratio*9525),cy:Math.round(height*ratio*9525)});
      files['xl/worksheets/sheet1.xml']=files['xl/worksheets/sheet1.xml'].replace(`<row r="${row+1}">`,`<row r="${row+1}" ht="22" customHeight="1">`);
    }
    if(!pictures.length)return;
    files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    files['xl/worksheets/sheet1.xml']=files['xl/worksheets/sheet1.xml'].replace('<worksheet xmlns=', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns=').replace('</cols>','<col min="29" max="29" width="44" customWidth="1"/></cols>').replace('</worksheet>','<drawing r:id="rIdSnapshot"/></worksheet>').replace('<row r="10">','<row r="10"><c r="AC10" t="inlineStr"><is><t>GD&amp;T Snapshot</t></is></c>');
    files['xl/worksheets/sheet1.xml']=files['xl/worksheets/sheet1.xml'].replace(/(<row r="10">)(<c r="AC10"[\s\S]*?<\/c>)([\s\S]*?)(<\/row>)/,(_,open,cell,body,close)=>open+body+cell+close);
    files['xl/worksheets/_rels/sheet1.xml.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSnapshot" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>';
    files['xl/drawings/_rels/drawing1.xml.rels']=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pictures.map(p=>`<Relationship Id="rId${p.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/snapshot${p.id}.png"/>`).join('')}</Relationships>`;
    files['xl/drawings/drawing1.xml']=`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pictures.map(p=>`<xdr:oneCellAnchor><xdr:from><xdr:col>28</xdr:col><xdr:colOff>19050</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from><xdr:ext cx="${p.cx}" cy="${p.cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${p.id}" name="GD&amp;T Snapshot ${p.id}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${p.id}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${p.cx}" cy="${p.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('')}</xdr:wsDr>`;
  }
  function zipStored(files) {
    const encoder=new TextEncoder(), parts=[], central=[];let offset=0;
    const crc=(bytes)=>{let n=0xffffffff;for(const byte of bytes){n^=byte;for(let b=0;b<8;b++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;};
    for(const [path,content] of Object.entries(files)) {
      const name=encoder.encode(path), data=content instanceof Uint8Array?content:encoder.encode(content), local=new Uint8Array(30+name.length),dv=new DataView(local.buffer),sum=crc(data);
      dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x800,true);dv.setUint32(14,sum,true);dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);dv.setUint16(26,name.length,true);local.set(name,30);
      parts.push(local,data);const center=new Uint8Array(46+name.length),cv=new DataView(center.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);center.set(name,46);central.push(center);offset+=local.length+data.length;
    }
    const total=central.reduce((n,p)=>n+p.length,0), end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,total,true);ev.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  async function exportExcel() {
    if(window.ASMachExcelReports)return window.ASMachExcelReports.open(app);
    if(!app.state.annotations.length) return app.toast('Önce karakteristik ekleyin.',true);
    await app.saveBlob(zipStored(workbookFiles()),app.baseName(app.state.fileName)+'_AS9102_Form3.xlsx','Excel karakteristik listesi',{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']});
    app.recordChange('Excel karakteristik listesi dışa aktarıldı');
  }
  window.ASMachWorkflow={init,exportCsv,exportExcel,workbookFiles,zipStored,technicalScore,candidateGroups,rankCandidates,pageSources,overlap,exportQueue,restoreQueue};
}());
