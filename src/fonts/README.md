# Fredoka (gömülü)

Oyunun tek üçüncü taraf varlığı. Google Fonts CDN'inden çekilmiyor, projeye gömülü:

- **Çevrimdışı:** oyun bir PWA ve uçak modunda da açılmalı. CDN'den gelen bir yazı
  tipi, servis çalışanının önbelleğine giremediği için ilk çevrimdışı açılışta
  yedek yazı tipine düşürüyordu.
- **Gizlilik:** Google Fonts CDN'i ziyaretçinin IP adresini Google'a iletir. Bir Alman
  mahkemesi 2022'de bunu KVKK/GDPR ihlali saydı (LG München I, 3 O 17493/20). Mağaza
  sürümünde bu sorumluluk bize ait olurdu.
- **Hız:** üçüncü bir alan adına DNS + TLS el sıkışması yok.

## Dosyalar

`fredoka-latin.woff2` ve `fredoka-latin-ext.woff2` — Google Fonts'un yayınladığı alt
kümelerin aynısı (v17). Fredoka **değişken** bir yazı tipidir: tek dosya 300–600
arası tüm ağırlıkları taşır, bu yüzden ağırlık başına ayrı dosya yok. Türkçe'ye özgü
harfler (ğ, ı, ş ve büyükleri) `latin-ext` alt kümesindedir; ö, ü, ç `latin` içinde.
İkisi de gerekli.

## Lisans

SIL Open Font License 1.1 — ticari kullanıma ve uygulamaya gömmeye izin verir.
Lisans metni: `licenses/Fredoka-OFL.txt`. OFL'in tek katı kuralı, yazı tipinin
"Fredoka" adıyla satılmaması ve değiştirilirse adının değiştirilmesidir; ikisini de
yapmıyoruz.

## Güncelleme

Dosyalar elle indirildi; yeniden indirmek gerekirse Google Fonts'un css2 uç noktasını
modern bir tarayıcı User-Agent'ıyla çağırıp woff2 bağlantılarını almak yeterli:

    https://fonts.googleapis.com/css2?family=Fredoka:wght@300..600&display=swap
