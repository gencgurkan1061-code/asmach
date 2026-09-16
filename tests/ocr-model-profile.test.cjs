const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const context={Uint8Array,Uint32Array,ArrayBuffer,setTimeout,clearTimeout,atob};vm.createContext(context);vm.runInContext(fs.readFileSync('src/ocr-engine.js','utf8'),context);return context.ASMachOCR._test;}
test('existing OCR stays the default; unverified technical model requires explicit selection',()=>{
 const api=load();for(const options of [undefined,{}, {model:'standard'},{model:'unknown'}])assert.equal(api.modelForJob(options),'standard');assert.equal(api.modelForJob({model:'technical'}),'technical');
});
test('GD&T cell and prose reads do not inherit the numerical fine-tuned model',()=>{
 const api=load();for(const options of [{gdtCell:'datum'},{gdtCell:'tolerance'},{gdtTolerance:true},{textMode:true}])assert.equal(api.modelForJob({...options,model:'technical'}),'standard');
});
test('model transition uses the same worker and invalidates raw results; page scans reset model',()=>{
 const source=fs.readFileSync('src/ocr-engine.js','utf8');assert.ok(/loadedModel!==requestedModel[\s\S]*?passCache.clear\(\);cacheBytes=0;[\s\S]*?worker.reinitialize/.test(source));assert.equal((source.match(/tesseract\.createWorker\(/g)||[]).length,1);assert.ok(/function detect[\s\S]*?requestedModel='standard'/.test(source));
});
