(function(root){
 function install(){if(document.getElementById('settings-compact-css'))return;const s=document.createElement('style');s.id='settings-compact-css';s.textContent=`
 html body #desktopSettings .ds-intro{display:none}
 html body #desktopSettings .ds-body{padding:10px 12px;background:#f1f4f6}
 html body #desktopSettings .ds-tabs,html body #balloonSettingsModal .ds-tabs{padding:4px 8px;gap:3px}
 html body #desktopSettings .ds-tabs button,html body #balloonSettingsModal .ds-tabs button{padding:5px 10px;font-size:11px;min-height:28px}
 html body #desktopSettings .ds-body>fieldset{max-width:none;width:100%;margin:0;padding:10px 12px;border-radius:4px}
 html body #desktopSettings .ds-body>.ds-appearance-sections{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:10px}
 html body #desktopSettings .ds-appearance-sections>fieldset{padding:9px 11px;border-radius:4px;margin:0}
 html body #desktopSettings .ds-appearance-sections>fieldset:first-child{grid-column:1/-1}
 html body #desktopSettings legend{font-size:12px;font-weight:600}
 html body #desktopSettings .ds-grid{gap:7px 16px;margin-bottom:0;grid-template-columns:repeat(2,minmax(0,1fr))}
 html body #desktopSettings .ds-grid>label{display:grid;grid-template-columns:145px minmax(90px,220px);align-items:center;justify-content:start;gap:7px;padding:3px 0;background:none;border:0;border-radius:0;font-size:11px}
 html body #desktopSettings .ds-grid>label.ds-check{display:flex;min-height:28px;padding:0}
 html body #desktopSettings select,html body #desktopSettings input:not([type=checkbox]){min-height:27px;height:27px;padding:3px 6px;font-size:11px;border-radius:3px}
 html body #desktopSettings input[type=checkbox]{width:14px;height:14px}
 html body #desktopSettings #ds-panel-drawing{display:block}
 html body #desktopSettings #ds-panel-drawing>label,html body #desktopSettings #ds-panel-drawing .ds-grid>label{display:grid;grid-template-columns:145px minmax(90px,220px);align-items:center;gap:7px;margin:0 0 7px;padding:0;font-size:11px}
 html body #desktopSettings .ds-appearance-sections fieldset>p{display:none}
 html body #desktopSettings .ds-sample{margin-top:8px}
 html body #desktopSettings .ds-sample td,html body #desktopSettings .ds-sample th{padding:5px 7px;font-size:11px}
 html body #desktopSettings footer{padding:7px 12px;gap:7px;background:#edf2f5}
 html body #desktopSettings footer .btn{min-height:28px;padding:5px 10px;font-size:11px;border-radius:3px}
 html body #desktopSettings .type-defaults>p{margin:0 0 7px;font-size:10px;line-height:1.35}
 html body #desktopSettings .td-common small{font-size:10px;line-height:1.3}
 html body #desktopSettings .type-defaults .rp-heading{margin-bottom:6px}
 html body #desktopSettings .type-defaults .rp-card{padding:7px!important;border-radius:4px}
 html body #desktopSettings .type-defaults .td-actions{margin-top:8px}
 html body #desktopSettings .type-defaults .btn{font-size:11px;min-height:27px;padding:4px 8px;border-radius:3px}
 html body #desktopSettings #ds-panel-data p{font-size:11px;line-height:1.45;margin:7px 0}
 html body #balloonSettingsModal .sw-header{padding:7px 10px!important;min-height:0!important}
 html body #balloonSettingsModal .sw-header p{display:none!important}
 html body #balloonSettingsModal .sw-header h2{font-size:14px!important;margin:0!important}
 html body #balloonSettingsModal .sw-content{padding:7px!important}
 html body #balloonSettingsModal .studio-dashboard .studio-stage{padding:10px!important}
 html body #balloonSettingsModal .studio-dashboard .studio-stage>p{display:none}
 html body #balloonSettingsModal .studio-dashboard .studio-stage h3{font-size:12px;margin:4px 0 7px}
 html body #balloonSettingsModal .studio-dashboard .studio-library{padding:6px!important}
 html body #balloonSettingsModal .studio-dashboard .studio-list button{min-height:28px!important;padding:4px 6px!important;font-size:11px!important}
 @media(max-width:1100px){html body #desktopSettings .ds-body>.ds-appearance-sections{grid-template-columns:1fr}html body #desktopSettings .ds-grid>label{grid-template-columns:135px minmax(90px,1fr)}}
 @media(max-width:650px){html body #desktopSettings .ds-grid{grid-template-columns:1fr}html body #desktopSettings .ds-body{padding:7px}}
 `;document.head.append(s);}
 root.ASMachSettingsCompact={install};
})(window);
