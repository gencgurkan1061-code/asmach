const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const load=p=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(p,'utf8').replace(/^export \{LicenseActivation\}[^\n]*\n/,'')).toString('base64'));
test('first-device activation is exclusive, signed, renewable and permanently revocable',async()=>{
 const {default:worker}=await load('licensing-service/worker.js'),{LicenseActivation}=await load('licensing-service/activation.js');
 const issuer=crypto.generateKeyPairSync('ed25519'),status=crypto.generateKeyPairSync('ed25519'),kv=new Map(),objects=new Map();let kvReads=0,kvWrites=0,storageWrites=0;
 const env={ADMIN_TOKEN:'a'.repeat(64),LICENSE_PUBLIC_KEY:Buffer.from(issuer.publicKey.export({format:'jwk'}).x,'base64url').toString('base64'),STATUS_PRIVATE_KEY:status.privateKey.export({format:'pem',type:'pkcs8'}),REVOCATIONS:{get:async k=>{kvReads++;return kv.get(k);},put:async(k,v)=>{kvWrites++;return kv.set(k,v);}},ACTIVATIONS:{idFromName:id=>id,get(id){if(!objects.has(id)){const data=new Map();let queue=Promise.resolve();const storage={transaction(fn){const next=queue.then(()=>fn({get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{storageWrites++;return data.set(k,structuredClone(v));}}));queue=next.catch(()=>{});return next;}};objects.set(id,new LicenseActivation({storage},env));}return{fetch:(url,init)=>objects.get(id).fetch(new Request(url,init))};}}};
 const call=(route,body)=>worker.fetch(new Request('https://test'+route,{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN},body:JSON.stringify(body)}),env);
 const licenseId=crypto.randomUUID(),activationKey=crypto.randomUUID().toUpperCase(),now=Math.floor(Date.now()/1000);
 let p={version:2,product:'asmach-inspection',licenseId,licenseNumber:'ASM-TEST',activationMode:'first-device',binding:'tpm-cng-v1',deviceId:'',customer:'Deneme',revision:1,issuedAt:now,notBefore:now-10,expiresAt:now+600};
 const publish=()=>{const b=Buffer.from(JSON.stringify(p));return call('/admin/license',{license:p,activationKey,envelope:{payload:b.toString('base64'),signature:crypto.sign(null,b,issuer.privateKey).toString('base64')}});};
 assert.equal((await publish()).status,200);
 async function device(){const k=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),j=k.publicKey.export({format:'jwk'}),pub=Buffer.concat([Buffer.from([69,67,83,49,32,0,0,0]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]),deviceId=crypto.createHash('sha256').update(pub).digest('hex'),ticket=await(await call('/discover-challenge',{deviceId})).json();return{deviceId,ticket,publicKey:pub.toString('base64'),proof:crypto.sign('sha256',Buffer.from(ticket.challenge,'base64'),{key:k.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64'),activationKey,receiptProof:r=>crypto.sign('sha256',crypto.createHash('sha256').update('asmach-receipt:'+r.payload+':'+r.ackToken).digest(),{key:k.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64')};}
 const devices=await Promise.all([device(),device()]);
 assert.equal((await call('/activate',{...devices[0],activationKey:crypto.randomUUID()})).status,403);
 const results=await Promise.all(devices.map(d=>call('/activate',d)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const winner=devices[results.findIndex(r=>r.status===200)];
 const response=await(await call('/activate',winner)).json();assert.ok(crypto.verify(null,Buffer.from(response.payload,'base64'),status.publicKey,Buffer.from(response.signature,'base64')));
 const grant=JSON.parse(Buffer.from(response.payload,'base64')).licenseUpdate;assert.ok(crypto.verify(null,Buffer.from(grant.payload,'base64'),issuer.publicKey,Buffer.from(grant.signature,'base64')));
 const cert=grant.activation;assert.ok(crypto.verify(null,Buffer.from(cert.payload,'base64'),status.publicKey,Buffer.from(cert.signature,'base64')));assert.equal(JSON.parse(Buffer.from(cert.payload,'base64')).deviceId,winner.deviceId);
 p={...p,revision:2,expiresAt:now+1200};assert.equal((await publish()).status,200);
 // Simulate stale/missing KV replicas: validation must use the durable record.
 kv.delete('license:'+licenseId);
 const validated=JSON.parse(Buffer.from((await(await call('/validate',{licenseId,deviceId:winner.deviceId,nonce:crypto.randomUUID()})).json()).payload,'base64'));assert.equal(validated.status,'active');assert.equal(JSON.parse(Buffer.from(validated.licenseUpdate.payload,'base64')).revision,2);
 assert.equal((await call('/activate',devices.find(d=>d!==winner))).status,409);
 const readsBefore=kvReads,writesBefore=kvWrites,storedBefore=storageWrites;
 const check=()=>call('/validate',{licenseId,deviceId:winner.deviceId,nonce:crypto.randomUUID()});
 const receipt=await(await check()).json();
 const acknowledgement={...receipt,publicKey:winner.publicKey,proof:winner.receiptProof(receipt)};
 assert.equal((await call('/ack',{...acknowledgement,proof:Buffer.alloc(64).toString('base64')})).status,403);assert.equal(storageWrites,storedBefore);
 assert.equal((await call('/ack',acknowledgement)).status,200);assert.equal(storageWrites,storedBefore+1);
 await Promise.all([call('/ack',acknowledgement),call('/ack',acknowledgement)]);assert.equal(storageWrites,storedBefore+1);
 const detail=await(await call('/admin/detail',{licenseId})).json();assert.equal(detail.lastCheck.deviceId,winner.deviceId);assert.equal(detail.lastCheck.status,'active');assert.equal(detail.license.revision,2);
 assert.equal(kvReads,readsBefore,'modern validation, receipt and detail must not read KV');assert.equal(kvWrites,writesBefore,'periodic check must not write KV');
 const first=JSON.parse(Buffer.from(receipt.payload,'base64')),second=JSON.parse(Buffer.from((await(await check()).json()).payload,'base64'));assert.notEqual(first.nonce,second.nonce,'status responses must never be cached');
 // Preserve a KV-only revocation from the previous deployment on first use.
 await objects.get(licenseId).ctx.storage.transaction(async tx=>{const r=await tx.get('record');delete r.kvRevocationChecked;await tx.put('record',r);});kv.set('revoked:'+licenseId,'1');
 assert.equal(JSON.parse(Buffer.from((await(await check()).json()).payload,'base64')).status,'revoked');kv.delete('revoked:'+licenseId);
 assert.equal(JSON.parse(Buffer.from((await(await check()).json()).payload,'base64')).status,'revoked');
 assert.equal((await call('/admin/revoke',{licenseId})).status,200);kv.delete('revoked:'+licenseId);
 assert.equal((await call('/activate',winner)).status,403);assert.equal((await publish()).status,409);
 const revokedEnvelope=await(await check()).json(),revoked=JSON.parse(Buffer.from(revokedEnvelope.payload,'base64'));assert.equal(revoked.status,'revoked');
 assert.equal((await call('/ack',{...revokedEnvelope,publicKey:winner.publicKey,proof:winner.receiptProof(revokedEnvelope)})).status,200);
 await call('/ack',acknowledgement);const revokedDetail=await(await call('/admin/detail',{licenseId})).json();assert.equal(revokedDetail.lastCheck.status,'revoked','an older active receipt cannot erase revocation delivery');
 env.ACTIVATIONS.get=()=>{throw Error('Unavailable');};assert.equal((await check()).status,503,'storage failures must not return a cached active decision');
});
