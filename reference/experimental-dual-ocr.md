# İkinci OCR ve özel karakter modeli — deneysel çalışma

## 16 Eylül 2026 sembol denetleyicisi kararı

Kullanıcı onayıyla yaklaşık 700 KB'lık teknik karakter modeli üretim paketine
yalnızca **sembol ikinci görüşü** olarak alındı. Model `Ø`, `±`, `R`, `O`, `0`,
ondalık ve işaret karışmalarını, Tesseract'ın gerçek karakter kutuları üzerinde
denetler. Ölçü metnini veya rakamları otomatik değiştiremez; kabul edilen bir
çelişki yalnız kaynak görüntüyle karşılaştırma uyarısı üretir. Döndürülmüş,
kutusu eksik veya model kapsamı dışındaki karakterlere tahmin uydurulmaz.

PaddleOCR ve ONNX çalışma zamanı üretime alınmadı. Aşağıdaki PaddleOCR hız,
paket boyutu ve güvenlik politikası bulguları geçerliliğini korur.

## Yayın durumu

PaddleOCR bileşenleri üretim derlemesine veya kurulum paketine dahil edilmedi. Kullanıcı,
ölçü okuma süresi uzarsa paketlemeden önce onay alınmasını istedi. Hız raporu
`outputs/ocr-dual-engine/comparison.json` içindedir. İlk kullanımın ek maliyeti de
bu karara dahildir. Hız testinin geçmesi tek başına masaüstü yayınına yeterli
değildir; güvenlik politikası, yerel varlıklar ve üçüncü taraf bildirimleri de
doğrulanmalıdır.

## Gerçekleştirilenler

- İkinci bağımsız motor: resmi PaddleOCR.js 0.4.2, PP-OCRv5 mobile ve ONNX
  Runtime Web 1.24.3. Yerel işçi içinde, tek işlemci iş parçacığıyla çalışır.
  Çizim veya ölçü görüntüsü dış servise gönderilmez. İlgili varlıklar yaklaşık
  58 MB'dir; SDK geliştirme dosyalarının tamamı kuruluma kopyalanmamalıdır.
- Gerçek özel eğitim: NumPy ile 582→64→18 küçük sinir ağı. Rakamlar ve ölçü
  işaretlerini tek karakter düzeyinde değerlendirir. Bu, Tesseract LSTM eğitimi
  veya tam satır tanıma modeli değildir. Uç kullanıcı bilgisayarında Python
  gerekmez; yaklaşık 700 KB ağırlık dosyası JavaScript ile çalışır.
- Eğitim, kalibrasyon ve bağımsız doğrulama font aileleri ve tohumları ayrıdır.
  Önceden hazırlanmış 16 FreeType ölçü görüntüsü eğitimde kullanılmadı.
- 8.820 eğitim, 1.620 kalibrasyon, 2.700 bağımsız karakter örneği kullanıldı.
  Bağımsız karakter doğruluğu %93,85; kabul edilen 2.361 örneğin 49'u yanlıştır.
  Bu nedenle model **yalnızca yardımcı kontrol** olarak kullanılır; sayıları
  otomatik değiştirme yetkisi yoktur. Skorlar olasılık olarak sunulmaz.

## Koruma kuralları

`ASMachOCR.recognize(snapshot, {verification:'experimental'})` açıkça
istenmediği sürece yeni motor/model çalışmaz. Mevcut arayüz bunu etkinleştirmez.

- Güvenilir, kontrol gerektirmeyen ana okumada ek motor atlanır.
- GD&T, serbest metin ve dar kapsamlı nominal/tolerans okumaları mevcut yolda
  kalır. GD&T için bu çalışmada yeni tanıma davranışı eklenmedi.
- Ana okuma geçerliyse alternatif motor onun alanlarını değiştirmez. Çelişki
  kontrol gerektirir. Farklı motorlardan rakamlar birleştirilmez.
- Ana okuma geçersiz, ikinci okuma geçerliyse bütün ikinci metin ancak zorunlu
  inceleme önerisi olur. İlk okumaya ait güven puanı, hata ve geometri öneriye
  taşınmaz; ayrı kanıt olarak tutulur.
- İkinci motor başarısızsa ana okuma korunur.
- Karakter modeli en fazla 16 uygun yatay karakteri kontrol eder. Eğitim
  kapsamı dışındaki döndürülmüş karakterler atlanır. İkinci motor yalnız satır
  kutuları verdiğinden onun sonuçlarına karakter kutuları uydurulmaz.
- Motor çalışma zamanı ilk gerektiğinde açılır. Eğitim son kullanıcıdaki
  ölçü okuma sırasında yapılmaz.

## Yeniden doğrulama

```text
node --test tests/ocr-verifier.test.cjs tests/secondary-ocr.test.cjs tests/technical-glyph-model.test.cjs
node scripts/check-ocr-dual-engine.cjs --rounds=3
node scripts/check-secondary-ocr-csp.cjs
```

Hız karşılaştırması yerel Edge içinde çevrimdışı, aynı 16 sentetik ölçüde,
taze OCR okumalarıyla üç tur yapılır. Ana motor ve deneysel akış sırası turlar
arasında değiştirilir. Soğuk motor yükleme maliyeti ayrıca ölçülür. Bu sınırlı
test gerçek müşteri çizimlerinin tümünü veya her bilgisayarın hızını temsil
etmez; doğruluk artışına dair genel garanti vermez.

Eğitim: `scripts/train-technical-glyph-model.py`; JavaScript eşlik kontrolü:
`scripts/check-technical-glyph-model.cjs`. Model ve eğitim raporları:
`ocr/experimental-model/technical-glyph-v1.json`,
`outputs/technical-glyph-training/report.json`.

Bağımlılık indirme ve SHA256 kayıtları:
`scripts/fetch-paddle-ocr.cjs`, `ocr/experimental-paddle/manifest.json`.
Yayın öncesi SDK içindeki dolaylı js-yaml/clipper gibi bağımlılıkların lisans
bildirimleri de tamamlanmalı; güvenlik politikası otomatik gevşetilmemelidir.

## Ölçülen sonuç — 16 Eylül 2026

16 farklı sentetik ölçü, her akışta üç kez okundu (48 ana, 48 deneysel okuma).

| Ölçüm | Ana motor | Ek doğrulama açık |
| --- | ---: | ---: |
| Ortalama | 1.536,65 ms | 1.611,33 ms |
| Ortanca | 1.744,30 ms | 1.768,60 ms |
| %95 dilimi | 2.786,00 ms | 3.113,10 ms |
| Yanlış ölçü alanı | 0 | 0 |

- Ortalama toplam okuma süresi %4,86 arttı. İkinci motorun ilk kullanımındaki
  ek doğrulama maliyeti 2.482,10 ms; özel model yükleme/kurma 14,50 ms oldu.
- Ek motor 48 sıcak okumanın 15'inde gerekti. Bu 15 çalışmada doğrudan ek
  doğrulama maliyeti 90,8–253 ms, ortancası 152,8 ms oldu. Toplam akış farkları
  ayrıca normal çalışma zamanı değişkenliğini içerir.
- 120 karakter kontrolü yapıldı; bu küçük ölçü kümesinde model çelişkisi yoktu.
  Bağımsız karakter doğrulamasındaki yanlış kabuller nedeniyle model yine
  otomatik düzeltme yapmaz.
- Dış ağ isteği veya kullanılamayan ikinci motor kaydı yoktu.
- Yeni doğruluk artışı kanıtlanmadı: bu ölçü kümesinde ana motor zaten tüm
  beklenen alanları doğru okuyordu. Sonuç, tüm gerçek çizimler için garanti
  değildir.
- **Hız kapısı kapalı: `publishAllowed:false`, `approvalRequired:true`.**
  Kurulum hazırlanmadı/yayımlanmadı; yeni bileşenler üretimde etkin değil.
- Son odaklı kontrol: 23 test grubu başarılı (240 geometri/font/boşluk yönü
  örneğini çalıştıran test dahil). Bu, depodaki tüm testlerin geçtiği iddiası
  değildir.

### Ek yayın engeli: masaüstü güvenlik politikası

Mevcut Tauri üretim güvenlik politikası hem sayfa hem işçi yanıtlarına aynen
uygulanarak yapılan ayrı testte Paddle işçisinin açılışı `EvalError` ile
engellendi. Resmi paket içindeki dinamik JavaScript üretimi mevcut politikanın
izin vermediği `unsafe-eval` gerektiriyor. Rapor:
`outputs/ocr-dual-engine/production-csp-smoke.json`.

Güvenlik politikası değiştirilmedi veya gevşetilmedi. Yayın öncesi işçinin bu
politikaya uygun derlenmesi/uyarlanması ve gerçek masaüstünde tekrar
doğrulanması gerekir. Hız artışına kullanıcı onayı verilse bile bu uyumluluk
kontrolü geçmeden mevcut deneysel paket yayımlanmamalıdır.
