/* Run only on the vendor's PC. Never distribute private keys with the application. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),vault=path.join(root,'.license-admin');
function pair(name){const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(path.join(vault,name+'.pem'),privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});return publicKey.export({format:'jwk'}).x;}
function sign(payload,key){const p=Buffer.from(JSON.stringify(payload));return {payload:p.toString('base64'),signature:crypto.sign(null,p,fs.readFileSync(key)).toString('base64')};}
function main(args){const [cmd,...rest]=args;
 if(cmd==='init'){
  if(fs.existsSync(vault))throw Error('Anahtar klasörü zaten var. Mevcut anahtarlar değiştirilmedi.');
  fs.mkdirSync(vault,{mode:0o700});const config={licensePublicKey:Buffer.from(pair('license'),'base64url').toString('base64'),statusPublicKey:Buffer.from(pair('status'),'base64url').toString('base64'),endpoint:''};
  fs.writeFileSync(path.join(root,'src-tauri/license-config.json'),JSON.stringify(config,null,2));console.log('İki ayrı imza anahtarı oluşturuldu. .license-admin klasörünü güvenli şekilde yedekleyin; müşteriye göndermeyin.');return;
 }
 if(cmd==='issue'){
  const [deviceId,customer,date,output]=rest;if(!/^[a-f0-9]{64}$/.test(deviceId||'')||!customer||!date||!output)throw Error('issue <bilgisayar-kimliği> "Müşteri" <ISO-bitiş-tarihi-saat-dilimiyle> <çıktı-dosyası>');
  if(!/(Z|[+-]\d\d:\d\d)$/.test(date))throw Error('Bitiş tarihi saat dilimi içermeli; örnek: 2027-09-12T23:59:59+03:00');
  const now=Math.floor(Date.now()/1000),expiresAt=Math.floor(Date.parse(date)/1000);if(!Number.isFinite(expiresAt)||expiresAt<=now)throw Error('Bitiş tarihi gelecekte olmalı.');
  const p={version:1,product:'asmach-inspection',licenseId:crypto.randomUUID(),deviceId,customer,issuedAt:now,notBefore:now-300,expiresAt};
  fs.writeFileSync(output,JSON.stringify(sign(p,path.join(vault,'license.pem')),null,2),{flag:'wx'});
  fs.appendFileSync(path.join(vault,'issued.jsonl'),JSON.stringify(p)+'\n');console.log('Lisans oluşturuldu. Kimlik: '+p.licenseId);return;
 }
 throw Error('Kullanım: node scripts/license-admin.cjs init | issue <kimlik> "Müşteri" <bitiş> <dosya>');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={sign};
