// Test-only correction-memory prototype; not imported by the application.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),study=path.join(root,'outputs/tesseract-finetune/feedback-study-v1');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
class CorrectionMemory{
 constructor(){this.enabled=true;this.rows=new Map();}
 key(context,image){const {project,revision,document,page,box}=context;if(!project||!revision||!document||!Number.isInteger(page)||page<1||!Array.isArray(box)||box.length!==4||box.some(n=>!Number.isFinite(n))||box[0]<0||box[1]<0||box[2]<=0||box[3]<=0||box[0]+box[2]>1||box[1]+box[3]>1)return null;return JSON.stringify([project,revision,document,page,box,digest(image)]);}
 record(context,image,event){const key=this.key(context,image);if(!this.enabled||!key||event.confirmed!==true||event.labelKind!=='visual-transcription'||typeof event.text!=='string'||!event.text.trim())return false;this.rows.set(key,{text:event.text,provenance:'test-simulated-confirmation'});return true;}
 recall(context,image){if(!this.enabled)return null;const row=this.rows.get(this.key(context,image));return row?structuredClone(row):null;}
 clear(){this.rows.clear();}
}
const context={project:'test-project',revision:'A',document:'drawing-sha',page:1,box:[.1,.2,.3,.4]},image=Buffer.from('test-only-pixels');
test('confirmed exact crop is remembered; edits are not automatically training labels',()=>{
 const m=new CorrectionMemory();for(const event of [{text:'25',confirmed:false,labelKind:'visual-transcription'},{text:'25',confirmed:true,labelKind:'computed-nominal'},{text:'25',confirmed:true,labelKind:'requirement'}])assert.equal(m.record(context,image,event),false);
 assert.equal(m.recall(context,image),null);assert.equal(m.record(context,image,{text:'0.205 MAX 0.198 MIN',confirmed:true,labelKind:'visual-transcription'}),true);assert.equal(m.recall(context,image).text,'0.205 MAX 0.198 MIN');
});
test('project, revision, document, page, box or image changes cannot reuse another value',()=>{
 const m=new CorrectionMemory();m.record(context,image,{text:'25',confirmed:true,labelKind:'visual-transcription'});
 for(const change of [{project:'other'},{revision:'B'},{document:'other'},{page:2},{box:[.1,.2,.31,.4]}])assert.equal(m.recall({...context,...change},image),null);assert.equal(m.recall(context,Buffer.from('changed pixels')),null);
 const r=m.recall(context,image);r.text='99';assert.equal(m.recall(context,image).text,'25');
});
test('memory can be disabled and deleted without changing the OCR model',()=>{const m=new CorrectionMemory();m.record(context,image,{text:'25',confirmed:true,labelKind:'visual-transcription'});m.enabled=false;assert.equal(m.recall(context,image),null);m.enabled=true;m.clear();assert.equal(m.recall(context,image),null);});
test('invalid crop/source or empty text cannot produce a learned entry',()=>{const m=new CorrectionMemory(),event={text:'25',confirmed:true,labelKind:'visual-transcription'};for(const change of [{project:''},{revision:''},{document:''},{page:0},{box:[.1,.2,0,.4]},{box:[.9,.2,.3,.4]}])assert.equal(m.record({...context,...change},image,event),false);assert.equal(m.record(context,image,{...event,text:' '}),false);assert.equal(m.rows.size,0);});
test('pilot feedback, validation and unseen test are disjoint, including the old 100 tests',{skip:!fs.existsSync(path.join(study,'manifest.json'))},()=>{
 const m=JSON.parse(fs.readFileSync(path.join(study,'manifest.json'))),old=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/ocr-100/manifest.json'))),normalize=s=>s.replace(/\s/g,'').toLowerCase(),seen=new Set(old.cases.map(r=>normalize(r.text))),hashes=new Set(old.cases.map(r=>r.sha256)),groups=new Set();
 assert.equal(m.splits.feedback.length,200);assert.equal(m.splits.validation.length,40);assert.equal(m.splits.holdout.length,40);assert.equal(m.realUserCorrections,0);
 for(const rows of Object.values(m.splits)){const splitGroups=new Set();for(const r of rows){assert.ok(!seen.has(normalize(r.text)));seen.add(normalize(r.text));assert.ok(!hashes.has(r.sha256));hashes.add(r.sha256);assert.ok(!groups.has(r.documentGroup));splitGroups.add(r.documentGroup);}for(const g of splitGroups)groups.add(g);}
 assert.equal(m.retentionManifestSha256,digest(fs.readFileSync(path.join(root,'tests/fixtures/ocr-100/manifest.json'))));
 for(const r of m.replay){assert.ok(!seen.has(normalize(r.text)));assert.ok(!hashes.has(r.sha256));}
});
