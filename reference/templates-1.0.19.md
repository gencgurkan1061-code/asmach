# Şablon düzenleyicisi · 1.0.19

## Kullanım

Çıktılar kitaplığında şablonlar FAI, kontrol planları, muayene ve özel şablonlar olarak gruplanır. Önceden kaydedilmiş aynı adlı şablonlar değiştirilmez. Dört yeni hazır şablon kitaplığa eksikse eklenir.

Excel alan araç kutusunda kategori seçin veya alan adı/kodunu arayın. Excel hücresini seçip **Ekle** deyin. **Ctrl+F** aramaya geçer; **Ctrl+S** şablonu kaydeder. Dolu hücreyi değiştirmek için ilgili kutuyu açıkça işaretlemek gerekir. Excel meşgul olduğunda alan arama ve kod kopyalama kullanılabilir; bekleyen Excel iletişim kutusunu tamamlayıp işlemi yeniden deneyin. Araç kutusunu kapatmak Excel dosyasını kapatmaz veya kaydetmez.

154 alan; proje, FAI kimlik/onay, sipariş, karakteristik, ortak/operatör/kalite planları, montaj, malzeme/proses/test, operasyon, üretim kontrolü ve muayene kaydı kategorilerini kapsar. Pasif rol planlarındaki saklı değerler çıktıya aktarılmaz.

## Yeni şablonlar ve sınırlar

- FAI karakteristik doğrulama: AS9102C Rev C alan numaraları referans alınmıştır; resmi IAQG formunun yerine geçtiği veya tam uygunluk sağladığı iddia edilmez. Kaynak: https://iaqg.org/standards/forms/
- Operatör kontrol ve numune planı.
- Kalite kontrol ve numune planı.
- Muayene izlenebilirlik kaydı: genel kayıt şablonudur, ISO belgelendirmesi değildir.

Standart ve müşteri gereklilikleri kuruluş tarafından doğrulanmalıdır. Numune adedi alanı girilmiş manuel adedi gösterir; yeni bir standart numune hesabı eklenmemiştir.

Tüm çalışma sayfalarındaki alanlar doldurulur. Tekrarlanan kayıtlar için boş satır/sütun bırakılmalıdır. Dolu hücreye denk gelen tekrar işlemi verinin üzerine yazmak yerine hata verir. Karmaşık birleşik hücre düzenlerinde otomatik sayfa çoğaltma bu sürümün kapsamı dışındadır.

## Doğrulama

- 154 benzersiz alan; üç sayfalı dosyada alan doldurma, sayısal sıfır ve pasif rol izolasyonu.
- Yedi genel şablonda XLTX içe/dışa aktarım, boş veride alan kodlarını temizleme, sütun tekrarı ve bilinmeyen alan reddi.
- Mevcut yerel XLTX düzenleyicisi bağlantı testi.
- Yeni dört rapor için örnek değerlerle yerleşim incelemesi.
- PowerShell sözdizimi kontrolü.

Gerçek Excel/WinForms pencere testi bu çalışma ortamının PowerShell betik çalıştırma kısıtı nedeniyle tamamlanamadı. Kullanıcı bilgisayarında Excel açıkken hücre düzenleme, iletişim kutusu ve kaydetme senaryoları ayrıca kontrol edilmelidir.

Genel `tests/tauri-bridge.test.cjs` kontrolünde sekiz testin altısı, bu değişiklikte dokunulmayan tarayıcı köprüsünün test taklidinde `addEventListener` bulunmadığı için başlamadan hata verdi. Bu nedenle genel masaüstü testlerinin tamamının geçtiği iddia edilmez; şablon odaklı üç test betiği geçti.
