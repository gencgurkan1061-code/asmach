'use strict';
// Owner-only provisioning. Never print tokens or private keys. No paid-plan operations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),cfg=JSON.parse(fs.readFileSync(path.join(root,'licensing-service/wrangler.jsonc'))),vault=path.join(root,'.license-admin');
const authFile=path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml');
function token(){const match=fs.readFileSync(authFile,'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m);if(!match)throw Error('Cloudflare oturumu bulunamadı.');return match[1];}
async function refreshToken(){
 let text=fs.readFileSync(authFile,'utf8');const match=text.match(/^refresh_token\s*=\s*"([^"]+)"/m);if(!match)throw Error('Cloudflare oturumu yenilenemedi; yeniden oturum açılmalı.');
 const r=await fetch('https://dash.cloudflare.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:match[1],client_id:'54d11594-84e4-41aa-b438-e81b8fa78ee7'}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const out=await r.json();if(!r.ok||!out.access_token)throw Error('Cloudflare oturumu yenilenemedi; yeniden oturum açılmalı.');
 const replace=(name,value)=>{const line=new RegExp('^'+name+'\\s*=.*$','m'),next=name+' = "'+value+'"';text=line.test(text)?text.replace(line,next):text+'\n'+next;};
 replace('oauth_token',out.access_token);replace('refresh_token',out.refresh_token||match[1]);replace('expiration_time',new Date(Date.now()+Math.max(60,Number(out.expires_in)||3600)*1000).toISOString());fs.writeFileSync(authFile,text,{encoding:'utf8',mode:0o600});return out.access_token;
}
async function api(route,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+cfg.account_id+route,{method,headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});const out=await r.json();if(!r.ok||!out.success)throw Error('Cloudflare işlemi başarısız: HTTP '+r.status+' kod '+(out.errors||[]).map(x=>x.code).join(','));return out.result;}
async function deploy(){
 const metadata={
  main_module:'worker.js',compatibility_date:cfg.compatibility_date,
  bindings:[
   {name:'LICENSE_PUBLIC_KEY',type:'plain_text',text:cfg.vars.LICENSE_PUBLIC_KEY},
   {name:'ACTIVATIONS',type:'durable_object_namespace',class_name:'LicenseActivation'},
   {name:'REVOCATIONS',type:'kv_namespace',namespace_id:cfg.kv_namespaces[0].id}
  ],
  keep_bindings:['secret_text']
 };
 const upload=async accessToken=>{const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));for(const name of ['worker.js','activation.js'])form.append(name,new Blob([fs.readFileSync(path.join(root,'licensing-service',name),'utf8')],{type:'application/javascript+module'}),name);return fetch('https://api.cloudflare.com/client/v4/accounts/'+cfg.account_id+'/workers/scripts/'+cfg.name,{method:'PUT',headers:{Authorization:'Bearer '+accessToken},body:form,redirect:'error',signal:AbortSignal.timeout(60000)});};
 let r=await upload(token());if(r.status===401)r=await upload(await refreshToken());
 const out=await r.json();if(!r.ok||!out.success)throw Error('Cloudflare dağıtımı başarısız: HTTP '+r.status+' '+(out.errors||[]).map(x=>String(x.code||'')+' '+String(x.message||'')).join('; '));
 console.log(JSON.stringify({deployed:true,name:cfg.name,version:out.result?.deployment_id||out.result?.etag||null}));
}
async function main(){const mode=process.argv[2];if(mode==='preflight'){let subscriptions;try{const subs=await api('/subscriptions');subscriptions=subs.map(s=>({id:s.rate_plan?.id,name:s.rate_plan?.public_name,price:s.price}));}catch{subscriptions='Oturumun faturalama bilgilerini okuma yetkisi yok; ücretli abonelik işlemi yapılmaz.';}console.log(JSON.stringify({subscriptions,subdomain:await api('/workers/subdomain'),settings:await api('/workers/account-settings')}));return;}
 if(mode==='deploy'){await deploy();return;}
 if(mode==='secrets'){const adminFile=path.join(vault,'cloud-admin-token');if(!fs.existsSync(adminFile))fs.writeFileSync(adminFile,crypto.randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});const status=fs.readFileSync(path.join(vault,'status.pem'),'utf8'),pub=JSON.parse(fs.readFileSync(path.join(root,'src-tauri/license-config.json'))).statusPublicKey;const key=crypto.createPublicKey(crypto.createPrivateKey(status)).export({format:'jwk'});if(Buffer.from(key.x,'base64url').toString('base64')!==pub)throw Error('Durum anahtarı eşleşmiyor.');for(const[name,text]of[['STATUS_PRIVATE_KEY',status],['ADMIN_TOKEN',fs.readFileSync(adminFile,'utf8').trim()]]){await api('/workers/scripts/'+cfg.name+'/secrets','PUT',{name,text,type:'secret_text'});console.log(name+' güvenli olarak kaydedildi.');}return;}
 if(mode==='connect'){const domain=await api('/workers/subdomain');if(!domain.subdomain)throw Error('Worker alan adı bulunamadı.');const url='https://'+cfg.name+'.'+domain.subdomain+'.workers.dev';const cloud=require('../license-manager/cloud.cjs').cloud(root);const result=await cloud.configure({url,token:fs.readFileSync(path.join(vault,'cloud-admin-token'),'utf8').trim()});console.log(JSON.stringify(result));return;}
 throw Error('Geçerli işlem: preflight, deploy, secrets, connect');}
main().catch(e=>{console.error(e.message+(e.cause?.code?' ('+e.cause.code+')':''));process.exitCode=1;});
