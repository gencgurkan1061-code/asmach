const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const load=require('../scripts/load-validated-ocr-model.cjs');
function cleanup(directory){const absolute=fs.realpathSync(directory),parent=fs.realpathSync(os.tmpdir());if(path.dirname(absolute)!==parent||!path.basename(absolute).startsWith('asmach-model-gate-'))throw Error('Unsafe test cleanup path');fs.rmSync(absolute,{recursive:true,force:true});}
test('a trained model alone does not activate or add itself to the production bundle',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asmach-model-gate-'));
 try{assert.equal(load(root),null);const dir=path.join(root,'ocr/technical-model');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'candidate.traineddata.gz'),'not-an-approved-model');assert.equal(load(root),null);fs.writeFileSync(path.join(dir,'activation.json'),JSON.stringify({enabled:false}));assert.equal(load(root),null);}
 finally{cleanup(root);}
});
test('invalid or escaping activation metadata fails closed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asmach-model-gate-')),dir=path.join(root,'ocr/technical-model');fs.mkdirSync(dir,{recursive:true});
 try{fs.writeFileSync(path.join(dir,'activation.json'),JSON.stringify({enabled:true,report:'../other.json'}));assert.throws(()=>load(root),/Invalid OCR model artifact path/);fs.writeFileSync(path.join(dir,'activation.json'),JSON.stringify({enabled:'yes'}));assert.throws(()=>load(root),/explicit/);}
 finally{cleanup(root);}
});
