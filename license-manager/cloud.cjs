'use strict';
const fs=require('node:fs'),path=require('node:path');
function cloud(root){const file=path.join(root,'.license-admin/cloud.json');
 const read=()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{url:'',token:''};
 const info=()=>{const c=read();return {configured:!!(c.url&&c.token),url:c.url};};
 async function call(action,body,override){const c=override||read();if(!c.url||!c.token)throw Error('Önce Bulut ayarlarından Cloudflare hizmetini bağlayın.');const r=await fetch(c.url+'/admin/'+action,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Bulut işlemi başarısız (HTTP '+r.status+').');const text=await r.text();if(text.length>24000)throw Error('Bulut yanıtı geçersiz.');const out=JSON.parse(text);if(out.ok!==true)throw Error('Bulut işlemi onaylamadı.');return out;}
 async function configure(input){const u=new URL(String(input.url||'').trim());if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error('Kimlik bilgisi içermeyen HTTPS hizmet adresi girin.');const url=u.origin,old=read();if(old.url&&old.url!==url&&!input.token)throw Error('Hizmet adresi değişti. Yeni adresin yönetici anahtarını girin.');const token=String(input.token||(old.url===url?old.token:'')||'').trim();if(token.length<32||token.length>512)throw Error('En az 32 karakterli yönetici anahtarı gerekli.');const next={url,token};await call('ping',{},next);const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600});fs.renameSync(temp,file);return info();}
 return {info,configure,call,verificationUrl:()=>{const c=info();return c.configured?c.url+'/validate':'';}};
}module.exports={cloud};
