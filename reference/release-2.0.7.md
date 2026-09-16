# ASMach Inspection 2.0.7

## Lisans merkezi

- Sol renkli adım paneli ve kart tabanlı kontrol paneli kaldırıldı.
- Lisans akışı klasik Windows kurulum sihirbazı düzenine geçirildi.
- Her aşama tek sayfada gösterilir; üst başlık seçilen işleme göre değişir.
- Alt komut çubuğundaki Geri, İleri ve İptal/Kapat düğmeleri her zaman sabit kalır.
- Yöntem seçimi standart Windows seçim satırlarıyla yapılır.
- Lisans talebi formu kendi sayfasında dikey kayar; yatay kaydırma oluşmaz.
- Geçerli lisans bulunduğunda İptal yerine Kapat düğmesi gösterilir.

## Doğrulama

- 680 × 780 pencere boyutunda yatay taşma kontrolü
- Lisans talebi formunda fare tekerleğiyle dikey kaydırma
- Sabit alt gezinme çubuğu
- Çevrimiçi anahtar, çevrimdışı kod, lisans talebi ve lisans dosyası akışları

## Kurulum paketleri

- Standart: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.7_x64-online-setup.exe`
- Tam çevrimdışı: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.7_x64-offline-setup.exe`
