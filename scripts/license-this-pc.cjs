'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const registry=execFileSync(path.join(process.env.SystemRoot,'System32','reg.exe'),['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{encoding:'utf8',windowsHide:true});
const guid=registry.split(/\r?\n/).find(l=>l.includes('REG_SZ'))?.split('REG_SZ')[1].trim().toLowerCase();if(!guid)throw Error('Bilgisayar kimliği okunamadı');
const device=crypto.createHash('sha256').update('asmach-inspection:v1:'+guid).digest('hex');
const dir=path.join(root,'Lisanslar');fs.mkdirSync(dir,{recursive:true});
const target=path.join(dir,'Bu-bilgisayar-1-yil.asmach-license');
if(!fs.existsSync(target)){const expiry=new Date();expiry.setFullYear(expiry.getFullYear()+1);execFileSync(process.execPath,[path.join(__dirname,'license-admin.cjs'),'issue',device,'Gürkan — Yönetici bilgisayarı',expiry.toISOString(),target],{stdio:'pipe',windowsHide:true});}
const e=JSON.parse(fs.readFileSync(target)),p=JSON.parse(Buffer.from(e.payload,'base64'));
const config=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/license-config.json')));
const publicKey=crypto.createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(config.licensePublicKey,'base64').toString('base64url')},format:'jwk'});
if(!crypto.verify(null,Buffer.from(e.payload,'base64'),publicKey,Buffer.from(e.signature,'base64'))||p.deviceId!==device||p.expiresAt<=Date.now()/1000)throw Error('Yerel lisans doğrulanamadı');
if(process.argv.includes('--activate')){
 const {DatabaseSync}=require('node:sqlite');const dbFile=path.join('C:/Users/gencg/AppData/Roaming/com.asmach.ballooning','licensing.sqlite3');
 if(!fs.existsSync(dbFile))throw Error('Kurulu uygulamanın lisans veritabanı bulunamadı');
 const db=new DatabaseSync(dbFile);db.exec('PRAGMA busy_timeout=5000');
 const revoked=db.prepare('SELECT id FROM revoked WHERE id=?').get(p.licenseId);if(revoked)throw Error('Lisans iptal edilmiş');
 db.prepare('INSERT INTO license_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('license',JSON.stringify(e));db.close();
}
console.log(JSON.stringify({file:target,licenseId:p.licenseId,expiresAt:new Date(p.expiresAt*1000).toISOString(),activated:process.argv.includes('--activate')}));
