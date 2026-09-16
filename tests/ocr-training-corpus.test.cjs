'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/tesseract-finetune'),fixtures=path.join(root,'tests/fixtures/ocr-100');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
test('exactly 100 held-out images cover all 16 application characteristic types',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(fixtures,'manifest.json')));assert.equal(m.training,false);assert.equal(m.purpose,'locked-holdout');assert.equal(m.cases.length,100);assert.equal(new Set(m.cases.map(c=>c.id)).size,100);
 assert.equal(new Set(m.cases.map(c=>c.family)).size,16);assert.equal(m.cases.filter(c=>c.family==='GD&T').length,12);
 for(const c of m.cases){assert.equal(path.basename(c.file),c.file);assert.equal(digest(fs.readFileSync(path.join(fixtures,c.file))),c.sha256);assert.ok(c.standard);}
 assert.ok(new Set(m.cases.map(c=>c.quality)).size>=6);assert.ok(m.cases.some(c=>c.rotation));assert.ok(m.cases.some(c=>c.layout==='limits'));assert.ok(m.cases.some(c=>c.layout==='stacked'));
});
test('training and validation exclude held-out images, texts and font families',{skip:!fs.existsSync(path.join(out,'corpus-manifest.json'))&&'Generate the developer-only training corpus first'},()=>{
 const m=load('corpus-manifest.json'),h=load('holdout-100/manifest.json');assert.equal(m.holdoutManifestSha256,digest(fs.readFileSync(path.join(out,'holdout-100/manifest.json'))));
 assert.equal(m.splits.train.length,2400);assert.equal(m.splits.validation.length,200);
 const text=s=>s.toLowerCase().replace(/\s/g,''),seen=new Set(h.cases.map(c=>text(c.text))),hashes=new Set(h.cases.map(c=>c.sha256));
 for(const [split,rows] of Object.entries(m.splits))for(const r of rows){assert.ok(r.file.startsWith('corpus/'+split+'/'));assert.ok(!seen.has(text(r.text)),r.text);seen.add(text(r.text));assert.ok(!hashes.has(r.sha256));hashes.add(r.sha256);assert.ok(!h.fontFamilies.includes(r.font));}
});

test('balanced training adds 2400 independent examples without changing validation or test data',{skip:!fs.existsSync(path.join(out,'corpus-balanced-v2.json'))&&'Generate balanced training augmentation first'},()=>{
 const original=load('corpus-manifest.json'),expanded=load('corpus-balanced-v2.json'),holdout=load('holdout-100/manifest.json');
 assert.equal(expanded.splits.train.length,4800);assert.deepEqual(expanded.splits.validation,original.splits.validation);assert.equal(expanded.holdoutManifestSha256,original.holdoutManifestSha256);
 const normalize=s=>s.toLowerCase().replace(/\s/g,''),seen=new Set([...holdout.cases,...original.splits.validation].map(r=>normalize(r.text)));
 const hashes=new Set([...holdout.cases,...original.splits.validation].map(r=>r.sha256));
 for(const r of expanded.splits.train){assert.ok(!seen.has(normalize(r.text)));seen.add(normalize(r.text));assert.ok(!hashes.has(r.sha256));hashes.add(r.sha256);assert.ok(!holdout.fontFamilies.includes(r.font));assert.ok(!expanded.fontSplits.validation.includes(r.font));}
});
test('training uses native LSTM fine-tuning and evaluates only its validation split',()=>{
 const source=fs.readFileSync(path.join(root,'scripts/train-technical-tesseract.py'),'utf8');assert.match(source,/lstmtraining/);assert.match(source,/--old_traineddata/);assert.match(source,/--continue_from/);assert.match(source,/--convert_to_int/);assert.doesNotMatch(source,/holdout-100.*lstmf/);
});
