const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const template=fs.readFileSync('src-tauri/windows/installer.nsi','utf8'),hooks=fs.readFileSync('src-tauri/windows/hooks.nsh','utf8'),main=fs.readFileSync('src-tauri/src/main.rs','utf8'),ui=fs.readFileSync('src/license-ui.js','utf8'),config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
test('installer never extracts or executes the application for license verification',()=>{
 for(const label of ['Güncelleştir — projeleri ve ayarları koru','Kaldır (Uninstall)','Temiz kurulum'])assert.ok(template.includes(label));
 assert.ok(!template.includes('Page custom PageLicense PageLeaveLicense'));
 assert.ok(!hooks.includes('ExecWait')&&!hooks.includes('MAINBINARYSRCPATH')&&!hooks.includes('$PLUGINSDIR'));
 assert.ok(!main.includes('--installer-'));
 assert.ok(ui.includes('license_window_stage')&&ui.includes('license_activate'));
});
test('clean removal precedes file installation and preserves the running-app guard',()=>{
 const install=template.split('Section Install')[1].split('SectionEnd')[0];
 assert.ok(install.indexOf('Call RemovePreviousVersion')<install.indexOf('File "${MAINBINARYSRCPATH}"'));
 const leave=template.split('Function PageLeaveReinstall')[1].split('FunctionEnd')[0];
 assert.match(leave,/\$ReinstallPageCheck = 2[\s\S]*Call RemovePreviousVersion[\s\S]*Quit/);
 assert.ok(!leave.includes('$ReinstallPageCheck = 3')); // clean removal must never occur on this page
 assert.ok(template.includes('/S /UPDATE _?=$PreviousInstallDir'));
 assert.ok(!template.split('Function RequireAppClosed')[1].split('FunctionEnd')[0].includes('KillProcess'));
});
test('public installer is small and offline installer stays available separately',()=>{
 assert.equal(config.bundle.windows.webviewInstallMode.type,'embedBootstrapper');
 const offline=JSON.parse(fs.readFileSync('src-tauri/tauri.offline.conf.json','utf8'));
 assert.equal(offline.bundle.windows.webviewInstallMode.type,'offlineInstaller');
});
