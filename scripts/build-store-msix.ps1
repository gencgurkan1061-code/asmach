param(
  [string]$IdentityName = $env:ASMACH_STORE_IDENTITY_NAME,
  [string]$Publisher = $env:ASMACH_STORE_PUBLISHER,
  [string]$PublisherDisplayName = $env:ASMACH_STORE_PUBLISHER_DISPLAY_NAME,
  [switch]$Validation
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tauriConfig = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'src-tauri\tauri.conf.json') | ConvertFrom-Json
if ($Validation) {
  if ([string]::IsNullOrWhiteSpace($IdentityName)) { $IdentityName = 'ASMachInspection.Development' }
  if ([string]::IsNullOrWhiteSpace($Publisher)) { $Publisher = 'CN=ASMach Development' }
  if ([string]::IsNullOrWhiteSpace($PublisherDisplayName)) { $PublisherDisplayName = 'ASMach Development' }
}
if ([string]::IsNullOrWhiteSpace($IdentityName) -or [string]::IsNullOrWhiteSpace($Publisher) -or [string]::IsNullOrWhiteSpace($PublisherDisplayName)) {
  throw 'Store kimliği eksik. Partner Center değerlerini ASMACH_STORE_IDENTITY_NAME, ASMACH_STORE_PUBLISHER ve ASMACH_STORE_PUBLISHER_DISPLAY_NAME değişkenleriyle sağlayın.'
}
$binary = Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release\asmach-ballooning.exe'
if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'Önce x64 üretim uygulamasını derleyin.' }
$storeRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'src-tauri\target\store'))
$stage = [IO.Path]::GetFullPath((Join-Path $storeRoot 'staging'))
if (-not $stage.StartsWith($storeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Geçersiz hazırlama klasörü.' }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
$assets = New-Item -ItemType Directory -Force -Path (Join-Path $stage 'Assets')
Copy-Item -LiteralPath $binary -Destination (Join-Path $stage 'asmach-ballooning.exe')
foreach ($name in 'StoreLogo.png','Square150x150Logo.png','Square44x44Logo.png') {
  Copy-Item -LiteralPath (Join-Path $projectRoot "src-tauri\icons\$name") -Destination (Join-Path $assets.FullName $name)
}
$version = "$($tauriConfig.version).0"
if ($version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'MSIX için dört parçalı sayısal sürüm oluşturulamadı.' }
function Escape-Xml([string]$value) { [Security.SecurityElement]::Escape($value) }
$manifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'src-tauri\store\Package.appxmanifest.template.xml')
$manifest = $manifest.Replace('{{IDENTITY_NAME}}',(Escape-Xml $IdentityName)).Replace('{{PUBLISHER}}',(Escape-Xml $Publisher)).Replace('{{PUBLISHER_DISPLAY_NAME}}',(Escape-Xml $PublisherDisplayName)).Replace('{{VERSION}}',$version)
[IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'),$manifest,(New-Object Text.UTF8Encoding($false)))
$makeAppx = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Recurse -Filter makeappx.exe | Where-Object FullName -Match '\\x64\\makeappx\.exe$' | Sort-Object FullName | Select-Object -Last 1
if (-not $makeAppx) { throw 'Windows SDK MakeAppx.exe bulunamadı.' }
$suffix = if ($Validation) { '_development-unsigned' } else { '' }
$output = Join-Path $storeRoot "ASMach Inspection_$($tauriConfig.version)_x64$suffix.msix"
New-Item -ItemType Directory -Force -Path $storeRoot | Out-Null
& $makeAppx.FullName pack /d $stage /p $output /o
if ($LASTEXITCODE -ne 0) { throw "MSIX oluşturulamadı (kod $LASTEXITCODE)." }
$hash = (Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash
Set-Content -LiteralPath ($output + '.sha256.txt') -Value "$hash  $([IO.Path]::GetFileName($output))" -Encoding ascii
[pscustomobject]@{ Package=$output; Version=$version; SHA256=$hash; Signed=$false; Validation=[bool]$Validation } | ConvertTo-Json -Compress
