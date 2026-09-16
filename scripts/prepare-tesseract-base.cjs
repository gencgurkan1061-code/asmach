'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'outputs','tesseract-finetune','base');fs.mkdirSync(out,{recursive:true});
const tools=path.join(root,'outputs','tesseract-training-tools','tesseract-5.5.0');
for(const lang of ['eng','tur','deu']){
 const data=zlib.gunzipSync(fs.readFileSync(path.join(root,'ocr','lang',lang+'.traineddata.gz'))),file=path.join(out,lang+'.traineddata');fs.writeFileSync(file,data);
 const info=execFileSync(path.join(tools,'combine_tessdata.exe'),['-l',lang+'.traineddata'],{cwd:out,encoding:'utf8',windowsHide:true});console.log(lang+' '+info);
 if(lang==='eng')execFileSync(path.join(tools,'combine_tessdata.exe'),['-u',lang+'.traineddata','eng.'],{cwd:out,stdio:'pipe',windowsHide:true});
 fs.writeFileSync(path.join(out,lang+'.json'),JSON.stringify({source:'ocr/lang/'+lang+'.traineddata.gz',sha256:crypto.createHash('sha256').update(data).digest('hex'),info},null,2));
}
