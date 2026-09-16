use std::{fs, path::PathBuf};
use base64::{Engine, engine::general_purpose::STANDARD};
use ring::{digest, signature};
use serde::{Deserialize, Serialize};
use tauri::Manager;

type Result<T> = std::result::Result<T, String>;
const MAX_MANIFEST: usize = 64 * 1024;
const MAX_INSTALLER: usize = 256 * 1024 * 1024;

#[derive(Deserialize)]
struct Config { url: String, public_key: String }
#[derive(Deserialize)]
struct Envelope { payload: String, signature: String }
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    schema: u8, product: String, version: String, available: bool,
    published_at: String, target: String, arch: String,
    download_url: Option<String>, sha256: Option<String>, size: Option<u64>, notes: String,
    #[serde(default)] chunks: Vec<Chunk>,
}
#[derive(Clone, Deserialize)]
struct Chunk { url: String, sha256: String, size: u64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo { version: String, published_at: String, notes: String, size: u64 }

fn err(e: impl std::fmt::Display) -> String { e.to_string() }
fn config() -> Option<Config> {
    let fallback: Config = serde_json::from_str(include_str!("../updater-config.json")).ok()?;
    let url = option_env!("ASMACH_VERSION_URL").unwrap_or(&fallback.url).to_string();
    if !url.starts_with("https://") || fallback.public_key.is_empty() { None } else { Some(Config { url, public_key: fallback.public_key }) }
}
pub fn configured() -> bool { config().is_some() }
fn version_parts(value: &str) -> Option<Vec<u64>> {
    let core=value.split(['-','+']).next()?;
    let parts=core.split('.').map(str::parse::<u64>).collect::<std::result::Result<Vec<_>,_>>().ok()?;
    if parts.len()<2 || parts.len()>4 { None } else { Some(parts) }
}
fn newer(candidate: &str, current: &str) -> Result<bool> {
    let mut a=version_parts(candidate).ok_or("Güncelleme sürümü geçersiz.")?;
    let mut b=version_parts(current).ok_or("Mevcut sürüm geçersiz.")?;
    let len=a.len().max(b.len());a.resize(len,0);b.resize(len,0);Ok(a>b)
}
fn verify(raw: &[u8], public_key: &str) -> Result<Manifest> {
    if raw.len()>MAX_MANIFEST {return Err("Güncelleme bildirimi çok büyük.".into())}
    let envelope:Envelope=serde_json::from_slice(raw).map_err(err)?;
    if envelope.payload.len()>MAX_MANIFEST*2 || envelope.signature.len()>128 {return Err("Güncelleme imzası biçimi geçersiz.".into())}
    let payload=STANDARD.decode(&envelope.payload).map_err(err)?;
    let key=STANDARD.decode(public_key).map_err(err)?;
    let sig=STANDARD.decode(&envelope.signature).map_err(err)?;
    if key.len()!=32 {return Err("Güncelleme doğrulama anahtarı geçersiz.".into())}
    signature::UnparsedPublicKey::new(&signature::ED25519,key).verify(&payload,&sig).map_err(|_|"Güncelleme imzası doğrulanamadı.".to_string())?;
    let manifest:Manifest=serde_json::from_slice(&payload).map_err(err)?;
    if manifest.schema!=1 || manifest.product!="asmach-inspection" {return Err("Güncelleme ürünü geçersiz.".into())}
    Ok(manifest)
}
async fn manifest() -> Result<(Manifest, reqwest::Url)> {
    let config=config().ok_or("Güncelleme adresi yapılandırılmadı.")?;
    let endpoint=reqwest::Url::parse(&config.url).map_err(err)?;
    if endpoint.scheme()!="https" || !endpoint.username().is_empty() || endpoint.password().is_some() || endpoint.fragment().is_some() {return Err("Güncelleme adresi güvenli değil.".into())}
    let response=reqwest::Client::new().get(endpoint.clone()).send().await.map_err(err)?.error_for_status().map_err(err)?;
    if response.content_length().is_some_and(|n|n>MAX_MANIFEST as u64){return Err("Güncelleme bildirimi çok büyük.".into())}
    let bytes=response.bytes().await.map_err(err)?;
    let value=verify(&bytes,&config.public_key)?;
    if value.target!=std::env::consts::OS || value.arch!=std::env::consts::ARCH {return Err("Bu güncelleme bilgisayar mimarisiyle uyumlu değil.".into())}
    Ok((value,endpoint))
}
pub async fn check(current: &str) -> Result<Option<UpdateInfo>> {
    let (value,_)=manifest().await?;
    if !value.available || !newer(&value.version,current)? {return Ok(None)}
    let size=value.size.ok_or("Güncelleme boyutu eksik.")?;
    if size==0 || size>MAX_INSTALLER as u64 {return Err("Güncelleme boyutu güvenlik sınırının dışında.".into())}
    Ok(Some(UpdateInfo{version:value.version,published_at:value.published_at,notes:value.notes,size}))
}
fn artifact(value:&Manifest, endpoint:&reqwest::Url)->Result<(reqwest::Url,String,u64)> {
    let url=reqwest::Url::parse(value.download_url.as_deref().ok_or("Güncelleme indirme adresi eksik.")?).map_err(err)?;
    if url.scheme()!="https" || url.host_str()!=endpoint.host_str() || !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() || !url.path().to_ascii_lowercase().ends_with(".exe") {return Err("Güncelleme indirme adresi güvenli değil.".into())}
    let hash=value.sha256.clone().ok_or("Güncelleme özeti eksik.")?.to_ascii_lowercase();
    if hash.len()!=64 || !hash.bytes().all(|b|b.is_ascii_hexdigit()) {return Err("Güncelleme özeti geçersiz.".into())}
    let size=value.size.ok_or("Güncelleme boyutu eksik.")?;
    if size==0 || size>MAX_INSTALLER as u64 {return Err("Güncelleme boyutu güvenlik sınırının dışında.".into())}
    Ok((url,hash,size))
}
fn checked_url(raw:&str,endpoint:&reqwest::Url)->Result<reqwest::Url>{let url=reqwest::Url::parse(raw).map_err(err)?;if url.scheme()!="https"||url.host_str()!=endpoint.host_str()||!url.username().is_empty()||url.password().is_some()||url.fragment().is_some(){return Err("Güncelleme parçası adresi güvenli değil.".into())}Ok(url)}
async fn download(url:reqwest::Url,expected_hash:&str,expected_size:u64,max:usize)->Result<Vec<u8>>{
    if expected_size==0||expected_size>max as u64{return Err("Güncelleme parçası boyutu güvenlik sınırının dışında.".into())}
    let response=reqwest::Client::new().get(url).send().await.map_err(err)?.error_for_status().map_err(err)?;
    if response.content_length().is_some_and(|n|n!=expected_size){return Err("Güncelleme dosyası boyutu uyuşmuyor.".into())}
    let bytes=response.bytes().await.map_err(err)?;
    if bytes.len()!=expected_size as usize||bytes.len()>max{return Err("Güncelleme dosyası boyutu uyuşmuyor.".into())}
    let actual=digest::digest(&digest::SHA256,&bytes).as_ref().iter().map(|b|format!("{b:02x}")).collect::<String>();
    if actual!=expected_hash{return Err("Güncelleme dosyasının SHA-256 doğrulaması başarısız.".into())}Ok(bytes.to_vec())
}
pub async fn download_and_stage(app:&tauri::AppHandle, expected_version:&str)->Result<PathBuf>{
    let (value,endpoint)=manifest().await?;
    if !value.available || value.version!=expected_version || !newer(&value.version,&app.package_info().version.to_string())? {return Err("Güncelleme bilgisi değişti; yeniden denetleyin.".into())}
    let expected_hash=value.sha256.clone().ok_or("Güncelleme özeti eksik.")?.to_ascii_lowercase();if expected_hash.len()!=64||!expected_hash.bytes().all(|b|b.is_ascii_hexdigit()){return Err("Güncelleme özeti geçersiz.".into())}
    let expected_size=value.size.ok_or("Güncelleme boyutu eksik.")?;if expected_size==0||expected_size>MAX_INSTALLER as u64{return Err("Güncelleme boyutu güvenlik sınırının dışında.".into())}
    let bytes=if value.chunks.is_empty(){let(url,hash,size)=artifact(&value,&endpoint)?;download(url,&hash,size,MAX_INSTALLER).await?}else{
      if value.download_url.is_some()||value.chunks.len()>32{return Err("Güncelleme parça listesi geçersiz.".into())}let mut joined=Vec::with_capacity(expected_size as usize);let mut total=0u64;
      for part in &value.chunks{let hash=part.sha256.to_ascii_lowercase();if hash.len()!=64||!hash.bytes().all(|b|b.is_ascii_hexdigit()){return Err("Güncelleme parçası özeti geçersiz.".into())}let url=checked_url(&part.url,&endpoint)?;let bytes=download(url,&hash,part.size,20*1024*1024).await?;total=total.checked_add(part.size).ok_or("Güncelleme boyutu geçersiz.")?;if total>expected_size{return Err("Güncelleme parçalarının boyutu uyuşmuyor.".into())}joined.extend_from_slice(&bytes)}if total!=expected_size{return Err("Güncelleme parçalarının boyutu uyuşmuyor.".into())}joined
    };
    let actual=digest::digest(&digest::SHA256,&bytes).as_ref().iter().map(|b|format!("{b:02x}")).collect::<String>();if actual!=expected_hash{return Err("Birleştirilen güncellemenin SHA-256 doğrulaması başarısız.".into())}
    let dir=app.path().app_cache_dir().map_err(err)?.join("verified-updates");fs::create_dir_all(&dir).map_err(err)?;
    let destination:PathBuf=dir.join(format!("ASMach-Inspection-{}-{}.exe",value.version,uuid::Uuid::new_v4()));
    super::atomic_write(&destination,&bytes)?;
    Ok(destination)
}
#[cfg(windows)]
pub fn launch_after_exit(installer:&std::path::Path)->Result<()>{use std::os::windows::process::CommandExt;let script="$processId=[int]$env:ASMACH_UPDATE_PID; Wait-Process -Id $processId -ErrorAction SilentlyContinue; Start-Process -FilePath $env:ASMACH_UPDATE_INSTALLER -ArgumentList '/UPDATE','/P'";std::process::Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",script]).env("ASMACH_UPDATE_PID",std::process::id().to_string()).env("ASMACH_UPDATE_INSTALLER",installer).creation_flags(0x08000000).spawn().map_err(err)?;Ok(())}
#[cfg(not(windows))]
pub fn launch_after_exit(_: &std::path::Path)->Result<()>{Err("Güncelleme kurulumu yalnız Windows'ta desteklenir.".into())}

#[cfg(test)]
mod tests {
 use super::*;use ring::signature::KeyPair;
 #[test] fn versions_are_compared_numerically(){assert!(newer("2.10.0","2.9.9").unwrap());assert!(!newer("2.0.5","2.0.5").unwrap());assert!(!newer("2.0.4","2.0.5").unwrap())}
 #[test] fn signed_manifest_is_required(){let key=signature::Ed25519KeyPair::from_seed_unchecked(&[23;32]).unwrap();let payload=serde_json::to_vec(&serde_json::json!({"schema":1,"product":"asmach-inspection","version":"2.1.0","available":false,"publishedAt":"2026-09-15T00:00:00Z","target":std::env::consts::OS,"arch":std::env::consts::ARCH,"downloadUrl":null,"sha256":null,"size":null,"notes":"test","chunks":[]})).unwrap();let signature=STANDARD.encode(key.sign(&payload).as_ref());let raw=serde_json::to_vec(&serde_json::json!({"payload":STANDARD.encode(&payload),"signature":signature})).unwrap();let public=STANDARD.encode(key.public_key().as_ref());assert_eq!(verify(&raw,&public).unwrap().version,"2.1.0");let mut changed=payload.clone();changed[0]^=1;let tampered=serde_json::to_vec(&serde_json::json!({"payload":STANDARD.encode(changed),"signature":signature})).unwrap();assert!(verify(&tampered,&public).is_err())}
}
