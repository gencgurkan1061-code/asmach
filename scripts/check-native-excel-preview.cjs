const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const source=fs.readFileSync('src-tauri/src/lib.rs','utf8').split('async fn native_excel_preview')[1].split('async fn native_template_list')[0];
const script=JSON.parse('"'+source.match(/let script="([^\n]*)";/)[1]+'"');
const input=path.resolve('outputs/report-qa/runtime-QA.xlsx'),output=path.resolve('outputs/excel-native-preview-QA.pdf');
assert.ok(fs.existsSync(input));execFileSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:60000,env:{...process.env,ASMACH_PREVIEW_INPUT:input,ASMACH_PREVIEW_OUTPUT:output,ASMACH_PREVIEW_PAPER:'9',ASMACH_PREVIEW_ORIENTATION:'2'}});
assert.equal(fs.readFileSync(output).subarray(0,5).toString(),'%PDF-');console.log('PASS actual Microsoft Excel export using production preview script');
