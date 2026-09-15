# ASMach Lisans Yönetimi

## Çevrimdışı süreli etkinleştirme

Müşteri bilgisayarı güvenlik duvarı nedeniyle doğrulama hizmetine ulaşamıyorsa:

1. Müşteri uygulamasında **İnternet yoksa çevrimdışı etkinleştir** bölümünü açar ve bilgisayar kimliğini kopyalar.
2. Lisans yöneticisinde yeni lisans oluştururken **TPM · Yeni sürümler** seçilir, bu kimlik yapıştırılır ve lisans süresi belirlenir.
3. Oluşan lisans satırında **Çevrimdışı kod** seçilir. Kopyalanan `ASM-OFF1-...` kodu müşteriye gönderilir.
4. Müşteri kodu aynı bölüme yapıştırıp **Çevrimdışı etkinleştir** düğmesine basar.

Bu kod, imzalı lisans dosyasının taşınabilir biçimidir; yalnız girilen TPM bilgisayar kimliğinde ve belirlenen tarihler arasında çalışır. İlk cihazda çevrimiçi bağlanma seçeneğiyle oluşturulmuş, henüz bir bilgisayara bağlanmamış lisans için çevrimdışı kod üretilemez. Böyle bir durumda bilgisayar kimliğine bağlı yeni lisans oluşturulmalıdır.

## 1.0.10 güncellemesi

İnternetten iptal işleminin adı **Devre dışı bırak** oldu; işlem geçmişi ve müşteri kaydı silinmez. **Buluta gönder**, mevcut lisansı aktif listeye yayımlar. Yeni lisanslar bağlantı yapılandırılmışsa otomatik yayımlanır; hata durumunda yeniden gönderilmesi gerektiği gösterilir. Eski, adres içermeyen lisanslar aynı bitişle yeni dosyaya dönüştürülür. Canlıya geçişte tüm geçerli lisanslar yayımlanmalıdır. Ayrıntılar: [Aktif lisans listesi](../licensing-service/ACTIVE-LICENSES.md).

Proje klasöründeki **ASMach Lisans Yönetimi.exe** ile açılır. Yönetim penceresi Edge'in uygulama görünümünü kullanır. Dosya ile lisans üretimi internetsizdir; buluta süre değişikliği veya iptal yayımlamak internet gerektirir. Node çalışma ortamı yanındaki `license-manager/runtime` klasöründe bulunur; Codex açık olmak zorunda değildir. EXE dosyasını tek başına taşımayın. Kısayol oluşturabilirsiniz.

## Kullanım

- Çevrimiçi lisans: **Çevrimiçi lisans · Anahtarla etkinleştir** seçilir. Kayıttaki **Çevrimiçi anahtarı göster** düğmesi anahtarı görünür ve kopyalanabilir olarak açar.
- Çevrimdışı lisans: müşterinin TPM bilgisayar kimliğiyle oluşturulur. **Çevrimdışı kodu göster** düğmesi süreli ve cihaz bağlı kodu görünür ve kopyalanabilir olarak açar.
- Lisans dosyası: bilgisayar kimliğine bağlı kayıtta **Lisans dosyasını indir** veya **Lisans dosyasını kaydet** kullanılabilir. Çevrimiçi ilk-etkinleştirme kaydında bilgisayar henüz belli olmadığı için bu seçenekler açıklamalı olarak kapalıdır.
- Yeni lisans: müşteri adı, müşterinin uygulamasındaki bilgisayar kimliği ve tarihleri girin. Lisans oluşturulduğunda `Lisanslar` klasörüne kaydedilir.
- Dosyayı kaydet: mevcut imzalı lisansın aynı kopyasını `Lisanslar` klasörüne kaydeder. İndir: Windows indirme konumuna kopyalar.
- Yenile: müşteri ve bilgisayar bilgilerini korur; varsayılan olarak mevcut bitiş veya bugün, hangisi ilerideyse, oradan bir yıl uzatır. Tarihi değiştirebilirsiniz. Yeni lisans kimliği oluşturulur; eski kayıt silinmez. Yenileme eski dosyayı müşterinin bilgisayarında kendiliğinden değiştirmez; yeni dosya yüklenmelidir.
- Süreyi değiştir: aynı lisans kimliğinin yeni imzalı revizyonunu oluşturur. Önceki tarih ve bilgiler işlem geçmişinde kalır, dosya adı revizyonla ayrılır. Bulut bağlıysa yayımlanır; bağlantı hatasında yerel dosya korunur ve yayımlanmadığı açıkça bildirilir.
- Bulut ayarları: yayımlanmış Cloudflare Worker adresi ve yönetici anahtarı girilir. Başarılı bağlantı sınamasından sonra kaydedilir. Hesap/servis henüz yayımlanmadıysa çevrimiçi iptal düğmesi kapalı kalır.
- İnternetten iptal et: hizmet başarılı yanıt verdikten sonra kaydı iptal edildi gösterir. Çevrimdışı müşteriye anında ulaşamaz; müşteri başarılı çevrimiçi doğrulamada kilitlenir. Eski yerel iptal talepleri geçmişte korunur ama kendiliğinden yayımlanmaz.
- 1.0.8 için TPM korumasını seçin. Müşteri lisans ekranında TPM kimliğini oluşturmalıdır. Önceki sürümlerin MachineGuid kimliği yeni TPM dosyasının yerine kullanılamaz.
- İşlem geçmişi oluşturma, yenileme, dosya kaydı ve iptal taleplerini saklar. Eski komut satırı üretimleri ilk açılışta otomatik aktarılır.

## Veri ve güvenlik

Anahtarlar ve yerel SQLite yönetim kayıtları `.license-admin` klasöründedir. Özel anahtarlar tarayıcıya veya müşteri paketine gönderilmez. Yerel hizmet sadece `127.0.0.1` üzerinde rastgele bir portta dinler; her açılış için ayrı, güçlü bir oturum anahtarı kullanır, farklı kökenlerden gelen istekleri reddeder. Anahtar URL'nin sunucuya gönderilmeyen fragment bölümünden alınır ve adres çubuğundan temizlenir. Bu, aynı Windows hesabında çalışan kötü amaçlı yazılımlara karşı koruma garantisi değildir.

Yönetici dosyalarını müşterilere göndermeyin. Müşteriye yalnızca müşteri kurulum paketi ve `.asmach-license` dosyası verilir. Kaynak proje klasörü, yönetici EXE'si ve `.license-admin` paylaşılmamalıdır.

Yedek için tüm yönetim pencerelerini **Çıkış** ile kapattıktan sonra `.license-admin` klasörünün tamamını şifreli, erişimi kısıtlı bir ortama kopyalayın. Açık veritabanının sadece `manager.sqlite3` dosyasını kopyalamayın; WAL dosyalarında yeni işlemler bulunabilir. Anahtarları kaybederseniz mevcut müşteri paketlerine uyumlu lisans üretemezsiniz.

Pencere kapandıktan sonra hizmet en fazla 30 dakika içinde kendiliğinden kapanır. Çıkış düğmesi hizmeti hemen durdurur. Uygulama açılmazsa `license-manager/startup-error.log` kontrol edilir.

Bu bilgisayarın ilk lisansı `Lisanslar/Bu-bilgisayar-1-yil.asmach-license` dosyasıdır; 12 Eylül 2027 saat 04:27 (Türkiye) tarihinde sona erer.

TPM geçiş dosyası `Lisanslar/Bu-bilgisayar-TPM.asmach-license` aynı bitişi korur. Önce 1.0.8 paketini kurun, sonra bu dosyayı lisans ekranından yükleyin. Eski sürümün lisans veritabanı otomatik değiştirilmez. Cloudflare adresi yayın sonrası dosyaya eklenene kadar bu dosya çevrimdışı çalışır; uzaktan iptal için güncel adresli revizyonu yüklemek gerekir.
