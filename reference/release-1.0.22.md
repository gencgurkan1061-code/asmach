# ASMach Inspection 1.0.22 · Çizim çıktıları

- Ayrı Çıktılar sekmesi kaldırıldı; kullanıcı tarafından sağlanan PDF ve Excel SVG simgeleriyle iki komut Çizim sekmesine taşındı.
- PDF: çizimi arkada bırakan, yeniden boyutlandırılabilir küçük pencere. Ayarlar değişince önizleme yenilenir; Yazdır ve PDF kaydet aynı belgeyi kullanır.
- Excel: önce aranabilir/kategorili şablon seçimi; seçimden sonra önizleme penceresi. Şablon seçimine geri dönüş, XLSX kaydetme, A4/A3/Letter ve yön seçimi bulunur. Şablon düzenleme/kaldırma komutları listede kalır.
- Windows uygulamasında Microsoft Excel, doldurulmuş çalışma kitabının tüm sayfalarını PDF yazdırma önizlemesine dönüştürür. İşlem arka planda çalışır; ayrı Excel örneği kullanılır, makrolar ve bağlantı güncellemeleri kapalıdır, kaynak şablon değiştirilmez. Geçici dosyalar dönüşüm sonrasında temizlenir.
- Tarayıcı HTML önizlemesi hücre görünümü ve XLSX kaydetmeyi destekler. Gerçek Excel yazdırma önizlemesi Windows uygulamasında ve Microsoft Excel kuruluyken kullanılabilir; tarayıcıdaki 300 satırlık hücre önizlemesi baskıya gönderilmez.

Kontroller: yeni pencere akışı, simgeler, PDF/XLSX kaydetme, kağıt değişikliğinde yenileme, yazdırma yönlendirmesi, Escape ve GD&T hücre görseli testi başarılı. Gerçek Microsoft Excel ile üretim dönüşüm betiği test raporundan PDF üretti. Fiziksel yazıcıya test çıktısı gönderilmedi. Rust release kontrolü ve 8 masaüstü köprü testi başarılı.
