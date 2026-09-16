# Yayın deposu

`worker.mjs` bir Cloudflare Worker modülüdür. Ücretsiz kurulum için
`RELEASES_KV` adlı KV binding kullanılır; R2 etkin hesaplarda aynı hizmet
`RELEASES` adlı R2 binding ile de çalışır. `ADMIN_TOKEN` secret (en az 32
rastgele karakter) ve uygulamadaki mevcut
güncelleme doğrulama anahtarını içeren `UPDATE_PUBLIC_KEY` gerekir.
Özel imza anahtarı sunucuya yüklenmez. Bu kurulum mevcut statik yayın
adresini korur. Kurulum paketleri 8 MiB parçalara ayrıldığı için KV'nin tek
değer boyutu sınırını aşmaz.

Lisans yöneticisinde Sürümler > Bağlantı bölümüne Worker kök adresi ve
ayrı yayın anahtarı girilir. Lisans servisinin yönetici anahtarı kullanılmaz.
Kararlı depo adresi `src-tauri/updater-config.json` ile aynı origin olmalıdır.
Test istemcisi `/test/update.json`, üretim istemcisi `/update.json` kullanır.

Paketler 8 MiB parçalara ayrılır. Parçalar değiştirilemez; aynı içerikle
yeniden yükleme güvenlidir. Kanal değişikliği koşullu R2 yazımıyla atomiktir.
İmza ve parça bütünlüğü sunucuda doğrulanmadan kanal değiştirilmez.
Her kanalda tek aktif paket vardır (online veya offline). Eski sürüm kaydı
yeniden yayımlanamaz; geri alma için daha yüksek sürümlü düzeltme gerekir.

Yayını durdurmak yeni manifest isteğini kapatır; önceden indirilen manifesti
ve dosyayı geri alamaz. Mevcut istemci bu durumda güncelleme kontrol hatası
gösterebilir; müşteri lisansı değişmez. Paketler arşivde kalır.
Yerel `.release-admin/releases` arşivi ve yayın anahtarı mevcut lisans
yedeğinin kapsamına dahil değildir; ayrıca güvenli yedek gerekir.
