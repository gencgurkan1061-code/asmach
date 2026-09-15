# Çıktılar ekranı · 1.0.20

- Balonlu teknik resim seçilince PDF önizlemesi aynı ekran içinde açılır. Kalite, balonlar, stil bilgi kutusu, karakteristik listesi ve ölçüm sonuçları üst alandan değiştirilir.
- Ayar değişiklikleri 350 ms birleştirilir. PDF üretimi sırayla yapılır; eski isteğin sonucu yeni şablon veya yeni ayarların üzerine gelemez. Üretim sırasında eski önizlemeden çıktı alınmaz.
- Yazdır ve PDF’yi kaydet, önizlenen PDF dosyasını kullanır. Sayfa geçişi ve yakınlaştırma önizleme içindedir.
- Şablon listesinde arama, kategori grupları, satır sınırları ve seçili satır vurgusu vardır. Dosya uzantısı rozetleri kaldırılmıştır. Düzenle/kaldır simgeleri ilgili satırdadır; kaldırma onay gerektirir.
- Sağda çalışma sayfası seçilebilir hücre önizlemesi bulunur. Bu görünüm birleşik hücreleri, sütun genişliklerini, metinleri ve temel biçimleri gösterir. Formüller yeniden hesaplanmaz; grafik/görseller ve Excel baskı yerleşimi birebir render edilmez. Önizleme 300 satır ve 60 sütunla sınırlıdır; dışa aktarım sınırlanmaz.
- Excel’de şablon kaydedildikten sonra Önizlemeyi yenile kullanılabilir. Excel kaydında şablon yeniden okunur.
- Windows kayıt penceresinin türü Excel çalışma kitabı (*.xlsx), PDF belgesi (*.pdf) vb. olarak açıkça gösterilir. Eksik uzantı tamamlanır; farklı türde uzantı reddedilir.

## Kontroller

Gerçek uygulama HTML’i üzerinde yerel tarayıcı testi: PDF üretimi/önizlemesi, hızlı ayar değişiklikleri, kaydetme çağrısı, şablon önizlemesi, arama, XLSX dosya adı ve gecikmiş PDF sonucunun şablon görünümünü değiştirmemesi geçti. PDF/Excel ekran görüntüleri görsel olarak incelendi. Alan aktarımı ve şablon gidiş-dönüş testleri geçti.

Windows yazıcı iletişim kutusu ve kayıt penceresi etkileşimli olarak çalıştırılmadı; yerel çağrılar testte taklit edildi. Kurulum paketi derlendi; bu çalışma sırasında kurulmadı.

Rust birim testleri çalıştırılmak istendi, ancak Windows Uygulama Denetimi debug derlemesindeki `serde_with_macros` DLL dosyasını engelledi (4551); testler bu nedenle başlayamadı. Windows güvenlik ayarları değiştirilmedi. Release uygulama derlemesi tamamlandı.
