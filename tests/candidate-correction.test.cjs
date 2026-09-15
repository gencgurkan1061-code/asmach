const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,loadImage}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
function fixture(){const c={window:{},document:{createElement:()=>createCanvas(1,1)}};vm.createContext(c);for(const file of ['snapshot-tools','candidate-correction'])vm.runInContext(fs.readFileSync('src/'+file+'.js','utf8'),c);return c.window;}
test('Correction crops original page only, preserves rotation and maps drag coordinates back to page',()=>{
  const root=fixture(),page=createCanvas(1000,800),g=page.getContext('2d');g.fillStyle='white';g.fillRect(0,0,1000,800);g.fillStyle='black';g.fillRect(410,210,70,10);const before=page.toDataURL();
  const b={x:.4,y:.2,w:.08,h:.1,points:[{x:.42,y:.2},{x:.48,y:.25},{x:.46,y:.3},{x:.4,y:.25}]};
  const edit=root.ASMachCandidateCorrection.prepare({pageImage:page,box:b},{x:.3,y:.1,w:.3,h:.4});
  const points=root.ASMachSnapshots._test.corners(edit.detected.rect).map(p=>({x:p.x/300,y:p.y/320}));
  const mapped=root.ASMachCandidateCorrection.map(edit.region,{points,angle:edit.detected.rect.angle});
  for(let i=0;i<4;i++){assert.ok(Math.abs(mapped.points[i].x-b.points[i].x)<.01);assert.ok(Math.abs(mapped.points[i].y-b.points[i].y)<.01);}
  assert.equal(page.toDataURL(),before);assert.ok(mapped.rotation>0);
});
test('Re-recognition uses the selected page high-resolution crop and never updates the candidate',async()=>{
  const root=fixture(),source=createCanvas(600,200),candidate={page:3,text:'0'},before=JSON.stringify(candidate);let captured,read;
  root.ASMachOCR={recognize:async data=>{read=await loadImage(data);return{text:'11 (+0.1/0)',confidence:93};}};
  const app={captureExact:async(box,page)=>{captured={box,page};return source.toDataURL();},loadImage,
    savedReviewSelection:()=>({rect:{cx:300,cy:100,w:500,h:150,angle:0}})};
  const box={x:.3,y:.4,w:.1,h:.02};const result=await root.ASMachCandidateCorrection.recognize(app,candidate,{box,snapshot:'lowres'});
  assert.equal(captured.page,3);assert.equal(captured.box,box);assert.equal(read.width,500);assert.equal(read.height,150);assert.equal(result.text,'11 (+0.1/0)');assert.equal(JSON.stringify(candidate),before);
  root.ASMachOCR.recognize=async()=>({error:'failed'});await assert.rejects(root.ASMachCandidateCorrection.recognize(app,candidate,{box,snapshot:'x'}),/failed/);
});

test('Inline correction uses box OCR layout, page text, symbol scoring and mapped fitted bounds',async()=>{
  const root=fixture(),source=createCanvas(600,240),calls=[],box={x:.3,y:.4,w:.1,h:.04};
  const candidate={page:3,box,text:'old',pageImage:{width:1000,height:800}},before=JSON.stringify(candidate);
  root.ASMachAutoSelection={inspect:async(data,initial,options)=>{calls.push(['inspect',options.angleHint]);return{snapshot:source.toDataURL(),sourceWidth:600,sourceHeight:240,rect:{cx:300,cy:120,w:300,h:100,angle:0}};}};
  root.ASMachDiameterVision={inspect:async()=>{calls.push(['diameter']);return{diameter:true};}};
  const app={state:{currentPage:1,pdfDoc:{getPage:async n=>{calls.push(['page',n]);return{getViewport:()=>({width:1500,height:900}),getTextContent:async()=>({items:[{text:'27.3',x:.31,y:.41,w:.05,h:.01,angle:0}]})};}}},
    captureExact:async(b,p)=>{calls.push(['capture',p,b]);return source.toDataURL();},mapPdfTextBox:w=>w,
    recognizeTextBoxes:(b,words,size)=>{assert.equal(words[0].text,'27.3');assert.equal(size.height,900);return '27.3 (0/-0.05)';},
    parseRequirement:()=>({type:'Uzunluk',nominalValue:'27.3'}),isReliableTechnicalText:()=>true,
    recognizeSnapshotAutomatically:async()=>{calls.push(['boxOCR']);return{text:'027.3505',confidence:50};},
    ocrCandidateScore:r=>r.confidence,recoverDiameterPrefix:t=>t};
  const result=await root.ASMachCandidateCorrection.recognize(app,candidate,{box,snapshot:'old'});
  assert.equal(result.text,'Ø27.3 (0/-0.05)');assert.equal(result.confidence,100);assert.equal(calls[0][0],'capture');assert.equal(calls[0][1],3);assert.ok(calls[0][2].w>box.w);
  assert.ok(calls.some(c=>c[0]==='inspect'));assert.ok(calls.some(c=>c[0]==='boxOCR'));assert.ok(calls.some(c=>c[0]==='diameter'));assert.equal(result.box.points.length,4);assert.notDeepEqual(result.box,box);assert.equal(JSON.stringify(candidate),before);
  app.recognizeTextBoxes=()=>'';app.isReliableTechnicalText=()=>false;app.recognizeSnapshotAutomatically=async()=>({text:'⌖ | 0.1 | A',confidence:92,visualGdt:true});app.parseRequirement=()=>({type:'GD&T'});
  const frame=await root.ASMachCandidateCorrection.recognize(app,candidate,{box,snapshot:'old'});assert.equal(frame.text,'⌖ | 0.1 | A');assert.equal(frame.confidence,92);
});
