# Canlı lisans hizmeti

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
