const{test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
test('receipt requires matching device proof and cannot refresh last-seen by replay',async()=>{
 const{default:w}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('licensing-service/worker.js','utf8').replace(/^export \{LicenseActivation\}[^\n]*\n/,'')).toString('base64'));
 const signing=crypto.generateKeyPairSync('ed25519'),device=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=device.publicKey.export({format:'jwk'}),pub=Buffer.concat([Buffer.from([69,67,83,49,32,0,0,0]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]),deviceId=crypto.createHash('sha256').update(pub).digest('hex'),data=new Map();let writes=0;
 const env={ADMIN_TOKEN:'a'.repeat(64),STATUS_PRIVATE_KEY:signing.privateKey.export({format:'pem',type:'pkcs8'}),REVOCATIONS:{get:async k=>data.get(k),put:async(k,v)=>{writes++;data.set(k,v);}}};
 const call=(route,body)=>w.fetch(new Request('https://test'+route,{method:'POST',body:JSON.stringify(body)}),env),licenseId=crypto.randomUUID();data.set('revoked:'+licenseId,'1');
 const receipt=await(await call('/validate',{deviceId,licenseId,nonce:crypto.randomUUID()})).json();assert.equal(data.has('seen:'+licenseId),false);
 const client={appVersion:'1.0.24',platform:'windows',arch:'x86_64',updateChannel:'stable'};
 const proofFor=(r,c)=>crypto.sign('sha256',crypto.createHash('sha256').update('asmach-receipt:'+r.payload+':'+r.ackToken+(c?':'+c.appVersion+':'+c.platform+':'+c.arch+':'+c.updateChannel:'')).digest(),{key:device.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64');
 const body={...receipt,client,publicKey:pub.toString('base64'),proof:proofFor(receipt,client)};
 assert.equal((await call('/ack',{...body,proof:Buffer.alloc(64).toString('base64')})).status,403);
 assert.equal((await call('/ack',{...body,ackToken:Buffer.alloc(32).toString('base64')})).status,403);assert.equal(writes,0);
 assert.equal((await call('/ack',body)).status,200);const seen=JSON.parse(data.get('seen:'+licenseId));assert.equal(seen.status,'revoked');assert.equal(seen.deviceId,deviceId);assert.equal(seen.appVersion,'1.0.24');assert.equal(seen.platform,'windows');assert.equal(writes,1);
 assert.equal((await call('/ack',body)).status,200);assert.equal(writes,1);
 const old={...JSON.parse(Buffer.from(body.payload,'base64')),issuedAt:1},payload=Buffer.from(JSON.stringify(old)).toString('base64'),expired={payload,ackToken:crypto.createHmac('sha256',env.ADMIN_TOKEN).update('receipt:'+payload).digest('base64')};
 assert.equal((await call('/ack',{...expired,publicKey:body.publicKey,proof:proofFor(expired)})).status,403);
});
