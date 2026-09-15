# 1.0.10 · Ücretsiz plan ve aktif lisans listesi

Cloudflare Workers Free + KV kullanılır; SQL sunucusu ve yöneticinin bilgisayarının sürekli açık olması gerekmez. Ücretli plan satın alınmaz. Ücretsiz planın işlem sınırları vardır; kota/bağlantı hatası lisans iptali değildir. Hesap ve yayın henüz yapılmadıysa uzaktan doğrulama aktif değildir.

## Yayına geçiş sırası

1. Cloudflare hesabında ücretsiz Workers planını kullanın. README içindeki namespace ve secret kurulumunu tamamlayın. Üretim lisans anahtarını buluta yüklemeyin.
2. Lisans yönetimindeki Bulut ayarlarından adresi ve yönetici anahtarını kaydedin.
3. Önceden verilmiş, geçerli kalmasını istediğiniz lisansları tek tek **Buluta gönder** ile yayımlayın. Adresi/revizyonu olmayan kayıtlar aynı bitişle yeni dosyaya dönüştürülür; dosya müşteriye yeniden yüklenmelidir. Eski dosyalar ve geçmiş korunur.
4. Yeni oluşturulan lisanslar bulut bağlıysa otomatik yayımlanır. Yayın hatası açıkça gösterilir; dosyayı müşteriye vermeden önce Buluta gönder ile tekrar deneyin. Yerel dosya kaydedilmiş olması yayın başarısı değildir.
5. Ayrı test lisansında aktif, eksik kayıt, devre dışı, ağ kesintisi ve tekrar bağlantı senaryolarını doğrulayın. KV yayılımı anlık değildir. Henüz yayılmamış kayıt aktif değil görünebilir; yeniden doğrulayın. İstemcileri listeyi doldurmadan çevrimiçi doğrulamaya yönlendirmeyin.

Aktif listede bulunmama kontrolü için müşteriler **1.0.10 veya sonrasına** güncellenmelidir. Önceki paketler yeni `inactive` yanıtını tanımaz; eski paketlerde yalnızca önceden desteklenen imzalı iptal kontrolüne güvenilebilir.

## Doğrulama davranışı

- Aktif, cihaz kimliği eşleşen `license:<id>` kaydı varsa imzalı aktif yanıt verilir. İstemci kendi imza, TPM ve süre denetimini de yapar.
- Kayıt yoksa veya cihaz eşleşmiyorsa imzalı `inactive` yanıtı verilir. İstemci açılmaz; bu durum çevrimdışına geçince kaybolmaz. Geçerli aktif yanıt tekrar gelirse kaldırılır.
- **Devre dışı bırak**, müşteri kaydını fiziksel olarak silmez. `revoked:<id>` kaydı aktif kayıttan üstün gelir; istemci bu imzalı iptali kalıcı saklar. Yeni lisans kimliği gerekir.
- HTTP hatası, zaman aşımı, kota hatası, bozuk veya imzasız yanıt aktif değil anlamına gelmez. Önceden iptal/ret almamış, süresi geçerli yerel lisans çalışmaya devam eder.
- Müşteri lisans süresinin tamamında internetsiz çalışabilir. Bu nedenle uzak iptal ancak başarılı bağlantıda ulaşır. TPM internet bağlantısını zorlayamaz ve güvenilir takvim saati değildir.
- Yerel yönetim veritabanından elle satır silmek bulutta devre dışı bırakma işlemi değildir. Uygulamadaki düğmeyi kullanın.

## Bildirimler

Uygulama açılışında ve açıkken kalan süre kontrol edilir. 30 günden az kaldığında bilgi şeridi, 7 gün ve altında gün içinde kapatılabilen belirgin hatırlatma, son gün tam bitiş tarihi gösterilir. Süre uzatılınca eski hatırlatma kalkar. Uygulama kapalıyken Windows bildirimi veya e-posta gönderilmez. Süre sonunda lisans ekranı kilitlenir; proje yedekleme korunur.

Kaynak: https://developers.cloudflare.com/workers/platform/pricing/ ve https://developers.cloudflare.com/kv/platform/pricing/
