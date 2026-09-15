const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('C:/Users/gencg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
function fixture(){const c={window:{},document:{createElement:()=>createCanvas(1,1)}};vm.createContext(c);for(const file of ['requirements-engine','dimension-filter','workflow'])vm.runInContext(fs.readFileSync('src/'+file+'.js','utf8'),c);return{c,filter:c.window.ASMachDimensionFilter,wf:c.window.ASMachWorkflow};}
const word=(text,x=.3,y=.3,w=.025,h=.025,source='PDF metin katmanı')=>({text,x,y,w,h,source,confidence:95});
test('Automatic proposals exclude notes and process/material/datum records but retain dimensional and geometric requirements',()=>{
  const {wf}=fixture();for(const text of ['AKSI BELIRTILMEDIKCE','UNLESS OTHERWISE','DATUM A','MALZEME 7075 T651','HEAT TREAT 58 HRC','ÇAPAKLARI ALIN'])assert.equal(wf.technicalScore(text),0,text);
  for(const text of ['9','8','R5','R4.5','Ø50 d6','3.5 × 15°','59.9 (0/-0.1)','⌭ | 0.05'])assert.ok(wf.technicalScore(text)>=35,text);
});
test('Letter-to-digit hallucinations, conflicting PDF values, border labels and title values are rejected spatially',()=>{
  const {filter}=fixture();for(const [letter,digit] of [['G','9'],['E','4'],['EL','2'],['AH','3'],['RT','3']]){
    const raw=word(letter),candidate={...raw,text:digit,source:'Yerel OCR'};assert.equal(filter.rejectReason(candidate,filter.context([raw])),'letter-conflict');
  }
  assert.equal(filter.rejectReason({...word('40'),source:'Yerel OCR'},filter.context([word('0')])),'pdf-conflict');
  assert.equal(filter.rejectReason(word('9',.3,.01),filter.context()),'border');
  const labels=[word('MATERIAL',.6,.8,.07),word('REV',.85,.86),word('DRAWING',.6,.92,.09)];
  assert.equal(filter.rejectReason(word('7075',.73,.82),filter.context(labels)),'title');
  assert.equal(filter.rejectReason(word('7075',.3,.3),filter.context()),'','A real 7075 dimension away from title context is not globally blacklisted');
  assert.equal(filter.rejectReason(word('8',.3,.3),filter.context([word('8',.3,.3)])),'');
});
test('Real pixels: straight lines, hatch patterns and blank patches fail the text evidence check; real numeric glyphs survive',()=>{
  const {filter}=fixture(),box={x:0,y:0,w:1,h:1};
  const canvas=createCanvas(180,90),ctx=canvas.getContext('2d');const clear=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,180,90);ctx.strokeStyle='black';ctx.lineWidth=1;};
  clear();assert.equal(filter.visualEvidence(canvas,box).glyphs,0);
  ctx.beginPath();ctx.moveTo(5,45);ctx.lineTo(170,45);ctx.stroke();assert.equal(filter.visualEvidence(canvas,box).glyphs,0);
  clear();for(let x=-90;x<180;x+=14){ctx.beginPath();ctx.moveTo(x,90);ctx.lineTo(x+90,0);ctx.stroke();}assert.equal(filter.visualEvidence(canvas,box).glyphs,0);
  clear();ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('59.9',12,63);assert.ok(filter.visualEvidence(canvas,box).glyphs>=3);
});
test('OCR bare digits need stronger confidence; unsupported isolated 1 cannot become a measurement',()=>{
  const {filter}=fixture();assert.equal(filter.rejectReason({...word('9'),source:'Yerel OCR',confidence:77},filter.context()),'uncertain-ocr');
  assert.equal(filter.rejectReason({...word('1'),source:'Yerel OCR'},filter.context()),'isolated-stroke');
  assert.equal(filter.rejectReason({...word('1'),source:'Yerel OCR'},filter.context([word('1')])),'');
});
test('Fast PDF path requires independent distributed dimensions; hybrid/title-only PDFs still invoke OCR',async()=>{
  const {c,filter,wf}=fixture();let calls=0,options;c.window.ASMachOCR={detect:async(image,opts)=>{calls++;options=opts;return{words:[word('Ø8',.3,.4)],lines:[]};}};
  const dims=Array.from({length:9},(_,i)=>word('R'+(i+2),.12+(i%3)*.3,.12+Math.floor(i/3)*.3));
  assert.ok(filter.searchable(dims,wf.technicalScore));assert.equal(filter.searchable(Array(20).fill(dims[0]),wf.technicalScore),false);
  const result=await wf.pageSources(dims,'image',()=>{});assert.equal(calls,0);assert.equal(result.textOnly,true);
  await wf.pageSources([word('DRAWING'),word('7075',.7,.8)],'image',()=>{});assert.equal(calls,1);assert.equal(options.angles.join(','),'0,90,270');assert.equal(options.detailed,false);
  await wf.pageSources(dims,'image',()=>{},{detailed:true});assert.equal(calls,2);
});
