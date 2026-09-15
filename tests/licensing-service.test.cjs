const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('licensing-service/worker.js','utf8').replace(/^export \{LicenseActivation\}[^\n]*\n/,'')).toString('base64'));
test('authenticated administration publishes signed revisions and permanent revocation',async()=>{
 const{default:w}=await load(),keys=crypto.generateKeyPairSync('ed25519'),data=new Map();
 const env={ADMIN_TOKEN:'x'.repeat(64),LICENSE_PUBLIC_KEY:Buffer.from(keys.publicKey.export({format:'jwk'}).x,'base64url').toString('base64'),STATUS_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}),REVOCATIONS:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)}};
 const request=(route,body,auth=true)=>w.fetch(new Request('https://test'+route,{method:'POST',headers:auth?{Authorization:'Bearer '+env.ADMIN_TOKEN}:{},body:JSON.stringify(body)}),env);
 assert.equal((await request('/admin/revoke',{licenseId:crypto.randomUUID()},false)).status,401);assert.equal(data.size,0);
 const p={version:2,binding:'tpm-cng-v1',product:'asmach-inspection',licenseId:crypto.randomUUID(),deviceId:'a'.repeat(64),revision:2,notBefore:100,expiresAt:1000};
 const sign=p=>{const bytes=Buffer.from(JSON.stringify(p));return{payload:bytes.toString('base64'),signature:crypto.sign(null,bytes,keys.privateKey).toString('base64')};};
 assert.equal((await request('/admin/license',{license:p,envelope:sign(p)})).status,200);
 const active=await(await request('/validate',{licenseId:p.licenseId,deviceId:p.deviceId,nonce:crypto.randomUUID()},false)).json();assert.equal(JSON.parse(Buffer.from(active.payload,'base64')).status,'active');
 assert.equal((await request('/admin/license',{license:p,envelope:sign({...p,revision:1})})).status,409);
 assert.equal((await request('/admin/license',{license:p,envelope:{...sign(p),payload:Buffer.from('{}').toString('base64')}})).status,400);
 const body={licenseId:p.licenseId,deviceId:p.deviceId,nonce:crypto.randomUUID()};
 let e=await(await request('/validate',body,false)).json(),s=JSON.parse(Buffer.from(e.payload,'base64'));assert.equal(s.licenseUpdate.payload,sign(p).payload);
 e=await(await request('/validate',{...body,deviceId:'b'.repeat(64)},false)).json();assert.equal(JSON.parse(Buffer.from(e.payload,'base64')).licenseUpdate,undefined);
 assert.equal((await request('/admin/revoke',{licenseId:p.licenseId})).status,200);
 e=await(await request('/validate',body,false)).json();s=JSON.parse(Buffer.from(e.payload,'base64'));assert.equal(s.status,'revoked');assert.equal(s.licenseUpdate,undefined);
 assert.equal((await request('/admin/license',{license:p,envelope:sign({...p,revision:3})})).status,409);
 data.delete('revoked:'+p.licenseId);data.delete('license:'+p.licenseId);e=await(await request('/validate',body,false)).json();assert.equal(JSON.parse(Buffer.from(e.payload,'base64')).status,'inactive');
});
test('service signs missing and revoked responses with request-bound nonce',async()=>{
 const {default:worker}=await load(),{privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');let revoked=false;
 const env={STATUS_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'}),REVOCATIONS:{get:async()=>revoked?'1':null}};
 const data={licenseId:crypto.randomUUID(),deviceId:'a'.repeat(64),nonce:crypto.randomUUID()};
 for(const status of ['inactive','revoked']){revoked=status==='revoked';const r=await worker.fetch(new Request('https://test/validate',{method:'POST',body:JSON.stringify(data)}),env);assert.equal(r.status,200);const e=await r.json();assert.ok(crypto.verify(null,Buffer.from(e.payload,'base64'),publicKey,Buffer.from(e.signature,'base64')));const p=JSON.parse(Buffer.from(e.payload,'base64'));assert.equal(p.status,status);assert.equal(p.nonce,data.nonce);assert.equal(p.deviceId,data.deviceId);assert.equal(p.licenseId,data.licenseId);assert.equal(p.product,'asmach-inspection');}
});
test('service rejects malformed input and has no unauthenticated admin endpoint',async()=>{const{default:w}=await load();for(const body of ['null','{}','x','x'.repeat(3000)]){const r=await w.fetch(new Request('https://test/validate',{method:'POST',body}),{});assert.ok([400,413].includes(r.status));}assert.equal((await w.fetch(new Request('https://test/revoke',{method:'POST'}),{})).status,404);});
test('version notices are administered privately and served only to older matching clients',async()=>{
 const{default:w}=await load(),data=new Map(),env={ADMIN_TOKEN:'r'.repeat(64),REVOCATIONS:{get:async key=>data.get(key)||null,put:async(key,value)=>data.set(key,value)}};
 const admin=body=>w.fetch(new Request('https://test/admin/release',{method:'POST',headers:{Authorization:'Bearer '+env.ADMIN_TOKEN},body:JSON.stringify(body)}),env);
 const release={version:'1.0.26',minimumVersion:'0.0.0',target:'windows',arch:'x86_64',notes:'Yeni sürüm yöneticiden alınabilir',pubDate:'2026-09-13T00:00:00Z'};
 assert.equal((await admin({release})).status,200);assert.deepEqual((await(await admin({})).json()).release,release);
 const get=version=>w.fetch(new Request('https://test/version/windows/x86_64/'+version),env);
 const update=await get('1.0.25');assert.equal(update.status,200);assert.deepEqual(await update.json(),{version:'1.0.26',minimumVersion:'0.0.0',notes:'Yeni sürüm yöneticiden alınabilir',pubDate:'2026-09-13T00:00:00Z'});
 assert.equal((await get('1.0.26')).status,204);assert.equal((await w.fetch(new Request('https://test/version/linux/x86_64/1.0.25'),env)).status,204);
 assert.equal((await w.fetch(new Request('https://test/downloads/releases/1.0.26/asmach.exe'),env)).status,404);
 assert.equal((await w.fetch(new Request('https://test/admin/release',{method:'POST',body:'{}'}),env)).status,401);
});
test('private keys are excluded from frontend and public config',()=>{const c=JSON.parse(fs.readFileSync('src-tauri/license-config.json'));assert.equal(Buffer.from(c.licensePublicKey,'base64').length,32);assert.equal(Buffer.from(c.statusPublicKey,'base64').length,32);assert.ok(!fs.readFileSync('dist-desktop/native-bootstrap.js','utf8').includes('BEGIN PRIVATE KEY'));assert.ok(fs.readFileSync('.gitignore','utf8').includes('.license-admin/'));});
