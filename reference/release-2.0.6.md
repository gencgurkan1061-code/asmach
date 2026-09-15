# ASMach Inspection 2.0.6

## Windows lisans sihirbazı

- Lisans merkezi klasik Windows masaüstü kurulum sihirbazı düzeninde yeniden tasarlandı.
- Adımlar koyu renkli sabit sol panelde gösteriliyor; etkin ve tamamlanan adımlar ayrı durum renklerine sahip.
- Yöntem kartları, form alanları, odak görünümü, boşluklar ve renk dengesi masaüstü uygulama standardına göre yenilendi.
- Geri, İleri, proje yedeği ve uygulamadan çıkış komutları her zaman görünen sabit alt çubuğa taşındı.
- Bağlantı ve teknik bilgiler ana akışı kalabalıklaştırmayan ayrı bir açılır bölümde toplandı.

## Kaydırma ve yerleşim düzeltmeleri

- Sihirbaz penceresi ekran yüksekliğine bağlı sabit bir masaüstü pencere iskeleti kullanıyor.
- Yalnızca orta içerik alanı bağımsız olarak kayıyor; başlık, adımlar ve alt komutlar sabit kalıyor.
- Form alanlarının alt komut çubuğunun arkasında kalması ve dikey olarak ezilmesi engellendi.
- Fare tekerleği, odaklanan alanı görünür yapma ve dar pencere yerleşimi otomatik testle doğrulandı.
- Onay kutusunun genişleyerek metni bozması düzeltildi.
- 620 pikselden dar ekranlarda sol panel otomatik olarak yatay adım başlığına dönüşüyor.

## Doğrulama

- 680×780 piksel pencerede içeriğin formdan uzun olduğu ve fare tekerleğiyle kaydığı doğrulandı.
- Kaydırılan formun alt sınırının sabit komut çubuğuyla çakışmadığı denetlendi.
- Anahtar, lisans talebi, yedek talep kodu, TPM kimliği ve çevrimdışı etkinleştirme testleri geçti.
- Lisans yönetimi ve talep doğrulama testleri 11/11 geçti.
- Windows x64 Rust üretim derlemesi ve iki NSIS paketlemesi tamamlandı.

## Kurulum dosyaları

- Standart: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.6_x64-online-setup.exe`
  - Boyut: `30663964` bayt
  - SHA-256: `CF65DB1B7805EE71D3AB0CDF3507483996B84107624B1A7180B8C65CFF07424C`
- Tam çevrimdışı: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.6_x64-offline-setup.exe`
  - Boyut: `244456711` bayt
  - SHA-256: `A5EF326A3CC7A92FCB9519529CB0231A38645F50F7D39C3801F00C04B18FC678`

Paketler dijital imzasızdır; Windows SmartScreen yayıncı uyarısı gösterebilir.
