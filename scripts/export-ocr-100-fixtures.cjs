'use strict';
// Check in the small, fixed evaluation set, never fonts or training executables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),from=path.join(root,'outputs/tesseract-finetune/holdout-100'),to=path.join(root,'tests/fixtures/ocr-100');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(path.join(from,'manifest.json')),manifest=JSON.parse(bytes);
if(manifest.caseCount!==100||manifest.training!==false||manifest.cases.length!==100)throw Error('Expected the locked 100-case evaluation set');
fs.mkdirSync(to,{recursive:true});
function copy(name,expected){
 if(path.basename(name)!==name)throw Error('Unsafe fixture path');const data=fs.readFileSync(path.join(from,name));
 if(expected&&digest(data)!==expected)throw Error('Source fixture changed: '+name);
 const target=path.join(to,name);if(fs.existsSync(target)&&digest(fs.readFileSync(target))!==digest(data))throw Error('Refusing to overwrite a changed fixture: '+name);
 fs.writeFileSync(target,data);
}
for(const c of manifest.cases)copy(c.file,c.sha256);copy('manifest.json');
console.log(JSON.stringify({cases:100,files:101,sha256:digest(bytes),directory:to}));
