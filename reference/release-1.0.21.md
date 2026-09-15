# ASMach Inspection 1.0.21

## Teslim edilen akış

- Lisans yöneticisinde yeni lisans için varsayılan “Anahtar · İlk bilgisayarda etkinleştir” seçeneği: bilgisayar kimliği gerektirmez; ayrı ASM lisans numarası ve UUID v4 anahtarı üretir.
- Anahtar yönetici bilgisayarında saklanır; bulutta anahtar özeti tutulur. İmzalı lisansın üretim özel anahtarı buluta veya müşteri paketine eklenmez.
- İlk etkinleştirme internet gerektirir. Cloudflare SQLite Durable Object, ilk cihaz bağlantısını atomik olarak kaydeder. İnternet kesilince bağlantı serbest bırakılmaz. İkinci cihaz reddedilir.
- Cihaz, lisans üreticisinin imzası ve ayrı bulut cihaz-bağlama imzasını doğrular. Yerel TPM anahtarıyla cihaz kanıtı gerekir. Bu, bulut tarafında uzaktan TPM donanım tasdiki değildir.
- Süre değişiklikleri aynı lisans kimliği, numarası, anahtarı ve cihaz bağlantısını korur. Müşteri başarılı çevrimiçi kontrolde yeni imzalı revizyonu alır.
- İptal edilen yeni anahtar tekrar etkinleştirilemez. Tamamen çevrimdışı bir cihaza anında iptal iletilemez; mevcut imzalı süresi boyunca çalışır. Kayıtlı iptal kararı çevrimdışıyken de korunur.
- Eski imzalı dosyalar desteklenir. Mevcut müşteri lisansları otomatik dönüştürülmedi, uzatılmadı veya iptal edilmedi.
- Anahtar giriş ekranı kurulum doğrulama yardımcısında da kullanılır. Geçerli mevcut lisansı olan güncelleştirme kullanıcısından tekrar anahtar istenmez.
- Lisans kontrolü sonrası çalışma penceresi büyütülür. Metin yönüne göre eğik seçim kutusu düzeltmesi, çıktı çalışma alanı ve XLSX kayıt türü düzeltmeleri pakete dahildir.

## Kontroller

- Yerel servis/yönetici testleri: eşzamanlı farklı cihazlar, yanlış anahtar, süre revizyonu, kalıcı iptal, eski lisans uyumluluğu, kimlik kanıtı, güvenli yönetici erişimi.
- Canlı Cloudflare: yalnızca kısa süreli QA lisansı; eşzamanlı iki cihazdan yalnızca biri kabul edildi; aynı anahtarla uzatma ve iptal doğrulandı. QA lisansı iptal edildi.
- Rust release: 16 lisans testi başarılı; çift imza, eksik lisans, cihaz eşleşmesi, çevrimdışı süre, saat geri alma, revizyon geri alma, kalıcı iptal.
- Tarayıcı testleri: anahtar girişi ve Enter, hatalı anahtarda kapalı geçit, başarılı etkinleştirme; 45 derece seçim kutusu; canlı PDF önizleme/kaydetme ve XLSX kayıt türü.
- Yerel köprü: 8 test başarılı.

Kurulum paketi üretildi; kullanıcının kurulu uygulaması otomatik kaldırılmadı/güncellenmedi. Tam kurulum-kaldırma döngüsü kullanıcının bilgisayarında çalıştırılmadı. Kod imzalama sertifikası olmadığı için paket imzasızdır; Windows uyarılarının kalkması garanti edilmez.

Yönetici EXE, proje klasöründeki license-manager dosyaları ve yerel yönetim verileriyle birlikte çalışır; müşteriyle paylaşılmamalıdır.
