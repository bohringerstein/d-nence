# Dönence: oyunun matematiği

Bu belge oyunun sayısal temelini türetir ve hangi sınırların nereden geldiğini gösterir.
Şartname (`SPEC.md`) *ne olacağını* söyler; burası *neden öyle olduğunu* söyler.

---

## 1. Topun geçebilmesi: NEED

Top, en iç halkanın boşluğundan radyal olarak çıkar. Yarıçapı `r_i` olan bir halkada,
açısal genişliği `θ` olan bir boşluğun **doğrusal** açıklığı kirişin uzunluğudur:

```
açıklık = 2 · r_i · sin(θ/2)
```

Yarıçapı `r_b` olan top geçebilmek için `2 r_i sin(θ/2) ≥ 2 r_b` ister, yani:

```
θ ≥ 2 · asin(r_b / r_i)
```

Oranlar `r_b = 0,022 S`, `r_i = 0,17 S` olduğundan bu **14,871°**'dir ve `S`'den
bağımsızdır — oyun her ekranda aynı zorluktadır.

Buna 3° emniyet payı eklenir:

```
NEED = 14,871° + 3° = 17,871°
```

Açıklık hesabı çemberi 720 dilime böldüğü için eşik dilime yuvarlanır:

```
NEED_PASS = ⌈NEED / 0,5°⌉ × 0,5° = 18,0°
```

**Neden tek eşik:** oyun dilim sayar, üretici analitik ölçer. İkisi farklı sayı
kullanırsa üreticinin "çözülebilir" dediği bir bölüm oyunda kaybedilir. Eskiden üç
ayrı yerde üç farklı değer vardı (17,871 / 18,0 / 18,871).

### 1.1 Yuvarlak uç düzeltmesi

Halka yayları `lineCap: "round"` ile çizilir. Yuvarlak uç, yayın bittiği noktadan
teğet yönünde `w/2` kadar taşar; bu da boşluğu her iki uçtan `(w/2)/R` radyan daraltır.

Düzeltilmezse görünen boşluk mantıksal boşluktan dar kalır. 360 piksellik bir ekranda:

| | eski | düzeltilmiş |
|---|---|---|
| eşikte görünen açıklık | 12,7 px | 19,1 px |
| topun çapı | 15,8 px | 15,8 px |
| sonuç | **top %24 geniş, üzerine biniyor** | sığıyor |

Yani oyun "geçti" derken göz "değdi" görüyordu. Yay artık her iki uçtan `(w/2)/R`
kadar kısaltılır (`src/game/render.ts`, `halkaCiz`), böylece yuvarlak uç tam boşluk
sınırında biter ve görünen açıklık mantıksal açıklığa eşit olur.

---

## 2. Boşluk genişliği: hata payından türetme

### 2.1 Bir kilit kanalı ne kadar daraltır?

Açık kanal `[−W/2, W/2]`, kilitlenen halkanın boşluğu ideal konumdan `d` kadar kaymış
ve yarım genişliği `h` olsun. Kesişim:

```
[ max(−W/2, d−h) , min(W/2, d+h) ]
```

Buradan: `|d| ≤ h − W/2` ise kayıp **yoktur** (boşluk kanalı tamamen kapsar). Aksi
halde kayıp `|d| − (h − W/2)` kadardır ve her hâlükârda `|d|` ile sınırlıdır.

Oyuncu `i`. halkaya `ε_i` saniye hatayla dokunursa halka `ω_i · ε_i` radyan kaymış
olur. Toplam kayıp:

```
toplam kayıp ≤ Σ |ω_i · ε_i|
```

### 2.2 Formül

Boşluk bu üst sınırı karşılamalıdır:

```
gap = NEED_PASS + tolSn × Σ|ω_i|
```

`tolSn` kilit başına izin verilen zamanlama hatasıdır, saniye cinsinden.

**İlk kilit toplama girmez.** İlk kilit kanalı *daraltmaz*, **tanımlar**: kanal o
halkanın boşluğunun kendisidir ve hangi açıda kilitlendiği genişliği değiştirmez.
Daraltan kilitler 2..n'dir. Toplam, en yavaş halka dışarıda bırakılarak alınır
(oyuncu kanalı en yavaş halkadan kurarsa en az şeyi riske atar).

*Eskiden formül ilk halkayı da topluyordu.* Bu zorluğu bozmuyordu — `tune()` her
bölümün `tol` değerini ayrı ayarlar — ama `tol`'un "milisaniye cinsinden hata payı"
anlamını bozuyordu: 2 halkalı bölümde %100, 6 halkalıda %20 şişiriyordu.

### 2.3 Hızlanan halkalar

`wobble` hızı `ω(1 + 0,7·sin(...))` yapar, tepe hız `1,7ω`'dir. Formül `1,7` katsayısı
kullanır: en kötü durumu alır, muhafazakâr ve doğrudur.

`flip` hızın **işaretini** değiştirir, büyüklüğünü değil; `|ω|` değişmediği için
formüle ek bir katsayı girmez.

---

## 3. Zorluğun gerçek ekseni: τ

Yukarıdaki türetmeyi tersine çevirirsek bir bölümü geçmek için gereken **zamanlama
hassasiyeti** çıkar:

```
τ = (en dar boşluk − NEED_PASS) / (daraltan kilit sayısı × ortalama hız)
```

Bu, oyuncunun kilit başına kaç saniyelik hata yapabileceğidir.

İnsanın dokunuş zamanlaması yaklaşık **60 ms standart sapmayla** dağılır. Buradan:

| τ | anlamı |
|---|---|
| ~120 ms | 2σ — neredeyse kaçırılamaz |
| ~60 ms | 1σ — orta |
| ~30 ms | 0,5σ — zor |
| **< 25 ms** | **insan sınırı; başarı beceriyle değil şansla belirlenir** |

Bu yüzden üretici `τ < 25 ms` olan adayları **eler** (`TAU_TABAN`, `tools/gen.ts`).
Mevcut 1000 bölümlük tabloda en düşük τ tam 25,0 ms'dir ve altında **hiçbir bölüm yoktur.**

### 3.1 Bunun kaçınılmaz sonucu

> **Zorluğun tek gerçek ekseni τ'dur ve aşağıdan insan refleksiyle sınırlıdır.
> Dolayısıyla 1000 bölümde monoton artan bir zorluk matematiksel olarak mümkün değildir.**

Ölçüm bunu doğruluyor: τ ilk 50 bölümde ~103 ms'den başlıyor, 150. bölüm civarında
~40 ms'ye iniyor ve **orada kalıyor**. Kalan 850 bölüm aynı hassasiyet bandındadır.

Diğer eksenler neden yardımcı olmuyor:

- **Halka sayısı** 6'da durur. Geometrik sınır 16'dır (halkalar değmeden), ama desen
  güvenliği izin vermez: 6 halka zaten 1,48 çevrim/derece ve 6 açık-koyu çift üretir;
  ışığa duyarlılık rehberlerinin eşiği ">5 çift" ve riskli bant 1–4 çevrim/derecedir
  (bkz. `SPEC.md` 7. bölüm). 8 halka 2,07 çevrim/dereceye çıkar — daha kötüdür.
- **Hız** artırmak işe yaramaz. `gap = NEED_PASS + tol·Σ|ω|` olduğundan hız artınca
  boşluk da orantılı büyür: τ değişmez, yalnızca her şey büyür ve 85° tavanına dayanır.
  Denendi, 420. bölüm hiç üretilemedi.

---

## 4. 1000 bölüm için çözüm: arketipler

τ ekseni tükendikten sonra bölümlerin birbirinin aynısı olmaması gerekir. Çözüm, aynı
kazanma oranını **farklı becerilerle** tutturmaktır. 60. bölümden itibaren sekiz
bölümlük bir döngü işler:

| arketip | ne zorlar | yapı |
|---|---|---|
| **hassasiyet** | saf zamanlama | 3–4 halka, yön değiştirme ve dalgalanma yok, en dar pay |
| **tahmin** | öngörü | halkaların %70'i flip, %60'ı wobble |
| **çatal** | dallanma | halkaların %75'i iki kapılı |
| **dayanıklılık** | baskı altında çok karar | 5–6 halka, süre %20 kısa |
| **karma** | hepsi | dengeli |

Her arketipte `tune()` gereken boşluk genişliğini ayrı hesaplar, dolayısıyla kazanma
oranı hedefte kalırken **zorluğun kaynağı** değişir.

---

## 5. Zorluk eğrisi

```
taban(n) = 0,94 − 0,59 · min(1, (n−1)/199)^0,45     // %94 → %35, 200. bölümde tabanda
dalga(n) = 0,08 · sin(2π n / 24)                     // ±8 puan, 24 bölümlük salınım
nefes(n) = hash ile seçilen {3,4} aralıklarla yürüyen küme; patrona
           denk gelen nefes n+1'e KAYDIRILIR (iptal edilmez)
hedef(n) = clamp(nefes(n) ? taban + 0,12 : taban + dalga, 0,25 , 0,95)
```

- **Üs 0,45**: iniş başta diktir. Oyuncu 11. bölümde %80'in, 39'da %60'ın altına düşer.
- **Dalga**: 200. bölümden sonra eğri düz kalsaydı kalan 800 bölüm tek bir duvar olurdu.
- **Nefes konumları modüler bir desenden gelmez ve nefes dalgayı ezer.** İkisi birlikte
  tek bir soruna cevap: sabit 4'te dalga (24), nefes (4), patron (10) ve arketip (8)
  periyotlarının EKOK'u tam 120 oluyordu, yani oyun 120 bölümde bir kendini tekrar
  ediyordu. Üç aşamada ölçüldü (eğilimden arındırılmış seri, tarafsız tahminci,
  15-336 arası TAM tarama):

  | nefes kuralı | en güçlü tekrar | en uzun zor seri <%45/<%40/<%35 |
  |---|---|---|
  | sabit 4 | lag **120** = 0,84 | 19 / 9 / 7 |
  | mod 7 (3-4) | lag **70** = 0,75 | 17 / 6 / 6 |
  | **hash{3,4} + kaydırma** | lag **240** = 0,49 | **12 / 4 / 4** |

  Mod 7 tekrarı 120'de gerçekten kırdı ama yok etmedi: tepe 70'e taşındı, çünkü
  EKOK(nefes 7, patron 10) = 70 — yani tekrar daha SIK geliyordu. Hash'le yürüyen
  küme hiçbir EKOK doğurmuyor. Kalan 0,49'luk tepe lag 240'ta ve dalga (24) ile
  patron (10) periyotlarının kendi hizalanmasından geliyor (2 × EKOK(24,10)); nefes
  tarafında yapılabileceğin sonu orası.
- **Patrona denk gelen nefes iptal edilmez, kaydırılır.** İptal etmek nefesi patronun
  fonksiyonu yapıyor ve mod-10 desenini nefes desenine geri sokuyordu. Üstelik kural
  kendi amacına ters çalışıyordu: rahatlamayı tam da en zor bölümün bulunduğu yerde
  iptal ediyordu. Kaydırma "zirve → boşalma" ritmini veriyor.

**Katı monotonluk yoktur** — eğri dalgalıdır. `npm run verify` bunun yerine 20 bölümlük
hareketli ortalamanın düştüğünü ve hiçbir yerde belirgin geri gitmediğini denetler.

---

## 6. Süre sınırı

```
tasarımLimiti(n) = (4 + 2·hareketli halka) × (1 − 0,22·min(1,(n−1)/199)) × arketipÇarpanı
limit = max(tasarımLimiti, çözücü süresi × 1,5 + 1,5)
```

Halka başına ~2 saniye ayrılır. Bu keyfi değildir: oyuncu bir halka için hem tepki
süresini (0,3 sn) hem de boşluğun kanalın önüne gelmesini bekler. Boşluğun geçiş
periyodu `2π/|ω|`'dir (iki kapılı halkada yarısı); tipik `ω ≈ 1,5 rad/sn` için ~4,2
saniye, kullanılabilir pencere oranı ~%30 olduğunda beklenen bekleme ~1,5 saniyedir.
Tepki süresiyle birlikte ~1,8 saniye eder; 2 saniye bunu karşılar.

İkinci terim yalnızca **güvenlik ağıdır**: referans çözücünün gerçekten sığdığını
garanti eder. Aday seçiminde çözücünün tasarım limitine rahat sığdığı adaylar tercih
edilir, böylece güvenlik ağı nadiren devreye girer.

*Eskiden limit doğrudan çözücü süresinden geliyordu.* Çözücü "uygun hizalanma ne zaman
gelirse" beklediği için bu süre gürültüydü: komşu bölümler arasında 15 saniyeye varan
sıçramalar oluyor ve ekrandaki en büyük sayı zorluk hakkında ters sinyal veriyordu.

---

## 6b. Üretimin sert eleme ölçütleri

Zorluk eğrisi bir *hedef*tir; aşağıdaki dört kural ise **aday eleyicidir** — sağlamayan
yapı tabloya hiç girmez. Hiçbiri belgeye yazılmamıştı, yalnız kod yorumlarında yaşıyordu.

**γ — bekleme bütçesi.** "Oyuncu halka başına kaç tur izleyebilir?"

```
P_i = 2π / (g_i · |ω_i|)                 // bir halkanın fırsat periyodu
P_i = max(P_i, 2·flip_i)                 // yön değiştiren halkada
γ   = (limit − m·REACT) / Σ P_i          // m = hareketli halka sayısı
```

`GAMA_TAVAN = 1,3`: γ bunun üstündeyse aday elenir. Sebep, süre sınırının öteki ucu —
halkaların ikinci turunu bekleyebilen oyuncu için zamanlama ölçüsü olmaktan çıkar.
Doğrulama `GAMA_TAVAN + 0,05` toleransıyla denetler; ölçülen en yüksek γ **1,309**.

> **Denetim notu (açık):** `P_i`'nin iki dalı da ölçülerek sorunlu bulundu. Flip'li
> halkaların %87'sinde `|ω|·flip < 2π/g`, yani halka çemberin tamamını hiç taramıyor
> ve bazı yönler için fırsat periyodu **sonsuz** olmalı; formül sonlu bir sayı veriyor.
> İki kapılı halkalarda `gapOffset` medyanı 157° olduğu için ortalama periyot, en uzun
> beklemeyi %13-28 eksik sayıyor. Düzeltilmedi; bkz. aksiyon listesi.

**EN_AZ_PAY — baştan kilitli halkalardan sonra kalan taban pay.**

```
gerekenPay(kalan) = 6° × (1 + (kalan−1)/2) = 3°·kalan + 3°
```

Afin bir kural; eğimi halka başına 6° değil **3°**. Gerekçe: "hiç tepki veremeden
ölmek" yalnız BİRİNCİ dokunuşta olur — dar bir kanalı fark eden oyuncu sonraki
halkalarda bekleyebilir, bekleyemediği tek kilit ilkidir. 396 bölümde baştan kilitli
halka var ve kısıt sıkı bağlıyor: ölçülen en küçük pay fazlası **0,033°**.

**RHYTHM — halka sayısı ritmi.** Formül 17. bölümde 6'ya ulaşıp orada kalıyordu.
6'ya ulaşıldıktan sonra halka sayısı `[6, 6, 5, 6, 4, 6, 5, 6]` dizisinden
`(n−1) mod 8` ile seçilir. Daha az halkalı bölümler zorluğu kaybetmez: ayarlayıcı
boşluğu daraltarak aynı kazanma oranını tutturur, yani o bölümler dayanıklılık yerine
hassasiyet ister.

> **Denetim notu (açık):** `RHYTHM` (periyot 8) ile arketip rotasyonu (periyot 8,
> indeks `(n−60) mod 8`) sabit farkla **faz kilitli** (`59 mod 8 = 3`). Sonuç: n ≥ 60
> için sekiz artık sınıfının dördünde halka sayısı tek değerli. Halka sayısı serisinin
> özilintisi lag 8'de **0,781**. Ritim denetimi bunu göremiyor çünkü kazanma oranı
> serisine bakıyor ve o seri hedefe oturtulmuş durumda.

**SURE_TAVANI ve süre kaybı.** Süre sınırı üretimde iki yönden sıkıştırılır: alt
sınır çözücünün süresi (`best·1,5 + 1,5`), üst sınır γ tavanı. Ayrıca doğrulama iki
ayrı ölçü tutar — `sureKaybi` (tüm denemeler içinde saate yenilenlerin payı, KARAR
ölçüsü) ve `sureOrani` (yalnız kayıplar içindeki pay, teşhis). Hiçbir bölümde
`sureKaybi > 0,30` olamaz; ölçülen ihlal **0**.

**SOLVER_MARGIN.** Referans çözücü geçiş eşiğini değil, onun biraz üstünü hedefler
(`SOLVER_HEDEF = NEED_PASS + SOLVER_MARGIN`): kusursuz bir çözücünün kıl payı geçtiği
bir bölüm, insan oyuncu için çözülemez demektir.

## 7. Yıldız

```
q = (kalan açıklık − NEED_PASS) / (en dar boşluk − NEED_PASS)
```

`q = 0` kıl payı geçiş, `q = 1` boşluğun hiç daralmaması demektir. Payda doğru üst
sınırdır: kanal hiçbir zaman en dar boşluktan geniş olamaz, çünkü kanal tüm boşlukların
kesişimidir.

Sıfır noktası **geçiş eşiğidir**, ham `NEED` değil: oyuncunun kazandığı an eşiği geçtiği
andır. Eskiden `NEED` kullanılıyordu ve `q`, kaybedilen bir genişlikte bile küçük
pozitif çıkabiliyordu.

Eşikler (`q3`, `q2`) **ustalık referansından** hesaplanır: açıklığın en geniş anını
bekleyen ve zamanlaması 35 ms sapan bir oyuncunun her bölümde 25 kez oynadığı
sonuçların %75'lik ve %40'lık dilimleri. Hedef, bu oyuncunun bölümlerin ~%25'inde 3
yıldız alması. Ölçülen dağılım: **%25 / %35 / %40**.

---

## 8. Doğrulamanın istatistiği

Kazanma oranı bölüm başına 50 denemeyle ölçülür. `p ≈ 0,4` civarında bir oranın
standart hatası:

```
SE = √(p(1−p)/50) = 0,069  →  6,9 puan
```

Bu yüzden hedef eğriden izin verilen sapma **±20 puan** (≈3σ), patronlarda ±25'tir.
Daha dar bir bant ölçüm gürültüsünü hata sanardı.

---

## 9. Ölçülen son durum (1000 bölüm)

| | |
|---|---|
| Hassasiyet τ | en düşük **25,0 ms**, medyan 34 ms, en yüksek 278 ms |
| 25 ms altında bölüm | **0** |
| Halka dağılımı | 2:4, 3:116, 4:148, 5:259, 6:473 |
| Patron | 100 (altı tasarım dönüşümlü) |
| Farklı yapı | 267 |
| Yıldız eşikleri | q3 = 0,67, q2 = 0,42 |
| Yıldız dağılımı (usta) | %25 / %35 / %40 |
| Süre sınırı | 6,2–29,8 sn, ortalama 11,55 sn |
| Doğrulama | **0 sorun** |

---

## 10. Kare hızı 60 fps yeterli mi?

Üç ayrı soru ve cevapları farklı.

### Görsel akıcılık — evet

En hızlı halka 4,86 rad/sn (wobble tepe hızı dahil), yani 279°/sn. Dış halkanın
kenarındaki teğetsel hız:

| ekran | 60 fps | 120 fps |
|---|---|---|
| S = 360 (telefon) | 12,8 px/kare | 6,4 px/kare |
| S = 800 (masaüstü) | 28,5 px/kare | 14,3 px/kare |

Dönen bir yayda bu kadarlık adım görünmez; hareket sürekli algılanır. 60 fps görsel
olarak yeterlidir.

### Fizik — kare hızıyla ilgisi yok

Fizik sabit **1/120 sn** adımla ilerler ve biriktirici (accumulator) kullanır. 60 fps'te
kare başına 2 adım, 120 fps'te 1 adım çalışır; simülasyon her iki durumda aynıdır.
Bu, şartnamenin 3. bölümündeki zorunluluktur ve level süreleri bu adımla hesaplanmıştır.

### Girdi zamanlaması — asıl mesele buydu

Tarayıcı dokunuş olayını **anında** üretir, ama oyun onu ancak bir sonraki animasyon
karesinde okuyabilir. Dokunuş o karenin başına yuvarlanırsa:

| fps | kare süresi | yuvarlanma | en zor bölümün payına oranı (τ = 25 ms) |
|---|---|---|---|
| 30 | 33,3 ms | ±16,7 ms | **%67** |
| 60 | 16,7 ms | ±8,3 ms | **%33** |
| 90 | 11,1 ms | ±5,6 ms | %22 |
| 120 | 8,3 ms | ±4,2 ms | %17 |

60 fps'te motorun eklediği hata, en zor bölümlerde oyuncunun **tüm hata payının üçte
biridir** — ve oyuncunun kendi hatası değildir. Daha kötüsü, bu sapma ekran hızına
bağlıdır: 120 Hz telefonda oyun 60 Hz telefondan kolay olur. Aynı bölüm, aynı oyuncu,
farklı sonuç.

**Çözüm kare hızını artırmak değildir.** Dokunuş olayı kendi zaman damgasını taşır
(`PointerEvent.timeStamp`, `performance.now()` ile aynı ölçekte). Damga kuyruğa alınır
ve dokunuş, **fizik saati o ana ulaştığında** işlenir. Sapma böylece en fazla bir fizik
adımı (8,3 ms) olur ve **ekran hızından bağımsızdır**.

`src/game/input.test.ts` bunu doğrudan sınar: aynı gerçek dokunuş anı 30, 60, 90 ve
120 fps'te aynı fizik adımında işlenmelidir.

### Sonuç

> 60 fps bu oyun için **yeterlidir** — ama ancak girdi kare hızından bağımsız olduğu
> için. Düzeltmeden önce cevap "yeterli ama 120 Hz'de oyun ölçülebilir biçimde kolaydı"
> olurdu ve bu, zorluk kalibrasyonunu cihaza bağlı hale getirirdi.
