/* Native services only. No filesystem paths or executable commands are accepted from UI. */
(function(root){
 'use strict';
 if(!root.__TAURI__?.core?.invoke)return;
 // Suppress WebView's browser menu without stopping application context-menu handlers.
 root.addEventListener('contextmenu',event=>event.preventDefault(),true);
 const invoke=(name,args={})=>root.__TAURI__.core.invoke(name,args);
 const values=new Map(),pending=new Map();let writing=null,closing=false,opening=false;
 function reportError(error){root.dispatchEvent(new CustomEvent('asmach-native-error',{detail:String(error?.message||error)}));}
 async function flush(){
  if(writing)return writing;
  writing=(async()=>{while(pending.size){const [key,value]=pending.entries().next().value;await invoke('preference_set',{key,value});if(pending.get(key)===value)pending.delete(key);}})();
  try{await writing;}finally{writing=null;}
 }
 const preferences={getItem:key=>values.has(key)?values.get(key):null,setItem(key,value){key=String(key);value=String(value);values.set(key,value);pending.set(key,value);void flush().catch(reportError);},removeItem(key){values.delete(key);pending.set(key,null);void flush().catch(reportError);},flush};
 async function encode(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
 function file(result){if(!result)return null;const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));return new File([bytes],result.name,{type:result.mime});}
 const api={preferences,invoke,info:null,ready:null,
  openFile:async kind=>{const result=await invoke('open_file',{kind}),selected=file(result);if(selected&&result.nativeToken)selected.projectTarget={cancelled:false,nativeToken:result.nativeToken,name:result.name};return selected;},
  chooseSaveTarget:async name=>{const token=await invoke('choose_save_target',{name});return {cancelled:!token,nativeToken:token};},
  writeTarget:async(blob,target)=>{if(!target.nativeToken)throw Error('Windows kayıt hedefi seçilmedi.');const warning=await invoke('write_target',{token:target.nativeToken,data:await encode(blob),...(target.openAfter?{openAfter:true}:{})});if(typeof warning==='string'&&warning)reportError(warning);},
  recoveryGet:()=>invoke('recovery_get'),recoveryPut:payload=>invoke('recovery_put',{payload:JSON.stringify(payload)}),
  nativePdf:async(blob,print)=>invoke('native_pdf',{data:await encode(blob),print}),
  excelPrintPreview:async(blob,paper,landscape)=>{const data=await invoke('native_excel_preview',{data:await encode(blob),paper,landscape});return new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'application/pdf'});},
   openExcelTemplate:()=>invoke('native_excel_open'),
   listExcelTemplates:()=>invoke('native_template_list'),
   importExcelTemplate:()=>invoke('native_template_import'),
   storeExcelTemplate:async(name,blob)=>invoke('native_template_store',{name,data:await encode(blob)}),
   readExcelTemplate:async id=>file(await invoke('native_template_read',{id})),
   deleteExcelTemplate:id=>invoke('native_template_delete',{id}),
   editExcelTemplate:(templateId,fields)=>invoke('native_template_editor',{templateId,fields}),
  async close(){if(closing)return;closing=true;try{if(root.ASMachFileActions&&!await root.ASMachFileActions.confirmLeave())return;const backedUp=await root.ASMachRecovery?.flush();if(backedUp===false)throw Error('Kurtarma kopyası yazılamadı. Önce projenizi dosyaya kaydedin.');await flush();await invoke('close_application');}catch(e){reportError(e);}finally{closing=false;}},
  mount(app){
   root.addEventListener('asmach-native-error',e=>app.toast?.('Masaüstü işlemi tamamlanamadı: '+e.detail,true));
   for(const [id,kind] of [['fileInput','drawing'],['projectInput','project']]){
    const input=document.getElementById(id);if(!input)continue;
    input.addEventListener('click',async e=>{e.preventDefault();if(opening)return;opening=true;try{const selected=await api.openFile(kind);if(!selected)return;const transfer=new DataTransfer();transfer.items.add(selected);input.files=transfer.files;input.projectTarget=selected.projectTarget||null;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(error){reportError(error);}finally{opening=false;}});
   }
   const menu=document.createElement('details');menu.className='native-menu';menu.innerHTML='<summary>Windows</summary><section><strong>Masaüstü uygulaması</strong><span data-native-version></span><label><input type="checkbox" data-native-start>Windows başlangıcında aç</label><button type="button" class="btn" data-native-folder>Kayıt klasörünü seç</button><small data-native-directory></small><button type="button" class="btn" data-native-tray>Sistem tepsisine küçült</button><button type="button" class="btn" data-native-update>Sürümü denetle</button><small data-native-status role="status"></small><small data-native-database></small></section>';
   const style=document.createElement('style');style.textContent='.native-menu{position:relative;margin-left:auto;flex:none;z-index:2400;font:12px Segoe UI;background:#fff;border:1px solid #b9d3df;border-radius:6px;color:#264e62}.native-menu summary{cursor:pointer;padding:7px 12px}.native-menu section{position:absolute;top:36px;right:0;background:#fff;border:1px solid #bdd4e0;box-shadow:0 8px 28px #1233;border-radius:8px;padding:16px;width:300px;display:grid;gap:12px}.native-menu small{overflow-wrap:anywhere;font-size:10px;color:#647f90}.native-menu label{display:flex;gap:8px;align-items:center}';document.head.append(style);menu.open=true;menu.hidden=true;document.body.append(menu);api.settingsPanel=menu;root.dispatchEvent(new Event('asmach-native-ready')); 
   const $=s=>menu.querySelector(s);$('[data-native-version]').textContent='Tauri 2 · Sürüm '+api.info.version+' · Çevrimdışı';$('[data-native-database]').textContent='Yerel SQLite: '+api.info.dataDirectory;$('[data-native-start]').checked=api.info.autostart;
   $('[data-native-directory]').textContent=preferences.getItem('asmach.desktop.outputDirectory')||'Kayıt sırasında Windows klasör seçimi kullanılır.';
   $('[data-native-start]').onchange=async e=>{const input=e.target;input.disabled=true;try{input.checked=await invoke('set_autostart',{enabled:input.checked});api.info.autostart=input.checked;}catch(error){input.checked=api.info.autostart;reportError(error);}finally{input.disabled=false;}};
   $('[data-native-folder]').onclick=async()=>{try{const dir=await invoke('choose_output_directory');if(dir){values.set('asmach.desktop.outputDirectory',dir);$('[data-native-directory]').textContent=dir;}}catch(e){reportError(e);}};
   $('[data-native-tray]').onclick=()=>invoke('hide_to_tray').catch(reportError);
   $('[data-native-update]').disabled=!api.info.updaterConfigured;if(!api.info.updaterConfigured)$('[data-native-status]').textContent='Sürüm kontrol adresi henüz tanımlanmadı.';
   let pendingUpdate=null;
   const updaterStatus=(message,update=pendingUpdate)=>root.dispatchEvent(new CustomEvent('asmach-updater-status',{detail:{message,update}}));
   const installUpdate=async update=>{if(!update)return;if(!confirm('ASMach '+update.version+' güvenli kaynaktan indirilecek ve doğrulanacak. Ardından uygulama tamamen kapatılıp güncelleme kurulacaktır. Devam edilsin mi?'))return;const button=document.querySelector('#nativeUpdateNotice [data-install]');if(button)button.disabled=true;try{if(root.ASMachFileActions&&!await root.ASMachFileActions.confirmLeave()){if(button)button.disabled=false;return;}const backedUp=await root.ASMachRecovery?.flush();if(backedUp===false)throw new Error('Çalışma yedeği kaydedilemedi. Güncelleme iptal edildi.');await flush();$('[data-native-status]').textContent='Güncelleme indiriliyor ve doğrulanıyor…';updaterStatus('Güncelleme indiriliyor ve imzası doğrulanıyor…',update);await invoke('install_update',{version:update.version});}catch(e){$('[data-native-status]').textContent='Güncelleme güvenle başlatılamadı: '+String(e);updaterStatus('Güncelleme başlatılamadı: '+String(e),update);reportError(e);if(button)button.disabled=false;}};
   const showUpdate=update=>{let notice=document.getElementById('nativeUpdateNotice');if(!update){notice?.remove();return;}if(!notice){notice=document.createElement('aside');notice.id='nativeUpdateNotice';notice.style.cssText='position:fixed;right:18px;top:72px;z-index:2147482000;display:flex;align-items:center;gap:10px;max-width:480px;padding:12px 14px;border:1px solid #78bdca;border-radius:9px;background:#eefafb;color:#17465a;box-shadow:0 8px 28px #15364a2b;font:12px Segoe UI';const copy=document.createElement('span'),install=document.createElement('button'),close=document.createElement('button');copy.dataset.copy='';install.dataset.install='';install.className='btn primary';install.textContent='Güvenli güncelle';close.className='btn';close.textContent='Daha sonra';close.onclick=()=>notice.remove();notice.append(copy,install,close);document.body.append(notice);}notice.querySelector('[data-copy]').textContent='ASMach '+update.version+' sürümü mevcut. '+(update.notes||'');notice.querySelector('[data-install]').onclick=()=>void installUpdate(update);};
    const checkUpdate=async(manual=false)=>{try{if(manual){$('[data-native-status]').textContent='Denetleniyor…';updaterStatus('Güncelleştirmeler denetleniyor…');}const update=await invoke('check_update');pendingUpdate=update||null;const message=update?'Yeni sürüm mevcut: '+update.version+' · İmzalı bildirim doğrulandı.':'Uygulama güncel.';$('[data-native-status]').textContent=message;updaterStatus(message,pendingUpdate);showUpdate(update);return update;}catch(e){const message='Güncelleştirme denetlenemedi: '+String(e);$('[data-native-status]').textContent=message;updaterStatus(message);if(manual)reportError(e);return null;}};
   api.updater={configured:!!api.info.updaterConfigured,check:()=>checkUpdate(true),install:update=>installUpdate(update||pendingUpdate),current:()=>pendingUpdate};
   root.dispatchEvent(new Event('asmach-updater-ready'));
   $('[data-native-update]').onclick=()=>void checkUpdate(true);
   if(api.info.updaterConfigured)setTimeout(()=>void checkUpdate(false),2500);
   // Settings panel remains expanded when users switch tabs.
   void root.__TAURI__.event.listen('desktop-close-request',()=>api.close()).catch(reportError);
  }
 };
 api.ready=invoke('desktop_bootstrap').then(info=>{api.info=info;Object.entries(info.preferences).forEach(([k,v])=>values.set(k,v));root.ASMachPreferences=preferences;});
 root.ASMachDesktop=api;
})(window);
