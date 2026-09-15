use super::{err,Result};
use base64::{engine::general_purpose::STANDARD,Engine};
use ring::{digest,rand::{SecureRandom,SystemRandom},signature};
#[derive(serde::Deserialize,serde::Serialize)]
#[serde(rename_all="camelCase")]
pub struct Identity {pub device_id:String,binding:String,public_key:String,challenge:String,signature:String}
pub fn identity(create:bool)->Result<Identity>{identity_challenge(create,None)}
pub fn identity_challenge(create:bool,provided:Option<[u8;32]>)->Result<Identity>{
 #[cfg(windows)] {
  use std::os::windows::process::CommandExt;
  let mut challenge=[0u8;32];if let Some(value)=provided{challenge=value;}else{SystemRandom::new().fill(&mut challenge).map_err(|_|"Güvenli rastgele veri üretilemedi")?;}
  let exe=std::path::PathBuf::from(std::env::var_os("SystemRoot").ok_or("Windows klasörü bulunamadı")?).join("System32/WindowsPowerShell/v1.0/powershell.exe");
  let script=format!("& {{ {} }} -Create:${}",include_str!("../../scripts/tpm-license-identity.ps1"),if create{"true"}else{"false"});
  let mut child=std::process::Command::new(exe).args(["-NoProfile","-NonInteractive","-Command",&script]).env("ASMACH_TPM_CHALLENGE",STANDARD.encode(challenge)).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::null()).creation_flags(0x08000000).spawn().map_err(err)?;
  let deadline=std::time::Instant::now()+std::time::Duration::from_secs(12);
  loop {if child.try_wait().map_err(err)?.is_some(){break}if std::time::Instant::now()>=deadline{let _=child.kill();let _=child.wait();return Err("TPM doğrulaması zaman aşımına uğradı. Yeniden deneyin.".into())}std::thread::sleep(std::time::Duration::from_millis(50));}
  let output=child.wait_with_output().map_err(err)?;
  if !output.status.success(){return Err("TPM lisans anahtarı kullanılamadı. TPM kimliğini oluşturun; TPM hazır ve aynı Windows hesabı açık olmalı. TPM'yi sıfırlamayın.".into())}
  let identity:Identity=serde_json::from_slice(&output.stdout).map_err(err)?;
  let public=STANDARD.decode(&identity.public_key).map_err(err)?;
  if public.len()!=72||&public[..4]!=b"ECS1"||public[4..8]!=[32,0,0,0]||identity.binding!="tpm-cng-v1"||STANDARD.decode(&identity.challenge).map_err(err)?!=challenge{return Err("TPM anahtar kanıtı geçersiz.".into())}
  let mut sec1=vec![4];sec1.extend_from_slice(&public[8..]);
  signature::UnparsedPublicKey::new(&signature::ECDSA_P256_SHA256_FIXED,sec1).verify(&challenge,&STANDARD.decode(&identity.signature).map_err(err)?).map_err(|_|"TPM imza kanıtı doğrulanamadı")?;
  let id:String=digest::digest(&digest::SHA256,&public).as_ref().iter().map(|b|format!("{b:02x}")).collect();
  if id!=identity.device_id{return Err("TPM bilgisayar kimliği uyuşmuyor.".into())}Ok(identity)
 }
 #[cfg(not(windows))] {let _=create;Err("Windows TPM sağlayıcısı gerekli.".into())}
}
#[cfg(test)]mod tests {#[test]#[ignore="Requires the real Windows user's provisioned TPM key"]fn platform_key_signs_challenge(){assert!(super::identity(false).is_ok());}}
