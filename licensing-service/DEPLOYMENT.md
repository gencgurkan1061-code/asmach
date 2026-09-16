# Canlı lisans hizmeti

## 16 Eylül 2026 güncellemesi

Lisans süresi uzatıldıktan sonra aynı anahtarla yeniden giriş ve otomatik çevrimiçi doğrulama için `asmach-license` Worker'ı tekrar yayımlandı (sürüm kimliği `d1e27c1c-935e-4ed1-a356-ecebbf805f3e`). TPM çevrimdışı izinli lisanslarda yenilenen süre, doğrulanmış TPM kanıtıyla en fazla 90 gün ve lisans bitişi sınırında yeniden hesaplanır. 3.0.7 kurulum paketi istemcideki yenileme ve görünür hata düzeltmelerini içerir; kurulum paketi `asmach-release` hizmetine yüklenmedi.

16 Eylül 2026 kontrolünde canlı `asmach-license` hizmeti `/offline-enable` isteğine 404 verdi; yeni akış henüz yayında değil. Bu durumda 3.0.5 istemcisi çevrimiçi anahtarı eski hizmette etkinleştirse bile eski hizmet TPM/çevrimiçi anahtar ayrımını imzalı yanıta koymaz. Uygulama bunu "Lisans bu bilgisayara veya ürüne ait değil" hatası olarak gösterebilir. `activation.js` eski hizmetin önceden kaydettiği aynı cihaz kimliğini, yeni hizmete geçildikten sonra anahtar tekrar girildiğinde doğrulanmış cihaz imzasıyla güvenli biçimde tamamlayacak şekilde güncellendi. Kimlik farklıysa aktarım yapılmaz.

`worker.js` ve `activation.js` birlikte `asmach-license` hizmetine 16 Eylül 2026'da Wrangler ile yayımlandı (sürüm kimliği `b25784ec-c637-4494-b1c9-1d386d20e526`). Canlı `/offline-enable` yoklama isteği artık eski 404 yerine beklenen 400 `Bad device` yanıtını veriyor. `asmach-release` değiştirilmedi. Kullanıcı aynı lisans anahtarını tekrar girebilir; canlı kayıtlarda elle sıfırlama yapmayın.

Worker kodu TPM'siz çevrimiçi etkinleştirme ve isteğe bağlı 90 günlük TPM çevrimdışı iznini destekler. `asmach-release` yalnızca kurulum/güncelleme dağıtımı içindir ve lisans Worker'ının yerine geçmez.

90 günlük izin, lisansın kendi bitiş tarihini aşmaz. Lisans Yönetimi'ndeki TPM alanları cihaz başarılı doğrulama yaptıktan sonra dolar.

- Yayın tarihi: 12 Eylül 2026
- Hizmet: https://asmach-license.licensing-service.workers.dev
- Doğrulama: `/validate`
- Worker: `asmach-license`
- KV: hesapta önceden oluşturulmuş boş `asmach-inspection` deposu kullanıldı.
- Ücretli abonelik, alan adı veya ödeme yöntemi oluşturulmadı. Faturalama aboneliklerini okuma API yetkisi yok; hesap planı Cloudflare panelinden görülebilir.
- Yönetici bağlantısı `.license-admin/cloud.json` içinde yapılandırıldı. Anahtarlar kullanıcı arayüzüne veya müşteri paketine gömülmez. Bu dosyayı ve `.license-admin` klasörünü paylaşmayın.
- Yalnızca çevrimiçi durum anahtarı Worker secret olarak yüklendi; lisans üretim özel anahtarı yerelde kaldı.

Canlı testler: yetkisiz yönetim isteği 401; bilinmeyen lisans imzalı inactive; test lisansı active; imzalı süre revizyonu; test lisansı revoked. Testler gerçek müşteri lisansını iptal etmedi. Kısa süreli QA kaydı bulutta devre dışı bırakıldı.

Aktif mevcut kayıt b82d5347-b046-4cbd-8a6a-89cbda24ff3e, r7 olarak aynı bitişle yayımlandı. Yeni dosya `Lisanslar/Lisans-Gu-rkan-GENC--b82d5347-r7.asmach-license`. Bitiş 12 Eylül 2026 05:50 Türkiye saatidir; kurulum sırasında uzatılmadı. Eski/süresi dolmuş/iptal bekleyen kayıtlar yeniden etkinleştirilmedi. Kurulu müşteri lisans veritabanı değiştirilmedi.

Müşteri 1.0.10 veya sonraki sürümde yeni adresli dosyayı yüklemelidir. Gelecek lisanslar yönetim uygulamasından otomatik yayımlanır; yayın hatasında Buluta gönder kullanılmalıdır. Lisans yöneticisi açıksa kapatıp yeniden açın. Aynı lisansı birden fazla yönetici bilgisayarından eşzamanlı değiştirmeyin; KV yayılımı anlık değildir.
