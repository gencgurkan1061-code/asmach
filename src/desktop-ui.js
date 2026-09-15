/* Device-local presentation preferences. Never modifies drawing/project data. */
(function(root){
  'use strict';
  const KEY='asmach.desktop.preferences.v1';
  const defaults={density:'compact',accent:'teal',header:'navy',background:'grid',shortcuts:true,motion:true,toolsPosition:'top',tableDensity:'normal',tableText:'normal',rowHighlight:true};
  function normalize(value){
    const v=value&&typeof value==='object'?value:{};
    const p={...defaults};
    for(const [key,choices] of Object.entries({density:['compact','comfortable'],accent:['teal','blue','violet'],header:['navy','light'],background:['grid','gray','dark'],toolsPosition:['top','bottom'],tableDensity:['compact','normal','comfortable'],tableText:['normal','large']}))if(choices.includes(v[key]))p[key]=v[key];
    for(const key of ['shortcuts','motion','rowHighlight'])if(typeof v[key]==='boolean')p[key]=v[key];
    return p;
  }
  const paths={gear:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',folder:'M3 7V5h6l2 2h10v13H3z',tools:'m4 20 9-9 M14 3a6 6 0 0 0 7 7l-4-3 1-4 M3 17l4 4',report:'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8',scan:'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M7 12h10',number:'M8 3 6 21 M17 3l-2 18 M3 9h18 M2 15h18',fit:'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z',note:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5'};
  function icon(name){return `<svg class="tool-icon desktop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.note}"/></svg>`;}
  function init(app){
    const doc=root.document;if(!doc||doc.getElementById('appSettingsButton'))return;
    let saved;try{saved=normalize(JSON.parse(root.ASMachPreferences.getItem(KEY)));}catch{saved=normalize();}
    function apply(p){
      const el=doc.documentElement;
      for(const key of ['density','accent','header','background'])el.dataset['desktop'+key[0].toUpperCase()+key.slice(1)]=p[key];
      el.dataset.desktopShortcuts=String(p.shortcuts);el.dataset.desktopMotion=String(p.motion);
      el.dataset.desktopToolsPosition=p.toolsPosition;el.dataset.desktopTableDensity=p.tableDensity;el.dataset.desktopTableText=p.tableText;el.dataset.desktopRowHighlight=String(p.rowHighlight);
    }
    apply(saved);
    const style=doc.createElement('style');style.textContent=`
      .topbar{min-height:56px;padding:8px 16px}.topbar h1{font-size:16px}.brand-mark{width:34px;height:34px;flex-basis:34px;border-radius:9px}.eyebrow{font-size:9px;letter-spacing:.1em}
      .toolbar[data-organized] .btn,.toolbar[data-organized] .icon-btn{border-radius:6px;min-height:36px;font-size:12px}.toolbar .tool-icon{width:17px;height:17px;flex:0 0 17px}.toolbar .mode-active{box-shadow:inset 0 -2px var(--teal)}
      [data-desktop-density=compact] .toolbar[data-organized]{min-height:44px;padding:5px 10px}[data-desktop-density=compact] .toolbar[data-organized] .btn,[data-desktop-density=compact] .toolbar[data-organized] .icon-btn{min-height:31px;font-size:11px}
      [data-desktop-shortcuts=false] .toolbar .shortcut{display:none!important}
      [data-desktop-accent=blue]{--teal:#2563eb;--teal-strong:#1d4ed8;--teal-soft:#eff6ff}
      [data-desktop-accent=violet]{--teal:#7c3aed;--teal-strong:#6d28d9;--teal-soft:#f5f3ff}
      [data-desktop-header=light] .topbar{background:#fff;color:#0b1930;border-color:#d8e2ec}[data-desktop-header=light] .eyebrow{color:#047381}[data-desktop-header=light] .security-note{color:#047354}
      [data-desktop-background=gray] .viewer{background:#e3e8ee!important}[data-desktop-background=dark] .viewer{background:#303b4c!important}
      [data-desktop-motion=false] *,[data-desktop-motion=false] *::before,[data-desktop-motion=false] *::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}
      #desktopSettings{color:#14283c;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:0;width:min(820px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);box-shadow:0 24px 80px #07172855}
      #desktopSettings::backdrop{background:#07172888}#desktopSettings[open]{display:flex;flex-direction:column}#desktopSettings header,#desktopSettings footer{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;gap:12px;background:#f5f8fb}#desktopSettings header{border-bottom:1px solid #dbe4ed}#desktopSettings h2{font-size:18px;margin:0}#desktopSettings p{font-size:12px;color:#53677d;line-height:1.6;margin:7px 0}
      #desktopSettings .ds-body{overflow:auto;min-height:0;padding:18px 20px}#desktopSettings fieldset{border:1px solid #dbe4ed;border-radius:9px;padding:14px;margin:0 0 16px}#desktopSettings legend{font-weight:700;font-size:13px;padding:0 6px}#desktopSettings .ds-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}#desktopSettings label{font-size:12px;display:flex;flex-direction:column;gap:6px}#desktopSettings select{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;background:white;color:#14283c;padding:9px}#desktopSettings .ds-check{flex-direction:row;align-items:center}#desktopSettings input[type=checkbox]{width:16px;height:16px;accent-color:var(--teal)}#desktopSettings .ds-links{display:flex;gap:8px;flex-wrap:wrap}#desktopSettings footer{border-top:1px solid #dbe4ed;flex-wrap:wrap}#desktopSettings .ds-actions{display:flex;gap:8px;margin-left:auto}#desktopSettings [data-error]{color:#b42318}#desktopSettings button:focus-visible,#desktopSettings select:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
      @media(max-width:600px){.topbar .security-note{display:none}#desktopSettings .ds-grid{grid-template-columns:1fr}#desktopSettings header,#desktopSettings footer,#desktopSettings .ds-body{padding:12px}.toolbar[data-organized] .btn{padding:5px 7px}}
      @media print{#appSettingsButton,#desktopSettings{display:none!important}}
    `;doc.head.append(style);
    for(const [id,name] of Object.entries({autoDetectButton:'scan',viewNumberingButton:'number',balloonSettingsButton:'gear',inspectionReportsButton:'report',fitButton:'fit',acuiMetadataOpen:'note',acuiCreateManual:'note',acuiCreateNote:'note'})){
      const b=doc.getElementById(id);if(b&&!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',icon(name));
    }
    doc.querySelectorAll('.wl-menu>summary').forEach(s=>s.insertAdjacentHTML('afterbegin',icon(s.dataset.menuIcon||'tools')));
    const button=doc.createElement('button');button.id='appSettingsButton';button.type='button';button.className='btn';button.title='Program ayarları';button.setAttribute('aria-haspopup','dialog');button.innerHTML=icon('gear')+'<span>Ayarlar</span>';
    (doc.querySelector('#wlGlobal')||doc.querySelector('.wl-secondary'))?.append(button);
    const dialog=doc.createElement('dialog');dialog.id='desktopSettings';dialog.setAttribute('aria-labelledby','desktopSettingsTitle');
    dialog.innerHTML=`<header><div><h2 id="desktopSettingsTitle">Program ayarları</h2><p>Çalışma alanınızı kişiselleştirin · Bu cihazda saklanır</p></div><button type="button" class="icon-btn" data-cancel aria-label="Ayarları kapat">×</button></header>
      <div class="ds-body"><fieldset><legend>Görünüm ve çalışma alanı</legend><div class="ds-grid">
      <label>Araç çubuğu yoğunluğu<select data-pref="density"><option value="compact">Kompakt</option><option value="comfortable">Rahat</option></select></label>
      <label>Vurgu rengi<select data-pref="accent"><option value="teal">Turkuaz</option><option value="blue">Mavi</option><option value="violet">Mor</option></select></label>
      <label>Üst şerit<select data-pref="header"><option value="navy">Lacivert</option><option value="light">Açık</option></select></label>
      <label>Çizim çevresi<select data-pref="background"><option value="grid">Damalı</option><option value="gray">Açık gri</option><option value="dark">Koyu gri</option></select></label>
      <label class="ds-check"><input type="checkbox" data-pref="shortcuts">Butonlarda kısayol etiketleri</label><label class="ds-check"><input type="checkbox" data-pref="motion">Arayüz geçişleri</label></div><p>Görünüm değişiklikleri anında önizlenir. Teknik resmin renkleri ve rapor çıktıları değişmez. Dar ekranlarda kısayol etiketleri otomatik gizlenir.</p></fieldset>
      <fieldset><legend>Çizim ve çıktı ayarları</legend><p>Balon stilleri ve çıktı seçenekleri kendi ekranlarından düzenlenir; program görünümünden bağımsızdır.</p><div class="ds-links"><button class="btn" type="button" data-link="balloonSettingsButton">Balon stilleri</button><button class="btn" type="button" data-link="pdfButton">Çıktılar</button></div></fieldset>
      <fieldset><legend>Veriler ve kısayollar</legend><p>Çizimler yerel olarak işlenir. Kurtarma kopyası proje dosyasının yerine geçmez; projenizi ayrıca kaydedin. Bu ekranı sıfırlamak çizimleri veya kontrol planlarını silmez.</p><p>V: Seç · B: Balon ekle · K: Kutu OCR · Ctrl+Z: Geri al</p></fieldset><p data-error role="alert"></p></div>
      <footer><button type="button" class="btn" data-reset>Varsayılan görünüm</button><div class="ds-actions"><button type="button" class="btn" data-cancel>Vazgeç</button><button type="button" class="btn primary" data-save>Ayarları kaydet</button></div></footer>`;
    const body=dialog.querySelector('.ds-body'),sections=[...body.querySelectorAll('fieldset')];
    const tableSection=doc.createElement('fieldset');tableSection.innerHTML='<legend>Tablo okunabilirliği</legend><div class="ds-grid"><label>Satır yoğunluğu<select data-pref="tableDensity"><option value="compact">Sıkışık · Daha çok kayıt</option><option value="normal">Normal</option><option value="comfortable">Rahat · Geniş satırlar</option></select></label><label>Tablo yazı boyutu<select data-pref="tableText"><option value="normal">Normal</option><option value="large">Büyük</option></select></label><label class="ds-check"><input type="checkbox" data-pref="rowHighlight">Fare altındaki satırı vurgula</label></div><p>Karakteristik, otomatik tarama ve Proje ve Kalite tablolarının ekrandaki görünümünü değiştirir. Excel ve PDF biçimlendirmesi korunur.</p><div class="ds-sample"><table><thead><tr><th>Balon</th><th>Ölçü / gereklilik</th><th>Durum</th></tr></thead><tbody><tr><td>36</td><td>Ø20 ±0.1 mm</td><td>Kontrol bekliyor</td></tr><tr><td>36.1</td><td>Konum · Ø0.2 · B · C · D</td><td>Alt karakteristik</td></tr></tbody></table></div>';
    sections[1].querySelector('.ds-links').before(dialog.querySelector('[data-pref=background]').closest('label'));
    sections[1].insertAdjacentHTML('beforeend','<div class="ds-grid"><label>Yüzen PDF araçlarının konumu<select data-pref="toolsPosition"><option value="top">Sağ üst</option><option value="bottom">Alt orta</option></select></label></div><p>Yakınlaştırma, uzaklaştırma, sayfaya sığdırma ve çok sayfalı PDF geçişleri çizimin üzerinde bulunur. Araçlar çizimle birlikte büyümez.</p>');
    const nav=doc.createElement('nav');nav.className='ds-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Ayar kategorileri');
    const appearancePanel=doc.createElement('fieldset');appearancePanel.className='ds-appearance-sections';
    sections[0].querySelector('legend').textContent='Genel görünüm';sections[1].id='ds-panel-drawing';tableSection.id='ds-panel-tables';
    appearancePanel.append(sections[0],sections[1],tableSection);
    sections[2].remove();
    const entries=[['appearance','Görünüm',appearancePanel],['inspection','Denetleme varsayılanları',root.ASMachTypeInspectionDefaults.panel(app)],['output','Çıktı ayarları',root.ASMachReportOutputSettings.panel()]];
    const selectTab=key=>{for(const [id,,panel] of entries){panel.hidden=id!==key;const b=nav.querySelector('[data-settings-tab='+id+']');b.setAttribute('aria-selected',String(id===key));b.tabIndex=id===key?0:-1;}};
    for(const [id,title,panel] of entries){panel.id='ds-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','ds-tab-'+id);body.append(panel);const b=doc.createElement('button');b.type='button';b.id='ds-tab-'+id;b.dataset.settingsTab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.textContent=title;b.onclick=()=>selectTab(id);nav.append(b);}
    nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...nav.children],i=buttons.indexOf(doc.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});
    dialog.insertBefore(nav,body);selectTab('appearance');
    const mountNative=()=>{const native=root.ASMachDesktop?.settingsPanel;if(!native||entries.some(e=>e[0]==='native'))return;native.open=true;native.hidden=true;native.querySelector('summary').hidden=true;entries.push(['native','Masaüstü',native]);body.append(native);const b=doc.createElement('button');b.type='button';b.dataset.settingsTab='native';b.setAttribute('role','tab');b.setAttribute('aria-selected','false');b.textContent='Masaüstü';b.onclick=()=>selectTab('native');nav.append(b);const style=doc.createElement('style');style.textContent='#desktopSettings .native-menu{position:static;margin:0;border:0;z-index:auto}#desktopSettings .native-menu section{position:static;width:min(600px,100%);box-sizing:border-box;box-shadow:none;border:1px solid #cbdce6;border-radius:5px;gap:10px}#desktopSettings .native-menu[hidden],#desktopSettings .native-menu summary[hidden]{display:none!important}';doc.head.append(style);};root.addEventListener('asmach-native-ready',mountNative);mountNative();
    // The style editor remains independent, but shares the Settings category navigation.
    const styleTab=doc.createElement('button');styleTab.type='button';styleTab.dataset.settingsTab='styles';styleTab.setAttribute('role','tab');styleTab.setAttribute('aria-selected','false');styleTab.setAttribute('aria-controls','balloonSettingsModal');styleTab.tabIndex=-1;styleTab.textContent='Balon stilleri';styleTab.onclick=()=>doc.getElementById('balloonSettingsButton')?.click();nav.insertBefore(styleTab,nav.children[1]);
    sections[1].querySelector('.ds-links')?.remove();sections[1].querySelector('legend').textContent='Çizim ve PDF';sections[1].querySelector('p').textContent='Çizim yüzeyinin görünümünü ve yüzen araçların konumunu düzenleyin. Balon biçimleri ayrı sekmededir.';
    const styleNav=doc.createElement('nav');styleNav.className='ds-tabs ds-style-tabs';styleNav.setAttribute('role','tablist');styleNav.setAttribute('aria-label','Ayar kategorileri');
    for(const key of ['appearance','styles','inspection','output']){const b=doc.createElement('button');b.type='button';b.dataset.settingsTab=key;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(key==='styles'));b.tabIndex=key==='styles'?0:-1;b.textContent=key==='styles'?'Balon stilleri':entries.find(e=>e[0]===key)[1];b.onclick=()=>{if(key==='styles')return;doc.getElementById('appSettingsButton').click();selectTab(key);};styleNav.append(b);}
    styleNav.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const bs=[...styleNav.children],i=bs.indexOf(doc.activeElement),j=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;bs[j].focus();bs[j].click();};
    doc.querySelector('#balloonSettingsModal .settings-card')?.prepend(styleNav);
    const hint=doc.createElement('div');hint.className='ds-intro';hint.innerHTML='<h2>Ayarlar</h2><p>Bu cihaza ait çalışma tercihleri. Değişiklikleri önizleyin ve kaydedin.</p>';body.prepend(hint);
    const appearanceStyle=doc.createElement('style');appearanceStyle.textContent='html body #desktopSettings .ds-body>.ds-appearance-sections{display:grid;gap:14px;padding:0;border:0;background:transparent}#desktopSettings .ds-appearance-sections>fieldset{margin:0;padding:16px 18px;border:1px solid #d5e1e9;border-radius:7px;background:white;min-width:0}#desktopSettings .ds-appearance-sections legend{font-weight:650;font-size:13px;color:#214a61;padding:0 5px}#desktopSettings .ds-appearance-sections .ds-grid{gap:12px;margin-bottom:10px}#desktopSettings .ds-appearance-sections p{margin:8px 0;font-size:11px}';doc.head.append(appearanceStyle);
    sections[2].querySelector('p:last-child').textContent='Kısayollar ve işlev açıklamaları için Yardım bölümüne geçin. Proje dosyanızı düzenli olarak kaydedin; kurtarma kopyası ayrıca dosya kaydetmenin yerini tutmaz.';
    sections[2].insertAdjacentHTML('beforeend','<div class="ds-links"><button class="btn" data-link="helpButton">Kullanım kılavuzu ve kısayollar</button></div>');
    dialog.querySelector('[data-reset]').textContent='Tercihleri sıfırla';dialog.querySelector('.ds-actions [data-cancel]').textContent='Değişiklikleri geri al';
    style.textContent+=`
    #desktopSettings{background:#f3f6fa}#desktopSettings [hidden]{display:none!important}#desktopSettings .ds-tabs{display:flex;gap:5px;padding:6px 12px;border-bottom:1px solid #d5e1e9;background:white;flex-wrap:wrap;flex-shrink:0}#desktopSettings .ds-tabs button{border:0;border-bottom:2px solid transparent;background:transparent;color:#4a6277;border-radius:4px;padding:9px 13px;font-size:12px;cursor:pointer}#desktopSettings .ds-tabs [aria-selected=true]{background:#e5f5f7;color:#007e90;border-color:#008da1;font-weight:600}#desktopSettings .ds-body{flex:1;padding:22px;display:block}#desktopSettings .ds-intro{margin:0 auto 22px;max-width:1200px}#desktopSettings .ds-body>fieldset{max-width:1200px;margin:0 auto;padding:24px;background:white;border-radius:10px}#desktopSettings .ds-grid{gap:22px;margin-bottom:20px}#desktopSettings .ds-links{margin:16px 0}#desktopSettings .ds-body>fieldset>label{max-width:560px;margin:16px 0}#desktopSettings .ds-sample{overflow:auto;border:1px solid #dce5ee;border-radius:6px;margin-top:18px}#desktopSettings .ds-sample table{width:100%;border-collapse:collapse;font-size:12px}#desktopSettings .ds-sample td,#desktopSettings .ds-sample th{padding:10px 12px;text-align:left;border-bottom:1px solid #e3ebf2}#desktopSettings .ds-sample th{background:#eef4f8}#desktopSettings footer{padding:12px 20px;background:white}
    [data-desktop-shortcuts=false] .toolbar .qt-key{display:none!important}
    html[data-desktop-table-density=compact] :is(.acui-dock,#productionWorkspace,#automaticReviewModal,.ds-sample) td{padding-top:4px!important;padding-bottom:4px!important}
    html[data-desktop-table-density=comfortable] :is(.acui-dock,#productionWorkspace,#automaticReviewModal,.ds-sample) td{padding-top:14px!important;padding-bottom:14px!important}
    html[data-desktop-table-text=large] :is(.acui-dock,#productionWorkspace,#automaticReviewModal,.ds-sample) :is(td,th){font-size:14px!important}
    html[data-desktop-row-highlight=true] :is(.acui-dock,#productionWorkspace,#automaticReviewModal,.ds-sample) tbody tr:hover:not(.active):not(.selected) td{box-shadow:inset 0 0 0 999px #008a9d0a}
    html[data-desktop-row-highlight=false] :is(.acui-dock,#productionWorkspace,#automaticReviewModal,.ds-sample) tbody tr:hover:not(.active):not(.selected) td{box-shadow:none!important;background:inherit!important}
    @media(max-width:650px){#desktopSettings .ds-body{padding:12px}#desktopSettings .ds-body>fieldset{padding:14px}#desktopSettings .ds-grid{grid-template-columns:1fr}#desktopSettings .ds-tabs button{font-size:11px;padding:8px}}
    `;
    style.textContent+=`
    html body #desktopSettings .ds-tabs,html body #balloonSettingsModal .ds-tabs{display:flex;flex:none;align-items:center;gap:4px;padding:7px 14px;background:white;border-bottom:1px solid #cfdee8;flex-wrap:wrap}
    html body #desktopSettings .ds-tabs button,html body #balloonSettingsModal .ds-tabs button{padding:8px 12px;border:1px solid transparent;border-radius:4px;background:transparent;color:#516c80;font:12px 'Segoe UI',sans-serif;cursor:pointer}
    html body #desktopSettings .ds-tabs [aria-selected=true],html body #balloonSettingsModal .ds-tabs [aria-selected=true]{background:#e5f4f6;border-color:#a3d2dc;color:#007b8d;font-weight:600}
    #desktopSettings .ds-body{padding:22px 26px;background:#f3f6fa}
    #desktopSettings .ds-intro{max-width:1100px;margin:0 0 20px}
    #desktopSettings .ds-intro h2{font-size:21px;color:#24465d}
    #desktopSettings .ds-body>fieldset{max-width:1100px;margin:0;padding:22px 24px;box-sizing:border-box}
    #desktopSettings .ds-grid{gap:18px 24px;margin-bottom:14px}
    #desktopSettings .ds-grid>label{background:#f8fafc;border:1px solid #e1e9f0;padding:13px;border-radius:6px;font-size:11px}
    #desktopSettings select{min-height:32px;padding:6px 8px;font-size:12px}
    #desktopSettings [data-error]:empty{display:none}
    #desktopSettings .ds-check{align-self:stretch;min-height:46px;box-sizing:border-box}
    #desktopSettings #ds-panel-drawing{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px}
    #desktopSettings #ds-panel-drawing>p{grid-column:1/-1;margin:0}
    #desktopSettings #ds-panel-drawing>label{max-width:none;margin:0}
    #desktopSettings #ds-panel-drawing>.ds-grid{display:block;margin:0}
    #desktopSettings #ds-panel-drawing>.ds-grid>label{background:none;border:0;padding:0}
    html body #balloonSettingsModal .settings-card{font-family:'Segoe UI',Arial,sans-serif}
    html body #balloonSettingsModal .settings-card>.modal-body{padding:16px 20px!important;gap:14px;background:#f3f6fa}
    html body #balloonSettingsModal .appearance-manager{grid-template-columns:220px minmax(0,1fr);gap:16px}
    html body #balloonSettingsModal .appearance-nav{background:white;border:1px solid #d5e2eb;border-radius:7px;padding:8px;gap:4px}
    html body #balloonSettingsModal .appearance-nav button{border:1px solid transparent;background:transparent;min-height:42px;padding:6px 8px;font-family:inherit;font-weight:500}
    html body #balloonSettingsModal .appearance-nav button[aria-pressed=true]{background:#e6f5f7;border-color:#b3d8df;box-shadow:inset 3px 0 #0090a1}
    html body #balloonSettingsModal .appearance-detail{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:16px;align-content:start;padding:20px;background:white;border:1px solid #d5e1e9}
    html body #balloonSettingsModal .appearance-fields{grid-column:1;grid-row:1;grid-template-columns:repeat(2,minmax(0,1fr));background:#f8fafc;padding:16px;gap:16px;border:1px solid #e1e9ef}
    html body #balloonSettingsModal .appearance-lines{grid-column:1;grid-row:2;grid-template-columns:85px minmax(0,1fr) minmax(0,1fr);background:#f8fafc;padding:16px;gap:13px;border:1px solid #e1e9ef}
    html body #balloonSettingsModal .ra-previews{grid-column:2;grid-row:1 / span 2;display:block;align-self:start}
    html body #balloonSettingsModal .ra-previews section{padding:18px;background:#f1f7fa;border:1px solid #cddfe9;border-radius:7px}
    html body #balloonSettingsModal .ra-previews svg{height:190px;width:100%}
    html body #balloonSettingsModal .appearance-manager label{font:11px 'Segoe UI',sans-serif;gap:7px;color:#526c80}
    html body #balloonSettingsModal .appearance-actions{grid-column:1/-1;grid-row:3;padding-top:16px}
    html body #balloonSettingsModal .appearance-status{grid-column:1/-1}
    html body #balloonSettingsModal .settings-section-head{align-items:center}
    html body #balloonSettingsModal .appearance-legend summary{font:11px 'Segoe UI',sans-serif}
    @media(max-width:1100px){html body #balloonSettingsModal .appearance-manager{grid-template-columns:180px minmax(0,1fr)}html body #balloonSettingsModal .appearance-detail{grid-template-columns:1fr}html body #balloonSettingsModal .ra-previews{grid-column:1;grid-row:1}html body #balloonSettingsModal .ra-previews svg{height:100px}html body #balloonSettingsModal .appearance-fields{grid-row:2}html body #balloonSettingsModal .appearance-lines{grid-row:3}html body #balloonSettingsModal .appearance-actions{grid-row:4}}
    @media(max-width:650px){#desktopSettings .ds-body{padding:12px}#desktopSettings .ds-body>fieldset{padding:16px}#desktopSettings #ds-panel-drawing{grid-template-columns:1fr}html body #balloonSettingsModal .appearance-manager{grid-template-columns:1fr}html body #balloonSettingsModal .appearance-detail{padding:12px}html body #balloonSettingsModal .appearance-nav{max-height:130px;display:flex;overflow:auto}html body #balloonSettingsModal .appearance-fields{gap:10px;padding:10px}html body #balloonSettingsModal .appearance-lines{padding:10px;grid-template-columns:60px minmax(0,1fr) minmax(0,1fr)}}
    `;
    doc.body.append(dialog);root.ASMachSettingsCompact?.install();
    const fields=[...dialog.querySelectorAll('[data-pref]')];
    function fill(p){for(const f of fields){if(f.type==='checkbox')f.checked=p[f.dataset.pref];else f.value=p[f.dataset.pref];}}
    function read(){return normalize(Object.fromEntries(fields.map(f=>[f.dataset.pref,f.type==='checkbox'?f.checked:f.value])));}
    function cancel(){fill(saved);apply(saved);if(root.ASMachWorkspaceTabs){dialog.querySelector('[data-error]').textContent='';app.toast?.('Kaydedilmiş tercihlere dönüldü.');}else{dialog.close();button.focus();}}
    button.addEventListener('click',()=>{fill(saved);dialog.querySelector('[data-error]').textContent='';for(const b of dialog.querySelectorAll('[data-link]'))b.disabled=!doc.getElementById(b.dataset.link)||doc.getElementById(b.dataset.link).disabled;(root.ASMachWorkspaceTabs?dialog.show():dialog.showModal());});
    dialog.addEventListener('change',()=>apply(read()));
    dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
    // Do not let drawing keyboard shortcuts fire while editing preferences.
    dialog.addEventListener('keydown',e=>e.stopPropagation());
    dialog.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',cancel));
    dialog.querySelector('[data-reset]').addEventListener('click',()=>{fill(defaults);apply(defaults);});
dialog.querySelector('[data-save]').addEventListener('click',async()=>{const next=read();try{root.ASMachPreferences.setItem(KEY,JSON.stringify(next));await root.ASMachPreferences.flush?.();saved=next;apply(saved);if(!root.ASMachWorkspaceTabs){dialog.close();button.focus();}dialog.querySelector('[data-error]').textContent='';app.toast?.('Program ayarları kaydedildi.');}catch{dialog.querySelector('[data-error]').textContent='Ayarlar kalıcı olarak kaydedilemedi. Disk erişimini kontrol edip tekrar deneyin.';}});
    dialog.querySelectorAll('[data-link]').forEach(b=>b.addEventListener('click',()=>{cancel();doc.getElementById(b.dataset.link)?.click();}));
  }
  root.ASMachDesktopUI={init,normalize,defaults};
})(window);
