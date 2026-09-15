(function(root){
 const key='asmach.report-brand.v1';
 function load(){try{return JSON.parse(root.ASMachPreferences.getItem(key)||'{}');}catch{return {};}}
 function mount(host){const saved=load(),form=document.createElement('div');let image=saved.logo||'';
  form.innerHTML='<label>Firma adı<input data-company maxlength="160"></label><label>Logo (PNG, en fazla 1 MB)<input data-logo type="file" accept="image/png"></label><img data-preview alt="Firma logosu" style="max-width:180px;max-height:70px"><button class="btn" data-clear>Logoyu varsayılana döndür</button><button class="btn primary" data-save>Firma bilgilerini kaydet</button><p role="status"></p>';
  form.querySelector('[data-company]').value=saved.company||'';const preview=form.querySelector('[data-preview]');preview.src=image||root.ASMachReportLogo||'';
  form.querySelector('[data-logo]').onchange=async e=>{const f=e.target.files[0];if(!f)return;const status=form.querySelector('[role=status]');if(f.type!=='image/png'||f.size>1048576){status.textContent='En fazla 1 MB boyutunda PNG seçin.';return;}try{const bytes=new Uint8Array(await f.arrayBuffer());if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('Geçersiz PNG.');const reader=new FileReader();reader.onload=async()=>{const img=new Image();img.src=reader.result;try{await img.decode();image=reader.result;preview.src=image;status.textContent='Logo hazır. Uygulamak için kaydedin.';}catch{status.textContent='Logo okunamadı.';}};reader.readAsDataURL(f);}catch(err){status.textContent=err.message;}};
  form.querySelector('[data-clear]').onclick=()=>{image='';preview.src=root.ASMachReportLogo||'';};
  form.querySelector('[data-save]').onclick=async()=>{try{root.ASMachPreferences.setItem(key,JSON.stringify({company:form.querySelector('[data-company]').value.trim(),logo:image}));await root.ASMachPreferences.flush?.();form.querySelector('[role=status]').textContent='Firma bilgileri kaydedildi.';}catch{form.querySelector('[role=status]').textContent='Kaydedilemedi. Tekrar deneyin.';}};
  form.style.cssText='display:grid;gap:12px;max-width:550px';form.querySelectorAll('label').forEach(l=>l.style.cssText='display:grid;gap:6px');host.append(form);
 }
 root.ASMachBrandSettings={load,mount};
})(window);
