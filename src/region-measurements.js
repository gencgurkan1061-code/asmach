(function(root){
  'use strict';
  const names=['type','unit','nominalValue','lowerTolerance','upperTolerance'];
  const num=v=>String(v??'').trim().replace(',','.').replace('−','-');
  const numeric=v=>num(v)!==''&&Number.isFinite(Number(num(v)));
  const decimal=v=>String(Number(v.toFixed(10)));
  function derive(record,values){
    const result={...record,...values};
    for(const name of names.slice(2)){if(result[name]&&!numeric(result[name]))throw new Error('Ölçü ve tolerans alanlarına geçerli sayı girin.');result[name]=num(result[name]);}
    const numericType=!root.ASMachRequirements.fieldProfile||root.ASMachRequirements.fieldProfile(result.type).numeric;
    if(!numericType)return values;
    if(result.type==='GD&T')result.nominalValue='';
    const keepLimits=record.limitDimension&&record.type===result.type&&['lowerTolerance','upperTolerance'].every(k=>num(record[k])===num(result[k]));
    if(keepLimits){
      if(num(record.nominalValue)!==num(result.nominalValue)){result.nominalSource='manual';for(const [tol,limit] of [['lowerTolerance','lowerLimit'],['upperTolerance','upperLimit']])result[tol]=numeric(result.nominalValue)&&numeric(record[limit])?decimal(Number(record[limit])-Number(result.nominalValue)):'';}
    }else{
      result.limitDimension=false;result.nominalSource='';
      result.lowerLimit=numeric(result.nominalValue)&&numeric(result.lowerTolerance)?decimal(Number(result.nominalValue)+Number(result.lowerTolerance)):'';
      result.upperLimit=numeric(result.nominalValue)&&numeric(result.upperTolerance)?decimal(Number(result.nominalValue)+Number(result.upperTolerance)):'';
    }
    if(numeric(result.lowerTolerance)&&numeric(result.upperTolerance)&&Number(result.lowerTolerance)>Number(result.upperTolerance))throw new Error('Alt tolerans üst toleranstan büyük olamaz. İşaretleri kontrol edin.');
    result.toleranceExplicit=numeric(result.lowerTolerance)||numeric(result.upperTolerance);
    result.toleranceStandard=keepLimits?record.toleranceStandard:result.toleranceExplicit?'Yeniden seçimde doğrulanan tolerans':'';
    result.requirementMode='auto';
    const synced=root.ASMachRequirements.syncRequirement(result,true);
    return Object.fromEntries([...names,'nominalSource','limitDimension','decimalPlaces','lowerLimit','upperLimit','toleranceExplicit','toleranceStandard','requirement','requirementMode'].map(k=>[k,synced[k]]));
  }
  function mount(container,record,app){
    if(!['Uzunluk','Çap','Yarıçap','Açı','Tolerans'].includes(record.type)){
      container.innerHTML='<h3>Özel karakteristik</h3><p>Kutuyu burada düzeltebilirsiniz. GD&amp;T, diş ve diğer özel karakteristik alanlarını ana formdaki ilgili bölümden düzenleyin.</p>';
      return{read:()=>({}),applyText(){throw new Error('Bu karakteristiğin özel ölçü alanlarını ana formdan düzenleyin.');},changed:false};
    }
    const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const types=[...new Set(['Uzunluk','Çap','Yarıçap','Açı','Tolerans',record.type].filter(Boolean))];
    const field=(key,label)=>`<label class="acui-field"><span>${label}</span><input data-measure="${key}" ${key==='unit'?'':'inputmode="decimal"'} value="${escape(record[key])}"></label>`;
    container.innerHTML=`<h3 style="margin:0 0 12px">Ölçü ve toleransları doğrula</h3><div class="acui-grid" style="grid-template-columns:1fr 1fr"><label class="acui-field"><span>Tür</span><select data-measure="type">${types.map(t=>`<option ${t===record.type?'selected':''}>${escape(t)}</option>`).join('')}</select></label>${field('unit','Birim')}<div data-region-numeric class="acui-full"><div class="acui-grid" style="grid-template-columns:1fr 1fr">${field('nominalValue','Nominal') }<label class="acui-field"><span>Simetrik ±</span><input data-symmetric inputmode="decimal" placeholder="Örn. 0.05"></label>${field('lowerTolerance','Alt tolerans')}${field('upperTolerance','Üst tolerans')}</div></div></div><p data-region-limits class="acui-subtle"></p><div style="padding:10px;background:#eaf5f8;border-radius:8px;margin:10px 0"><small>ALANLARDAN OLUŞAN GEREKLİLİK</small><div data-region-requirement style="font-weight:700;margin-top:4px"></div></div><label class="acui-field"><span>Kaynak / tanınan metin</span><textarea data-region-text rows="2">${escape(record.ocrText||record.requirement||'')}</textarea></label><button type="button" class="btn" data-region-parse style="margin-top:8px">Metinden alanları doldur</button><p data-measure-message class="acui-subtle">Alanlar yalnızca Forma aktar ile ana taslağa geçer.</p>`;
    const $=s=>container.querySelector(s);let touched=false,parsedSource=null,parsedExtras={};
    if(numeric(record.lowerTolerance)&&numeric(record.upperTolerance)&&Number(num(record.lowerTolerance))===-Number(num(record.upperTolerance)))$('[data-symmetric]').value=num(record.upperTolerance);
    const values=()=>Object.fromEntries(names.map(k=>[k,$(`[data-measure="${k}"]`).value]));
    function refresh(){
      const v=values(),profile=root.ASMachRequirements.fieldProfile?.(v.type);
      $('[data-region-numeric]').hidden=profile&&!profile.numeric;
      try{const p=derive({...record,...parsedExtras},v);$('[data-region-requirement]').textContent=p.requirement||record.requirement||'—';$('[data-region-limits]').textContent=`Alt limit: ${p.lowerLimit||'—'} · Üst limit: ${p.upperLimit||'—'}`;$('[data-measure-message]').textContent='Gereklilik ve limitler alanlardan hesaplanır. Kaynaktaki değerleri kontrol edin.';}
      catch(e){$('[data-measure-message]').textContent=e.message;}
    }
    function applyText(text){
      const parsed=app.parseRequirement(text);if(!parsed)throw new Error('Ölçü metni çözümlenemedi.');
      if(!types.includes(parsed.type))throw new Error('Bu türü ana formdan düzenleyin.');
      if(root.ASMachRequirements.fieldProfile?.(parsed.type).nominal&&!numeric(parsed.nominalValue))throw new Error('Nominal değer okunamadı. Ölçüyü elle girin.');
      parsedSource={toleranceExplicit:parsed.toleranceExplicit,toleranceStandard:parsed.toleranceStandard,limitDimension:parsed.limitDimension===true,nominalSource:parsed.nominalSource||'',decimalPlaces:parsed.decimalPlaces};
      parsedExtras=Object.fromEntries(['fitClass','threadPitch','threadClass','threadStandard','gdtSubtype','datumRefs','gdtFrame','quantity','chamferAngle','chamferAngleTolerance'].map(k=>[k,parsed[k]??(k==='gdtFrame'?null:k==='quantity'?1:'')]));
      Object.assign(parsedExtras,parsedSource,{lowerLimit:parsed.lowerLimit,upperLimit:parsed.upperLimit,nominalValue:parsed.nominalValue,lowerTolerance:parsed.lowerTolerance,upperTolerance:parsed.upperTolerance});
      names.forEach(k=>{$(`[data-measure="${k}"]`).value=parsed[k]??'';});$('[data-region-text]').value=text;touched=true;refresh();
      $('[data-symmetric]').value=numeric(parsed.lowerTolerance)&&numeric(parsed.upperTolerance)&&Number(parsed.lowerTolerance)===-Number(parsed.upperTolerance)?String(Math.abs(Number(parsed.upperTolerance))):'';
    }
    const changed=event=>{if(event.target.dataset.measure){touched=true;parsedSource=null;if(['lowerTolerance','upperTolerance'].includes(event.target.dataset.measure))$('[data-symmetric]').value='';refresh();}};
    container.addEventListener('input',changed);container.addEventListener('change',changed);
    $('[data-symmetric]').oninput=()=>{const v=$('[data-symmetric]').value;if(!numeric(v))return;const d=Math.abs(Number(num(v)));$('[data-measure="lowerTolerance"]').value=decimal(-d);$('[data-measure="upperTolerance"]').value=decimal(d);touched=true;parsedSource=null;refresh();};
    $('[data-region-parse]').onclick=()=>{try{applyText($('[data-region-text]').value);}catch(e){$('[data-measure-message]').textContent=e.message;}};
    refresh();
    return{applyText,read(){if(!touched)return{};return{...parsedExtras,...derive({...record,...parsedExtras},values()),...(parsedSource||{}),ocrText:$('[data-region-text]').value};},get changed(){return touched;}};
  }
  root.ASMachRegionMeasurements={mount,derive};
})(window);
