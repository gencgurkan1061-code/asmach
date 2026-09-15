# Birleşik ölçü algılama: tasarım ve doğrulama

## Temel ayrım

Ölçü türü, tolerans gösterimi ve OCR güvenilirliği ayrı değerlendirilir. MIN/MAX için kullanıcı isteğiyle nominal, iki sınırın orta noktasından hesaplanır; `nominalSource: limit_midpoint` ile çizimden okunmuş nominalden ayrılır. Çap sembolü, datum ve birim görsel/metin kanıtı olmadan kesin bilgi gibi eklenmez. Metin ayrıştırma testleri gerçek OCR doğruluğu olarak raporlanmaz.

| Aile | Gerekli kanıt | Yapılandırılmış sonuç |
| --- | --- | --- |
| Uzunluk / çap / yarıçap | Sayı, varsa Ø/R sembolü | Nominal ve birim |
| Simetrik tolerans | Nominal ile ± işareti | Nominal, alt/üst sapma |
| Asimetrik / tek yönlü | Nominal, işaretler, iki satırın konumu | Nominal ve ayrı sapmalar; sıfır korunur |
| MIN/MAX ve yığılmış limit | Etiketler veya aynı boyda hizalı iki sınır | Asıl alt/üst limit + hesaplanan orta nokta nominali ve sapmalar |
| GD&T | Dış çerçeve, kenarlara bağlanan ayraçlar, sembol | Tür, toplam bölge, çap koşulu, değiştiriciler, en çok üç datum |
| Açı / pah | Derece işareti, açı biçimi, çarpım ilişkisi | Açı veya ayrı doğrusal/açısal bileşenler |
| Diş / geçme | M/adım/sınıf veya tolerans sınıfı | Nominal, adım ve sınıf ayrı tutulur |
| Yüzey | Ra/Rz vb. parametre, değer, birim kanıtı | Parametre birimden ayrılır; birim varsayımı uyarılır |

## Akış

1. Kaynak bölgeyi ve ham OCR metnini koru.
2. Çerçeve, yazı yönü ve satır yerleşimini incele. Sembol içindeki çizgiyi hücre sınırı sayma.
3. Uygun ailede işle: GD&T hücre okuması; normal ölçüde nominal/sapma veya limit satırları.
4. Orijinal/hafif/güçlü adaylarını aynı ayrıştırıcıdan geçir. Önizleme ve ana OCR aynı yolu kullanır.
5. Adayları yalnız OCR yüzdesiyle değil; sözdizimi, yerleşimde rakam kaybı, anlamlı sayısal alanlar ve tutarlılık ile puanla.
6. Yakın puanlı, yeterli güvene sahip adayların tür/nominal/sapma/limit imzaları farklıysa inceleme iste. Oy çokluğu bağımsız doğrulama değildir.
7. Seçilen alanlardan gereklilik ve önizleme üret. Manuel GD&T düzeltmesinde OCR görünümü eşleşir, ilk okuma saklanır.
8. Yeni durumdan doğrulama mesajlarını yeniden hesapla; eski uyarıyı taşımama.

## MIN/MAX ve bölgesel okuma geliştirmesi

- `0.596 MAX 0.586 MIN` → nominal `0.591`, sapmalar `-0.005/+0.005`; `0.205 MAX 0.198 MIN` → `0.2015`, `-0.0035/+0.0035`.
- Gereklilik ve değerlendirme hâlâ asıl limitleri kullanır. Sadece MAX veya MIN varsa orta nokta hesaplanmaz. Ters sınırlar otomatik düzeltilmez.
- Hesaplanan nominal panelde açıklanır; kayıtlı eski limit ölçüleri normalleştirilirken hesaplanır. Elle girilmiş değerler korunur.
- 12 basamağa kadar limitlerden 13 basamağa kadar tam ondalık orta nokta/sapma üretimi; bilimsel gösterime dönüşüm ve hassasiyet kaybı önlenir.
- Miktar, Ø/R, derece, birim ve pah eki bölgelemede korunur. Başka sayılar/etiketler varsa bunlar sessizce atılmaz; belirsiz okuma olarak bırakılır.
- Bağımsız nominal/tolerans satırı kesitleri, kenar boşluğu, ayrı sembol kontrolü ve ince eksi işareti doğrulaması eklendi. GD&T hücre kuralları değiştirilmeden ortak doğrulanmış çap algılayıcısı kullanılır.

## Bu değişiklikte uygulananlar

- Ortak anlam değerlendirmesi (`assessReading`), ölçü ailesi ve tolerans biçimi çıktısı.
- OCR aday puanlamasında geçerli alanlar ve limit gösterimleri için destek; tutarsızlık için ceza.
- Yakın puanlı anlam çatışmalarında kontrol işareti.
- MIN/MAX ayrıştırıcısında gerekliliğin doğrudan oluşturulması ve kontrollü seçim uyarısının yenilenmesi.
- 15 aile örneği ile ortak test; dört yönlü yığılmış limit testleri; GD&T görüntü regresyonu.

## Açık geliştirmeler ve kabul ölçütü

Küçültülmüş/sıkıştırılmış görüntüler için bağımsız bölgesel okuma ve dört yön kontrolü uygulanmıştır. Bu sınırlı test setindeki başarı, her çizimde garanti anlamına gelmez. Aile bazlı görüntü testlerinde nominal, işaret, sapma, limit, birim ve datum ayrı ayrı ölçülmeye devam edilmeli. Kaynak PDF'den daha yüksek çözünürlüklü kesit alınması ve daha geniş gerçek çizim arşiviyle doğrulama sonraki aşamadır. Yalnız büyütme kaybolmuş ayrıntıyı geri getirmez.

Yeni sürüm için mevcut başarılı örnekler gerilememeli; hatalı sonuçların kontrol işareti olmadan kabul edilmesi ayrıca izlenmeli. Sentetik testlerin sonucu, gerçek kullanıcı çizimlerinin tümünde başarı garantisi değildir. Bu değişiklik herhangi bir kurulum paketinin yeniden üretildiği anlamına gelmez.

Önceki aşama temel ölçümü: kullanıcının 0.205/0.198 kesiti doğru MIN/MAX olarak okundu; pozisyon GD&T kesiti de geçti. Sıkıştırılmış 11 ve Ø54.9 görsellerinin iki boyut ve üç işleme düzeyindeki 12 denemesinde yalnızca 2 nominal eşleşti, 10 yanlış okuma kontrol gerektirdi. Önizleme/ana okuma 12 örnekte eşleşti; bu eşleşme doğruluk değildir. İlave seyrek metin geçişi eşleşme sayısını artırmadığından kalıcılaştırılmadı. Bu kayıt, yeni bölgesel okuma algoritması öncesi karşılaştırma tabanıdır.

Yeni doğrulama: 6 döndürülmüş gerçek OCR örneğinde nominal, iki dolu tolerans alanı, çap türü ve ana/önizleme eşitliği geçti. 7 olumsuz kontrol: 0/8/B yanlış Ø olmuyor; +/1/0 yanlış eksi olmuyor; normal kutulu ölçü GD&T olmuyor. Kullanıcının iki MIN/MAX kesiti nominal/sapma/limitleriyle ve pozisyon GD&T kesiti ayrı ayrı geçti. Birleşik 25 test grubu, 242 alan/değerlendirme kontrolü, 15 yapı kontrolü ve 56 PDF/OCR yerleşim yönü denemesi geçti. Bu sayıların hiçbiri bütün gerçek çizimler için doğruluk oranı olarak yorumlanmamalıdır.

Son dört-yönlü kaynak ve üretilmiş HTML ile karşılaştırılabilir 12 vaka tekrar çalıştırıldı: 12/12 nominal eşleşti; çıktıların tamamı `11 (+0.1/0)` veya `Ø54.9 (0/-0.1)` olarak doğru sapmaları da korudu. Önceki taban sonuç 2/12 idi. Alternatif okumalar çeliştiğinde kontrol işareti kaldırılmadı. Kurulum paketi bu geliştirme turunda yeniden oluşturulmadı.

## Font, görüntü kalitesi ve karakter aralığı

- Geometri katmanı, rakam yüksekliği ve yerel aralık dağılımını kullanır. Ondalık nokta alt satıra, ince eksi işareti bağımsız ölçüye dönüşmez; geniş aralıklı tekil rakamlar ölçü bağlamında birleştirilir. Tam sayısal sözcükler ve büyük boşlukla ayrılmış bağımsız değerler korunur.
- Tek satırlı ölçülerde yalnız okuma kopyasının tekrarlanan boşlukları düzenlenir. Rakamların pikselleri sıkıştırılmaz; büyük sözcük aralıkları korunur. Okunan koordinatlar özgün görüntüye geri eşlenir.
- Ham OCR sonucu, yerleşim çözümlemesinden ayrı aday olarak saklanır. Puanlama ile kullanıcıya döndürülen metin aynı normalleştirmeyi kullanır; yerleşim düzeltmesi doğru ham işareti kaybettiremez.
- `±` kurtarma, görüntüde çapraz çizgi ve hizalı alt çizgi kanıtı gerektirir; sıradan `+` işareti ölçü beklentisine göre `±` yapılmaz. Çap simgesi, rakam tahminiyle değil bağımsız görsel kanıtla ayrılır.
- Unicode boşluklar ve tam genişlikte rakamlar normalize edilir. GD&T'nin daire içindeki malzeme koşulları korunur. `25.4 5`, `20 30`, `NOTE 2 5.4` gibi belirsiz veya serbest metinler zorla tek sayıya dönüştürülmez.
- `±0.l` gibi bozuk tolerans sayısı, `0/0` tolerans olarak kabul edilmez. Eksik işaret, kayıp rakam veya belirsiz yerleşim kaynakla kontrol gerektirir.
- Nominal/tolerans OCR düğmeleri alan kapsamını okuma motoruna geçirir. Güncelleme otomatik kalır; ham kaynak metni ve kontrol uyarısı karakteristikte korunur. Elle düzeltme eski OCR belirsizliğini temizler.

Görüntü kenar boşluğu, ölçek ve satır bölütleme kararları için [Tesseract'ın birincil kalite rehberi](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) esas alınmıştır. Kayıp görüntü ayrıntısı hiçbir ön işleme ile kesin olarak yeniden üretilmiş sayılmaz.

Yeni metin testleri 92 alan/koruma kontrolü; nominal/tolerans kısmi okuma testleri 14 kontrol; yerleşim testleri 384 font aralığı/işaret/yön kombinasyonu içerir. Bunlar gerçek OCR yüzdesi değildir. Gerçek çevrimdışı OCR matrisi, Arial / Times New Roman / Courier New, italik, 0/3/6 piksel karakter aralığı, JPEG, küçültme ve bulanıklığı kapsar. Başlangıç raporu `outputs/ocr-font-quality-baseline.json`: 16 ölçünün 10'u tam alan eşleşmesi, ayrıca 2 belirsizlik korumasının 2'si başarılı.

Sonuç (`outputs/ocr-font-quality-current.json`, 15 Eylül 2026): **15/16 ölçü tam doğru + 2/2 belirsizlik koruması**. Önceden geçen 10 ölçünün hiçbiri bozulmadı. Tek kalan hatalı örnek italik Arial/JPEG `R5 ±0.1`: nominal doğru, ± eksi çizgisi eksik; okuma kontrol gerekli olarak işaretlenir. Alternatif/inceleme bulunması bu örneği doğru OCR saydırmaz. Rapor, test edilen kaynakların SHA-256 değerlerini içerir.

Ek gerçek OCR doğrulamaları: 9/9 aralıklı/sıkıştırılmış simetrik tolerans; 6/6 nominal/tolerans kapsamlı okuma (GD&T toleransı ve üst/alt sıfır dahil); 54/54 yanlış ± üretmeme kontrolü; eski 18/18 bölgesel OCR (6 döndürülmüş örnek dahil). Üretilmiş uygulamada 12/12 ana/karşılaştırma okuması eşleşti ve doğru nominal/sapmaları korudu. Kullanıcının iki MIN/MAX kesiti, pozisyon GD&T, GD&T gereklilik düzenleme, proje kaydı ve ham metin/uyarı aktarımı da geçti. Birleşik 38 otomatik test grubu hatasızdır.

İlk geliştirme turunda güncellenmiş bağımsız HTML ve masaüstü ön yüzü oluşturulmuş, kurulum EXE'si o turda yeniden üretilmemiştir. Kullanıcının sonraki paketleme isteğiyle 15 Eylül 2026 saat 17:25–17:29 arasında mevcut 2.0.3 sürümü korunarak standart ve çevrimdışı kurulum paketleri yeniden oluşturuldu. Son font/karakter aralığı kaynaklarının test raporuyla hash eşleşmesi ve masaüstü varlıklarına dahil edildiği doğrulandı. Dosya bilgileri ve SHA-256 değerleri `reference/release-2.0.3.md` içindedir.
