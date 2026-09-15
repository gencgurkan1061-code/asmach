# ASMach — Windows / Tauri 2

## Bu bilgisayardaki doğrulama durumu — 15 Eylül 2026

2.0.4 üretim uygulaması, küçük çevrimiçi kurulum paketi ve WebView2 içeren çevrimdışı kurulum paketi oluşturuldu. Rust üretim derlemesi ile masaüstü köprüsü, kurulum, lisans talebi ve çevrimdışı lisans testleri geçti.

Ana dağıtım hedefi Windows masaüstü uygulamasıdır. HTML/CSS/JavaScript arayüzü Tauri paketinin içindedir; **kurulu uygulamada Node.js, PowerShell web sunucusu veya internet gerekmez**. Node.js ve geliştirme sunucusu yalnız geliştirme sırasında kullanılır.

## Geliştirme

Gerekenler: Node.js LTS, Rust MSVC, Visual Studio C++ Build Tools + Windows SDK, WebView2.

```powershell
npm ci
npm run desktop:dev
```

Bu bilgisayarda ayrıca `powershell -File scripts/desktop.ps1 dev` kullanılabilir. Rust ve Codex ile gelen Node yolu yalnız süreç ortamına eklenir; sistem PATH'i değiştirilmez.

Arayüz değişiklikleri Tauri penceresinde yenilenir. Kaydedilmemiş proje varsa otomatik yenileme durur ve önce kaydetmenizi ister. Rust değişiklikleri Tauri tarafından yeniden derlenir. Geliştirme sunucusu yalnız `127.0.0.1:1420` adresini dinler.

## Windows installer

```powershell
npm run desktop:build
```

Çıktı: `src-tauri/target/release/bundle/nsis/*-setup.exe`. NSIS kullanıcı hesabına kurar. Küçük paket WebView2 eksikse Microsoft kurulumunu indirir. `*-offline-setup.exe` WebView2'yi paket içinde taşır ve kurulum sırasında internet gerektirmez. İlk derleme bağımlılıkları indirmek için internet kullanır. `Cargo.lock` ve `package-lock.json` sürümleri sabitler.

Dağıtım dosyası ayrıca Windows kod imzalama sertifikasıyla imzalanmadığı sürece SmartScreen uyarısı gösterebilir. Sertifika veya yayın hesabı otomatik oluşturulmaz.

## Yerel hizmetler

- Windows dosya aç/kaydet ve klasör seçicileri Rust backend'dedir. Ön yüz keyfî bir dosya yoluna yazamaz; kaydetme seçimi tek kullanımlık kayıt izni üretir. Dosya önce aynı klasörde geçici olarak yazılır ve tamamlandıktan sonra atomik olarak değiştirilir.
- Excel/PDF içeriği mevcut çevrimdışı rapor motoruyla oluşturulur; diske yazma Tauri üzerinden yapılır. Dosya boyutu üst sınırı 256 MiB'dir.
- Tercihler ve son iki proje kurtarma kopyası `%APPDATA%/com.asmach.ballooning/workspace.sqlite3` içinde tutulur. Gerçek veri yolu Windows menüsünde gösterilir. SQLite WAL ve transaction kullanır; ön yüze serbest SQL çalıştırma izni verilmez.
- JSON proje dosyaları taşınabilir olarak korunur. Önceki tarayıcı sürümündeki projenizi dosyaya kaydedip Tauri'de **Proje aç** ile içeri alın. Tarayıcıya özgü görünüm tercihleri farklı depolama alanından otomatik aktarılmaz.
- Windows menüsü: başlangıçta açılma (varsayılan kapalı), çıktı klasörü, sistem tepsisine küçültme, güncelleme denetimi.
- PDF, Windows'taki varsayılan PDF uygulamasında açılabilir veya onaydan sonra onun yazdırma işlevine gönderilebilir. PDF okuyucusu ve yazıcı sürücüsü gereklidir; yazdırma sonucu fiziksel yazıcı/okuyucu üzerinden kontrol edilir.
- OCR modeli, PDF motoru ve rapor varlıkları uygulamaya gömülüdür. Uygulama verileri sunucuya gönderilmez.

## Sürüm bildirimi

Uygulama başlangıçta ve Windows menüsündeki **Sürümü denetle** düğmesiyle HTTPS üzerinden yalnız sürüm numarasını sorgular. Yeni sürüm varsa kullanıcıya kurulum paketini yöneticisinden almasını söyleyen bilgi gösterilir.

R2, otomatik indirme ve uygulama içinden kurulum kullanılmaz. Lisans Yöneticisi **Sürüm yayını** ekranında yalnız sürüm numarası, en düşük desteklenen sürüm ve sürüm notunu duyurur. Kurulum paketi yönetici tarafından ayrıca iletilir.

## Güvenlik duvarı olan bilgisayarda çevrimdışı lisans

Uygulama çevrimiçi lisans doğrulamasına ulaşamazsa **Lisans merkezi > Çevrimdışı etkinleştirme** bölümü TPM tabanlı bilgisayar kimliğini gösterir. Kullanıcı firma ve iletişim bilgisini girip açık onay verdikten sonra lisans talebini doğrudan gönderebilir. Talep, Lisans Yönetimi uygulamasındaki **Lisans talepleri** kutusuna düşer.

Güvenlik duvarı talep hizmetini de engelliyorsa aynı işlem `ASM-REQ1-...` ile başlayan imzalı bir talep kodu üretir. Yönetici bu kodu **Talep kodunu içe aktar** ile açar. Bilgisayar kimliği ve TPM imzası doğrulanmadan lisans formu doldurulmaz.

Lisans yöneticisinde **TPM · Yeni sürümler** koruması seçilir, bilgisayar kimliği yapıştırılır, başlangıç ve bitiş tarihleri belirlenerek lisans oluşturulur. Lisans satırındaki **Çevrimdışı kod** düğmesiyle üretilen `ASM-OFF1-...` kodu müşteriye iletilir. Kullanıcı kodu uygulamadaki çevrimdışı alana yapıştırıp etkinleştirir.

Kod dijital olarak imzalıdır; yalnız seçilen bilgisayarda ve tanımlanan süre boyunca geçerlidir. Çevrimdışı bilgisayara iptal bilgisi anında ulaştırılamaz, ancak lisansın bitiş tarihi ve yerel saat geri alma koruması uygulanmaya devam eder.

## Test

```powershell
npm run test:desktop
cargo test --manifest-path src-tauri/Cargo.toml
```

Kaynaklar: [Tauri Windows gereksinimleri](https://v2.tauri.app/start/prerequisites/), [Windows installer](https://v2.tauri.app/distribute/windows-installer/), [imzalı güncelleme](https://v2.tauri.app/plugin/updater/).
