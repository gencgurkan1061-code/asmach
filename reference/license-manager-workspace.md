# Lisans yönetimi geliştirmeleri — 15 Eylül 2026

## Müşteri detay tasarımı

Çevrimdışı lisans dosyası; müşteri detayının üstündeki **Lisans dosyasını indir**, Lisanslar sekmesindeki kartların **Dosyayı indir** düğmesi veya ana listedeki **Dosya indir** ile alınabilir. Dosya adı müşteri/kısa lisans kimliği/revizyon içerir ve uzantısı `.asmach-license` olur. Mevcut imzalı dosya aynen indirilir; yeni lisans veya revizyon üretilmez. Henüz bilgisayar kimliğine bağlı olmayan çevrimiçi kayıtta indirme kapalıdır. İptal edilmiş bir kaydın dosyasını indirmek iptali geri almaz.

Müşteri detayı ayrı bir tasarımla yenilendi: müşteri başlığı, seçili lisans/bitiş/kayıt sayısı özeti ve İletişim / Lisanslar / Bulut ve cihaz / İşlem geçmişi sekmeleri. İletişim sekmesindeki kaydet düğmesi sabit alt çubuktadır. Lisanslar durum rozetli kartlarla seçilir; uzun kimlikler açılabilir teknik bilgi alanında kopyalanabilir. Bulut başarı/hata durumu kartlarla gösterilir, bilinmeyen cihaz verileri çevrimdışı diye sunulmaz. Lisans değiştirme veya kapatma sırasında kaydedilmemiş bilgiler için onay istenir.

`scripts/check-license-customer-detail.cjs`, geçici müşteri kayıtları ve test anahtarıyla iletişim kaydı, kayıp değişiklik koruması, lisans seçimi, geçmiş kapsamı, örnek bulut başarı/hata yanıtları ve 540 piksel genişlikte taşma kontrolünü doğrular. Bulut testi canlı hizmet doğrulaması değildir. Görseller: `outputs/license-customer-contact.png`, `outputs/license-customer-licenses.png`, `outputs/license-customer-cloud.png`, `outputs/license-customer-compact.png`.

## Kullanım

`ASMach Lisans Yönetimi.exe` mevcut klasöründeki güncel arayüzü yükler. Açık yönetim penceresini Çıkış ile kapatıp tekrar açın. Yönetici EXE'sini klasöründen ayırmayın; bu araç müşteriye gönderilmez.

- **Genel bakış:** 7/15/30 gün içinde bitecek lisanslar, süresi dolanlar, etkinleştirme bilgisi bekleyenler, başarısız gönderimler. Kartlar lisans listesini filtreler.
- **Lisanslar:** arama, durum/hızlı filtre, sıralama, 10/20/50 kayıtlık sayfalama, seçilebilir sütunlar. Hızlı filtre, sıralama alanı, sütunlar ve sayfa boyutu bu bilgisayarda hatırlanır. Anahtarlar listede veya oluşturma bildiriminde görünmez.
- **Müşteriler:** firma ve iletişim bilgileriyle arama, müşteriye bağlı lisanslar, sağdan açılan ayrıntı paneli ve kapsamlı işlem geçmişi.
- **Yeni lisans:** müşteri/yöntem → süre/not → kontrol/oluştur. 7 ve 30 günlük deneme ile yıllık süre şablonları vardır. Mevcut oluşturma/etkinleştirme ve lisans dosyası işlemleri korunur.
- **Gönderim takibi:** yerel revizyon, son başarılı yayın ve hata bilgisi ayrı tutulur. Son cihaz onayı sadece alınmış cihaz bildirimiyle gösterilir. Bu onay, belirli bir lisans revizyonunun cihazda uygulandığını kanıtlamaz; veri yokluğu çevrimdışı olma kanıtı değildir.
- **Toplu işlem:** en fazla 100 kayıt, eski/yeni tarihleri içeren önizleme, ikinci onay, tek kullanımlık beş dakikalık işlem planı. Önizlemeden sonra kayıtlar değişirse işlem reddedilir. Kısmi başarısızlıklar kayıt bazında gösterilir. Süresi kaydedilip buluta gönderilemeyen kayıtta tekrar uzatmak yerine yeniden gönder kullanılır.
- **Sürümler:** bildirilen müşteri sürümleri ve mevcut sürüm duyurusu. Duyuru kurulum dosyası yayımlamaz veya müşteride kurulum yapmaz.
- **İşlem geçmişi:** müşteri/metin, tarih aralığı ve işlem türü filtresi; önceki/yeni değerler. Ekran 50 işlem/sayfa gösterir.
- **Dışa aktarım:** filtrelenmiş liste UTF-8 CSV olarak indirilir. Etkinleştirme anahtarları, özel anahtarlar ve bilgisayar kimlikleri rapora dahil edilmez; formül başlangıçları metin olarak kaçışlanır.

## Şifreli yedek ve geri yükleme

Yedek; SQLite tablolarının tutarlı anlık görüntüsünü, müşteri ve lisans kayıtlarını, geçmişi, yayın durumunu ve imzalama özel anahtarını AES-256-GCM ile şifreler. Anahtar paroladan scrypt ile türetilir. En az 12 karakterlik parola gerekir; parola kurtarma yoktur. Yedek en fazla 20 MB olabilir.

Bulut yönetici anahtarı/ayar dosyası, dışa aktarılmış lisans dosyaları ve bulutta tutulan talepler bu arşive dahil değildir. Tam makine taşıma/anahtar kaybı kurtarması için uygulama kapalıyken `.license-admin` klasörünün tamamını ayrıca güvenli ortamda yedekleyin. Yeni ekran aynı imzalama anahtarıyla çalışan uygulamaya **kayıt geri yükleme** içindir; anahtarı veya bulut ayarını değiştirmez.

Geri yükleme sırası:

1. Şifreli dosyayı ve parolasını seçin.
2. Parola, dosya bütünlüğü, lisans imzaları, kayıt ilişkileri ve mevcut anahtarla uyum doğrulanır.
3. Mevcut/yedek müşteri, lisans ve işlem sayıları gösterilir. Mevcut iptal durumunu geri alan yedek reddedilir.
4. `GERİ YÜKLE` yazıp onaylayın. Bu adım mevcut tabloları yedekteki içerikle değiştirir; yeni kayıtlar yedekte yoksa ana listeden çıkar.
5. Önce mevcut veriler aynı parolayla `.license-admin/backups/` altında şifreli güvenlik yedeğine alınır. Sonra tüm tablo değişimi tek veritabanı işlemi içinde yapılır; hata olursa geri alınır.
6. Buluta hiçbir otomatik yazım yapılmaz. Yayın bilgisi yeniden kontrol gerektirir; eski yedek güncel bulut revizyonundan geride olabilir. Güvenlik yedeği ayrı saklanmalıdır.

## Doğrulama ve kapsam

- Önceki lisans yönetimi ve çevrimdışı kod testleri dahil **17 otomatik test** geçti.
- Gerçek tarayıcıyla, geçici veritabanı ve yalnız test için üretilen anahtar üzerinde özet, filtreler, sayfalama, müşteri düzenleme, oluşturma sihirbazı, toplu işlem, kod gizleme, şifreli yedek/geri yükleme, anahtarsız CSV, hatırlanan filtre/sütunlar ve geçmiş filtresi test edildi. Pencere yenilemede oturumun korunması da doğrulandı; oturum anahtarı kalıcı görünüm deposuna yazılmaz ve Çıkış ile temizlenir.
- Dar ve geniş pencere görüntüleri incelendi. Çıktılar `outputs/license-manager-overview.png`, `outputs/license-manager-licenses.png`, `outputs/license-manager-compact.png`.
- Gerçek müşteri lisansları üzerinde oluşturma, uzatma, iptal, geri yükleme veya buluta yayın yapılmadı. Gerçek yönetim anahtarları testlerde kullanılmadı.
- Müşteri kurulum paketi bu yönetici arayüzü geliştirmesi için yeniden üretilmedi; yönetici aracı müşteri paketinden ayrıdır.
