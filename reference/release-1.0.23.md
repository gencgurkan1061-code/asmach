# ASMach Inspection 1.0.23

- Kurulum yardımcısı GUID girişi ve açık Lisansı doğrula eylemi ister. Kayıtlı lisans, dosya içe aktarma veya otomatik cihaz araması kurulum adımını atlatamaz.
- Yardımcı süreç bu oturumdaki başarılı anahtar etkinleştirmesini native bellekte takip eder; imza/cihaz/süre denetimi de başarılı olmadan sıfır çıkış kodu vermez.
- Girilen anahtar mevcut activate API üzerinden TLS ve TPM cihaz kanıtı ile doğrulanır. Bulut servisi ya da müşteri lisansları bu sürüm hazırlanırken değiştirilmedi.
- Normal uygulama açılışı, çevrimdışı lisans süresi ve periyodik denetim korunur.
- Önceki Düzenle/Çizim düzenlemeleri, masaüstü pencere teması, PDF liste sayfalarının kaldırılması ve kompakt şablon araç kutusundaki 154 alanın doğru ayrıştırılması dahildir.

Doğrulama: GUID giriş arayüzü sahte native yanıtlarla; başarısız ve başarılı etkinleştirme, otomatik sorgu yapılmaması ve uygulama modüllerinin kurulumda açılmaması sınandı. Installer akış testleri ve 9 bridge testi geçti. Araç kutusu gerçek Windows PowerShell 5.1 altında, Excel işçisi taklit edilerek test edildi. Gerçek müşteri anahtarı etkinleştirilmedi; bu bilgisayarda kurulum/kaldırma yapılmadı.
