/* Local-only recovery. IndexedDB transactions keep the previous backup if a write fails. */
(function(root){
 'use strict';let app,db,timer,revision=0,savedRevision=0,writing=false,loaded=false,bar,lastChangedAt='',lastSavedAt='';
 function database(){if(root.ASMachDesktop)return Promise.resolve({native:true});return new Promise((resolve,reject)=>{const req=indexedDB.open('asmach-project-recovery',1);req.onupgradeneeded=()=>req.result.createObjectStore('backup');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 function transaction(mode,action){if(db?.native)return action({get:()=>root.ASMachDesktop.recoveryGet(),put:entry=>root.ASMachDesktop.recoveryPut(entry.payload)});return new Promise((resolve,reject)=>{const tx=db.transaction('backup',mode),request=action(tx.objectStore('backup'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 function emit(){root.dispatchEvent(new CustomEvent('asmach-project-status',{detail:{loaded,dirty:dirty(),revision,savedRevision,lastChangedAt,lastSavedAt}}));}
 function status(message){if(bar){const label=bar.querySelector('[data-recovery-status]');label.textContent=message;label.title=message;}emit();}
 function mark(){if(!loaded||!app.state.fileData)return;revision++;lastChangedAt=new Date().toISOString();clearTimeout(timer);timer=setTimeout(flush,800);status('Kaydedilmemiş değişiklikler var · Yerel kurtarma hazırlanıyor…');}
 let completion=null;
 async function flush(){clearTimeout(timer);if(writing)return completion;if(!db||!loaded||!app.state.fileData)return true;writing=true;const version=revision;completion=(async()=>{try{const payload=app.projectPayload();void root.ASMachStartScreen?.remember(payload);await transaction('readwrite',s=>s.put({payload,at:new Date().toISOString()},'latest'));status('Yerel kurtarma kopyası güncel · Proje dosyasını ayrıca kaydedin.');return true;}catch(e){status('Yerel yedek alınamadı. Projenizi dosyaya kaydedin.');return false;}finally{writing=false;if(revision!==version)timer=setTimeout(flush,800);}})();return completion;}
 function baseline(){loaded=Boolean(app?.state?.fileData);revision++;savedRevision=revision;lastChangedAt='';lastSavedAt=loaded?new Date().toISOString():'';status(loaded?'Proje açık · Değişiklik yok.':'Proje kapatıldı.');}
 function saved(version=revision){savedRevision=version;lastSavedAt=new Date().toISOString();status(version===revision?'Tüm değişiklikler proje dosyasına kaydedildi.':'Kayıt tamamlandı; kayıt sırasında yapılan yeni değişiklikler henüz kaydedilmedi.');void flush();}
 function dirty(){return loaded&&revision!==savedRevision;}
 async function init(bridge){app=bridge;
   window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
   document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty())void flush();});
   bar=document.createElement('div');bar.id='projectRecovery';bar.hidden=true;bar.style.setProperty('display','none','important');
   bar.innerHTML='<span data-recovery-status>Yerel kurtarma hazırlanıyor…</span><button type="button" class="btn" data-restore hidden>Son yerel kopyayı kurtar</button>';
   const viewer=app.elements.stageWrap?.parentElement;
   const strip=document.querySelector('.document-strip');
   if(strip)strip.insertBefore(bar,strip.querySelector('.document-stats'));else viewer?.before(bar);
   const css=document.createElement('style');css.textContent=`
    html body .document-strip{flex-wrap:nowrap;gap:10px;min-width:0}
    html body .document-strip .document-name{flex:0 1 auto;max-width:40%;min-width:0}
    html body .document-strip #projectRecovery{flex:1 1 160px;min-width:0;min-height:0;max-height:none;padding:0!important;border:0;background:transparent!important;align-self:center;flex-wrap:nowrap;overflow:hidden;font-size:10px}
    .document-strip #projectRecovery [data-recovery-status]{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .document-strip #projectRecovery .btn{flex-shrink:0;white-space:nowrap}
    .document-strip .document-stats{flex-shrink:0}
   `;document.head.append(css);
   try{db=await database();const backup=await transaction('readonly',s=>s.get('latest'));if(!backup?.payload){status('Değişiklikler bu cihazda yerel olarak yedeklenecek.');return;}
     const button=bar.querySelector('[data-restore]');button.hidden=false;status('Önceki oturumdan yerel kurtarma kopyası var.');
     button.onclick=async()=>{button.disabled=true;try{const current=await transaction('readonly',s=>s.get('latest'));if(!current?.payload)throw Error('Kurtarma kopyası yok.');const ok=await app.restoreProject(current.payload);if(ok){savedRevision=-1;button.hidden=true;status('Yerel kopya kurtarıldı. Projeyi dosyaya kaydedin.');}}catch(e){status('Kurtarma açılamadı: '+e.message);}finally{button.disabled=false;}};
   }catch(e){status('Tarayıcı yerel yedeğe izin vermiyor. Projenizi düzenli olarak dosyaya kaydedin.');}
 }
 root.ASMachRecovery={init,mark,flush,baseline,saved,dirty,version:()=>revision,status:()=>({loaded,dirty:dirty(),revision,savedRevision,lastChangedAt,lastSavedAt})};
})(window);
