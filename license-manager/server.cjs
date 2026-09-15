'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{createStore}=require('./store.cjs');
function start(root=path.resolve(__dirname,'..'),options={}){
 const store=createStore(root),cloud=require('./cloud.cjs').cloud(root),token=crypto.randomBytes(32).toString('hex'),appVersion=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package.json'),'utf8')).version;let origin,lastSeen=Date.now();
 async function publish(id){if(!cloud.info().configured)throw Error('Önce Bulut ayarlarından hizmeti bağlayın.');let license=store.list().find(r=>r.licenseId===id);if(!license||license.cloudRevoked)throw Error('Aktif bir lisans kaydı seçin.');if(license.verificationUrl!==cloud.verificationUrl()||!license.revision){license=store.amend(id,new Date(license.expiresAt*1000).toISOString()).license;}const envelope=JSON.parse(store.exportLicense(id).text);const result=await cloud.call('license',{license,envelope,activationKey:store.list().find(r=>r.licenseId===id)?.activationKey||''});if(result.licenseId!==id||result.revision!==(license.revision||1))throw Error('Bulut lisans revizyonunu doğrulamadı.');store.publicationRecorded(id,license.revision);return{published:true,message:'Aynı lisans buluta yayımlandı. Güncel uygulama bir sonraki başarılı çevrimiçi doğrulamada süreyi otomatik alır; yeni dosya yüklemek gerekmez.'};}
 async function versions(){
  if(!cloud.info().configured)return{release:null,installations:{}};
  const release=(await cloud.call('release',{})).release||null,licenses=store.list(),installations={};let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,licenses.length)},async()=>{for(;;){const index=cursor++;if(index>=licenses.length)return;const item=licenses[index];try{const detail=await cloud.call('detail',{licenseId:item.licenseId});installations[item.licenseId]=detail.lastCheck||null;}catch{installations[item.licenseId]={error:true};}}}));
  return{release,installations};
 }
 const security={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'};
 const server=http.createServer(async(req,res)=>{
  const json=(code,obj)=>{res.writeHead(code,{...security,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
  if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'İstek kaynağı reddedildi.'});
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){
   if(req.headers.authorization!=='Bearer '+token)return json(401,{error:'Yönetim oturumu geçersiz. Uygulamayı yeniden açın.'});
   lastSeen=Date.now();
   try{
    if(req.method==='GET'&&url.pathname==='/api/list')return json(200,{licenses:store.list(),exportsDir:store.exportsDir,cloud:cloud.info(),appVersion});
    if(req.method==='GET'&&url.pathname==='/api/history')return json(200,store.history());
    if(req.method==='GET'&&url.pathname==='/api/detail')return json(200,store.detail(url.searchParams.get('id')));
    if(req.method==='GET'&&url.pathname==='/api/versions')return json(200,await versions());
    if(req.method==='GET'&&url.pathname==='/api/revocations')return json(200,store.revocations());
    if(req.method==='GET'&&url.pathname==='/api/download'){const file=store.exportLicense(url.searchParams.get('id'));res.writeHead(200,{...security,'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+file.name+'"'});return res.end(file.text);}
    if(req.method!=='POST')return json(404,{error:'İşlem bulunamadı.'});
    if(!String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'JSON gerekli.'});
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16000){json(413,{error:'İstek çok büyük.'});return;}chunks.push(c);}
    const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!body||typeof body!=='object')throw Error('Geçersiz veri.');
    if(url.pathname==='/api/issue'){const license=store.issue(body);let publication={published:false,message:'Bulut bağlı değil; lisans yalnızca yerel dosya olarak oluşturuldu.'};if(cloud.info().configured){try{publication=await publish(license.licenseId);}catch(e){publication.message='Lisans oluşturuldu fakat buluta yayımlanamadı. Müşteriye iletmeden önce Buluta gönder ile tekrar deneyin: '+e.message;}}return json(200,{...license,...publication});}
    if(url.pathname==='/api/publish')return json(200,await publish(String(body.id)));
    if(url.pathname==='/api/user')return json(200,store.updateUser(String(body.id),body));
    if(url.pathname==='/api/cloud-detail'){store.detail(String(body.id));return json(200,await cloud.call('detail',{licenseId:String(body.id)}));}
    if(url.pathname==='/api/release')return json(200,await cloud.call('release',{release:body}));
    if(url.pathname==='/api/save')return json(200,store.saveLicense(String(body.id)));
    if(url.pathname==='/api/offline-code')return json(200,store.offlineCode(String(body.id)));
    if(url.pathname==='/api/revoke'){const id=String(body.id);store.exportLicense(id);const out=await cloud.call('revoke',{licenseId:id});if(out.licenseId!==id)throw Error('İptal yanıtının lisans kimliği uyuşmuyor.');store.markRevoked(id);return json(200,{revoked:true});}
    if(url.pathname==='/api/cloud')return json(200,await cloud.configure(body));
    if(url.pathname==='/api/amend'){const result=store.amend(String(body.id),body.expiresAt);let published=false,message='Aynı lisansın süresi kaydedildi. Bulutu bağlayıp Buluta gönder seçeneğini kullanın. Tamamen çevrimdışı aktarım için Dosyayı kaydet kullanılabilir.';if(cloud.info().configured){try{const out=await publish(result.license.licenseId);published=out.published;message=out.message;}catch(e){message='Yerel süre saklandı; bulut güncellenemedi. Buluta gönder ile yeniden deneyin: '+e.message;}}return json(200,{published,message,licenseId:result.license.licenseId});}
    if(url.pathname==='/api/heartbeat')return json(200,{ok:true});
    if(url.pathname==='/api/close'){json(200,{ok:true});setTimeout(()=>{server.close();server.closeAllConnections();},100);return;}
    return json(404,{error:'İşlem bulunamadı.'});
   }catch(e){return json(400,{error:e.message});}
  }
  const files={'/favicon.ico':['../src-tauri/icons/icon.ico','image/x-icon'],'/brand.svg':['../src/assets/asmach-inspection-icon.svg','image/svg+xml'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
  if(req.method!=='GET'||!files[url.pathname]){res.writeHead(404,security);return res.end();}
  const [file,type]=files[url.pathname];res.writeHead(200,{...security,'Content-Type':type});res.end(fs.readFileSync(path.join(__dirname,file)));
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 const timer=setInterval(()=>{if(Date.now()-lastSeen>30*60*1000)server.close();},60000);timer.unref();server.on('close',()=>{clearInterval(timer);store.close();});
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>{origin='http://127.0.0.1:'+server.address().port;resolve({server,url:origin+'/#'+token,token,origin});}));
}
function launch(url){
 const candidates=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles].filter(Boolean).map(d=>path.join(d,'Microsoft/Edge/Application/msedge.exe'));
 const edge=candidates.find(p=>fs.existsSync(p));if(!edge)throw Error('Microsoft Edge bulunamadı. Yönetim penceresi Edge gerektirir.');
 const child=spawn(edge,['--app='+url,'--window-size=1280,850'],{detached:true,stdio:'ignore',windowsHide:true});child.unref();
}
if(require.main===module)start().then(({url,server})=>{try{if(process.argv.includes('--open'))launch(url);else console.log(url);}catch(e){server.close();throw e;}}).catch(e=>{fs.writeFileSync(path.join(__dirname,'startup-error.log'),e.message);process.exitCode=1;});
module.exports={start};
