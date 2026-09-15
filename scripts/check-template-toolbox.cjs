const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process');
const window={};vm.runInNewContext(fs.readFileSync('src/excel-cell-template.js','utf8'),{window});
const dir=path.resolve('outputs/template-review');fs.mkdirSync(dir,{recursive:true});
const test=fs.readFileSync('scripts/check-template-toolbox.ps1','utf8').replace("Join-Path $PSScriptRoot '../src-tauri/src/excel-template-editor.ps1'","Join-Path $env:ASMACH_TEST_ROOT 'src-tauri/src/excel-template-editor.ps1'");
execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-STA','-Command',test],{stdio:'inherit',timeout:20000,windowsHide:true,env:{...process.env,ASMACH_TEST_ROOT:process.cwd(),ASMACH_EXCEL_TEMPLATE:path.join(dir,'test.xltx'),ASMACH_EXCEL_FIELDS:JSON.stringify(window.ASMachExcelCellTemplate.fields),ASMACH_TOOLBOX_TEST_IMAGE:path.join(dir,'toolbox.png')}});
