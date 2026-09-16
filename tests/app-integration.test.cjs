"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "src/app.template.html"), "utf8");
const requirementsSource = fs.readFileSync(path.join(root, "src/requirements-engine.js"), "utf8");
const workflowSource = fs.readFileSync(path.join(root, "src/workflow.js"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
const mainScript = scripts.map(match => match[2]).find(source => source.includes("function normalizeAnnotation(input)"));
assert.ok(mainScript, "Main application script exists in the source template");

// Host functions consistently use eight-space indentation. Closing at the same
// indentation excludes nested blocks, regex braces and object/template literals.
function hostFunction(name) {
  const match = new RegExp(`^        (?:async )?function ${name}\\(`, "m").exec(mainScript);
  assert.ok(match, `Host function ${name} exists`);
  const end = mainScript.indexOf("\n        }", match.index);
  assert.ok(end > match.index, `Host function ${name} has a closing block`);
  const source = mainScript.slice(match.index, end + "\n        }".length);
  new vm.Script(source, { filename: `${name}.extracted.js` });
  return source;
}

function hostContext() {
  const context = vm.createContext({ window: {}, console, crypto, structuredClone, setTimeout, clearTimeout,
    state: { generalTolerance: { standard: "", lower: "", upper: "", unit: "mm" }, methodStyles: {} },
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)) });
  vm.runInContext(requirementsSource, context);
  vm.runInContext(fs.readFileSync(path.join(root,'src/characteristic-editing.js'),'utf8'),context);
  context.updateOcrGdtReport=()=>{};
  const methodStart = mainScript.indexOf("const InspectionMethod =");
  const methodEnd = mainScript.indexOf("let inspectionMethods =", methodStart);
  vm.runInContext(mainScript.slice(methodStart, methodEnd) + "\nlet inspectionMethods = [...DEFAULT_INSPECTION_METHODS];", context);
  const styleStart = mainScript.indexOf("const DEFAULT_METHOD_STYLES =");
  const styleEnd = mainScript.indexOf("\n        });", styleStart) + "\n        });".length;
  vm.runInContext(mainScript.slice(styleStart, styleEnd), context);
  for (const name of ["defaultStyleFor", "isInspectionMethod", "normalizeInspectionMethod", "methodStyle", "applyMethodToAnnotation", "normalizeStoredSelectionBox", "normalizeAnnotation", "commitBalloonAnnotation"]) {
    vm.runInContext(hostFunction(name), context);
  }
  const parserStart = mainScript.indexOf("function parseTechnicalRequirementLegacy(");
  const parserEnd = mainScript.indexOf("function technicalTextScore(", parserStart);
  assert.ok(parserStart >= 0 && parserEnd > parserStart);
  vm.runInContext(mainScript.slice(parserStart, parserEnd), context);
  vm.runInContext(hostFunction("parseTechnicalRequirement"), context);
  vm.runInContext(hostFunction("ocrRequirementRecord"), context);
  return context;
}

test('Deletion asks about renumbering; keep fills holes, compact and deletion share one undo snapshot',async()=>{
  for(const choice of ['keep','compact',null]){
    const c=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-numbering.js'),'utf8'),c);
    c.state.annotations=[{id:'a',number:'1'},{id:'b',number:'2'},{id:'c',number:'3'}];c.state.selectedId='b';c.state.archivedAnnotations=[];
    const original=JSON.stringify(c.state.annotations);let checkpoints=0,asked=0,history;
    c.selectedAnnotation=()=>c.state.annotations.find(r=>r.id===c.state.selectedId);c.confirmAction=async()=>true;
    c.window.ASMachBalloonNumbering.afterDelete=async()=>{asked++;return choice;};
    c.checkpoint=()=>{checkpoints++;history=JSON.stringify(c.state.annotations);};c.recordChange=()=>{};c.renderAll=()=>{};c.toast=()=>{};
    vm.runInContext(hostFunction('deleteSelected'),c);vm.runInContext(hostFunction('nextBalloonNumber'),c);await c.deleteSelected();
    assert.equal(asked,1);
    if(choice===null){assert.equal(checkpoints,0);assert.equal(JSON.stringify(c.state.annotations),original);continue;}
    assert.equal(checkpoints,1);assert.equal(history,original);assert.equal(c.state.archivedAnnotations[0].number,'2');
    assert.equal(c.state.annotations[1].id,'c');assert.equal(c.state.annotations[1].number,choice==='keep'?'3':'2');assert.equal(c.nextBalloonNumber(),choice==='keep'?'2':'3');
  }
});

test('Inspector rename is one undoable transaction and cancelled conflicts do not mutate anything',async()=>{
  const c=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-numbering.js'),'utf8'),c);
  c.state.annotations=[{id:'a',number:'1'},{id:'b',number:'2'}];let checkpoints=0;
  c.checkpoint=()=>checkpoints++;c.recordChange=()=>{};c.renderAll=()=>{};c.toast=()=>{};
  vm.runInContext(hostFunction('changeBalloonNumber'),c);
  c.window.ASMachBalloonNumbering.resolve=async()=>null;assert.equal(await c.changeBalloonNumber('a','2'),false);assert.equal(checkpoints,0);
  c.window.ASMachBalloonNumbering.resolve=async(state,id,value)=>c.window.ASMachBalloonNumbering.plan(state.annotations,id,value,'swap');
  assert.equal(await c.changeBalloonNumber('a','2'),true);assert.equal(checkpoints,1);assert.equal(c.state.annotations[1].number,'1');
});

test('Bulk deletion captures selected IDs across pages, archives them once and restores all data with one undo',async()=>{
  const c=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-numbering.js'),'utf8'),c);
  c.state.annotations=[{id:'a',number:'1',page:1},{id:'b',number:'2',page:2},{id:'c',number:'3',page:1},{id:'d',number:'4',page:2}];
  c.state.archivedAnnotations=[];c.state.selectedId='d';let ids=['a','b'],history,checkpoints=0,prompt;
  c.window.ASMachCharacteristicUI={selectionIds:()=>ids,selectIds:next=>ids=next};
  c.selectedAnnotation=()=>c.state.annotations.find(r=>r.id===c.state.selectedId);
  c.confirmAction=async(title,message)=>{prompt={title,message};ids=['d'];return true;};
  c.window.ASMachBalloonNumbering.afterDelete=async()=>'keep';
  c.checkpoint=()=>{checkpoints++;history=JSON.stringify({annotations:c.state.annotations,archivedAnnotations:c.state.archivedAnnotations});};c.recordChange=()=>{};c.renderAll=()=>{};c.toast=()=>{};
  vm.runInContext(hostFunction('deleteSelected'),c);await c.deleteSelected();
  assert.match(prompt.title,/2 balon/);assert.match(prompt.message,/#1, #2/);assert.match(prompt.message,/filtre dışında/);
  assert.equal(c.state.annotations.map(r=>r.id).join(','),'c,d','Changing selection while confirming never changes captured targets');
  assert.equal(c.state.archivedAnnotations.map(r=>r.id).join(','),'a,b');assert.equal(checkpoints,1);assert.equal(ids.length,0);
  Object.assign(c.state,JSON.parse(history));assert.equal(c.state.annotations.length,4);assert.equal(c.state.archivedAnnotations.length,0);
  c.window.ASMachBalloonNumbering.afterDelete=async()=>'compact';ids=['a','b'];await c.deleteSelected();assert.equal(c.state.annotations.map(r=>r.number).join(','),'1,2');assert.equal(checkpoints,2);
});

test('Bulk delete cancellation/stale state are no-ops; deleting all skips renumber; explicit single edit never deletes bulk selection',async()=>{
  for(const mode of ['cancel','cancel-renumber','stale','all','single']){
    const c=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-numbering.js'),'utf8'),c);
    c.state.annotations=[{id:'a',number:'1'},{id:'b',number:'2'},{id:'c',number:'3'}];c.state.archivedAnnotations=[];
    const original=JSON.stringify(c.state.annotations);let checkpoints=0,asked=0;
    c.window.ASMachCharacteristicUI={selectionIds:()=>mode==='all'?['a','b','c']:['a','b'],selectIds(){}};
    c.selectedAnnotation=()=>null;c.confirmAction=async()=>mode!=='cancel';c.recordChange=()=>{};c.renderAll=()=>{};c.toast=()=>{};c.checkpoint=()=>checkpoints++;
    c.window.ASMachBalloonNumbering.afterDelete=async()=>{asked++;if(mode==='stale')c.state.annotations=JSON.parse(original);return mode==='cancel-renumber'?null:'keep';};
    vm.runInContext(hostFunction('deleteSelected'),c);await c.deleteSelected(mode==='single'?['c']:null);
    if(['cancel','cancel-renumber','stale'].includes(mode)){assert.equal(checkpoints,0);assert.equal(JSON.stringify(c.state.annotations),original);assert.equal(c.state.archivedAnnotations.length,0);}
    if(mode==='all'){assert.equal(asked,0);assert.equal(checkpoints,1);assert.equal(c.state.annotations.length,0);}
    if(mode==='single'){assert.equal(c.state.annotations.map(r=>r.id).join(','),'a,b');assert.equal(c.state.archivedAnnotations[0].id,'c');}
  }
});

test('Fit recognition fills OCR review, excludes general tolerances, and persists with characteristic limits',()=>{
  const context=hostContext(),nodes={};
  for(const id of ['ocrAngleReferenceField','ocrGdtField','ocrGdtSubtype','ocrGdtFrame','ocrGdtHint','ocrFitField','ocrFitSummary'])nodes['#'+id]={style:{},value:'',replaceChildren(...items){this.children=items;}};
  context.document={querySelector:id=>nodes[id],createElement:()=>({})};context.Option=function(label,value){this.textContent=label;this.value=value;};
  context.elements={};
  for(const id of ['ocrGeneralTolerance','ocrCharacteristicType','ocrUnit','ocrNominal','ocrLowerTolerance','ocrUpperTolerance','ocrEvaluationMethod','ocrRecognizedText','ocrStatusText'])context.elements[id]={value:''};
  context.elements.ocrRecognizedText.value='Ø5 0 d 6';context.elements.ocrGeneralTolerance.value='ISO 2768-mK';
  for(const name of ['renderOcrGdtFields','updateOcrRequirement','applyParsedOcrFields'])vm.runInContext(hostFunction(name),context);
  const parsed=context.parseTechnicalRequirement('Ø5 0 d 6','ISO 2768-mK');
  context.applyParsedOcrFields(parsed,'PDF metin katmanı');
  assert.equal(context.elements.ocrNominal.value,'50');assert.equal(context.elements.ocrLowerTolerance.value,'-0.096');
  assert.equal(context.elements.ocrUpperTolerance.value,'-0.08');assert.equal(context.elements.ocrGeneralTolerance.disabled,true);
  assert.match(nodes['#ocrFitSummary'].textContent,/d6.*Mil.*49.904.*49.92/);
  const record=context.normalizeAnnotation(JSON.parse(JSON.stringify({...parsed,id:'fit',number:'8',page:1,requirement:'Ø50 d6'})));
  assert.equal(record.fitClass,'d6');assert.equal(record.nominalValue,'50');assert.equal(record.lowerLimit,'49.904');assert.equal(record.upperLimit,'49.92');
});

test('OCR generated requirement preview keeps manual draft separate and project normalization retains the selected mode',()=>{
  const context=hostContext(),nodes={};
  for(const id of ['ocrRequirement','ocrRequirementHint'])nodes['#'+id]={value:'',textContent:''};
  context.document={querySelector:id=>nodes[id]};
  context.elements={ocrCharacteristicType:{value:'Çap'},ocrNominal:{value:'50'},ocrLowerTolerance:{value:'-0.096'},ocrUpperTolerance:{value:'-0.08'},ocrUnit:{value:'mm'},ocrRecognizedText:{value:'Ø5 0 d6'}};
  const parsed=context.parseTechnicalRequirement('Ø50 d6');
  context.state.pendingRecognition={requirementParsed:parsed,requirementDraft:'Ø5 0 d6'};
  for(const name of ['updateOcrRequirement','recalculateAnnotationLimits'])vm.runInContext(hostFunction(name),context);
  context.updateOcrRequirement();assert.equal(nodes['#ocrRequirement'].value,'Ø50 d6 (-0.08/-0.096)');
  Object.assign(context.state.pendingRecognition,{requirementMode:'manual',requirementDraft:'Müşteri kabul notu'});
  context.elements.ocrNominal.value='55';context.updateOcrRequirement();assert.equal(nodes['#ocrRequirement'].value,'Müşteri kabul notu');
  context.updateOcrRequirement(true);assert.equal(nodes['#ocrRequirement'].value,'Ø55 d6 (-0.08/-0.096)');
  const raw={...parsed,requirement:nodes['#ocrRequirement'].value,ocrText:'Ø5 0 d6',requirementMode:'auto',nominalValue:'55'};
  const loaded=context.normalizeAnnotation(JSON.parse(JSON.stringify(raw)));assert.equal(loaded.requirement,raw.requirement);assert.equal(loaded.ocrText,raw.ocrText);
  const manual=context.normalizeAnnotation({...loaded,requirementMode:'manual',requirement:'Özel kabul notu',nominalValue:'60'});
  assert.equal(manual.requirement,'Özel kabul notu');assert.equal(manual.nominalValue,'60');
});

test('GD&T manual subtype and frame survive host normalization and project roundtrip',()=>{
  const context=hostContext(),api=context.window.ASMachRequirements;
  const parsed=context.parseTechnicalRequirement('Paralellik | Ø1.38 | E | A | C | G','ISO 2768-mK');
  assert.equal(parsed.type,'GD&T');assert.equal(parsed.gdtSubtype,'parallelism');
  assert.equal(parsed.nominalValue,'');assert.equal(parsed.upperTolerance,'1.38');
  const input=api.withGdtSubtype({...parsed,id:'gdt',number:'7',page:1,requirement:'Paralellik | Ø1.38 | E | A | C | G',manualFields:['gdtSubtype','type'],snapshot:'data:image/png;base64,test'},'total_runout');
  const saved=context.normalizeAnnotation(JSON.parse(JSON.stringify(context.normalizeAnnotation(input))));
  assert.equal(saved.gdtSubtype,'total_runout');assert.equal(saved.gdtFrame.symbol,'⌰');
  assert.equal(saved.gdtFrame.cells.join('|'),'⌰|Ø1.38|E|A|C|G');
  assert.ok(saved.manualFields.includes('gdtSubtype'));assert.equal(saved.snapshot,input.snapshot);
});

test('OCR subtype override is shown in preview and used by confirmation without overwriting manual tolerance inputs',()=>{
  const context=hostContext();
  const nodes={};
  for(const id of ['ocrReferenceLength','ocrGdtField','ocrGdtSubtype','ocrGdtFrame','ocrGdtHint'])nodes['#'+id]={value:'',style:{},replaceChildren(...items){this.children=items;}};
  context.document={querySelector:id=>nodes[id],createElement:()=>({})};
  context.Option=function(label,value){this.textContent=label;this.value=value;};
  context.elements={ocrRecognizedText:{value:'0.2 A'},ocrGeneralTolerance:{value:'ISO 2768-mK'},ocrUpperTolerance:{value:'0.4'}};
  context.state.pendingRecognition={forcedGdtSubtype:'concentricity'};
  for(const name of ['parseOcrRequirement','renderOcrGdtFields'])vm.runInContext(hostFunction(name),context);
  const parsed=context.parseOcrRequirement();context.renderOcrGdtFields(parsed);
  assert.equal(parsed.gdtSubtype,'concentricity');assert.equal(parsed.gdtFrame.symbol,'◎');
  assert.equal(nodes['#ocrGdtSubtype'].value,'concentricity');
  assert.equal(nodes['#ocrGdtField'].style.display,'');
  assert.equal(nodes['#ocrGdtFrame'].children[0].textContent,'◎');
  assert.equal(context.elements.ocrUpperTolerance.value,'0.4');
  assert.ok(!parsed.parseWarnings.some(w=>w.includes('sembol okunamadı')));
});

test('Frequency and note characteristic survive a project normalization roundtrip',()=>{
  const context=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/inspection-plan.js'),'utf8'),context);
  const record=context.normalizeAnnotation({type:'Not',requirement:'Not 3: Sertifika',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10',frequencyNote:'Her partiden',autoParse:false});
  const restored=context.normalizeAnnotation(JSON.parse(JSON.stringify(record)));
  assert.equal(restored.inspectionFrequency,'EVERY_N_PIECES');assert.equal(restored.frequencyInterval,'10');assert.equal(restored.frequencyNote,'Her partiden');assert.equal(restored.type,'Not');assert.equal(restored.evaluationMethod,'OK_NOT_OK');assert.equal(restored.autoParse,false);
  assert.equal(restored.unit,'','Notes must not acquire millimetres after reopening a project');
});

test('OCR datum columns reflect parsed references; manual corrections survive parsing and project roundtrip',()=>{
  const context=hostContext(),nodes={};
  for(const id of ['ocrReferenceLength','ocrGdtField','ocrGdtSubtype','ocrGdtFrame','ocrGdtHint','ocrDatum1','ocrDatum2','ocrDatum3'])nodes['#'+id]={value:'',style:{},replaceChildren(...items){this.children=items;}};
  context.document={querySelector:id=>nodes[id],createElement:()=>({})};context.Option=function(label,value){this.textContent=label;this.value=value;};
  context.elements={ocrRecognizedText:{value:'◎ | 0.1 | A | B | C'},ocrGeneralTolerance:{value:''}};context.state.pendingRecognition={};
  for(const name of ['parseOcrRequirement','renderOcrGdtFields'])vm.runInContext(hostFunction(name),context);
  context.renderOcrGdtFields(context.parseOcrRequirement());assert.equal(nodes['#ocrDatum1'].value,'A');assert.equal(nodes['#ocrDatum3'].value,'C');
  context.state.pendingRecognition.forcedDatumRefs='D | E | F';const parsed=context.parseOcrRequirement();context.renderOcrGdtFields(parsed);assert.equal(parsed.datumRefs,'D | E | F');assert.equal(nodes['#ocrDatum2'].value,'E');
  assert.equal(context.elements.ocrRecognizedText.value,'◎ | 0.1 | A | B | C');
  const saved=context.normalizeAnnotation(JSON.parse(JSON.stringify({...parsed,manualFields:['datumRefs']})));assert.equal(saved.datumRefs,'D | E | F');assert.equal(saved.gdtFrame.cells.slice(-3).join('|'),'D|E|F');
});

test('Smart preview and final balloon placement use the same page-space plan',()=>{
  const context=hostContext();vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-placement.js'),'utf8'),context);
  context.window.ASMachBalloonPlacement.inkSampler=()=>x=>x>430?.8:0;
  context.elements={sourceCanvas:{width:1000,height:700}};context.state.annotations=[{id:'existing',page:1,bubbleX:.473,bubbleY:.3,size:46}];
  for(const name of ['positionBoxAnchor','planBoxBalloon','placeBalloonBesideBox'])vm.runInContext(hostFunction(name),context);
  const item={id:'new',page:1,size:46,shape:'circle',selectionBox:{x:.3,y:.25,w:.15,h:.1}};
  const planned=context.planBoxBalloon(item,'auto',8);assert.ok(planned);assert.ok(context.placeBalloonBesideBox(item,'auto',8));
  assert.equal(item.bubbleX,planned.x/1000);assert.equal(item.bubbleY,planned.y/700);
  assert.ok(Math.hypot(item.bubbleX*1000-473,item.bubbleY*700-210)>50);
  assert.ok(Math.abs(Math.hypot((item.bubbleX-item.anchorX)*1000,(item.bubbleY-item.anchorY)*700)-31)<1e-6);
});

test('Inline review saves method, interval, structured extras and dragged balloon without opening a second dialog',()=>{
  const c=hostContext(),nodes={};
  for(const id of ['ocrInspectionMethod','ocrFrequency','ocrFrequencyInterval','ocrFrequencyNote','ocrReferenceLength','ocrBalloonSide','ocrBalloonGap','boxBalloonPlacement','boxBalloonSize','boxBalloonFont','boxArrowEnabled','boxArrowStyle'])nodes[id]={value:''};
  Object.assign(nodes.ocrInspectionMethod,{value:'KUMPAS'});nodes.ocrFrequency.value='EVERY_N_PIECES';nodes.ocrFrequencyInterval.value='10';nodes.ocrBalloonSide.value='drag';nodes.ocrBalloonGap.value='8';nodes.boxArrowEnabled.value='inherit';nodes.boxArrowStyle.value='inherit';
  c.document={querySelector:s=>nodes[s.slice(1)],getElementById:id=>nodes[id]};
  for(const file of ['inspection-plan','ocr-review-controls','balloon-placement'])vm.runInContext(fs.readFileSync(path.join(root,'src/'+file+'.js'),'utf8'),c);
  c.elements={sourceCanvas:{width:1000,height:700},ocrReviewModal:{classList:{remove(){}}},methodModal:{classList:{remove(){},add(){throw Error('Second modal must not open');}}}};
  for(const [id,value] of Object.entries({ocrRecognizedText:'M6 × 1-6H',ocrGeneralTolerance:'',ocrCharacteristicType:'Diş',ocrNominal:'6',ocrLowerTolerance:'',ocrUpperTolerance:'',ocrUnit:'mm',ocrEvaluationMethod:'OK_NOT_OK'}))c.elements[id]={value};
  Object.assign(c,{nextBalloonNumber:()=>7,toast(){},renderOverlay(){},renderAll(){},checkpoint(){},recordChange(){},renderMethodChoices(){throw Error('Extra method step');}});
  c.state.annotations=[];c.state.currentPage=1;const points=[{x:.3,y:.3},{x:.5,y:.3},{x:.5,y:.4},{x:.3,y:.4}];
  c.state.pendingRecognition={box:{x:.3,y:.3,w:.2,h:.1,points},requirementDraft:'M6 × 2-6H',requirementMode:'auto',snapshot:'source',structuredEdits:{threadPitch:'2'},reviewBalloonPosition:{x:.56,y:.34}};
  for(const name of ['parseOcrRequirement','confirmOcrReview','completePendingBalloon','planBoxBalloon','positionBoxAnchor','recalculateAnnotationLimits'])vm.runInContext(hostFunction(name),c);
  const planned=c.planBoxBalloon({...c.methodStyle('KUMPAS'),selectionBox:c.state.pendingRecognition.box,reviewBalloonPosition:c.state.pendingRecognition.reviewBalloonPosition});
  c.confirmOcrReview();assert.equal(c.state.annotations.length,1);const saved=c.state.annotations[0];assert.equal(saved.inspectionMethod,'KUMPAS');assert.equal(saved.inspectionFrequency,'EVERY_N_PIECES');assert.equal(saved.frequencyInterval,'10');assert.equal(saved.threadPitch,'2');assert.ok(saved.manualFields.includes('threadPitch'));assert.equal(saved.bubbleX,planned.x/1000);assert.equal(saved.bubbleY,planned.y/700);assert.equal(c.state.pendingRecognition,null);
  const loaded=c.normalizeAnnotation(JSON.parse(JSON.stringify(saved)));assert.equal(loaded.frequencyInterval,'10');assert.equal(loaded.bubbleX,saved.bubbleX);
});

test('Invalid inline frequency leaves review and snapshot editor open without losing the draft',()=>{
  const c=hostContext();let disposed=false,message='';c.state.pendingRecognition={box:{},requirementDraft:'Keep me'};c.state.snapshotEditor={dispose(){disposed=true;}};
  c.document={querySelector:()=>({value:'KUMPAS'})};c.window.ASMachOcrReviewControls={frequency:()=>({inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'0'})};
  vm.runInContext(fs.readFileSync(path.join(root,'src/inspection-plan.js'),'utf8'),c);c.toast=m=>message=m;vm.runInContext(hostFunction('confirmOcrReview'),c);c.confirmOcrReview();assert.match(message,/tam sayı/);assert.equal(disposed,false);assert.equal(c.state.pendingRecognition.requirementDraft,'Keep me');
});

test('Automatic area selection reuses drawing drag without starting OCR and Escape cancels safely',async()=>{
  const c=hostContext();let ocr=0;c.state.fileData='pdf';c.state.currentPage=1;c.state.mode='select';c.renderAll=()=>{};c.toast=()=>{};c.renderOverlay=()=>{};c.finishBoxRecognition=()=>ocr++;
  c.elements={overlay:{hasPointerCapture:()=>false}};c.normalizedPointer=()=>({x:.7,y:.6});c.normalizeRecognitionBox=d=>({x:d.startX,y:d.startY,w:d.endX-d.startX,h:d.endY-d.startY});
  for(const name of ['selectScanArea','setMode','overlayPointerUp'])vm.runInContext(hostFunction(name),c);
  const selection=c.selectScanArea();assert.equal(c.state.mode,'box');c.state.boxDrag={pointerId:1,startX:.1,startY:.1};c.overlayPointerUp({pointerId:1});const chosen=await selection;assert.equal(chosen.page,1);assert.ok(Math.abs(chosen.box.h-.5)<1e-8);assert.equal(c.state.mode,'select');assert.equal(ocr,0);
  const cancelled=c.selectScanArea();c.setMode('select');assert.equal(await cancelled,null);assert.equal(c.state.autoScanRequest,null);assert.equal(ocr,0);
});

test('Right mouse cannot add, crop, move or place; context menu opens only the targeted balloon editor',async()=>{
  const c=hostContext();let opened=0,details=0,prevented=0;const boxItem={id:'boxed',selectionBox:{x:.2,y:.2,w:.2,h:.1}},plain={id:'plain'};
  Object.assign(c,{renderAll(){},finishBoxRecognition:async(box,item)=>{assert.equal(item.id,'boxed');opened++;}});c.window.ASMachCharacteristicUI={openEditor:id=>{assert.equal(id,'plain');details++;}};
  c.state.fileData='pdf';c.state.annotations=[boxItem,plain];
  for(const name of ['overlayPointerDown','overlayContextMenu'])vm.runInContext(hostFunction(name),c);
  for(const mode of ['add','box','select']){c.state.mode=mode;const before=JSON.stringify(c.state);c.overlayPointerDown({button:2});assert.equal(JSON.stringify(c.state),before);}
  c.state.pendingPlacement={id:'pending'};c.overlayPointerDown({button:2});assert.equal(c.state.pendingPlacement.id,'pending');c.state.pendingPlacement=null;
  const menu=id=>({preventDefault(){prevented++;},stopPropagation(){},target:{closest:()=>id?{dataset:{id}}:null}});
  await c.overlayContextMenu(menu(null));assert.equal(opened,0);await c.overlayContextMenu(menu('boxed'));assert.equal(opened,1);assert.equal(c.state.selectedId,'boxed');await c.overlayContextMenu(menu('plain'));assert.equal(details,1);assert.equal(prevented,3);assert.equal(c.state.annotations.length,2);
});

test('Multi-selection right-click preserves selected IDs and opens bulk controls, while other balloons still open singly',async()=>{
  const c=hostContext();let ids=['a','b'],bulk=[],single=[];c.state.fileData='pdf';c.state.annotations=[{id:'a'},{id:'b'},{id:'c'}];c.renderAll=()=>{};
  c.window.ASMachCharacteristicUI={selectionIds:()=>ids,selectIds:v=>ids=v,openEditor:id=>single.push(id)};c.window.ASMachBulkPlan={open:values=>bulk.push([...values])};vm.runInContext(hostFunction('overlayContextMenu'),c);
  const event=id=>({preventDefault(){},stopPropagation(){},target:{closest:()=>id?{dataset:{id}}:null}});
  await c.overlayContextMenu(event('b'));assert.deepEqual(ids,['a','b']);assert.deepEqual(bulk,[['a','b']]);assert.equal(single.length,0);
  await c.overlayContextMenu(event(null));assert.equal(bulk.length,2);await c.overlayContextMenu(event('c'));assert.deepEqual(single,['c']);assert.equal(ids.length,0);
});

test('Canvas drag selects only enclosed current-page balloons; Ctrl click toggles without moving them',()=>{
  const c=hostContext();let ids=[];c.state.fileData='pdf';c.state.mode='select';c.state.currentPage=1;c.state.annotations=[{id:'a',page:1,bubbleX:.2,bubbleY:.2},{id:'b',page:1,bubbleX:.3,bubbleY:.3},{id:'off',page:2,bubbleX:.2,bubbleY:.2}];
  c.renderAll=()=>{};c.renderOverlay=()=>{};c.normalizedPointer=e=>e.point;c.elements={overlay:{setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}}};
  c.window.ASMachCharacteristicUI={selectionIds:()=>ids,selectIds:(values,mode)=>{if(mode==='toggle')ids=ids.includes(values[0])?ids.filter(id=>id!==values[0]):[...ids,...values];else ids=mode==='add'?[...new Set([...ids,...values])]:[...values];return ids;}};
  for(const name of ['overlayPointerDown','overlayPointerMove','overlayPointerUp','overlayPointerCancel'])vm.runInContext(hostFunction(name),c);
  const before=JSON.stringify(c.state.annotations),e={button:0,pointerId:1,point:{x:.1,y:.1},preventDefault(){},target:{closest:()=>null}};c.overlayPointerDown(e);c.overlayPointerMove({...e,point:{x:.4,y:.4}});c.overlayPointerUp({...e,point:{x:.4,y:.4}});assert.deepEqual(ids,['a','b']);assert.equal(c.state.bulkDrag,null);
  c.overlayPointerDown({...e,ctrlKey:true,target:{closest:s=>s==='.balloon-group'?{dataset:{id:'a'}}:null,dataset:{role:'bubble'}}});assert.deepEqual(ids,['b']);assert.equal(JSON.stringify(c.state.annotations),before);assert.ok(!c.state.drag);
  c.overlayPointerDown(e);c.overlayPointerCancel(e);assert.equal(c.state.bulkDrag,null);assert.deepEqual(ids,['b']);
});

test('Editing review reopens saved rotated crop and values without OCR, and cancel leaves the original untouched',async()=>{
  const c=hostContext(),nodes={};c.Option=function(label,value){this.label=label;this.value=value;};c.document={createElement:()=>({}),querySelector:s=>nodes[s]||(nodes[s]={value:'',options:[],add(option){this.options.push(option);},append(option){this.options.push(option);},focus(){},removeAttribute(){}})};
  const original=c.normalizeAnnotation({id:'keep',number:'11',type:'Yarıçap',ocrText:'R35',nominalValue:'35',lowerTolerance:'-0.3',upperTolerance:'0.3',requirement:'Elle düzeltilmiş not',requirementMode:'manual',inspectionMethod:'CMM',inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'10',size:32,fontSize:13,selectionBox:{x:.3,y:.3,w:.1,h:.2,points:[{x:.3,y:.3},{x:.4,y:.35},{x:.38,y:.45},{x:.28,y:.4}]},snapshot:'original-crop',bubbleX:.24,bubbleY:.36});
  const before=JSON.stringify(original);c.state.annotations=[original];c.state.currentPage=1;c.state.textBoxes=[];let detected,parsed,initial,ocrCalls=0;
  c.elements={sourceCanvas:{width:1000,height:600},ocrGeneralTolerance:{value:''},ocrSnapshotImage:{},ocrRecognizedText:{value:''},ocrRetryButton:{},ocrReviewConfirmButton:{},ocrReviewModal:{classList:{add(){},remove(){}}}};
  Object.assign(c,{normalizeRecognitionBox:b=>b,showBusy(){},hideBusy(){},captureRecognitionSnapshot:async()=> 'padded-original',loadImage:async()=>({width:600,height:400}),recognizeSnapshotAutomatically:()=>{ocrCalls++;throw Error('Must not rerun OCR');},detectGeneralToleranceStandard:()=>'',selectedAnnotation:()=>original,applyParsedOcrFields:p=>parsed=p,renderOverlay(){},toast(){}});
  c.window.ASMachOcrReviewControls={start:opts=>initial=opts.initial};vm.runInContext(fs.readFileSync(path.join(root,'src/balloon-placement.js'),'utf8'),c);c.window.ASMachBalloonPlacement={...c.window.ASMachBalloonPlacement,inkSampler:()=>null};
  c.window.ASMachSnapshots={_test:{corners:r=>{const a=r.angle*Math.PI/180;return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:r.cx+x*r.w/2*Math.cos(a)-y*r.h/2*Math.sin(a),y:r.cy+x*r.w/2*Math.sin(a)+y*r.h/2*Math.cos(a)}));}},mount:(container,image,save,error,opts)=>{detected=opts.detected;return{dispose(){},refresh(){}};}};
  for(const name of ['snapshotSourceBox','mapSnapshotSelection','savedReviewSelection','finishBoxRecognition','cancelOcrReview','parseOcrRequirement'])vm.runInContext(hostFunction(name),c);
  await c.finishBoxRecognition(original.selectionBox,original);assert.equal(ocrCalls,0);assert.ok(Math.abs(detected.rect.angle)>1);assert.equal(parsed.requirement,'Elle düzeltilmiş not');assert.equal(initial.frequencyInterval,'10');assert.equal(c.state.pendingRecognition.editingId,'keep');assert.equal(c.elements.ocrReviewConfirmButton.textContent,'Değişiklikleri kaydet');assert.equal(JSON.stringify(original),before);
  assert.equal(c.parseOcrRequirement().lowerTolerance,'-0.3','Saved deviations must not be lost by reparsing the raw R35 text');
  c.state.pendingRecognition.requirementDraft='Changed but cancelled';c.cancelOcrReview();assert.equal(JSON.stringify(original),before);assert.equal(c.state.annotations.length,1);
  let onSave,scheduled=0,closed=0;
  c.elements.ocrStatusText={textContent:''};c.scheduleReviewRecognition=()=>scheduled++;
  c.window.ASMachSnapshots.mount=(container,image,save)=>{onSave=save;return{dispose(){},refresh(){}};};
  await c.finishBoxRecognition(original.selectionBox,original,{onApply(){throw Error('Cancel cannot apply');},onClose(){closed++;}});
  assert.match(c.elements.ocrReviewConfirmButton.textContent,/Adayı güncelle/);assert.equal(scheduled,0,'Opening never overwrites previous manual corrections');
  const selection={points:[{x:.2,y:.2},{x:.7,y:.2},{x:.7,y:.5},{x:.2,y:.5}],angle:0};
  onSave('crop',selection);onSave('same-crop',selection);assert.equal(scheduled,0,'Initial decode and repeated commit are not geometry edits');
  onSave('changed-crop',{...selection,points:selection.points.map(p=>({x:p.x+.01,y:p.y}))});assert.equal(scheduled,1);
  c.cancelOcrReview();assert.equal(closed,1);assert.equal(JSON.stringify(original),before);
  // Reselection must use the normal fresh OCR path, not reopen cached R35 fields.
  c.recognizeTextBoxes=()=>'';c.isReliableTechnicalText=()=>false;c.setBusyDetail=()=>{};
  c.recognizeSnapshotAutomatically=async image=>{ocrCalls++;assert.equal(image,'fresh-measurement');return{text:'Ø20 (+0.02/-0.05)',source:'OCR',confidence:96};};
  c.recoverDiameterPrefix=text=>text;c.ocrCandidateScore=()=>100;
  c.window.ASMachAutoSelection={inspect:async()=>({rect:{cx:100,cy:100,w:80,h:25,angle:-90},sourceWidth:600,sourceHeight:400,snapshot:'fresh-measurement',confident:true})};
  await c.finishBoxRecognition({x:.5,y:.3,w:.03,h:.1},original,{onApply(){},onClose(){},recognizeFresh:true});
  assert.equal(ocrCalls,1);assert.equal(parsed.type,'Çap');assert.equal(parsed.nominalValue,'20');assert.equal(Number(parsed.lowerTolerance),-.05);assert.equal(Number(parsed.upperTolerance),.02);assert.equal(c.state.pendingRecognition.forcedType,undefined);assert.equal(c.state.pendingRecognition.sourceReparsed,true);assert.equal(c.parseOcrRequirement().nominalValue,'20');assert.equal(initial.frequencyInterval,'10');
  const freshFields=JSON.stringify(parsed);c.cancelOcrReview();
  await c.finishBoxRecognition({x:.5,y:.3,w:.03,h:.1});assert.equal(ocrCalls,2);assert.equal(JSON.stringify(parsed),freshFields,'Manual box OCR and candidate reselect return identical measurement fields');c.cancelOcrReview();assert.equal(JSON.stringify(original),before);
  c.loadImage=async()=>{throw Error('The source image cannot be decoded.');};
  await assert.rejects(()=>c.finishBoxRecognition({x:.5,y:.3,w:.03,h:.1},original,{recognizeFresh:true}),/cannot be decoded/);
  assert.equal(c.state.pendingRecognition,null,'Do not open an empty replacement form after source failure');assert.equal(JSON.stringify(original),before);
});

test('Automatic candidate reselect chooses a new drawing box before opening full fresh OCR; cancel and document switch are safe',async()=>{
  const c=hostContext();c.state.fileData='pdf';c.state.currentPage=1;let options,opened,closed=0;
  c.changePage=async page=>c.state.currentPage=page;c.selectScanArea=async opts=>{options=opts;return{page:2,box:{x:.3,y:.4,w:.1,h:.05}};};
  c.finishBoxRecognition=async(box,item,review)=>opened={box,item,review};vm.runInContext(hostFunction('editAutomaticCandidate'),c);
  const item={page:2,type:'Yarıçap',nominalValue:'0',selectionBox:{x:.1,y:.1,w:.01,h:.01}},apply=()=>{};
  await c.editAutomaticCandidate(item,apply,()=>closed++);assert.equal(c.state.currentPage,2);assert.equal(opened.box.x,.3);assert.equal(opened.review.recognizeFresh,true);assert.equal(opened.review.onApply,apply);assert.match(options.label,/toleransları/);assert.equal(c.state.candidateOpening,false);assert.equal(item.selectionBox.x,.1);
  opened=null;c.selectScanArea=async()=>null;await c.editAutomaticCandidate(item,apply,()=>closed++);assert.equal(closed,1);assert.equal(opened,null);
  c.selectScanArea=async()=>{c.state.fileData='other';return{page:1,box:item.selectionBox};};await assert.rejects(()=>c.editAutomaticCandidate(item,apply),/Belge değişti/);assert.equal(opened,null);assert.equal(c.state.candidateOpening,false);
  c.selectScanArea=()=>{throw Error('Preview selection must not return to the drawing');};
  await c.editAutomaticCandidate(item,apply,()=>{}, {page:2,box:{x:.4,y:.3,w:.1,h:.1},isCurrent:()=>true});assert.equal(opened.box.x,.4);
  opened=null;await assert.rejects(()=>c.editAutomaticCandidate(item,apply,()=>{}, {page:2,box:item.selectionBox,isCurrent:()=>false}),/Belge değişti/);assert.equal(opened,null);
});

test('Recognition box normalization is idempotent for preview rectangles and rejects NaN instead of making undecodable images',()=>{
  const c=hostContext();c.elements={sourceCanvas:{width:1000,height:700}};vm.runInContext(hostFunction('normalizeRecognitionBox'),c);
  const box=c.normalizeRecognitionBox({startX:.6,startY:.5,endX:.2,endY:.2});assert.ok(box);const again=c.normalizeRecognitionBox(box);assert.equal(JSON.stringify(again),JSON.stringify(box));
  for(const invalid of [{},{x:NaN,y:.2,w:.1,h:.1},{x:.2,y:.2,w:0,h:.1},{x:.2,y:.2,w:-.1,h:.1},{startX:Infinity,startY:0,endX:.5,endY:.5}])assert.equal(c.normalizeRecognitionBox(invalid),null);
});

test('Candidate OCR rereads deviations and clears stale datum/structured fields; late result after cancel is ignored',async()=>{
  const c=hostContext(),nodes={};let resolve;
  c.document={querySelector:s=>nodes[s]||(nodes[s]={value:'',focus(){}})};
  c.elements={ocrRetryButton:{},ocrReviewConfirmButton:{},ocrStatusText:{},ocrRecognizedText:{value:'old'},ocrGeneralTolerance:{value:''},ocrReviewModal:{classList:{remove(){}}}};
  c.state.pendingRecognition={snapshot:'new-crop',box:{},forcedType:'Çap',forcedDatumRefs:'A B C',structuredEdits:{nominalValue:'0'}};
  Object.assign(c,{showBusy(){},hideBusy(){},toast(){},renderOverlay(){},recoverDiameterPrefix:t=>t,errorMessage:e=>e.message,recognizeSnapshotAutomatically:()=>new Promise(r=>resolve=r)});
  c.updateOcrFieldsFromText=()=>{c.updated=c.parseOcrRequirement();};
  for(const name of ['retryOcrRecognition','parseOcrRequirement','cancelOcrReview'])vm.runInContext(hostFunction(name),c);
  const read=c.retryOcrRecognition();assert.equal(c.elements.ocrReviewConfirmButton.disabled,true);assert.equal(nodes['#ocrSnapshotEditor'].inert,true);
  resolve({text:'Ø24.5 ±0.0 5',source:'OCR',confidence:95});await read;
  assert.equal(c.updated.nominalValue,'24.5');assert.equal(Number(c.updated.lowerTolerance),-.05);assert.equal(Number(c.updated.upperTolerance),.05);assert.equal(c.state.pendingRecognition.forcedDatumRefs,undefined);assert.equal(c.elements.ocrReviewConfirmButton.disabled,false);
  const late=c.retryOcrRecognition();c.cancelOcrReview();const text=c.elements.ocrRecognizedText.value;
  resolve({text:'Ø99 ±1',source:'OCR',confidence:99});await late;assert.equal(c.elements.ocrRecognizedText.value,text);assert.equal(c.state.pendingRecognition,null);
});

test('Candidate confirmation returns a draft with tolerances, GD&T datums and frequency without adding an annotation',()=>{
  const c=hostContext(),nodes={};let result,closed=0,disposed=0;
  c.document={querySelector:s=>nodes[s]||(nodes[s]={value:''})};nodes['#ocrInspectionMethod']={value:'CMM'};nodes['#ocrBalloonGap']={value:'8'};
  c.elements={ocrReviewConfirmButton:{},ocrReviewModal:{classList:{remove(){}}}};
  for(const [key,value] of Object.entries({ocrRecognizedText:'◎ | 0.1 | A | B',ocrGeneralTolerance:'',ocrCharacteristicType:'GD&T',ocrNominal:'',ocrLowerTolerance:'0',ocrUpperTolerance:'0.1',ocrUnit:'mm',ocrEvaluationMethod:'VALUE'}))c.elements[key]={value};
  c.window.ASMachOcrReviewControls={frequency:()=>({inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'5'}),sanitize:r=>r};
  c.window.ASMachInspectionPlan={validate:()=>''};c.state.annotations=[];c.state.currentPage=1;c.state.snapshotEditor={commit(){},dispose(){disposed++;}};
  const parsed=c.parseTechnicalRequirement('◎ | 0.1 | A | B');
  c.state.pendingRecognition={...parsed,editingId:'draft-only',originalRecord:parsed,box:{x:.2,y:.3,w:.1,h:.02},snapshot:'crop',forcedGdtSubtype:parsed.gdtSubtype,forcedDatumRefs:'A B',requirementMode:'auto',candidateReview:{onApply:r=>result=r,onClose:()=>closed++}};
  Object.assign(c,{toast(){},renderOverlay(){},completePendingBalloon(){throw Error('Must not save');}});
  for(const name of ['parseOcrRequirement','confirmOcrReview','cancelOcrReview','recalculateAnnotationLimits'])vm.runInContext(hostFunction(name),c);
  c.confirmOcrReview();assert.equal(c.state.annotations.length,0);assert.equal(result.upperTolerance,'0.1');assert.equal(result.datumRefs,'A B');assert.equal(result.inspectionMethod,'CMM');assert.equal(result.frequencyInterval,'5');assert.equal(result.editingId,undefined);assert.equal(closed,1);assert.equal(disposed,1);assert.equal(c.state.pendingRecognition,null);
});

test('Automatic recognition is debounced and cancelled when the review closes',()=>{
  const c=hostContext();let run,cleared=0,reads=0;c.setTimeout=fn=>{run=fn;return 1;};c.clearTimeout=()=>cleared++;
  c.elements={ocrReviewConfirmButton:{},ocrStatusText:{},ocrReviewModal:{classList:{remove(){}}}};c.document={querySelector:()=>({})};c.renderOverlay=()=>{};c.retryOcrRecognition=()=>reads++;
  for(const name of ['scheduleReviewRecognition','cancelOcrReview'])vm.runInContext(hostFunction(name),c);
  const pending=c.state.pendingRecognition={};c.scheduleReviewRecognition(pending);c.scheduleReviewRecognition(pending);assert.equal(c.elements.ocrReviewConfirmButton.disabled,true);assert.equal(cleared,2);run();assert.equal(reads,1);
  c.scheduleReviewRecognition(pending);c.cancelOcrReview();run();assert.equal(reads,1);
});

test('Saving a balloon edit replaces the same identity and keeps custom appearance, metadata and undo history',()=>{
  const c=hostContext();for(const file of ['inspection-plan','balloon-placement','balloon-appearance'])vm.runInContext(fs.readFileSync(path.join(root,'src/'+file+'.js'),'utf8'),c);
  const original=c.normalizeAnnotation({id:'keep',number:'11',type:'Yarıçap',requirement:'R35',requirementMode:'manual',nominalValue:'35',inspectionMethod:'CMM',inspectionFrequency:'PER_LOT',size:32,fontSize:13,color:'#123456',arrowEnabled:false,boxLineWidth:3,zone:'D2',createdAt:'2026-01-01',selectionBox:{x:.3,y:.3,w:.1,h:.1},bubbleX:.25,bubbleY:.35});
  c.state.annotations=[original];const history=[];c.elements={sourceCanvas:{width:1000,height:600},methodModal:{classList:{remove(){}}}};c.document={querySelector:()=>({value:'auto'})};Object.assign(c,{checkpoint:()=>history.push(structuredClone(c.state.annotations)),renderAll(){},renderOverlay(){},recordChange(){},toast(){},nextBalloonNumber(){throw Error('Editing must not allocate a number');}});
  for(const name of ['completePendingBalloon','positionBoxAnchor','planBoxBalloon'])vm.runInContext(hostFunction(name),c);
  c.state.pendingAnchor={...original,editingId:original.id,reviewInline:true,reviewBalloonPosition:{x:.24,y:.32},inspectionFrequency:'EVERY_N_PIECES',frequencyInterval:'5',requirement:'Düzeltilmiş R35'};c.completePendingBalloon('CMM');
  assert.equal(c.state.annotations.length,1);const saved=c.state.annotations[0];for(const key of ['id','number','size','fontSize','color','arrowEnabled','boxLineWidth','createdAt','zone'])assert.equal(saved[key],original[key],key);assert.equal(saved.frequencyInterval,'5');assert.equal(saved.requirement,'Düzeltilmiş R35');assert.equal(history.length,1);assert.equal(history[0][0].requirement,'R35');
});

test("Box anchor intersects the nearest boundary and stays finite inside the box", () => {
  const context = hostContext();
  vm.runInContext(hostFunction("positionBoxAnchor"), context);
  const item = {selectionBox:{x:.2,y:.2,w:.2,h:.2},bubbleX:.8,bubbleY:.3};
  context.positionBoxAnchor(item);
  assert.ok(Math.abs(item.anchorX-.4)<1e-8);
  assert.ok(Math.abs(item.anchorY-.3)<1e-8);
  item.bubbleX=.3; item.bubbleY=.8; context.positionBoxAnchor(item);
  assert.ok(Math.abs(item.anchorY-.4)<1e-8);
  item.bubbleX=.3; item.bubbleY=.3; context.positionBoxAnchor(item);
  assert.ok(Number.isFinite(item.anchorX) && Number.isFinite(item.anchorY));
});

test("Box placement previews without saving, honors arrow override and commits on one click", () => {
  const context = hostContext();
  const controls = {boxArrowEnabled:"false",boxArrowStyle:"open",boxBalloonSize:"62",boxBalloonFont:"24",boxArrowAnchor:"edge",boxBalloonPlacement:"manual"};
  let checkpoints=0;
  Object.assign(context,{document:{querySelector:selector=>({value:controls[selector.slice(1)]})},
    elements:{sourceCanvas:{width:1000,height:1000},methodModal:{classList:{remove(){}}}},checkpoint:()=>checkpoints++,
    nextBalloonNumber:()=>"1",renderOverlay(){},renderAll(){},toast(){},recordChange(){},normalizedPointer:()=>({x:.7,y:.5})});
  context.state.annotations=[];context.state.fileData="fixture";
  for(const name of ["positionBoxAnchor","placeBalloonBesideBox","separateBoxBalloon","updatePendingPlacement","completePendingBalloon","overlayPointerDown"]) vm.runInContext(hostFunction(name),context);
  const method = vm.runInContext("inspectionMethods[0].value",context);
  context.state.pendingAnchor={anchorX:.3,anchorY:.3,bubbleX:.5,bubbleY:.1,page:1,selectionBox:{x:.2,y:.2,w:.2,h:.2}};
  context.completePendingBalloon(method);
  assert.equal(context.state.annotations.length,0); assert.equal(checkpoints,0);
  assert.equal(context.state.pendingPlacement.arrowEnabled,false);
  assert.equal(context.state.pendingPlacement.size,62);
  assert.equal(context.state.pendingPlacement.fontSize,24);
  context.overlayPointerDown({preventDefault(){}});
  assert.equal(context.state.annotations.length,1);assert.equal(checkpoints,1);
  assert.equal(context.state.pendingPlacement,null);
  assert.equal(context.state.annotations[0].bubbleX,.7);
  assert.equal(context.state.annotations[0].arrowEnabled,false);
  controls.boxBalloonPlacement='auto';
  context.state.pendingAnchor={page:1,selectionBox:{x:.2,y:.2,w:.2,h:.2},boxDirection:'left',boxGap:6};
  context.completePendingBalloon(method);
  assert.equal(context.state.annotations.length,2);assert.equal(checkpoints,2);
  assert.ok(Math.abs(context.state.annotations[1].bubbleX-(.2-(31+6)/1000))<1e-10);
  assert.equal(context.state.pendingPlacement,null);
});

test('Automatic box placement uses a short edge-to-edge leader in all four directions',()=>{
  const c=hostContext();c.elements={sourceCanvas:{width:1000,height:600}};
  for(const name of ['positionBoxAnchor','placeBalloonBesideBox'])vm.runInContext(hostFunction(name),c);
  for(const shape of ['circle','square','hexagon'])for(const side of ['right','left','top','bottom']){
    const item={selectionBox:{x:.3,y:.3,w:.1,h:.1},size:40,shape};
    assert.equal(c.placeBalloonBesideBox(item,side,8),true);
    const dx=(item.bubbleX-item.anchorX)*1000,dy=(item.bubbleY-item.anchorY)*600;
    const extent=shape==='hexagon'&&['top','bottom'].includes(side)?20*Math.sqrt(3)/2:20;
    assert.ok(Math.abs(Math.hypot(dx,dy)-extent-8)<1e-8);
    if(side==='right')assert.ok(dx>0);if(side==='left')assert.ok(dx<0);
    if(side==='top')assert.ok(dy<0);if(side==='bottom')assert.ok(dy>0);
  }
  const edge={selectionBox:{x:.95,y:.3,w:.04,h:.1},size:80};
  assert.equal(c.placeBalloonBesideBox(edge,'right',8),true);assert.ok(edge.bubbleX<.95);
  assert.equal(c.placeBalloonBesideBox({selectionBox:{x:0,y:0,w:1,h:1},size:80},'right',8),false);
});

test('Rotated snapshot ROI maps back to drawing, survives project normalization and has an 8 px leader',()=>{
  const c=hostContext();c.elements={sourceCanvas:{width:1000,height:600}};
  for(const name of ['snapshotSourceBox','mapSnapshotSelection','positionBoxAnchor','boxConnection','placeBalloonBesideBox','drawAnnotations'])vm.runInContext(hostFunction(name),c);
  vm.runInContext(fs.readFileSync(path.join(root,'src/snapshot-tools.js'),'utf8'),c);
  const box={x:.35,y:.35,w:.2,h:.2},source=c.snapshotSourceBox(box);
  assert.ok(source.x<box.x&&source.y<box.y&&source.w>box.w);
  const sourceWidth=source.w*1000,sourceHeight=source.h*600;
  const roi={cx:sourceWidth/2,cy:sourceHeight/2,w:110,h:30,angle:27};
  const selection={angle:27,points:c.window.ASMachSnapshots._test.corners(roi).map(p=>({x:p.x/sourceWidth,y:p.y/sourceHeight}))};
  const mapped=c.mapSnapshotSelection(source,selection);
  assert.equal(mapped.points.length,4);assert.equal(mapped.rotation,27);
  const item=c.normalizeAnnotation({number:'1',selectionBox:mapped,size:40,shape:'circle',arrowEnabled:true});
  assert.equal(JSON.stringify(item.selectionBox),JSON.stringify(mapped));
  for(const side of ['right','left','top','bottom']){
    assert.equal(c.placeBalloonBesideBox(item,side,8),true);
    assert.ok(Math.abs(Math.hypot((item.bubbleX-item.anchorX)*1000,(item.bubbleY-item.anchorY)*600)-28)<1e-7);
  }
  const moves=[],lines=[];let closed=0,arrows=0;
  Object.assign(c,{radiusFor:()=>20,fontSizeFor:()=>14,addCanvasBubblePath(){},drawCanvasArrowHead(){arrows++;}});
  const ctx={save(){},restore(){},beginPath(){},moveTo(x,y){moves.push([x,y]);},lineTo(x,y){lines.push([x,y]);},closePath(){closed++;},stroke(){},fill(){},fillText(){},strokeRect(){throw new Error('Rotated ROI must be a polygon');}};
  c.drawAnnotations(ctx,[item],2000,1200);
  assert.equal(closed,1);assert.equal(arrows,0);assert.equal(moves[0][0],mapped.points[0].x*2000);
  assert.equal(lines[0][1],mapped.points[1].y*1200);
  const loaded=c.normalizeAnnotation(JSON.parse(JSON.stringify(item)));assert.equal(loaded.selectionBox.rotation,27);assert.equal(loaded.selectionBox.points.length,4);
  const edge=c.snapshotSourceBox({x:0,y:0,w:.1,h:.1});assert.equal(edge.x,0);assert.equal(edge.y,0);
});

test("Settings allow partial typing and copy only diameter, font and opacity in draft", () => {
  const context = hostContext();
  vm.runInContext(hostFunction("settingsNumberValue"), context);
  assert.equal(context.settingsNumberValue("2",46,16,160,false),46);
  assert.equal(context.settingsNumberValue("20",46,16,160,false),20);
  assert.equal(context.settingsNumberValue("",20,16,160,false),20);
  assert.equal(context.settingsNumberValue("2",20,16,160,true),16);
  assert.equal(context.settingsNumberValue("200",20,16,160,true),160);
  assert.equal(context.settingsNumberValue("5",100,10,100,false),100);
  assert.equal(context.settingsNumberValue("50",100,10,100,false),50);
  context.renderMethodSettingsRows=()=>{};context.toast=()=>{};
  context.state.settingsDraft={methods:[{value:'a'},{value:'b'}],styles:{a:{size:30,fontSize:14,opacity:.6,color:'#112233',shape:'circle',arrowEnabled:false},b:{size:90,fontSize:40,opacity:1,color:'#445566',shape:'square',arrowEnabled:true}}};
  vm.runInContext(hostFunction("copyMethodDimensions"),context);
  context.copyMethodDimensions('a');
  const target=context.state.settingsDraft.styles.b;
  assert.equal(target.size,30);assert.equal(target.fontSize,14);assert.equal(target.opacity,.6);
  assert.equal(target.color,'#445566');assert.equal(target.shape,'square');assert.equal(target.arrowEnabled,true);
});

test("OCR cancel releases the dialog without waiting for a stalled recognizer", async () => {
  const context=hostContext(); let button,terminated=false;
  Object.assign(context,{setTimeout,clearTimeout,setBusyDetail(){},document:{createElement(){return button={remove(){}};},querySelector(){return {append(){}};}}});
  context.window.ASMachOCR={recognize:()=>new Promise(()=>{}),terminate:()=>{terminated=true;}};
  vm.runInContext(hostFunction('recognizeSnapshotAutomatically'),context);
  const result=context.recognizeSnapshotAutomatically('fixture');button.onclick();
  assert.match((await result).error,/iptal/);assert.equal(terminated,true);
});

test("High resolution PDF display preserves source canvas and overlay coordinates", async () => {
  const context=hostContext();const source={width:900,height:1200,style:{},after(){}};let hd;
  Object.assign(context,{elements:{sourceCanvas:source},toast(){},document:{querySelector(){return null;},createElement(){return hd={style:{},getContext(){return {};}};}}});
  vm.runInContext(hostFunction('renderHighQualityPdf'),context);
  let scale;
  await context.renderHighQualityPdf({getViewport:({scale:s})=>({width:600*s,height:800*s}),render:({viewport})=>{scale=viewport.width/600;return {promise:Promise.resolve()};}});
  assert.ok(scale>=4);assert.equal(source.width,900);assert.equal(source.height,1200);assert.equal(hd.hidden,false);assert.equal(source.style.opacity,'0');
});

test("Box leaders stay attached to the rectangle and export without arrowheads", () => {
  const context=hostContext();let arrowheads=0,rectangles=0,lines=0;
  Object.assign(context,{elements:{sourceCanvas:{width:1000,height:1000}},radiusFor:()=>20,fontSizeFor:()=>14,addCanvasBubblePath(){},drawCanvasArrowHead(){arrowheads++;}});
  for(const name of ['positionBoxAnchor','boxConnection','separateBoxBalloon','drawAnnotations'])vm.runInContext(hostFunction(name),context);
  const item={selectionBox:{x:.4,y:.4,w:.2,h:.1},anchorX:.05,anchorY:.05,bubbleX:.2,bubbleY:.45,arrowEnabled:true,arrowStyle:'dot',size:40,opacity:1,color:'#123456',number:'1'};
  const connection=context.boxConnection(item);
  assert.ok(Math.abs(connection.anchorX-.4)<1e-8);assert.ok(Math.abs(connection.anchorY-.45)<1e-8);
  assert.equal(item.anchorX,.05,'Rendering legacy records does not rewrite saved anchors');
  const canvas={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){lines++;},stroke(){},fill(){},fillText(){},strokeRect(){rectangles++;}};
  context.drawAnnotations(canvas,[item],1000,1000);
  assert.equal(rectangles,1);assert.equal(lines,1);assert.equal(arrowheads,0);
  context.drawAnnotations(canvas,[{...item,selectionBox:null}],1000,1000);assert.equal(arrowheads,1);
  item.bubbleX=.5;item.bubbleY=.45;context.separateBoxBalloon(item);
  assert.ok(item.bubbleX<.4||item.bubbleX>.6||item.bubbleY<.4||item.bubbleY>.5,'Balloon is moved outside its measurement box');
});

test("General tolerances respect explicit values, characteristic type and angular reference length", () => {
  const c=hostContext();
  const explicit=c.parseTechnicalRequirement('Ø25 ±0.03','ISO 2768-mK');
  assert.equal(explicit.upperTolerance,'+0.03');
  const gdt=c.parseTechnicalRequirement('±0.1 A','ISO 2768-mK');
  assert.equal(gdt.type,'GD&T');assert.equal(gdt.lowerLimit,'0');assert.equal(gdt.upperLimit,'0.1');
  assert.equal(c.parseTechnicalRequirement('R5','ISO 2768-mK').upperTolerance,'+0.1');
  assert.equal(c.parseTechnicalRequirement('C2','ISO 2768-mK').upperTolerance,'+0.2');
  assert.equal(c.parseTechnicalRequirement('45°','ISO 2768-mK').upperTolerance,'');
  assert.equal(c.parseTechnicalRequirement('45°','ISO 2768-mK','',25).upperTolerance,'+0.5');
  assert.equal(c.parseTechnicalRequirement('45° ±0.1°','ISO 2768-mK','',25).upperTolerance,'0.1');
  assert.equal(c.parseTechnicalRequirement('M6x1-6H','ISO 2768-mK').upperTolerance,'');
});

test('ASME drawing-defined deviations preserve units and explicit/pipe requirements',()=>{
 const c=hostContext(),standard='ASME Y14.5-2018';
 c.state.generalTolerance={standard,unit:'in',lower:'-0.002',upper:'0.003'};
 const r=c.parseTechnicalRequirement('0.5 in',standard);
 assert.equal(r.lowerLimit,'0.498');assert.equal(r.upperLimit,'0.503');assert.ok(r.toleranceStandard.startsWith(standard));
 assert.equal(c.parseTechnicalRequirement('0.5 ±0.001 in',standard).upperTolerance,'+0.001');
 assert.equal(c.parseTechnicalRequirement('1/8-27 NPT',standard).upperTolerance,'');
 assert.equal(c.parseTechnicalRequirement('12 mm',standard).upperTolerance,'');
 assert.equal(c.parseTechnicalRequirement('45°',standard).upperTolerance,'');
 c.state.generalTolerance={standard,unit:'in',lower:'',upper:''};
 assert.equal(c.parseTechnicalRequirement('0.5 in',standard).upperTolerance,'');
});

test('ASME precision table and measurement field evidence survive project normalization',()=>{
 const c=hostContext(),standard='ASME Y14.5-2018';
 c.state.generalTolerance={standard,unit:'in',lower:'',upper:'',precisionRules:{1:'0.03',2:'0.01',3:'0.005',angle:'0.5'}};
 for(const [text,tol]of [['1.2 in','0.03'],['1.20 in','0.01'],['1.200 in','0.005'],['45°','0.5']]){
  const r=c.parseTechnicalRequirement(text,standard);assert.equal(r.upperTolerance,tol,text);assert.equal(r.measurementEvidence.fields.upperTolerance.source,'general_tolerance');
 }
 assert.equal(c.parseTechnicalRequirement('1 in',standard).upperTolerance,'');
 assert.equal(c.parseTechnicalRequirement('1.20 mm',standard).upperTolerance,'');
 assert.equal(c.parseTechnicalRequirement('1/8-27 NPT',standard).upperTolerance,'');
 const limits=c.parseTechnicalRequirement('0.596 MAX 0.586 MIN',standard);
 assert.equal(limits.measurementEvidence.fields.nominalValue.source,'calculated_from_limits');
 const saved=c.normalizeAnnotation({...limits,id:'evidence',page:1,ocrText:'0.596 MAX 0.586 MIN'});
 assert.equal(saved.measurementEvidence.rawText,'0.596 MAX 0.586 MIN');
 const gdt=c.parseTechnicalRequirement('⌖ | Ø0.1 | A',standard);assert.equal(gdt.measurementEvidence,undefined);
 const manual=c.window.ASMachRequirements.measurementEvidence({...limits,nominalValue:'0.592',nominalSource:'manual',manualFields:['nominalValue']},'source');
 assert.equal(manual.measurementEvidence.fields.nominalValue.source,'manual');
});

test('Diameter prefix variants and OCR evidence preserve nominal and explicit deviations',()=>{
  const c=hostContext();vm.runInContext(hostFunction('recoverDiameterPrefix'),c);
  for(const symbol of ['Ø','ø','⌀','∅','Φ','φ','Ф','ϕ']){
    const parsed=c.parseTechnicalRequirement(`${symbol}59.9 (0/-0.1)`,'ISO 2768-mK');
    assert.equal(parsed.type,'Çap');assert.equal(parsed.nominalValue,'59.9');assert.equal(parsed.lowerTolerance,'-0.1');assert.equal(parsed.upperTolerance,'0');
  }
  const text='59.9 (0/-0.1)';
  assert.equal(c.recoverDiameterPrefix(text,[{text:'Ø59.9',confidence:70}]),'Ø'+text);
  assert.equal(c.recoverDiameterPrefix(text,[{text:'Ø56.1',confidence:95}]),text);
  assert.equal(c.recoverDiameterPrefix(text,[{text:'Ø59.9',confidence:15}]),text);
  assert.equal(c.recoverDiameterPrefix('M6',[{text:'Ø6',confidence:95}]),'M6');
});

test('PDF generation opens exact output bytes for preview before asking where to save',async()=>{
  const c=hostContext();const blob={exactPdf:true};let previews=0,saves=0,pickers=0,captured;
  c.state.fileData='fixture';c.state.fileName='drawing.pdf';c.state.pageCount=1;c.state.annotations=[];
  Object.assign(c,{showBusy(){},hideBusy(){},setBusyDetail(){},nextFrame:async()=>{},baseName:()=> 'drawing',toast(){},errorMessage:e=>e.message,
    createExportCanvas:async()=>({_effectiveDpi:300,width:1000,height:600}),addCanvasPage:()=>({output:()=>blob}),
    requestSaveTarget:async()=>{pickers++;return{};},saveBlobToTarget:async b=>{assert.equal(b,blob);saves++;}});
  c.window.jspdf={jsPDF(){}};c.window.ASMachPdfPreview={open:async(b,options)=>{assert.equal(b,blob);previews++;captured=options;}};
  vm.runInContext(hostFunction('exportPdf'),c);
  await c.exportPdf({dpi:300,includeAnnotations:true,includeSchedule:false});
  assert.equal(previews,1);assert.equal(saves,0);assert.equal(pickers,0);
  await captured.onSave();assert.equal(saves,1);assert.equal(pickers,1);
});

test("Every inline application/library script and supporting source parses", () => {
  let count = 0;
  for (const match of scripts) {
    const attributes = match[1];
    const type = /type\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] || "text/javascript";
    if (!/javascript|ecmascript|module/i.test(type) || /\bsrc\s*=/i.test(attributes)) continue;
    new vm.Script(match[2], { filename: `app.template.inline-${++count}.js` });
  }
  assert.ok(count >= 3, "Bundled libraries and main script were included");
  for (const filename of ["requirements-engine.js", "measurement-layout.js", "zone-engine.js", "ocr-engine.js", "snapshot-tools.js", "pdf-preview.js", "workflow.js", "characteristic-ui.js"]) {
    new vm.Script(fs.readFileSync(path.join(root, "src", filename), "utf8"), { filename });
  }
});

const record = {
  id: "characteristic-7", number: "7", page: 2, sheetNo: 3, zone: "B4", type: "Çap",
  requirement: "Ø25 +0.20 / -0.10", ocrText: "Ø25 +0.20 / -0.10", nominalValue: "25",
  lowerTolerance: "-0.10", upperTolerance: "+0.20", lowerLimit: "24.90", upperLimit: "25.20",
  unit: "mm", evaluationMethod: "VALUE", toleranceStandard: "Çizimde belirtilen", toleranceExplicit: true,
  fitClass: "H7", threadPitch: "1", threadClass: "6H", gdtSubtype: "position", datumRefs: "A|B(M)",
  specialDesignator: "KC", gdtFrame: { symbol: "⌖", tolerance: "0.1", datums: ["A", "B(M)"] },
  quantity: 4, chamferAngle: "45", chamferAngleTolerance: "1", lowerInclusive: false, upperInclusive: true,
  parseWarnings: ["Kaynağı doğrulayın"], result: "25.10", resultStatus: "pass", status: "approved",
  nonconformanceNo: "NCR-007", comment: "Ölçü tekrarlandı; sonuç uygun.", autoParse: false,
  manualFields: ["nominalValue", "lowerLimit", "upperLimit"], detectionConfidence: 73.5,
  recognitionSource: "Yerel OCR", createdAt: "2026-09-01T08:00:00Z", updatedAt: "2026-09-09T08:00:00Z",
  selectionBox: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, snapshot: "data:image/png;base64,AA==",
  inspectionMethod: "KUMPAS", color: "#07899a", size: 52, fontSize: 17, shape: "hexagon", opacity: 0.55,
  arrowEnabled: false, arrowStyle: "open", anchorX: 0.1, anchorY: 0.2, bubbleX: 0.3, bubbleY: 0.4
};

test("Project normalization roundtrip retains ERP characteristic fields, style and manual overrides", () => {
  const context = hostContext();
  const result = context.normalizeAnnotation(JSON.parse(JSON.stringify(record)));
  const again = context.normalizeAnnotation(JSON.parse(JSON.stringify(result)));
  for (const [key, value] of Object.entries(record)) {
    assert.deepEqual(JSON.parse(JSON.stringify(result[key] ?? null)), value, `Stored field ${key} was lost or changed`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(result)), "Second load must not change the project");
});

test("Disabled arrows remain disabled after method style application and normalization", () => {
  const context = hostContext();
  context.state.methodStyles.KUMPAS = { color: "#123456", size: 40, fontSize: 14, shape: "circle", opacity: 0.5, arrowEnabled: false, arrowStyle: "triangle" };
  const result = context.normalizeAnnotation({ inspectionMethod: "KUMPAS" });
  assert.equal(result.arrowEnabled, false);
  context.applyMethodToAnnotation(result, "KUMPAS");
  assert.equal(result.arrowEnabled, false);
  assert.equal(context.normalizeAnnotation({ ...result, arrowEnabled: false }).arrowEnabled, false);
});

test("Valid zero-valued anchors and numeric fields survive project load", () => {
  const context = hostContext();
  const result = context.normalizeAnnotation({ anchorX: 0, anchorY: 0, bubbleX: 0, bubbleY: 0, nominalValue: 0, lowerTolerance: 0, upperTolerance: 0, result: 0 });
  for (const key of ["anchorX", "anchorY", "bubbleX", "bubbleY"]) assert.equal(result[key], 0, `${key} must not use the default when exactly zero`);
  for (const key of ["nominalValue", "lowerTolerance", "upperTolerance", "result"]) assert.equal(result[key], "0");
});

test("Custom general tolerance applies only to matching dimensional units", () => {
  const context = hostContext();
  context.state.generalTolerance = { standard: "CUSTOM", lower: "-0.2", upper: "0.3", unit: "mm" };
  const metric = context.parseTechnicalRequirement("25 mm", "CUSTOM");
  assert.equal(Number(metric.lowerTolerance), -0.2);
  assert.equal(Number(metric.upperTolerance), 0.3);
  assert.equal(Number(metric.lowerLimit), 24.8);
  assert.equal(Number(metric.upperLimit), 25.3);
  const imperial = context.parseTechnicalRequirement("1 in", "CUSTOM");
  assert.equal(imperial.unit, "in");
  assert.equal(imperial.lowerTolerance, "", "Millimetre tolerance must not silently become inches");
  assert.equal(imperial.upperTolerance, "");
  const explicit = context.parseTechnicalRequirement("25 ±0.1 mm", "CUSTOM");
  assert.equal(Number(explicit.lowerTolerance), -0.1);
  assert.equal(Number(explicit.upperTolerance), 0.1);
  const angular = context.parseTechnicalRequirement("45°", "CUSTOM");
  assert.equal(angular.lowerTolerance, "", "Length tolerances cannot become degrees");
});

function exportContext() {
  let saved;
  const context = vm.createContext({ window: {}, Blob, TextEncoder, Uint8Array, DataView, atob });
  const bridge = {
    state: {
      fileName: "Çizim-7.pdf",
      annotations: [{ ...record, number: "12", requirement: '=HYPERLINK("x")', comment: 'İmalat; "A"\nyeniden kontrol', result: "0" }, { ...record, number: "2", page: 1, sheetNo: 1 }],
      metadata: { drawingNo: 'ASM<&>"7', drawingRevision: "B", partNo: "P-07", partRevision: "C", customer: "Örnek Sanayi", preparedBy: "Çağrı", description: "Revizyon denemesi" },
      auditLog: [{ at: "2026-09-09T08:00:00Z", action: "Ölçü güncellendi", number: "7", by: "Çağrı" }]
    },
    methodLabel: method => method === "KUMPAS" ? "Kumpas" : method,
    statusLabel: status => status === "approved" ? "Onaylandı" : status,
    baseName: name => name.replace(/\.[^.]+$/, ""),
    saveBlob: async (...args) => { saved = args; }, toast() {}, recordChange() {}
  };
  // Expose only the bridge setter to avoid creating UI. Export functions execute unchanged.
  vm.runInContext(workflowSource.replace("window.ASMachWorkflow=", "window.__setWorkflowBridge = bridge => app = bridge; window.ASMachWorkflow="), context);
  context.window.__setWorkflowBridge(bridge);
  return { api: context.window.ASMachWorkflow, window: context.window, bridge, saved: () => saved };
}

function readCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const text = input.replace(/^\ufeff/, "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; } else quoted = !quoted;
    } else if (!quoted && char === ";") { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field); rows.push(row);
  assert.equal(quoted, false, "CSV quoted fields are balanced");
  return rows;
}

test("GD&T workbook embeds the generated frame PNG and drawing relationships, never the source crop", async () => {
  const context=exportContext();
  const snapshot='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
  context.window.ASMachGdtReport={image:()=>snapshot};
  context.bridge.state.annotations=[{...record,type:'GD&T',snapshot}];
  const files=context.api.workbookFiles();
  assert.deepEqual(Buffer.from(files['xl/media/snapshot1.png']),Buffer.from(snapshot.split(',')[1],'base64'));
  assert.match(files['xl/worksheets/sheet1.xml'],/drawing r:id="rIdSnapshot"/);
  assert.match(files['xl/drawings/drawing1.xml'],/<xdr:row>10<\/xdr:row>/);
  const pngIndex=files['xl/worksheets/sheet1.xml'].indexOf('r="AC10"');
  assert.ok(pngIndex>files['xl/worksheets/sheet1.xml'].indexOf('r="AB10"'));
  const buffer=Buffer.from(await context.api.zipStored(files).arrayBuffer());
  assert.ok(buffer.includes(Buffer.from(snapshot.split(',')[1],'base64')));
});

test("Snapshot crop uses the selected pixel rectangle without resizing", () => {
  let args;
  const ctx={window:{},document:{createElement:()=>({getContext:()=>({fillRect(){},drawImage(...input){args=input;}})})}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/snapshot-tools.js'),'utf8'),ctx);
  const result=ctx.window.ASMachSnapshots.cropCanvas({width:1000,height:400},{x:.1,y:.2,w:.5,h:.5});
  assert.equal(result.width,500);assert.equal(result.height,200);
  assert.deepEqual(args.slice(1),[100,80,500,200,0,0,500,200]);
});

test("CSV maps all characteristic columns and escapes separators, multiline text and formulas", async () => {
  const context = exportContext();
  await context.api.exportCsv();
  const [blob, filename] = context.saved();
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], "Excel-compatible UTF-8 BOM exists");
  assert.match(filename, /_karakteristikler\.csv$/);
  const [header, first, second] = readCsv(bytes.toString("utf8"));
  assert.equal(header.length, 28);
  assert.equal(first.length, header.length);
  assert.equal(second.length, header.length);
  const value = (row, column) => row[header.indexOf(column)];
  assert.equal(value(first, "Char No"), "2", "Export order is page then balloon number");
  assert.equal(value(second, "Char No"), "12");
  assert.equal(value(second, "Requirement"), '\'=HYPERLINK("x")');
  assert.equal(value(second, "Comments"), 'İmalat; "A"\nyeniden kontrol');
  assert.equal(value(second, "Lower Tolerance"), "-0.10", "Numeric negative deviations remain numbers, not formula-prefixed text");
  assert.equal(value(second, "Result"), "0");
  assert.equal(value(first, "Inspection Method"), "Kumpas");
  assert.equal(value(first, "Status"), "Onaylandı");
  assert.equal(value(first, "Datum Reference"), "A|B(M)");
  assert.equal(value(first, "Nonconformance No"), "NCR-007");
  assert.equal(value(first, "OCR Confidence"), "73.5");
});

function unzipStored(buffer) {
  const end = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(end), 0x06054b50, "ZIP end-of-central-directory signature");
  const count = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  let cursor = buffer.readUInt32LE(end + 16);
  const centralStart = cursor, entries = {};
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50, "ZIP central entry signature");
    assert.equal(buffer.readUInt16LE(cursor + 10), 0, "Stored ZIP entry needs no decompressor");
    const crc = buffer.readUInt32LE(cursor + 16), size = buffer.readUInt32LE(cursor + 20);
    assert.equal(size, buffer.readUInt32LE(cursor + 24));
    const nameLength = buffer.readUInt16LE(cursor + 28), extraLength = buffer.readUInt16LE(cursor + 30), commentLength = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const local = buffer.readUInt32LE(cursor + 42);
    assert.equal(buffer.readUInt32LE(local), 0x04034b50, `${name} local signature`);
    assert.equal(buffer.readUInt32LE(local + 14), crc, `${name} local CRC`);
    const localNameLength = buffer.readUInt16LE(local + 26), localExtraLength = buffer.readUInt16LE(local + 28);
    assert.equal(buffer.subarray(local + 30, local + 30 + localNameLength).toString("utf8"), name);
    const start = local + 30 + localNameLength + localExtraLength;
    const content = buffer.subarray(start, start + size);
    assert.ok(start + size <= centralStart, `${name} content lies before the central directory`);
    assert.equal(zlib.crc32(content), crc, `${name} CRC validates against independent zlib implementation`);
    assert.ok(!(name in entries), "ZIP filenames are unique");
    entries[name] = content.toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor - centralStart, centralSize);
  assert.equal(cursor, end);
  return entries;
}

test("AS9102 workbook ZIP has valid CRCs, package relationships and escaped text cells", async () => {
  const context = exportContext();
  const expected = context.api.workbookFiles();
  const blob = context.api.zipStored(expected);
  const entries = unzipStored(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(Object.keys(entries).sort(), Object.keys(expected).sort());
  for (const [filename, content] of Object.entries(expected)) assert.equal(entries[filename], content);
  assert.equal(Object.keys(entries).length, 6);
  assert.match(entries["_rels/.rels"], /Target="xl\/workbook.xml"/);
  assert.match(entries["xl/_rels/workbook.xml.rels"], /Target="worksheets\/sheet1.xml"/);
  assert.match(entries["xl/_rels/workbook.xml.rels"], /Target="worksheets\/sheet2.xml"/);
  assert.match(entries["[Content_Types].xml"], /spreadsheetml\.sheet\.main\+xml/);
  assert.match(entries["xl/worksheets/sheet1.xml"], /ASM&lt;&amp;&gt;&quot;7/);
  assert.match(entries["xl/worksheets/sheet1.xml"], /<autoFilter ref="A10:AB12"/);
  assert.doesNotMatch(entries["xl/worksheets/sheet1.xml"], /<f[\s>]/, "User strings never become executable workbook formulas");
  assert.match(entries["xl/worksheets/sheet2.xml"], /Ölçü güncellendi/);
  await context.api.exportExcel();
  const [, filename] = context.saved();
  assert.match(filename, /_AS9102_Form3\.xlsx$/);
});

let xmlParser;
try {
  xmlParser = require(process.env.ASMACH_XML_MODULE || "C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js");
} catch (_) {}
test("Every workbook XML part parses; headers and characteristic row mappings match CSV", { skip: !xmlParser && "Optional xml-js runtime unavailable" }, async () => {
  const context = exportContext();
  const files = context.api.workbookFiles();
  const parsed = Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, xmlParser.xml2js(xml, { compact: true })]));
  const sheetRows = parsed["xl/worksheets/sheet1.xml"].worksheet.sheetData.row;
  const cells = row => (Array.isArray(row.c) ? row.c : [row.c]).map(cell => String(cell.is.t._text ?? ""));
  const headers = cells(sheetRows[9]);
  const first = cells(sheetRows[10]);
  assert.equal(headers.length, 28);
  assert.equal(first[headers.indexOf("Char No")], "2");
  assert.equal(first[headers.indexOf("Zone")], "B4");
  assert.equal(first[headers.indexOf("Upper Limit")], "25.20");
  assert.equal(first[headers.indexOf("Evaluation")], "VALUE");
  assert.equal(first[headers.indexOf("Special Characteristic")], "KC");
  assert.equal(cells(sheetRows[0])[1], 'ASM<&>"7');
});
