(function(root){
 function init(){
  const app=root.ASMachApp,doc=document;let closing=false,saving=false,prompting=false;
  const saveButton=doc.getElementById('saveProjectButton'),saveAsButton=doc.getElementById('saveProjectAsButton');
  const icon=(b,kind)=>{if(!b)return;b.querySelectorAll('svg,img').forEach(n=>n.remove());const img=doc.createElement('img');img.src=root.ASMachFileIcons[kind];img.alt='';img.width=23;img.height=23;b.prepend(img);};
  for(const [id,key] of [['openFileButton','Ctrl+N'],['loadProjectButton','Ctrl+O'],['saveProjectButton','Ctrl+S'],['saveProjectAsButton','Ctrl+Shift+S']]){const b=doc.getElementById(id);if(!b)continue;b.querySelectorAll('kbd,.qt-key').forEach(n=>n.remove());const k=doc.createElement('kbd');k.textContent=key;b.append(k);b.title=b.textContent.replace(key,'').trim()+' · '+key;b.setAttribute('aria-keyshortcuts',key.replace('Ctrl','Control'));}
  icon(doc.getElementById('openFileButton'),'add');icon(doc.getElementById('loadProjectButton'),'edit');
  for(const [s,k] of [['[data-home-drawing]','add'],['[data-home-project]','edit']])icon(doc.querySelector(s),k);
  const strip=doc.querySelector('.document-strip'),nameBox=strip?.querySelector('.document-name');
  const fileState=doc.createElement('div');fileState.id='projectFileState';
  fileState.innerHTML='<button type="button" data-project-location title="Proje dosyası bilgisi"><span aria-hidden="true">📁</span><span data-project-file>Henüz proje dosyası yok</span></button><span data-project-dirty data-state="empty">Proje açık değil</span>';
  fileState.hidden=true;fileState.style.setProperty('display','none','important');
  nameBox?.after(fileState);
  let fileInfo={name:'',location:'',linked:false,mode:'none'};
  function setFileInfo(info={}){fileInfo={...fileInfo,...info};const label=fileState.querySelector('[data-project-file]');label.textContent=fileInfo.name||'Henüz proje dosyası yok';label.title=[fileInfo.name,fileInfo.location].filter(Boolean).join('\n');fileState.querySelector('[data-project-location]').disabled=!app.state.fileData;sync();}
  fileState.querySelector('[data-project-location]').onclick=()=>{if(!app.state.fileData)return;const location=fileInfo.location||(root.ASMachDesktop?'Windows uygulamasında seçilen kayıt konumu paket bağlantısı gerektirir.':'Tarayıcı güvenliği nedeniyle tam klasör yolu gösterilemez. Dosya adı ve kayıt durumu izlenir.');app.toast(`${fileInfo.name||'Proje henüz dosyaya kaydedilmedi'} · ${location}`);};
  root.addEventListener('asmach-project-file',event=>setFileInfo(event.detail||{}));
  async function confirmLeave(){
   if(!app.state.fileData)return true;
   if(app.state.boxRecognitionRunning||app.state.autoScanRequest||app.state.pendingRecognition||app.state.controlledDraft){app.toast('Önce devam eden okuma veya düzenlemeyi bitirin ya da iptal edin.');return false;}
   if(!root.ASMachRecovery?.dirty())return true;
   if(prompting)return false;prompting=true;
   try{return await new Promise(resolve=>{
    const dialog=doc.createElement('dialog');dialog.className='project-save-prompt';dialog.setAttribute('aria-labelledby','project-save-title');
    dialog.innerHTML='<header><strong id="project-save-title">Kaydedilmemiş değişiklikler</strong><button type="button" data-answer="cancel" aria-label="Pencereyi kapat">×</button></header><main><strong data-name></strong><p>Bu projede dosyaya kaydedilmemiş değişiklikler var.</p><small data-location></small><p data-warning>Kaydetmeden kapatırsanız son kayıttan sonraki değişiklikler proje dosyasında yer almaz.</p><p data-error role="alert"></p></main><footer><button type="button" data-answer="save" autofocus>Kaydet ve kapat</button><button type="button" data-answer="discard">Kaydetmeden kapat</button><button type="button" data-answer="cancel">Vazgeç</button></footer>';
    dialog.querySelector('[data-name]').textContent=app.state.metadata?.projectName||app.state.fileName||'Yeni Proje';
    dialog.querySelector('[data-location]').textContent=fileInfo.name?`Proje dosyası: ${fileInfo.name}${fileInfo.location?' · '+fileInfo.location:''}`:'Bu proje henüz bir proje dosyasına bağlanmadı. Kaydet seçildiğinde dosya konumu sorulacak.';
    const finish=result=>{dialog.close();dialog.remove();resolve(result);};
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(!saving)finish(false);});
    dialog.addEventListener('click',async e=>{const answer=e.target.closest('[data-answer]')?.dataset.answer;if(!answer||saving)return;if(answer!=='save'){finish(answer==='discard');return;}
     saving=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);dialog.querySelector('[data-error]').textContent='';
     try{const revision=root.ASMachRecovery?.version();const ok=await app.saveProject();if(ok!==true){dialog.querySelector('[data-error]').textContent='Kayıt iptal edildi. Proje açık bırakıldı.';return;}if(revision!==root.ASMachRecovery?.version())throw Error('Kayıt sırasında yeni bir değişiklik yapıldı. Güvenli kapatma için yeniden kaydedin.');finish(true);}catch(error){dialog.querySelector('[data-error]').textContent=error.message||'Proje kaydedilemedi.';}finally{saving=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);sync();}
    });doc.body.append(dialog);dialog.showModal();
   });}finally{prompting=false;}
  }
  async function close(){if(closing||!app.state.fileData)return false;closing=true;sync();try{if(!await confirmLeave())return false;await app.closeDocument();setFileInfo({name:'',location:'',linked:false,mode:'none'});return true;}catch(e){app.toast(e.message||String(e));return false;}finally{closing=false;sync();}}
  const closeButton=doc.createElement('button');closeButton.id='closeProjectButton';closeButton.type='button';closeButton.className='btn';closeButton.textContent='Projeyi kapat';closeButton.title='Projeyi kapat · Ctrl+W';closeButton.setAttribute('aria-keyshortcuts','Control+W');closeButton.onclick=()=>close();saveAsButton?.parentElement?.append(closeButton);
  function sync(event){
   const status=event?.detail||root.ASMachRecovery?.status?.()||{dirty:false};const hasDocument=Boolean(app.state.fileData),dirty=Boolean(status.dirty),indicator=fileState.querySelector('[data-project-dirty]');
   indicator.dataset.state=!hasDocument?'empty':dirty?'dirty':'saved';indicator.textContent=!hasDocument?'Proje açık değil':dirty?'Kaydedilmemiş değişiklikler':'Tüm değişiklikler kaydedildi';
   if(saveButton){saveButton.disabled=!hasDocument||saving||!dirty;saveButton.setAttribute('aria-label',dirty?'Projeyi kaydet':'Kaydedilecek değişiklik yok');}
   if(saveAsButton)saveAsButton.disabled=!hasDocument||saving;
   closeButton.disabled=!hasDocument||closing||saving;
  }
  root.addEventListener('asmach-project-status',sync);new MutationObserver(()=>sync()).observe(doc.getElementById('fileNameLabel'),{childList:true});sync();
  doc.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.isComposing||doc.querySelector('dialog:modal'))return;const key=e.key.toLowerCase(),id=key==='n'&&!e.shiftKey?'openFileButton':key==='o'&&!e.shiftKey?'loadProjectButton':key==='s'?(e.shiftKey?'saveProjectAsButton':'saveProjectButton'):key==='w'?'closeProjectButton':null;if(!id)return;e.preventDefault();e.stopImmediatePropagation();doc.getElementById(id)?.click();},true);
  const css=doc.createElement('style');css.textContent=`
   #rbPanel-file kbd{display:inline!important;margin-left:7px;font:10px Segoe UI;color:inherit;opacity:.7;background:transparent;border:0}#rbPanel-file .rb-tools{flex-wrap:wrap}.home-actions .btn{display:inline-flex;align-items:center;gap:7px}
   #projectFileState{display:flex;min-width:180px;max-width:42%;align-items:center;gap:8px;overflow:hidden;font-size:11px}#projectFileState [data-project-location]{display:flex;align-items:center;gap:5px;min-width:0;max-width:58%;padding:3px 6px;border:1px solid transparent;border-radius:5px;background:transparent;color:#28566d;cursor:pointer}#projectFileState [data-project-location]:hover:not(:disabled){border-color:#b8d6df;background:#eef8fa}#projectFileState [data-project-file]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#projectFileState [data-project-dirty]{flex:none;padding:3px 7px;border-radius:999px;font-weight:700;white-space:nowrap}#projectFileState [data-state=dirty]{background:#fff0d4;color:#875500}#projectFileState [data-state=saved]{background:#e2f5eb;color:#246342}#projectFileState [data-state=empty]{background:#eef2f4;color:#667b86}
   .project-save-prompt{padding:0;width:520px;max-width:calc(100vw - 32px);border:1px solid #b7c8d3;border-radius:7px;color:#193e54;background:white;box-shadow:0 15px 50px #1234}.project-save-prompt::backdrop{background:#132f4833}.project-save-prompt header{display:flex;align-items:center;justify-content:space-between;background:#f3f6f8;padding:10px 14px}.project-save-prompt header button{border:0;background:transparent;font-size:22px}.project-save-prompt main{padding:20px 24px}.project-save-prompt main strong{overflow-wrap:anywhere}.project-save-prompt small{display:block;color:#647c8c;overflow-wrap:anywhere}.project-save-prompt [data-warning]{padding:10px;border-left:3px solid #d58a00;background:#fff8e9}.project-save-prompt footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #dde6ec;background:#f7fafc}.project-save-prompt footer button{min-width:100px;padding:7px 14px;border:1px solid #c2d4df;border-radius:4px;background:white;color:#17485c}.project-save-prompt footer button:first-child{background:#008b9b;color:white;border-color:#008b9b}.project-save-prompt footer [data-answer=discard]{color:#9a2f2f}.project-save-prompt [data-error]{color:#b33030;font-size:12px}
   @media(max-width:900px){#projectFileState{max-width:50%}#projectFileState [data-project-location]{display:none}}
  `;doc.head.append(css);
  root.ASMachFileActions={close,confirmLeave,setFileInfo,sync};
 }
 root.ASMachFileActions={init};
})(window);
