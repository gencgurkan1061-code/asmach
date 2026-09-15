'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function passwordKey(password,salt){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Yedek parolası 12–256 karakter olmalı.');return crypto.scryptSync(password,salt,32);}
function encrypt(payload,password){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=passwordKey(password,salt);try{const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('ASMach-Backup-1'));return {format:'ASMach-Backup-1',salt:salt.toString('base64'),iv:iv.toString('base64'),data:Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')};}finally{key.fill(0);}}
function decrypt(archive,password){if(!archive||archive.format!=='ASMach-Backup-1'||typeof archive.data!=='string'||archive.data.length>20000000)throw Error('Geçersiz veya çok büyük yedek.');const salt=Buffer.from(archive.salt||'','base64'),iv=Buffer.from(archive.iv||'','base64'),tag=Buffer.from(archive.tag||'','base64');if(salt.length!==16||iv.length!==12||tag.length!==16)throw Error('Geçersiz yedek başlığı.');const key=passwordKey(password,salt);try{const cipher=crypto.createDecipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('ASMach-Backup-1'));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(Buffer.from(archive.data,'base64')),cipher.final()]).toString());}catch{throw Error('Parola yanlış veya yedek bozulmuş.');}finally{key.fill(0);}}
function createManagement({root,store,publish,cloud}){
 const plans=new Map();let busy=false;
 const expiryTimer=setInterval(()=>{for(const [id,p] of plans)if(p.until<Date.now())plans.delete(id);},30000);expiryTimer.unref();
 const fingerprint=()=>hash(store.snapshot());
 function plan(kind,value){for(const [id,p] of plans)if(p.until<Date.now())plans.delete(id);if(plans.size>=4)plans.delete(plans.keys().next().value);const id=crypto.randomUUID();plans.set(id,{kind,value,fingerprint:fingerprint(),until:Date.now()+5*60000});return id;}
 function take(id,kind){const p=plans.get(id);plans.delete(id);if(!p||p.kind!==kind||p.until<Date.now())throw Error('Önizleme süresi doldu. Yeniden önizleyin.');if(p.fingerprint!==fingerprint())throw Error('Kayıtlar değişti. Güncel kayıtlarla yeniden önizleyin.');return p.value;}
 function payload(){return {createdAt:new Date().toISOString(),snapshot:store.snapshot(),privateKey:fs.readFileSync(path.join(root,'.license-admin/license.pem'),'utf8')};}
 function validatePayload(p){const key=crypto.createPrivateKey(p.privateKey);const pub=Buffer.from(crypto.createPublicKey(key).export({format:'jwk'}).x,'base64url').toString('base64');if(pub!==p.snapshot?.publicKey)throw Error('Yedek anahtarı geçersiz.');return store.validateSnapshot(p.snapshot);}
 function importedRequest(code){
  const compact=String(code||'').replace(/\s/g,'');if(!compact.startsWith('ASM-REQ1-')||compact.length>12000)throw Error('Geçerli bir ASM-REQ1 talep kodu girin.');
  let r;try{r=JSON.parse(Buffer.from(compact.slice(9),'base64url'));}catch{throw Error('Talep kodu bozuk veya eksik.');}
  const p=r.proof||{},pub=Buffer.from(p.publicKey||'','base64'),challenge=Buffer.from(p.challenge||'','base64'),signature=Buffer.from(p.signature||'','base64');
  if(r.version!==1||r.product!=='asmach-license-request'||!/^[a-f0-9-]{36}$/.test(r.requestId||'')||!/^[a-f0-9]{64}$/.test(r.deviceId||'')||pub.length!==72||pub.subarray(0,4).toString()!=='ECS1'||pub.readUInt32LE(4)!==32||challenge.length!==32||signature.length!==64||crypto.createHash('sha256').update(pub).digest('hex')!==r.deviceId||p.deviceId!==r.deviceId)throw Error('Talep kodundaki bilgisayar kimliği doğrulanamadı.');
  const key=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:pub.subarray(8,40).toString('base64url'),y:pub.subarray(40,72).toString('base64url')},format:'jwk'});if(!crypto.verify('sha256',challenge,{key,dsaEncoding:'ieee-p1363'},signature))throw Error('Talep kodunun TPM imzası geçersiz.');
  if(typeof r.company!=='string'||r.company.trim().length<2||r.company.length>160||typeof r.contact!=='string'||r.contact.length>200||typeof r.note!=='string'||r.note.length>500)throw Error('Talep bilgileri geçersiz.');
  return {requestId:r.requestId,deviceId:r.deviceId,company:r.company.trim(),contact:r.contact.trim(),note:r.note.trim(),appVersion:String(r.appVersion||''),createdAt:r.createdAt,status:'manual',manual:true};
 }
 const handle=async function management(action,body){
  if(busy&&action!=='management')throw Error('Başka yönetim işlemi sürüyor.');
  if(action==='management'){let requests=[],requestError='';if(cloud.info().configured){try{requests=(await cloud.call('requests',{})).requests||[];}catch(e){requestError=e.message;}}return {publication:store.publication(),history:store.allHistory(),customers:store.snapshot().users.map(u=>({id:u.id,name:u.name,...JSON.parse(u.profile)})),requests,requestError};}
  if(action==='request-import')return {request:importedRequest(body.code)};
  if(action==='request-status'){if(!cloud.info().configured)throw Error('Bulut bağlantısı yapılandırılmamış.');return cloud.call('request-status',{requestId:body.requestId,status:body.status,licenseId:body.licenseId||''});}
  if(action==='backup'){const archive=encrypt(payload(),body.password);if(JSON.stringify(archive).length>20000000)throw Error('Yedek 20 MB sınırını aşıyor. Yönetim uygulamasını kapatıp tam klasör yedeği alın.');return {archive,name:'ASMach-'+new Date().toISOString().replace(/[:.]/g,'-')+'.asm-backup'};}
  if(action==='restore-preview'){const p=decrypt(body.archive,body.password),counts=validatePayload(p);return {planId:plan('restore',{payload:p,password:body.password}),createdAt:p.createdAt,...counts,current:validatePayload(payload())};}
  if(action==='restore-commit'){
   if(busy)throw Error('Başka yönetim işlemi sürüyor.');if(body.confirmation!=='GERİ YÜKLE')throw Error('Onay metni gerekli.');const p=take(body.planId,'restore');validatePayload(p.payload);
   const archive=encrypt(payload(),p.password),dir=path.join(root,'.license-admin/backups');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'before-restore-'+crypto.randomUUID()+'.asm-backup');fs.writeFileSync(file,JSON.stringify(archive),{flag:'wx',mode:0o600});
   store.restoreSnapshot(p.payload.snapshot);plans.clear();return {restored:true,safetyBackup:file,message:'Kayıtlar geri yüklendi. Anahtar ve bulut ayarları korunmuştur; buluta otomatik gönderim yapılmadı.'};
  }
  if(action==='bulk-preview'){
   if(!['extend','publish'].includes(body.action)||!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>100||new Set(body.ids).size!==body.ids.length)throw Error('1–100 farklı lisans seçin.');
   if(body.action==='publish'&&!cloud.info().configured)throw Error('Bulut bağlantısı yapılandırılmamış.');
   const months=Number(body.months);if(body.action==='extend'&&(!Number.isInteger(months)||months<1||months>36))throw Error('1–36 ay seçin.');
   const list=store.list(),rows=body.ids.map(id=>{const r=list.find(r=>r.licenseId===id);if(!r||r.cloudRevoked||r.revocationRequested)throw Error('İptal edilmiş veya bulunamayan lisans seçilemez.');if(body.action==='publish'&&r.expiresAt<=Date.now()/1000)throw Error('Süresi dolan lisans önce uzatılmalı.');let expiry=r.expiresAt;if(body.action==='extend'){const d=new Date(Math.max(Date.now(),r.expiresAt*1000)),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));expiry=Math.floor(d.getTime()/1000);}return {id,customer:r.customer,before:r.expiresAt,after:expiry};});
   return {planId:plan('bulk',{action:body.action,rows}),rows,cloud:cloud.info().configured};
  }
  if(action==='bulk-commit'){
   if(busy)throw Error('Başka yönetim işlemi sürüyor.');if(body.confirmed!==true)throw Error('Önizleme onayı gerekli.');const p=take(body.planId,'bulk');busy=true;const results=[];
   try{for(const r of p.rows){let saved=false;try{if(p.action==='extend'){store.amend(r.id,new Date(r.after*1000).toISOString());saved=true;}if(cloud.info().configured)await publish(r.id);results.push({id:r.id,customer:r.customer,ok:true,saved,message:cloud.info().configured?'Buluta gönderildi; cihaz onayı beklenir.':'Yerelde kaydedildi; buluta gönderilmedi.'});}catch(e){results.push({id:r.id,customer:r.customer,ok:false,saved,message:e.message});}}}finally{busy=false;}return {results};
  }
  throw Error('Yönetim işlemi bulunamadı.');
 };
 return Object.assign(handle,{isBusy:()=>busy,dispose:()=>{clearInterval(expiryTimer);plans.clear();}});
}
module.exports={createManagement,encrypt,decrypt};
