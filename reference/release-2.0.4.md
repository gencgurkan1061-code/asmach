# ASMach Inspection 2.0.4

## Lisans merkezi

- Dağınık lisans kontrolleri tek bir **Lisans merkezi** içinde toplandı.
- Çevrimiçi anahtar, çevrimdışı etkinleştirme ve lisans dosyası birbirinden ayrı, numaralı bölümler haline getirildi.
- Durum, bağlantı ve teknik bilgiler sadeleştirildi; mevcut lisans dosyası ve etkinleştirme akışları korundu.
- Kullanıcı açık onay vererek firma, iletişim ve not bilgisiyle lisans talebi oluşturabilir. TPM bilgisayar kimliği imzalanarak gönderilir.
- İnternet veya güvenlik duvarı talebi engellerse uygulama elle aktarılabilen `ASM-REQ1` talep kodu verir.

## Lisans yönetimi

- Yeni **Lisans talepleri** ekranı gelen talepleri durum, firma, iletişim, sürüm ve bilgisayar kimliğiyle birlikte gösterir.
- Talep doğrudan lisans oluşturma formuna aktarılabilir; teslim edildi veya reddedildi olarak işaretlenebilir.
- Güvenlik duvarı nedeniyle elle iletilen talep kodu içe aktarılırken TPM imzası ve bilgisayar kimliği doğrulanır.
- Bulut talep kutusu yayımlandı ve yönetici bağlantısıyla erişim kontrolü geçti.

## Doğrulama

- Windows x64 Rust üretim derlemesi tamamlandı.
- Lisans merkezi, çevrimdışı talep yedeği, TPM talep doğrulaması ve lisans yönetimi çalışma alanı testleri geçti.
- Standart ve WebView2 içeren çevrimdışı NSIS paketlerinin ürün sürümü `2.0.4` olarak doğrulandı.

## Kurulum dosyaları

- Standart: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.4_x64-online-setup.exe`
  - Boyut: `30662732` bayt
  - SHA-256: `CB0DCC1C3CDBDB9116AE28919209A81A95BE72EE4E361BFF9B3CAB8076873E32`
- Tam çevrimdışı: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.4_x64-offline-setup.exe`
  - Boyut: `244426777` bayt
  - SHA-256: `A5C3ACE75F9E1996265D1360AC4452E439264F83DCFA12A61CB8340F543772F1`

Paketler dijital imzasızdır; Windows SmartScreen yayıncı uyarısı gösterebilir. Standart paket WebView2 eksikse internetten tamamlar; tam çevrimdışı paket bu bileşeni içinde taşır.
