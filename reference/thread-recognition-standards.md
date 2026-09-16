# OCR diş gösterimi kapsamı

Bu dosya OCR ayrıştırıcısının uyguladığı gösterim kurallarını ve güvenlik sınırını kaydeder.

| Aile | Tanınan örnekler | Kaydedilen standart |
| --- | --- | --- |
| ISO metrik | `M3`, `M3x0.5-6H`, `6x M8x1.25-6H`, `LH/RH` | ISO 261; sınıf varsa ISO 965-1 |
| Birleşik inç | `#10-24 UNC-2B`, `1/4-20 UNC-2A`, UN/UNR/UNJ/UNF/UNEF/UNS | ASME B1.1 |
| Amerikan boru | `1/16-27 NPT`, `NPT 1/16`, NPTF/NPTR/NPSC/NPSM/NPSL | ASME B1.20.1 veya B1.20.3 |
| ISO boru | `G 1/4 A`, `R 1/4`, `Rc 1/8`, `Rp 1/8`, BSPP/BSPT | ISO 228-1 veya ISO 7-1 |
| Trapez metrik | `Tr20x4`, `Tr20x4(P2)-7e`, `LH/RH` | ISO 2902; sınıf varsa ISO 2903 |

`NPT16`, yalnız tam olarak bu biçimde geldiğinde `NPT 1/16` OCR kaybı olarak yorumlanır ve kullanıcıya doğrulama uyarısı eklenir.

Diş nominali gerçek dış çap değildir. Uygulama gösterimi, adımı/TPI değerini ve sınıfı ayrı alanlara ayırır; genel doğrusal toleransı dişe uygulamaz. Tam boyut limitleri için lisanslı standardın ilgili baskısındaki çap/adım/sınıf tabloları veya doğrulanmış üretici verisi gerekir. Böyle bir veri yoksa değerlendirme `OK / NOT OK` ve mastar kontrolü olarak kalır.

Resmî kapsam kaynakları:

- https://www.iso.org/standard/4165.html
- https://www.iso.org/standard/87889.html
- https://www.iso.org/standard/20819.html
- https://www.asme.org/wwwasmeorg/media/codes-standards/find-codes/c-t_b1_1_2024.pdf
- https://www.asme.org/getmedia/f61f5671-777b-4d39-b4ea-49160e0a913c/35723.pdf
