# Teknik ölçü Tesseract modeli ve 100 örneklik test

Tarih: 16 Eylül 2026

## Sonuç: aday model etkinleştirilmedi

Uygulamada mevcut model korunuyor; kurulum paketi yayımlanmadı. Eğitilmiş aday `ocr/technical-model/` klasöründe, açıkça kapalı durumdadır. Yeniden kurulum veya ikinci OCR motoru kurulumu yapılmadı.

| Deneme | Mevcut / aday tam doğru ölçü | Mevcut / aday ortalama süre |
| --- | --- | --- |
| İlk eğitim, çok dilli modelde İngilizce yerine | 84 / 81 | 1.242 / 1.277 ms |
| İlk eğitim, yalnızca ölçü modelini ayırma | 84 / 76 | 1.199 / 874 ms |
| Dengelenmiş eğitim, çok dilli modelde İngilizce yerine | 84 / 77 | 1.249 / 1.288 ms |

Son adayda 9 önceden doğru ölçü bozuldu, 2 ölçü düzeldi. Ortalama süre yaklaşık %3,13 arttı; ilk OCR başlangıcı 1.362 ms'den 1.912 ms'ye çıktı. Tek bilgisayarda bu koşullarla yapılan ölçümlerdir; tekrarlı istatistiksel performans garantisi değildir. Son aday için 200 eşleştirilmiş OCR okumasının tamamı `ocr/technical-model/evaluation-100.json` dosyasındadır.

Önemli örnekler: `36 +0.2/0` içindeki `0.2` → `6.2`; `R16 ±0.2` içindeki `±` → `x`; üst üste toleransta ham `+0.04` doğru olmasına rağmen alan aktarımında `+0.40`. Son örnek yalnız model eğitiminin yetmediğini; görüntü, metin yerleşimi ve alan dönüşümünün birlikte sınanması gerektiğini gösterir. GD&T'de bir örnek düzelirken başka biri bozuldu; mevcut GD&T davranışı da bu nedenle değiştirilmedi.

Sonraki uygun adım, gerçek çizimlerden doğrulanmış ölçü kesitleriyle alan uyarlaması ve görüntü hazırlama/yerleşim uyumunun ayrı geliştirme kümesinde çalışılmasıdır. Karşılaştırma sonuçları incelendiği için sonraki model seçiminin yanında yeni, daha önce görülmemiş bir son test kümesi de ayrılmalıdır. Hatalı alanları örtmek amacıyla mevcut 100 örneğin doğru etiketleri değiştirilmemelidir.

Teslim kontrolü: ilgili 44 otomatik kontrol geçti. Masaüstü arayüzü yeniden oluşturuldu; kurulum derlenmedi/yayımlanmadı. Oluşturulan uygulamada ek kaynak bindirmeden 6 OCR kontrolü (düz ölçü, üst üste tolerans, MAX/MIN çap, NPT diş, konum GD&T, malzeme notu) geçti. Stok model dosyalarının aynen gömülü olduğu ve adayın pakete girmediği doğrulandı; dış ağ isteği oluşmadı.

## Kapsam

İkinci OCR motoru eklenmedi. Mevcut Tesseract LSTM ağı gerçek eğitim araçlarıyla ince ayardan geçirildi. Eğitim, kullanıcı uygulamasında veya ölçü seçilirken yapılmaz. Tesseract.js çalışma motoru değişmedi.

100 sabit değerlendirme görüntüsü `tests/fixtures/ocr-100/` altında saklanır. Her görüntünün beklenen metni, beklenen alanları, yazı tipi, kalite durumu, standart bağlamı ve SHA-256 özeti manifestte bulunur. Değerler OCR sonucu kullanılarak üretilmedi.

Dağılım: Uzunluk 14; çap 10; yarıçap 6; açı 6; diş 18; geçme 6; pah 6; yüzey 8; GD&T 12; datum 2; tolerans 2; not 2; malzeme 2; proses 2; görsel 2; diğer 2. Toplam 100, uygulamadaki 16 karakteristik türü.

ISO 129-1, ISO 2768-mK, ISO 261/965-1, ISO 286, ISO 228-1, ISO 7-1, ISO 2902, ISO 21920, ISO 1101/5459 ve ASME Y14.5, B1.1, B1.20.1, B1.20.3, B46.1 bağlamlarında yazım örnekleri vardır. Bu kapsam standart sertifikasyonu veya bütün standart maddelerinin doğrulandığı anlamına gelmez.

Örnekler ±, tek/çift taraflı sapma, sıfırlı sapma, üst üste tolerans, MAX/MIN, üst/alt limit, inç, virgüllü ondalık, metrik/unified/boru dişi, geçme, pah ve yüzey gösterimlerini içerir. Kalite çeşitleri temiz, bulanık, küçük, aralıklı, düşük kontrast, JPEG bozulması ve gürültülüdür; üç örnek döndürülmüştür. GD&T çerçeveleri tanıyıcı şablonlarından alınmadan bağımsız çizilmiştir.

## Eğitim ile testi ayırma

- İlk eğitim: 2.400 satır; ayrı doğrulama: 200 satır.
- Dengelenmiş eğitim: 4.800 satır, 15 yerel yazı tipi dosyası. İlk doğrulama kümesi değişmedi.
- Eğitim aşaması 14.000 iterasyona kadar çalıştırıldı. Ayrı doğrulama hatasına göre 9.700 iterasyonlu ağırlık seçildi; son ağırlık otomatik olarak en iyi kabul edilmedi.
- Dengelenmiş modelin doğrulama karakter hatası %0,744; sözcük hatası %3,333. Bunlar uygulamadaki 100 ölçünün tam doğru alan aktarımı oranı değildir.
- Eğitim, doğrulama ve testte aynı metin/görüntü kullanılmaz. Test yazı tipleri Consolas, Verdana, Segoe UI ve Tahoma eğitimde yoktur. Yazı tipi dosyaları dağıtılmaz.
- Test kümesi eğitim gradyanına veya ağırlık seçimine verilmedi. 100 örnek farklı uygulama bağlantı seçeneklerini değerlendirmek için birden fazla kez çalıştırıldı; tek seferlik kör saha testi değildir.

## Sınırlar

100 örnek sentetiktir. Gerçek müşteri çizimlerinde aynı başarı garantisi vermez. Görsel/diğer ve bağımsız tolerans örneklerinin bazıları kullanıcı tarafından seçilen tür bağlamını kullanır; bu türlerin tamamının görselden kendiliğinden sınıflandırıldığı iddia edilmez.

Uygulama değerlendirmesi gerçek gömülü Tesseract ile, ağ istekleri kapalı ve OCR önbelleği atlanarak yapılır. Aynı örnek iki modelle sırayla okunur; önce okunan model dönüşümlüdür. Nominal, sapmalar, limitler, birim, diş bilgileri ve datumlar ilgili örnekte tanımlanan beklenen alanlarla karşılaştırılır. Notlarda metin de karşılaştırılır. Gereklilik üretimi ayrıca mevcut alan-senkronizasyon testleriyle korunur; 100 görüntü testinde gereklilik metni için bağımsız tam metin oracle'ı yoktur.

## Kullanıma alma koruması

`scripts/ocr-model-gate.cjs` doğruluk artışı, önceki doğru ölçülerin bozulmaması, sessiz hata artışı olmaması, ortalama/medyan/%95 okuma süresi ve ilk açılış süresi koşullarını denetler. Yavaşlama varsa kurulum paketine almadan önce kullanıcı onayı gerekir; bu kontrol kendiliğinden onay vermez.

`scripts/load-validated-ocr-model.cjs`, yalnızca açıkça etkinleştirilmiş ve test/model/kaynak özetleri eşleşen modeli derlemeye alır. Sırf dosyanın klasöre kopyalanması etkinleştirmez. Varsayılan stok dosyaları silinmez. Eğitim araçları, kontrol noktaları ve eğitim görüntüleri uygulama paketine dahil edilmez.

Üretim etkinleştirme dosyası yoksa mevcut OCR davranışı korunur. `model: 'technical'` yalnızca geliştirici test bağlantısıdır; GD&T hücreleri ve metin modunu standart modele yönlendirir. Bu seçenek ikinci motor kurmaz veya otomatik ek okuma turu eklemez.

## Tekrar çalıştırma

Geliştirici ortamında Node, Pillow içeren Python ve Playwright/Edge gerekir. Eğitim Windows için taşınabilir Tesseract 5.5.0 araçlarını kullanır; uygulamanın çalışma motoru sürümü değiştirilmez.

```text
node scripts/fetch-tesseract-training.cjs
node scripts/fetch-tesseract-finetune-base.cjs
python scripts/generate-ocr-100-corpus.py
python scripts/expand-tesseract-training.py
python scripts/train-technical-tesseract.py --corpus corpus-balanced-v2.json --run yeni-egitim --iterations 14000
node scripts/check-ocr-100-model.cjs --candidate-file outputs/tesseract-finetune/runs/yeni-egitim/asmtech.traineddata.gz --tag yeni-test
```

Tamamlanmış eğitim veya test raporu aynı adla ezilmez. Aday modeller ve ayrıntılı sonuçlar `outputs/tesseract-finetune/` altında tutulur. Uygulama testleri için `ASMACH_PLAYWRIGHT_MODULE` ile mevcut Playwright konumu belirtilebilir.

## Kaynak ve lisans

Başlangıç modeli: resmi `tessdata_best` İngilizce modeli, `e12c65a915945e4c28e237a9b52bc4a8f39a0cec` sürümü. Dil meta verileri: `langdata_lstm`, `07930fd9f246622c26eb5de794d9212ceac432d3`. Aday model tam sayı LSTM biçiminde yaklaşık 1,34 MB sıkıştırılmıştır. Kaynakların lisansları ve indirme özetleri geliştirici çıktılarında korunur.

Resmi yöntem: [Tesseract eğitim belgeleri](https://tesseract-ocr.github.io/tessdoc/tess5/TrainingTesseract-5.html), [tesstrain](https://github.com/tesseract-ocr/tesstrain). Başlangıç Tesseract modeli Apache-2.0 lisanslıdır. Eğitim aracı bağımlılıkları uygulama paketine dağıtılmaz.
