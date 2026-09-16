'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','tesseract-finetune','starter');
const revision='e12c65a915945e4c28e237a9b52bc4a8f39a0cec';
(async()=>{fs.mkdirSync(path.join(out,'langdata'),{recursive:true});
 const meta=await(await fetch('https://api.github.com/repos/tesseract-ocr/langdata_lstm/commits/main')).json();if(!/^[a-f0-9]{40}$/.test(meta.sha))throw Error('Cannot pin official language metadata');
 const files=[['eng.traineddata',`https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/${revision}/eng.traineddata`],['LICENSE',`https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/${revision}/LICENSE`],...['Latin.unicharset','Greek.unicharset','Cyrillic.unicharset','radical-stroke.txt'].map(n=>['langdata/'+n,`https://raw.githubusercontent.com/tesseract-ocr/langdata_lstm/${meta.sha}/${n}`])];
 const manifest=[];for(const [name,url] of files){const response=await fetch(url);if(!response.ok)throw Error(response.status+' '+url);const bytes=Buffer.from(await response.arrayBuffer());fs.writeFileSync(path.join(out,name),bytes);manifest.push({name,url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});console.log('Downloaded '+name+' '+bytes.length);}
 const tool=path.join(root,'outputs/tesseract-training-tools/tesseract-5.5.0/combine_tessdata.exe');
 execFileSync(tool,['-u','eng.traineddata','eng.'],{cwd:out,stdio:'pipe',windowsHide:true});
 const info=execFileSync(tool,['-l','eng.traineddata'],{cwd:out,encoding:'utf8',windowsHide:true});if(!info.includes('int_mode=0'))throw Error('Training starter must be float');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({revision,langdataRevision:meta.sha,info,files:manifest},null,2));console.log(info);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
