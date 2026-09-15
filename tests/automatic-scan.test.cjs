const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(words){
  const nodes={},progress=[];
  class Node{
    constructor(){this.style={};this.value='';this.disabled=false;this.checked=false;this.classList={add(){},remove(){}};}
    set id(id){nodes[id]=this;this._id=id;}get id(){return this._id;}
    setAttribute(){}append(){}after(){}querySelector(s){return nodes[s]||(nodes[s]=new Node());}
    set innerHTML(html){this.html=html;for(const m of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const n=new Node();n.id=m[1];n.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';n.checked=/\schecked/.test(m[0]);n.disabled=/\sdisabled/.test(m[0]);}}
    set textContent(t){this.text=t;if(this.id==='wfPercent')progress.push(t);}get textContent(){return this.text||'';}
  }
  const document={head:new Node(),body:new Node(),getElementById:id=>nodes[id],createElement:tag=>{const n=new Node();if(tag==='canvas'){n.getContext=()=>({drawImage(){},fillRect(){}});n.toDataURL=()=> 'data:image/png;base64,fixture';}return n;}};
  const c={window:{},document,setTimeout,clearTimeout,setInterval,clearInterval,console};vm.createContext(c);for(const file of ['requirements-engine','inspection-plan','dimension-filter','balloon-numbering','workflow'])vm.runInContext(fs.readFileSync('src/'+file+'.js','utf8'),c);
  const engine=c.window.ASMachRequirements;
  const html=fs.readFileSync('src/app.template.html','utf8');vm.runInContext(html.slice(html.indexOf('function parseTechnicalRequirementLegacy('),html.indexOf('function technicalTextScore(')),c);
  let renders=0,captures=0,ocr=0;const captureBoxes=[];
  const app={state:{fileData:'pdf',fileName:'test.pdf',pageCount:1,currentPage:1,annotations:[],pdfDoc:{getPage:async()=>({getViewport:()=>({}),getTextContent:async()=>({items:words})})}},elements:{boxOcrModeButton:new Node(),csvButton:new Node(),sourceCanvas:{width:1000,height:700}},getMethods:()=>[{value:'KUMPAS',label:'Kumpas'}],mapPdfTextBox:w=>w,parseRequirement:t=>engine.parse(t),loadImage:async()=>({width:1000,height:700}),renderAll:()=>renders++,toast(){},checkpoint(){},normalizeAnnotation:r=>r,nextBalloonNumber:()=>1,applyMethodStyle(){},recordChange(){}};
  c.window.ASMachOCR={capture:async options=>{captures++;captureBoxes.push(options.box);return 'image';},detect:async()=>{ocr++;return{words:[],lines:[]};},terminate:async()=>{}};
  c.window.ASMachWorkflow.init(app);nodes.wfScope.value='current';nodes.wfDpi.value='300';nodes.wfConfidence.value='75';
  app.parseRequirement=t=>engine.parse(t,'',c.parseTechnicalRequirementLegacy);
  app.nextBalloonNumber=()=>c.window.ASMachBalloonNumbering.next(app.state.annotations);
  return{c,app,nodes,progress,captureBoxes,counts:()=>({renders,captures,ocr})};
}
const dims=Array.from({length:9},(_,i)=>({text:'R'+(i+2),x:.12+i%3*.3,y:.12+Math.floor(i/3)*.25,w:.03,h:.02}));
function useRealHost(f){
  const html=fs.readFileSync('src/app.template.html','utf8'),c=f.c;
  c.crypto=require('node:crypto');c.state=f.app.state;c.state.methodStyles={};c.state.generalTolerance={standard:''};c.clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  vm.runInContext(html.slice(html.indexOf('const InspectionMethod ='),html.indexOf('let inspectionMethods ='))+'\nlet inspectionMethods=[...DEFAULT_INSPECTION_METHODS];',c);
  const start=html.indexOf('const DEFAULT_METHOD_STYLES =');vm.runInContext(html.slice(start,html.indexOf('\n        });',start)+'\n        });'.length),c);
  for(const name of ['defaultStyleFor','isInspectionMethod','normalizeInspectionMethod','methodStyle','applyMethodToAnnotation','normalizeStoredSelectionBox','normalizeAnnotation','parseTechnicalRequirement']){
    const index=new RegExp('^        function '+name+'\\(','m').exec(html).index;
    vm.runInContext(html.slice(index,html.indexOf('\n        }',index)+'\n        }'.length),c);
  }
  for(const file of ['balloon-placement','automatic-geometry'])vm.runInContext(fs.readFileSync('src/'+file+'.js','utf8'),c);
  c.window.ASMachBalloonPlacement.inkSampler=()=>null;
  f.app.normalizeAnnotation=c.normalizeAnnotation;f.app.applyMethodStyle=c.applyMethodToAnnotation;f.app.parseRequirement=t=>c.parseTechnicalRequirement(t);f.app.parseTechnicalRequirement=c.parseTechnicalRequirement;
  // Geometry refinement is unrelated to saving; retain a clean source fixture.
  c.window.ASMachAutomaticGeometry.refine=(image,word,region)=>({box:c.window.ASMachAutomaticGeometry.toPage(word,region),snapshot:'data:image/png;base64,fixture'});
}
test('Fast scan uses one PDF raster and no redundant OCR, publishes progress and restores controls',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();assert.deepEqual(f.counts(),{renders:1,captures:1,ocr:0});assert.equal(f.nodes.wfMeter.value,100);assert.ok(f.progress.some(p=>p.includes('%')));assert.match(f.nodes.wfProgress.textContent,/9 ölçü adayı/);assert.equal(f.nodes.wfRun.disabled,false);assert.equal(f.nodes.wfScope.disabled,false);assert.equal(f.nodes.wfDetailed.checked,false);
  const percentages=f.progress.filter(p=>/^%\d+/.test(p)).map(p=>Number(p.match(/^%(\d+)/)[1]));for(let i=1;i<percentages.length;i++)assert.ok(percentages[i]>=percentages[i-1]);
});
test('Stop terminates active recognition and does not scan more directions or publish a completed percentage',async()=>{
  const f=fixture([]);let resolve,terminated=0;f.c.window.ASMachOCR.detect=()=>new Promise(r=>resolve=r);f.c.window.ASMachOCR.terminate=async()=>{terminated++;resolve({error:'cancelled'});};
  const task=f.nodes.wfRun.onclick();while(!resolve)await new Promise(r=>setTimeout(r,1));f.nodes.wfStop.onclick();await task;
  assert.equal(terminated,1);assert.match(f.nodes.wfPercent.textContent,/Durduruldu/);assert.notEqual(f.nodes.wfMeter.value,100);assert.equal(f.nodes.wfRun.disabled,false);assert.equal(f.nodes.wfStop.disabled,true);
});
test('Detailed scan reuses the captured page for all four tiles rather than rendering PDF five times',async()=>{
  const f=fixture(dims);f.nodes.wfDetailed.checked=true;await f.nodes.wfRun.onclick();assert.equal(f.counts().captures,1);assert.equal(f.counts().ocr,5);assert.equal(f.nodes.wfMeter.value,100);
});

test('Explicit view creation requests a region; capture and candidates stay inside it, excluding an outside title dimension',async()=>{
  const f=fixture([...dims,{text:'R999',x:.7,y:.87,w:.05,h:.02}]),box={x:.05,y:.05,w:.9,h:.68};let asked=0;
  f.app.selectScanArea=async()=>{asked++;return{page:1,box};};vm.runInContext(fs.readFileSync('src/automatic-geometry.js','utf8'),f.c);
  const geometry=f.c.window.ASMachAutomaticGeometry;geometry.refine=(image,word,region)=>({box:geometry.toPage(word,region),snapshot:'fixture'});
  await f.nodes.autoDetectButton.onclick();assert.equal(asked,0);await f.nodes.wfReselect.onclick();assert.equal(asked,1);assert.equal(f.counts().captures,0,'Choose before starting OCR');await f.nodes.wfRun.onclick();
  assert.equal(JSON.stringify(f.captureBoxes[0]),JSON.stringify(box));assert.match(f.nodes.wfProgress.textContent,/9 ölçü adayı/);assert.doesNotMatch(f.nodes.wfRows.html,/R999/);
});

test('Unplaceable balloons remain in the review queue instead of receiving long leaders',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();f.c.window.ASMachAutomaticGeometry={place:()=>false};f.c.window.ASMachBalloonPlacement={inkSampler:()=>null};
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,0);assert.match(f.nodes.wfProgress.textContent,/altındaki açıklamayı/);assert.equal(f.nodes.wfAccept.disabled,false);
  f.c.window.ASMachAutomaticGeometry.place=item=>{item.bubbleX=.5;item.bubbleY=.5;return true;};f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,9);
});

function change(f,index,key,value){f.nodes.wfRows.onchange({target:{type:key==='selected'?'checkbox':'select-one',checked:value,value,dataset:key==='text'?{}:{field:key},closest:()=>({dataset:{index:String(index)}})}});}
test('Corrected type and per-row plans survive partial save, reopening and further scans',async()=>{
  const f=fixture(dims);const parse=f.app.parseRequirement;f.app.parseRequirement=t=>({...parse(t),nominalValue:t.match(/\d+(?:\.\d+)?/)?.[0]||''});await f.nodes.autoDetectButton.onclick();await f.nodes.wfRun.onclick();
  change(f,0,'type','Çap');change(f,0,'text','R2.5');
  f.nodes.wfSelectAll.onchange({target:{checked:false}});change(f,0,'selected',true);
  f.nodes.wfMethod.value='CMM';f.nodes.wfFrequency.value='EVERY_N_PIECES';f.nodes.wfInterval.value='5';f.nodes.wfPlanSelected.onclick();
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,1);
  const saved=f.app.state.annotations[0];assert.equal(saved.type,'Çap');assert.match(saved.requirement,/Ø2.5/);assert.equal(saved.inspectionMethod,'CMM');assert.equal(saved.inspectionFrequency,'EVERY_N_PIECES');assert.equal(saved.frequencyInterval,'5');
  assert.match(f.nodes.wfProgress.textContent,/8 aday listede korunuyor/);
  await f.nodes.autoDetectButton.onclick();assert.match(f.nodes.wfRows.html,/R3/);assert.doesNotMatch(f.nodes.wfRows.html,/R2.5/);
  await f.nodes.wfRun.onclick();assert.match(f.nodes.wfProgress.textContent,/8 ölçü adayı/,'Repeat scan must not duplicate queued or saved dimensions');
  f.app.selectScanArea=async()=>({page:1,box:{x:0,y:0,w:1,h:1}});await f.nodes.wfReselect.onclick();await f.nodes.wfRun.onclick();assert.match(f.nodes.wfProgress.textContent,/8 ölçü adayı/);
  f.nodes.wfFrequency.value='PER_LOT';f.nodes.wfMethod.value='KUMPAS';f.nodes.wfPlanAll.onclick();
  f.nodes.wfSelectAll.onchange({target:{checked:true}});f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,9);assert.ok(f.app.state.annotations.slice(1).every(a=>a.inspectionFrequency==='PER_LOT'));assert.match(f.nodes.wfProgress.textContent,/0 aday/);
});
test('Invalid intervals never save partially, and changing a document clears its old review queue',async()=>{
  const f=fixture(dims);await f.nodes.autoDetectButton.onclick();await f.nodes.wfRun.onclick();change(f,0,'inspectionFrequency','EVERY_N_PIECES');change(f,0,'frequencyInterval','0');f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,0);
  f.app.state.pdfDoc={getPage:async()=>({getViewport:()=>({}),getTextContent:async()=>({items:[]})})};await f.nodes.autoDetectButton.onclick();assert.doesNotMatch(f.nodes.wfRows.html,/data-index/);
});
test('Preview uses a captured wide page, honors the corrected method and does not commit annotations',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();let preview;
  f.c.window.ASMachCandidatePreview={open:data=>preview=data};f.c.window.ASMachAutomaticGeometry={place:item=>{item.bubbleX=.2;item.bubbleY=.2;return true;}};
  f.nodes.wfRows.onclick({target:{closest:()=>({dataset:{preview:'0'}})}});
  assert.equal(preview.candidate.pageImage.width,1000);assert.equal(preview.candidate.pageImage.height,700);assert.equal(preview.item.inspectionMethod,'KUMPAS');assert.equal(preview.placed,true);assert.equal(f.app.state.annotations.length,0);
  f.app.state.annotations.push({id:'existing1',number:'1'},{id:'existing3',number:'3'});
  f.nodes.wfRows.onclick({target:{closest:()=>({dataset:{preview:'0'}})}});assert.equal(preview.item.number,'2');
  f.nodes.wfRows.onclick({target:{closest:()=>({dataset:{preview:'1'}})}});assert.equal(preview.item.number,'4','Preview skips occupied 3 after reserving first gap 2');
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations[2].number,'2');assert.equal(f.app.state.annotations[3].number,'4');
});
test('Further scans append new measurements without erasing unchecked candidates or their edits',async()=>{
  const words=[...dims],f=fixture(words);await f.nodes.autoDetectButton.onclick();await f.nodes.wfRun.onclick();
  f.nodes.wfSelectAll.onchange({target:{checked:false}});change(f,0,'type','Çap');change(f,0,'inspectionFrequency','PER_SHIFT');
  words.push({text:'R90',x:.8,y:.85,w:.04,h:.03});await f.nodes.wfRun.onclick();assert.match(f.nodes.wfProgress.textContent,/10 ölçü adayı/);assert.match(f.nodes.wfAccept.textContent,/\(1\)/);
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,1);assert.match(f.nodes.wfProgress.textContent,/9 aday listede korunuyor/);
  change(f,0,'selected',true);f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations[1].type,'Çap');assert.equal(f.app.state.annotations[1].inspectionFrequency,'PER_SHIFT');
});

test('Type groups keep original row identities, group selection and collapsing do not affect other groups',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();
  change(f,1,'type','Çap');assert.match(f.nodes.wfRows.html,/data-group-toggle="Çap"/);assert.match(f.nodes.wfRows.html,/data-group-toggle="Yarıçap"/);
  f.nodes.wfRows.onchange({target:{dataset:{groupSelect:'Yarıçap'},checked:false}});assert.match(f.nodes.wfAccept.textContent,/\(1\)/);
  f.nodes.wfRows.onclick({target:{closest:s=>s==='[data-group-toggle]'?{dataset:{groupToggle:'Yarıçap'}}:null}});
  assert.doesNotMatch(f.nodes.wfRows.html,/data-index="0"/);assert.match(f.nodes.wfRows.html,/data-index="1"/);
  f.nodes.wfGroupType.onchange({target:{checked:false}});assert.doesNotMatch(f.nodes.wfRows.html,/data-group-toggle/);assert.match(f.nodes.wfRows.html,/data-index="0"/);
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,1);assert.equal(f.app.state.annotations[0].type,'Çap');
});

test('Preview repair updates only its draft candidate, retains method/frequency/selection, and commits corrected geometry on partial save',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();let preview;
  f.c.window.ASMachCandidatePreview={open:data=>preview=data};
  f.c.window.ASMachCandidateCorrection={recognize:async()=>({text:'11 (+0.1/0)',confidence:92,snapshot:'data:image/png;base64,new',source:'OCR'})};
  change(f,0,'inspectionFrequency','PER_SHIFT');change(f,1,'selected',false);
  f.nodes.wfRows.onclick({target:{closest:s=>s==='[data-preview]'?{dataset:{preview:'0'}}:null}});
  const original=JSON.stringify(preview.candidate),box={x:.12,y:.12,w:.1,h:.04,rotation:0};
  const recognized=await preview.onRecognize({box,snapshot:'draft'});assert.equal(JSON.stringify(preview.candidate),original,'Reading is not applying');
  assert.throws(()=>preview.onApply({box,text:'wrong title',snapshot:'draft'}));assert.equal(JSON.stringify(preview.candidate),original);
  preview.onApply({...recognized,box});assert.equal(preview.candidate.parsed.nominalValue,'11');assert.equal(Number(preview.candidate.parsed.upperTolerance),.1);assert.equal(preview.candidate.plan.inspectionFrequency,'PER_SHIFT');
  assert.equal(f.app.state.annotations.length,0);assert.match(f.nodes.wfRows.html,/data-group-toggle="Uzunluk"/);assert.match(f.nodes.wfAccept.textContent,/\(8\)/);
  f.nodes.wfSelectAll.onchange({target:{checked:false}});change(f,0,'selected',true);f.nodes.wfAccept.onclick();
  assert.equal(f.app.state.annotations.length,1);assert.equal(f.app.state.annotations[0].selectionBox.w,.1);assert.equal(f.app.state.annotations[0].nominalValue,'11');assert.match(f.nodes.wfProgress.textContent,/8 aday/);
  assert.throws(()=>preview.onApply({...recognized,box}),/listesi değişti/,'Saved candidate cannot be updated through stale preview');
});
test('Searchable PDF fast path still runs graphical diameter and GD&T recovery before filtering and deduplication',async()=>{
 const words=dims.map(w=>({...w}));words[0].text='27.3';const f=fixture(words);let calls=0;
 f.c.window.ASMachAutomaticSymbols={enrich:async()=>{calls++;return [{...words[0],text:'Ø27.3',confidence:100,source:'PDF · Çap simgesi doğrulandı',visualDiameter:true},{x:.8,y:.8,w:.1,h:.05,points:[{x:.8,y:.8},{x:.9,y:.8},{x:.9,y:.85},{x:.8,y:.85}],text:'◎ | ±0.1 | A',confidence:60,source:'GD&T hücreleri',visualGdt:true,snapshot:'data:image/png;base64,fixture',readingAngle:0}];}};
 await f.nodes.wfRun.onclick();assert.equal(calls,1);assert.equal(f.counts().ocr,0);assert.match(f.nodes.wfProgress.textContent,/10 ölçü adayı/);assert.match(f.nodes.wfRows.html,/Ø27.3/);assert.match(f.nodes.wfRows.html,/◎ \| ±0.1 \| A/);assert.match(f.nodes.wfAccept.textContent,/\(9\)/,'Low confidence frame stays visible for manual review');
});

test('Shared box editor preserves structured corrections, manual requirement and plan until partial save',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();let preview,apply,close;
  f.c.window.ASMachCandidatePreview={open:data=>preview=data};
  f.app.editCandidate=async(item,onApply,onClose)=>{apply=onApply;close=onClose;};
  f.nodes.wfRows.onclick({target:{closest:s=>s==='[data-preview]'?{dataset:{preview:'0'}}:null}});
  const before=JSON.stringify(preview.candidate);await preview.onEdit();close();assert.equal(JSON.stringify(preview.candidate),before,'Cancel is a no-op');
  await preview.onEdit();
  apply({...preview.item,type:'Çap',nominalValue:'24.5',lowerTolerance:'-0.05',upperTolerance:'+0.05',lowerLimit:'24.45',upperLimit:'24.55',requirement:'Kontrol edilmiş özel metin',requirementMode:'manual',ocrText:'Ø24.5 ±0.05',snapshot:'new-crop',selectionBox:{x:.2,y:.3,w:.1,h:.02},inspectionMethod:'KUMPAS',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'7',frequencyNote:'Plan',reviewBalloonPosition:{x:.18,y:.31}});close();
  assert.equal(f.app.state.annotations.length,0);assert.equal(preview.candidate.parsed.lowerTolerance,'-0.05');
  f.nodes.wfSelectAll.onchange({target:{checked:false}});change(f,0,'selected',true);f.nodes.wfAccept.onclick();
  const saved=f.app.state.annotations[0];assert.equal(saved.lowerTolerance,'-0.05');assert.equal(saved.lowerLimit,'24.45');assert.equal(saved.nominalValue,'24.5');assert.equal(saved.requirement,'Kontrol edilmiş özel metin');assert.equal(saved.frequencyInterval,'7');assert.equal(saved.reviewBalloonPosition.x,.18);assert.equal(saved.snapshot,'new-crop');assert.match(f.nodes.wfProgress.textContent,/8 aday/);
  assert.throws(()=>apply(preview.item),/listesi değişti/);
});

test('Manually selected GD&T with ± frame transfers below scan confidence threshold after partial save',async()=>{
  const f=fixture([{text:'R25',x:.1,y:.1,w:.04,h:.03}]);f.nodes.wfConfidence.value='100';
  f.c.window.ASMachAutomaticSymbols={enrich:async()=>[{text:'◎ | ±0.1 | A',x:.4,y:.4,w:.12,h:.04,points:[{x:.4,y:.4},{x:.52,y:.4},{x:.52,y:.44},{x:.4,y:.44}],confidence:91,source:'GD&T hücreleri',visualGdt:true,snapshot:'data:image/png;base64,fixture',readingAngle:0}]};
  await f.nodes.wfRun.onclick();f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,1);assert.equal(f.app.state.annotations[0].type,'Yarıçap');
  f.nodes.wfRows.onchange({target:{dataset:{groupSelect:'GD&T'},checked:true}});assert.match(f.nodes.wfAccept.textContent,/\(1\)/);
  change(f,0,'selected',false);f.nodes.wfSelectAll.onchange({target:{checked:true}});assert.match(f.nodes.wfAccept.textContent,/\(1\)/);
  change(f,0,'inspectionMethod','CMM');f.nodes.wfAccept.onclick();
  assert.equal(f.app.state.annotations.length,2,'Selected graphical frame must not be silently discarded by the text-only save filter');
  const saved=f.app.state.annotations[1];assert.equal(saved.type,'GD&T');assert.equal(saved.gdtSubtype,'concentricity');assert.equal(Number(saved.upperTolerance),.1);assert.match(saved.datumRefs,/A/);assert.equal(saved.inspectionMethod,'CMM');assert.equal(saved.detectionConfidence,91);assert.ok(saved.parseWarnings.some(w=>w.includes('±')));assert.match(f.nodes.wfProgress.textContent,/0 aday/);
});

test('GD&T saves through real host normalization and CMM placement, retaining zone and datum',async()=>{
  const f=fixture([]);useRealHost(f);f.nodes.wfConfidence.value='100';
  f.c.window.ASMachAutomaticSymbols={enrich:async()=>[{text:'◎ | ±0.1 | A',x:.4,y:.4,w:.12,h:.04,points:[{x:.4,y:.4},{x:.52,y:.4},{x:.52,y:.44},{x:.4,y:.44}],confidence:92,source:'GD&T hücreleri',visualGdt:true,snapshot:'data:image/png;base64,fixture',readingAngle:0}]};
  await f.nodes.wfRun.onclick();change(f,0,'inspectionMethod','CMM');change(f,0,'selected',true);f.nodes.wfAccept.onclick();
  assert.equal(f.app.state.annotations.length,1);const a=f.app.state.annotations[0];assert.equal(a.inspectionMethod,'CMM');assert.equal(a.shape,'hexagon');assert.equal(a.type,'GD&T');assert.equal(a.gdtFrame.tolerance,'0.1');assert.equal(a.gdtFrame.datums[0].reference,'A');assert.ok(Number.isFinite(a.bubbleX));assert.match(f.nodes.wfProgress.textContent,/1 kaydedildi/);
});

test('Invalid selected measurements show an explicit reason instead of a silent save no-op',async()=>{
  const f=fixture(dims);let message;f.app.toast=m=>message=m;await f.nodes.wfRun.onclick();
  f.nodes.wfSelectAll.onchange({target:{checked:false}});
  f.nodes.wfRows.onchange({target:{value:'◎ | ± | A',dataset:{},closest:()=>({dataset:{index:'0'}})}});
  change(f,0,'selected',true);f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,0);assert.match(message,/doğrulanamadı/);assert.match(f.nodes.wfProgress.textContent,/datumları kontrol/);
  change(f,1,'selected',true);f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,1);assert.match(f.nodes.wfProgress.textContent,/1 seçili adayın.*doğrulanamadı/);assert.match(f.nodes.wfProgress.textContent,/8 aday/);
});

test('Reviewed GD&T saves structured fields despite unreadable OCR and preserves dragged placement through real normalization',async()=>{
  const f=fixture(dims);useRealHost(f);await f.nodes.wfRun.onclick();let preview,apply;
  f.c.window.ASMachCandidatePreview={open:p=>preview=p};f.app.editCandidate=async(item,accept)=>{apply=accept;};
  f.nodes.wfRows.onclick({target:{closest:s=>s==='[data-preview]'?{dataset:{preview:'0'}}:null}});await preview.onEdit();
  const result=f.c.window.ASMachRequirements.withGdtSubtype({...preview.item,type:'GD&T',gdtSubtype:'concentricity',datumRefs:'A',upperTolerance:'0.1',lowerTolerance:'0',nominalValue:'',ocrText:'?',inspectionMethod:'CMM',reviewBalloonPosition:{x:.3,y:.3}});
  apply(result);f.nodes.wfSelectAll.onchange({target:{checked:false}});f.nodes.wfRows.onchange({target:{dataset:{groupSelect:'GD&T'},checked:true}});f.nodes.wfAccept.onclick();
  assert.equal(f.app.state.annotations.length,1);const saved=f.app.state.annotations[0];assert.equal(saved.ocrText,'?');assert.equal(saved.gdtFrame.tolerance,'0.1');assert.equal(saved.datumRefs,'A');assert.equal(saved.bubbleX,.3);assert.equal(saved.bubbleY,.3);assert.equal(saved.inspectionMethod,'CMM');
});

test('Placement exception is reported on its candidate and other selected candidates can still save',async()=>{
  const f=fixture(dims);await f.nodes.wfRun.onclick();let calls=0,preview;
  f.c.window.ASMachCandidatePreview={open:p=>preview=p};
  f.c.window.ASMachAutomaticGeometry={place:()=>{if(++calls===1)throw Error('Geçersiz kutu');return true;}};f.nodes.wfAccept.onclick();
  assert.equal(f.app.state.annotations.length,8);assert.match(f.nodes.wfProgress.textContent,/1 aday/);
  f.nodes.wfRows.onclick({target:{closest:s=>s==='[data-preview]'?{dataset:{preview:'0'}}:null}});assert.match(preview.candidate.saveIssue,/Geçersiz kutu/);
  f.nodes.wfAccept.onclick();assert.equal(f.app.state.annotations.length,9);
});
