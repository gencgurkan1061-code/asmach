# Cloudflare ücretsiz kullanım optimizasyonu

## Değişiklikler

- `/validate`: anahtarlı lisanslarda güncel cihaz bağlantısı ve iptal kararı doğrudan mevcut SQLite Durable Object kaydından okunur. Normal kontrolde KV okunmaz/yazılmaz. Eski kayıtlardaki KV iptalleri bir defalık, geri alınamaz biçimde devralınır.
- `/ack`: HMAC, kısa geçerlilik penceresi ve cihaz imza kanıtı doğrulandıktan sonra küçük son-kontrol kaydı Durable Object içine yazılır. KV yazma sınırı tüketilmez. Lisans belgesi yeniden yazılmaz. Tekrar oynatılan onaylar son kontrol zamanını ilerletmez; eski aktif yanıt iptal teslimini silemez.
- Yönetici detay ekranı yeni son-kontrol kaydını okur; eski KV geçmişi varsa geri uyumlu biçimde gösterir.
- Yalnızca içe aktarılmış kriptografik anahtarlar bellekte tekrar kullanılır. Aktif/iptal kararları, süre revizyonları veya nonce içeren yanıtlar önbelleğe alınmaz.
- Cihaz bağlama sertifikası için gereksiz ikinci teslim-onayı HMAC'i üretilmez; lisans ve cihaz sertifikası imzaları korunur.
- Mevcut istemcilerle protokol uyumludur. 1.0.21'in yeniden kurulması gerekmez. Ücretli ürün/abonelik açılmadı.

## Değişmeyen güvenlik

30 dakikalık çevrimiçi kontrol, bağlantı hatasındaki mevcut yeniden deneme, TPM cihaz kanıtı, tek cihaz etkinleştirme kilidi, lisans ve bulut imzaları, isteğe özgü nonce, sürenin yerel denetlenmesi, saat/versiyon geri alma kontrolleri ve kalıcı iptal korunur. Depo hatasında önbellekten “aktif” cevabı üretilmez. Tam çevrimdışı kullanımda iptalin anında iletilememesi önceki modelin değişmeyen sınırıdır.

## 100–500 bilgisayar hesabı

Varsayım: her bilgisayar 24 saat açık; 30 dakikada bir doğrulama + ayrı cihaz onayı; açılışlar, yeniden denemeler, yönetici işlemleri ve saldırı trafiği hariç.

| Bilgisayar | Worker isteği/gün | DO isteği/gün | Yaklaşık normal son-kontrol kaydı/gün |
|---|---:|---:|---:|
| 100 | 9.600 | 9.600 | 4.800 |
| 500 | 48.000 | 48.000 | 24.000 |

Bir son-kontrol kaydı bir SQLite KV `put` işlemidir; faturalandırılan satır/metadata sayısı ve CPU/süre kullanımı gerçek Cloudflare ölçümlerine bağlıdır. Bunlar kapasite tahminleridir, ücretsiz kullanım garantisi değildir. Eski dosya lisansları normal kontrolde en fazla iki KV okumasını korur (500 cihaz için yaklaşık 48.000 okuma/gün); son-kontrol yazıları onlar için de yeni depoya gider. Yeni anahtarlı lisanslarda rutin KV işlemi sıfırdır; etkinleştirme ve yönetim işlemleri KV kullanmaya devam eder.

12 Eylül 2026'da doğrulanan ücretsiz sınırlar: Worker 100.000 istek/gün; DO 100.000 istek/gün, 13.000 GB-s/gün, 5 milyon satır okuma ve 100.000 satır yazma/gün; KV 100.000 okuma ve 1.000 yazma/gün. Aynı hesaptaki diğer hizmetler de ilgili kotayı paylaşır. Free planda limit aşımı işlemleri durdurabilir; ücretsiz ve sınırsız hizmet mümkün değildir. Hesabın ücretli plana geçirilmemesi ayrıca hesap ayarlarından korunmalıdır; bu çalışma hesap aboneliğini değiştirmez.

Kaynaklar:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/kv/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

## Doğrulama

13 yerel servis/yönetici testi: tek cihaz yarışı, yanlış imza/cihaz, eski lisanslar, iptal geçişi, nonce yeniliği, KV işlemlerinin sıfırlanması, onay tekrarları ve depo hatasında kapalı güvenlik davranışı. Canlı denemeler yalnızca kısa süreli QA lisansı kullanır; kullanıcı lisansları değiştirilmez.
