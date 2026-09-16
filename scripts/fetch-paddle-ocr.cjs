/* Download the pinned official PaddleOCR browser SDK for isolated, offline tests.
 * Nothing here changes the production build or release channel. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const destination=path.join(root,'ocr','experimental-paddle');
const cache=path.join(root,'outputs','ocr-lab','downloads');
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
async function fetchBytes(url){const response=await fetch(url);if(!response.ok)throw Error(`${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}
async function packageFiles(name,version,target){
  const metadata=JSON.parse(await fetchBytes(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`));
  if(metadata.name!==name||metadata.version!==version)throw Error('Registry package mismatch');
  const archive=await fetchBytes(metadata.dist.tarball),integrity=String(metadata.dist.integrity||'').split(' ').find(value=>value.startsWith('sha512-'));
  if(!integrity||crypto.createHash('sha512').update(archive).digest('base64')!==integrity.slice(7))throw Error(`Integrity mismatch: ${name}`);
  const archivePath=path.join(cache,`${name.replace(/[^a-z0-9.-]/gi,'_')}-${version}.tgz`);fs.writeFileSync(archivePath,archive);
  const entries=execFileSync('tar',['-tzf',archivePath],{encoding:'utf8'}).trim().split(/\r?\n/);
  if(entries.some(entry=>!entry.startsWith('package/')||entry.split('/').includes('..')||entry.includes('\\')))throw Error('Unsafe archive path');
  fs.mkdirSync(target,{recursive:true});execFileSync('tar',['-xzf',archivePath,'--strip-components=1','-C',target]);
  return{name,version,url:metadata.dist.tarball,sha256:sha256(archive),integrity};
}
async function main(){
  fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(destination,{recursive:true});
  const sdk=await packageFiles('@paddleocr/paddleocr-js','0.4.2',path.join(destination,'sdk'));
  const assets=[
    ['runtime/ort-wasm-simd-threaded.jsep.mjs','https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.jsep.mjs'],
    ['runtime/ort-wasm-simd-threaded.jsep.wasm','https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/ort-wasm-simd-threaded.jsep.wasm'],
    ['models/PP-OCRv5_mobile_det.tar','https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar'],
    ['models/PP-OCRv5_mobile_rec.tar','https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar'],
    ['licenses/PaddleOCR-LICENSE','https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE'],
    ['licenses/onnxruntime-LICENSE','https://raw.githubusercontent.com/microsoft/onnxruntime/v1.24.3/LICENSE'],
    ['licenses/opencv-LICENSE','https://raw.githubusercontent.com/opencv/opencv/4.10.0/LICENSE'],
  ];
  const files=[];
  for(const [relative,url]of assets){
    const data=await fetchBytes(url),target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);
    files.push({path:relative,url,bytes:data.length,sha256:sha256(data)});console.log(`${relative}: ${data.length} bytes`);
  }
  const workerPath='sdk/dist/assets/worker-entry-C9UNuyOJ.js',worker=fs.readFileSync(path.join(destination,workerPath));
  files.push({path:workerPath,bytes:worker.length,sha256:sha256(worker)});
  const manifest={schema:1,experimental:true,productionEnabled:false,sdk,engine:'PaddleOCR',model:'PP-OCRv5_mobile',runtime:'onnxruntime-web 1.24.3',workerPath,files};
  fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({destination,bytes:files.reduce((sum,file)=>sum+file.bytes,0),files:files.length},null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={fetchBytes,packageFiles,destination,cache,sha256};
