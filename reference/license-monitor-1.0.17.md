# Lisans kontrolü — 1.0.17

- Uygulama açıkken Windows tarafındaki izleyici her 30 dakikada buluta başvurur. Pencerenin küçültülmesi bu zamanlayıcıyı durdurmaz.
- Bağlantı veya alındı bildirimi başarısızsa 5 dakika sonra yeniden denenir. Uykudan dönüşte ve arayüzün bağlantı geri geldi bildiriminde ayrıca kontrol yapılır. Ağ gecikmeleri nedeniyle süreler kesin teslim garantisi değildir.
- Yerel imza, süre, cihaz bağı ve kayıtlı iptal bilgisi en az dakikada bir denetlenir. Çalışan oturumda geçen süre, sistem saatinin geriye alınmasına karşı ayrıca kullanılır; yeniden açılışta kayıtlı en yüksek zaman denetlenir.
- Geçerli yerel lisans ağ hatası yüzünden iptal sayılmaz. Abonelik bitişine kadar çevrimdışı çalışabilir. TPM bir internet bağlantısı veya güvenilir takvim saati değildir; tamamen çevrimdışı iptal ve her türlü yerel müdahaleye karşı mutlak koruma vaat edilmez.
- İmzalı iptal/etkin değil kararı önce yerel veritabanına yazılır. Lisans ekranı çalışmayı kapatmadan kilitler; proje yedeği kaydetme ve çıkış seçenekleri korunur. Rapor işlemleri ayrıca yerel uygulama katmanında lisans denetiminden geçer.
- Cihaz alındı onayı, taze sunucu yanıtına bağlı TPM imzası ister. Sıradan doğrulama isteği, kararın cihaza ulaştığı anlamına gelmez. Tekrarlanan eski alındı bildirimleri son kontrol tarihini ileri taşımaz.
- Yönetici detay ekranı son cihaz doğrulamasını ve iptal alındı durumunu gösterir. Henüz onay gelmemesi cihazın kesin olarak çevrimdışı olduğu anlamına gelmez. Eski uygulama sürümleri bu bilgiyi göndermez.

Yeni davranış için istemciler 1.0.17 paketine güncellenmelidir. Yönetim uygulaması kapatılıp yeniden açılmalıdır. Müşteri lisansları, süreleri ve proje dosyaları bu geliştirme sırasında değiştirilmedi.

Doğrulama: Rust birim testleri, bulut/TPM-alındı protokol testleri, yönetici API testleri ve tarayıcıda lisans ekranı testleri çalıştırıldı. Windows yükleme paketi üretildi; kullanıcının bilgisayarında gerçek yükleme/kaldırma veya müşteri lisansını iptal ederek uçtan uca deneme yapılmadı.
