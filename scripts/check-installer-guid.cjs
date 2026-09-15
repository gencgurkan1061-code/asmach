const assert=require('node:assert/strict'),fs=require('node:fs');
const hooks=fs.readFileSync('src-tauri/windows/hooks.nsh','utf8'),main=fs.readFileSync('src-tauri/src/main.rs','utf8'),ui=fs.readFileSync('src/license-ui.js','utf8');
assert.ok(!hooks.includes('ExecWait')&&!hooks.includes('$PLUGINSDIR')&&!hooks.includes('MAINBINARYSRCPATH'));
assert.ok(!main.includes('--installer-'));
assert.ok(ui.includes('license_window_stage')&&ui.includes('license_activate'));
console.log('PASS first-launch license entry; installer launches no temporary helper');
