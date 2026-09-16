# OCR ve gereklilik güncellemesi — 16 Eylül 2026

## Kapsam

- Karakter kutularıyla güvenli boşluk/nokta/işaret yerleşimi; yan yana bağımsız ölçüler için belirsizlik kanıtı.
- Görsel olarak bulunan ± işaretinin bölgesel OCR sonucuna aktarılması; satır kırpmalarındaki karakter koordinatlarının düzeltilmesi.
- `R12.5` gibi yarıçapların ISO 7 boru dişi sanılmasının önlenmesi. Kesirli `R1/8`, `Rp1/8` gösterimleri korunur.
- OCR metni, ölçü türü ve ölçü alanları değiştiğinde ortak gereklilik üretimi. Uyumlu sayısal alanlar korunur, eski türe ait alanlar temizlenir.
- Eksik/geçersiz OCR düzenlemesi son geçerli alanları sessizce silmez; inceleme ve onay engeli gösterilir.
- Limitler kaynak değer olarak korunur; hesaplanan nominal, çizimde basılı nominal olarak sunulmaz.
- Diş miktarı/derinliği, yüzey sınırları, küçük/asimetrik toleranslar ve metinsel ölçü türleri için üretim düzeltmeleri.
- Doğrudan elle yazılmış gereklilik, ilgisiz metadata değişikliklerinde korunur. Açık ölçü/OCR düzenlemesi otomatik gerekliliğe geçer; mevcut düzeltme onay akışları korunmuştur.

## Hız ve güvenlik

Temiz sayısal satır ancak iki okuma uyuşursa ve koyu/soluk tüm karakter bileşenleri hesaba katılabiliyorsa hızlı yoldan tamamlanır. Geometri belirsizliği çoğunluk oylamasıyla yok sayılmaz. Diğer ölçüler mevcut ayrıntılı kurtarma yolunu kullanır.

Önbellek yalnızca değişmez görüntünün ham OCR çıktısını tutar. Tür, tolerans standardı, manuel alanlar ve gereklilik sonuçları önbelleğe alınmaz. Geçerli ayrıştırma ve doğrulama her kullanımda yeniden çalışır. Önbellek 6 MiB hesaplanan metin bütçesi/24 girişle sınırlıdır; farklı görüntü ayrı anahtardır. Zorunlu tam okuma önbelleği atlayıp yeni çıktıyla günceller. Motor sonlandırılınca temizlenir.

GD&T algılama yolu yeniden yazılmadı. Yeni hızlı yol sıradan sayısal ölçüler içindir. Çizimler dış OCR servisine gönderilmez; testlerde ağ istekleri engellenir.

## Doğrulama

- Eski ve yeni sürümde aynı 18 font/kalite senaryosu gerçek Tesseract motoruyla çalıştırıldı: 16/18 → 18/18. Bunların 2'si bağımsız ölçülerin yanlış birleştirilmesini engelleyen güvenlik senaryolarıdır.
- İlk motor açılışı hariç son yerel karşılaştırmada ortalama 1262 ms → 1182 ms; medyan 1336 ms → 1286 ms. Bu sınırlı yerel denemedir, her cihaz/çizim için süre garantisi değildir. Soluk-işaret korumaları ve koordinat düzeltmeleri son 18/18 regresyon sonucuna dahildir.
- FreeType/Pillow ile oluşturulan bağımsız 16 değerlendirme örneği: 65/65 beklenen alan. İlk etiketlerde iki NPT adımı sayısal yazılmıştı; uygulama şeması `27 TPI` / `18 TPI` olduğundan etiket düzeltmesi ayrı raporda kaydedildi. Son gerçek OCR tekrarında da 16/16 örnek ve 65/65 alan doğru bulundu.
- Yerleşim testlerinde 240 yeni karakter geometrisi örneği; mevcut 384 yerleşim, 92 metin ve 14 kısmi OCR kontrolü.
- Gereklilik, tür geçişi, kısmi/geçersiz düzenleme, önbellek yenileme ve soluk işaretler için ayrı otomatik testler eklendi.
- Tarayıcı ekran testi: OCR → tür → nominal/tolerans → yüzey/diş alanları → gereklilik zinciri, geçersiz metinde alan koruma ve kayıt normalizasyonu sonrası gereklilik kararlılığı geçti. Ekran: `outputs/requirement-edit-sync.png`.
- Kapsamlı eski testlerin tamamı için başarı iddiası yoktur: eski bir host test düzeneğinde eksik `nextBalloonNumber` taklidi nedeniyle başarısız kontrol bulunur. Yeni odaklı testler ve yukarıdaki gerçek tarayıcı kontrolleri geçti.

Raporlar: `outputs/ocr-font-quality-baseline.json`, `outputs/ocr-font-quality-current.json`, `outputs/ocr-adaptive-runtime.json`, `outputs/ocr-freetype-evaluation/`.

## Bağımlılıklar ve sınırlar

FreeType 2.14.3, Pillow 12.3.0 üzerinden yalnızca geliştirme/değerlendirme örneklerini üretir. Yerel font dosyaları dağıtım paketine kopyalanmaz. Üretimde mevcut çevrimdışı Tesseract sürdürülür. Mevcut eşikleme/görüntü hazırlama algoritmaları kullanılır; yeni bir OpenCV, PaddleOCR veya bulut çalışma zamanı eklenmedi. Model eğitimi yapılmadı. Bunlar ancak gerçek hata örneklerinde ölçülebilir fayda görülürse ayrı aşamada değerlendirilecektir.

Sınırlı test grubundaki tam başarı, tüm teknik resimlerde kusursuz tanıma anlamına gelmez. Şüpheli sonuçlar kaynakla doğrulanmalıdır. Yeni kurulum paketi yayımlamak bu değişiklik kapsamına dahil değildir.
