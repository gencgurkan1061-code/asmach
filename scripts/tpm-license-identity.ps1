param([switch]$Create)
$ErrorActionPreference='Stop'
$provider=New-Object System.Security.Cryptography.CngProvider('Microsoft Platform Crypto Provider')
$keyName='ASMach.LicenseDevice.v2'
$key=$null
try {
 if([System.Security.Cryptography.CngKey]::Exists($keyName,$provider)) {
  $key=[System.Security.Cryptography.CngKey]::Open($keyName,$provider)
 } elseif($Create) {
  $options=New-Object System.Security.Cryptography.CngKeyCreationParameters
  $options.Provider=$provider
  $options.ExportPolicy=[System.Security.Cryptography.CngExportPolicies]::None
  $options.KeyUsage=[System.Security.Cryptography.CngKeyUsages]::Signing
  $key=[System.Security.Cryptography.CngKey]::Create([System.Security.Cryptography.CngAlgorithm]::ECDsaP256,$keyName,$options)
 } else {throw 'Bu Windows hesabında TPM lisans anahtarı henüz oluşturulmadı.'}
 if($key.Provider.Provider -ne 'Microsoft Platform Crypto Provider' -or [int]$key.ExportPolicy -ne 0){throw 'Anahtar TPM sağlayıcısında veya dışa aktarılamaz durumda değil.'}
 $public=$key.Export([System.Security.Cryptography.CngKeyBlobFormat]::EccPublicBlob)
 $signer=New-Object System.Security.Cryptography.ECDsaCng($key)
 $signer.HashAlgorithm=[System.Security.Cryptography.CngAlgorithm]::Sha256
 if($env:ASMACH_TPM_CHALLENGE){$nonce=[Convert]::FromBase64String($env:ASMACH_TPM_CHALLENGE);if($nonce.Length -ne 32){throw 'Geçersiz sınama verisi.'}}
 else {$nonce=New-Object byte[] 32;$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($nonce);$rng.Dispose()}
 $signature=$signer.SignData($nonce)
 if(-not $signer.VerifyData($nonce,$signature)){throw 'TPM imza sınaması başarısız.'}
 $sha=[System.Security.Cryptography.SHA256]::Create()
 $device=([BitConverter]::ToString($sha.ComputeHash($public))).Replace('-','').ToLowerInvariant();$sha.Dispose()
 [ordered]@{deviceId=$device;binding='tpm-cng-v1';publicKey=[Convert]::ToBase64String($public);challenge=[Convert]::ToBase64String($nonce);signature=[Convert]::ToBase64String($signature)}|ConvertTo-Json -Compress
 $signer.Dispose()
} catch {Write-Error $_;exit 1} finally {if($key){$key.Dispose()}}
