# ASMach Inspection 2.0.5

## Lisans merkezi

- Uzun ve aynı anda tüm alanları gösteren ekran kaldırıldı.
- Yeni akış **Yöntem > Bilgiler > Sonuç** adımlarından oluşuyor.
- İlk adımda anahtarla etkinleştirme, lisans talebi, çevrimdışı kod veya lisans dosyası seçiliyor.
- İkinci adım yalnızca seçilen yöntemin gerekli alanlarını gösteriyor.
- Geri ve ileri düğmeleriyle girilen bilgiler kaybolmadan yöntem ve bilgi adımları arasında geçiş yapılabiliyor.
- Son adım etkinleştirme sonucunu veya yöneticiye iletilecek yedek talep kodunu tek alanda gösteriyor.

## Lisans talebi düzeltmeleri

- Firma adı ve paylaşım onayı istemci tarafında işlemden önce denetleniyor.
- TPM kimliği yalnızca bunu gerektiren adıma geçildiğinde hazırlanıyor.
- Güvenlik duvarı, bağlantı, hizmet doğrulaması, istek boyutu ve yoğunluk hataları ayrı mesajlarla gösteriliyor.
- Talep hizmetinin kabul ettiği güvenli gövde boyutu 8 KiB'ye yükseltildi; uzun firma/not metinlerinin gereksiz reddedilmesi önlendi.
- Çevrimiçi talep başarısız olsa bile imzalı `ASM-REQ1` yedek kodu korunuyor.
- Güncellenen Cloudflare lisans hizmeti yayımlandı.

## Doğrulama

- Stepper ileri/geri geçişi, talep yedek kodu, TPM kimliği ve çevrimdışı etkinleştirme ekran testi geçti.
- Lisans talebi ve yönetici doğrulama testleri 11/11 geçti.
- Windows x64 Rust üretim derlemesi ve iki NSIS paketlemesi tamamlandı.

## Kurulum dosyaları

- Standart: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.5_x64-online-setup.exe`
  - Boyut: `30659083` bayt
  - SHA-256: `47357BCB099197D59D81C87BA2BE7EDF08E215745E14A6484224B108FE4E9637`
- Tam çevrimdışı: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.5_x64-offline-setup.exe`
  - Boyut: `244428885` bayt
  - SHA-256: `45C2A17CB8F1E7EC0C29EF52EFA33EA55DC88B616B3EBF9B1E69E600C32F43D9`

Paketler dijital imzasızdır; Windows SmartScreen yayıncı uyarısı gösterebilir.
