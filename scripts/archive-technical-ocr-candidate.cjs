'use strict';
// Preserve the actual learned weights and evidence. This never enables them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs/tesseract-finetune'),target=path.join(root,'ocr/technical-model');
const model=fs.readFileSync(path.join(out,'runs/balanced-v2/asmtech.traineddata.gz')),training=JSON.parse(fs.readFileSync(path.join(out,'runs/balanced-v2/training-report.json'))),report=JSON.parse(fs.readFileSync(path.join(out,'evaluation-100-paired-balanced-v2.json')));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(hash(model)!==training.gzipSha256||hash(model)!==report.modelHashes.candidate)throw Error('Training/evaluation artifact mismatch');
const activation=path.join(target,'activation.json');if(!fs.existsSync(activation)||JSON.parse(fs.readFileSync(activation)).enabled!==false)throw Error('Candidate archive requires explicitly disabled activation');
const files={'asmtech.traineddata.gz':'runs/balanced-v2/asmtech.traineddata.gz','training-report.json':'runs/balanced-v2/training-report.json','evaluation-100.json':'evaluation-100-paired-balanced-v2.json','LICENSE':'starter/LICENSE','source-manifest.json':'starter/manifest.json'};
for(const [name,source] of Object.entries(files)){const bytes=fs.readFileSync(path.join(out,source)),destination=path.join(target,name);if(fs.existsSync(destination)&&hash(fs.readFileSync(destination))!==hash(bytes))throw Error('Existing candidate differs; do not overwrite: '+name);fs.writeFileSync(destination,bytes);}
console.log(JSON.stringify({archived:true,enabled:false,sha256:training.gzipSha256,baselineExact:report.summaries.baseline.exactCases,candidateExact:report.summaries.candidate.exactCases}));
