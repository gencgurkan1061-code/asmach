# ASMach Inspection 2.0.1

- Dosyadan açılan proje için Kaydet mevcut dosya bağlantısını korur. Farklı kaydet iptal edilirse mevcut bağlantı kaybolmaz.
- Kaydedilen projeler listesinden açılan yerel kopya aynı kayıt kimliği ile güncellenir; tekrar kayıt oluşturulmaz. Yerel kopyanın kaydı dışarıdaki proje dosyasını değiştirmez.
- Güncel OCR, karakteristik, dinamik birim, balon görünümü ve Ctrl+A düzenlemeleri kurulum ön yüzüne dahil edildi.
- MIN/MAX veya üst üste yazılmış iki limitten nominal orta nokta ve sapmalar hesaplanır. Özgün alt/üst limitler korunur; hesaplanan nominal arayüzde açıkça belirtilir. Örnek: 0.586–0.596 → 0.591 ±0.005.
- Eski kayıtların limit bilgisi korunarak eksik nominal alanı tamamlanır. Elle nominal düzenleme, tolerans düzenleme ve hassas ondalık değerler ayrı kurallarla işlenir.
- Nominal ve tolerans satırları ayrı bölgelerde okunur; orijinal, hafif ve güçlü görüntü okumaları aynı değerlendirme hattını kullanır. Dört yöndeki ölçüler, çap işareti ve küçük tolerans işaretleri için bölgesel kurtarma geliştirildi.
- GD&T pozisyon çerçevesinin hücre ayrımı iyileştirildi. Elle düzenlenen GD&T alanları gereklilik, önizleme ve OCR metniyle eşitlenir; datum sayısı en fazla üç tutulur.

Doğrulama: 13 masaüstü köprüsü/kurulum testi, proje kayıt hedefi ve yerel kayıt güncelleme testleri, kurulum GUID akışı, tür-birim geçişi ve Ctrl+A testleri geçti.

Güncel paket öncesi doğrulama: masaüstü köprüsü, kurulum akışı ve limit ölçüleri için 14 test grubu; kurulum GUID akışı; hesaplanan nominalin görünümü, kayıt geçişi ve elle düzenleme kontrolleri geçti. Son OCR geliştirmelerinde 12/12 temel bölgesel okuma ve 6/6 döndürülmüş örnek doğru nominal ve toleranslarla doğrulandı. Bu sonuçlar tüm çizimlerde hatasız OCR garantisi değildir; çelişkili okumalar kontrol gerektirir.

Paket kullanıcı bilgisayarına bu işlemde kurulmaz. Mevcut lisans ve proje dosyaları değiştirilmez. Çevrimiçi sürüm duyurusu ayrı bir adımdır; paket oluşturulması duyurunun yapıldığı anlamına gelmez.

## Yeniden oluşturulan kurulum paketi

- Oluşturulma: 15 Eylül 2026, 16:34 (Türkiye).
- Dosya: `src-tauri/target/release/bundle/nsis/ASMach Inspection_2.0.1_x64-setup.exe`
- Doğrulanan ürün sürümü: `2.0.1`; boyut: `244450261` bayt.
- SHA-256: `C5AAB64B2345FF112EAC1C55C08C9A07CD6D79C6A14CFD05852CBF4B084599BC`
- Dijital imza: yok (`NotSigned`).
- Önceki paket yedeği: `outputs/installer-backup-20260915-162939/ASMach Inspection_2.0.1_x64-setup.exe`
- Güncel on kritik ölçüm/OCR modülünün masaüstü paketine kaynakla birebir dahil edildiği doğrulandı; paketleme başarıyla tamamlandı.
