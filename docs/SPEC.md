# Kasa: Teknik Şartname

Bu belge oyunun nasıl çalışması gerektiğini tanımlar. Çalışan bir referans sürüm `reference/kasa.html` içinde bulunur. Belge ile referans çelişirse bu belge geçerlidir; belirsiz kalan her konuda referans sürümün davranışı esas alınır.

## 1. Oyunun özeti

Kasa, tek dokunuşla oynanan, level tabanlı, 2 boyutlu bir mobil oyundur. Ekranın ortasında bir top ve etrafında iç içe dönen 2 ila 6 halka vardır. Her halkada bir (bazen iki) boşluk bulunur.

Oyuncu ekrana her dokunduğunda, dıştan içe doğru sıradaki dönen halka olduğu yerde kilitlenir. Kilitli halkaların boşluklarının ortak kesişimi, ekranda sarı bir kama olarak görünen **açıklığı** oluşturur. Her yeni kilit bu açıklığı ancak daraltabilir. Açıklık topun geçemeyeceği kadar daralırsa oyuncu kaybeder. Tüm halkalar kilitlenince top açıklığın ortasından dışarı fırlar ve level tamamlanır.

Oyunun temel fikri şudur: her dokunuş öncekilerin sonucunu taşır. İlk kilit kanalın yönünü belirler; sonraki her küçük hata, kalan halkalar için ortak hata payını tüketir.

Tasarım ilkeleri:
- Tek kontrol (dokunma, boşluk ya da Enter tuşu). İkinci bir kontrol eklenmez.
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

**Girdi zamanlaması.** Dokunuşlar kuyruğa alınır ve her karede fizik adımlarından ÖNCE işlenir; böylece dokunuş anı en fazla bir adım (8,3 ms) kayar. Prototipte dokunuş kare hızına bağlıydı: 60 fps'te 16 ms, yani zorluk modelinin varsaydığı 60 ms insan sapmasının dörtte biri kadar sistematik hata.

**Duraklatma.** Biriktiricinin üst sınırı 0,25 sn'dir ve sekme arkaplana alınınca oyun durur. Sınır olmazsa arkaplandan dönüşte biriken süre tek karede yüzlerce fizik adımı olarak çalışır (ya donma, ya anında kayıp). Oyuncu yokken geçen süre levele yazılmaz.

Halka yalnızca oyun "bekleme" (idle) durumundayken hareket eder. Kilitlendikten sonra açısı donar.

## 4. Açıklık hesabı

Çember 720 dilime bölünür (dilim başına 0,5°). `mask[b] = 1` o dilimin şu ana kadar kilitli tüm halkaların bir boşluğunun içinde olduğunu belirtir.

- Level başında tüm dilimler 1'dir. Baştan kilitli halkalar hemen uygulanır.
- Bir halka kilitlenince: her açık dilim için, dilimin orta açısı halkanın herhangi bir boşluk merkezine `gap / 2`'den yakın değilse dilim 0 olur.
- **En büyük açıklık:** çembersel olarak en uzun ardışık açık dilim dizisidir (başa sarmayı hesaba katarak).
- **Kayıp koşulu:** kilitten sonra en büyük açıklık `ceil(NEED / 0,5°)` dilimden kısaysa oyuncu kaybeder. Bu eşik `src/core/geometry.ts` içinde tek bir yerde, `NEED_PASS = ceil(NEED / 0,5°) × 0,5°` (= 18,0°) olarak tanımlıdır ve oyun da level üretici de onu kullanır. Eskiden üç ayrı yerde üç farklı değer vardı (17,871° / 18,0° / 18,871°).
- **Kazanma:** son hareketli halka geçerli şekilde kilitlenince top, en büyük açıklığın ortasındaki açı boyunca fırlatılır.

Level üretici, hız gerektirdiği için dilim yerine **analitik aralık kesişimi** kullanır: açık bölge `{merkez, genişlik}` aralıklarının listesidir ve her kilit bu listeyi kesiştirir. İki yöntemin en fazla 1 dilim farklı olması zorunludur; `src/core/core.test.ts` bunu rastgele senaryolarda, `src/core/levels.test.ts` ise 60 levelin tamamında referans çözücünün yolunu oyunun maske modelinden geçirerek sınar.

## 5. Süre ve yıldızlar

**Süre sınırı:** her levelin `limit` değeri tabloda hazır gelir. Süre level yüklendiği anda başlar, son kilitte durur. Süre biterse level kaybedilir.

**Yıldızlar hassasiyeti ölçer, hızı değil.** Kasa açıldığında:

```
minGap = leveldeki en küçük gap (radyan)
q = (en büyük açıklık − NEED) / (minGap − NEED)
3 yıldız: q >= q3   "Temiz açılış"
2 yıldız: q >= q2   "İyi açılış"
1 yıldız: aksi      "Kıl payı"
```

`q3` ve `q2` level tablosunun en üstünde gelir (şu an 0,46 ve 0,25). Bu eşikler sanal oyuncuların kazandığı oyunların sırasıyla %75'lik ve %40'lık dilimlerinden hesaplanmıştır. Değerler tablo her üretildiğinde yeniden hesaplanır; oyun bunları `levels.json`'dan okur, koda gömmez.

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

1. **Üst çubuk:** solda "Kasa", ortada kalan süre (0,1 sn hassasiyet, virgülle), sağda "Level N" (patron levelinde "N, patron").
2. **Süre çubuğu:** kalan süre oranında dolu ince çubuk. Son %25'te çubuk ve sayaç kırmızıya döner.
3. **Oyun alanı:** kalan tüm alan.
4. **Alt çubuk:** solda ipucu/durum metni, sağda "Baştan başla" düğmesi.

Oyun alanında çizim sırası:
1. Arka planda levelin numarası, büyük ve çok soluk (patron levelinde sarı).
2. Açıklık kamaları: yeterince geniş olanlar sarı %22, yetersiz olanlar kırmızı %15 opaklık. Yalnızca en az bir halka kilitliyken.
3. Halkalar: kilitli olanlar tam opak; sıradaki (aktif) halka sarı ve kalın; ondan sonraki halka %75; diğerleri %40. Kilitlenme anında çizgi kısa süre kalınlaşır.
4. İşaretler: baştan kilitli halkada küçük kare, yön değiştiren halkada kırmızı nokta (boşluğun tam karşısında).
5. Top.

**Renkler** (açık ve koyu tema, sistem ayarına göre):

| Belirteç | Açık | Koyu |
|---|---|---|
| Arka plan | `#E9EEF0` | `#13232B` |
| Mürekkep | `#1D3440` | `#DCE6EA` |
| Top/vurgu | `#E89B00` | `#FFC93C` |
| Hata | `#E5484D` | `#FF6369` |
| Başarı | `#2E9E6A` | `#4CC38A` |
| Soluk metin | `#5A6E79` | `#7F98A4` |

Yazı tipi: Fredoka (400 ve 600), yedek olarak sistem sans-serif. Tüm metinler Türkçedir.

**Kontrast.** Metin renkleri arka planda en az 4,5:1 olmalıdır (WCAG AA). Açık temadaki soluk metin bu yüzden `#6B8390`'dan `#5A6E79`'a koyultuldu (3,40:1 → 4,56:1). Top ve sıradaki halkanın amber rengi korundu, ama ikisi de ince koyu bir kenarla çizilir: açık zeminde amber tek başına 1,97:1 verir ve şekil renkten bağımsız okunmalıdır. Yetersiz açıklık kaması ayrıca kesik konturla işaretlenir, böylece "geçer mi" bilgisi kırmızı/sarı ayrımına bağlı kalmaz. Ölçümler `src/ui/contrast.test.ts` içinde sınanır.

**İpuçları.** Alt çubuktaki metin şu önceliğe göre seçilir:
1. Patron leveli, ilk deneme: `"<ad>: <açıklama>"`.
2. İkinci ve sonraki denemeler: `"Deneme N"`, varsa en iyi yıldızla birlikte.
3. Öğretici ipucu (yalnızca level daha önce bitirilmemişse):
   - Level 1: "Dokun, dış halkayı kilitle"
   - Level 2: "Sarı kama ortak açıklık. Sonraki boşluğu ona hizala"
   - Level 3: "Yıldızlar, kasa açıldığında kalan açıklığın genişliğine göre"
   - Level 4: "İpucu: ilk kilidi, ikinci halkanın boşluğu yaklaşırken vur"
   - Her özelliğin patron olmayan ilk göründüğü level (tablodan otomatik hesaplanır): kareli halka, iki kapılı halka, yön değiştiren halka, hızlanan halka için kısa birer açıklama. Metinler referans sürümdeki `features` nesnesindedir.
4. Aksi halde en iyi skor ya da "Dokun, sıradaki halkayı kilitle".

**Erişilebilirlik ve cihaz:** güvenli alan boşlukları (çentik, ana ekran çubuğu) hesaba katılır; ekran yakınlaştırma ve kaydırma kapalıdır; açık/koyu tema desteklenir; hareket azaltma ayarı açıksa sarsıntı ve flaş kapatılır.

## 8. Level sistemi

60 level `data/levels.json` içinde hazırdır. Oyun bu dosyayı olduğu gibi okur; **oyun içinde rastgele level üretilmez.**

```json
{ "q3": 0.46, "q2": 0.25, "levels": [
  { "n": 1, "boss": null, "hint": null, "limit": 8.9, "rings": [ {"speed": 0.6291, "gap": 30.5554, "gaps": 1, "gapOffset": 177.3851, "flip": 0, "wobble": false, "preLocked": false, "start": 0.2254}, ... ] },
  ...
]}
```

Tablo `tools/gen.ts` ile üretilir. Üretim adımları:

1. **Aday üretimi.** Her level numarası için o numaraya uygun özelliklerle aday yapılar üretilir: halka sayısı `min(2 + ⌊(n−1)/4⌋, 6)`; iki kapılı halkalar 11'den, yön değiştirenler 12'den, hızlananlar 18'den, baştan kilitliler 6'dan itibaren.
   **Halka sayısı ritmi.** Yukarıdaki formül 17. levelde 6'ya ulaşıp orada kalırdı; 60 levelin 41'i aynı yapıdaydı. 6'ya ulaşıldıktan sonra halka sayısı `[6, 6, 5, 6, 4, 6, 5, 6]` dizisinden `(n−1) mod 8` ile seçilir. Daha az halkalı leveller zorluğu kaybetmez: ayarlama adımı boşlukları daraltarak aynı kazanma oranını tutturur, böylece o leveller dayanıklılık yerine hassasiyet ister.
2. **Hata payı milisaniye cinsinden.** Boşluk genişliği sabit derece değil, tolerans süresinden hesaplanır: `gap = NEED + tolSn × (hareketli halkaların hız toplamı)`. Hızlanan halkaların hızı 1,7 katı sayılır. Böylece hız artsa da insan için hissedilen zorluk kontrol altında kalır.
   **Halka başına genişlik.** Her halkanın kendi `gapScale` çarpanı vardır (0,82 – 1,18): `halkanın gap değeri = min(gap × gapScale, 85°)`. Böylece bir leveldeki halkalar farklı genişlikte olur; dar halka oyuncuya "asıl iş burada" der. Patron levelleri elle tasarlandığı için çarpanları 1'dir. Tavan 85°: daha geniş bir boşlukta halkanın üçte biri çizilmez ve halka gibi durmaz.
3. **Referans çözücü.** Kusursuz zamanlamalı bir oyuncu: ilk kilidi hemen vurur, kalan hata payını kalan halkalara eşit böler, dokunuşlar arasında en az 0,3 sn bekler. Levelin çözülemediği ya da 16 sn'den uzun sürdüğü adaylar elenir.
4. **Süre sınırı.** Limit bir tasarım girdisidir, çözücünün çıktısı değil:
   ```
   tasarımLimiti(n) = (4 + 2 × hareketli halka sayısı) × (1 − 0,22 × (n−1)/59)
   limit = max(tasarımLimiti(n), çözücü süresi × 1,5 + 1,5)
   ```
   İlk terim kuraldır: süre halka sayısından gelir ve geç levellerde kademeli sıkılaşır (hareketli halka başına ilk on levelde ~3,7 sn, son on levelde ~2,7 sn). İkinci terim yalnızca güvenlik ağıdır — levelin bitirilebilir kalmasını garanti eder. Aday seçiminde, kazanma oranı denk (≤4 puan fark) adaylar arasında çözücünün tasarım limitine rahat sığdığı aday tercih edilir, böylece güvenlik ağı nadiren devreye girer.
   *Neden:* limit eskiden doğrudan çözücü süresinden geliyordu; çözücü "uygun hizalanma ne zaman gelirse" beklediği için bu süre gürültüydü. Sonuçta komşu leveller arasında 15 sn'ye varan sıçramalar oluyor ve ekrandaki en büyük sayı zorluk hakkında ters sinyal veriyordu.
5. **İnsan benzeri oyuncu.** Dokunuşları ortalama 0 ve standart sapma 60 ms olan normal dağılımla sapar; kalan payın %70'ini kullanmaya razıdır. Her aday 50 kez oynatılır.
   **Sapma simetrik uygulanır (zorunlu).** Erken ya da geç dokunuş, tüm halkaları birlikte ileri veya geri sarar — tek halkanın açısını kaydırmak değildir. Aksi halde `wobble` çarpanı ve `flip` sayacı hesaba katılmaz; bu hata bir önceki sürümde kazanma oranını level başına 19 puana kadar şişiriyordu.
6. **Ayarlama ve sıralama.** Her level için tolerans süresi ikili aramayla ayarlanır, böylece kazanma oranı hedef eğriye oturur: `hedef(n) = 0,97 − 0,57 × ((n−1)/59)^1,1`. Bu eğri %97'den %40'a iner. Normal leveller bir öncekinden kolay olamaz (en fazla 3 puan tolerans).
7. **Patron levelleri** (10, 20, 30, 40, 50, 60) elle tasarlanmıştır ve hedef eğrinin 12 puan altına ayarlanır: Ayna, Merkez, Metronom, Çatal, Tavşan ile kaplumbağa, Büyük kasa. Tasarımları `gen.js` içindeki `BOSSES` nesnesindedir.

Üretici sabit bir tohumla çalışır, her çalıştırmada birebir aynı tabloyu verir.

Komutlar:
```
npm run gen          # data/levels.json'u yeniden üretir
npm run verify       # mevcut tabloyu denetler; sorun varsa 1 koduyla çıkar
npm run verify:full  # üstüne determinizmi de sınar (yeniden üretim birebir aynı dosyayı vermeli)
npm test             # çekirdek birim testleri + level tablosu testleri
npm run sync         # çekirdeği ve tabloyu reference/kasa.html içine gömer
npm run check        # hepsi bir arada
```

`npm run verify` şunları denetler: şema (alan türleri, boşluk ve açı sınırları), her levelin referans
çözücüyle bitirilebilirliği, çözücünün süre sınırının en fazla %90'ını kullanması, kazanma
oranının hedef eğriden en fazla 15 puan sapması, normal levellerin bir öncekinden belirgin kolay
olmaması, ve yıldız dağılımının %15–35 aralığında 3 yıldız vermesi.

**Kural:** oyunun hareket, geometri veya açıklık kurallarında yapılan her değişiklikten sonra `src/core/` güncellenmeli, tablo yeniden üretilmeli ve `npm run check` geçmelidir. Oyun kodu çekirdek mantığı kendi içinde kopyalamamalıdır: açıklık maskesi, en büyük açıklık, geçiş eşiği (`NEED_PASS`) ve yıldız kuralı yalnızca `src/core/` içinde yaşar. `src/core/` DOM'a, dosya sistemine ya da herhangi bir ortama bağımlı değildir; bu yüzden hem tarayıcıda hem Node'da aynı kodu çalıştırır.

`reference/kasa.html` tek dosya olmak zorunda olduğu için çekirdeği ve tabloyu içine gömer, ama gömme işini `tools/sync-prototype.ts` yapar (esbuild ile paketler); o blok elle düzenlenmez ve `npm run check` güncelliğini denetler.

## 9. Kayıt

Cihazda yerel olarak saklanır:
- Son oynanan level.
- Her level için en iyi `{ yıldız, süre }`.

Kayıt okunamazsa oyun hata vermeden Level 1'den başlar. "Baştan başla" düğmesi Level 1'e döner ama rekorları silmez.

## 10. Kabul ölçütleri

Bir sürüm ancak aşağıdakilerin hepsi sağlanınca tamam sayılır:

- [x] `npm run check` başarılı (tip denetimi, birim testleri, tablo denetimi, prototip güncelliği).
- [x] Otomatik test: her level için referans çözücü, oyunun kendi güncelleme döngüsü üzerinden (sabit adımla) leveli süre sınırından önce bitiriyor.
- [x] Birim testleri: açı normalleştirme, maske uygulama, çembersel en büyük açıklık (başa sarma dahil), yıldız hesabı.
- [x] Kayıp sonrası kazanma, süre dolması ve art arda hızlı dokunuş senaryolarında oyun takılmıyor.
- [x] 360×640 ve 1440×900 ekranlarda halkalar ekrana sığıyor, düzen bozulmuyor.
- [ ] Orta seviye bir telefonda 60 fps. *(Masaüstünde ölçüldü: en yoğun kare 1920×1000'de 6,2 ms, telefon ölçüsünde 1,9 ms — 16,7 ms bütçesinin %37 ve %11'i. Gerçek cihazda doğrulanmayı bekliyor: `npm run dev -- --host`.)*
- [x] Açık ve koyu temada tüm öğeler okunabilir.

## 11. Yayın

Oyun, telefona "ana ekrana ekle" ile kurulabilen bir web uygulaması (PWA) olarak dağıtılır.

- **Manifest:** `name` "Kasa", `display` `standalone`, `orientation` `portrait`, `start_url` ve `scope` göreli (`.`) — oyun bir alan adının kökünde de alt klasörde de çalışır. Açılış ekranı `#13232B`, simgenin zeminiyle aynı.
- **Simgeler:** 192 ve 512 piksel, ayrıca Android'in kendi şekline kırptığı `maskable` 512 ve iOS için `apple-touch-icon`. `tools/make-icons.ts` bunları oyunun kendi geometrisinden (`src/core` oranları) üretir ve PNG'yi doğrudan kodlar; çizim kütüphanesi bağımlılığı yoktur. `public/` elle düzenlenmez.
- **Çevrimdışı:** tüm derleme çıktısı servis çalışanıyla önbelleğe alınır. Fredoka yazı tipi Google Fonts'tan geldiği için ayrıca çalışma zamanı önbelleğine alınır, böylece çevrimdışıyken de doğru yazı tipi görünür.
- **Güncelleme:** `autoUpdate`; yeni sürüm sessizce kurulur, oyuncuya sorulmaz.
- **Doğrulama:** `npm run build` sonrası `npm run preview`, ardından sunucu kapatılıp sayfa yeniden yüklenir. Oyun açılmalı ve hiçbir varlık ağdan gelmemelidir.

Mağaza sürümü istenirse ileride Capacitor ile paketlenir; çekirdek kurallar (`src/core`) ortamdan bağımsız olduğu için bu mimariyi değiştirmez.

## 12. Kapsam dışı (sonraki sürümler için fikirler)

Bunlar ilk sürümde yapılmaz, ancak mimari bunlara engel olmamalıdır:
- Level seçim ekranı ve yıldız özeti.
- Ses efektleri ve titreşim (kilit, kayıp, açılış).
- Uygulama mağazası paketi (Capacitor).
- Günlük meydan okuma leveli.
- Oynanış istatistikleri (hangi levelde kaç deneme). Bu veri, simülasyondaki insan modelinin gerçek oyuncularla kalibre edilmesine yarar.
