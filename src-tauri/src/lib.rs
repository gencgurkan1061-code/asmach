use std::{collections::HashMap, fs, io::Write, path::{Path, PathBuf}, sync::{Mutex, atomic::{AtomicBool, Ordering}}};
use base64::{Engine, engine::general_purpose::STANDARD};
use rusqlite::{Connection, params, OptionalExtension};
use serde::Serialize;
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
pub mod licensing;
mod updater;
mod tpm;

type Result<T> = std::result::Result<T, String>;
const MAX_FILE: usize = 256 * 1024 * 1024;
struct DesktopState {
    database: Mutex<Connection>,
    targets: Mutex<HashMap<String, PathBuf>>,
    print_files: Mutex<Vec<tempfile::TempPath>>,
    allow_close: AtomicBool,
}
fn err(e: impl std::fmt::Display) -> String { e.to_string() }
fn database(path: &Path) -> rusqlite::Result<Connection> {
    let db = Connection::open(path)?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery(id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, saved_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
      PRAGMA user_version=1;")?;
    Ok(db)
}
fn validate_key(key: &str) -> Result<()> {
    if key.len() > 160 || !(key.starts_with("asmach.") || key.starts_with("asmach-")) { return Err("Geçersiz tercih anahtarı".into()); }
    Ok(())
}
fn decode(data: &str) -> Result<Vec<u8>> {
    if data.len() > (MAX_FILE * 4 / 3 + 4) { return Err("Dosya 256 MB sınırını aşıyor.".into()); }
    STANDARD.decode(data).map_err(err)
}
fn safe_name(name: &str) -> Result<&str> {
    if name.is_empty() || name.len() > 240 || name.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c)) || name.ends_with([' ', '.']) { return Err("Geçersiz dosya adı".into()); }
    let ext = Path::new(name).extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    if !["json", "asmach", "pdf", "xlsx", "xltx", "csv", "png", "jpg", "jpeg"].contains(&ext.as_str()) { return Err("Bu dosya türü dışa aktarılamaz.".into()); }
    Ok(name)
}
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("Kayıt klasörü bulunamadı")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(err)?;
    temp.write_all(bytes).map_err(err)?;
    temp.as_file().sync_all().map_err(err)?;
    temp.persist(path).map_err(err)?;
    Ok(())
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct Bootstrap { preferences: HashMap<String,String>, data_directory: String, version: String, autostart: bool, updater_configured: bool }
#[tauri::command]
async fn desktop_bootstrap(app: tauri::AppHandle, state: State<'_, DesktopState>) -> Result<Bootstrap> {
    let db = state.database.lock().map_err(err)?;
    let mut query = db.prepare("SELECT key,value FROM preferences").map_err(err)?;
    let preferences = query.query_map([], |row| Ok((row.get::<_,String>(0)?, row.get::<_,String>(1)?))).map_err(err)?.collect::<std::result::Result<HashMap<_,_>,_>>().map_err(err)?;
    Ok(Bootstrap {preferences, data_directory: app.path().app_data_dir().map_err(err)?.display().to_string(), version: app.package_info().version.to_string(), autostart: app.autolaunch().is_enabled().map_err(err)?, updater_configured: updater::configured()})
}
#[tauri::command]
async fn preference_set(state: State<'_, DesktopState>, key: String, value: Option<String>) -> Result<()> {
    validate_key(&key)?;
    if value.as_ref().is_some_and(|v| v.len()>1024*1024) { return Err("Tercih boyutu sınırı aşıldı".into()); }
    let db = state.database.lock().map_err(err)?;
    if let Some(value)=value { db.execute("INSERT INTO preferences(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value]).map_err(err)?; }
    else { db.execute("DELETE FROM preferences WHERE key=?1",params![key]).map_err(err)?; }
    Ok(())
}
#[tauri::command]
async fn recovery_get(state: State<'_, DesktopState>) -> Result<Option<serde_json::Value>> {
    let db = state.database.lock().map_err(err)?;
    let record: Option<(String,String)> = db.query_row("SELECT payload,saved_at FROM recovery ORDER BY id DESC LIMIT 1",[],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(err)?;
    record.map(|(payload,at)|Ok(serde_json::json!({"payload":serde_json::from_str::<serde_json::Value>(&payload).map_err(err)?,"at":at}))).transpose()
}
#[tauri::command]
async fn recovery_put(state: State<'_, DesktopState>, payload: String) -> Result<()> {
    if payload.len()>MAX_FILE { return Err("Kurtarma kopyası çok büyük. Projeyi dosyaya kaydedin.".into()); }
    let parsed: serde_json::Value = serde_json::from_str(&payload).map_err(err)?;
    if parsed.get("format").and_then(|v|v.as_str()) != Some("asmach-ballooning-project") { return Err("Geçersiz proje verisi".into()); }
    let mut db=state.database.lock().map_err(err)?;
    let tx=db.transaction().map_err(err)?;
    tx.execute("INSERT INTO recovery(payload) VALUES(?1)",params![payload]).map_err(err)?;
    tx.execute("DELETE FROM recovery WHERE id NOT IN (SELECT id FROM recovery ORDER BY id DESC LIMIT 2)",[]).map_err(err)?;
    tx.commit().map_err(err)
}
#[derive(Serialize)]
struct NativeFile { name: String, mime: String, data: String, #[serde(rename="nativeToken")] native_token: Option<String> }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct TemplateEntry { id: String, name: String }

fn template_directory(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir=app.path().app_data_dir().map_err(err)?.join("templates");
    fs::create_dir_all(&dir).map_err(err)?;Ok(dir)
}
fn template_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf> {
    safe_name(id)?;
    if !id.to_ascii_lowercase().ends_with(".xltx") || Path::new(id).file_name().and_then(|n|n.to_str())!=Some(id) {return Err("Geçersiz XLTX şablon kimliği".into())}
    Ok(template_directory(app)?.join(id))
}
fn template_entry(path: &Path) -> Result<TemplateEntry> {
    let id=path.file_name().and_then(|n|n.to_str()).ok_or("Geçersiz şablon adı")?.to_string();
    let name=path.file_stem().and_then(|n|n.to_str()).ok_or("Geçersiz şablon adı")?.to_string();
    Ok(TemplateEntry{id,name})
}
fn validate_xltx(bytes: &[u8]) -> Result<()> {
    if bytes.len()>20*1024*1024 {return Err("Şablon en fazla 20 MB olabilir.".into())}
    if bytes.len()<4 || bytes[..4]!=[0x50,0x4b,0x03,0x04] {return Err("Geçerli bir XLTX dosyası seçin.".into())}
    Ok(())
}
#[tauri::command]
async fn open_file(app: tauri::AppHandle, state: State<'_, DesktopState>, kind: String) -> Result<Option<NativeFile>> {
    if kind=="drawing" { licensing::require(&app)?; }
    let picker=app.dialog().file();
    let path=match kind.as_str() {
        "project" => picker.add_filter("ASMach Projesi", &["json","asmach"]).blocking_pick_file(),
        "drawing" => picker.add_filter("Teknik resim", &["pdf","png","jpg","jpeg","webp","bmp"]).blocking_pick_file(),
        _ => return Err("Geçersiz açma işlemi".into())
    };
    let Some(path)=path else {return Ok(None)};
    let path=path.into_path().map_err(err)?;
    if fs::metadata(&path).map_err(err)?.len()>MAX_FILE as u64 {return Err("Dosya 256 MB sınırını aşıyor.".into())}
    let bytes=fs::read(&path).map_err(err)?;
    let ext=path.extension().and_then(|v|v.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime=match ext.as_str(){"pdf"=>"application/pdf","json"|"asmach"=>"application/json","png"=>"image/png","jpg"|"jpeg"=>"image/jpeg","webp"=>"image/webp","bmp"=>"image/bmp",_=>return Err("Desteklenmeyen dosya".into())};
    let native_token=if kind=="project" {let mut targets=state.targets.lock().map_err(err)?;if targets.len()>=32{return Err("Çok fazla açık kayıt hedefi".into())}let token=uuid::Uuid::new_v4().to_string();targets.insert(token.clone(),path.clone());Some(token)}else{None};
    Ok(Some(NativeFile{name:path.file_name().unwrap_or_default().to_string_lossy().into(),mime:mime.into(),data:STANDARD.encode(bytes),native_token}))
}
#[tauri::command]
async fn choose_save_target(app: tauri::AppHandle, state: State<'_, DesktopState>, name: String) -> Result<Option<String>> {
    safe_name(&name)?;
    if !name.ends_with(".asmach") && !name.ends_with(".json") { licensing::require(&app)?; }
    let ext=Path::new(&name).extension().unwrap().to_string_lossy().into_owned();
    let directory: Option<String>=state.database.lock().map_err(err)?.query_row("SELECT value FROM preferences WHERE key='asmach.desktop.outputDirectory'",[],|r|r.get(0)).optional().map_err(err)?;
    let label=match ext.as_str(){"xlsx"=>"Excel çalışma kitabı (*.xlsx)","xltx"=>"Excel şablonu (*.xltx)","pdf"=>"PDF belgesi (*.pdf)","csv"=>"CSV tablosu (*.csv)","asmach"|"json"=>"ASMach projesi",_=>"Görüntü dosyası"};
    let mut picker=app.dialog().file().set_file_name(&name).add_filter(label, &[ext.as_str()]);
    if let Some(dir)=directory.filter(|d|Path::new(d).is_dir()){picker=picker.set_directory(dir);}
    let Some(path)=picker.blocking_save_file() else {return Ok(None)};
    let mut path=path.into_path().map_err(err)?;
    if path.extension().is_none(){path.set_extension(&ext);}
    if !path.extension().and_then(|s|s.to_str()).is_some_and(|s|s.eq_ignore_ascii_case(&ext)){return Err(format!("Bu çıktı .{} uzantısıyla kaydedilmelidir.",ext))}
    safe_name(path.file_name().and_then(|n|n.to_str()).ok_or("Geçersiz dosya adı")?)?;
    let mut targets=state.targets.lock().map_err(err)?;
    if targets.len()>=32 {return Err("Çok fazla bekleyen kayıt işlemi".into())}
    let token=uuid::Uuid::new_v4().to_string();targets.insert(token.clone(),path);Ok(Some(token))
}
#[tauri::command]
async fn write_target(app: tauri::AppHandle, state: State<'_, DesktopState>, token: String, data: String, open_after: Option<bool>) -> Result<Option<String>> {
    let bytes=decode(&data)?;
    let path={let mut targets=state.targets.lock().map_err(err)?;let path=targets.get(&token).cloned().ok_or("Kayıt izni geçersiz")?;if !matches!(path.extension().and_then(|s|s.to_str()),Some("asmach"|"json")){targets.remove(&token);}path};
    if !matches!(path.extension().and_then(|s|s.to_str()),Some("asmach"|"json")) { licensing::require(&app)?; }
    let open=open_after.unwrap_or(false);
    if open {let ext=path.extension().and_then(|s|s.to_str()).unwrap_or("").to_ascii_lowercase();if !matches!(ext.as_str(),"xlsx"|"pdf"|"zip") {return Err("Yalnızca Excel, PDF ve ZIP raporları kayıt sonrası açılabilir.".into())}if (ext=="pdf"&&!bytes.starts_with(b"%PDF-"))||(ext!="pdf"&&!bytes.starts_with(b"PK")){return Err("Rapor dosya biçimi geçersiz.".into())}}
    atomic_write(&path,&bytes)?;
    #[cfg(windows)] if open {if shell_pdf(&path,false).is_err(){return Ok(Some("Dosya kaydedildi ancak açılamadı. Dosya türünün varsayılan uygulamasını kontrol edin.".into()))}}
    Ok(None)
}
#[tauri::command]
async fn choose_output_directory(app: tauri::AppHandle, state: State<'_, DesktopState>) -> Result<Option<String>> {
    let Some(path)=app.dialog().file().blocking_pick_folder() else {return Ok(None)};
    let path=path.into_path().map_err(err)?.display().to_string();
    state.database.lock().map_err(err)?.execute("INSERT INTO preferences(key,value) VALUES('asmach.desktop.outputDirectory',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![path]).map_err(err)?;
    Ok(Some(path))
}
#[tauri::command]
async fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool> {
    if enabled {app.autolaunch().enable().map_err(err)?;}else{app.autolaunch().disable().map_err(err)?;}
    app.autolaunch().is_enabled().map_err(err)
}
#[tauri::command]
async fn confirm_close(app: tauri::AppHandle) -> bool {
    app.dialog().message("Projenizde dosyaya kaydedilmemiş değişiklikler var. Yalnızca yerel kurtarma kopyasıyla çıkılsın mı?").title("Kaydedilmemiş proje").buttons(MessageDialogButtons::OkCancelCustom("Çık".into(),"Çalışmaya dön".into())).blocking_show()
}
#[tauri::command]
fn close_application(app: tauri::AppHandle, state: State<'_, DesktopState>) -> Result<()> {
    if let Some(saved)=app.try_state::<StartupWindow>() {if !saved.finished.load(Ordering::SeqCst){if let Some(window)=app.get_webview_window("main"){let _=window.set_size(saved.size);let _=window.set_position(saved.position);if saved.maximized{let _=window.maximize();}}}}
    state.allow_close.store(true,Ordering::SeqCst);
    app.exit(0);
    Ok(())
}
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) -> Result<()> {app.get_webview_window("main").ok_or("Pencere bulunamadı")?.hide().map_err(err)}

#[cfg(windows)]
fn shell_pdf(path: &Path, print: bool) -> Result<()> {
    use std::os::windows::ffi::OsStrExt;
    let file:Vec<u16>=path.as_os_str().encode_wide().chain(Some(0)).collect();
    let verb:Vec<u16>=if print{"print"}else{"open"}.encode_utf16().chain(Some(0)).collect();
    // Only app-created PDFs or validated report paths from one-use save capabilities.
    let code=unsafe{windows_sys::Win32::UI::Shell::ShellExecuteW(std::ptr::null_mut(),verb.as_ptr(),file.as_ptr(),std::ptr::null(),std::ptr::null(),1)} as isize;
    if code<=32 {Err("Windows PDF uygulaması işlemi açamadı. PDF okuyucusu ve varsayılan yazıcı ayarlarını kontrol edin.".into())}else{Ok(())}
}
#[tauri::command]
async fn native_pdf(app: tauri::AppHandle, state: State<'_, DesktopState>, data: String, print: bool) -> Result<bool> {
    licensing::require(&app)?;
    let bytes=decode(&data)?;if !bytes.starts_with(b"%PDF-"){return Err("Geçersiz PDF".into())}
    if print && !app.dialog().message("Bu PDF Windows'taki varsayılan PDF uygulaması üzerinden yazdırılacak. Varsayılan yazıcıya gönderilebilir. Devam edilsin mi?").title("PDF yazdır").buttons(MessageDialogButtons::OkCancel).blocking_show(){return Ok(false)}
    let dir=app.path().app_cache_dir().map_err(err)?.join("print");fs::create_dir_all(&dir).map_err(err)?;
    let mut file=tempfile::Builder::new().prefix("asmach-").suffix(".pdf").tempfile_in(dir).map_err(err)?;file.write_all(&bytes).map_err(err)?;file.as_file().sync_all().map_err(err)?;
    let path=file.into_temp_path();
    #[cfg(windows)] shell_pdf(&path,print)?;
    state.print_files.lock().map_err(err)?.push(path);Ok(true)
}
#[tauri::command]
async fn native_excel_open(app: tauri::AppHandle) -> Result<bool> {
    licensing::require(&app)?;
    let Some(file)=app.dialog().file().add_filter("Excel şablonu", &["xlsx","xltx"]).blocking_pick_file() else {return Ok(false)};
    let path=file.into_path().map_err(err)?;
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        // Fixed script; the selected file is passed as data, never interpolated into code.
        let script="$ErrorActionPreference='Stop'; $excel=New-Object -ComObject Excel.Application; $excel.AutomationSecurity=3; $excel.AskToUpdateLinks=$false; try { $book=$excel.Workbooks.Open($env:ASMACH_EXCEL_TEMPLATE,0,$false); $excel.Visible=$true; $excel.UserControl=$true } catch { $excel.Quit(); throw }";
        let result=std::process::Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",script]).env("ASMACH_EXCEL_TEMPLATE",&path).creation_flags(0x08000000).output().map_err(err)?;
        if !result.status.success(){return Err("Microsoft Excel açılamadı. Excel masaüstü uygulamasının kurulu olduğunu ve dosyanın erişilebilir olduğunu kontrol edin.".into())}
        Ok(true)
    }
    #[cfg(not(windows))] {let _=path;Err("Excel masaüstü bağlantısı Windows gerektirir.".into())}
}
#[tauri::command]
async fn native_excel_preview(app:tauri::AppHandle,data:String,paper:String,landscape:bool)->Result<String>{
 licensing::require(&app)?;let bytes=decode(&data)?;if !bytes.starts_with(b"PK"){return Err("Geçersiz Excel belgesi".into())}
 if !["a4","a3","letter","template"].contains(&paper.as_str()){return Err("Geçersiz kağıt boyutu".into())}
 tauri::async_runtime::spawn_blocking(move||->Result<String>{
  #[cfg(windows)] {use std::os::windows::process::CommandExt;
   let dir=tempfile::Builder::new().prefix("asmach-excel-preview-").tempdir().map_err(err)?;let input=dir.path().join("report.xlsx");let output=dir.path().join("preview.pdf");fs::write(&input,bytes).map_err(err)?;
   let script="$ErrorActionPreference='Stop'; $excel=$null; $book=$null; try { $excel=New-Object -ComObject Excel.Application; $excel.Visible=$false; $excel.DisplayAlerts=$false; $excel.EnableEvents=$false; $excel.AutomationSecurity=3; $excel.AskToUpdateLinks=$false; $book=$excel.Workbooks.Open($env:ASMACH_PREVIEW_INPUT,0,$true); foreach($sheet in $book.Worksheets){if([int]$env:ASMACH_PREVIEW_PAPER -gt 0){$sheet.PageSetup.PaperSize=[int]$env:ASMACH_PREVIEW_PAPER}; if([int]$env:ASMACH_PREVIEW_ORIENTATION -gt 0){$sheet.PageSetup.Orientation=[int]$env:ASMACH_PREVIEW_ORIENTATION}}; $book.ExportAsFixedFormat(0,$env:ASMACH_PREVIEW_OUTPUT) } finally { if($book){$book.Close($false);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)};if($excel){$excel.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)} }";
   let exe=std::env::var_os("SystemRoot").map(std::path::PathBuf::from).ok_or("Windows klasörü bulunamadı")?.join("System32/WindowsPowerShell/v1.0/powershell.exe");
   let result=std::process::Command::new(exe).args(["-NoProfile","-NonInteractive","-Command",script]).env("ASMACH_PREVIEW_INPUT",&input).env("ASMACH_PREVIEW_OUTPUT",&output).env("ASMACH_PREVIEW_PAPER",match paper.as_str(){"template"=>"0","a3"=>"8","letter"=>"1",_=>"9"}).env("ASMACH_PREVIEW_ORIENTATION",if paper=="template"{"0"}else if landscape{"2"}else{"1"}).creation_flags(0x08000000).output().map_err(err)?;
   if !result.status.success(){return Err("Yazdırma önizlemesi oluşturulamadı. Microsoft Excel masaüstü uygulamasının kurulu olduğunu kontrol edin; dosyayı Excel olarak kaydedebilirsiniz.".into())}
   let pdf=fs::read(output).map_err(err)?;if !pdf.starts_with(b"%PDF-"){return Err("Excel PDF önizlemesi geçersiz".into())}Ok(STANDARD.encode(pdf))
  }
  #[cfg(not(windows))] {let _=(bytes,paper,landscape);Err("Excel yazdırma önizlemesi Windows ve Microsoft Excel gerektirir.".into())}
 }).await.map_err(err)?
}
#[tauri::command]
async fn native_template_list(app: tauri::AppHandle) -> Result<Vec<TemplateEntry>> {
    licensing::require(&app)?;let mut items=vec![];
    for entry in fs::read_dir(template_directory(&app)?).map_err(err)? {
        let path=entry.map_err(err)?.path();
        if path.extension().and_then(|v|v.to_str()).is_some_and(|v|v.eq_ignore_ascii_case("xltx")){items.push(template_entry(&path)?);}
    }
    items.sort_by(|a,b|a.name.to_lowercase().cmp(&b.name.to_lowercase()));Ok(items)
}
#[tauri::command]
async fn native_template_import(app: tauri::AppHandle) -> Result<Option<TemplateEntry>> {
    licensing::require(&app)?;
    let Some(file)=app.dialog().file().add_filter("Excel şablonu", &["xltx"]).blocking_pick_file() else {return Ok(None)};
    let source=file.into_path().map_err(err)?;
    if !source.extension().and_then(|value|value.to_str()).is_some_and(|value|value.eq_ignore_ascii_case("xltx")){return Err("Yalnızca XLTX şablonları eklenebilir.".into())}
    let bytes=fs::read(&source).map_err(err)?;validate_xltx(&bytes)?;
    let original=source.file_name().and_then(|v|v.to_str()).ok_or("Geçersiz şablon adı")?;safe_name(original)?;
    let dir=template_directory(&app)?;let mut name=original.to_string();let mut target=dir.join(&name);let stem=source.file_stem().and_then(|v|v.to_str()).unwrap_or("Şablon");
    for index in 2..1000 {if !target.exists(){break}name=format!("{} ({index}).xltx",stem);target=dir.join(&name);}
    if target.exists(){return Err("Aynı adlı çok fazla şablon var.".into())}atomic_write(&target,&bytes)?;Ok(Some(template_entry(&target)?))
}
#[tauri::command]
async fn native_template_store(app: tauri::AppHandle, name: String, data: String) -> Result<TemplateEntry> {
    licensing::require(&app)?;let filename=if name.to_ascii_lowercase().ends_with(".xltx"){name}else{format!("{name}.xltx")};safe_name(&filename)?;
    let path=template_path(&app,&filename)?;if !path.exists(){let bytes=decode(&data)?;validate_xltx(&bytes)?;atomic_write(&path,&bytes)?;}template_entry(&path)
}
#[tauri::command]
async fn native_template_read(app: tauri::AppHandle, id: String) -> Result<NativeFile> {
    licensing::require(&app)?;let path=template_path(&app,&id)?;let bytes=fs::read(&path).map_err(|_|"XLTX şablonu bulunamadı".to_string())?;validate_xltx(&bytes)?;
    Ok(NativeFile{name:id,mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.template".into(),data:STANDARD.encode(bytes),native_token:None})
}
#[tauri::command]
async fn native_template_delete(app: tauri::AppHandle, id: String) -> Result<()> {
    licensing::require(&app)?;let path=template_path(&app,&id)?;if path.exists(){fs::remove_file(path).map_err(err)?;}Ok(())
}
#[tauri::command]
async fn native_template_editor(app: tauri::AppHandle, template_id: Option<String>, fields: Vec<(String,String)>) -> Result<bool> {
    licensing::require(&app)?;
    if fields.is_empty() || fields.len()>200 || fields.iter().any(|(key,label)| key.len()>100 || label.len()>200 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c=='.' || c=='_')) {return Err("Geçersiz şablon alanları".into())}
    let path=if let Some(id)=template_id {let p=template_path(&app,&id)?;if !p.is_file(){return Err("Düzenlenecek XLTX şablonu bulunamadı".into())}p}else{PathBuf::new()};
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("powershell.exe").args(["-NoProfile","-STA","-NonInteractive","-Command",include_str!("excel-template-editor.ps1")])
            .env("ASMACH_EXCEL_TEMPLATE",path).env("ASMACH_EXCEL_FIELDS",serde_json::to_string(&fields).map_err(err)?)
            .creation_flags(0x08000000).spawn().map_err(err)?;
        Ok(true)
    }
    #[cfg(not(windows))] {let _=(path,fields);Err("Excel şablon editörü Windows gerektirir".into())}
}
#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<updater::UpdateInfo>> {updater::check(&app.package_info().version.to_string()).await}
#[tauri::command]
async fn install_update(app:tauri::AppHandle,state:State<'_,DesktopState>,version:String)->Result<()>{let installer=updater::download_and_stage(&app,&version).await?;updater::launch_after_exit(&installer)?;state.allow_close.store(true,Ordering::SeqCst);app.exit(0);Ok(())}
struct StartupWindow {size:tauri::PhysicalSize<u32>,position:tauri::PhysicalPosition<i32>,maximized:bool,fullscreen:bool,finished:AtomicBool}
#[tauri::command]
fn license_window_stage(app:tauri::AppHandle,stage:String)->Result<()> {
    let window=app.get_webview_window("main").ok_or("Pencere bulunamadı")?;let saved=app.state::<StartupWindow>();
    if saved.finished.load(Ordering::SeqCst){return Ok(())}
    match stage.as_str(){
      "checking"=>{},
      "entry"=>{window.set_resizable(true).map_err(err)?;window.set_min_size(Some(tauri::LogicalSize::new(640.,600.))).map_err(err)?;window.set_size(tauri::LogicalSize::new(760.,720.)).map_err(err)?;window.center().map_err(err)?;window.set_title("ASMach · Lisans Etkinleştirme").map_err(err)?;window.show().map_err(err)?;window.set_focus().map_err(err)?;},
      "ready"=>{licensing::require(&app)?;window.set_resizable(true).map_err(err)?;window.set_min_size(Some(tauri::LogicalSize::new(1000.,700.))).map_err(err)?;window.set_size(saved.size).map_err(err)?;window.set_position(saved.position).map_err(err)?;if saved.maximized{window.maximize().map_err(err)?;}if saved.fullscreen{window.set_fullscreen(true).map_err(err)?;}window.set_title("ASMach Inspection").map_err(err)?;window.show().map_err(err)?;window.set_focus().map_err(err)?;saved.finished.store(true,Ordering::SeqCst);},
      _=>return Err("Geçersiz açılış aşaması".into())
    }Ok(())
}
pub fn run() {
    tauri::Builder::default()
      .plugin(tauri_plugin_dialog::init())
      .plugin(tauri_plugin_autostart::Builder::new().build())
      .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE).build())
      .setup(|app| {
          if let Some(window)=app.get_webview_window("main") {
              if let Some(icon)=app.default_window_icon() { window.set_icon(icon.clone())?; }
              app.manage(StartupWindow{size:window.inner_size()?,position:window.outer_position()?,maximized:window.is_maximized()?,fullscreen:window.is_fullscreen()?,finished:AtomicBool::new(false)});
              window.set_fullscreen(false)?;window.unmaximize()?;
          }
          let dir=app.path().app_data_dir()?;fs::create_dir_all(&dir)?;
          licensing::setup(app.handle()).map_err(std::io::Error::other)?;
          app.manage(DesktopState{database:Mutex::new(database(&dir.join("workspace.sqlite3"))?),targets:Mutex::new(HashMap::new()),print_files:Mutex::new(vec![]),allow_close:AtomicBool::new(false)});
          licensing::start_monitor(app.handle().clone());
          let open=tauri::menu::MenuItem::with_id(app,"show","ASMach'i göster",true,None::<&str>)?;
          let quit=tauri::menu::MenuItem::with_id(app,"quit","Çıkış",true,None::<&str>)?;
          let menu=tauri::menu::Menu::with_items(app,&[&open,&quit])?;
          tauri::tray::TrayIconBuilder::new().icon(app.default_window_icon().unwrap().clone()).tooltip("ASMach Inspection").menu(&menu).on_menu_event(|app,event|{
              if let Some(window)=app.get_webview_window("main") {match event.id.as_ref(){"show"=>{let _=window.show();let _=window.unminimize();let _=window.set_focus();},"quit"=>{let _=window.show();let _=window.emit("desktop-close-request",());},_=>{}}}
          }).build(app)?;
          Ok(())
      })
      .on_window_event(|window,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event {if !window.state::<DesktopState>().allow_close.load(Ordering::SeqCst){api.prevent_close();let _=window.emit("desktop-close-request",());}}})
      .invoke_handler(tauri::generate_handler![license_window_stage,licensing::license_activate,licensing::license_enable_offline,licensing::license_offline_activate,licensing::license_request_create,licensing::license_discover,licensing::license_tpm_identity,licensing::license_status,licensing::license_import,licensing::license_check_online,desktop_bootstrap,preference_set,recovery_get,recovery_put,open_file,choose_save_target,write_target,choose_output_directory,set_autostart,confirm_close,close_application,hide_to_tray,native_pdf,native_excel_open,native_excel_preview,native_template_list,native_template_import,native_template_store,native_template_read,native_template_delete,native_template_editor,check_update,install_update])
      .run(tauri::generate_context!()).expect("ASMach masaüstü uygulaması başlatılamadı");
}

#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn rejects_unsafe_export_names(){for name in ["../x.pdf","C:\\x.pdf","x.exe","x.pdf:","x.pdf."]{assert!(safe_name(name).is_err());}assert!(safe_name("Ölçüm raporu.pdf").is_ok());}
 #[test] fn preferences_use_parameters(){let db=database(Path::new(":memory:")).unwrap();db.execute("INSERT INTO preferences VALUES(?1,?2)",params!["asmach.test","a');DROP TABLE preferences;--"]).unwrap();assert_eq!(db.query_row("SELECT count(*) FROM preferences",[],|r|r.get::<_,i32>(0)).unwrap(),1);}
 #[test] fn atomic_save_replaces_without_truncation(){let dir=tempfile::tempdir().unwrap();let p=dir.path().join("test.json");atomic_write(&p,b"old").unwrap();atomic_write(&p,b"new complete").unwrap();assert_eq!(fs::read(p).unwrap(),b"new complete");}
 #[test] fn xltx_validation_rejects_non_zip_content(){assert!(validate_xltx(b"not an xltx").is_err());assert!(validate_xltx(&[0x50,0x4b,0x03,0x04]).is_ok());}
}
