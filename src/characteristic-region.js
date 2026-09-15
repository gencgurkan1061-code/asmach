(function(root){
  'use strict';
  // Returns a draft geometry patch. Never mutates the annotation or creates an undo step.
  async function open(app,record,{reselect=false}={}){
    const records=app.state.annotations;
    if(app.editCandidate&&record.selectionBox){
      return new Promise((resolve,reject)=>{let patch=null;const current=()=>records===app.state.annotations;
        app.editCandidate(record,result=>{if(!current())throw new Error('Belge değişti.');patch=result;},()=>resolve(current()?patch:null),{page:Number(record.page)||1,box:record.selectionBox,isCurrent:current,recognizeFresh:false,returnLabel:'Forma aktar',title:'Kutu, ölçü ve toleransları düzelt'}).catch(reject);
      });
    }
    let page=Number(record.page)||1,box=record.selectionBox;
    if(page!==app.state.currentPage)await app.changePage(page);
    if(reselect||!box){
      app.toast?.('Yeni ölçü kutusunu çizimde sürükleyerek seçin. Esc: vazgeç.');
      const selected=await app.selectScanArea();
      if(!selected)return null;
      page=selected.page;box=selected.box;
    }
    if(records!==app.state.annotations)return null;
    const sourceBox=app.snapshotSourceBox(box);
    const snapshot=await app.captureExact(sourceBox,page);
    const image=await app.loadImage(snapshot);
    if(records!==app.state.annotations)return null;
    const detected=app.savedReviewSelection({...record,selectionBox:box},sourceBox,image.naturalWidth||image.width,image.naturalHeight||image.height);
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.className='acui-dialog asmach-modal open acui-region-dialog';
      dialog.setAttribute('aria-label','Çizim kutusunu düzenle');
      dialog.innerHTML='<header class="acui-head"><div><div class="acui-eyebrow">ÇİZİM BÖLGESİ VE ÖLÇÜ</div><h2>Kutuyu ve toleransları düzelt</h2><p>Kutuyu seçin; sağdaki ölçü alanlarını görüntüyle karşılaştırın.</p></div></header><div class="acui-content"><div class="region-correction-layout"><div><div data-region-editor></div><button type="button" class="btn" data-region-recognize disabled style="margin-top:8px">Yeni seçimden ölçüyü yeniden tanı</button></div><div data-region-measurements></div></div><p data-region-error role="alert"></p></div><footer class="acui-foot"><span class="acui-foot-note">Kutu ve ölçü alanları birlikte taslağa aktarılır. Ana formu kaydedene kadar kayıt değişmez.</span><button type="button" class="btn" data-region-cancel>Vazgeç</button><button type="button" class="btn primary" data-region-accept disabled>Forma aktar</button></footer>';
      document.body.append(dialog);
      let patch=null,accepted=false,closed=false,busy=false;
      const accept=dialog.querySelector('[data-region-accept]');
      const recognize=dialog.querySelector('[data-region-recognize]'),status=dialog.querySelector('[data-region-error]');
      const measurementContainer=dialog.querySelector('[data-region-measurements]');
      const measurements=root.ASMachRegionMeasurements.mount(measurementContainer,record,app);
      const controller=root.ASMachSnapshots.mount(dialog.querySelector('[data-region-editor]'),snapshot,(edited,selection)=>{
        const selectionBox=app.mapSnapshotSelection(sourceBox,selection);
        patch={page,selectionBox,snapshot:edited,snapshotRotation:selection.angle,
          anchorX:selectionBox.x+selectionBox.w/2,anchorY:selectionBox.y+selectionBox.h/2};
        accept.disabled=busy;recognize.disabled=busy;
      },()=>{dialog.querySelector('[data-region-error]').textContent='Görüntü açılamadı. Vazgeçip yeniden deneyin.';accept.disabled=true;},{detected});
      const help=dialog.querySelector('.snapshot-controls small');
      if(help)help.textContent='İçinden taşı · Kenarlardan boyutlandır · Üst tutamaçla döndür · Yeni kutu ile yeniden çiz';
      dialog.querySelector('[data-region-cancel]').onclick=()=>dialog.close();
      recognize.onclick=async()=>{
        if(busy||!patch)return;controller.commit();busy=true;accept.disabled=true;recognize.disabled=true;measurementContainer.inert=true;dialog.querySelector('[data-region-editor]').inert=true;
        status.textContent='Seçilen görüntü okunuyor…';
        try{const read=await root.ASMachOCR.recognize(patch.snapshot);if(closed)return;if(read.error)throw new Error(read.error);if(!read.text?.trim())throw new Error('Metin okunamadı; ölçüyü elle girin.');measurements.applyText(read.text);status.textContent='Önerilen nominal ve toleransları görüntüyle karşılaştırın. Forma aktar ile onaylayın.';}
        catch(error){if(!closed)status.textContent=error.message;}
        finally{if(!closed){busy=false;accept.disabled=false;recognize.disabled=false;measurementContainer.inert=false;dialog.querySelector('[data-region-editor]').inert=false;}}
      };
      accept.onclick=()=>{if(busy)return;controller.commit();if(patch){try{patch={...patch,...measurements.read()};accepted=true;dialog.close();}catch(error){status.textContent=error.message;}}};
      dialog.addEventListener('keydown',event=>event.stopPropagation());
      dialog.addEventListener('close',()=>{closed=true;controller.dispose();dialog.remove();resolve(accepted&&records===app.state.annotations?patch:null);},{once:true});
      dialog.showModal();
    });
  }
  root.ASMachCharacteristicRegion={open};
})(window);
