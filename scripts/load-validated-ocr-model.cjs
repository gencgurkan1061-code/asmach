'use strict';
// Optional build-time activation. An unvalidated candidate cannot silently
// replace the stock language file, even if someone copies it into the folder.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {evaluate}=require('./ocr-model-gate.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
module.exports=function loadValidatedModel(root){
 const directory=path.join(root,'ocr/technical-model'),activation=path.join(directory,'activation.json');
 if(!fs.existsSync(activation))return null;
 const entry=JSON.parse(fs.readFileSync(activation));if(entry.enabled===false)return null;
 if(entry.enabled!==true)throw Error('OCR model activation must be explicit');
 function readFile(name){if(typeof name!=='string'||path.basename(name)!==name||name==='.'||name==='..')throw Error('Invalid OCR model artifact path');return fs.readFileSync(path.join(directory,name));}
 const report=JSON.parse(readFile(entry.report)),training=JSON.parse(readFile(entry.trainingReport)),bytes=readFile(entry.model);
 const manifestBytes=fs.readFileSync(path.join(root,'tests/fixtures/ocr-100/manifest.json')),manifest=JSON.parse(manifestBytes);
 const result=evaluate(report,training,manifest,bytes,manifestBytes);
 if(report.modelProfile!=='replace-english-in-multilingual')result.reasons.push('This package loader requires the evaluated multilingual replacement profile');
 if(report.modelHashes?.baseline!==hash(fs.readFileSync(path.join(root,'ocr/lang/eng.traineddata.gz'))))result.reasons.push('Stock OCR model has changed since evaluation');
 for(const lang of ['eng','tur','deu'])if(report.baselineLanguageHashes?.[lang]!==hash(fs.readFileSync(path.join(root,'ocr/lang',lang+'.traineddata.gz'))))result.reasons.push('Stock language asset changed: '+lang);
 for(const name of ['ocr/tesseract.min.js','ocr/worker.min.js','ocr/core/tesseract-core-lstm.wasm.js','src/app.template.html'])if(report.runtimeHashes?.[name]!==hash(fs.readFileSync(path.join(root,name))))result.reasons.push('Runtime changed since evaluation: '+name);
 for(const source of ['requirements-engine','measurement-layout','ocr-image-enhancement','diameter-vision','gdt-vision','ocr-engine']){
  if(report.sourceHashes?.[source]!==hash(fs.readFileSync(path.join(root,'src',source+'.js'))))result.reasons.push('Source changed since model evaluation: '+source);
 }
 if(result.reasons.length)throw Error('OCR model activation blocked: '+result.reasons.join('; '));
 return{base64:bytes.toString('base64'),metadata:{kind:training.kind,sha256:training.gzipSha256,trainingLines:training.trainingLines,validationLines:training.validationLines,holdoutCount:100,exactCases:result.candidateExact,profile:report.modelProfile}};
};
