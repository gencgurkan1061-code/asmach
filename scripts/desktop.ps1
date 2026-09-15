param([ValidateSet('dev','build','test','doctor')][string]$Mode='dev')
$ErrorActionPreference='Stop'
$projectDirectory=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$rustBin=Join-Path $env:USERPROFILE '.cargo/bin'
if(Test-Path -LiteralPath $rustBin){$env:PATH=$rustBin+';'+$env:PATH}
$nodeCommand=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $nodeCommand){$bundledNode=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';if(Test-Path -LiteralPath $bundledNode){$nodePath=$bundledNode}else{throw 'Node.js bulunamadı. Node.js LTS kurun.'}}else{$nodePath=$nodeCommand.Source}
$env:PATH=(Split-Path -Parent $nodePath)+';'+$env:PATH
if($Mode -eq 'doctor'){
 & $nodePath --version
 & cargo.exe --version
 $vswhere='C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe'
 if(Test-Path -LiteralPath $vswhere){& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath}
 exit
}
if($Mode -eq 'test'){& cargo.exe test --manifest-path src-tauri/Cargo.toml;if($LASTEXITCODE -ne 0){exit $LASTEXITCODE};& $nodePath --test tests/tauri-bridge.test.cjs;exit $LASTEXITCODE}
$cli=Join-Path $projectDirectory 'node_modules/@tauri-apps/cli/tauri.js'
if(-not (Test-Path -LiteralPath $cli)){throw 'Önce npm ci ile proje bağımlılıklarını kurun.'}
if($Mode -eq 'dev'){& $nodePath $cli dev}else{& $nodePath $cli build --bundles nsis}
exit $LASTEXITCODE
