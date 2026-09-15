# Excel şablonlarında liste alanı

1. Düzenle → Şablon Düzenleyici ile XLTX şablonunu seçin.
2. Excel'de yazdırma alanını, yinelenen başlık satır/sütunlarını, üstbilgi/altbilgiyi ve ölçeklendirmeyi ayarlayın.
3. Verilerin yazılacağı dikdörtgen aralığı seçin. Araç kutusunda **Liste alanını seç** düğmesine basın. Başlık ve imza/onay hücrelerini bu seçime dahil etmeyin.
4. Tekrarlanan alan kodlarını listenin ilk satırına ekleyin. Alt satırları veri için boş bırakın. **Kaydet** ile XLTX dosyasına uygulayın.

Aralık Excel'de sayfaya özel `ASMach_List` adıyla tutulur. Kayıtlar alan kapasitesine göre bölünür. Taşan kayıtlar aynı formun ayrı devam çalışma sayfalarına yazılır. Yazdırma alanı, yinelenen başlıklar, sayfa ayarları, altbilgi, sabit hücreler, sütun genişlikleri, stiller ve mevcut çizimler korunur. İlk liste satırının yatay birleşimleri ve tanımlı satır yüksekliği boş devam satırlarına taşınır. Baskıdaki fiziksel sayfa sayısı Excel'in kağıt/ölçek ayarına bağlıdır; yazdırmadan önce Excel önizlemesini kontrol edin.

Liste tanımı olmayan eski şablonlar önceki yöntemle çalışır. Dolu hücrelerin üzerine yazılmaz. Dikey birleşimli liste alanları, ayrı koleksiyonların tek listede birleştirilmesi, sütun yönünde sayfalama ve Excel tablo/pivot nesneli devam sayfaları desteklenmez; açıklayıcı hata döner. Şablon dosyası çıktı hazırlanırken değiştirilmez.

Doğrulama: `scripts/check-template-pages.cjs`; yerel Excel araç kutusu için PowerShell sözdizimi kontrolü. Gerçek Excel COM etkileşimi bu testte çalıştırılmaz.
