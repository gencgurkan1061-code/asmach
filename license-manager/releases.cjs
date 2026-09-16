'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MAX=256*1024*1024,CHUNK=8*1024*1024;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function createReleases(root){
 const dir=path.join(root,'.release-admin','releases'),configFile=path.join(root,'.release-admin','publisher.json');let busy=false;
 const config=()=>fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
 const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,file);};
 const file=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Geçersiz yayın kimliği.');return path.join(dir,id+'.json');};
 const read=id=>JSON.parse(fs.readFileSync(file(id),'utf8'));
 function audit(action,detail){fs.mkdirSync(dir,{recursive:true});fs.appendFileSync(path.join(dir,'history.jsonl'),JSON.stringify({at:new Date().toISOString(),action,detail})+'\n',{mode:0o600});}
 function info(){const c=config();return{configured:!!(c.url&&c.token),url:c.url||'',busy,items:fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>read(n.slice(0,-5))).sort((a,b)=>b.created.localeCompare(a.created)):[]};}
 async function remote(route,method='GET',body,c=config(),type='application/json'){
  if(!c.url||!c.token)throw Error('Yayın deposu bağlantısını önce yapılandırın.');
  const response=await fetch(c.url+route,{method,redirect:'error',headers:{Authorization:'Bearer '+c.token,'Content-Type':type},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Yayın deposu işlemi başarısız: HTTP '+response.status);
  return response.json();
 }
 async function configure(body){
  const u=new URL(String(body.url||''));if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw Error('Yayın deposunun HTTPS kök adresini girin.');
  const old=config(),token=String(body.token||(old.url===u.origin?old.token:'')||'');if(token.length<32||token.length>512)throw Error('En az 32 karakterli depo anahtarı gerekli.');
  const c={url:u.origin,token};const ping=await remote('/admin/ping','GET',undefined,c);if(ping.service!=='asmach-publisher-v1')throw Error('Uyumlu yayın hizmeti değil.');write(configFile,c);audit('Bağlantı kaydedildi',u.origin);return info();
 }
 async function upload(stream,meta){
  if(busy)throw Error('Başka bir yayın işlemi sürüyor.');busy=true;let temp;
  try{
   if(!/^\d+\.\d+\.\d+$/.test(meta.version||'')||!['online','offline'].includes(meta.variant)||!['test','stable'].includes(meta.channel))throw Error('Sürüm, paket türü veya kanal geçersiz.');
   if(!/\.exe$/i.test(meta.name||''))throw Error('EXE kurulum dosyası seçin.');
   fs.mkdirSync(dir,{recursive:true});const id=crypto.randomUUID();temp=path.join(dir,id+'.partial');const fd=fs.openSync(temp,'wx',0o600);let size=0;const digest=crypto.createHash('sha256');
   try{for await(const b of stream){size+=b.length;if(size>MAX)throw Error('Paket 256 MB sınırını aşıyor.');fs.writeSync(fd,b);digest.update(b);}}finally{fs.closeSync(fd);}
   const h=fs.openSync(temp,'r'),head=Buffer.alloc(64);fs.readSync(h,head,0,64,0);const offset=head.readUInt32LE(60),pe=Buffer.alloc(6);if(offset<=size-6)fs.readSync(h,pe,0,6,offset);fs.closeSync(h);
   if(size<64||head.toString('ascii',0,2)!=='MZ'||pe.toString('hex',0,4)!=='50450000'||![0x14c,0x8664].includes(pe.readUInt16LE(4)))throw Error('Geçerli Windows PE kurulum dosyası değil.');
   const item={id,version:meta.version,variant:meta.variant,channel:meta.channel,name:path.basename(meta.name).slice(0,160),notes:String(meta.notes||'').slice(0,8000),size,sha256:digest.digest('hex'),created:new Date().toISOString(),status:'draft',warning:'Ürün/sürüm ve x64 hedefi operatör tarafından doğrulanmalı. PE kontrolü kod imzası doğrulaması değildir.'};
   fs.renameSync(temp,path.join(dir,id+'.exe'));temp=null;write(file(id),item);audit('Setup alındı',{id,version:item.version,sha256:item.sha256});return item;
  }finally{if(temp&&fs.existsSync(temp))fs.unlinkSync(temp);busy=false;}
 }
 async function publish(body){
  if(busy)throw Error('Başka bir yayın işlemi sürüyor.');if(body.confirm!=='YAYINLA'||body.verified!==true)throw Error('Kurulum testini ve yayın onayını doğrulayın.');busy=true;let item;
  try{
   item=read(body.id);if(item.status==='published')throw Error('Bu kayıt zaten yayımlandı.');
   const c=config(),key=crypto.createPrivateKey(fs.readFileSync(path.join(root,'.release-admin/update-private.pem'))),expected=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/updater-config.json'),'utf8'));
   const publicKey=Buffer.from(crypto.createPublicKey(key).export({format:'jwk'}).x,'base64url').toString('base64');if(publicKey!==expected.public_key)throw Error('Güncelleme anahtarı müşteri uygulamasıyla uyuşmuyor.');
   if(item.channel==='stable'&&new URL(expected.url).origin!==c.url)throw Error('Depo adresi müşteri güncelleme adresiyle aynı değil.');
   const current=await remote('/admin/channel/'+item.channel);
   if(current.version===item.version&&current.sha256===item.sha256&&!current.paused){item.status='published';item.error='';write(file(item.id),item);return item;}
   if(current.version&&item.version.split('.').map(Number).reduce((out,n,i)=>out||Math.sign(n-Number(current.version.split('.')[i]||0)),0)<=0)throw Error('Yeni sürüm mevcut kanal sürümünden büyük olmalı.');
   const bytes=fs.readFileSync(path.join(dir,item.id+'.exe'));if(bytes.length!==item.size||hash(bytes)!==item.sha256)throw Error('Yerel paket bütünlüğü bozulmuş.');
   item.status='uploading';item.error='';write(file(item.id),item);const chunks=[];
   for(let offset=0,index=0;offset<bytes.length;offset+=CHUNK,index++){
    const part=bytes.subarray(offset,offset+CHUNK),sha256=hash(part),name=`${item.id}/part-${index}.bin`;
    const result=await remote('/admin/artifact/'+name,'PUT',part,c,'application/octet-stream');if(result.sha256!==sha256||result.size!==part.length)throw Error('Uzak dosya doğrulaması başarısız.');
    chunks.push({url:c.url+'/downloads/'+name,sha256,size:part.length});item.progress=Math.round((offset+part.length)/bytes.length*100);write(file(item.id),item);
   }
   const payload=Buffer.from(JSON.stringify({schema:1,product:'asmach-inspection',version:item.version,available:true,publishedAt:new Date().toISOString(),target:'windows',arch:'x86_64',downloadUrl:null,chunks,sha256:item.sha256,size:item.size,notes:item.notes}));
   const envelope={payload:payload.toString('base64'),signature:crypto.sign(null,payload,key).toString('base64')};
   const out=await remote('/admin/channel/'+item.channel,'PUT',{envelope,previous:current.etag||null});if(out.version!==item.version)throw Error('Yayın sonucu doğrulanamadı.');
   item.status='published';item.publishedAt=new Date().toISOString();write(file(item.id),item);audit('Yayınlandı',{id:item.id,version:item.version,channel:item.channel});return item;
  }catch(e){if(item&&item.status!=='published'){item.status='failed';item.error=e.message;write(file(item.id),item);audit('Yayın hatası',{id:item.id,error:e.message});}throw e;}finally{busy=false;}
 }
 async function pause(body){if(body.confirm!=='DURDUR')throw Error('DURDUR onayı gerekli.');if(busy)throw Error('Yayın sürüyor.');if(!['stable','test'].includes(body.channel))throw Error('Kanal geçersiz.');busy=true;try{const current=await remote('/admin/channel/'+body.channel);const out=await remote('/admin/channel/'+body.channel,'DELETE',{previous:current.etag});audit('Yayın durduruldu',body.channel);return out;}finally{busy=false;}}
 return{info,upload,configure,publish,pause};
}
module.exports={createReleases};
