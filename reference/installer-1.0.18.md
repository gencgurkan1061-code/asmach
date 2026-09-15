# 1.0.18 kurulum akışı

Mevcut sürüm algılandığında üç işlem sunulur:

- Güncelleştir: uygulama dosyalarını yeniler; proje, lisans ve ayarları korur.
- Kaldır (Uninstall): lisans doğrulaması istemeden önceki kaldırıcıyı çalıştırır ve biter; yeni sürüm yüklemez.
- Temiz kurulum: lisans doğrulamasından sonra önceki kaldırıcıyı veri koruma modunda çalıştırır; başarılı olursa yeni sürümü yükler. Buradaki temiz kurulum kullanıcı verilerini sıfırlamak anlamına gelmez.

Lisans ayrı bir sihirbaz adımıdır. Kullanıcı doğrulamayı başlatır; geçerli sonuç gelmeden İleri açılmaz. İmza/çalıştırma hatası veya iptal durumunda tekrar denenebilir. Sessiz kurulum da aynı doğrulama kapısından geçer. Kurulum, açık ASMach işlemini zorla kapatmaz.

Windows'un doğrulama yardımcısını çalıştırması engellendiğinde artık bunun bir lisans reddi olmadığı açıklanır. Test bilgisayarında geçici klasördeki yardımcı başlatılırken “Uygulama Denetimi ilkesi bu dosyayı engelledi” hatası yeniden üretildi. Güvenlik ayarları değiştirilmedi ve lisans kapısı atlanmadı. Güvenilir kod imzalama/kurumun izin politikası gereksinimi çözülmeden paket bu bilgisayarda yine engellenebilir; sertifika henüz mevcut değil.

Doğrulama kapsamı: kurulum akışı kaynak testleri, yerel lisans birim testleri, masaüstü başlangıç kapısı tarayıcı testi ve NSIS derlemesi. Gerçek müşteri kurulumu kaldırılmadı; temiz kurulumun uçtan uca Windows denemesi yapılmadı.
