# ASMach Inspection 2.0.3

## Bu pakete dahil edilen güncellemeler

- Farklı font, düşük görüntü kalitesi ve geniş karakter aralıkları için ölçü OCR iyileştirmeleri. Ondalık nokta ve tolerans işaretleri yerleşim bilgisiyle değerlendirilir; ayrı ölçüler zorla tek sayıya birleştirilmez.
- Çap ve ± işaretleri için görüntü kanıtına dayalı kurtarma. Ham OCR metni ve alternatif okumalar korunur; belirsiz sonuçlar kontrol gerekli olarak işaretlenir.
- Nominal/tolerans bölgesel OCR düğmelerinde alan kapsamı, otomatik güncelleme ve kontrol uyarısının kayda aktarılması.
- MIN/MAX limitlerinden hesaplanan nominal orta nokta ve sapmalar; özgün kabul limitlerinin korunması ve eski kayıtlardaki eksik nominalin tamamlanması.
- GD&T pozisyon hücre ayrımı, en fazla üç datum ve elle düzenlenen karakteristiklerin gereklilik/OCR görünümüyle eşitlenmesi.
- Önceki dinamik birim, aday önizlemesi, balon boyutlandırma/yerleşim, seçili balon görünümü, Ctrl+A ve mevcut proje kaydını güncelleme düzeltmeleri.

Çalışma klasöründeki mevcut 2.0.3 sürümü korunmuştur; eski 2.0.1 sürümüne geri dönülmemiştir.

## Doğrulama

- 16 test dosyasında 51/51 otomatik test grubu ve kurulum GUID/lisans akışı kontrolü geçti.
- Sekiz kritik OCR/ölçü modülü, üretilmiş bağımsız HTML ve masaüstü varlıklarında güncel kaynakla birebir doğrulandı. Masaüstü çıktısı 107 yerel betik içerir; çalışma anında geliştirme sunucusu gerektirmez.
- Önceki gerçek OCR kalite matrisiyle kaynak hash eşleşmesi doğrulandı: 15/16 ölçü tam doğru, 2/2 belirsizlik koruması başarılı. Önceden geçen 10 ölçü korunmuştur. Bu sınırlı matris bütün gerçek çizimlerde hatasız OCR garantisi değildir.
- Bilinen sınırlama: italik Arial/JPEG `R5 ±0.1` örneğinde ± işaretinin alt çizgisi kaçabiliyor; sonuç kontrol gerekli olarak işaretleniyor.

## Kurulum seçenekleri

- Standart paket, WebView2 gerektiğinde internetten tamamlanan küçük kurulumdur. `-online-setup.exe` aynı dosyanın açık isimli kopyasıdır.
- Çevrimdışı paket, WebView2 kurulum bileşenini de içerir. Uygulamanın lisans etkinleştirme kuralları değişmez.
- Paketler bu işlemde kullanıcı bilgisayarına kurulmamıştır; lisans, ayar ve proje kayıtları değiştirilmemiştir. Çevrimiçi sürüm duyurusu/yayınlama yapılmamıştır.
- Paketler dijital imzasızdır; Windows güvenlik uyarısı gösterebilir.
- Yeniden üretim öncesi 2.0.3 paketleri `outputs/installer-backup-20260915-172318/` altında yedeklenmiştir.

## Oluşturulan ve doğrulanan dosyalar

15 Eylül 2026 tarihinde her iki NSIS üretimi başarıyla tamamlandı. Her iki dosyanın ürün sürümü `2.0.3`, dijital imza durumu `NotSigned` olarak doğrulandı. Test raporundaki beş OCR kaynağının SHA-256 değerleri paketleme sonunda değişmemiştir.

### Standart kurulum

- Dosya: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.3_x64-setup.exe`
- Aynı içerikli kopya: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.3_x64-online-setup.exe`
- Oluşturulma: 15 Eylül 2026, 17:25:22 (Türkiye).
- Boyut: `30648981` bayt.
- SHA-256: `2720E4A0D5D4EF1D10DE990DAF11F2132247A61711A32B9F156612A4EB9CC685`

### Çevrimdışı kurulum

- Dosya: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.3_x64-offline-setup.exe`
- Oluşturulma: 15 Eylül 2026, 17:29:38 (Türkiye).
- Boyut: `244420781` bayt.
- SHA-256: `2483D82E90D94DBA3B5B6FAAB781AB4006D1210F10FDAEC75920361B22E6CC8D`
