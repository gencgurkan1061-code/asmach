(function(root){
 'use strict';
 function init(){
  const doc=document,settings=doc.getElementById('desktopSettings'),styles=doc.getElementById('balloonSettingsModal');
  if(!settings||!styles||settings.dataset.treeReady)return;
  settings.dataset.treeReady='true';
  const appearance=settings.querySelector('#ds-panel-appearance'),parts=[...appearance.children].filter(n=>n.tagName==='FIELDSET');
  let selected='appearance',query='',signature='',scheduled=false;
  const trees=[],expanded=new Map();
  const license=doc.createElement('fieldset');license.id='ds-panel-license';license.hidden=true;
  license.innerHTML='<legend>Lisans</legend><h3>Lisans bilgileri ve etkinleştirme</h3><p>Lisans süresi, cihaz kimliği ve doğrulama durumu güvenli lisans penceresinde gösterilir.</p><button type="button" class="btn primary">Lisans bilgilerini aç</button><p role="status"></p>';
  settings.querySelector('.ds-body').append(license);
  const licenseStatus=()=>{const available=!!root.ASMachDesktop?.license?.open;license.querySelector('button').disabled=!available;license.querySelector('[role=status]').textContent=available?'Etkinleştirme ve doğrulama işlemleri hemen uygulanır.':'Lisans işlemleri yalnızca kurulu masaüstü uygulamasında kullanılabilir.';};
  license.querySelector('button').onclick=()=>root.ASMachDesktop?.license?.open();root.addEventListener('asmach-native-ready',licenseStatus);licenseStatus();
  function makeTree(host,body){
   host.classList.add('settings-tree-shell');
   const layout=doc.createElement('div');layout.className='st-layout';body.before(layout);
   const aside=doc.createElement('aside');aside.className='st-sidebar';aside.setAttribute('aria-label','Ayar kategorileri');
   const search=doc.createElement('input');search.type='search';search.placeholder='Ayarlarda ara…';search.setAttribute('aria-label','Ayarlarda ara');
   const nav=doc.createElement('div');nav.className='st-tree';nav.setAttribute('role','tree');nav.setAttribute('aria-label','Ayarlar');
   aside.append(search,nav);layout.append(aside,body);body.classList.add('st-content');
   search.oninput=()=>{query=search.value;for(const t of trees)t.search.value=query;render();};
   nav.onkeydown=e=>{const bs=[...nav.querySelectorAll('button')].filter(b=>b.getClientRects().length),i=bs.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();bs[e.key==='Home'?0:e.key==='End'?bs.length-1:Math.max(0,Math.min(bs.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();}};
   new ResizeObserver(()=>{layout.style.gridTemplateColumns=aside.getBoundingClientRect().width+'px minmax(0,1fr)';}).observe(aside);
   const options=doc.createElement('nav');options.className='st-options';options.setAttribute('aria-label','Alt kategoriler');body.prepend(options);trees.push({nav,search,options});
  }
  makeTree(settings,settings.querySelector('.ds-body'));
  makeTree(styles.querySelector('.settings-card'),styles.querySelector('.modal-body'));
  const click=s=>doc.querySelector(s)?.click();
  function settingsArea(tab){
   if(!settings.open)click('#appSettingsButton');else root.ASMachWorkspaceTabs?.activate('settings');
   license.hidden=true;click('#desktopSettings>.ds-tabs [data-settings-tab="'+tab+'"]');
   settings.querySelectorAll('footer button').forEach(b=>b.hidden=tab!=='appearance');
  }
  function styleArea(classes){
   styles.classList.remove('st-legend-only');
   if(!styles.classList.contains('is-visible'))root.ASMachApp.openBalloonSettings();else root.ASMachWorkspaceTabs?.activate('styles');
   click('#balloonSettingsModal [data-style-area="'+(classes?'classes':'styles')+'"]');
  }
  function choose(id,action){extra.hidden=true;selected=id;action();render();}
  function rows(){
   const output=indices=>{settingsArea('output');settings.querySelectorAll('.os-grid>fieldset').forEach((n,i)=>n.hidden=!indices.includes(i));};
   const licensing=()=>{settingsArea('appearance');appearance.hidden=true;license.hidden=false;licenseStatus();};
   return [
    ['Genel',[
     ['general','Başlangıç ve kayıt',()=>custom('Başlangıç ve kayıt','Uygulama boş proje alanıyla başlar. Kaydedilen projeler ve son açılanlar burada listelenir. Çalışma sırasında yerel kurtarma kopyası otomatik tutulur; bu kopya proje dosyasını kaydetmenin yerini tutmaz.')],
     ['appearance','Görünüm ve paneller',()=>{showAppearance(0);parts.forEach(n=>n.hidden=false);}],
     ['columns','Karakteristik sütunları',()=>{custom('Karakteristik sütunları','Kullanıcıya özel liste görünümü');root.ASMachListColumns.mountSettings(extra);} ],
     ['keyboard','Klavye ve fare',()=>{custom('Klavye ve fare','Ctrl+N: Yeni Proje · Ctrl+O: Proje Aç · Ctrl+S: Kaydet · Ctrl+Shift+S: Farklı Kaydet. Tab ve yön tuşlarıyla alanlar arasında geçebilirsiniz.');const b=doc.createElement('button');b.className='btn';b.textContent='Kısayol rehberini aç';b.onclick=()=>click('#helpButton');extra.append(b);}]
    ]],
    ['Balon ve işaret tasarımı',[
     ['methods','Yöntem stilleri',()=>styleArea(false)],['classes','Sınıflandırmalar',()=>styleArea(true)],
     ['legend','Stil bilgi kutusu',()=>{styleArea(false);styles.classList.add('st-legend-only');const d=styles.querySelector('.appearance-legend');if(d)d.open=true;}]
    ]],
    ['Denetleme',[
     ['types','Tür varsayılanları',()=>{settingsArea('inspection');click('[data-inspection-tab="defaults"]');}],
     ['sampling','Numune alma',()=>{settingsArea('inspection');click('[data-inspection-tab="sampling"]');}]
    ]],
    ['Rapor ve çıktı',[
     ['pdf','PDF',()=>output([0,2,3])],['excel','Excel ve şablonlar',()=>output([1])],
     ['brand','Firma bilgileri ve logo',()=>{custom('Firma bilgileri ve logo','Yeni oluşturulan yerleşik raporlarda kullanılır. Özel Excel şablonlarındaki sabit yazı ve logoları şablon düzenleyicisinden değiştirin.');root.ASMachBrandSettings.mount(extra);}]
    ]]
   ];
  }
  const extra=doc.createElement('fieldset');extra.hidden=true;settings.querySelector('.ds-body').append(extra);
  function custom(title,description){settingsArea('appearance');appearance.hidden=true;extra.hidden=false;extra.replaceChildren();const h=doc.createElement('legend'),p=doc.createElement('p');h.textContent=title;p.textContent=description;extra.append(h,p);settings.querySelectorAll('footer button').forEach(b=>b.hidden=true);}
  function showAppearance(i){settingsArea('appearance');parts.forEach((n,j)=>n.hidden=i!==j);}
  root.ASMachSettingsTree.open=id=>{const item=rows().flatMap(([,items])=>items).find(item=>item[0]===id);if(item)choose(item[0],item[2]);};
  function render(){
   const groups=rows(),term=query.toLocaleLowerCase('tr-TR');
   const current=groups.find(([,items])=>items.some(([id])=>id===selected))||groups[0];
   for(const {nav,options} of trees){nav.replaceChildren();options.replaceChildren();
    for(const [title,items] of groups){if(!(title+' '+items.map(x=>x[1]).join(' ')).toLocaleLowerCase('tr-TR').includes(term))continue;const b=doc.createElement('button');b.type='button';b.dataset.category=title;b.setAttribute('role','treeitem');b.setAttribute('aria-selected',String(current[0]===title));b.textContent=title;b.onclick=()=>choose(items[0][0],items[0][2]);nav.append(b);}
    for(const [id,label,action] of current[1]){const b=doc.createElement('button');b.type='button';b.className='btn';b.dataset.setting=id;b.textContent=label;b.setAttribute('aria-pressed',String(selected===id));b.onclick=()=>choose(id,action);options.append(b);}
   }
  }
  const note=doc.createElement('p');note.className='st-save-note';note.textContent='Ayarları ilgili bölümün Kaydet düğmesiyle uygulayın. Sınıflandırma değişiklikleri otomatik kaydedilir.';settings.querySelector('.ds-body').prepend(note);
  const observe=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;const next=[...doc.querySelectorAll('.appearance-nav button,.cl-list button,.td-types button')].map(n=>n.textContent).join('|');if(next!==signature){signature=next;render();}});};
  new MutationObserver(observe).observe(styles,{childList:true,subtree:true});
  new MutationObserver(observe).observe(settings.querySelector('.type-defaults'),{childList:true,subtree:true});
  parts.forEach(n=>n.hidden=false);render();
  const css=doc.createElement('style');css.textContent=`
  .st-options{display:flex;align-items:center;flex-wrap:wrap;gap:7px;padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid #d4e2ec;background:white}.st-options .btn[aria-pressed=true]{background:#e0f2f5;color:#007c8c;border-color:#89c8d2}.st-options select{max-width:250px;border:1px solid #c8dce8;border-radius:4px;padding:6px;color:#234c62;background:white}
  html body #desktopSettings .ds-appearance-sections{grid-template-columns:1fr!important}
  html body #balloonSettingsModal.st-legend-only .sw-content{display:none!important}html body #balloonSettingsModal:not(.st-legend-only) .appearance-legend{display:none!important}
  html body :is(#desktopSettings,#balloonSettingsModal) .st-layout{display:grid!important;grid-template-columns:245px minmax(0,1fr);flex:1;min-height:0;overflow:hidden;background:#f7fafc}
  .st-sidebar{width:245px;padding:12px 10px;background:#f8fbfd;border-right:1px solid #d4e2ec;overflow:auto;resize:horizontal;min-width:185px;max-width:360px;box-sizing:border-box}
  .st-sidebar>input{width:100%;box-sizing:border-box;height:33px;border:1px solid #c8dce8;border-radius:5px;padding:6px 9px;background:white;color:#173e54}
  .st-tree{margin-top:12px}.st-tree summary{cursor:pointer;font-size:11px;font-weight:650;color:#527287;padding:9px 3px}.st-tree button{display:block;width:100%;border:0;border-left:3px solid transparent;background:transparent;text-align:left;color:#234c62;padding:7px 9px;font:12px 'Segoe UI',sans-serif;border-radius:3px;cursor:pointer}.st-tree button:hover{background:#edf5fa}.st-tree button[aria-selected=true]{background:#e0f2f5;border-left-color:#00899b;color:#007c8c;font-weight:600}.st-tree button.st-child{padding-left:23px}.st-tree button:focus-visible{outline:2px solid #00899b;outline-offset:-2px}
  html body #desktopSettings .st-content{padding:18px!important;overflow:auto;min-width:0;background:white}
  html body #desktopSettings>.ds-tabs,html body #desktopSettings .inspection-settings>.ds-tabs,html body #desktopSettings .ds-intro,html body #balloonSettingsModal .ds-style-tabs,html body #balloonSettingsModal .style-area-tabs{display:none!important}
  html body #desktopSettings .td-types{display:flex!important;flex-direction:column!important}
  html body #balloonSettingsModal .studio-library{display:block!important;min-width:0;overflow:auto}
  html body #desktopSettings .td-layout{grid-template-columns:180px minmax(0,1fr)!important}
  html body #desktopSettings .ds-appearance-sections>fieldset[hidden],html body #desktopSettings .os-grid>fieldset[hidden]{display:none!important}
  html body #desktopSettings .ds-body>fieldset{max-width:none!important;margin:0;padding:16px!important;border:1px solid #d6e4ed;border-radius:6px;background:white}
  html body #desktopSettings .os-grid{grid-template-columns:1fr!important}.st-save-note{font-size:11px;color:#617d8e;margin:0 0 14px}
  html body #balloonSettingsModal .st-content{min-width:0;padding:12px!important;overflow:auto;background:white!important}
  html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard{grid-template-columns:190px minmax(0,1fr)!important;max-width:none!important}
  html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard .studio-inspector{grid-column:2!important;grid-template-columns:minmax(0,1fr) 250px!important}
  html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard :is(.appearance-group,[data-studio-group]){grid-template-columns:minmax(0,1fr)!important}
  html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard :is(.appearance-group,[data-studio-group])>label{grid-template-columns:120px minmax(0,1fr)!important;grid-column:1!important}
  html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard :is(.appearance-group,[data-studio-group])>h3{grid-column:1/-1!important}
  html body #balloonSettingsModal .sw-top{padding:8px 0!important}html body #balloonSettingsModal .sw-content{overflow:visible!important}
  @media(max-width:1200px){html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard .studio-inspector{grid-template-columns:minmax(0,1fr)!important}html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard .studio-stage{grid-column:1!important;grid-row:auto!important;position:static}html body #balloonSettingsModal.sw-redesign .st-content .studio-dashboard :is(.appearance-fields,.cl-fields){grid-template-columns:minmax(0,1fr)!important}}
  `;doc.head.append(css);
 }
 root.ASMachSettingsTree={init};
})(window);
