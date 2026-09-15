/* Relocate the live controls, preserving their listeners and disabled state. */
(function(root){
  'use strict';
  function mount(doc=document){
    const toolbar=doc.querySelector('.toolbar');if(!toolbar||toolbar.dataset.organized)return;
    toolbar.dataset.organized='true';
    const node=(tag,cls)=>{const n=doc.createElement(tag);n.className=cls;return n;};
    const controls=[...toolbar.querySelectorAll('button,input,#zoomLabel')];
    const find=id=>controls.find(n=>n.id===id),menus=[];
    function group(ids){const g=node('div','wl-group');for(const id of ids){const n=find(id);if(n)g.append(n);}return g;}
    function menu(title,ids,icon){
      const d=node('details','wl-menu'),s=node('summary','btn'),body=group(ids);body.className='wl-menu-body';s.textContent=title+' ▾';d.append(s,body);menus.push(d);
      s.dataset.menuIcon=icon||'tools';
      d.addEventListener('toggle',()=>{if(d.open)for(const other of menus)if(other!==d)other.open=false;});
      body.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('button').disabled)d.open=false;});return d;
    }
    const main=node('div','wl-main'),secondary=node('div','wl-secondary'),appbar=node('div','wl-appbar');
    appbar.setAttribute('role','navigation');appbar.setAttribute('aria-label','Uygulama yönetimi');
    const caption=node('span','wl-caption');caption.textContent='PROGRAM';
    secondary.append(menu('Dosya',['openFileButton','loadProjectButton','saveProjectButton'],'folder'),menu('Çıktılar',['pdfButton','inspectionReportsButton','excelExportButton','csvButton'],'report'));
    appbar.append(caption,secondary);
    main.setAttribute('role','group');main.setAttribute('aria-label','PDF ve balonlama araçları');
    function section(title,ids){const box=node('div','wl-section'),label=node('span','wl-section-label');label.textContent=title;box.append(label,group(ids));return box;}
    main.append(section('SEÇİM / BALON',['selectModeButton','addModeButton']),section('ÖLÇÜ ALGILAMA',['boxOcrModeButton','autoDetectButton']),section('DÜZENLE',['undoButton','redoButton']),section('GÖRÜNÜM',['zoomOutButton','fitButton','zoomInButton','zoomLabel']));
    const more=node('div','wl-section'),moreLabel=node('span','wl-section-label');moreLabel.textContent='ÇİZİM YÖNETİMİ';more.append(moreLabel,menu('Çizim işlemleri',['viewNumberingButton','balloonSettingsButton','acuiMetadataOpen','acuiCreateManual','acuiCreateNote'],'tools'));main.append(more);
    // Keep drawing operations next to creation tools; viewing controls finish the row.
    const sections=[...main.children];main.replaceChildren(sections[0],sections[1],more,sections[2],sections[3]);
    toolbar.replaceChildren(appbar,main);
    const boxButton=find('boxOcrModeButton');
    if(boxButton){
      const mode=node('select','wl-scan-mode');mode.id='boxScanMode';
      mode.setAttribute('aria-label','Kutu tarama yöntemi');
      mode.title='Akıllı: doğrudan kaydet. Kontrollü: düzenleyip ekle.';
      for(const [value,text] of [['controlled','Kontrollü tarama'],['smart','Akıllı tarama']]){const option=node('option','');option.value=value;option.textContent=text;mode.append(option);}
      mode.addEventListener('change',()=>boxButton.click());
      boxButton.parentElement.append(mode);
      const content=node('select','wl-scan-mode');content.id='boxContentMode';content.setAttribute('aria-label','OCR içerik türü');content.title='Kutu OCR neyi ayıklasın? Not modunda sayılar ölçüye dönüştürülmez.';
      for(const [value,text] of [['auto','Otomatik içerik'],['dimension','Ölçü'],['gdt','GD&T'],['note','Not / Metin']]){const option=node('option','');option.value=value;option.textContent=text;content.append(option);}content.addEventListener('change',()=>boxButton.click());boxButton.parentElement.append(content);
    }
    // Keep file pickers and any future controls which were not assigned a group.
    for(const control of controls)if(!toolbar.contains(control)){
      if(control.tagName.toLowerCase()==='input')toolbar.append(control);
      else main.append(control);
    }
    doc.addEventListener('pointerdown',e=>{for(const d of menus)if(!d.contains(e.target))d.open=false;});
    toolbar.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=menus.find(m=>m.open);if(d){d.open=false;d.querySelector('summary').focus();e.stopPropagation();}}});
    const style=node('style','');style.textContent=`
      .wl-scan-mode{width:145px;min-height:33px;padding:5px 7px;font-size:11px;border:1px solid #b9d5df;border-radius:6px;background:#fff;color:#083344}
      .toolbar[data-organized]{position:relative;z-index:100;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;overflow:visible;min-height:50px;padding:7px 12px}
      .wl-main,.wl-secondary,.wl-group{display:flex;align-items:center;gap:5px;min-width:0}.wl-main,.wl-secondary{flex-wrap:wrap}.wl-secondary{margin-left:auto}
      .toolbar[data-organized] .btn{min-height:33px;padding:5px 9px;font-size:11px}.toolbar[data-organized] .icon-btn{width:32px;min-height:33px}
      .wl-group+.wl-group{padding-left:7px;border-left:1px solid #d8e2ec}.wl-menu{position:relative}.wl-menu summary{list-style:none;cursor:pointer}.wl-menu summary::-webkit-details-marker{display:none}
      .wl-menu[open]>summary{border-color:#07899a;background:#e6f9fb}.wl-menu-body{position:absolute;top:calc(100% + 7px);left:0;z-index:101;display:flex;flex-direction:column;align-items:stretch;gap:5px;min-width:200px;max-width:calc(100vw - 24px);max-height:60vh;overflow:auto;padding:9px;border:1px solid #cbdce5;border-radius:10px;background:white;box-shadow:0 12px 30px #092a4030}
      .wl-secondary .wl-menu-body{left:auto;right:0}.wl-menu-body .btn{justify-content:flex-start}.wl-menu-body .button-text.optional{display:inline!important}.toolbar summary:focus-visible{outline:2px solid #07899a;outline-offset:2px}
      @media(max-width:1000px){.toolbar[data-organized] .shortcut{display:none}.toolbar[data-organized]{gap:5px}.toolbar[data-organized] .tool-icon{width:14px;height:14px;flex-basis:14px}}
      @media(max-width:700px){.wl-main,.wl-secondary{width:100%;justify-content:space-between}.toolbar[data-organized]{padding:5px 8px}.wl-group{gap:3px}.wl-main .wl-menu:last-child .wl-menu-body{left:auto;right:0}}
      /* Two independent command levels, sharing one grid row in the application shell. */
      .toolbar[data-organized]{display:flex;flex-direction:column;align-items:stretch;gap:0!important;padding:0!important;background:#f7fafc}
      .wl-appbar{display:flex;align-items:center;gap:18px;padding:6px 14px;border-bottom:1px solid #d8e2ec;background:white}
      .wl-caption{font-size:9px;font-weight:800;letter-spacing:.13em;color:#64748b}
      .wl-appbar .wl-secondary{margin:0;flex:1;justify-content:flex-start;width:auto}
      .wl-appbar summary.btn,.wl-appbar #appSettingsButton{border-color:transparent;background:transparent}
      .wl-appbar #appSettingsButton{margin-left:auto}
      .wl-main{padding:9px 14px;gap:16px;align-items:stretch;justify-content:flex-start;width:auto}
      .wl-section{display:flex;flex-direction:column;gap:5px;min-width:0;padding-right:16px;border-right:1px solid #d8e2ec}
      .wl-section:last-child{border-right:0;padding-right:0;margin-left:auto}
      .wl-section-label{font-size:9px;letter-spacing:.07em;font-weight:750;color:#64748b}
      .wl-section .wl-group{flex-wrap:wrap}.wl-section .wl-menu-body{left:auto;right:0}
      .wl-appbar .wl-menu-body{left:0;right:auto}.wl-main .button-text.optional{display:inline!important}
      @media(max-width:700px){.wl-appbar{gap:8px;padding:4px 8px}.wl-caption{display:none}.wl-main{padding:8px;gap:10px;justify-content:flex-start}.wl-section{padding-right:10px}.wl-section:last-child{margin-left:0}.wl-section-label{font-size:8px}.wl-appbar .wl-secondary{flex-wrap:wrap}.wl-section .wl-menu-body{position:fixed;left:12px;right:12px;top:auto;max-width:calc(100vw - 24px)}}
      /* Calm command surface: menu row, one compact tool row, then the document. */
      .wl-caption{display:none}.wl-appbar{padding:3px 12px;background:#f0f4f8;border-bottom-color:#e0e7ef;gap:8px}
      .wl-appbar .wl-secondary{gap:2px}.wl-appbar #appSettingsButton{margin-left:10px;border-left:1px solid #d4dde8;border-radius:0;padding-left:14px}
      .wl-main{padding:8px 12px;gap:10px;align-items:center;background:white}
      .wl-section{padding-right:10px;gap:0;flex-direction:row;align-items:center}.wl-section-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
      .wl-section:last-child{margin-left:auto}.wl-section:nth-last-child(2){border:0;padding:0}
      .wl-main .wl-group{gap:5px}.wl-main .wl-menu-body{left:0;right:auto}
      .toolbar[data-organized] .btn{font-weight:600;box-shadow:none}.wl-main .btn:not(.mode-active):not(.primary){border-color:transparent;background:transparent}.wl-main .icon-btn{border-color:transparent;background:#f4f7fa}.wl-main .btn:hover{background:#eef4f8!important}
      .wl-main .btn.mode-active{background:var(--teal-soft);border-color:var(--teal);box-shadow:none;border-radius:7px}.wl-main #autoDetectButton{background:var(--teal-soft);color:var(--teal-strong);border-color:transparent}
      .viewer-column.has-recovery-status{grid-template-rows:auto auto minmax(0,1fr)}
      #projectRecovery{min-height:30px;max-height:90px;overflow:auto;padding:4px 12px!important;align-self:end;background:#f5f8fb!important;border-top:1px solid #dce5ee;color:#5a6d82!important;font-size:10px!important}
      #projectRecovery .btn{min-height:25px;padding:3px 9px;font-size:10px}#projectRecovery [hidden]{display:none!important}
      .document-strip{min-height:38px;padding:5px 14px;background:#f9fbfd}.file-badge{padding:3px 6px;font-size:9px}
      .viewer:has(.empty-state:not([hidden])):not(:has(.stage-wrap.is-visible)){background:#f1f5f9!important}
      .empty-state{min-height:0;padding:24px}.upload-card{max-width:500px;padding:30px;border:1px solid #dbe4ed;border-radius:16px;box-shadow:0 8px 30px #18324b08;background:white}.upload-card h2{font-size:21px}.upload-card p{font-size:12px}.privacy-line{font-size:10px;flex-wrap:wrap}
      /* Readable inspection grid, independent of compact toolbar preferences. */
      .acui-readable .acui-table{border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
      .acui-readable.acui-essential-columns .acui-table{min-width:1120px}
      .acui-readable.acui-essential-columns .acui-table :is(th,td):nth-child(4),.acui-readable.acui-essential-columns .acui-table :is(th,td):nth-child(7),.acui-readable.acui-essential-columns .acui-table :is(th,td):nth-child(12){display:none}
      .acui-readable .acui-table th{font-size:11px!important;letter-spacing:0!important;color:#33465d;background:#e9eff5;padding:11px 9px!important;border-right:1px solid #d5dee8;border-bottom:2px solid #c4d3e0;white-space:normal}
      .acui-readable .acui-table td{font-size:13px!important;line-height:1.5;padding:9px!important;color:#243950;border-right:1px solid #e5ebf1;white-space:normal!important;overflow-wrap:anywhere;height:auto!important;max-height:none!important}
      .acui-readable .acui-table tbody tr{height:auto!important;--row-bg:white}.acui-readable .acui-table tbody tr:nth-child(even){--row-bg:#f5f8fb}
      .acui-readable .acui-table tbody tr td{background:var(--row-bg)}.acui-readable .acui-table tbody tr:hover{--row-bg:#eaf3fb}.acui-readable .acui-table tbody tr.is-selected,.acui-readable .acui-table tbody tr:has(input[data-bulk-id]:checked){--row-bg:#def0fa}
      .acui-readable .acui-table tbody tr.is-selected td:nth-child(2){box-shadow:inset 3px 0 #07899a}
      .acui-readable .acui-table :is(th,td):first-child{position:sticky;left:0;z-index:2;width:34px;min-width:34px;text-align:center}
      .acui-readable .acui-table :is(th,td):nth-child(2){position:sticky;left:var(--acui-select-width,34px);z-index:2;width:48px;min-width:48px;text-align:center;box-shadow:2px 0 3px #152b4210}
      .acui-readable .acui-table th:first-child,.acui-readable .acui-table th:nth-child(2){z-index:4}
      .acui-readable .acui-table .acui-measurement{font-weight:750;color:#123c55;font-size:14px!important;overflow-wrap:normal}
      .acui-readable .acui-table td:nth-child(9),.acui-readable .acui-table td:nth-child(10){line-height:1.55}
      .acui-readable .acui-table .acui-issue-button{white-space:normal;text-align:left;line-height:1.4;font-size:11px;padding:5px 7px}
      .acui-readable .acui-table .acui-subtle{color:#546c80}.acui-readable .acui-table input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#07899a}
      .acui-readable .acui-mini-btn{font-size:12px;min-height:30px;padding:4px 8px}.acui-readable .acui-dock-handle{background:#e9eff5;border-bottom:1px solid #cbd8e4}.acui-readable .acui-dock-handle small{font-size:11px}
      .acui-readable .table-wrap{scrollbar-width:auto}.acui-readable #acuiColumnsToggle[aria-pressed=true]{background:#e5f4f8;border-color:#07899a}
      .acui-column-menu{position:relative}.acui-column-menu>summary{cursor:pointer;list-style:none}.acui-column-menu>div{position:fixed;z-index:2000;right:20px;background:white;border:1px solid #cbd8e5;border-radius:8px;padding:10px;box-shadow:0 8px 20px #1234;display:grid;gap:7px;font-size:12px}.acui-table [hidden]{display:none!important}.acui-column-menu label{display:flex;gap:8px;align-items:center}
      /* Pinned table participates in the workspace grid, never overlays the inspector. */
      .workspace.acui-dashboard{grid-template-columns:minmax(0,1fr) 320px;grid-template-rows:minmax(0,1fr) clamp(320px,42%,380px);overflow:hidden}
      .workspace.acui-dashboard>.viewer-column{grid-column:1;grid-row:1;min-height:0}
      .workspace.acui-dashboard>.inspector{grid-column:2;grid-row:1/3;min-height:0;overflow:hidden;border-left:1px solid #cbd8e4}
      .workspace.acui-dashboard>.acui-dock.acui-pinned{position:relative!important;inset:auto!important;grid-column:1;grid-row:2;width:100%;height:100%;min-height:0;max-height:none!important;transform:none!important;border-radius:0;box-shadow:none;z-index:2;overflow:hidden}
      .workspace.acui-dashboard>.acui-dock .table-wrap{min-height:0!important;max-height:none!important;flex:1 1 0;overflow:auto}
      .workspace.acui-dashboard-expanded{grid-template-rows:minmax(0,1fr) minmax(150px,55%)}
      .acui-dock.acui-readable .acui-dock-handle{min-height:27px;padding:2px 7px;gap:5px}
      .acui-dock.acui-readable .acui-dock-handle button{font-size:11px;padding:3px 5px;min-height:22px}
      .acui-dock.acui-readable .acui-dock-handle small{display:none}
      .acui-dock.acui-readable .list-toolbar{min-height:29px;padding:3px 6px;gap:4px}
      .acui-dock.acui-readable .list-toolbar input{height:24px;min-height:24px;font-size:10px;padding:3px 6px}
      .acui-dock.acui-readable .list-toolbar .btn,.acui-dock.acui-readable .acui-mini-btn{min-height:22px;font-size:10px;padding:3px 5px}
      .acui-dock.acui-readable .acui-list-summary{font-size:10px;padding:2px 7px;min-height:18px}
      .acui-dock.acui-readable .acui-bulk-tools{gap:3px 6px;padding:3px 6px;max-height:53px;font-size:10px}
      .acui-dock.acui-readable .acui-bulk-tools .btn,.acui-dock.acui-readable .acui-bulk-tools input,.acui-dock.acui-readable .acui-bulk-tools select{min-height:23px;height:23px;padding:2px 5px;font-size:10px}
      .acui-dock.acui-readable .acui-table{min-width:1000px}
      .acui-dock.acui-readable.acui-essential-columns .acui-table{min-width:850px}
      .acui-dock.acui-readable .acui-table th{height:24px!important;font-size:9px!important;padding:3px 5px!important;line-height:14px}
      .acui-dock.acui-readable .acui-table td{height:27px!important;max-height:32px!important;font-size:10px!important;padding:3px 5px!important;line-height:1.2!important;white-space:nowrap!important}
      .acui-dock.acui-readable .acui-table .acui-measurement{font-size:11px!important;line-height:1.2}
      .acui-dock.acui-readable .acui-table .acui-issue-button{font-size:9px;padding:2px 4px;line-height:1.2;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis}
      .acui-dock.acui-readable .acui-table .balloon-dot{width:20px;height:20px;min-width:20px;font-size:10px}
      .acui-dock.acui-readable .acui-table input[type=checkbox]{width:12px;height:12px}
      .acui-dock.acui-readable .acui-table .acui-snapshot-thumb{width:50px;height:24px}
      .acui-dock.acui-readable .acui-table :is(th,td):first-child{width:24px;min-width:24px}
      .acui-dock.acui-readable .acui-table :is(th,td):nth-child(2){width:34px;min-width:34px}
      @media(max-width:900px){.workspace.acui-dashboard{grid-template-columns:minmax(0,1fr) 260px}}
      @media(max-width:600px){.workspace.acui-dashboard{grid-template-columns:minmax(0,1fr) 180px}.workspace.acui-dashboard>.inspector{display:grid!important}.acui-dashboard .inspector-head{padding:6px}.acui-dashboard .inspector-head h2{font-size:11px}.acui-dock.acui-readable .acui-dock-handle button{font-size:9px}}
      @media(max-width:1100px){.wl-main{gap:6px}.wl-section{padding-right:6px}.wl-section:last-child{margin-left:0}.wl-main .btn{padding-left:7px;padding-right:7px}}
      @media(max-width:700px){.wl-main{gap:7px;padding:7px 8px}.wl-section{border:0;padding:0}.wl-section:last-child{width:100%;border-top:1px solid #e4eaf0;padding-top:6px}.wl-main .wl-menu-body{position:fixed;left:12px;right:12px;max-height:50vh}.upload-card{padding:20px}.document-stats{white-space:normal;flex-wrap:wrap}.document-strip{gap:8px}.wl-appbar{padding:3px 8px}}
      .acui-dock.acui-readable .acui-dock-handle{display:flex;flex-wrap:nowrap;min-height:34px;gap:5px}
      .acui-dock.acui-readable .acui-dock-handle>.list-toolbar{display:flex;flex:1;min-width:0;flex-wrap:nowrap;border:0;padding:0;gap:3px}
      .acui-dock.acui-readable .acui-dock-handle>.list-toolbar input{width:100%;min-width:60px;flex:1}
      .acui-dock.acui-readable .acui-dock-handle>div:last-child{display:flex;flex-shrink:0;gap:2px}
      .acui-dock.acui-readable .acui-dock-handle .btn{white-space:nowrap;flex-shrink:0}
      #acuiDockToggle{white-space:nowrap;flex-shrink:0}
      .acui-dock.acui-readable .acui-table tbody tr{height:28px!important}
      .acui-dock.acui-readable .acui-table td{max-width:260px;overflow:hidden;text-overflow:ellipsis}
      #acuiFilterPanel[popover],.acui-column-menu>div[popover]{position:fixed!important;inset:auto;margin:0!important;box-sizing:border-box;border:1px solid #bfd0dd;border-radius:7px;background:#fff;box-shadow:0 8px 28px #18344c33;padding:10px!important;max-height:min(340px,65vh)!important;overflow:auto;z-index:2100;font-size:11px}
      #acuiFilterPanel[popover]{width:min(570px,calc(100vw - 20px))}
      #acuiFilterPanel[popover] .acui-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #acuiFilterPanel[popover] select{height:28px;min-height:28px;font-size:11px;padding:4px}
      .acui-column-menu>div[popover]{width:min(280px,calc(100vw - 20px));grid-template-columns:1fr 1fr;gap:6px}
      .acui-column-menu>div[popover] label{padding:5px;background:#f5f8fb;border-radius:3px;gap:6px;font-size:11px}
      .acui-column-menu>div[popover] input{width:13px;height:13px;margin:0}
      #acuiFilterPanel[popover]:not(:popover-open),.acui-column-menu>div[popover]:not(:popover-open){display:none!important}
      @media(max-width:1000px){.acui-dock.acui-readable .acui-dock-handle button,.acui-dock.acui-readable .acui-dock-handle summary{font-size:9px!important;padding:3px!important}#acuiColumnsToggle{display:none}}
      body>.acui-dock.acui-readable:not(.acui-expanded){left:var(--list-left,0px)!important;right:auto!important;width:var(--list-width,calc(100vw - 366px))!important;border-radius:5px 5px 0 0}
      body>.acui-dock.acui-readable.acui-expanded{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;transform:none!important;border-radius:0;z-index:1050;box-shadow:none}
      .acui-dock.acui-readable .acui-dock-handle{background:#f7f9fc;border-top:2px solid #07899a;border-bottom:1px solid #cfdae5;padding:5px 7px;min-height:38px}
      .acui-dock.acui-readable .acui-dock-handle :is(button,summary){display:inline-flex;align-items:center;justify-content:center;gap:4px;color:#31485b;border:1px solid transparent;border-radius:4px;background:transparent;min-height:25px;cursor:pointer;line-height:16px;font-weight:600}
      .acui-dock.acui-readable .acui-dock-handle :is(button,summary):hover{background:#e7eef5;border-color:#c6d5e2}
      .acui-dock.acui-readable .acui-dock-handle :is(button,summary):focus-visible{outline:2px solid #07899a;outline-offset:1px}
      .acui-dock.acui-readable #acuiDockPin[aria-pressed=true],.acui-dock.acui-readable #acuiFilterToggle[aria-expanded=true],.acui-dock.acui-readable .acui-column-menu[open]>summary{background:#e3f4f6;border-color:#a7d8df;color:#087687}
      .acui-dock.acui-readable #acuiDockClose:hover{background:#fff0f1;color:#c12d43;border-color:#efc5cd}
      .acui-dock.acui-readable .acui-dock-handle>div:last-child{border-left:1px solid #d1dce5;padding-left:5px;margin-left:3px}
      .acui-dock.acui-readable .acui-table .acui-mini-btn{border-color:#d3dfe8;background:#fff;border-radius:4px;color:#285269}
      .acui-column-menu>div[popover] label{display:flex!important;justify-content:flex-start;text-align:left;min-height:28px}
      .acui-column-menu>div[popover] input[type=checkbox]{appearance:auto!important;flex:0 0 13px!important;width:13px!important;height:13px!important;min-height:13px!important;padding:0!important;margin:0!important}
      .toolbar[data-organized]{flex-direction:row;align-items:center;flex-wrap:wrap;gap:0!important;background:#f6f8fb}
      .toolbar[data-organized] .wl-appbar{flex:0 0 auto;padding:4px 8px;border-bottom:0;border-right:1px solid #d7e1e9;background:transparent}
      .toolbar[data-organized] .wl-main{flex:1 1 auto;width:auto;padding:4px 8px;gap:7px;background:transparent;justify-content:flex-start}
      .toolbar[data-organized] .wl-section:last-child{margin-left:0}
      .toolbar[data-organized] .btn{min-height:28px;padding:4px 6px;font-size:10px}.toolbar[data-organized] .icon-btn{width:28px;min-height:28px}
      .toolbar[data-organized] .wl-scan-mode{width:130px;min-height:28px;font-size:10px;padding:4px 6px}
      .document-strip.wl-document-tools{display:flex;align-items:center;flex-wrap:wrap;gap:5px 10px;padding:4px 9px;min-height:36px;background:#fff;border-bottom:1px solid #d9e3eb}
      .wl-document-tools .document-name{flex:1;min-width:90px;font-size:11px;overflow:hidden}.wl-document-tools #fileNameLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wl-document-tools .document-stats{font-size:10px;gap:0}.wl-document-tools .document-stats>span:not(#balloonStat){display:none}
      .wl-pdf-tools{display:flex;align-items:center;gap:5px;flex:0 0 auto}
      .wl-document-tools #pageNav{position:static;inset:auto;margin:0;padding:0 6px 0 0;box-shadow:none;border:0;border-right:1px solid #d6e0e8;border-radius:0;backdrop-filter:none;background:none;gap:2px}
      .wl-document-tools .page-number{min-width:45px;font-size:11px;text-align:center}
      .wl-pdf-tools .btn,.wl-pdf-tools .icon-btn{min-height:26px;height:26px;padding:3px 6px;font-size:10px;border-color:transparent;border-radius:4px;background:#f5f8fb}
      .wl-pdf-tools .icon-btn{width:27px}.wl-pdf-tools .tool-icon{width:14px;height:14px}.wl-pdf-tools #zoomLabel{font-size:10px;min-width:30px;text-align:center}
      @media(max-width:1000px){.toolbar[data-organized] .wl-main{flex-basis:100%;border-top:1px solid #dce5ed}.toolbar[data-organized] .wl-appbar{border-right:0}.wl-document-tools .document-stats{display:none}}
      @media(max-width:600px){.wl-document-tools .wl-pdf-tools{margin-left:auto}.wl-document-tools .document-name{flex-basis:100%}.wl-document-tools .shortcut{display:none}}
    `;doc.head.append(style);
    const documentStrip=doc.querySelector('.document-strip');
    if(documentStrip){
      documentStrip.classList.add('wl-document-tools');
      const pdfTools=node('div','wl-pdf-tools');pdfTools.setAttribute('role','group');pdfTools.setAttribute('aria-label','PDF sayfa ve yakınlaştırma kontrolleri');
      const pageNav=doc.querySelector('#pageNav');if(pageNav)pdfTools.append(pageNav);
      const zoomSection=find('zoomInButton')?.closest('.wl-section');
      for(const id of ['zoomOutButton','fitButton','zoomInButton','zoomLabel']){const control=find(id);if(control)pdfTools.append(control);}
      zoomSection?.remove();documentStrip.append(pdfTools);
      const project=menus[0];project.querySelector('summary').textContent='Proje ▾';project.querySelector('.wl-menu-body').append(find('acuiMetadataOpen'));
      const creation=main.querySelector('.wl-section'),creationBody=creation.querySelector('.wl-group');creationBody.append(find('acuiCreateManual'),find('acuiCreateNote'));
      const globalTools=node('div','wl-secondary');globalTools.id='wlGlobal';globalTools.append(menus[1]);toolbar.append(globalTools);
      globalTools.style.cssText='margin-left:auto;padding:4px 8px;flex-shrink:0';
      const oldMore=find('viewNumberingButton').closest('.wl-section');
      const editing=section('DÜZENLE',['undoButton','redoButton']);editing.querySelector('.wl-group').append(find('viewNumberingButton'),find('balloonSettingsButton'));main.append(editing);oldMore.remove();
      for(const s of [...main.querySelectorAll('.wl-section')])if(!s.querySelector('button,select,details'))s.remove();
      const labels=main.querySelectorAll('.wl-section-label');if(labels[0])labels[0].textContent='BALONLAMA';if(labels[1])labels[1].textContent='OCR / AYIKLAMA';
      const labelStyle=node('style','');labelStyle.textContent='.toolbar[data-organized] .wl-section{display:flex;flex-direction:column;align-items:flex-start;gap:2px}.toolbar[data-organized] .wl-section-label{position:static;width:auto;height:auto;clip-path:none;overflow:visible;font-size:8px;letter-spacing:.06em;color:#657b8b}.toolbar[data-organized] .wl-main{flex:1;flex-wrap:wrap}.toolbar[data-organized] #boxContentMode{width:112px}';doc.head.append(labelStyle);
    }
    const dock=doc.querySelector('.acui-dock'),handle=dock?.querySelector('.acui-dock-handle'),listTools=dock?.querySelector('.list-toolbar');
    if(handle&&listTools){
      const viewer=doc.querySelector('.viewer-column');
      const fitList=()=>{if(!viewer)return;const r=viewer.getBoundingClientRect();dock.style.setProperty('--list-left',r.left+'px');dock.style.setProperty('--list-width',r.width+'px');};
      if(window.ResizeObserver&&viewer)new ResizeObserver(fitList).observe(viewer);window.addEventListener('resize',fitList);fitList();
      const icons={acuiDockPin:'M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6M12 14v7',acuiDockExpand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',acuiDockClose:'m6 6 12 12M18 6 6 18',acuiColumnsToggle:'M3 4h18v16H3zM3 9h18M9 4v16',acuiFilterToggle:'M3 5h18l-7 8v6l-4 2v-8z'};
      const iconStyle=doc.createElement('style');iconStyle.textContent=Object.entries(icons).map(([id,d])=>{const svg=encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`);return `#${id}::before{content:'';display:inline-block;width:13px;height:13px;flex:0 0 13px;background:currentColor;mask:url("data:image/svg+xml,${svg}") center/contain no-repeat}`;}).join('');doc.head.append(iconStyle);
      handle.insertBefore(listTools,handle.lastElementChild);
      const toggle=doc.querySelector('#acuiDockToggle');toggle.textContent='▴ Karakteristikler';
      const filters=doc.querySelector('#acuiFilterPanel'),filterButton=doc.querySelector('#acuiFilterToggle'),menu=dock.querySelector('.acui-column-menu'),columns=menu?.querySelector('div');
      const popups=[];
      function popup(el,anchor,close){
        if(!el?.showPopover)return null;el.setAttribute('popover','manual');
        const hide=()=>{if(el.matches(':popover-open'))el.hidePopover();close();};
        const position=()=>{if(!el.matches(':popover-open'))return;const a=anchor.getBoundingClientRect(),b=el.getBoundingClientRect();el.style.left=Math.max(10,Math.min(a.right-b.width,window.innerWidth-b.width-10))+'px';el.style.top=Math.max(10,a.top-b.height-6)+'px';};
        const show=()=>{for(const p of popups)if(p.el!==el)p.hide();el.hidden=false;el.showPopover();position();};
        if(window.ResizeObserver)new ResizeObserver(position).observe(el);
        const p={el,anchor,hide,show};popups.push(p);return p;
      }
      const filterPopup=popup(filters,filterButton,()=>{filters.hidden=true;filterButton.setAttribute('aria-expanded','false');});
      if(filterPopup)filterButton.addEventListener('click',()=>{if(filters.hidden)filterPopup.hide();else filterPopup.show();});
      const columnPopup=popup(columns,menu.querySelector('summary'),()=>{menu.open=false;});
      if(columnPopup)menu.addEventListener('toggle',()=>{if(menu.open)columnPopup.show();else columnPopup.hide();});
      doc.addEventListener('pointerdown',e=>{for(const p of popups)if(!p.el.contains(e.target)&&!p.anchor.contains(e.target))p.hide();});
      doc.addEventListener('keydown',e=>{if(e.key==='Escape')for(const p of popups)p.hide();});
      window.addEventListener('resize',()=>popups.forEach(p=>p.hide()));
    }
  }
  root.ASMachWorkspaceLayout={mount};
})(window);
