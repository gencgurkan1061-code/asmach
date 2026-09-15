# ISO geçme sapmaları — veri kapsamı

2026-09-09 tarihinde NACHI-FUJIKOSHI dijital kataloğunun açık teknik tablolarından okunan sayısal veriler kullanılır:

- Mil: https://nachi-tool.jp/bearing/appe_table2.html
- Delik: https://nachi-tool.jp/bearing/appe_table3.html

`iso-fit-reference.json` okunan hücreleri saklar. Satır biçimi: `[alt ölçü (hariç), üst ölçü (dahil), alt sapma (µm), üst sapma (µm)]`. Uygulamadaki tablo ardışık eşdeğer aralıkları birleştirir. Sapmalar mm'ye dönüştürülür; çap aralıkları arasında interpolasyon veya kapsam dışında ekstrapolasyon yapılmaz.

Uygulama yalnızca `fitClasses` listesinde bulunan 36 sınıfın yayımlanmış aralıklarını içerir. Bazı sınıflar 500 mm, bazıları 1600 veya 2000 mm'ye kadar bulunur; alt sınır 3 mm hariçtir. Tam ISO 286 standardının bütün sınıf ve çap aralıklarını içerdiği iddia edilmez. Büyük ve küçük harfler farklıdır; desteklenmeyen kod veya ölçü için genel tolerans uygulanmaz ve kullanıcıya uyarı gösterilir.

Örnek: 50 mm d6, 30 < ölçü ≤ 50 aralığına girer. Alt sapma -96 µm, üst sapma -80 µm; sınırlar 49.904 ve 49.920 mm'dir.

H7/g6 gibi delik/mil çiftleri tek bir karakteristiğin kabul aralığına dönüştürülmez. Kodun yanında açık sayısal tolerans varsa sayısal tolerans önceliklidir; tabloyla uyuşmazlık uyarılır. OCR'daki büyük/küçük harf karışıklığı otomatik düzeltilmez. Kaydetmeden önce seçimin ve çizimin doğrulanması gerekir.

Testler: örnek d6, aralık uçları, 36 sınıfın tüm kaynak hücreleri, metin aralıkları, farklı sınıflar, uygunsuz/eksik kodlar, açık tolerans önceliği, OCR alanları ve proje kaydı.
