const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const c={window:{}};vm.runInNewContext(fs.readFileSync('src/candidate-preview.js','utf8'),c);const api=c.window.ASMachCandidatePreview;
test('Wide context includes rotated box and balloon, full-page mode stays in bounds, and rendering leaves source untouched',()=>{
  const page=createCanvas(1200,800),g=page.getContext('2d');g.fillStyle='white';g.fillRect(0,0,1200,800);g.fillStyle='black';g.font='20px Arial';g.fillText('R4.3',610,320);
  const candidate={pageImage:page,box:{x:.5,y:.35,w:.06,h:.09,points:[{x:.5,y:.39},{x:.54,y:.35},{x:.56,y:.4},{x:.52,y:.44}]}},item={bubbleX:.59,bubbleY:.4,anchorX:.56,anchorY:.4,size:30,fontSize:14,number:7,color:'#008d9d'},before=page.toDataURL();
  const output=createCanvas(1,1),region=api.paint(output,candidate,item,true);assert.ok(region.w>candidate.box.w*4);assert.ok(region.x<.5&&region.x+region.w>.59);assert.equal(page.toDataURL(),before);assert.notEqual(output.toDataURL(),before);
  for(const shape of ['circle','square','hexagon'])api.paint(output,candidate,{...item,shape},true,true);
  assert.equal(JSON.stringify(api.bounds(candidate,item,true)),JSON.stringify({x:0,y:0,w:1,h:1}));assert.equal(page.toDataURL(),before);
});

test('Preview correction is draft-only; apply is explicit and closing ignores late recognition',async()=>{
  const nodes={};let modal,commit,disposed=0;
  class Element{
    constructor(){this.style={};this.listeners={};this.classList={add(){},remove(){}};}
    set innerHTML(html){for(const m of html.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)){const node=m[1]==='canvas'?createCanvas(1,1):new Element();node.style||={};nodes[m[2]]=node;}}
    querySelector(){return null;}setAttribute(){}append(){}addEventListener(name,fn){this.listeners[name]=fn;}showModal(){this.open=true;modal=this;}close(){this.open=false;this.listeners.close();}focus(){}
  }
  const document={body:new Element(),activeElement:new Element(),getElementById:id=>nodes[id],createElement:tag=>tag==='canvas'?createCanvas(1,1):new Element()};
  const context={window:{},document};vm.createContext(context);
  for(const module of ['candidate-correction','candidate-preview'])vm.runInContext(fs.readFileSync('src/'+module+'.js','utf8'),context);
  context.window.ASMachSnapshots={mount:(container,snapshot,onSave)=>{commit=()=>onSave(snapshot,{angle:0,points:[{x:.1,y:.1},{x:.8,y:.1},{x:.8,y:.8},{x:.1,y:.8}]});return{dispose(){disposed++;}};}};
  const page=createCanvas(1000,700),candidate={page:1,pageImage:page,text:'0',parsed:{type:'Uzunluk'},box:{x:.3,y:.3,w:.05,h:.03}},item={bubbleX:.4,bubbleY:.3,number:1};
  let applied,finish;
  const data={candidate,item,placed:false,onApply:edit=>{applied=edit;},onRecognize:()=>new Promise(r=>finish=r)};
  const api=context.window.ASMachCandidatePreview;api.open(data);nodes.candidatePreviewEdit.onclick();commit();
  nodes.candidatePreviewText.value='11 (+0.1/0)';assert.equal(applied,undefined);nodes.candidatePreviewApply.onclick();
  assert.equal(applied.text,'11 (+0.1/0)');assert.equal(candidate.text,'0');assert.equal(modal.open,false);assert.ok(disposed>0);
  api.open(data);nodes.candidatePreviewEdit.onclick();commit();const read=nodes.candidatePreviewRecognize.onclick();assert.equal(nodes.candidatePreviewEditor.inert,true);
  nodes.candidatePreviewClose.onclick();finish({text:'99',confidence:100});await read;
  api.open(data);nodes.candidatePreviewEdit.onclick();commit();assert.equal(nodes.candidatePreviewText.value,'0');assert.equal(nodes.candidatePreviewEditor.inert,false);assert.equal(nodes.candidatePreviewText.disabled,false);
  nodes.candidatePreviewDiscard.onclick();assert.equal(candidate.text,'0');assert.equal(nodes.candidatePreviewEditing.hidden,true);
  // Full OCR selection happens on the existing context canvas, not the drawing behind the dialog.
  let selected,resolveOpen;
  api.open({...data,onEdit:selection=>{selected=selection;return new Promise(r=>resolveOpen=r);}});
  nodes.candidatePreviewPage.onclick();nodes.candidatePreviewEdit.onclick();assert.equal(modal.open,true);assert.equal(nodes.candidatePreviewEditing.hidden,true);
  const canvas=nodes.candidatePreviewCanvas;canvas.getBoundingClientRect=()=>({left:15,top:25,width:600,height:350});
  const pointer=(x,y)=>({button:0,pointerId:1,clientX:15+x*600,clientY:25+y*350,preventDefault(){}});
  const sourceBefore=page.toDataURL();canvas.onpointerdown(pointer(.6,.5));canvas.onpointermove(pointer(.2,.2));const opening=canvas.onpointerup(pointer(.2,.2));
  assert.equal(modal.open,true,'Keep preview open while the crop is being prepared');assert.equal(selected.page,1);assert.ok(Math.abs(selected.box.x-.2)<1e-8);assert.ok(Math.abs(selected.box.w-.4)<1e-8);assert.ok(Math.abs(selected.box.h-.3)<1e-8);assert.equal(selected.isCurrent(),true);assert.equal(page.toDataURL(),sourceBefore);
  resolveOpen(true);await opening;assert.equal(modal.open,false);
  api.open({...data,onEdit:async()=>{throw Error('Görüntü okunamadı');}});nodes.candidatePreviewPage.onclick();nodes.candidatePreviewEdit.onclick();canvas.onpointerdown(pointer(.2,.2));await canvas.onpointerup(pointer(.5,.5));assert.equal(modal.open,true);assert.match(nodes.candidatePreviewHint.textContent,/Mevcut aday korundu/);assert.equal(candidate.text,'0');
  api.open({...data,onEdit:selection=>{selected=selection;return new Promise(r=>resolveOpen=r);}});nodes.candidatePreviewPage.onclick();nodes.candidatePreviewEdit.onclick();canvas.onpointerdown(pointer(.2,.2));const cancelled=canvas.onpointerup(pointer(.5,.5));nodes.candidatePreviewClose.onclick();assert.equal(selected.isCurrent(),false);resolveOpen(false);await cancelled;assert.equal(modal.open,false);
});

test('Context overlays other detected balloons only on their own page and never changes the drawing',()=>{
 const page=createCanvas(1000,700),g=page.getContext('2d');g.fillStyle='white';g.fillRect(0,0,1000,700);
 const candidate={page:1,pageImage:page,box:{x:.4,y:.4,w:.05,h:.03}},item={number:1,bubbleX:.48,bubbleY:.4,size:20};
 const other={candidate:{page:1,box:{x:.52,y:.45,w:.06,h:.03}},item:{number:2,bubbleX:.6,bubbleY:.45,size:20},placed:true},canvas=createCanvas(1,1),source=page.toDataURL();
 api.paint(canvas,candidate,item,true,true);const single=canvas.toDataURL();api.paint(canvas,candidate,item,true,true,[other]);assert.notEqual(canvas.toDataURL(),single);
 api.paint(canvas,candidate,item,true,true,[{...other,candidate:{...other.candidate,page:2}}]);assert.equal(canvas.toDataURL(),single);assert.equal(page.toDataURL(),source);
});
