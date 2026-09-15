# ASMach Inspection 1.0.25

- Teknik Resim Aç / Yeni çizim komutu Yeni Proje olarak adlandırıldı; kullanıcıya gösterilen ilgili açıklamalar güncellendi.
- Verilen ekleme SVG'si Yeni Proje, düzenleme SVG'si Proje Aç düğmesine ve başlangıç alanına eklendi. Vektörler pakete gömülüdür.
- Dosya kısayolları: Ctrl+N Yeni Proje, Ctrl+O Proje Aç, Ctrl+S Kaydet, Ctrl+Shift+S Farklı Kaydet, Ctrl+Shift+W Kaydet ve kapat, Ctrl+W Kaydetmeden kapat (onay ister).
- Kaydet ve kapat yalnızca başarılı kayıt sonrasında projeyi kapatır. İptal/hata veya kayıt sırasında yeni düzenleme varsa açık bırakır. Devam eden okuma/düzenleme işlemleri önce bitirilmelidir. Kapatma diskteki projeleri silmez.
- Ayarlarda solda Genel, Balon ve işaret tasarımı, Denetleme, Rapor ve çıktı, Lisans, Uygulama ana kategorileri bulunur. Alt seçenekler sağ alandadır.
- Mevcut yöntem/sınıf/denetleme düzenleyicileri korunmuştur; öğe seçimi sağ taraftaki seçim kutusundan yapılır. Stil bilgi kutusu ayrı alt seçenektir.
- Firma adı ve PNG logo tercihi eklendi. Yerleşik rapor markalama katmanında kullanılır; özel Excel şablonlarındaki sabit logo/yazılar şablon düzenleyicisinden değiştirilmelidir.
- Mevcut lisans kapısı ve bölüm bazlı ayar kayıt davranışları korunur.

Doğrulama: yeni dosya/ayar arayüz testi, kayıt iptali/hatası/başarısı, PDF/Excel çıktı ve Düzenle/Proje bilgileri pencereleri, zorunlu GUID kapısı ve native köprü testleri. Kullanıcının gerçek proje dosyaları veya lisansı test amacıyla değiştirilmedi; kurulum/kaldırma yapılmadı.

Windows kod imzalama sertifikası yapılandırılmamıştır. Özel updater imzalama anahtarı olmadan otomatik güncelleme imzası üretilemez; bu belge bir imzalı otomatik güncelleme yayını bildirmez.

Paket, ortak derleme klasöründeki dosya kilitlenmesi ardından başarılı EXE derlemesinden `outputs/package-v25` altında zlib sıkıştırmasıyla oluşturuldu. Güvenlik ve lisans kontrolleri değiştirilmedi. NSIS kurulum dosyası üretildi; sonraki otomatik güncelleme imzalama adımı özel anahtar eksikliğinden tamamlanmadı.
