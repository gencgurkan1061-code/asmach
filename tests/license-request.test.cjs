const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),{createManagement}=require('../license-manager/management.cjs');

function requestWorker(){
 const source=fs.readFileSync('licensing-service/worker.js','utf8').replace(/^export \{LicenseActivation\}[^\n]*\n/,'').replace('export default {','globalThis.worker = {');
 const context={Request,Response,TextEncoder,TextDecoder,URL,atob,btoa,crypto:crypto.webcrypto};vm.runInNewContext(source,context);return context.worker;
}

function requestCode(){
 const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.publicKey.export({format:'jwk'}),x=Buffer.from(jwk.x,'base64url'),y=Buffer.from(jwk.y,'base64url'),pub=Buffer.concat([Buffer.from('ECS1'),Buffer.from([32,0,0,0]),x,y]),challenge=crypto.randomBytes(32),deviceId=crypto.createHash('sha256').update(pub).digest('hex'),proof={deviceId,binding:'tpm-cng-v1',publicKey:pub.toString('base64'),challenge:challenge.toString('base64'),signature:crypto.sign('sha256',challenge,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64')};
 const request={version:1,product:'asmach-license-request',requestId:crypto.randomUUID(),deviceId,company:'Test Makina',contact:'test@example.com',note:'Çevrimdışı talep',appVersion:'2.0.7',createdAt:Math.floor(Date.now()/1000),proof};
 return {request,code:'ASM-REQ1-'+Buffer.from(JSON.stringify(request)).toString('base64url')};
}

test('manager verifies TPM signed offline request codes',async()=>{
 const fixture=requestCode(),manage=createManagement({root:process.cwd(),store:{snapshot:()=>({users:[]}),publication:()=>[],allHistory:()=>[]},publish:async()=>{},cloud:{info:()=>({configured:false})}}),out=await manage('request-import',{code:fixture.code});
 assert.equal(out.request.deviceId,fixture.request.deviceId);assert.equal(out.request.company,'Test Makina');assert.equal(out.request.status,'manual');
 const broken=fixture.code.slice(0,-1)+(fixture.code.endsWith('A')?'B':'A');await assert.rejects(()=>manage('request-import',{code:broken}));
});

test('client and worker expose online request plus offline fallback',()=>{
 const ui=fs.readFileSync('src/license-ui.js','utf8'),worker=fs.readFileSync('licensing-service/worker.js','utf8'),rust=fs.readFileSync('src-tauri/src/licensing.rs','utf8');
 assert.match(ui,/Yöneticiye lisans talebi gönder/);assert.match(ui,/data-request-consent/);assert.match(worker,/\/request-license/);assert.match(worker,/\/admin\/requests/);assert.match(rust,/ASM-REQ1-/);assert.match(rust,/license_request_create/);
});

test('worker accepts a TPM-signed online request and rejects an altered proof',async()=>{
 const worker=requestWorker(),entries=new Map(),env={REVOCATIONS:{async get(key,type){const value=entries.get(key);return type==='json'&&value?JSON.parse(value):value??null;},async put(key,value){entries.set(key,value);}}};
 const send=request=>worker.fetch(new Request('https://example.test/request-license',{method:'POST',body:JSON.stringify(request)}),env);
 const {request}=requestCode(),accepted=await send(request);assert.equal(accepted.status,200);assert.equal((await accepted.json()).requestId,request.requestId);
 const stored=JSON.parse(entries.get('license-request:'+request.requestId));assert.equal(stored.deviceId,request.deviceId);assert.equal(stored.company,request.company);assert.equal(stored.status,'new');assert.equal(stored.proof,undefined);
 const replay={...request,requestId:crypto.randomUUID()},again=await send(replay);assert.equal(again.status,200);assert.equal((await again.json()).requestId,request.requestId);
 const broken={...request,deviceId:'0'.repeat(64),requestId:crypto.randomUUID()},denied=await send(broken);assert.equal(denied.status,400);assert.equal(await denied.text(),'Invalid license request');assert.equal(entries.has('license-request:'+broken.requestId),false);
 const badSignature={...request,requestId:crypto.randomUUID(),proof:{...request.proof,signature:Buffer.alloc(64).toString('base64')}},rejected=await send(badSignature);assert.equal(rejected.status,400);assert.equal(await rejected.text(),'Invalid license request');assert.equal(entries.has('license-request:'+badSignature.requestId),false);
});
