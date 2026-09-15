export {LicenseActivation} from './activation.js';
// Cloudflare Worker. No license-issuance private key belongs here.
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const from64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
// Cache only imported cryptographic keys, never a license status or nonce-bound response.
const keyCache=new Map();
const semver=value=>{const m=String(value||'').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);return m?m.slice(1,4).map(Number):null;};
const versionCompare=(a,b)=>{const x=semver(a),y=semver(b);if(!x||!y)return 0;for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
function imported(name,value,create){let c=keyCache.get(name);if(!c||c.value!==value){c={value,promise:create()};keyCache.set(name,c);c.promise.catch(()=>{if(keyCache.get(name)===c)keyCache.delete(name);});}return c.promise;}
async function signed(payload,env,withReceipt=true){
 const pem=env.STATUS_PRIVATE_KEY.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
 const key=await imported('status',pem,()=>crypto.subtle.importKey('pkcs8',from64(pem),{name:'Ed25519'},false,['sign']));
 const data=encoder.encode(JSON.stringify(payload)),encoded=b64(data);
 const receipt=withReceipt&&env.ADMIN_TOKEN?.length>=32?await imported('receipt',env.ADMIN_TOKEN,()=>crypto.subtle.importKey('raw',encoder.encode(env.ADMIN_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign'])):null;
 return Response.json({payload:encoded,signature:b64(await crypto.subtle.sign('Ed25519',key,data)),...(receipt?{ackToken:b64(await crypto.subtle.sign('HMAC',receipt,encoder.encode('receipt:'+encoded)))}:{})},{headers:{'Cache-Control':'no-store'}});
}
async function activationRecord(env,id,body){const stub=env.ACTIVATIONS.get(env.ACTIVATIONS.idFromName(id));return stub.fetch('https://activation/internal',{method:'POST',body:JSON.stringify(body)});}
async function boundEnvelope(r,env){if(!r?.deviceId||!r.envelope||r.revoked)return null;const p=JSON.parse(new TextDecoder().decode(from64(r.envelope.payload)));const activation=await (await signed({version:1,product:'asmach-activation',licenseId:p.licenseId,deviceId:r.deviceId,issuedAt:r.activatedAt},env,false)).json();return {...r.envelope,activation};}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname.startsWith('/version/')){
  const parts=url.pathname.split('/').filter(Boolean),target=parts[1],arch=parts[2],current=decodeURIComponent(parts.slice(3).join('/'));
  const raw=await env.REVOCATIONS.get('release:stable');if(!raw)return new Response(null,{status:204});
  let release;try{release=JSON.parse(raw);}catch{return new Response(null,{status:204});}
  if(!semver(current)||!semver(release.version)||versionCompare(current,release.version)>=0||release.target!==target||release.arch!==arch)return new Response(null,{status:204});
  return Response.json({version:release.version,minimumVersion:release.minimumVersion,notes:release.notes||'',pubDate:release.pubDate},{headers:{'Cache-Control':'no-store'}});
 }
 const admin=['/admin/ping','/admin/license','/admin/revoke','/admin/detail','/admin/release'].includes(url.pathname);
 if(request.method!=='POST'||(!admin&&!['/validate','/discover','/discover-challenge','/activate','/ack'].includes(url.pathname)))return new Response('Not found',{status:404});
 if(admin){const expected=env.ADMIN_TOKEN||'',provided=request.headers.get('authorization')||'';const a=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode('Bearer '+expected))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(provided)));let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(expected.length<32||diff)return new Response('Unauthorized',{status:401});}
 const limit=admin||url.pathname==='/ack'?24000:2048;
 if(Number(request.headers.get('content-length'))>limit)return new Response('Too large',{status:413});
 // Bound streamed input too: content-length is not trusted.
 const reader=request.body?.getReader();if(!reader)return new Response('Bad request',{status:400});let chunks=[],size=0;
 for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(value);}
 let body;try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{return new Response('Bad JSON',{status:400});}
 if(!body||typeof body!=='object')return new Response('Bad request',{status:400});
 const ok=value=>Response.json({ok:true,...value},{headers:{'Cache-Control':'no-store'}});
 if(url.pathname==='/ack'){
  let receipt;
  try{
   if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)throw Error();
   const hmac=await crypto.subtle.importKey('raw',encoder.encode(env.ADMIN_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['verify']);
   if(!await crypto.subtle.verify('HMAC',hmac,from64(body.ackToken),encoder.encode('receipt:'+body.payload)))throw Error();
   receipt=JSON.parse(new TextDecoder().decode(from64(body.payload)));
   const time=Math.floor(Date.now()/1000);
   if(receipt.product!=='asmach-inspection'||!Number.isSafeInteger(receipt.issuedAt)||receipt.issuedAt>time+30||receipt.issuedAt<time-300||!/^[a-f0-9-]{36}$/.test(receipt.licenseId)||!['active','revoked','inactive'].includes(receipt.status))throw Error();
   const pub=from64(body.publicKey);if(pub.length!==72||pub[0]!==69||pub[1]!==67||pub[2]!==83||pub[3]!==49||pub[4]!==32||pub[5]||pub[6]||pub[7])throw Error();
   const deviceId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pub)),x=>x.toString(16).padStart(2,'0')).join('');if(deviceId!==receipt.deviceId)throw Error();
   const sec1=new Uint8Array(65);sec1[0]=4;sec1.set(pub.slice(8),1);const key=await crypto.subtle.importKey('raw',sec1,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   const hasClient=body.client!==undefined,client=body.client||{},appVersion=String(client.appVersion||''),platform=String(client.platform||''),arch=String(client.arch||''),updateChannel=String(client.updateChannel||'');
   if(hasClient&&(!semver(appVersion)||!['windows','linux','macos'].includes(platform)||!/^[a-z0-9_-]{2,24}$/.test(arch)||!['stable'].includes(updateChannel)))throw Error();
   const challengeText=hasClient?'asmach-receipt:'+body.payload+':'+body.ackToken+':'+appVersion+':'+platform+':'+arch+':'+updateChannel:'asmach-receipt:'+body.payload+':'+body.ackToken;
   const challenge=await crypto.subtle.digest('SHA-256',encoder.encode(challengeText));
   if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,from64(body.proof),challenge))throw Error();
   if(hasClient)receipt.client={appVersion,platform,arch,updateChannel};
  }catch{return new Response('Invalid receipt proof',{status:403});}
  if(env.ACTIVATIONS){const response=await activationRecord(env,receipt.licenseId,{action:'ack',receipt:{issuedAt:receipt.issuedAt,status:receipt.status,deviceId:receipt.deviceId,...receipt.client}});if(!response.ok)return new Response('Receipt storage unavailable',{status:503});return ok({});}
  const previous=await env.REVOCATIONS.get('seen:'+receipt.licenseId),old=previous?JSON.parse(previous):null;
  // Replays never advance the last check time; coalesce ordinary checks to limit KV writes.
  if(!old||receipt.issuedAt>old.checkedAt&&(receipt.status!==old.status||receipt.client?.appVersion!==old.appVersion||receipt.issuedAt-old.checkedAt>=300))await env.REVOCATIONS.put('seen:'+receipt.licenseId,JSON.stringify({checkedAt:receipt.issuedAt,status:receipt.status,deviceId:receipt.deviceId,...receipt.client}));
  return ok({});
 }
 if(url.pathname.startsWith('/discover')||url.pathname==='/activate'){
  const {deviceId}=body;if(!/^[a-f0-9]{64}$/.test(deviceId||''))return new Response('Bad device',{status:400});
  const hmac=await crypto.subtle.importKey('raw',encoder.encode(env.ADMIN_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  if(url.pathname==='/discover-challenge'){const challenge=b64(crypto.getRandomValues(new Uint8Array(32))),payload=b64(encoder.encode(JSON.stringify({deviceId,challenge,expiresAt:Math.floor(Date.now()/1000)+90})));return ok({challenge,payload,signature:b64(await crypto.subtle.sign('HMAC',hmac,encoder.encode(payload)))});}
  let ticket;
  try{if(!await crypto.subtle.verify('HMAC',hmac,from64(body.ticket.signature),encoder.encode(body.ticket.payload)))throw Error();ticket=JSON.parse(new TextDecoder().decode(from64(body.ticket.payload)));if(ticket.deviceId!==deviceId||ticket.expiresAt<Math.floor(Date.now()/1000))throw Error();
   const pub=from64(body.publicKey);if(pub.length!==72||pub[0]!==69||pub[1]!==67||pub[2]!==83||pub[3]!==49||pub[4]!==32||pub[5]||pub[6]||pub[7])throw Error();
   const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pub)),x=>x.toString(16).padStart(2,'0')).join('');if(id!==deviceId)throw Error();
   const sec1=new Uint8Array(65);sec1[0]=4;sec1.set(pub.slice(8),1);const key=await crypto.subtle.importKey('raw',sec1,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,from64(body.proof),from64(ticket.challenge)))throw Error();
  }catch{return new Response('Invalid device proof',{status:403});}
  if(url.pathname==='/activate'){
   const code=String(body.activationKey||'').trim().toUpperCase();if(!/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(code))return new Response('Invalid activation key',{status:400});
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(code))),x=>x.toString(16).padStart(2,'0')).join('');
   const id=await env.REVOCATIONS.get('activation-key:'+hash);if(!id)return new Response('License key not found',{status:403});
   // Activation is rare; preserve any historical KV revocation before issuing a certificate.
   if(await env.REVOCATIONS.get('revoked:'+id)){const denied=await activationRecord(env,id,{action:'revoke'});if(!denied.ok)return new Response('Revocation storage unavailable',{status:503});return new Response('License revoked',{status:403});}
   const response=await activationRecord(env,id,{action:'claim',keyHash:hash,deviceId});if(!response.ok)return response;
   const record=await response.json(),licenseUpdate=await boundEnvelope(record,env);
   return signed({version:1,product:'asmach-inspection',licenseId:id,deviceId,nonce:ticket.challenge,status:'active',issuedAt:Math.floor(Date.now()/1000),licenseUpdate},env);
  }
  let id=await env.REVOCATIONS.get('device:'+deviceId);
  // Compatibility with licenses published before the device index existed.
  if(!id){const page=await env.REVOCATIONS.list({prefix:'license:',limit:100});if(!page.list_complete)return new Response('Index migration required',{status:503});let latest=null;for(const k of page.keys){const raw=await env.REVOCATIONS.get(k.name);if(!raw)continue;const p=JSON.parse(new TextDecoder().decode(from64(JSON.parse(raw).payload)));if(p.deviceId===deviceId&&p.version===2&&p.binding==='tpm-cng-v1'&&(!latest||p.issuedAt>latest.issuedAt||(p.issuedAt===latest.issuedAt&&p.expiresAt>latest.expiresAt)))latest=p;}id=latest?.licenseId;}
  const raw=id?await env.REVOCATIONS.get('license:'+id):null,revoked=id?await env.REVOCATIONS.get('revoked:'+id):null;
  const licenseUpdate=raw&&!revoked?JSON.parse(raw):null;
  return signed({version:1,product:'asmach-inspection',licenseId:id||'',deviceId,nonce:ticket.challenge,status:revoked?'revoked':licenseUpdate?'active':'inactive',issuedAt:Math.floor(Date.now()/1000),...(licenseUpdate?{licenseUpdate}:{})},env);
 }
 if(admin){
  if(url.pathname==='/admin/ping')return ok({});
  if(url.pathname==='/admin/release'){
   if(body.release!==undefined){
    const r=body.release||{},version=String(r.version||''),minimumVersion=String(r.minimumVersion||version),target=String(r.target||'windows'),arch=String(r.arch||'x86_64'),notes=String(r.notes||'').slice(0,4000),pubDate=String(r.pubDate||new Date().toISOString());
    if(!semver(version)||!semver(minimumVersion)||versionCompare(minimumVersion,version)>0||target!=='windows'||!/^[a-z0-9_-]{2,24}$/.test(arch))return new Response('Invalid release',{status:400});
    await env.REVOCATIONS.put('release:stable',JSON.stringify({version,minimumVersion,target,arch,notes,pubDate}));
   }
   const raw=await env.REVOCATIONS.get('release:stable');return ok({release:raw?JSON.parse(raw):null});
  }
  const licenseId=body.licenseId||body.license?.licenseId;
  if(!/^[a-f0-9-]{36}$/.test(licenseId||''))return new Response('Bad license ID',{status:400});
  if(url.pathname==='/admin/detail'){
   let detail=null;if(env.ACTIVATIONS){const response=await activationRecord(env,licenseId,{action:'detail'});if(!response.ok)return new Response('Activation service unavailable',{status:503});detail=await response.json();}
   const activation=detail?.record;
   const raw=activation?.envelope?JSON.stringify(activation.envelope):await env.REVOCATIONS.get('license:'+licenseId);
   const revoked=activation?.revoked||((!activation?.envelope||!activation.kvRevocationChecked)&&await env.REVOCATIONS.get('revoked:'+licenseId));
   const legacySeen=detail?.lastCheck?null:await env.REVOCATIONS.get('seen:'+licenseId);
   return ok({activation:activation?{deviceId:activation.deviceId||null,activatedAt:activation.activatedAt||null,revoked:!!activation.revoked}:null,licenseId,status:revoked?'revoked':raw?'active':'missing',license:raw?JSON.parse(new TextDecoder().decode(from64(JSON.parse(raw).payload))):null,lastCheck:detail?.lastCheck||(legacySeen?JSON.parse(legacySeen):null),checkedAt:Math.floor(Date.now()/1000)});
  }
  if(url.pathname==='/admin/revoke'){if(env.ACTIVATIONS){const response=await activationRecord(env,licenseId,{action:'revoke'});if(!response.ok)return new Response('Revocation storage unavailable',{status:503});}await env.REVOCATIONS.put('revoked:'+licenseId,'1');return ok({licenseId});}
  try{
   const e=body.envelope;if(!e||typeof e.payload!=='string'||e.payload.length>12000||typeof e.signature!=='string'||e.signature.length>128)throw Error();
   const bytes=from64(e.payload),key=await crypto.subtle.importKey('raw',from64(env.LICENSE_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);
   if(!await crypto.subtle.verify('Ed25519',key,from64(e.signature),bytes))throw Error();
   const p=JSON.parse(new TextDecoder().decode(bytes));
   if(p.licenseId!==licenseId||p.product!=='asmach-inspection'||![1,2].includes(p.version)||!Number.isSafeInteger(p.revision)||p.revision<1||!(p.deviceId===''&&p.activationMode==='first-device'||/^[a-f0-9]{64}$/.test(p.deviceId))||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=p.notBefore)throw Error();
   if(await env.REVOCATIONS.get('revoked:'+licenseId))return new Response('Revoked',{status:409});
   if(p.deviceId===''&&p.activationMode==='first-device'){
    const code=String(body.activationKey||'').toUpperCase();if(!/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(code))throw Error();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(code))),x=>x.toString(16).padStart(2,'0')).join('');
    const response=await activationRecord(env,licenseId,{action:'publish',keyHash:hash,revision:p.revision,envelope:e});if(!response.ok)return response;
    await env.REVOCATIONS.put('activation-key:'+hash,licenseId);await env.REVOCATIONS.put('license:'+licenseId,JSON.stringify(e));return ok({licenseId,revision:p.revision});
   }
   const previous=await env.REVOCATIONS.get('license:'+licenseId);
   if(previous){const old=JSON.parse(new TextDecoder().decode(from64(JSON.parse(previous).payload)));if(old.deviceId!==p.deviceId||old.revision>p.revision||(old.revision===p.revision&&JSON.parse(previous).payload!==e.payload))return new Response('Revision conflict',{status:409});}
   await env.REVOCATIONS.put('license:'+licenseId,JSON.stringify(e));await env.REVOCATIONS.put('device:'+p.deviceId,licenseId);return ok({licenseId,revision:p.revision});
  }catch{return new Response('Invalid signed license',{status:400});}
 }
 const{licenseId,deviceId,nonce}=body;
 if(!/^[a-f0-9-]{36}$/.test(licenseId||'')||!/^[a-f0-9]{64}$/.test(deviceId||'')||!/^[a-f0-9-]{36}$/.test(nonce||''))return new Response('Bad request',{status:400});
 let revoked=false;
 let licenseUpdate;
 try{
  // Read the authoritative binding first. KV replicas may still contain an older grant.
  let r=null;if(env.ACTIVATIONS){const response=await activationRecord(env,licenseId,{action:'get'});if(!response.ok)return new Response('Activation service unavailable',{status:503});r=await response.json();}
  if(r?.envelope&&!r.revoked&&!r.kvRevocationChecked){const previous=!!await env.REVOCATIONS.get('revoked:'+licenseId);const response=await activationRecord(env,licenseId,{action:'migrate-revocation',revoked:previous});if(!response.ok)return new Response('Revocation migration unavailable',{status:503});r=await response.json();}
  if(r?.revoked)revoked='1';
  else if(r?.envelope){if(r.deviceId===deviceId)licenseUpdate=await boundEnvelope(r,env);}
  else {revoked=!!await env.REVOCATIONS.get('revoked:'+licenseId);if(!revoked){const raw=await env.REVOCATIONS.get('license:'+licenseId);if(raw){const e=JSON.parse(raw),p=JSON.parse(new TextDecoder().decode(from64(e.payload)));if(p.deviceId===deviceId&&p.licenseId===licenseId)licenseUpdate=e;}}}
 }catch{return new Response('Invalid record',{status:503});}
 return signed({version:1,product:'asmach-inspection',licenseId,deviceId,nonce,status:revoked?'revoked':licenseUpdate?'active':'inactive',issuedAt:Math.floor(Date.now()/1000),...(licenseUpdate?{licenseUpdate}:{})},env);
}};
