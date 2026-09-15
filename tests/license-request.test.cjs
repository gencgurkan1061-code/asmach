const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createManagement}=require('../license-manager/management.cjs');

function requestCode(){
 const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.publicKey.export({format:'jwk'}),x=Buffer.from(jwk.x,'base64url'),y=Buffer.from(jwk.y,'base64url'),pub=Buffer.concat([Buffer.from('ECS1'),Buffer.from([32,0,0,0]),x,y]),challenge=crypto.randomBytes(32),deviceId=crypto.createHash('sha256').update(pub).digest('hex'),proof={deviceId,binding:'tpm-cng-v1',publicKey:pub.toString('base64'),challenge:challenge.toString('base64'),signature:crypto.sign('sha256',challenge,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64')};
 const request={version:1,product:'asmach-license-request',requestId:crypto.randomUUID(),deviceId,company:'Test Makina',contact:'test@example.com',note:'Çevrimdışı talep',appVersion:'2.0.5',createdAt:Math.floor(Date.now()/1000),proof};
 return {request,code:'ASM-REQ1-'+Buffer.from(JSON.stringify(request)).toString('base64url')};
}

test('manager verifies TPM signed offline request codes',async()=>{
 const fixture=requestCode(),manage=createManagement({root:process.cwd(),store:{snapshot:()=>({users:[]}),publication:()=>[],allHistory:()=>[]},publish:async()=>{},cloud:{info:()=>({configured:false})}}),out=await manage('request-import',{code:fixture.code});
 assert.equal(out.request.deviceId,fixture.request.deviceId);assert.equal(out.request.company,'Test Makina');assert.equal(out.request.status,'manual');
 const broken=fixture.code.slice(0,-1)+(fixture.code.endsWith('A')?'B':'A');await assert.rejects(()=>manage('request-import',{code:broken}));
});

test('client and worker expose online request plus offline fallback',()=>{
 const fs=require('node:fs'),ui=fs.readFileSync('src/license-ui.js','utf8'),worker=fs.readFileSync('licensing-service/worker.js','utf8'),rust=fs.readFileSync('src-tauri/src/licensing.rs','utf8');
 assert.match(ui,/Yöneticiye lisans talebi gönder/);assert.match(ui,/data-request-consent/);assert.match(worker,/\/request-license/);assert.match(worker,/\/admin\/requests/);assert.match(rust,/ASM-REQ1-/);assert.match(rust,/license_request_create/);
});
