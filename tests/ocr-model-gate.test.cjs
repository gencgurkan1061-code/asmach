const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {evaluate}=require('../scripts/ocr-model-gate.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const manifest={cases:Array.from({length:100},(_,i)=>({id:'m'+i,family:'type'+i%16}))},model=Buffer.from('test-only-model'),training={kind:'Tesseract-LSTM-finetune',holdoutLinesUsedForTraining:0,gzipSha256:hash(model),holdoutManifestSha256:hash(JSON.stringify(manifest,null,2)+'\n')};
 const report={mode:'paired',holdoutCount:100,holdoutSha256:training.holdoutManifestSha256,modelHashes:{candidate:hash(model)},sourceHashes:{a:'1',b:'2',c:'3',d:'4',e:'5',f:'6'},blockedRequests:[],coldStartMs:{baseline:100,candidate:90},summaries:{baseline:{meanMs:100,medianMs:100,p95Ms:100},candidate:{meanMs:90,medianMs:90,p95Ms:90}},rows:manifest.cases.flatMap((c,i)=>['baseline','candidate'].map(variant=>({...c,variant,ok:variant==='candidate'||i>0,failures:variant==='baseline'&&i===0?[{field:'nominalValue'}]:[],needsReview:true,ocrMs:90})))};
 return{manifest,model,training,report,manifestBytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n'),check(){return evaluate(this.report,this.training,this.manifest,this.model,this.manifestBytes);}};
}
test('quality gate accepts only an improved, no-regression and no-slowdown paired result',()=>{assert.equal(fixture().check().allowed,true);});
test('speed regression, missing rows, wrong model or training leakage blocks activation',()=>{
 for(const change of [f=>f.report.summaries.candidate.meanMs=101,f=>f.report.coldStartMs.candidate=101,f=>f.report.rows.pop(),f=>f.model=Buffer.from('other'),f=>f.training.holdoutLinesUsedForTraining=1]){const f=fixture();change(f);assert.equal(f.check().allowed,false);}
});
test('a net improvement cannot hide a previously correct measurement regression',()=>{const f=fixture(),r=f.report.rows.find(r=>r.id==='m3'&&r.variant==='candidate');r.ok=false;r.failures=[{field:'nominalValue'}];assert.ok(f.check().reasons.includes('Previously correct measurements regressed'));});
test('original fixture bytes, including Python float formatting, define dataset identity',()=>{
 const f=fixture();f.manifest.example=2;const serialized=JSON.stringify(f.manifest);f.manifestBytes=Buffer.from(serialized.replace('"example":2','"example":2.0')+'\n');f.report.holdoutSha256=f.training.holdoutManifestSha256=hash(f.manifestBytes);assert.equal(f.check().allowed,true);f.manifestBytes=Buffer.from(serialized+'\n');assert.ok(f.check().reasons.includes('Training and evaluation use different test revisions'));
});
