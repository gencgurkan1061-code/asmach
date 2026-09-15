# ASMach lisans yönetimi

**Güncel davranış (1.0.10):** İptal kaydı bulunmaması artık tek başına yeterli değildir; lisans aktif listede de bulunmalıdır. Yayın sırası, ücretsiz plan ve çevrimdışı davranış için [ACTIVE-LICENSES.md](ACTIVE-LICENSES.md) belgesini izleyin.

## Yerel kurulum

`node scripts/license-admin.cjs init` komutu bir kez çalıştırılır. `.license-admin/license.pem` yalnızca lisans üretir; `.license-admin/status.pem` yalnızca çevrimiçi durum yanıtlarını imzalar. Özel anahtarlar istemci paketine dahil edilmez. Bu klasörü erişimi kısıtlı ve şifreli bir yedekte saklayın. Kaybedilen anahtarları değiştirmeniz mevcut paketlerin yeni lisansları kabul etmemesine neden olur.

1.0.8 ve sonrası için yönetim uygulamasında TPM seçeneğini kullanın. Aşağıdaki komut **yalnızca 1.0.7 ve önceki sürümlerin eski kimlikli lisansları** içindir:

```
node scripts/license-admin.cjs issue BILGISAYAR_KIMLIGI "Firma adı" 2027-09-12T23:59:59+03:00 musteri.asmach-license
```

Dosya müşteriye iletilir; ilk açılışta yüklenir. İlk etkinleştirme de tamamen çevrimdışı olabilir. Her yenileme yeni lisans kimliği üretir. İptal edilen eski kimlik tekrar kullanılamaz. Bilgisayar değişimi yeniden lisans düzenlemeyi gerektirir; eski çevrimdışı bilgisayar uzaktan anında kapatılamaz.

## Bulut yayını (hesap sahibi tarafından tamamlanmalı)

**1.0.8 güncellemesi:** Yönetim uygulamasındaki **Bulut ayarları**, **Süreyi değiştir** ve **İnternetten iptal et** kullanılmalıdır. Aşağıdaki eski elle KV iptali de aynı kayıt biçimini kullanır.

- Worker'a `ADMIN_TOKEN` adında en az 32 rastgele karakterli secret ekleyin. Bu anahtarı sadece yönetim uygulamasına girin; müşteri paketine koymayın. `LICENSE_PUBLIC_KEY` wrangler.jsonc içinde açık doğrulama anahtarıdır; `license.pem` özel anahtarı buluta gönderilmez.
- `STATUS_PRIVATE_KEY` secret'ını ekleyin. Yönetim API'leri yalnızca bearer yönetici anahtarıyla çalışır: `/admin/ping`, `/admin/license`, `/admin/revoke`. API token'ı Cloudflare hesap token'ından ayrıdır.
- Yayımdan sonra yönetim uygulamasında HTTPS Worker ana adresi ve ADMIN_TOKEN ile bağlantıyı sınayın. Yeni lisanslarda `/validate` adresi lisans imzasına dahil edilir. Eski, adres içermeyen dosyalar bulutu kendiliğinden bulamaz: süre değiştirerek yeni revizyon oluşturun ve bu dosyayı müşteriye bir kez yükleyin. Alternatif olarak müşteri paketinin endpoint ayarını doldurup yeniden derleyin.
- Süre değişiklikleri aynı lisans kimliğiyle artan revizyon taşır. Önceki kayıt geçmişte saklanır; yeni revizyon ayrı dosyadır. Çevrimiçi istemci hem durum imzasını hem lisans üretim imzasını doğrular. Sadece durum anahtarı süre uzatamaz. Yeni revizyon geldikten sonra eski revizyon geri yüklenemez (yerel veritabanı bütünüyle geri alınmasına karşı mutlak koruma değildir).
- KV eventual consistency kullanır: yayılım anlık değildir. Yönetimi tek bilgisayardan sırayla yapın, aynı lisansı birden çok yöneticiden eşzamanlı değiştirmeyin. İptal kaydı silinmez; müşteriye ulaşınca çevrimdışında da kilit sürer. Canlıya almadan ayrı test lisansında iptal, süre kısaltma, süre uzatma, kesinti ve tekrar bağlanma sınanmalıdır.
- Dağıtım komutları: proje altında `npx wrangler login`, `npx wrangler kv namespace create REVOCATIONS`, namespace kimliğini yapılandırmaya yazma, `npx wrangler secret put STATUS_PRIVATE_KEY`, `npx wrangler secret put ADMIN_TOKEN`, `npx wrangler deploy`. Secret'ları sohbet, kaynak dosyası veya terminal komut argümanı olarak yazmayın; gizli giriş/Cloudflare panelini kullanın. Cloudflare hesabı ücret/limit koşullarını hesap sahibi onaylamalıdır.

Kaynaklar: [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [KV tutarlılığı](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

1. Cloudflare hesabında MFA etkinleştirin. Bir Workers KV namespace oluşturup kimliğini wrangler.jsonc içine yazın.
2. `STATUS_PRIVATE_KEY` Worker secret değerine yalnızca `.license-admin/status.pem` içeriğini koyun. `license.pem` dosyasını asla buluta veya müşteriye göndermeyin.
3. Worker'ı yayımlayın; HTTPS `/validate` adresini `src-tauri/license-config.json` içindeki endpoint alanına yazın. İki public key korunmalı. Paketi yeniden derleyin.
4. İptal için Cloudflare yönetimindeki ilgili KV namespace içinde `revoked:LISANS_KIMLIGI` anahtarı oluşturup değerini `1` yapın. Yönetim için açık, şifresiz HTTP uç noktası YOKTUR. KV yayılımı nedeniyle iptal hemen tüm bölgelerde görünmeyebilir. Test lisansıyla uçtan uca doğrulayın.
5. Yanlış iptal durumunda aynı lisansı yeniden açmak yerine yeni kimlikli lisans düzenleyin; alınmış imzalı iptal kaydı istemcide kalıcıdır.

Kullanıcının internet kesintisi lisansı iptal etmez. Aktif durum yanıtı abonelik süresini uzatmaz. Uygulama açılışta kontrolü en fazla 8 saniye bekler; yerel lisans geçerliyse bağlantı olmadan devam eder. Açıkken her dakika yerel süre, altı saatte bir çevrimiçi durum kontrol edilir; bağlantı geri geldiğinde de kontrol tetiklenir.

## Güvenlik sınırları ve yayın kontrolü

- İmza doğrulaması Rust içinde Ed25519 ile yapılır. Çevrimiçi yanıtlar ayrı anahtarla, istek nonce'u, lisans ve cihaz kimliği ile doğrulanır.
- 1.0.8'de `requireTpm:true`: Windows Platform Crypto Provider içinde dışarı aktarılamayan ECDSA anahtarı kullanılır. Her doğrulamada rastgele veri imzalanıp Rust tarafında doğrulanır. Anahtar TPM ve Windows kullanıcı profiline bağlıdır; hesap/TPM sıfırlamasında yeni lisans gerekir. TPM güvenilir takvim saati değildir. Saat geriye alma denetimi yerel en yüksek görülen zamanı kullanır; yönetici yetkili saldırgan, veritabanı geri yükleme ve değiştirilmiş uygulamaya karşı mutlak koruma sağlamaz. Önceki sürümlerde MachineGuid bağı vardı.
- Lisans alınmadan uygulama modülleri yüklenmez. Çizim açma ve rapor/Excel/PDF işlemlerinde ek Rust kontrolü vardır. UI içindeki tüm hesaplamalar Rust'a taşınmış değildir; kaynak HTML geliştirme çıktısı lisanslı dağıtım değildir, müşteriye verilmemelidir.
- Süre dolduğunda veya iptal geldiğinde çalışma ekranı kilitlenir; lisans yükleme ve mevcut proje/kurtarma yedeğini kaydetme açık kalır. Tam salt-okunur proje görüntüleyicisi bu sürümde yoktur. Proje dosyaları silinmez.
- `.license-admin` hiçbir dağıtım arşivine veya kaynak paylaşımına eklenmemeli. Derlenen müşteri paketi yalnızca dist-desktop ve Tauri bundle çıktılarıdır. Anahtarlar, geliştirme HTML'i ve kaynaklar dağıtılmamalı.
- Sunucu hesabı, namespace, secret ve endpoint yayınlanmadan uzaktan iptal çalışmaz. Çevrimdışı abonelik imzalama ve doğrulama bağımsız çalışır.
