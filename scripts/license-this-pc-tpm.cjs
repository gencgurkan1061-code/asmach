'use strict';
// Owner-only migration. Stages a new file; NEVER replaces the installed app's database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),challenge=crypto.randomBytes(32),exe=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const i=JSON.parse(execFileSync(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'tpm-license-identity.ps1'),'-Create'],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,ASMACH_TPM_CHALLENGE:challenge.toString('base64')}}));
const blob=Buffer.from(i.publicKey,'base64');if(blob.length!==72||blob.subarray(0,4).toString()!=='ECS1'||blob.readUInt32LE(4)!==32||i.deviceId!==crypto.createHash('sha256').update(blob).digest('hex')||i.binding!=='tpm-cng-v1'||!Buffer.from(i.challenge,'base64').equals(challenge))throw Error('TPM proof invalid');
const key=crypto.createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:blob.subarray(8,40).toString('base64url'),y:blob.subarray(40).toString('base64url')}});
if(!crypto.verify('sha256',challenge,{key,dsaEncoding:'ieee-p1363'},Buffer.from(i.signature,'base64')))throw Error('TPM signature invalid');
const config=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/license-config.json'))),pub=crypto.createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(config.licensePublicKey,'base64').toString('base64url')}});
const decode=file=>{const e=JSON.parse(fs.readFileSync(file));if(!crypto.verify(null,Buffer.from(e.payload,'base64'),pub,Buffer.from(e.signature,'base64')))throw Error('License signature invalid');return JSON.parse(Buffer.from(e.payload,'base64'));};
const old=decode(path.join(root,'Lisanslar/Bu-bilgisayar-1-yil.asmach-license')),target=path.join(root,'Lisanslar/Bu-bilgisayar-TPM.asmach-license');
if(!fs.existsSync(target)){const store=require('../license-manager/store.cjs').createStore(root);try{const p=store.issue({customer:old.customer,deviceId:i.deviceId,binding:'tpm-cng-v1',startsAt:new Date(old.notBefore*1000).toISOString(),expiresAt:new Date(old.expiresAt*1000).toISOString(),note:'TPM geçişi; önceki lisansın bitişi korundu: '+old.licenseId});fs.writeFileSync(target,store.exportLicense(p.licenseId).text,{flag:'wx'});}finally{store.close();}}
const p=decode(target);if(p.deviceId!==i.deviceId||p.binding!=='tpm-cng-v1'||p.expiresAt!==old.expiresAt)throw Error('Staged license does not match migration');
console.log(JSON.stringify({file:target,expiresAt:new Date(p.expiresAt*1000).toISOString(),version:p.version,installedDatabaseChanged:false}));
