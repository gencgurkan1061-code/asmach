# Eğitilmiş ölçü modeli — etkin değil

Gerçek Tesseract LSTM ağırlıkları bu klasörde saklanır; ikinci motor değildir. 4.800 eğitim satırı, ayrı 200 doğrulama satırı ve eğitime girmeyen 100 ölçü görüntüsüyle değerlendirildi.

Uygulama sonucunda mevcut model **84/100**, bu aday **77/100** tam doğru ölçü verdi. Ortalama okuma süresi **1.249 ms → 1.288 ms** oldu. Önceden doğru okunan 9 ölçü bozuldu. Bu nedenle `enabled: false` korunur. Bu dosyaları tek başına kopyalamak modeli uygulamada etkinleştirmez; uygulama ve kurulum paketine gömülmezler.

`evaluation-100.json` bütün ölçü sonuçlarını; `training-report.json` eğitim ve doğrulama bilgilerini; `source-manifest.json` kaynak ve indirme özetlerini içerir. Model kaynak lisansı `LICENSE` dosyasındadır.

Aktifleştirmek için JSON değerini değiştirmek yeterli değildir: paket oluşturucu doğruluk, hız, veri/model/kaynak bütünlüğü kontrollerini yeniden doğrular ve başarısız adayı reddeder. Ayrıntılı yöntem: `reference/technical-tesseract-model.md`.
