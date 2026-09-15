# ASMach Inspection 1.0.24

## Ayarlar

- Ortak, aranabilir sol ağaç: genel görünüm, çizim/PDF, tablolar, yöntem stilleri, sınıflandırmalar, denetleme türleri, numune tablosu/adetleri, çıktı ayarları, masaüstü ve lisans.
- Mevcut düzenleme kontrolleri ve olayları korunur. Yöntem/sınıf seçim listeleri sol ağaca taşınır. Canlı önizleme, ekleme/silme ve toplu stil düğmeleri korunur.
- Denetleme türleri arasında geçişte kaydedilmemiş form bilgileri oturum içinde korunur. Türü kaydetme/sıfırlama işlemleri ilgili taslağı yeniler.
- Beyaz/açık mavi görünüm, genişliği değiştirilebilir sol alan ve dar ekran yerleşimi.
- Mevcut bölüm bazlı kayıt semantiği korunur: sınıflandırmalar otomatik, diğer bölümler kendi Kaydet düğmeleriyle kaydedilir. Tek bir genel işlem/geri alma oturumu değildir.
- Lisans işlemleri yalnızca native masaüstü uygulamasından açılır; HTML önizlemesi lisans doğrulamasını taklit etmez.

## Birikmiş değişiklikler

Bu paket mevcut çalışma klasöründeki uygulama kaynaklarından hazırlanır. Önceki 1.0.23 GUID kurulum kapısı, lisans denetimleri, PDF/Excel pencereleri, şablon araç kutusu düzeltmeleri ve güncel Proje/Proje bilgileri adlandırması dahildir. Yalnızca konuşulmuş, uygulanmamış önerilerin tamamlandığı anlamına gelmez. Ayrı lisans yönetim uygulaması ve bulut servisi bu çalışma kapsamında değiştirilmedi/yayımlanmadı.

## Doğrulama

- Ayarlar ağacı: proje olmadan erişim, yöntem/tür taslağının bölüm değişiminde korunması, arama, numune alanları, sınıf alanları, dar ekran ve lisans masaüstü sınırı.
- PDF/Excel çıktı, şablon seçimi, önizleme ve çıktı gönderme testleri.
- Düzenle araçları ve sekiz Proje bilgileri bölümü testleri.
- Zorunlu GUID kurulum testi: otomatik arama yok, geçersiz anahtar engelleniyor.
- Dokuz native köprü testi.

Gerçek müşteri lisansı etkinleştirilmedi. Bilgisayarda kurulum/kaldırma yapılmadı. Kod imzalama sertifikası yapılandırılmadığından Windows güven uyarısı çıkabilir.

Paketleme NSIS kurulum dosyasını başarıyla oluşturdu (243482943 bayt). Sonraki otomatik güncelleme imzalama adımı özel anahtar eksikliği nedeniyle başarısız oldu; güncelleme imzası yayımlanmadı. Manuel kurulum EXE dosyası oluşturulmuştur. Bu durum Windows Authenticode imzasından ayrıdır.
