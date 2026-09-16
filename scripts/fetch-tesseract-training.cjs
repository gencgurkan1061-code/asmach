// Portable developer-only training tools. No installer is run, no registry/PATH
// changes are made, and none of these executables enter the application bundle.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'outputs','tesseract-training-tools');
const files=[
 ['7zr.exe','https://github.com/ip7z/7zip/releases/download/26.03/7zr.exe','ad4c82fadcbdf93c03b4fc440f300509c7d60c5c2f4d183e35d9d70d6957037d'],
 ['7z2603-x64.exe','https://github.com/ip7z/7zip/releases/download/26.03/7z2603-x64.exe','0859c524b8a63551848f0c246abddcb1d0b7b656b0fbfe879f8d85e61a9e6edd'],
 // 5.5.3 unicharset_extractor has upstream Windows issue #4589.
 ['tesseract-5.5.0.exe','https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-ocr-w64-setup-5.5.0.20241111.exe','f3fc4236425b690c8be756f35793f77394ee004be0a6460a440c754d892f68bc']
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function download(name,url,expected){const dest=path.join(dir,name);if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))===expected)return;const response=await fetch(url);if(!response.ok)throw Error(response.status+' '+url);const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==expected)throw Error('SHA256 mismatch: '+name);fs.writeFileSync(dest,bytes);console.log('Verified '+name+' '+bytes.length+' bytes');}
(async()=>{fs.mkdirSync(dir,{recursive:true});await Promise.all(files.map(f=>download(...f)));const unzip=path.join(dir,'7zip'),tess=path.join(dir,'tesseract-5.5.0');
 if(!fs.existsSync(path.join(unzip,'7z.exe')))execFileSync(path.join(dir,'7zr.exe'),['x',path.join(dir,'7z2603-x64.exe'),'-o'+unzip,'-y'],{stdio:'pipe',windowsHide:true});
 if(!fs.existsSync(path.join(tess,'lstmtraining.exe')))execFileSync(path.join(unzip,'7z.exe'),['x',path.join(dir,'tesseract-5.5.0.exe'),'-o'+tess,'-y'],{stdio:'pipe',windowsHide:true});
 for(const file of ['tesseract.exe','lstmtraining.exe','unicharset_extractor.exe','combine_tessdata.exe','lstmeval.exe'])if(!fs.existsSync(path.join(tess,file)))throw Error('Training executable missing: '+file);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({purpose:'developer-training-only',installerExecuted:false,files:files.map(([name,url,sha256])=>({name,url,sha256})),version:execFileSync(path.join(tess,'tesseract.exe'),['--version'],{encoding:'utf8',windowsHide:true})},null,2));console.log('Portable training tools ready: '+tess);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
