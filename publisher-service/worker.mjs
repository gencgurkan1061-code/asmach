// Deploy only after the owner approves the destination and R2 storage.
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const unbase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function limited(request,limit){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let n=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>limit){await reader.cancel();throw Error('Dosya çok büyük.');}parts.push(value);}const out=new Uint8Array(n);let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}
function storage(env){
 const r2=env.RELEASES,kv=env.RELEASES_KV;
 if(r2)return{
  async json(key){const item=await r2.get(key);return item?{value:await item.json(),etag:item.etag}:null;},
  async artifact(key){const item=await r2.get(key);return item?{body:item.body,size:item.size,sha256:item.customMetadata?.sha256}:null;},
  async artifactHead(key){const item=await r2.head(key);return item?{size:item.size,sha256:item.customMetadata?.sha256}:null;},
  async artifactPut(key,bytes,sha256){const stored=await r2.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{sha256},httpMetadata:{contentType:'application/octet-stream'}});if(stored)return true;const old=await r2.head(key);return old?.customMetadata?.sha256===sha256&&old.size===bytes.length;},
  async channelPut(key,value,previous){const current=await r2.get(key);if((previous||null)!==(current?.etag||null))return false;return !!await r2.put(key,JSON.stringify(value),{onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});}
 };
 if(kv)return{
  async json(key){const item=await kv.getWithMetadata(key,'json');return item.value?{value:item.value,etag:item.metadata?.etag||null}:null;},
  async artifact(key){const item=await kv.getWithMetadata(key,'arrayBuffer');return item.value?{body:item.value,size:Number(item.metadata?.size||item.value.byteLength),sha256:item.metadata?.sha256}:null;},
  async artifactHead(key){const item=await kv.getWithMetadata(key,'arrayBuffer');return item.value?{size:Number(item.metadata?.size||item.value.byteLength),sha256:item.metadata?.sha256}:null;},
  async artifactPut(key,bytes,sha256){const old=await kv.getWithMetadata(key,'arrayBuffer');if(old.value)return old.metadata?.sha256===sha256&&Number(old.metadata?.size||old.value.byteLength)===bytes.length;await kv.put(key,bytes,{metadata:{kind:'artifact',sha256,size:bytes.length}});return true;},
  async channelPut(key,value,previous){const current=await kv.getWithMetadata(key,'json');if((previous||null)!==(current?.metadata?.etag||null))return false;const etag=crypto.randomUUID();await kv.put(key,JSON.stringify(value),{metadata:{kind:'channel',etag}});return true;}
 };
 return null;
}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url),route=url.pathname,store=storage(env);
  if(!store)return json({error:'Depo yapılandırılmadı.'},503);
  if(route.startsWith('/admin/')){
   if(!env.ADMIN_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.ADMIN_TOKEN)return json({error:'Yetkisiz.'},401);
   if(route==='/admin/ping'&&request.method==='GET')return json({service:'asmach-publisher-v1'});
   const artifact=route.match(/^\/admin\/artifact\/([a-f0-9-]{36}\/part-\d+\.bin)$/);
   if(artifact&&request.method==='PUT'){
    const bytes=await limited(request,8*1024*1024);if(!bytes.length)throw Error('Boş parça.');const sha256=await digest(bytes),key='downloads/'+artifact[1];
    if(!await store.artifactPut(key,bytes,sha256))return json({error:'Parça içeriği değiştirilemez.'},409);
    return json({sha256,size:bytes.length});
   }
   const channel=route.match(/^\/admin\/channel\/(stable|test)$/);
   if(channel){
    const key='channels/'+channel[1]+'.json',current=await store.json(key);let previous=current?.value||null;
    if(request.method==='GET')return json({etag:current?.etag||null,version:previous?.version||null,sha256:previous?.sha256||null,paused:previous?.paused||false});
    const body=JSON.parse(new TextDecoder().decode(await limited(request,65536)));
    if((body.previous||null)!==(current?.etag||null))return json({error:'Kanal başka bir işlem tarafından değişti.'},409);
    let value;
    if(request.method==='DELETE')value={...previous,paused:true};
    else if(request.method==='PUT'){
     const envelope=body.envelope,payload=unbase64(envelope.payload);const publicKey=await crypto.subtle.importKey('raw',unbase64(env.UPDATE_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);
     if(!await crypto.subtle.verify('Ed25519',publicKey,unbase64(envelope.signature),payload))throw Error('Yayın imzası geçersiz.');
     const manifest=JSON.parse(new TextDecoder().decode(payload));
     if(manifest.product!=='asmach-inspection'||manifest.schema!==1||!manifest.available||!/^\d+\.\d+\.\d+$/.test(manifest.version)||manifest.target!=='windows'||manifest.arch!=='x86_64'||!Array.isArray(manifest.chunks)||manifest.chunks.length<1||manifest.chunks.length>32)throw Error('Yayın bilgileri geçersiz.');
     if(previous?.version&&manifest.version.split('.').reduce((n,v,i)=>n||Math.sign(Number(v)-Number(previous.version.split('.')[i])),0)<=0)return json({error:'Sürüm ileri gitmeli.'},409);
     let size=0;for(const chunk of manifest.chunks){const u=new URL(chunk.url);if(u.origin!==url.origin||!/^\/downloads\/[a-f0-9-]{36}\/part-\d+\.bin$/.test(u.pathname)||u.search||u.hash)throw Error('Dosya adresi geçersiz.');const part=await store.artifactHead(u.pathname.slice(1));if(!part||part.size!==chunk.size||part.sha256!==chunk.sha256)throw Error('Doğrulanmamış dosya parçası.');size+=chunk.size;}
     if(size!==manifest.size||size>256*1024*1024)throw Error('Toplam boyut geçersiz.');value={envelope,version:manifest.version,sha256:manifest.sha256,paused:false};
    }else return json({error:'Yöntem desteklenmiyor.'},405);
    if(!await store.channelPut(key,value,current?.etag||null))return json({error:'Eşzamanlı kanal değişikliği.'},409);return json({version:value.version,paused:value.paused});
   }
   return json({error:'Bulunamadı.'},404);
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405});
  if(route==='/update.json'||route==='/test/update.json'){
   const item=await store.json('channels/'+(route.startsWith('/test/')?'test':'stable')+'.json');if(!item)return new Response(null,{status:404});const value=item.value;
   // Fail closed after pause: no executable is offered to clients.
   if(value.paused)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});return json(value.envelope);
  }
  if(/^\/downloads\/[a-f0-9-]{36}\/part-\d+\.bin$/.test(route)){const item=await store.artifact(route.slice(1));if(!item)return new Response(null,{status:404});return new Response(request.method==='HEAD'?null:item.body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(item.size),'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}});}
  return new Response('ASMach update distribution',{headers:{'Content-Type':'text/plain'}});
 }catch{return json({error:'Yayın isteği doğrulanamadı.'},400);}
}};
