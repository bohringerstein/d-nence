# Dönence: Teknik Şartname

Bu belge oyunun nasıl çalışması gerektiğini tanımlar. Çalışan bir referans sürüm `reference/donence.html` içinde bulunur. Belge ile referans çelişirse bu belge geçerlidir; belirsiz kalan her konuda referans sürümün davranışı esas alınır.

## 1. Oyunun özeti

Dönence, tek dokunuşla oynanan, level tabanlı, 2 boyutlu bir mobil oyundur. Ekranın ortasında bir top ve etrafında iç içe dönen 2 ila 6 halka vardır. Her halkada bir (bazen iki) boşluk bulunur.

Oyuncu ekrana her dokunduğunda, dıştan içe doğru sıradaki dönen halka olduğu yerde kilitlenir. Kilitli halkaların boşluklarının ortak kesişimi, ekranda sarı bir kama olarak görünen **açıklığı** oluşturur. Her yeni kilit bu açıklığı ancak daraltabilir. Açıklık topun geçemeyeceği kadar daralırsa oyuncu kaybeder. Tüm halkalar kilitlenince top açıklığın ortasından dışarı fırlar ve level tamamlanır.

Oyunun temel fikri şudur: her dokunuş öncekilerin sonucunu taşır. İlk kilit kanalın yönünü belirler; sonraki her küçük hata, kalan halkalar için ortak hata payını tüketir.

Tasarım ilkeleri:
- Tek kontrol (dokunma, boşluk ya da Enter tuşu). İkinci bir kontrol eklenmez.
- **Dokunma alanı ekranın tamamıdır**, yalnızca oyun alanı değil. Üst çubuk, süre çubuğu ve alt çubuk da kilitler; dışarıda kalan tek şey düğmeler ve açık bir örtüdür. Bir dönem dinleyici yalnızca canvas'taydı ve çubuklar ölü bölgeydi: alt çubuk büyüyünce ölü bölge ekranın %29'una çıktı, üstelik tamamı telefonu tutan başparmağın durduğu yerdeydi — oyuncu kilitlemek için basıyor, hiçbir şey olmuyordu. Oyunun kendi açıklaması da ("Ekrana her dokunduğunda…") bunu vaat eder.
- Zorluk yeni mekaniklerle değil, parametrelerle artar.
- Kaybetmek hızlı ve adildir: 1 saniyeden kısa sürede level yeniden başlar.
- Her level simülasyonla çözülebilirliği kanıtlanmış olarak gelir.

## 2. Koordinatlar ve geometri

Tüm ölçüler oyun alanının kısa kenarına (`S = min(genişlik, yükseklik)`) oranlanır, böylece oyun her ekranda aynı zorlukta kalır.

| Değer | Formül |
|---|---|
| En dış halka yarıçapı | `0.44 × S` |
| En iç halka yarıçapı | `0.17 × S` |
| Halkalar arası mesafe | `(dış − iç) / (halka sayısı − 1)` |
| Top yarıçapı | `0.022 × S` |
| Halka çizgi kalınlığı | `S × 0.018`, 5 ile 9 piksel arasında sınırlı |

Açılar radyan cinsindendir; 0 sağ, açı saat yönünde artar (canvas standardı). Halka listesi dıştan içe sıralıdır: `rings[0]` en dış halkadır.

**Gereken açıklık (NEED):** Topun en iç halkadan geçebilmesi için gereken en küçük açı:

```
NEED = 2 × asin(0.022 / 0.17) + 3°  ≈ 17,9°
```

Top/iç halka oranı sabit olduğundan bu değer ekran boyutundan bağımsızdır. Geometri oranları değiştirilirse `NEED` değişir ve **tüm level tablosu yeniden üretilmelidir** (bkz. bölüm 8).

## 3. Halka modeli

Her halka şu alanlarla tanımlanır (level tablosundaki biçim):

| Alan | Tür | Anlamı |
|---|---|---|
| `speed` | sayı | Dönüş hızı, rad/sn. İşaret yönü belirtir. |
| `gap` | sayı | Boşluk genişliği, derece. |
| `gaps` | 1 veya 2 | Boşluk sayısı. |
| `gapOffset` | sayı | İkinci boşluğun birinciye göre açısı, derece. |
| `flip` | sayı | Kaç saniyede bir yön değiştirir. 0 = hiç. |
| `wobble` | bool | Hızı sinüs dalgasıyla değişir mi. |
| `preLocked` | bool | Level başında kilitli mi. |
| `start` | sayı | Başlangıç açısı, rad (birinci boşluğun merkezi). |

Oyun sırasında her halkaya şu durum alanları eklenir: `angle` (başlangıçta `start`), `dir` (başlangıçta 1), `t` (yön değişimi sayacı, başlangıçta 0), `locked` (başlangıçta `preLocked`).

**Hareket fonksiyonu.** Oyun ve level üretici birebir aynı fonksiyonu kullanmalıdır (`src/core/rings.ts` içindeki `stepRings`). `lt`, levelin başından beri geçen süredir:

```
kilitli değilse:
  t += dt
  flip > 0 ve t >= flip ise: t = 0, dir = −dir
  w = wobble ? 1 + 0,7 × sin(lt × 2,3 + start) : 1
  angle += speed × dir × w × dt
```

**Sabit zaman adımı (zorunlu).** Referans sürüm değişken `dt` kullanır; yeni sürüm fizik güncellemesini sabit `1/120 sn` adımla yapmalıdır (biriktirici döngü, "fixed timestep accumulator"). Level süreleri bu adımla hesaplanmıştır ve yön değiştiren halkalar adım büyüklüğüne duyarlıdır. Çizim ekran yenileme hızında kalabilir.

**Girdi zamanlaması — kare hızından bağımsız olmalıdır.** Dokunuşlar **kendi zaman damgalarıyla** (`PointerEvent.timeStamp`) kuyruğa alınır ve fizik saati o ana ulaştığında işlenir; sapma en fazla bir fizik adımıdır (8,3 ms) ve ekran hızıyla değişmez.

*Neden:* tarayıcı dokunuş olayını anında üretir ama oyun onu ancak bir sonraki animasyon karesinde okuyabilir. Damga kullanılmazsa dokunuş o karenin başına yuvarlanır ve 60 fps'te ±8,3 ms sapar — en zor bölümlerde oyuncunun TÜM hata payının (25 ms) üçte biri. Üstelik bu sapma ekran hızına bağlıdır: 120 Hz telefonda oyun 60 Hz telefondan kolay olurdu. Bu, oyuncunun kendi hatası değil motorun eklediği hatadır.

`src/game/input.test.ts` bunu 30, 60, 90 ve 120 fps'te sınar: aynı gerçek dokunuş anı hepsinde aynı fizik adımında işlenmelidir.

**Duraklatma.** Biriktiricinin üst sınırı 0,25 sn'dir ve sekme arkaplana alınınca oyun durur. Sınır olmazsa arkaplandan dönüşte biriken süre tek karede yüzlerce fizik adımı olarak çalışır (ya donma, ya anında kayıp). Oyuncu yokken geçen süre levele yazılmaz.

Halka yalnızca oyun "bekleme" (idle) durumundayken hareket eder. Kilitlendikten sonra açısı donar.

## 4. Açıklık hesabı

Çember 720 dilime bölünür (dilim başına 0,5°). `mask[b] = 1` o dilimin şu ana kadar kilitli tüm halkaların bir boşluğunun içinde olduğunu belirtir.

- Level başında tüm dilimler 1'dir. Baştan kilitli halkalar hemen uygulanır.
- Bir halka kilitlenince: her açık dilim için, dilimin orta açısı halkanın herhangi bir boşluk merkezine `gap / 2`'den yakın değilse dilim 0 olur.
- **En büyük açıklık:** çembersel olarak en uzun ardışık açık dilim dizisidir (başa sarmayı hesaba katarak).
- **Kayıp koşulu:** kilitten sonra en büyük açıklık `ceil(NEED / 0,5°)` dilimden kısaysa oyuncu kaybeder. Bu eşik `src/core/geometry.ts` içinde tek bir yerde, `NEED_PASS = ceil(NEED / 0,5°) × 0,5°` (= 18,0°) olarak tanımlıdır ve oyun da level üretici de onu kullanır. Eskiden üç ayrı yerde üç farklı değer vardı (17,871° / 18,0° / 18,871°).
- **Kazanma:** son hareketli halka geçerli şekilde kilitlenince top, en büyük açıklığın ortasındaki açı boyunca fırlatılır.

Level üretici, hız gerektirdiği için dilim yerine **analitik aralık kesişimi** kullanır: açık bölge `{merkez, genişlik}` aralıklarının listesidir ve her kilit bu listeyi kesiştirir. İki yöntemin en fazla 1 dilim farklı olması zorunludur; `src/core/core.test.ts` bunu rastgele senaryolarda, `src/core/levels.test.ts` ise 1000 bölümün tamamında referans çözücünün yolunu oyunun maske modelinden geçirerek sınar.

## 5. Süre ve yıldızlar

**Süre sınırı:** her levelin `limit` değeri tabloda hazır gelir. Süre level yüklendiği anda başlar, son kilitte durur. Süre biterse level kaybedilir.

**Yıldızlar hassasiyeti ölçer, hızı değil.** Kasa açıldığında:

```
minGap = leveldeki en küçük gap (radyan)
q = (en büyük açıklık − NEED_PASS) / (minGap − NEED_PASS)
3 yıldız: q >= q3   "Temiz açılış"
2 yıldız: q >= q2   "İyi açılış"
1 yıldız: aksi      "Kıl payı"
```

`q3` ve `q2` level tablosunun en üstünde gelir. **Bu belgeye sayı yazılmaz**: değerler tablo her üretildiğinde yeniden hesaplanır (bu yazının yazıldığı sırada 0,67 ve 0,42). Oyun bunları `levels.json`'dan okur, koda gömmez.

**Eşikler ustalık referansından hesaplanır.** Yıldız "iyi oynamanın" karşılığıdır, ortalama oyuncunun değil. Bu yüzden eşikler, açıklığın en geniş anını bekleyip vuran ve zamanlaması 35 ms sapan bir oyuncunun (`playUsta`, `tools/gen.ts`) her levelde 25 kez oynadığı sonuçların %75'lik ve %40'lık dilimlerinden alınır. Hedef: bu oyuncu levellerin yaklaşık %25'inde 3 yıldız, %60'ında en az 2 yıldız alsın.

*Neden:* eşikler eskiden zorluk kalibrasyonunda kullanılan `play()` modelinin yüzdeliklerinden geliyordu, ama o model nişan almaz — açıklık yeterince genişleyince basar. Nişan almayı öğrenen gerçek bir oyuncu 60 levelin 52'sinde 3 yıldız alıyor, 11-20 arasında %100'e çıkıyordu; ustalığın gidecek yeri kalmıyordu.

**Rekor:** her level için en iyi `{ yıldız, süre }` saklanır. Daha çok yıldız her zaman daha iyidir; eşit yıldızda kısa süre kazanır.

## 6. Oyun akışı ve durumlar

Durumlar: `idle` (oynanıyor), `fire` (top fırlıyor), `crash` (kayıp).

| Olay | Sonuç |
|---|---|
| Dokunuş, `idle` iken | Sıradaki kilitsiz halka kilitlenir. Diğer durumlarda dokunuş yok sayılır. |
| Açıklık kapandı | `crash`: kilitlenen halka kırmızı, ekran sarsılır, 0,9 sn sonra aynı level yeniden başlar, deneme sayısı artar. |
| Süre doldu | `crash`: tüm halkalar kırmızı, aynı akış. |
| Son halka kilitlendi | `fire`: top dışarı uçar, yeşil flaş, 1,4 sn sonra sonraki level. |

**Bilinen hata, tekrarlanmamalı:** önceki bir sürümde kayıp sonrası sayaç sıfırlanmadığı için kazanınca oyun donuyordu. Level her yüklendiğinde tüm zamanlayıcılar, sayaçlar ve animasyon değerleri sıfırlanmalıdır.

## 7. Arayüz

Dikey düzen, yukarıdan aşağıya:

1. **Üst çubuk:** solda "Dönence", ortada kalan süre (0,1 sn hassasiyet, virgülle), sağda **"Level N / 1000"** (patron levelinde sonuna ", patron" eklenir).
   Toplam sayı şart: 1000 bölümlük bir oyunda "Level 347" tek başına nerede olduğunu söylemez. Numara kalın, geri kalanı künye tonunda ve küçük punto — "patron" da sonekin içindedir, çünkü kalın 1,4 rem içinde 320 piksellik telefonda üst çubuğu taşırıyordu.
   Ağırlık **sayaçtadır**: başlık künye tonunda ve küçük punto, sayaç en büyük öğe. Dördü de aynı puntodayken (başlık 24, sayaç 24, level 22,4 px) hiyerarşi okunmuyordu; oysa başlık hiç değişmez, sayaç oyunun tek dinamik sayısıdır.
2. **Süre çubuğu:** kalan süre oranında dolu ince çubuk. Son %25'te çubuk ve sayaç kırmızıya döner.
3. **Oyun alanı:** kalan tüm alan.
4. **Alt çubuk:** ipucu/durum metni ve sağında yalnızca "Ayarlar" düğmesi. "Baştan başla" **ayarlar panelindedir**.
   Üç şeyin birlikte durduğu bir alt çubuk işe yaramıyor. Önce ipucu iki düğmeyle aynı satırı paylaşıyordu ve 360 piksellik telefonda kendisine 112 piksel kalıyordu: metnin yarısı kırpılıyordu — oyunun kuralı öğrettiği tek yer burası, üstelik 100 patron levelinde de aynı şey oluyordu. İpucu kendi satırına alınınca kırpılma bitti ama çubuk 65 pikselden 121 piksele çıktı ve telefonda oyuncunun kilitlemek için bastığı yeri yuttu. Çözüm, çubuktan bir düğme çıkarmak oldu: "Baştan başla" Level 1'e döndüren **seyrek ve geri alınamaz** bir eylemdir, başparmağın durduğu sağ alt köşede durmamalıdır. Kalan tek düğmeyle ipucu aynı satıra rahatça sığar ve çubuk 64 piksele döner.
   İpucuna **satır sayısı sabit** yer ayrılır (360 piksel ve üstünde iki, altında üç satır): satır sayısı oynarsa çubuğun yüksekliği de oynar ve halkalar dikeyde zıplar.

Oyun alanında çizim sırası:
1. Arka planda levelin numarası, büyük ve çok soluk (patron levelinde sarı). Punto `S × 0,5`'tir, ama metnin yarı genişliği en dış halkayı aşarsa oranla küçültülür — dört hanede ("1000") rakam hem halkaları hem temizlenen kutuyu taşıyordu. Rakam çizildikten hemen sonra merkezde yumuşak kenarlı bir delik silinir: gövdesi tam topun altından geçiyordu (1, 4, 7 gibi merkezden geçen rakamlarda, yani Level 1'de).
2. Açıklık kamaları, yalnızca en az bir halka kilitliyken. **Geçer kama sarı %35 dolu; geçmez kama doldurulmaz**, yalnızca kesik kırmızı konturla çevrilir. **Kayıpta kural değişir: daralmış kanal kırmızı DOLU çizilir** — oyuncunun neden kaybettiğini görmesi gereken tek an odur (aşağıda "Kaybın açıklanması"). Eskiden ikisi de dolduruluyordu (sarı %22, kırmızı %15) ve açık temada aralarındaki fark 1,03:1 idi — fiilen ayırt edilemiyorlardı. Yeni modelde ayrım hem parlaklığa hem doluluğa bağlıdır, yani renkten bağımsız iki kanal taşır (açık tema 1,28:1, koyu tema 2,43:1).
3. Halkalar: kilitli olanlar tam opak; sıradaki (aktif) halka sarı ve kalın; ondan sonraki halka %75; diğerleri %40. Kilitlenme anında çizgi kısa süre kalınlaşır.
4. İşaretler: baştan kilitli halkada küçük kare, yön değiştiren halkada kırmızı nokta (ikisi de en geniş çizili yayın ortasında).
   **Kare zemin renginde dolu ve mürekkeple çevrilidir.** Mürekkeple doldurulduğunda, baştan kilitli halka da mürekkep rengiyle ve tam opaklıkla çizildiği için kare halkanın üstünde görünmez oluyordu — 1000 bölümün 431inde durum buydu ve Level 7deki ipucu "kareli halka baştan kilitli" diyerek olmayan bir şeyi arattırıyordu. Kenarlık şart: dolgusu tek başına kalsaydı halkada küçük bir boşluk sanılabilirdi.
   **Hızı değişen (wobble) halkanın işareti YOKTUR** ve olmamalıdır: hız değişimi zaten hareketten görülür. İşaret, görülemeyen şey için vardır — bir halkanın sonradan yön değiştireceği ya da baştan kilitli olduğu bakarak anlaşılmaz.
5. Top.

**Renklerin tek kaynağı CSS'tir**, canvas onları hesaplanmış değerlerden okur. Ancak okuma **her zaman yedeğe düşebilmelidir**: canvas'ta `ctx.fillStyle = ""` hata vermez, sessizce yok sayılır ve önceki değer (varsayılan siyah) kalır. CSS henüz uygulanmamışken renkler okunursa tüm oyun siyah beyaz çizilir — telefonda tam olarak bu oldu, çünkü geliştirme sunucusunda CSS ayrı bir istekle geliyor ve yavaş bağlantıda ilk okumaya yetişmiyordu. Bu yüzden `src/game/theme.ts` aynı paletin bir kopyasını yedek olarak taşır (bir test ikisinin aynı kaldığını denetler) ve CSS hazır olur olmaz renkler bir kez daha okunur.

**Renkler** (açık ve koyu tema, sistem ayarına göre):

| Belirteç | Açık | Koyu |
|---|---|---|
| Arka plan | `#E9EEF0` | `#13232B` |
| Mürekkep | `#1D3440` | `#DCE6EA` |
| Top/vurgu | `#E89B00` | `#FFC93C` |
| Hata | `#E5484D` | `#FF6369` |
| Başarı | `#2E9E6A` | `#4CC38A` |
| Soluk metin | `#5A6E79` | `#7F98A4` |
| Oluk (süre çubuğu) | `#BCCBD3` | `#2A4250` |
| Arayüz vurgusu | `#9A6200` | `#FFC93C` |

"Top/vurgu" (`--ball`) **yalnızca canvas'ta** kullanılır: top, sıradaki halka ve geçer kama. Arayüz öğeleri (örtü başlıkları, odak halkası, onay kutusu) "arayüz vurgusu"nu (`--ui-accent`) kullanır — aradaki fark açık temada okunabilirliktir, aşağıya bakınız.

**Diller.** Oyuncunun gördüğü **hiçbir metin koda gömülü değildir**; hepsi `src/dil/` altındadır. Şu an Türkçe ve İngilizce var.

- **Sözleşme tiplidir** (`src/dil/tipler.ts`): eksik bir çeviri **derleme hatası** verir. "Şu ekran hâlâ Türkçe kalmış" hatası bu yapıda mümkün değildir ve gözle aramak imkânsızdır.
- **Varsayılan dil, cihazın dilidir** — Türkçe değil. `navigator.languages` sırayla taranır ve **desteklenen ilk** dil seçilir (ilki değil: kullanıcı bir öncelik listesi tutar, listede aşağıda duran ama bildiğimiz dili çöpe atmak yanlış olurdu). Bölge eki atılır: `tr-CY` de Türkçedir. Oyuncu ayarlardan üstüne yazabilir; seçimi kaydedilir.
- **Hiçbiri desteklenmiyorsa yedek İNGİLİZCEDİR**, Türkçe değil. Oyun Türkçe yazıldı ama küresel pazara çıkıyor: Japon bir oyuncu için Türkçe, İngilizce'den daha anlaşılmazdır.
- **Sayı biçimi dile bağlıdır** (`Intl.NumberFormat`): sayaç Türkçe `8,0`, İngilizce `8.0`. Metin çevirip sayıyı unutmak bu tür işlerin klasik eksiğidir.
- **Patron adları ve ipuçları tabloda değildir.** `levels.json` yalnızca anahtar taşır (`"boss": "ayna"`); görünen ad ve ipucu dil dosyasındadır. Eskiden Türkçe metin 1000 satırın içine gömülüydü ve çevrilemezdi. Anahtarlar **çekirdekte** tanımlıdır (`PATRON_ANAHTARLARI`) çünkü veridirler, metin değil — çekirdek dil katmanını tanımaz.
- **Dil değişince sayfa yeniden yüklenir.** Ekran metinleri bir kez kuruluyor; canlı değiştirmek bütün kabuğu yeniden kurup dinleyicileri yeniden bağlamak demek olurdu ve yarı çevrilmiş ekran riski doğururdu. Seyrek bir eylem için temiz yol budur.
- **`index.html` ve PWA manifest'i tek dillidir** (İngilizce): statik dosyalardır, çalışma anında değişmezler. Oyunun kendisi cihaz diline göre gelir.
- Oyunun **adı çevrilmez**. İngilizcede "kasa" karşılığı tutarlı olarak **vault**'tur.

**Yazı tipi:** Fredoka (400, 500 ve 600 ağırlıkları), yedek olarak `"Trebuchet MS", system-ui, sans-serif`. Gömülü alt kümeler `latin` ve `latin-ext`: Türkçe ve Avrupa dilleri kapsanır, **Kiril/Arap/CJK kapsanmaz** — o dillere geçilecekse alt küme de eklenmelidir.

Yazı tipi **projeye gömülüdür**, Google Fonts CDN'inden çekilmez. Üç gerekçe: (1) oyun bir PWA ve çevrimdışı da aynı görünmeli — CDN'den gelen bir dosya servis çalışanının önbelleğine giremiyordu; (2) CDN, ziyaretçinin IP adresini üçüncü bir tarafa iletir ve bu Avrupa'da KVKK/GDPR açısından tartışmalıdır; (3) üçüncü bir alan adına DNS + TLS el sıkışması yok. **Uygulama hiçbir dış alan adına bağlanmaz**; bunu bir test denetler.

Fredoka değişken bir yazı tipidir, bu yüzden alt küme başına tek dosya 300–600 arası bütün ağırlıkları taşır. İki alt küme gerekir: `latin` (ö, ü, ç dahil) ve `latin-ext` (Türkçe'ye özgü ğ, ı, ş ve büyükleri). Yıldız işaretleri (★ ☆) Fredoka'da yoktur — Google'ın alt kümelerinde de yoktu — ve yedek yığından çizilirler; bu yüzden yığında Fredoka'dan sonra gerçek bir aile bulunmak zorundadır.

Lisans: SIL Open Font License 1.1 (`licenses/Fredoka-OFL.txt`), ticari kullanıma ve uygulamaya gömmeye izin verir. Oyunun başka hiçbir üçüncü taraf varlığı yoktur: simgeler `npm run icons` ile oyunun kendi geometrisinden üretilir ve **çalışma zamanı bağımlılığı sıfırdır**.

**Kontrast.** Metin renkleri arka planda en az 4,5:1 olmalıdır (WCAG AA); metin dışı öğeler (odak halkası, onay kutusu durumu) en az 3:1. Açık temadaki soluk metin bu yüzden `#6B8390`'dan `#5A6E79`'a koyultuldu (3,40:1 → 4,56:1).

Amber açık temada zeminle yalnızca **1,97:1** yapar. Bu yüzden iki farklı yol izlenir:

- **Canvas'ta amber kalır.** Top ve sıradaki halka ince koyu bir kenarla ya da haleyle çizilir; şekil, kalınlık ve hale ikinci kanalı taşır, okunurluk tek başına renge bağlı değildir. Oyunun imza rengi olduğu için koyultulmadı.
- **Arayüzde amber kullanılmaz.** Örtü başlıkları ve odak halkası `--ink` (11,1:1), onay kutusu `--ui-accent` (5,10:1). Onay kutusu özellikle önemli: durumu okunmayan ayar "deseni yumuşat" idi, yani tam da o ayara ihtiyacı olan kişi açık mı kapalı mı olduğunu göremiyordu. Bu ayrımın geri kaymasını bir test engeller.

Süre çubuğunun oluğu iki temada da zeminden ayrılmalıdır (açık 1,42:1, koyu 1,53:1). Ölçümlerin tamamı `src/ui/contrast.test.ts` içinde sınanır.

**Kapanış bölümü.** Son bölüm **her zaman** kapanış patronudur (`sonKasa` anahtarı); döngünün nereye denk geldiğine bırakılmaz. Patron döngüsü 6'lı ve patron aralığı 10 olduğu için 1000. bölüm 100. patrona düşüyordu ve 100 mod 6 = "çatal" ediyordu: **1000 bölümlük oyunun kapanış anı yoktu.** Üstelik döngüdeki "Büyük kasa" metni "Son kasa…" diye başlıyor ve 60'tan 960'a kadar **16 kez** çıkıp oyuncuya 60. bölümde "son kasa" diyordu. Tekrar eden patron metni artık "son" demez; o söz yalnızca gerçekten son olan bölüme aittir.

**Kaybın açıklanması.** Kayıp anı bu türün en kritik saniyesidir: oyuncu "az kalmıştı, bir daha" mı diyor, yoksa "ne oldu ya?" mı — devam etme kararı orada verilir. Bu yüzden iki şey yapılır:

- **Kanal ekranda kalır.** Kamalar eskiden kayıpta tamamen gizleniyordu; yani "neden kaybettim" sorusuna cevap veren tek öğe, tam da o soru sorulduğu anda siliniyordu. Geriye kırmızı bir halka ve sarsıntı kalıyordu: "kaybettin" diyordu ama "şu kadarla" demiyordu. Artık daralmış kanal kırmızı dolu çizilir ve topun ona sığmadığı görünür.
- **Mesaj okunacak kadar kalır.** Kayıp animasyonu 0,9 saniye sürer ve bitince level yeniden yüklenir; yükleme de ipucunu hemen eziyordu. Yani bu cümle ekranda 0,9 saniye duruyordu — okumak bundan uzun sürer. Sonuç mesajları (kayıp, kazanma, süre dolması) artık **korumalı** yazılır ve bir sonraki denemeye taşar; yeniden başlama gecikmez. Koruma yalnızca oyun canlıyken işler: duraklatan oyuncu okuma süresini yakmaz.
- **Pay yazılır.** Kanalın geçiş eşiğinden ne kadar dar kaldığı, kaybın oluştuğu anda zaten hesaplanıyordu ama atılıyordu. Artık durumda saklanır ve ipucunda söylenir: 0,05°'nin altında "kıl payı", 10°'nin üstünde "yol erken daraldı", arada sayıyla ("1,4° dar kaldı"). **Süre dolduğunda ölçülecek bir pay yoktur; orada sayı uydurulmaz.**

**Duraklatma.** Oyuncunun ara vermesi gereken bir durum her zaman olur; eskiden tek yol ayarlar panelini açmaktı ve panel kapanınca level **baştan başlıyordu** — yani ara vermenin bedeli ilerlemeydi.

- **Denetim sayacın kendisidir.** Üst çubuktaki sayaç bir düğmedir ve yanında iki çubuktan oluşan bir duraklat simgesi taşır. Ayrı bir düğme bilerek yoktur: ekranın tamamı dokunma alanı olduğu için alt köşeye eklenen her düğme, başparmağın durduğu yere ölü bölge açar. Sayaç ise üst çubuktadır ve eşleşme birebirdir — zamanı durdurmak için zamana dokunulur. Masaüstünde Esc de duraklatır.
- **Duraklatma tam bir donmadır.** Halkalar durduğu açıda kalır, süre işlemez, dokunuşlar yok sayılır. Örtü yarı saydamdır ki donmuş halkalar ve kanal arkadan görünsün: oyuncu "kaldığım yer duruyor" bilgisini gözüyle alır.
- **Devam ederken üçten geri sayılır ve halkalar sayım boyunca DONUK kalır.** Bu bir adalet kuralıdır: halkalar geri sayımda dönseydi oyuncu bedava gözlem süresi kazanır ve süre bütçesi (γ) delinirdi — duraklat, izle, duraklat diye sömürülebilirdi. Geri sayımın işi bilgi vermek değil, parmağın ekrana dönmesine zaman tanımaktır.
- **Aynı muamele her donma için geçerlidir:** ayarlar, "nasıl oynanır" ve arkaplandan dönüş de kaldığı kareden devam eder ve geri sayımla girer. Arkaplandan dönüşte oyun eskiden doğrudan canlıya dönüyordu; uygulamayı değiştirip geri gelen oyuncu halkaları bir anda hareket hâlinde buluyordu.

**"Nasıl oynanır" ilk açılışta kısadır.** Altı gösterge satırından dördü (kırmızı nokta, küçük kare, iki boşluk, değişken hız) oyuncunun **onlarca bölüm boyunca göremeyeceği** mekanikleri anlatıyordu ve ekran 320 pikselde 2,9 ekran kaydırma tutuyordu. Oyun bu mekanikleri zaten ilk göründükleri bölümde alt çubukta tek satırla tanıtır; ilk açılışta tekrar etmenin tek etkisi metin duvarıdır. İlk açılışta yalnızca giriş, "Sarı kama", "Duraklat" ve **ışığa duyarlılık uyarısı** gösterilir — tek ekrana sığar, kaydırma gerekmez. Tamamı Ayarlar'dan okunur.

**"Baştan başla" iki aşamalıdır.** Oyundaki geri dönüşü olmayan tek eylem budur: Level 1'e döndürür ve `enUzak`ı sıfırlayarak açılan bütün bölümleri kilitler. Onay metni **kaybedilecek** bölümü söyler (`enUzak`), oynananı değil — bölüm seçiminden 5. bölüme dönmüş 412'lik bir oyuncuya "Level 5 kaybolur" demek, eylemi 80 kat küçük gösteriyordu. Üstelik paneldeki en sık basılan düğmenin ("Tamam") hemen üstünde durur. İlk basış düğmeyi uyarıya çevirir ("Emin misin? Level 412 kaybolur"), ikincisi çalıştırır; panel kapanıp açılınca uyarı hali sıfırlanır. Altında ne yaptığını söyleyen bir açıklama da vardır — paneldeki diğer dört kontrolün hepsinde vardı, yalnızca bunda yoktu.
*Bu, "her dokunuş kalıcıdır" ilkesiyle çelişmez: o ilke halka kilitlerine aittir, menüdeki yıkıcı bir eyleme değil.*

**Birikimin görünmesi.** Ayarlar paneli ilerleme özetini gösterir: kaç bölüm açıldığı ve toplanan yıldız ("312 bölüm açıldı · 714 / 936 yıldız"). Toplanan yıldız eskiden oyun boyunca hiçbir yerde görünmüyordu; yalnızca 1000. bölümü bitiren oyuncu toplamını öğreniyordu. 1000 bölümlük bir oyunda devam etme sebebinin kendisi birikimin görünmesidir.

**İpuçları.** Alt çubuktaki metin şu önceliğe göre seçilir:
1. Patron leveli, ilk deneme: `"<ad>: <açıklama>"`.
2. **Öğretici ipucu (yalnızca level daha önce bitirilmemişse).** İkinci ve sonraki denemelerde önüne deneme sayısı eklenir: `"Deneme N · <ipucu>"`.
   *Neden bu sırada:* öğretici ipucu eskiden deneme sayacının altındaydı ve ilk kayıpta kayboluyordu. Oysa oyuncu kuralı tam da kaybettiği için öğrenmeye çalışır; Level 2'deki "Sarı kama ortak açıklık" cümlesi oyunun belkemiğidir ve tek bir kayıpla siliniyordu.
3. İkinci ve sonraki denemeler (öğretici ipucu yoksa): `"Deneme N"`, varsa en iyi yıldızla birlikte.
4. Öğretici ipucu metinleri:
   - Level 1: "Dokun, dış halkayı kilitle"
   - Level 2: "Sarı kama ortak açıklık. Sonraki boşluğu ona hizala"
   - Level 3: "Yıldızlar, kasa açıldığında kalan açıklığın genişliğine göre"
   - Level 4: "İpucu: ilk kilidi, ikinci halkanın boşluğu yaklaşırken vur"
   - Her özelliğin patron olmayan ilk göründüğü level (tablodan otomatik hesaplanır): kareli halka, iki kapılı halka, yön değiştiren halka, hızlanan halka için kısa birer açıklama. Metinler referans sürümdeki `features` nesnesindedir.
5. Aksi halde en iyi skor ya da "Dokun, sıradaki halkayı kilitle".

**Erişilebilirlik ve cihaz:** güvenli alan boşlukları (çentik, ana ekran çubuğu) hesaba katılır; ekran yakınlaştırma ve kaydırma kapalıdır; açık/koyu tema desteklenir; hareket azaltma ayarı açıksa sarsıntı ve flaş kapatılır. Ayrıca:

- **Dokunma hedefleri en az 44 pikseldir.** Tek dokunuşla oynanan bir oyunda düğmelerin ıskalanması kabul edilemez.
- **Escape açık örtüyü kapatır**, kapalıyken duraklatır. Tek istisna duraklatma örtüsüdür: devam etmek bilinçli olmalıdır. Eskiden Escape yalnızca *açıyordu*, yani herhangi bir örtü açıkken tamamen ölüydü ve dört diyalogdan çıkış yolu tek bir düğmeydi.
- **Sayacın erişilebilir adı `aria-label` DEĞİLDİR**, görsel olarak gizli bir metindir. `aria-label` görünen rakamı ezer: ekran okuyucu yalnızca "Duraklat, düğme" der ve **kalan süreyi hiç duymaz** — oysa süre iki kayıp koşulundan biridir ve tek göstergesi odur. Erişilebilir adın görünen metni içermemesi ayrıca WCAG 2.5.3 (Label in Name) ihlalidir. Süre çubuğu `aria-hidden`'dır: sayacın görsel kopyasıdır, iki kez söylenmemelidir.
- **Oyun alanı `overflow: hidden`'dır.** Geri sayım rakamı `scale(1.25)` ile büyütülerek belirir ve bu, 320 piksellik ekranda öğeyi görsel olarak 400 piksel yapıyordu: sayfa 40 piksel yatay kayıyordu. Ekranın tamamı dokunma alanı olduğu için yatay bir sürükleme sayfayı gerçekten oynatıyordu.
- **Örtü açıkken arka plan `inert`'tir.** `aria-modal="true"` yalnızca ekran okuyucuya bilgi verir, klavye odağını tutmaz; bu olmadan Tab örtüden çıkıp arkadaki düğmelere gidiyordu.
- **"Nasıl oynanır" ekranının kapatma düğmesi yapışkandır** (kutunun altında sabit). Kutu kaydırılabilir ve düğme en altta kalınca ilk açılışta görünmüyordu. Bu ekranda Esc ve zemine tıklama **bilerek yoktur**: kapatmak "gördüm" bayrağını yazar ve ekranda ışığa duyarlılık uyarısı da vardır, kazara atlanmamalıdır. Ayarlar ve bitiş ekranı için böyle bir kısıt yoktur.

**Işığa duyarlılık.** Oyunun görsel uyaranı uluslararası rehberlerdeki eşiklerle karşılaştırıldı (telefon: 7 cm ekran, 32 cm mesafe).

| Ölçüt | Rehber eşiği | Dönence | Sonuç |
|---|---|---|---|
| Yanıp sönme sıklığı | saniyede 3'ten fazla | en kötü hâlde 1,1 | eşiğin çok altında |
| Flaş şiddeti | %10 parlaklık sıçraması | %18 opaklık, 0,5 sn'de sönüyor | sınırda, sıklık düşük |
| Açık-koyu çizgi çifti | 5'ten fazla | 6 halkalı levelde 6 | **eşik üstü** |
| Uzamsal frekans | 1–4 çevrim/derece riskli | 1,48 | **riskli bantta** |
| Kontrast (Michelson) | 0,4 üstü riskli | halka/zemin 0,93–0,96 | **eşik üstü** |
| Desenin görüş açısı | "geniş alan kaplayan" | 11°, oyun alanının %13,8'i | küçük, koruyucu |
| Yön değiştirme sıklığı | kritik bant 15–25 Hz | 0,31–0,83 Hz | çok uzakta |

Desen üç ölçütü işaretliyor ama en belirleyicisini kaçırıyor: telefonda yalnızca 11° kaplıyor ve çizgiler ince (doluluk %33). Baş dönmesi riski ihmal edilebilir — dönen desenin kendi kendine dönme yanılsaması (vection) yaratması için genellikle 60°+ görüş alanı gerekir. En olası rahatsızlık kaynağı dönen halkalar değil, kayıptaki ekran sarsıntısıdır.

Bunun üzerine iki şey zorunludur:

1. **İlk açılışta bir kez uyarı gösterilir** ve ayarlar paneliyle birlikte sunulur. Panel açıkken **oyun durur**: uyarıyı okumak oyuncunun süresini yakmamalıdır.
2. **"Deseni yumuşat" ayarı** kilitsiz halkaların opaklığını 0,40'tan 0,25'e indirir. Ölçülen etki: açık temada halka/zemin kontrastı 0,40 → **0,24** (eşiğin altına iner), koyu temada 0,82 → 0,69. Koyu temada eşiğin altına inmek halkaları oynanamayacak kadar görünmez yapardı; açık-üstüne-koyu çizim doğası gereği yüksek kontrastlıdır ve bu dürüstçe kabul edilir.

Ayrıca **"Hareketi azalt"** ayarı, sistem tercihinden bağımsız olarak sarsıntıyı ve flaşı kapatır (ikisinden biri açıksa kapalıdır).

**Ses.** Üç ses vardır ve üçü de Web Audio ile **sentezlenir**; ses dosyası yoktur, dolayısıyla ne paket boyutu ne lisans meselesi açar. Kilitte kısa bir nota, kasa açıldığında yükselen üçlü, kayıpta alçalan bir ton. **Kilit notasının perdesi kanal daraldıkça yükselir:** oyuncu sıkıştığını ekrana bakmadan da duyar — bu, kaybın neden geldiğini anlatan ikinci kanaldır (görseli, yukarıdaki kırmızı kama).

*Neden kapsamda:* bu türde ses dekorasyon değil, dokunuşun ödülüdür; üstelik iOS Safari `navigator.vibrate` sağlamadığı için orada oyuncunun aldığı tek görsel-olmayan geri bildirim budur.
*iOS notu:* `AudioContext` yalnızca bir kullanıcı hareketinin içinde açılabilir. Oyunun dokunuşları zaman damgasıyla kuyruğa alınıp fizik adımında işlendiği için ses çalma anı artık hareketin içinde değildir; bu yüzden bağlam ayrıca ve doğrudan `pointerdown`'dan açılır. Tarayıcı ses üretemiyorsa seçenek hiç gösterilmez ve çağrılar sessizce geçilir.

**Titreşim.** Kilitte kısa (12 ms), kayıpta belirgin (45 ms), kasa açıldığında çok darbeli bir desen. Varsayılan açık, ayarlardan kapatılabilir. Hareket azaltmadan bağımsızdır: biri görsel hareket, diğeri dokunsal geri bildirimdir. `navigator.vibrate` desteklenmiyorsa (iOS Safari) seçenek hiç gösterilmez ve çağrı sessizce geçilir.

## 8. Level sistemi

**1000 bölüm** `data/levels.json` içinde hazırdır. Oyun bu dosyayı olduğu gibi okur; **oyun içinde rastgele level üretilmez.**

Bölüm sayısı `src/core/levels.ts` içindeki `LEVEL_COUNT` sabitiyle belirlenir: değiştirip `npm run gen` çalıştırmak yeterlidir. Oyun "aa" gibi uzun soluklu olmalıdır; 60 bölüm bir saatte bitiyordu. Bu türde yapı tekrarı rahatsız edici değildir, çünkü bölümler arasındaki fark hız ve boşluk genişliğiyle taşınır ve oyuncu iki bölümü yan yana görmez. Patronlar her 10 bölümde bir gelir (100 patron); altı tasarım sırayla tekrar eder ve her turda hedef eğri aşağıda olduğu için daha zor ayarlanır.

```json
{ "q3": 0.46, "q2": 0.25, "levels": [
  { "n": 1, "boss": null, "hint": null, "limit": 8.9, "rings": [ {"speed": 0.6291, "gap": 30.5554, "gaps": 1, "gapOffset": 177.3851, "flip": 0, "wobble": false, "preLocked": false, "start": 0.2254}, ... ] },
  ...
]}
```

Formüllerin türetilmesi ve sınırların nereden geldiği ayrı bir belgededir: **`docs/MATEMATIK.md`**. Zorluk, boşluk genişliği ya da geometriyle ilgili bir değişiklikten önce oraya bakılmalıdır.

Tablo `tools/gen.ts` ile üretilir. Üretim adımları:

1. **Aday üretimi.** Her level numarası için o numaraya uygun özelliklerle aday yapılar üretilir: halka sayısı `min(2 + ⌊(n−1)/4⌋, 6)`; iki kapılı halkalar 11'den, yön değiştirenler 12'den, hızlananlar 18'den, baştan kilitliler 6'dan itibaren.
   **Halka sayısı ritmi.** Yukarıdaki formül 17. levelde 6'ya ulaşıp orada kalırdı; 60 levelin 41'i aynı yapıdaydı. 6'ya ulaşıldıktan sonra halka sayısı `[6, 6, 5, 6, 4, 6, 5, 6]` **kümesinden** seçilir; küme her 8 bölümlük blokta kendi karmasıyla yeniden sıralanır. Dağılım blok blok aynı kalır, sırası öngörülemez. Aynı blok karıştırması arketip rotasyonuna da uygulanır: dizi olarak uygulandıklarında ikisi faz kilitleniyor ve halka sayısını 8 periyotlu yapıyordu (bkz. MATEMATIK §8.4).

   **Arketip halka sayısını ezebilir.** `hassasiyet` arketipi halka sayısını [3,4],
   `dayaniklilik` [5,6] aralığından kendi seçer ve ritim kümesini tamamen atlar.
   `ARKETIP_SIRASI`'nın sekiz öğesinin üçü bunlardır, yani n ≥ 60 için bölümlerin
   yaklaşık **%37,5'inde** halka sayısı ritimden değil arketipten gelir. Bu kasıtlı:
   o iki arketibin kimliği zaten halka sayısıdır.

   **Aramanın üç kolu.** Ayarlayıcı hedefe takip payı (5 puan) içinde kalamadığında,
   yalnızca **kolay yönde**, sırayla:
   - **Tolerans** — birincil kol, boşluğu daraltır. τ tabanına (25 ms) kadar iner.
   - **Hız** — 0,15 adımlarla 1,8 katına kadar. Normalde nötrdür (`sizeGaps` boşluğu
     hızla orantılı büyütür, τ değişmez), ama baştan kilitli halkalarda `gerekenPay`
     başlangıç kanalına taban koyunca tolerans kolu ölür ve o zaman hız bir kol olur.
     **Bu kol ρ duvarını kaldırmaz** (ρ hızdan bağımsızdır, bkz. MATEMATİK §3.2),
     yalnız γ'yı rahatlatır.
   - **Halka sayısı** — iki tur üst üste tutturulamazsa +1, **6 tavanına kadar**.
     Aday saate yeniliyorsa ters yönde çalışır ve halka azaltır: fazla halka kilit
     başına bütçeyi küçültüp oyuncuyu nadir bir hizalanma beklemeye zorlar.
   Bant içinde ve temiz kalan bölümler ilk turda çıktığı için bu kollar onlara hiç
   dokunmaz. (`merkez` patronunda aynı kilitlenme elle düzeltildi: hızlar 1,5 katına
   çıkarıldı — bkz. MATEMATİK §8.5.) Daha az halkalı leveller zorluğu kaybetmez: ayarlama adımı boşlukları daraltarak aynı kazanma oranını tutturur, böylece o leveller dayanıklılık yerine hassasiyet ister.
2. **Hata payı milisaniye cinsinden.** Boşluk genişliği sabit derece değil, tolerans süresinden hesaplanır: `gap = NEED + tolSn × (hareketli halkaların hız toplamı)`. Hızlanan halkaların hızı 1,7 katı sayılır. Böylece hız artsa da insan için hissedilen zorluk kontrol altında kalır.
   **Halka başına genişlik.** Her halkanın kendi `gapScale` çarpanı vardır (0,82 – 1,18): `halkanın gap değeri = min(gap × gapScale, 85°)`. Böylece bir leveldeki halkalar farklı genişlikte olur; dar halka oyuncuya "asıl iş burada" der. Patron levelleri elle tasarlandığı için çarpanları 1'dir. Tavan 85°: daha geniş bir boşlukta halkanın üçte biri çizilmez ve halka gibi durmaz.
3. **Referans çözücü.** Kusursuz zamanlamalı bir oyuncu: ilk kilidi hemen vurur, kalan hata payını kalan halkalara eşit böler, dokunuşlar arasında en az 0,3 sn bekler. Levelin çözülemediği ya da 16 sn'den uzun sürdüğü adaylar elenir.
4. **Süre sınırı.** Limit bir tasarım girdisidir, çözücünün çıktısı değil:
   ```
   tabanLimit(n)     = (4 + 2 × hareketli halka sayısı) × (1 − 0,22 × min(1, (n−1)/199))
   tasarımLimiti(n)  = tabanLimit(n) × arketipSüreÇarpanı(n)     // 0,80 – 1,15
   altSınır          = min(tasarımLimiti(n), γ tavanının izin verdiği limit)
   limit             = max(altSınır, çözücü süresi × 1,5 + 1,5)
   ```
   İlk terim kuraldır: süre halka sayısından gelir ve 200. bölüme kadar kademeli sıkılaşır, sonra sabit kalır. Arketip çarpanı bunu ayrıca eğer: `dayaniklilik` 0,80 ile süreyi kısar, `hassasiyet` 1,15 ile açar. γ tavanı tasarım limitini **keser**: hızlı halkalı bir bölümde tasarım süresi oyuncuya halkaların ikinci turunu bekletirdi, o yüzden orada limit tasarım değerinin altına iner (aday sağlayamıyorsa elenir). İkinci terim yalnızca güvenlik ağıdır — levelin bitirilebilir kalmasını garanti eder. Aday seçiminde, kazanma oranı denk (≤4 puan fark) adaylar arasında çözücünün tasarım limitine rahat sığdığı aday tercih edilir, böylece güvenlik ağı nadiren devreye girer.
   *Neden:* limit eskiden doğrudan çözücü süresinden geliyordu; çözücü "uygun hizalanma ne zaman gelirse" beklediği için bu süre gürültüydü. Sonuçta komşu leveller arasında 15 sn'ye varan sıçramalar oluyor ve ekrandaki en büyük sayı zorluk hakkında ters sinyal veriyordu.

   **Ama iki terim de yetmez: limit, oyuncunun saate yenilmediğini göstermek zorundadır.** Her aday, insan benzeri oyuncuyla oynatıldıktan sonra kayıplarının kaç tanesinin "süre doldu" olduğuna bakılır. Denemelerin **%10'undan fazlası** saate yeniliyorsa limit %20 adımlarla açılır (tasarım limitinin en çok 2,2 katına kadar). Aday seçiminde bu ölçütü sağlayan ("temiz") bir aday, hedefe 10 puana kadar daha uzak olsa bile sağlamayanı yener. Doğrulama, denemelerinin dörtte birinden fazlasını saate kaybeden bölümleri sayar ve 20'yi (bölümlerin %2'si) aşarsa hata verir.

   *Neden:* çözücü açgözlüdür, ilk uygun hizalanmayı alır; insan daha iyisini bekler. Hizalanma fırsatının seyrek olduğu bölümlerde 1,5 kat pay yetmiyordu ve oyuncu bütün kilitleri doğru yapıp **son kilitte** saate yeniliyordu. Ölçüm: eski tabloda 1000 bölümün **123'ünde** kayıpların yarısından fazlası süre dolmasıydı, bazılarında %100. O bölümlerde oyun hassasiyet oyunu olmaktan çıkıp bekleme oyunu oluyordu — türdeki en kötü kayıp hissi, çünkü oyuncu hata yapmadığı hâlde kaybeder.

   **Ve bunun bir de ÖTEKİ ucu var: limitin tavanı.** Süre bir zorluk kaldıracıdır; oyuncu halkaların ikinci turunu bekleyebiliyorsa zamanlama kararı kararsızlaşır ve oyun "doğru anı yakala"dan "otur bekle"ye döner. Bunu ölçen büyüklük **γ**'dır:

   ```
   P_i = 2π / (g_i × |ω_i|)                    bir halkanın fırsat periyodu
   γ   = (limit − m × REACT) / Σ P_i           halka başına kaç TUR izlemeye vakit var
   ```

   `g_i` o halkadaki kapı sayısıdır (iki kapılı halkada fırsat iki kat sık gelir). `wobble` hızı 0,3–1,7 kat arasında salındırır ama sinüsün ortalaması sıfırdır: periyodu değiştirmez. `flip` halkası tam tur atmayabilir, gidiş-dönüş çevrimi daha uzunsa o esas alınır.

   **Tavan γ ≤ 1,3'tür**, üretimde zorlanır ve doğrulamada tek ihlal bile hata verir. Taban ile tavan çakışırsa — yani bir yapı hem saate yenilme üretiyor hem tavanı aşıyorsa — **limit zorlanmaz, aday elenir** ve başka bir halka yapısı denenir (deneme hakkı bu yüzden 24'ten 36'ya çıkarıldı).

   *Neden 1,3:* simülasyona "gözlemci oyuncu" eklenip ölçüldü — bir halkaya nişan alabilmek için önce onu belirli bir süre izlemek zorunda olan oyuncu. Bir tam tur izlemesi gereken oyuncu bölümlerin %2,2'sini kazanıyor; yarım tur izleyen %57'sini. Yani bütçe "**halka başına yarım tur izle, sonra karar ver**" olmalı ve 1,3 buna bir tur artı pay bırakır.

   *Ayrıca ölçüldü:* limiti %40 kısaltmak usta oyuncuyu yalnızca 0,5 puan etkiliyor (%82,7 → %82,2) ama ortalama oyuncunun süre kayıplarını ikiye katlıyor (%6 → %12,3). Yani saat, iyi oyuncuyla çok iyi oyuncuyu ayırmaz; zayıf oyuncuyu ezer. **Beceriyi ayıran kaldıraç boşluk genişliğidir, saat değil** — saatin işi yalnızca taahhüde zorlamaktır.

   Üç kuralın birlikte sonucu (eski tablo → yeni tablo): saate yenilmenin baskın olduğu bölüm **123 → 4**, γ en yüksek **1,90 → 1,31**, γ ortalama 0,83 → 0,86, en dar boşluk ortalaması **38,8° → 36,1°** (zorluk saatten hassasiyete kaydı), 85° tavanına dayanan bölüm 47 → 9.
5. **İnsan benzeri oyuncu.** Dokunuşları ortalama 0 ve standart sapma 60 ms olan normal dağılımla sapar; kalan payın %70'ini kullanmaya razıdır. Her aday 50 kez oynatılır.
   **Sapma simetrik uygulanır (zorunlu).** Erken ya da geç dokunuş, tüm halkaları birlikte ileri veya geri sarar — tek halkanın açısını kaydırmak değildir. Aksi halde `wobble` çarpanı ve `flip` sayacı hesaba katılmaz; bu hata bir önceki sürümde kazanma oranını level başına 19 puana kadar şişiriyordu.
6. **Yön değiştiren halkanın dönüşü görülebilmeli.** Oyuncu dıştan içe gider ve her kilit kabaca **1,27** saniye alır; bir halkanın kilitlenme anı `0,3 + 1,27 × (önündeki hareketli halka sayısı)` olarak tahmin edilir. `flip` yalnızca kilitlenmesi 1,2 saniyeden geç olan halkalara verilir ve periyodu o sürenin %70'ine sığdırılır; erken kilitlenen halkanın `flip`'i kaldırılır.
   Eğim ölçümle kalibre edildi: referans çözücünün 1000 bölümdeki medyan kilit anları **0,30 / 1,94 / 3,25 / 4,54 / 5,42 / 6,65 sn**. Eski değer (0,6) ilk kilit dışında hepsini yarıdan fazla erken sayıyordu.
   Tahmin medyana kalibre olduğu için adayların yaklaşık yarısı ondan erken kilitlenir; bu yüzden `finalize` çözücünün **ölçülmüş** kilit anlarına da bakar ve kilidinden önce hiç dönmeyen (`flip ≥ kilit anı`) bir flip'i sıfırlar. Aday elenmez, defter düzeltilir; τ, γ ve fırsat periyodu artık ekranda olan şeyi ölçer.
   *Sınırı:* bu işlem **referans çözücünün** yörüngesini değiştirmez — sınandı, 832 bölümün 832'sinde kilit anları, süre ve kalan açıklık birebir aynı. Ama zorluğu kalibre eden insan benzeri oyuncu çözücüden farklı anlarda kilitler; kilit tahmin edilenden geç gerçekleşirse orijinal tanımda halka döner, sıfırlanmışta dönmez. Yani bulmaca **değişir**; tutarlılığı sağlayan şey sıfırlamanın `evaluate`'ten ÖNCE yapılması, yani tabloya giren sürümün ölçülen sürümün ta kendisi olmasıdır.
   *Neden:* eski tabloda 68 flip halkasının 55'i (%81) hiç dönmeden kilitleniyordu. İpucu 13. levelde çıkıyor ama dönüş ilk kez 30. levelde, Metronom patronunda görülebiliyordu — oyuncu mekaniği bir patronda, cezayla öğreniyordu. Yeni tabloda bu oran %7 (kalanlar elle tasarlanan patronlar).

7. **Baştan kilitli halkalar için taban pay.** Baştan kilitli halkalar uygulandıktan sonra kalması gereken en az hata payı `6° × (1 + (kalan halka − 1) × 0,5)`'tir. Sağlamayan aday elenir.
   *Neden:* tipik bir oyuncunun 60 ms'lik zamanlama sapması yaklaşık 1,5 rad/sn hızda 5°'ye denk gelir. Eski tabloda halka başına 3,7-4,4° kalan bölümler vardı; oralarda ilk dokunuş oyuncu ne olduğunu göremeden kaybettiriyordu.
   *Neden doğrusal değil:* korunmak istenen şey "hiç tepki veremeden ölmek"tir ve bu birinci dokunuşta olur; ilk halkaya tam pay, sonrakilere yarısı yeter. Doğrusal kural (kalan × 6°) 5 halkalı bir bölümde 30° pay şart koşuyor, boşluğu zorunlu olarak geniş bırakıyordu ve baştan kilitli halkası olan patronlar bu yüzden hedeflerinin 30-44 puan üstünde kalıyordu.

8. **Zorluk ritmi: nefes levelleri.** Patron olmayan nefes levelleri hedef eğrinin **12 puan üstünde** tutulur ve monotonluk kısıtından muaftır. Nefes konumları **modüler bir desenden gelmez**: `n`'in karıştırıcısıyla seçilen 3 ya da 4 aralıklarla yürüyen deterministik bir kümedir. Nefes levelinde **dalga uygulanmaz** (nefes onun yerine geçer) ve **patrona denk gelen nefes iptal edilmez, `n+1`'e kaydırılır**.
   *Neden nefes:* sıradan oyuncuyu kaçıran şey tek bir zor level değil, zor levellerin arka arkaya gelmesidir.
   *Neden modüler desen değil:* sabit 4'te dalga (24), nefes (4), patron (10) ve arketip (8) periyotlarının EKOK'u tam **120**'ydi — 1000 bölümlük oyun pratikte aynı 120 bölümün sekiz tekrarıydı. Aralığı 7'ye çıkarmak tekrarı 120'de kırdı ama yok etmedi: tepe **70**'e taşındı (EKOK(7,10)), yani tekrar daha SIK geliyordu. Hash'le yürüyen küme hiçbir EKOK doğurmaz.
   *Neden kaydırma:* iptal etmek nefesi patronun fonksiyonu yapıp mod-10 desenini geri sokuyordu; ayrıca rahatlamayı tam da en zor bölümün olduğu yerde iptal ediyordu.
   *Neden dalgayı ezer:* hizalanma nefesleri hep uygun dalga evresinde tutuyordu; yalnız aralığı değiştirmek bir kısmını dalga çukuruna düşürüyor ve zor seriyi uzatıyordu.
   *Ölçülen (1000 bölüm, kazanma oranları, eğilimden arındırılmış, tam tarama):* en güçlü tekrar 0,84 (lag 120) → **0,49 (lag 240)**; en uzun zor seri %45 altında 19 → **12**, %40 altında 9 → **4**, %35 altında 7 → **4**. `npm run verify` bütün gecikmeleri tarar ve üç eşikte seri uzunluğunu denetler.

9. **Ayarlama ve zorluk eğrisi.** Her bölüm için tolerans süresi ikili aramayla ayarlanır, böylece kazanma oranı hedef eğriye oturur. Eğri **iki fazlı**:

   ```
   faz1(n)  = 0,94 − 0,59 × min(1, (n−1)/199)^0,45                    // %94 → %35, n = 200
   faz2(n)  = 0,03 × max(0, (n−200)/800)^0,9                         // n = 200'den sonra
   taban(n) = faz1(n) − faz2(n)                                       // %35 → %32, n = 1000
   pay(n)   = (taban(n) − 0,22) / (0,94 − 0,22)
   dalga(n) = 0,08 × (0,3 + 0,7 × pay(n)) × sin(2π n / 24)            // ±8,0 → ±2,9 puan
   nefes(n) = hash{3,4} yürüyüşü, patronda n+1'e kaydırılır
   hedef(n) = taban(n) + (nefes ? 0,12 : dalga(n))                    // %22 ile %95 arasına sıkıştırılır
   ```

   **Üs 0,45 (faz 1)**: iniş başta diktir. Oyuncu 11. bölümde %80'in, 39'da %60'ın altına düşer.

   **Faz 2 neden var ve neden bu kadar sığ.** Eğri eskiden 200'de tabana oturup 800 bölüm düz kalıyordu; bir tarayıcı koşusu 201-400 / 401-600 / 601-800 / 801-1000 bantlarının hedeflerini %39,3 / %39,9 / %39,8 / %39,3 ölçtü. Faz 2 zorluğu yükseltmeye devam ettirir, ama **fiziğin izin verdiği kadar**: zorluğun tek gerçek ekseni τ ve tabanı 25 ms insan refleksi (bkz. MATEMATİK §3). Hedef bir kez %22'ye, sonra %28'e çekildi ve ikisinde de **ulaşılamadı** — teslim edilen %35'te durdu, açık bant bant büyüdü. %32 ölçülen ulaşılabilir tabandır; eğri artık bir havuç değil bir ölçü.

   **Dalga genliği payla söner.** Sabit ±8 puan eğrinin dibinde hedefi üreticinin ulaşabileceğinin altına indiriyordu; o bölümler hem tutturulamıyor hem de oyuncuyu beklemeye zorluyordu. Dalganın işi ritim vermek; tabanda ritim verecek yer kalmaz. Genlik %30'da durur, sıfıra inmez.

   **Hedef %22'nin altına inmez** (TABAN_KLAMP). Daha aşağısı (%15 denendi) ayarlamayı kararsızlaştırıyor: o hedefte boşluğun bir derece değişmesi kazanma oranını onlarca puan oynatıyor.

   **Katı monotonluk yoktur.** Eğri dalgalı olduğu için tek tek bölümler birbirinden kolay olabilir.

   **Model oyunun kuralıyla ölçer.** Üreticinin insan benzeri oyuncusu (`play()`) iki noktada oyundan ayrışıyordu ve ikisi de aynı yöne itiyordu — tablo hedefinden **4,5 + 0,7 puan kolay** çıkıyordu:
   - Dokunuş hatası `ceil(|e|/dt)` adımla, yani **sıfırdan uzağa** yuvarlanıyordu; etkin sapma 60 → 63,4 ms. Oyun dokunuşu zaman damgasının düştüğü adımda işler, bu **en yakına** yuvarlamadır. Model artık `Math.round(e/dt)` kullanır.
   - Geçiş testi analitik genişlikle yapılıyordu, oyun 0,5°'lik **maskeyle** karar verir. Model artık maskeyi kullanır.

   **Aramanın takip payı 5 puan** (TAKIP_PAYI). Eskiden erken çıkış doğrulama bandından türetiliyordu (13,4 puan); eğri indikçe ayarlayıcı hedefe o kadar uzakta duruyordu ve üzerinde hiç baskı kalmıyordu. Bant bir *doğrulama* toleransı, *takip* toleransı değil.

   **Saate yenilen aday tercih edilmez.** Kanalı daraltarak bölüm sonsuza kadar zorlaştırılamıyor: bir noktadan sonra politikanın kabul edeceği an seyrekleşiyor ve bölüm zor değil **oynanamaz** oluyor. Sınırı kabul oranı ρ belirler (bkz. MATEMATİK §3.2) ve ρ hızdan bağımsızdır, yani hızı artırmak bu duvarı kaldırmaz. Denemelerin %30'undan fazlasını saate kaptıran bir aday, hedefe daha yakın olsa bile temiz bir adaya karşı kaybeder.

10. **Patron bölümleri** (her 10 bölümde bir) elle tasarlanmıştır: Ayna, Merkez, Metronom, Çatal, Tavşan ile kaplumbağa, Büyük kasa. Altı tasarım sırayla tekrar eder. Tasarımları `tools/gen.ts` içindeki `BOSSES` nesnesindedir.
    Hedefleri **hedef eğrinin %75'idir** (sabit puan farkı değil, oran), en az %22. Sebep: patronların halka sayıları ve hızları sabittir, ayarlayıcının elinde yalnızca boşluk genişliği vardır. Eğrinin dibinde bu yapılar sabit puanlı bir hedefi tutturamıyor, en fazla `%40'a inebiliyorlardı. Doğrulamada da patronlara daha geniş bant tanınır (±20 puan, normalde ±15).

Üretici sabit bir tohumla çalışır, her çalıştırmada birebir aynı tabloyu verir.

Komutlar:
```
npm run gen          # data/levels.json'u yeniden üretir
npm run verify       # mevcut tabloyu denetler; sorun varsa 1 koduyla çıkar
npm run verify:full  # üstüne determinizmi de sınar (yeniden üretim birebir aynı dosyayı vermeli)
npm test             # çekirdek birim testleri + level tablosu testleri
npm run sync         # çekirdeği ve tabloyu reference/donence.html içine gömer
npm run check        # hepsi bir arada
```

`npm run verify` şunları denetler: şema (alan türleri, boşluk ve açı sınırları), her levelin referans
çözücüyle bitirilebilirliği, çözücünün süre sınırının en fazla %90'ını kullanması, kazanma
oranının hedef eğriden en fazla 15 puan sapması, normal levellerin (nefes levelleri hariç) bir
öncekinden belirgin kolay olmaması, baştan kilitli halkaların taban payı bırakması, yön değiştiren
halkaların dönüşlerinin görülebilmesi, ve ustalık referansının levellerin %15–35'inde 3 yıldız alması.

**Kural:** oyunun hareket, geometri veya açıklık kurallarında yapılan her değişiklikten sonra `src/core/` güncellenmeli, tablo yeniden üretilmeli ve `npm run check` geçmelidir. Oyun kodu çekirdek mantığı kendi içinde kopyalamamalıdır: açıklık maskesi, en büyük açıklık, geçiş eşiği (`NEED_PASS`) ve yıldız kuralı yalnızca `src/core/` içinde yaşar. `src/core/` DOM'a, dosya sistemine ya da herhangi bir ortama bağımlı değildir; bu yüzden hem tarayıcıda hem Node'da aynı kodu çalıştırır.

`reference/donence.html` tek dosya olmak zorunda olduğu için çekirdeği ve tabloyu içine gömer, ama gömme işini `tools/sync-prototype.ts` yapar (esbuild ile paketler); o blok elle düzenlenmez ve `npm run check` güncelliğini denetler.

## 9. Kayıt

Cihazda yerel olarak saklanır:
- Son oynanan level.
- Her level için en iyi `{ yıldız, süre }`.

Kayıt okunamazsa oyun hata vermeden Level 1'den başlar. "Baştan başla" Level 1'e döner, **açılan bölümleri kilitler** (`enUzak` da sıfırlanır) ama rekorları silmez — bölümleri kaybetmeden baştan oynamanın yolu bölüm seçimidir.

**Kayıt şeması** (`donence:v1`): `level` (son oynanan), `enUzak` (ulaşılan en uzak bölüm; bölüm seçiminde buraya kadarı açıktır ve **soğuk açılışın çıpası budur**), `tabloSurum` (rekorların ait olduğu tablo damgası), `bests` (level -> {yıldız, süre}).

**Tablo damgası.** `data/levels.json` bir `v` alanı taşır: bölümlerin ve yıldız eşiklerinin özeti. Kayıt bölümleri numarayla sakladığı için tablo yeniden üretildiğinde "47. bölümde 2 yıldız" kaydı başka bir bulmacaya ait olur; bir kez yaşandı ve ölçüldü (966 bölümün tanımı değişti, 303 bölümde gösterilen rekor ulaşılamaz hâle geldi). Damga eşleşmezse **yalnız `bests` temizlenir**; `level` ve `enUzak` korunur. Damgadan önce yazılmış kayıtlarda alan yoktur ve o kayıtlar cezalandırılmaz: mevcut tabloyu benimserler.

## 10. Kabul ölçütleri

Bir sürüm ancak aşağıdakilerin hepsi sağlanınca tamam sayılır:

- [x] `npm run check` başarılı (tip denetimi, birim testleri, tablo denetimi, prototip güncelliği).
- [x] Otomatik test: her level için referans çözücü, oyunun kendi güncelleme döngüsü üzerinden (sabit adımla) leveli süre sınırından önce bitiriyor.
- [x] Birim testleri: açı normalleştirme, maske uygulama, çembersel en büyük açıklık (başa sarma dahil), yıldız hesabı.
- [x] Kayıp sonrası kazanma, süre dolması ve art arda hızlı dokunuş senaryolarında oyun takılmıyor.
- [x] 360×640 ve 1440×900 ekranlarda halkalar ekrana sığıyor, düzen bozulmuyor.
- [x] Orta seviye bir telefonda 60 fps. *(Ölçüldü: en yoğun kare telefon ölçüsünde 1,9 ms, 16,7 ms bütçesinin %11'i. Gerçek cihazda akıcı olduğu doğrulandı. Girdi artık kare hızından bağımsız olduğu için 60 fps oynanışı sınırlamaz; bkz. `docs/MATEMATIK.md` 10. bölüm.)* *(Masaüstünde ölçüldü: en yoğun kare 1920×1000'de 6,2 ms, telefon ölçüsünde 1,9 ms — 16,7 ms bütçesinin %37 ve %11'i. Gerçek cihazda doğrulanmayı bekliyor: `npm run dev -- --host`.)*
- [x] Açık ve koyu temada tüm öğeler okunabilir.

## 11. Yayın

Oyun, telefona "ana ekrana ekle" ile kurulabilen bir web uygulaması (PWA) olarak dağıtılır.

- **Manifest:** `name` "Dönence", `display` `standalone`, `orientation` `portrait`, `start_url` ve `scope` göreli (`.`) — oyun bir alan adının kökünde de alt klasörde de çalışır. Açılış ekranı `#13232B`, simgenin zeminiyle aynı.
- **Simgeler:** 192 ve 512 piksel, ayrıca Android'in kendi şekline kırptığı `maskable` 512 ve iOS için `apple-touch-icon`. `tools/make-icons.ts` bunları oyunun kendi geometrisinden (`src/core` oranları) üretir ve PNG'yi doğrudan kodlar; çizim kütüphanesi bağımlılığı yoktur. `public/` elle düzenlenmez.
- **Çevrimdışı:** tüm derleme çıktısı servis çalışanıyla önbelleğe alınır. Fredoka yazı tipi Google Fonts'tan geldiği için ayrıca çalışma zamanı önbelleğine alınır, böylece çevrimdışıyken de doğru yazı tipi görünür.
- **Güncelleme:** `autoUpdate`; yeni sürüm sessizce kurulur, oyuncuya sorulmaz.
- **Doğrulama:** `npm run build` sonrası `npm run preview`, ardından sunucu kapatılıp sayfa yeniden yüklenir. Oyun açılmalı ve hiçbir varlık ağdan gelmemelidir.

Mağaza sürümü istenirse ileride Capacitor ile paketlenir; çekirdek kurallar (`src/core`) ortamdan bağımsız olduğu için bu mimariyi değiştirmez.

## 12. Kapsam dışı (sonraki sürümler için fikirler)

Bunlar ilk sürümde yapılmaz, ancak mimari bunlara engel olmamalıdır:
- Level seçim ekranı ve yıldız özeti.
- *(Ses ve titreşim 7. bölümde uygulandı.)*
- ~~**Bölüm seçimi / bölüm haritası.**~~ **Yapıldı** (`src/ui/secim.ts`): yüzerlik sayfalar, kilitli bölümler kapalı, oyuncunun bulunduğu sayfayla ve kendi bölümüne sarılmış olarak açılır. Giriş noktaları: duraklatma örtüsü ve ayarlar paneli. Kayıt şemasına `enUzak` eklendi, yani geri dönmek ilerlemeyi geri almıyor.
- Uygulama mağazası paketi (Capacitor).
- Günlük meydan okuma leveli.
- Oynanış istatistikleri (hangi levelde kaç deneme). Bu veri, simülasyondaki insan modelinin gerçek oyuncularla kalibre edilmesine yarar.
