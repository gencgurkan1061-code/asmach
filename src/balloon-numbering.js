/* Number labels are independent of record identity. Plans remain inert until saved. */
(function(root){
  'use strict';
  const key=value=>{const text=String(value??'').trim();return /^\d+$/.test(text)?text.replace(/^0+(?=\d)/,''):text;};
  function next(records){const used=new Set(records.flatMap(r=>[key(r.number),key(String(r.number).split('.')[0]) ]));let n=1;while(used.has(String(n)))n++;return String(n);}
  function stamp(records){return JSON.stringify(records.map(r=>[r.id,String(r.number)]));}
  function plan(records,id,value,action){
    const desired=String(value??'').trim(),record=records.find(r=>r.id===id);
    if(!record)return{error:'Düzenlenen balon bulunamadı.'};
    if(!desired)return{error:'Balon numarası boş bırakılamaz.'};
    const other=records.find(r=>r.id!==id&&key(r.number)===key(desired));
    const result={records,stamp:stamp(records),changes:[],desired};
    if(other){
      if(!action)return{...result,conflict:{id:other.id,number:String(other.number),old:String(record.number)}};
      if(!['swap','relocate'].includes(action))return null;
      const replacement=action==='swap'?String(record.number):next(records);
      if(key(replacement)===key(desired))return{error:'Bu numara zaten yineleniyor. Mevcut balonu ilk boş numaraya taşıma seçeneğini kullanın.'};
      if(records.some(r=>r.id!==id&&r.id!==other.id&&key(r.number)===key(replacement)))return{error:'Mevcut numaralar birden fazla kayıtta kullanılıyor; önce bu kayıtları düzeltin.'};
      result.changes.push({id:other.id,number:replacement});
    }
    if(String(record.number)!==desired)result.changes.push({id,number:desired});
    return result;
  }
  function valid(records,p){return !!p&&!p.error&&!p.conflict&&records===p.records&&stamp(records)===p.stamp;}
  function apply(records,p){if(!valid(records,p))return false;for(const change of p.changes)records.find(r=>r.id===change.id).number=change.number;return true;}
  function compact(records){
    return [...records].sort((a,b)=>String(a.number).localeCompare(String(b.number),'tr',{numeric:true})||a.page-b.page)
      .map((record,i)=>({id:record.id,number:String(i+1)}));
  }
  function choose(title,message,choices){
    return window.ASMachMessages.request({title,message,choices:[...choices.map(c=>({...c,positive:!!c.primary})),{value:null,label:'Vazgeç'}],cancelValue:null}).then(r=>r.value);
  }
  async function resolve(state,id,value){
    const initial=plan(state.annotations,id,value);if(!initial?.conflict)return initial;
    const c=initial.conflict,free=next(state.annotations);
    const action=await choose('Bu balon numarası kullanımda',`${initial.desired} numarası başka bir balonda var. Nasıl devam edilsin?`,[
      {value:'swap',label:`Numaraları değiş tokuş et: ${c.old} ↔ ${c.number}`},
      {value:'relocate',label:`Mevcut ${c.number} numaralı balonu ilk boş numaraya taşı: ${free}`}
    ]);
    if(!action)return null;
    if(state.annotations!==initial.records||stamp(state.annotations)!==initial.stamp)return{error:'Balon listesi değişti. Lütfen numara değişikliğini yeniden deneyin.'};
    return plan(state.annotations,id,value,action);
  }
  function afterDelete(){return choose('Kalan balonlar yeniden sıralansın mı?',
    'Evet: Tüm sayfalardaki balonlar mevcut numara sırasıyla 1’den başlayacak. Hayır: Numaralar korunacak; yeni balon ilk boş pozitif numarayı alacak. Vazgeç: Silme işlemini iptal et.',[
      {value:'compact',label:'Evet — yeniden numaralandır'},
      {value:'keep',label:'Hayır — mevcut numaraları koru',primary:true}
    ]);}
  root.ASMachBalloonNumbering={next,plan,valid,apply,compact,resolve,afterDelete,stamp};
})(window);
