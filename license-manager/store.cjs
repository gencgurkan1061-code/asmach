'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
function createStore(root){
 const vault=path.join(root,'.license-admin'),exportsDir=path.join(root,'Lisanslar');
 const privateKey=crypto.createPrivateKey(fs.readFileSync(path.join(vault,'license.pem')));
 const pub=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/license-config.json'))).licensePublicKey;
 if(Buffer.from(crypto.createPublicKey(privateKey).export({format:'jwk'}).x,'base64url').toString('base64')!==pub)throw Error('Üretim anahtarı uygulamanın doğrulama anahtarıyla eşleşmiyor.');
 const db=new DatabaseSync(path.join(vault,'manager.sqlite3'));db.exec(`PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY,claims TEXT NOT NULL,envelope TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',renewed_from TEXT,revocation_requested INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT,license_id TEXT,action TEXT NOT NULL,at INTEGER NOT NULL,detail TEXT NOT NULL);
 `);
 if(!db.prepare('PRAGMA table_info(licenses)').all().some(c=>c.name==='cloud_revoked'))db.exec('ALTER TABLE licenses ADD COLUMN cloud_revoked INTEGER NOT NULL DEFAULT 0');
 db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}');");
 if(!db.prepare('PRAGMA table_info(licenses)').all().some(c=>c.name==='user_id'))db.exec('ALTER TABLE licenses ADD COLUMN user_id TEXT');
 if(!db.prepare('PRAGMA table_info(history)').all().some(c=>c.name==='user_id'))db.exec('ALTER TABLE history ADD COLUMN user_id TEXT');
 if(!db.prepare('PRAGMA table_info(licenses)').all().some(c=>c.name==='activation_key'))db.exec("ALTER TABLE licenses ADD COLUMN activation_key TEXT");
 db.exec("CREATE TABLE IF NOT EXISTS publication(license_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,at INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '')");
 function userFor(name){const existing=db.prepare('SELECT id FROM users WHERE name=?').get(name);if(existing)return existing.id;const id=crypto.randomUUID();db.prepare('INSERT INTO users(id,name) VALUES(?,?)').run(id,name);return id;}
 const sign=claims=>{const p=Buffer.from(JSON.stringify(claims));return {payload:p.toString('base64'),signature:crypto.sign(null,p,privateKey).toString('base64')};};
 const audit=(id,action,detail)=>db.prepare('INSERT INTO history(license_id,action,at,detail) VALUES(?,?,?,?)').run(id,action,Math.floor(Date.now()/1000),detail);
 const record=id=>{const row=db.prepare('SELECT * FROM licenses WHERE id=?').get(id);if(!row)throw Error('Lisans kaydı bulunamadı.');return row;};
 const insert=(p,e,note,renewedFrom)=>{db.prepare('INSERT INTO licenses(id,claims,envelope,note,renewed_from,user_id) VALUES(?,?,?,?,?,?)').run(p.licenseId,JSON.stringify(p),JSON.stringify(e),note,renewedFrom,userFor(p.customer));};
 const importFile=path.join(vault,'issued.jsonl');
 if(fs.existsSync(importFile))for(const line of fs.readFileSync(importFile,'utf8').split(/\r?\n/).filter(Boolean)){
  const p=JSON.parse(line);if(p.product!=='asmach-inspection'||!/^[a-f0-9]{64}$/.test(p.deviceId)||!p.licenseId)throw Error('Eski lisans kayıt dosyasında geçersiz kayıt var.');
  if(!db.prepare('SELECT id FROM licenses WHERE id=?').get(p.licenseId)){db.exec('BEGIN IMMEDIATE');try{insert(p,sign(p),'Önceki üretim aracından aktarıldı.',null);audit(p.licenseId,'İçe aktarıldı','Mevcut lisans kaydı');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 }
 for(const row of db.prepare('SELECT id,claims FROM licenses WHERE user_id IS NULL').all())db.prepare('UPDATE licenses SET user_id=? WHERE id=?').run(userFor(JSON.parse(row.claims).customer),row.id);
 function list(){return db.prepare('SELECT * FROM licenses ORDER BY rowid DESC').all().map(r=>{const p=JSON.parse(r.claims);return {...p,licenseNumber:p.licenseNumber||'ASM-'+p.licenseId.toUpperCase(),activationKey:r.activation_key||'',userId:r.user_id,note:r.note,renewedFrom:r.renewed_from,cloudRevoked:!!r.cloud_revoked,revocationRequested:!!r.revocation_requested,status:r.cloud_revoked?'İptal edildi':r.revocation_requested?'İptal bekliyor':p.expiresAt<=Date.now()/1000?'Süresi doldu':p.notBefore>Date.now()/1000?'Başlamadı':'Aktif'};});}
 function detail(id){const r=record(id),u=db.prepare('SELECT * FROM users WHERE id=?').get(r.user_id);return{license:list().find(l=>l.licenseId===id),user:{id:u.id,name:u.name,...JSON.parse(u.profile)},licenses:list().filter(l=>l.userId===u.id),licenseHistory:db.prepare('SELECT * FROM history WHERE license_id=? ORDER BY id DESC').all(id),userHistory:db.prepare('SELECT h.* FROM history h LEFT JOIN licenses l ON l.id=h.license_id WHERE l.user_id=? OR h.user_id=? ORDER BY h.id DESC').all(u.id,u.id)};}
 function updateUser(id,input){const old=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!old)throw Error('Kullanıcı bulunamadı.');const profile={};for(const field of ['company','contact','email','phone','notes']){profile[field]=String(input[field]||'').trim();if(profile[field].length>(field==='notes'?2000:200))throw Error('Alan çok uzun: '+field);}db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(profile),id);db.prepare('INSERT INTO history(license_id,user_id,action,at,detail) VALUES(?,?,?,?,?)').run('',id,'Kullanıcı bilgileri güncellendi',Math.floor(Date.now()/1000),JSON.stringify({previous:JSON.parse(old.profile),current:profile}));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return{saved:true};}
 function issue(input){
  const customer=String(input.customer||'').trim(),deviceId=String(input.deviceId||'').trim().toLowerCase(),note=String(input.note||'').trim();
  const notBefore=Math.floor(Date.parse(input.startsAt)/1000),expiresAt=Math.floor(Date.parse(input.expiresAt)/1000),now=Math.floor(Date.now()/1000);
  if(!customer||customer.length>160)throw Error('Müşteri adı 1–160 karakter olmalı.');
  if(input.binding!=='first-device'&&!/^[a-f0-9]{64}$/.test(deviceId))throw Error('Uygulamadaki 64 karakterli bilgisayar kimliğini yapıştırın.');
  if(!Number.isFinite(notBefore)||!Number.isFinite(expiresAt)||expiresAt<=notBefore||expiresAt<=now)throw Error('Bitiş tarihi başlangıçtan ve bugünden sonra olmalı.');
  if(note.length>2000)throw Error('Not en fazla 2000 karakter olabilir.');
  const renewedFrom=input.renewedFrom||null;if(renewedFrom){const old=JSON.parse(record(renewedFrom).claims);if(old.deviceId!==deviceId)throw Error('Yenilemede bilgisayar kimliği değiştirilemez; yeni lisans oluşturun.');if(expiresAt<=old.expiresAt)throw Error('Yenileme tarihi önceki bitişten sonra olmalı.');}
  const first=input.binding==='first-device',binding=first||input.binding==='tpm-cng-v1'?'tpm-cng-v1':'';const activationKey=first?crypto.randomUUID().toUpperCase():'';
  const verificationUrl=require('./cloud.cjs').cloud(root).verificationUrl();
  const p={version:binding?2:1,binding,revision:1,verificationUrl,product:'asmach-inspection',licenseId:crypto.randomUUID(),licenseNumber:'ASM-'+crypto.randomBytes(8).toString('hex').toUpperCase(),activationMode:first?'first-device':'',deviceId:first?'':deviceId,customer,issuedAt:now,notBefore,expiresAt},envelope=sign(p);
  db.exec('BEGIN IMMEDIATE');try{insert(p,envelope,note,renewedFrom);if(first)db.prepare('UPDATE licenses SET activation_key=? WHERE id=?').run(activationKey,p.licenseId);audit(p.licenseId,renewedFrom?'Yenilendi':'Oluşturuldu',renewedFrom?'Önceki lisans: '+renewedFrom:'Yeni süreli lisans');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return {...p,activationKey};
 }
 function exportLicense(id){const r=record(id),p=JSON.parse(r.claims);return {name:'Lisans-'+p.customer.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,40)+'-'+id.slice(0,8)+'-r'+(p.revision||1)+'.asmach-license',text:JSON.stringify(JSON.parse(r.envelope),null,2)};}
 function offlineCode(id){const r=record(id),p=JSON.parse(r.claims);if(!/^[a-f0-9]{64}$/.test(p.deviceId))throw Error('Çevrimdışı kod için uygulamada gösterilen bilgisayar kimliğine bağlı bir lisans oluşturun.');if(r.cloud_revoked)throw Error('İptal edilmiş lisans için çevrimdışı kod oluşturulamaz.');const compact=JSON.stringify(JSON.parse(r.envelope)),code='ASM-OFF1-'+Buffer.from(compact,'utf8').toString('base64url');audit(id,'Çevrimdışı kod oluşturuldu','Bitiş: '+new Date(p.expiresAt*1000).toISOString());return{code,deviceId:p.deviceId,expiresAt:p.expiresAt,licenseNumber:p.licenseNumber||''};}
 function amend(id,expiresAt){const r=record(id),old=JSON.parse(r.claims),expiry=Math.floor(Date.parse(expiresAt)/1000);if(r.cloud_revoked)throw Error('İptal edilmiş lisans için yeni lisans oluşturun.');if(!Number.isFinite(expiry)||expiry<=Date.now()/1000||expiry<=old.notBefore)throw Error('Geçerli bir gelecek bitiş tarihi seçin.');const p={...old,revision:(old.revision||1)+1,issuedAt:Math.floor(Date.now()/1000),expiresAt:expiry,verificationUrl:require('./cloud.cjs').cloud(root).verificationUrl()||old.verificationUrl||''};const e=sign(p);db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE licenses SET claims=?,envelope=? WHERE id=?').run(JSON.stringify(p),JSON.stringify(e),id);audit(id,'Süre değiştirildi',JSON.stringify({previous:old,current:p}));db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return{license:p,envelope:e};}
 function markRevoked(id){record(id);db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE licenses SET cloud_revoked=1,revocation_requested=0 WHERE id=?').run(id);audit(id,'Bulutta iptal edildi','Hizmet iptal kaydını kabul etti. Müşteri başarılı doğrulamada uygular.');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 function saveLicense(id){const f=exportLicense(id);fs.mkdirSync(exportsDir,{recursive:true});const target=path.join(exportsDir,f.name);if(!fs.existsSync(target))fs.writeFileSync(target,f.text,{flag:'wx'});else if(fs.readFileSync(target,'utf8')!==f.text)throw Error('Aynı isimde farklı bir dosya var; mevcut dosya değiştirilmedi.');audit(id,'Dosya kaydedildi',f.name);return {path:target};}
 function revoke(id){record(id);db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE licenses SET revocation_requested=1 WHERE id=?').run(id);audit(id,'İptal talebi','Yalnızca yerel kayıt. Bulut yayını yapılmadı; müşteri lisansı henüz iptal edilmedi.');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 function snapshot(){return {format:1,publicKey:pub,licenses:db.prepare('SELECT * FROM licenses ORDER BY id').all(),users:db.prepare('SELECT * FROM users ORDER BY id').all(),history:db.prepare('SELECT * FROM history ORDER BY id').all(),publication:db.prepare('SELECT * FROM publication ORDER BY license_id').all()};}
 function validateSnapshot(s){
  if(!s||s.format!==1||s.publicKey!==pub)throw Error('Yedek bu uygulamanın imzalama anahtarıyla uyumlu değil.');
  for(const key of ['licenses','users','history','publication'])if(!Array.isArray(s[key])||s[key].length>100000)throw Error('Geçersiz yedek tablosu.');
  const unique=(rows,key)=>{const ids=rows.map(r=>r[key]);if(new Set(ids).size!==ids.length)throw Error('Yedekte yinelenen kayıt var.');return new Set(ids);};
  const users=unique(s.users,'id'),licenses=unique(s.licenses,'id');unique(s.history,'id');unique(s.publication,'license_id');
  for(const u of s.users){if(typeof u.id!=='string'||typeof u.name!=='string'||!u.name||typeof u.profile!=='string')throw Error('Geçersiz müşteri kaydı.');const p=JSON.parse(u.profile);if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Geçersiz müşteri profili.');}
  for(const r of s.licenses){
   const p=JSON.parse(r.claims),e=JSON.parse(r.envelope);
   if(!crypto.verify(null,Buffer.from(e.payload,'base64'),crypto.createPublicKey(privateKey),Buffer.from(e.signature,'base64'))||JSON.stringify(JSON.parse(Buffer.from(e.payload,'base64').toString()))!==JSON.stringify(p)||p.licenseId!==r.id||p.product!=='asmach-inspection'||!users.has(r.user_id)||typeof r.note!=='string'||![0,1].includes(r.cloud_revoked)||![0,1].includes(r.revocation_requested)||!(r.activation_key===null||typeof r.activation_key==='string'))throw Error('Yedekte lisans imzası veya kayıt bütünlüğü geçersiz.');
  }
  for(const h of s.history)if(!Number.isSafeInteger(h.id)||h.id<1||!Number.isSafeInteger(h.at)||typeof h.action!=='string'||typeof h.detail!=='string'||h.license_id&&!licenses.has(h.license_id)||h.user_id&&!users.has(h.user_id))throw Error('Geçersiz geçmiş kaydı.');
  for(const p of s.publication)if(!licenses.has(p.license_id)||!Number.isSafeInteger(p.revision)||!Number.isSafeInteger(p.at)||typeof p.error!=='string')throw Error('Geçersiz yayın kaydı.');
  for(const current of db.prepare('SELECT id,cloud_revoked,revocation_requested FROM licenses WHERE cloud_revoked=1 OR revocation_requested=1').all()){const old=s.licenses.find(r=>r.id===current.id);if(!old||old.cloud_revoked<current.cloud_revoked||old.revocation_requested<current.revocation_requested)throw Error('Bu yedek mevcut iptal durumunu geri alıyor. Güvenlik nedeniyle yüklenemez.');}
  return {licenses:s.licenses.length,customers:s.users.length,events:s.history.length};
 }
 function restoreSnapshot(s){validateSnapshot(s);db.exec('BEGIN IMMEDIATE');try{
  for(const table of ['publication','history','licenses','users'])db.exec('DELETE FROM '+table);
  const columns={licenses:['id','claims','envelope','note','renewed_from','revocation_requested','cloud_revoked','user_id','activation_key'],users:['id','name','profile'],history:['id','license_id','action','at','detail','user_id'],publication:['license_id','revision','at','error']};
  for(const [table,keys] of Object.entries(columns)){const insert=db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')');for(const row of s[table])insert.run(...keys.map(k=>row[k]??null));}
  db.prepare("UPDATE publication SET revision=0,at=0,error='Yedek geri yüklendi; güncel bulut durumu kontrol edilmeli.'").run();
  audit('','Yedek geri yüklendi','Uyumlu yedek; imzalama anahtarı ve bulut ayarları korunmuştur. Bulut durumu yeniden kontrol edilmelidir.');db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}return {restored:true};}
 function publicationRecorded(id,revision){record(id);db.prepare("INSERT INTO publication VALUES(?,?,?,'') ON CONFLICT(license_id) DO UPDATE SET revision=excluded.revision,at=excluded.at,error='' ").run(id,revision,Math.floor(Date.now()/1000));audit(id,'Aktif listeye yayımlandı','Revizyon '+revision);}
 function publicationFailed(id,error){record(id);const message=String(error||'Gönderim başarısız').slice(0,500);db.prepare("INSERT INTO publication VALUES(?,0,0,?) ON CONFLICT(license_id) DO UPDATE SET error=excluded.error").run(id,message);audit(id,'Buluta gönderilemedi',message);}
 return {list,detail,updateUser,issue,exportLicense,offlineCode,saveLicense,revoke,amend,markRevoked,publicationRecorded,publicationFailed,snapshot,validateSnapshot,restoreSnapshot,publication:()=>db.prepare('SELECT * FROM publication').all(),history:()=>db.prepare('SELECT * FROM history ORDER BY id DESC LIMIT 500').all(),allHistory:()=>db.prepare('SELECT * FROM history ORDER BY id DESC').all(),revocations:()=>db.prepare('SELECT id FROM licenses WHERE revocation_requested=1').all().map(r=>({key:'revoked:'+r.id,value:'1'})),close:()=>db.close(),exportsDir};
}
module.exports={createStore};
