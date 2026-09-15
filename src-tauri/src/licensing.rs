//! Signed offline entitlements. Signing keys are NEVER shipped with the client.
use super::{err, Result};
use base64::{engine::general_purpose::{STANDARD,URL_SAFE_NO_PAD}, Engine};
use ring::{digest, signature};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex, time::{SystemTime, UNIX_EPOCH}};
use tauri::{Emitter, Manager, State};

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct Config { license_public_key: String, status_public_key: String, endpoint: String, #[serde(default)] require_tpm:bool }
fn config() -> Config { serde_json::from_str(include_str!("../license-config.json")).expect("license config") }
#[derive(Clone, Serialize, Deserialize)]
pub struct Envelope { payload: String, signature: String, #[serde(default,skip_serializing_if="Option::is_none")] activation:Option<Box<Envelope>> }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct License { version:u32, product:String, license_id:String, device_id:String, customer:String, issued_at:u64, not_before:u64, expires_at:u64, #[serde(default)] binding:String, #[serde(default="initial_revision")] revision:u64, #[serde(default)] verification_url:String, #[serde(default)] license_number:String, #[serde(default)] activation_mode:String }
fn initial_revision()->u64{1}
#[derive(Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
struct OnlineStatus { version:u32, product:String, license_id:String, device_id:String, nonce:String, status:String, issued_at:u64, #[serde(default)] license_update:Option<Envelope> }
fn endpoint(c:&Config,l:&License)->Option<String>{let value=if c.endpoint.is_empty(){&l.verification_url}else{&c.endpoint};let u=reqwest::Url::parse(value).ok()?;if u.scheme()!="https"||!u.username().is_empty()||u.password().is_some()||u.fragment().is_some(){return None}Some(u.to_string())}
fn apply_update(db:&rusqlite::Connection,c:&Config,current:&License,envelope:&Envelope)->Result<()> {
    if let Some(raw)=get(db,"license")? {let stored:Envelope=serde_json::from_str(&raw).map_err(err)?;let l:License=signed_license(&stored,&c.license_public_key)?;if l.license_id!=current.license_id{return Ok(())}}
    let next:License=signed_license(envelope,&c.license_public_key)?;
    if next.license_id!=current.license_id||next.device_id!=current.device_id||next.product!="asmach-inspection"||![1,2].contains(&next.version)||next.expires_at<=next.not_before||next.issued_at>next.expires_at||next.revision==0||c.require_tpm&&(next.version!=2||next.binding!="tpm-cng-v1"){return Err("Güncel lisans doğrulanamadı.".into())}
    let key=format!("revision:{}",current.license_id);let floor=get(db,&key)?.and_then(|s|s.parse::<u64>().ok()).unwrap_or(0).max(current.revision);
    if next.revision<=floor{return Ok(())}
    // Expired revisions are accepted: an authenticated shortening must also lock an offline entitlement.
    db.execute_batch("SAVEPOINT license_update").map_err(err)?;
    let result=(||{put(db,&key,&next.revision.to_string())?;put(db,"license",&serde_json::to_string(envelope).map_err(err)?)})();
    if result.is_err(){db.execute_batch("ROLLBACK TO license_update;RELEASE license_update").map_err(err)?;}else{db.execute_batch("RELEASE license_update").map_err(err)?;}result
}
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Status { valid:bool, reason:String, device_id:String, license:Option<License>, online_configured:bool, online_message:String }
pub struct Licensing { db:Mutex<rusqlite::Connection>, device:String, checking:std::sync::atomic::AtomicBool, clock:Mutex<(std::time::Instant,u64)>, next_check:Mutex<std::time::Instant> }
fn now()->u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn http_client()->Result<reqwest::Client> {
    let _=rustls::crypto::ring::default_provider().install_default();
    reqwest::Client::builder().timeout(std::time::Duration::from_secs(8)).redirect(reqwest::redirect::Policy::none()).build().map_err(err)
}
fn signed<T:serde::de::DeserializeOwned>(envelope:&Envelope,key:&str)->Result<T> {
    if envelope.payload.len()>16_384 || envelope.signature.len()>128 { return Err("Lisans boyutu geçersiz.".into()); }
    let key=STANDARD.decode(key).map_err(|_|"Lisans doğrulama anahtarı yapılandırılmadı.")?;
    let bytes=STANDARD.decode(&envelope.payload).map_err(err)?;
    let sig=STANDARD.decode(&envelope.signature).map_err(err)?;
    signature::UnparsedPublicKey::new(&signature::ED25519,key).verify(&bytes,&sig).map_err(|_|"Lisans imzası geçersiz.".to_string())?;
    serde_json::from_slice(&bytes).map_err(err)
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct Activation {version:u32,product:String,license_id:String,device_id:String}
fn signed_license(envelope:&Envelope,key:&str)->Result<License>{
 signed_license_with_status(envelope,key,&config().status_public_key)
}
fn signed_license_with_status(envelope:&Envelope,key:&str,status_key:&str)->Result<License>{
 let mut l:License=signed(envelope,key)?;
 if l.device_id.is_empty(){
  if l.activation_mode!="first-device"||l.version!=2||l.binding!="tpm-cng-v1"{return Err("Geçersiz etkinleştirme lisansı.".into())}
  let proof=envelope.activation.as_ref().ok_or("Lisans anahtarını internet üzerinden etkinleştirin.")?;
  let a:Activation=signed(proof,status_key)?;
  if a.version!=1||a.product!="asmach-activation"||a.license_id!=l.license_id||a.device_id.len()!=64||!a.device_id.bytes().all(|b|b.is_ascii_hexdigit()){return Err("Cihaz etkinleştirme imzası geçersiz.".into())}
  l.device_id=a.device_id;
 }
 Ok(l)
}
fn validate(envelope:&Envelope,key:&str,device:&str,time:u64)->Result<License> {
    let l:License=signed_license(envelope,key)?;
    if ![1,2].contains(&l.version) || l.product!="asmach-inspection" || l.license_id.is_empty() || l.device_id!=device || l.expires_at<=l.not_before || l.issued_at>l.expires_at {return Err("Lisans bu bilgisayara veya ürüne ait değil.".into())}
    if time<l.not_before {return Err("Lisans henüz başlamadı. Bilgisayar tarihini kontrol edin.".into())}
    if time>=l.expires_at {return Err("Abonelik süresi doldu. Yeni lisansınızı yükleyin.".into())}
    Ok(l)
}
fn device_id()->Result<String> {
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        // Fixed Windows executable and arguments; no user input is executed.
        let exe=std::env::var_os("SystemRoot").map(std::path::PathBuf::from).ok_or("Windows klasörü bulunamadı")?.join("System32/reg.exe");
        let out=std::process::Command::new(exe).args(["query",r"HKLM\SOFTWARE\Microsoft\Cryptography","/v","MachineGuid","/reg:64"]).creation_flags(0x08000000).output().map_err(err)?;
        if !out.status.success(){return Err("Bilgisayar kimliği okunamadı.".into())}
        let text=String::from_utf8_lossy(&out.stdout);
        let guid=text.lines().find(|s|s.contains("REG_SZ")).and_then(|s|s.split("REG_SZ").nth(1)).map(str::trim).filter(|s|s.len()>=32).ok_or("Bilgisayar kimliği bulunamadı")?;
        let hash=digest::digest(&digest::SHA256,format!("asmach-inspection:v1:{}",guid.to_ascii_lowercase()).as_bytes());
        Ok(hash.as_ref().iter().map(|b|format!("{b:02x}")).collect())
    }
    #[cfg(not(windows))] { Err("Lisanslı paket Windows gerektirir.".into()) }
}
fn open(data_dir:PathBuf)->Result<Licensing> {
    std::fs::create_dir_all(&data_dir).map_err(err)?;
    let db=rusqlite::Connection::open(data_dir.join("licensing.sqlite3")).map_err(err)?;
    db.execute_batch("PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS license_state(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS revoked(id TEXT PRIMARY KEY,certificate TEXT NOT NULL);").map_err(err)?;
    Ok(Licensing{db:Mutex::new(db),device:device_id()?,checking:std::sync::atomic::AtomicBool::new(false),clock:Mutex::new((std::time::Instant::now(),now())),next_check:Mutex::new(std::time::Instant::now()+std::time::Duration::from_secs(1800))})
}
pub fn setup(app:&tauri::AppHandle)->Result<()> {
    app.manage(open(app.path().app_data_dir().map_err(err)?)?);Ok(())
}
fn get(db:&rusqlite::Connection,key:&str)->Result<Option<String>> {db.query_row("SELECT value FROM license_state WHERE key=?1",[key],|r|r.get(0)).optional().map_err(err)}
fn put(db:&rusqlite::Connection,key:&str,value:&str)->Result<()> {db.execute("INSERT INTO license_state VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value]).map_err(err)?;Ok(())}
fn inspect(state:&Licensing)->Result<Status> {
    let wall=now();let floor={let mut clock=state.clock.lock().map_err(err)?;let floor=clock.1.saturating_add(clock.0.elapsed().as_secs());if wall>floor{*clock=(std::time::Instant::now(),wall);}floor.max(wall)};
    let mut status=inspect_at(state,&config(),floor)?;
    if status.valid&&wall.saturating_add(300)<floor{status.valid=false;status.reason="Bilgisayar saati geriye alınmış. Tarihi düzeltip yeniden doğrulayın.".into();}
    Ok(status)
}
fn inspect_at(state:&Licensing,c:&Config,time:u64)->Result<Status> {
    let db=state.db.lock().map_err(err)?;
    let highest=get(&db,"last_time")?.and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);
    let raw=get(&db,"license")?;
    let mut result=Status{valid:false,reason:"Bu bilgisayarda lisans yok. Lisans dosyanızı yükleyin.".into(),device_id:state.device.clone(),license:None,online_configured:c.endpoint.starts_with("https://")&&!c.status_public_key.is_empty(),online_message:get(&db,"online_message")?.unwrap_or_default()};
    if c.require_tpm {match crate::tpm::identity(false){Ok(i)=>result.device_id=i.device_id,Err(e)=>{result.reason=e;return Ok(result)}}}
    if let Some(raw)=raw {
        let envelope:Envelope=match serde_json::from_str(&raw) {Ok(e)=>e,Err(_)=>{result.reason="Kayıtlı lisans dosyası bozulmuş. Lisansı yeniden yükleyin.".into();return Ok(result)}};
        // Display even expired claims, but only after signature and device verification.
        if let Ok(l)=signed_license(&envelope,&c.license_public_key) {if l.device_id==result.device_id&&l.product=="asmach-inspection" {put(&db,"last_time",&time.max(highest).to_string())?;result.online_configured=endpoint(c,&l).is_some()&&!c.status_public_key.is_empty();result.license=Some(l);}}
        match validate(&envelope,&c.license_public_key,&result.device_id,time.max(highest)) {
            Err(e)=>result.reason=e,
            Ok(l)=>{
                if c.require_tpm&&(l.version!=2||l.binding!="tpm-cng-v1"){result.reason="Bu sürüm TPM'ye bağlı yeni lisans gerektirir.".into();return Ok(result)}
                let floor=get(&db,&format!("revision:{}",l.license_id))?.and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);if l.revision<floor {result.reason="Eski lisans revizyonu kullanılamaz.".into();return Ok(result)}
                let revoked:Option<String>=db.query_row("SELECT certificate FROM revoked WHERE id=?1",[&l.license_id],|r|r.get(0)).optional().map_err(err)?;
                let is_revoked=revoked.as_ref().and_then(|s|serde_json::from_str::<Envelope>(s).ok()).and_then(|e|signed::<OnlineStatus>(&e,&c.status_public_key).ok()).is_some_and(|s|s.status=="revoked"&&s.license_id==l.license_id&&s.device_id==result.device_id&&s.product=="asmach-inspection");
                if revoked.is_some()&&!is_revoked {result.reason="İptal kaydı doğrulanamadı. Lisans desteğine başvurun.".into();return Ok(result)}
                if let Some(raw)=get(&db,&format!("denied:{}",l.license_id))? {
                    let proof=serde_json::from_str::<Envelope>(&raw).ok().and_then(|e|signed::<OnlineStatus>(&e,&c.status_public_key).ok());
                    result.reason=if proof.is_some_and(|p|p.version==1&&p.status=="inactive"&&p.product=="asmach-inspection"&&p.license_id==l.license_id&&p.device_id==l.device_id){"Lisans aktif listede bulunamadı. Yöneticinizle iletişime geçin ve yeniden doğrulayın."}else{"Lisans durum kaydı doğrulanamadı. Destek isteyin."}.into();return Ok(result)
                }
                if is_revoked {result.reason="Lisans yönetici tarafından devre dışı bırakıldı.".into();}
                else if time.saturating_add(300)<highest {result.reason="Bilgisayar tarihi geriye alınmış. Tarihi düzeltin ve yeniden doğrulayın.".into();}
                else {result.valid=true;result.reason="Lisans geçerli.".into();put(&db,"last_time",&time.max(highest).to_string())?;}
            }
        }
    }
    Ok(result)
}
pub fn require(app:&tauri::AppHandle)->Result<()> { let s=inspect(&app.state::<Licensing>())?;if s.valid {Ok(())}else{Err(s.reason)} }
#[tauri::command]
pub fn license_status(state:State<'_,Licensing>)->Result<Status> {inspect(&state)}
#[tauri::command]
pub fn license_tpm_identity()->Result<crate::tpm::Identity>{crate::tpm::identity(true)}
#[tauri::command]
pub fn license_import(state:State<'_,Licensing>,text:String)->Result<Status> {
    install_license(&state,text)
}
const OFFLINE_CODE_PREFIX:&str="ASM-OFF1-";
fn decode_offline_code(code:&str)->Result<String>{
    let compact:String=code.chars().filter(|c|!c.is_ascii_whitespace()).collect();
    let encoded=compact.strip_prefix(OFFLINE_CODE_PREFIX).ok_or("Çevrimdışı etkinleştirme kodu ASM-OFF1- ile başlamalıdır.")?;
    if encoded.is_empty()||encoded.len()>32_000{return Err("Çevrimdışı etkinleştirme kodunun boyutu geçersiz.".into())}
    let bytes=URL_SAFE_NO_PAD.decode(encoded).map_err(|_|"Çevrimdışı etkinleştirme kodu bozuk veya eksik.")?;
    String::from_utf8(bytes).map_err(|_|"Çevrimdışı etkinleştirme kodu geçersiz.".into())
}
#[tauri::command]
pub fn license_offline_activate(state:State<'_,Licensing>,code:String)->Result<Status>{
    install_license(&state,decode_offline_code(&code)?)
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct LicenseRequestResult {submitted:bool,request_id:String,device_id:String,code:String,message:String}
#[tauri::command]
pub async fn license_request_create(company:String,contact:String,note:String,consent:bool)->Result<LicenseRequestResult>{
 if !consent{return Err("Bilgisayar kimliğinin lisans yöneticisine gönderilmesini onaylayın.".into())}
 let company=company.trim().to_string();let contact=contact.trim().to_string();let note=note.trim().to_string();
 if company.len()<2||company.len()>160||contact.len()>200||note.len()>500{return Err("Lisans talebi alanlarını kontrol edin.".into())}
 let identity=crate::tpm::identity(true)?;let request_id=uuid::Uuid::new_v4().to_string();
 let request=serde_json::json!({"version":1,"product":"asmach-license-request","requestId":request_id,"deviceId":identity.device_id,"company":company,"contact":contact,"note":note,"appVersion":env!("CARGO_PKG_VERSION"),"createdAt":now(),"proof":identity});
 let bytes=serde_json::to_vec(&request).map_err(err)?;let code=format!("ASM-REQ1-{}",URL_SAFE_NO_PAD.encode(&bytes));
 let c=config();let base=c.endpoint.trim_end_matches("/validate");let mut submitted=false;let mut failure="İnternet bağlantısı kurulamadı.".to_string();
 if base.starts_with("https://") {match http_client(){Ok(client)=>match client.post(format!("{base}/request-license")).json(&request).send().await{Ok(response)=>{submitted=response.status().is_success();if !submitted{failure=match response.status().as_u16(){400=>"Talep bilgileri hizmet tarafından doğrulanamadı.",413=>"Talep bilgileri izin verilen boyutu aştı.",429=>"Kısa sürede çok fazla talep gönderildi.",_=>"Lisans talebi hizmeti şu anda yanıt vermiyor."}.into();}},Err(_)=>failure="Güvenlik duvarı veya internet bağlantısı talebi engelledi.".into()},Err(_)=>failure="Güvenli internet bağlantısı hazırlanamadı.".into()}}
 let message=if submitted{"Lisans talebiniz yöneticiye gönderildi. Talep kodunu da yedek olarak saklayabilirsiniz.".to_string()}else{format!("{failure} Yedek talep kodunu lisans yöneticinize iletin.")};
 Ok(LicenseRequestResult{submitted,request_id,device_id:request["deviceId"].as_str().unwrap_or_default().to_string(),code,message})
}
fn install_license(state:&Licensing,text:String)->Result<Status> {
    if text.len()>24_000{return Err("Lisans dosyası çok büyük.".into())}
    let envelope:Envelope=serde_json::from_str(&text).map_err(|_|"Geçerli bir ASMach lisans dosyası seçin.")?;
    let c=config();let device=if c.require_tpm{crate::tpm::identity(false)?.device_id}else{state.device.clone()};
    let license=validate(&envelope,&c.license_public_key,&device,now())?;
    if c.require_tpm&&(license.version!=2||license.binding!="tpm-cng-v1"){return Err("TPM'ye bağlı lisans dosyası gerekli.".into())}
    {let db=state.db.lock().map_err(err)?;
    let revoked:bool=db.query_row("SELECT EXISTS(SELECT 1 FROM revoked WHERE id=?1)",[&license.license_id],|r|r.get(0)).map_err(err)?;
    if revoked{return Err("Bu lisans iptal edilmiş. Yeni lisans isteyin.".into())}
    let key=format!("revision:{}",license.license_id);let old=get(&db,&key)?.and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);if license.revision<old{return Err("Eski lisans revizyonu yüklenemez.".into())}put(&db,&key,&license.revision.to_string())?;
    put(&db,"license",&serde_json::to_string(&envelope).map_err(err)?)?;}
    inspect(state)
}
async fn discover_license(state:&Licensing,activation_key:Option<String>)->Result<Status>{
 let c=config();if !c.endpoint.starts_with("https://"){return Err("Bulut adresi tanımlı değil.".into())}
 let identity=crate::tpm::identity(true)?;
 let base=c.endpoint.trim_end_matches("/validate");let client=http_client()?;
 async fn post(client:&reqwest::Client,url:String,body:serde_json::Value)->Result<serde_json::Value>{let mut r=client.post(url).json(&body).send().await.map_err(|_|"İnternet bağlantısı kurulamadı. İlk etkinleştirme için bağlantınızı kontrol edin.")?;if !r.status().is_success(){return Err(match r.status().as_u16(){409=>"Bu anahtar başka bir bilgisayarda etkinleştirilmiş.",403=>"Lisans anahtarı bulunamadı, iptal edilmiş veya süresi dolmuş.",400=>"Lisans anahtarı ya da cihaz doğrulaması geçersiz.",_=>"Bulut hizmetine erişilemiyor. Biraz sonra yeniden deneyin."}.into())}let mut bytes=Vec::new();while let Some(chunk)=r.chunk().await.map_err(err)?{if bytes.len()+chunk.len()>24000{return Err("Bulut yanıtı çok büyük.".into())}bytes.extend_from_slice(&chunk);}serde_json::from_slice(&bytes).map_err(err)}
 let ticket=post(&client,format!("{base}/discover-challenge"),serde_json::json!({"deviceId":identity.device_id})).await?;
 let challenge=ticket["challenge"].as_str().ok_or("Bulut sınaması geçersiz")?;
 let bytes:[u8;32]=STANDARD.decode(challenge).map_err(err)?.try_into().map_err(|_|"Bulut sınaması geçersiz")?;
 let proof=serde_json::to_value(crate::tpm::identity_challenge(false,Some(bytes))?).map_err(err)?;
 let response=post(&client,format!("{base}/{}",if activation_key.is_some(){"activate"}else{"discover"}),serde_json::json!({"activationKey":activation_key,"deviceId":identity.device_id,"ticket":ticket,"publicKey":proof["publicKey"],"proof":proof["signature"]})).await?;
 let envelope:Envelope=serde_json::from_value(response).map_err(err)?;let result:OnlineStatus=signed(&envelope,&c.status_public_key)?;
 if result.version!=1||result.product!="asmach-inspection"||result.device_id!=identity.device_id||result.nonce!=challenge{return Err("Bulut cihaz yanıtı doğrulanamadı.".into())}
 if result.status!="active"{return Err("Bu bilgisayar için bulutta kullanılabilir lisans bulunamadı.".into())}
 let license=result.license_update.ok_or("Bulut lisans dosyasını göndermedi")?;let claims:License=signed_license(&license,&c.license_public_key)?;
 if claims.license_id!=result.license_id||claims.device_id!=identity.device_id{return Err("Buluttaki lisans bu bilgisayara ait değil.".into())}
 install_license(state,serde_json::to_string(&license).map_err(err)?)?;
 {let db=state.db.lock().map_err(err)?;db.execute("DELETE FROM license_state WHERE key=?1",[format!("denied:{}",claims.license_id)]).map_err(err)?;put(&db,"online_message","Lisans bilgisayar kimliğiyle buluttan indirildi ve doğrulandı.")?;}
 inspect(state)
}
#[tauri::command]
pub async fn license_discover(state:State<'_,Licensing>)->Result<Status>{
 use std::sync::atomic::Ordering;
 if state.checking.swap(true,Ordering::SeqCst){return inspect(&state)}
 let found=discover_license(&state,None).await;state.checking.store(false,Ordering::SeqCst);
 match found{Ok(s)=>Ok(s),Err(e)=>{{let db=state.db.lock().map_err(err)?;put(&db,"online_message",&format!("Buluttan lisans alınamadı: {e}"))?;}inspect(&state)}}
}
#[tauri::command]
pub async fn license_activate(state:State<'_,Licensing>,key:String)->Result<Status>{
 activate(&state,key).await
}
async fn activate(state:&Licensing,key:String)->Result<Status>{
 let key=key.trim().to_uppercase();let id=uuid::Uuid::parse_str(&key).map_err(|_|"Geçerli GUID biçiminde lisans anahtarı girin.")?;
 if id.get_version_num()!=4{return Err("Geçerli lisans anahtarı girin.".into())}
 if state.checking.swap(true,std::sync::atomic::Ordering::SeqCst){return Err("Lisans işlemi sürüyor; tekrar deneyin.".into())}
 let result=discover_license(&state,Some(key)).await;
 state.checking.store(false,std::sync::atomic::Ordering::SeqCst);result
}
#[tauri::command]
pub async fn license_check_online(state:State<'_,Licensing>)->Result<Status> {check_online(&state).await}
async fn check_online(state:&Licensing)->Result<Status> {
    use std::sync::atomic::Ordering;
    let c=config();let before=inspect(&state)?;
    let Some(l)=before.license else {schedule_check(state,true)?;return inspect(&state)};
    if !before.online_configured {schedule_check(state,true)?;return inspect(&state)}
    if state.checking.swap(true,Ordering::SeqCst){return inspect(&state)}
    let nonce=uuid::Uuid::new_v4().to_string();
    let mut receipt=None;
    let response:Result<OnlineStatus>=async {
        let client=http_client()?;
        let mut r=client.post(endpoint(&c,&l).ok_or("Lisans doğrulama adresi geçersiz")?).json(&serde_json::json!({"licenseId":l.license_id,"deviceId":l.device_id,"nonce":nonce})).send().await.map_err(err)?.error_for_status().map_err(err)?;
        let mut bytes=Vec::new();while let Some(chunk)=r.chunk().await.map_err(err)? {if bytes.len()+chunk.len()>24_000{return Err("Yanıt çok büyük".into())}bytes.extend_from_slice(&chunk);}
        let raw:serde_json::Value=serde_json::from_slice(&bytes).map_err(err)?;
        let envelope:Envelope=serde_json::from_value(raw.clone()).map_err(err)?;
        let s:OnlineStatus=signed(&envelope,&c.status_public_key)?;
        if s.version!=1||s.product!="asmach-inspection"||s.license_id!=l.license_id||s.device_id!=l.device_id||s.nonce!=nonce||!["active","revoked","inactive"].contains(&s.status.as_str()){return Err("Doğrulama yanıtı geçersiz.".into())}
        let db=state.db.lock().map_err(err)?;
        if s.status=="revoked" {db.execute("INSERT OR REPLACE INTO revoked VALUES(?1,?2)",params![l.license_id,serde_json::to_string(&envelope).map_err(err)?]).map_err(err)?;}
        else if s.status=="inactive" {put(&db,&format!("denied:{}",l.license_id),&serde_json::to_string(&envelope).map_err(err)?)?;}
        else {if let Some(update)=&s.license_update {apply_update(&db,&c,&l,update)?;}db.execute("DELETE FROM license_state WHERE key=?1",[format!("denied:{}",l.license_id)]).map_err(err)?;}
        // Authenticated server time repairs a accidentally future local-clock watermark.
        put(&db,"last_time",&s.issued_at.to_string())?;
        *state.clock.lock().map_err(err)?=(std::time::Instant::now(),s.issued_at);
        receipt=Some(raw);
        Ok(s)
    }.await;
    // Only acknowledge after the signed decision has been durably stored locally.
    let delivered=if let Some(raw)=receipt {acknowledge(&c,&l,&raw).await.is_ok()}else{false};
    state.checking.store(false,Ordering::SeqCst);
    schedule_check(state,response.is_ok()&&delivered)?;
    {let db=state.db.lock().map_err(err)?;put(&db,"online_message",if response.is_ok(){"Çevrimiçi lisans durumu doğrulandı."}else{"Çevrimiçi doğrulamaya ulaşılamadı. Yerel lisans süresi değiştirilmedi."})?;}
    inspect(&state)
}

async fn acknowledge(c:&Config,l:&License,receipt:&serde_json::Value)->Result<()>{
 if l.binding!="tpm-cng-v1"{return Ok(())}
 let token=receipt["ackToken"].as_str().ok_or("Alındı doğrulaması desteklenmiyor")?;
 let payload=receipt["payload"].as_str().ok_or("Alındı bilgisi eksik")?;
 let app_version=env!("CARGO_PKG_VERSION");
 let platform=std::env::consts::OS;
 let arch=std::env::consts::ARCH;
 let update_channel="stable";
 let hash=digest::digest(&digest::SHA256,format!("asmach-receipt:{payload}:{token}:{app_version}:{platform}:{arch}:{update_channel}").as_bytes());let mut challenge=[0u8;32];challenge.copy_from_slice(hash.as_ref());
 let identity=super::tpm::identity_challenge(false,Some(challenge))?;
 if identity.device_id!=l.device_id{return Err("Alındı kimliği uyuşmuyor".into())}
 let proof=serde_json::to_value(identity).map_err(err)?;
 let mut url=reqwest::Url::parse(&endpoint(c,l).ok_or("Bulut adresi yok")?).map_err(err)?;url.set_path("/ack");url.set_query(None);
 http_client()?.post(url).json(&serde_json::json!({"payload":payload,"ackToken":token,"publicKey":proof["publicKey"],"proof":proof["signature"],"client":{"appVersion":app_version,"platform":platform,"arch":arch,"updateChannel":update_channel}})).send().await.map_err(err)?.error_for_status().map_err(err)?;
 Ok(())
}

fn check_delay(success:bool)->std::time::Duration{std::time::Duration::from_secs(if success{1800}else{300})}
fn schedule_check(state:&Licensing,success:bool)->Result<()>{*state.next_check.lock().map_err(err)?=std::time::Instant::now()+check_delay(success);Ok(())}
pub fn start_monitor(app:tauri::AppHandle){
 std::thread::spawn(move||{
  let mut tick=std::time::Instant::now();let mut wall=now();let mut local=std::time::Instant::now();let mut previous=None;
  loop{
   std::thread::sleep(std::time::Duration::from_secs(5));
   let state=app.state::<Licensing>();let resumed=tick.elapsed().as_secs()>90||now().saturating_sub(wall)>90;
   tick=std::time::Instant::now();wall=now();
   let due=state.next_check.lock().map(|v|std::time::Instant::now()>=*v).unwrap_or(true);
   if !due&&!resumed&&local.elapsed().as_secs()<60{continue}
   local=std::time::Instant::now();
   let result=if due||resumed{tauri::async_runtime::block_on(check_online(&state))}else{inspect(&state)};
   match result {Ok(status)=>{let signature=serde_json::to_string(&status).unwrap_or_default();if previous.as_ref()!=Some(&signature)||due||resumed{let _=app.emit("license-status-changed",&status);previous=Some(signature);}},Err(_)=>{let _=app.emit("license-check-failed",());}}
  }
 });
}

#[cfg(test)]
mod tests {
 #[test] fn online_schedule_and_retry(){assert_eq!(super::check_delay(true).as_secs(),30*60);assert_eq!(super::check_delay(false).as_secs(),5*60);}
 use super::*;use ring::signature::KeyPair;
 #[test] fn activation_requires_both_signatures_and_matching_license(){
  let issuer=signature::Ed25519KeyPair::from_seed_unchecked(&[8;32]).unwrap();let cloud=signature::Ed25519KeyPair::from_seed_unchecked(&[9;32]).unwrap();
  let seal=|v:serde_json::Value,k:&signature::Ed25519KeyPair|{let b=serde_json::to_vec(&v).unwrap();Envelope{payload:STANDARD.encode(&b),signature:STANDARD.encode(k.sign(&b).as_ref()),activation:None}};
  let mut grant=seal(serde_json::json!({"version":2,"product":"asmach-inspection","licenseId":"qa","licenseNumber":"ASM-QA","deviceId":"","activationMode":"first-device","binding":"tpm-cng-v1","customer":"QA","issuedAt":100,"notBefore":100,"expiresAt":200}),&issuer);
  let ik=STANDARD.encode(issuer.public_key().as_ref());let sk=STANDARD.encode(cloud.public_key().as_ref());
  assert!(signed_license_with_status(&grant,&ik,&sk).is_err());
  let certificate=serde_json::json!({"version":1,"product":"asmach-activation","licenseId":"qa","deviceId":"a".repeat(64)});
  grant.activation=Some(Box::new(seal(certificate.clone(),&cloud)));assert_eq!(signed_license_with_status(&grant,&ik,&sk).unwrap().device_id,"a".repeat(64));
  grant.activation=Some(Box::new(seal(certificate.clone(),&issuer)));assert!(signed_license_with_status(&grant,&ik,&sk).is_err());
  let mut other=certificate;other["licenseId"]=serde_json::json!("another");grant.activation=Some(Box::new(seal(other,&cloud)));assert!(signed_license_with_status(&grant,&ik,&sk).is_err());
 }
 fn fixture()->(Envelope,String){let k=signature::Ed25519KeyPair::from_seed_unchecked(&[7;32]).unwrap();let p=serde_json::to_vec(&serde_json::json!({"version":1,"product":"asmach-inspection","licenseId":"test","deviceId":"pc","customer":"Test","issuedAt":100,"notBefore":100,"expiresAt":200})).unwrap();(Envelope{activation:None,payload:STANDARD.encode(&p),signature:STANDARD.encode(k.sign(&p).as_ref())},STANDARD.encode(k.public_key().as_ref()))}
 #[test] fn verifies_device_and_dates(){let(e,k)=fixture();assert!(validate(&e,&k,"pc",150).is_ok());assert!(validate(&e,&k,"other",150).is_err());assert!(validate(&e,&k,"pc",99).is_err());assert!(validate(&e,&k,"pc",200).is_err());}
 #[test] fn expired_license_receives_same_id_extension(){let(s,c)=state();let(e,k)=fixture();let old:License=signed(&e,&k).unwrap();assert!(!inspect_at(&s,&c,210).unwrap().valid);let key=signature::Ed25519KeyPair::from_seed_unchecked(&[7;32]).unwrap();let mut next=old.clone();next.revision=2;next.expires_at=400;let p=serde_json::to_vec(&next).unwrap();let update=Envelope{activation:None,payload:STANDARD.encode(&p),signature:STANDARD.encode(key.sign(&p).as_ref())};apply_update(&s.db.lock().unwrap(),&c,&old,&update).unwrap();assert!(inspect_at(&s,&c,211).unwrap().valid);let stored:Envelope=serde_json::from_str(&get(&s.db.lock().unwrap(),"license").unwrap().unwrap()).unwrap();let renewed:License=signed(&stored,&k).unwrap();assert_eq!(renewed.license_id,old.license_id);assert_eq!(renewed.expires_at,400);}
 #[test] fn rejects_tampering(){let(mut e,k)=fixture();e.payload=STANDARD.encode(b"{}");assert!(validate(&e,&k,"pc",150).is_err());}
 #[test] fn offline_code_roundtrip_and_prefix_validation(){let(e,_)=fixture();let json=serde_json::to_string(&e).unwrap();let code=format!("{OFFLINE_CODE_PREFIX}{}",URL_SAFE_NO_PAD.encode(json.as_bytes()));assert_eq!(decode_offline_code(&code).unwrap(),json);assert!(decode_offline_code("ASM-OFF1-broken!").is_err());assert!(decode_offline_code("plain-guid").is_err());}
 #[test] fn missing_license_fails_closed(){let db=rusqlite::Connection::open_in_memory().unwrap();db.execute_batch("CREATE TABLE license_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);").unwrap();let s=Licensing{db:Mutex::new(db),device:"pc".into(),checking:std::sync::atomic::AtomicBool::new(false),clock:Mutex::new((std::time::Instant::now(),now())),next_check:Mutex::new(std::time::Instant::now()+std::time::Duration::from_secs(1800))};assert!(!inspect(&s).unwrap().valid);}
 fn state()->(Licensing,Config) {let(e,k)=fixture();let db=rusqlite::Connection::open_in_memory().unwrap();db.execute_batch("CREATE TABLE license_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE revoked(id TEXT PRIMARY KEY,certificate TEXT NOT NULL);").unwrap();put(&db,"license",&serde_json::to_string(&e).unwrap()).unwrap();(Licensing{db:Mutex::new(db),device:"pc".into(),checking:std::sync::atomic::AtomicBool::new(false),clock:Mutex::new((std::time::Instant::now(),now())),next_check:Mutex::new(std::time::Instant::now()+std::time::Duration::from_secs(1800))},Config{license_public_key:k.clone(),status_public_key:k,endpoint:String::new(),require_tpm:false})}
 #[test] fn offline_expiry_and_corruption(){let(s,c)=state();assert!(inspect_at(&s,&c,150).unwrap().valid);assert!(!inspect_at(&s,&c,200).unwrap().valid);{put(&s.db.lock().unwrap(),"license","invalid").unwrap();}assert!(!inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn detects_clock_rollback(){let(s,c)=state();{put(&s.db.lock().unwrap(),"last_time","1000").unwrap();}assert!(!inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn expired_license_cannot_reopen_by_rolling_clock_back(){let(s,c)=state();assert!(!inspect_at(&s,&c,210).unwrap().valid);assert!(!inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn signed_revocation_survives_offline(){let(s,c)=state();let k=signature::Ed25519KeyPair::from_seed_unchecked(&[7;32]).unwrap();let p=serde_json::to_vec(&serde_json::json!({"version":1,"product":"asmach-inspection","licenseId":"test","deviceId":"pc","nonce":"old request","status":"revoked","issuedAt":150})).unwrap();let e=Envelope{activation:None,payload:STANDARD.encode(&p),signature:STANDARD.encode(k.sign(&p).as_ref())};s.db.lock().unwrap().execute("INSERT INTO revoked VALUES(?1,?2)",params!["test",serde_json::to_string(&e).unwrap()]).unwrap();let r=inspect_at(&s,&c,150).unwrap();assert!(!r.valid);assert!(r.reason.contains("devre dışı"));}
 #[test] fn configured_keys_have_valid_length(){let c=config();assert_eq!(STANDARD.decode(c.license_public_key).unwrap().len(),32);assert_eq!(STANDARD.decode(c.status_public_key).unwrap().len(),32);}
 #[test] fn signed_revision_shortens_expiry_and_rejects_rollback(){let(s,c)=state();let(e,k)=fixture();let old:License=signed(&e,&k).unwrap();let key=signature::Ed25519KeyPair::from_seed_unchecked(&[7;32]).unwrap();let mut next=old.clone();next.revision=2;next.expires_at=140;let p=serde_json::to_vec(&next).unwrap();let update=Envelope{activation:None,payload:STANDARD.encode(&p),signature:STANDARD.encode(key.sign(&p).as_ref())};{apply_update(&s.db.lock().unwrap(),&c,&old,&update).unwrap();}assert!(!inspect_at(&s,&c,150).unwrap().valid);{let db=s.db.lock().unwrap();apply_update(&db,&c,&next,&e).unwrap();assert_eq!(get(&db,"revision:test").unwrap().unwrap(),"2");put(&db,"license",&serde_json::to_string(&e).unwrap()).unwrap();}assert!(!inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn unsigned_revision_cannot_extend(){let(s,c)=state();let(mut e,k)=fixture();let old:License=signed(&e,&k).unwrap();e.payload=STANDARD.encode(b"{}");assert!(apply_update(&s.db.lock().unwrap(),&c,&old,&e).is_err());assert!(inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn missing_active_record_stays_denied_offline(){let(s,c)=state();let key=signature::Ed25519KeyPair::from_seed_unchecked(&[7;32]).unwrap();let p=serde_json::to_vec(&serde_json::json!({"version":1,"product":"asmach-inspection","licenseId":"test","deviceId":"pc","nonce":"request","status":"inactive","issuedAt":150})).unwrap();let e=Envelope{activation:None,payload:STANDARD.encode(&p),signature:STANDARD.encode(key.sign(&p).as_ref())};{put(&s.db.lock().unwrap(),"denied:test",&serde_json::to_string(&e).unwrap()).unwrap();}let r=inspect_at(&s,&c,150).unwrap();assert!(!r.valid);assert!(r.reason.contains("aktif listede"));{put(&s.db.lock().unwrap(),"denied:test","broken").unwrap();}assert!(!inspect_at(&s,&c,150).unwrap().valid);}
 #[test] fn https_client_constructs(){assert!(http_client().is_ok());}
 #[test] fn windows_device_id_is_stable(){#[cfg(windows)]{let a=device_id().unwrap();assert_eq!(a.len(),64);assert_eq!(a,device_id().unwrap());}}
}
