const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');

const load=file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(file,'utf8').replace(/^export \{LicenseActivation\}[^\n]*\n/,'')).toString('base64'));
const payload=response=>response.json().then(e=>JSON.parse(Buffer.from(e.payload,'base64')));

test('online key works without TPM; an opted-in TPM lease never exceeds license expiry',async()=>{
 const {default:worker}=await load('licensing-service/worker.js');
 const {LicenseActivation}=await load('licensing-service/activation.js');
 const issuer=crypto.generateKeyPairSync('ed25519'),status=crypto.generateKeyPairSync('ed25519');
 const kv=new Map(),records=new Map(),env={ADMIN_TOKEN:'a'.repeat(64),LICENSE_PUBLIC_KEY:Buffer.from(issuer.publicKey.export({format:'jwk'}).x,'base64url').toString('base64'),STATUS_PRIVATE_KEY:status.privateKey.export({format:'pem',type:'pkcs8'}),REVOCATIONS:{get:async k=>kv.get(k),put:async(k,v)=>kv.set(k,v)},ACTIVATIONS:{idFromName:id=>id,get(id){if(!records.has(id)){const data=new Map(),storage={transaction:fn=>fn({get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v))})};records.set(id,new LicenseActivation({storage},env));}return{fetch:(url,init)=>records.get(id).fetch(new Request(url,init))};}}};
 const call=(route,body)=>worker.fetch(new Request('https://test'+route,{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN},body:JSON.stringify(body)}),env);
 const licenseId=crypto.randomUUID(),activationKey=crypto.randomUUID().toUpperCase(),now=Math.floor(Date.now()/1000),expiresAt=now+15*86400;
 const claims={version:2,product:'asmach-inspection',licenseId,activationMode:'first-device',binding:'tpm-cng-v1',deviceId:'',customer:'Test',revision:1,issuedAt:now,notBefore:now-1,expiresAt};
 const bytes=Buffer.from(JSON.stringify(claims)),envelope={payload:bytes.toString('base64'),signature:crypto.sign(null,bytes,issuer.privateKey).toString('base64')};
 assert.equal((await call('/admin/license',{licenseId,activationKey,envelope})).status,200);
 function identity(binding){const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.publicKey.export({format:'jwk'}),pub=Buffer.concat([Buffer.from([69,67,83,49,32,0,0,0]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]),deviceId=crypto.createHash('sha256').update(pub).digest('hex');return{deviceId,binding,publicKey:pub.toString('base64'),sign:challenge=>({deviceId,binding,publicKey:pub.toString('base64'),challenge,signature:crypto.sign('sha256',Buffer.from(challenge,'base64'),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64')})};}
 const online=identity('software-cng-v1'),tpm=identity('tpm-cng-v1');
 async function ticket(){return(await call('/discover-challenge',{deviceId:online.deviceId})).json();}
 const first=await ticket(),proof=online.sign(first.challenge);
 const activated=await call('/activate',{activationKey,deviceId:online.deviceId,binding:proof.binding,publicKey:proof.publicKey,proof:proof.signature,ticket:first});
 assert.equal(activated.status,200);
 const activation=await payload(activated);assert.equal(activation.status,'active');assert.equal(JSON.parse(Buffer.from(activation.licenseUpdate.activation.payload,'base64')).binding,'software-cng-v1');
 const nonce=crypto.randomUUID();assert.equal((await call('/validate',{licenseId,deviceId:online.deviceId,nonce})).status,403,'online identity must prove possession');
 const second=await ticket();assert.equal((await call('/validate',{licenseId,deviceId:online.deviceId,nonce:crypto.randomUUID(),ticket:second,onlineProof:online.sign(second.challenge)})).status,200);
 const third=await ticket(),enabled=await call('/offline-enable',{licenseId,deviceId:online.deviceId,binding:online.binding,ticket:third,publicKey:online.publicKey,proof:online.sign(third.challenge).signature,tpmProof:tpm.sign(third.challenge)});
 assert.equal(enabled.status,200);
 const lease=await payload(enabled);assert.equal(lease.tpmDeviceId,tpm.deviceId);assert.equal(lease.offlineUntil,expiresAt,'15-day license must not become 90 days');
 const fourth=await ticket();assert.equal((await call('/validate',{licenseId,deviceId:online.deviceId,nonce:crypto.randomUUID(),ticket:fourth,onlineProof:online.sign(fourth.challenge)})).status,403,'TPM-enabled license cannot fall back to software-only proof');
 const renewed=await call('/validate',{licenseId,deviceId:online.deviceId,nonce:crypto.randomUUID(),ticket:fourth,onlineProof:online.sign(fourth.challenge),tpmProof:tpm.sign(fourth.challenge)});
 assert.equal(renewed.status,200);assert.equal((await payload(renewed)).offlineUntil,expiresAt);
 const detail=await(await call('/admin/detail',{licenseId})).json();assert.equal(detail.activation.tpmDeviceId,tpm.deviceId);assert.equal(detail.activation.offlineUntil,expiresAt);assert.ok(detail.activation.lastTpmCheck);
 const longer={...claims,revision:2,expiresAt:now+200*86400},longBytes=Buffer.from(JSON.stringify(longer)),longEnvelope={payload:longBytes.toString('base64'),signature:crypto.sign(null,longBytes,issuer.privateKey).toString('base64')};
 assert.equal((await call('/admin/license',{licenseId,activationKey,envelope:longEnvelope})).status,200);
 const fifth=await ticket(),extended=await payload(await call('/validate',{licenseId,deviceId:online.deviceId,nonce:crypto.randomUUID(),ticket:fifth,onlineProof:online.sign(fifth.challenge),tpmProof:tpm.sign(fifth.challenge)}));
 assert.ok(extended.offlineUntil<=extended.issuedAt+90*86400&&extended.offlineUntil>=extended.issuedAt+90*86400-1,'longer license must still require a check within 90 days');
 const renewalTicket=await ticket(),renewalProof=online.sign(renewalTicket.challenge);
 const renewalBody={activationKey,deviceId:online.deviceId,binding:online.binding,publicKey:online.publicKey,proof:renewalProof.signature,ticket:renewalTicket};
 assert.equal((await call('/activate',renewalBody)).status,403,'an enrolled TPM remains required when re-entering the key');
 const reactivated=await payload(await call('/activate',{...renewalBody,tpmProof:tpm.sign(renewalTicket.challenge)}));
 assert.equal(reactivated.status,'active');assert.equal(reactivated.tpmDeviceId,tpm.deviceId);
 assert.equal(reactivated.offlineUntil,Math.min(longer.expiresAt,reactivated.issuedAt+90*86400));
 assert.equal(JSON.parse(Buffer.from(reactivated.licenseUpdate.payload,'base64')).revision,2);

 // An older Worker could claim the software key's deviceId before recording
 // its binding. Repeating activation after deployment must repair that record.
 const legacyId=crypto.randomUUID(),legacyKey=crypto.randomUUID().toUpperCase();
 const legacyClaims={...claims,licenseId:legacyId},legacyBytes=Buffer.from(JSON.stringify(legacyClaims));
 const legacyEnvelope={payload:legacyBytes.toString('base64'),signature:crypto.sign(null,legacyBytes,issuer.privateKey).toString('base64')};
 assert.equal((await call('/admin/license',{licenseId:legacyId,activationKey:legacyKey,envelope:legacyEnvelope})).status,200);
 const legacyRecord=env.ACTIVATIONS.get(legacyId),keyHash=crypto.createHash('sha256').update(legacyKey).digest('hex');
 assert.equal((await legacyRecord.fetch('https://activation/internal',{method:'POST',body:JSON.stringify({action:'claim',keyHash,deviceId:online.deviceId})})).status,200);
 const retryTicket=await ticket(),retryProof=online.sign(retryTicket.challenge);
 const repaired=await call('/activate',{activationKey:legacyKey,deviceId:online.deviceId,binding:retryProof.binding,publicKey:retryProof.publicKey,proof:retryProof.signature,ticket:retryTicket});
 assert.equal(repaired.status,200);
 assert.equal(JSON.parse(Buffer.from((await payload(repaired)).licenseUpdate.activation.payload,'base64')).binding,'software-cng-v1');
 const repairedDetail=await(await call('/admin/detail',{licenseId:legacyId})).json();
 assert.equal(repairedDetail.activation.binding,'software-cng-v1');
 assert.equal((await(await legacyRecord.fetch('https://activation/internal',{method:'POST',body:JSON.stringify({action:'detail'})})).json()).record.publicKey,online.publicKey);
 assert.equal((await legacyRecord.fetch('https://activation/internal',{method:'POST',body:JSON.stringify({action:'claim',keyHash,deviceId:online.deviceId,binding:'tpm-cng-v1',publicKey:online.publicKey})})).status,409);
});
