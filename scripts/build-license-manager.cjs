'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'license-manager/runtime');fs.mkdirSync(runtime,{recursive:true});const destination=path.join(runtime,'node.exe');const hash=p=>require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');if(!fs.existsSync(destination)||hash(destination)!==hash(process.execPath))fs.copyFileSync(process.execPath,destination);
const csc=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const output=path.join(root,'ASMach Lisans Yönetimi.exe');
execFileSync(csc,['/nologo','/target:winexe','/reference:System.Windows.Forms.dll','/win32icon:'+path.join(root,'src-tauri/icons/icon.ico'),'/out:'+output,path.join(root,'license-manager/Launcher.cs')],{stdio:'pipe',windowsHide:true});
console.log('Hazır: '+output);
