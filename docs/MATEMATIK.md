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

`P_i` (fırsat periyodu) iki yerde yanlıştı, ikisi de düzeltildi:

- **İki kapılı halka.** Periyot ortalama yaydan hesaplanıyordu; oysa oyuncunun
  beklediği şey EN UZUN yaydır. `gapOffset` medyanı 157° olduğu için ortalama, en uzun
  beklemeyi %13-28 eksik sayıyordu. Artık `P = max(gapOffset, 2π − gapOffset) / |ω|`.
- **Yön değiştiren halka.** Flip'li halkaların %87'sinde `|ω|·flip < 2π/g`, yani halka
  bir turda çemberin tamamını taramıyor: bazı açılar hiç gelmiyor ve fırsat periyodu
  **sonsuz** olmalıyken formül sonlu bir sayı veriyordu. Artık bir kapsama denetimi var
  — `(|ω|·flip + boşluk) / (2π/g) < 1` ise periyot sonsuzdur ve aday elenir.

**EN_AZ_PAY — baştan kilitli halkalardan sonra kalan taban pay.**

```
gerekenPay(kalan) = 6° × (1 + (kalan−1)/2) = 3°·kalan + 3°
```

Afin bir kural; eğimi halka başına 6° değil **3°**. Gerekçe: "hiç tepki veremeden
ölmek" yalnız BİRİNCİ dokunuşta olur — dar bir kanalı fark eden oyuncu sonraki
halkalarda bekleyebilir, bekleyemediği tek kilit ilkidir. 396 bölümde baştan kilitli
halka var ve kısıt sıkı bağlıyor: ölçülen en küçük pay fazlası **0,033°**.

**RHYTHM — halka sayısı ritmi.** Formül 17. bölümde 6'ya ulaşıp orada kalıyordu.
6'ya ulaşıldıktan sonra halka sayısı `[6, 6, 5, 6, 4, 6, 5, 6]` kümesinden seçilir.
Daha az halkalı bölümler zorluğu kaybetmez: ayarlayıcı boşluğu daraltarak aynı kazanma
oranını tutturur, yani o bölümler dayanıklılık yerine hassasiyet ister.

Küme başta **dizi** olarak uygulanıyordu (`RHYTHM[(n−1) mod 8]`) ve bu, arketip
rotasyonuyla (periyot 8, indeks `(n−60) mod 8`) sabit farkla **faz kilidi** üretiyordu
(`59 mod 8 = 3`): n ≥ 60 için sekiz artık sınıfının dördünde halka sayısı tek değerliydi
ve halka sayısı serisinin özilintisi lag 8'de **0,781** çıkıyordu.

Düzeltme nefesteki ile aynı: **küme korunur, sıra karıştırılır.** Her 8'lik blok kendi
karmasıyla (`karistir(blok ⊕ 0x5bf03635)` tohumlu Fisher-Yates) yeniden sıralanır.
Dağılım blok blok birebir aynı kalır — "her 8 bölümde bir 4 halkalı" garantisi durur —
ama yeri öngörülemez ve arketip döngüsüyle faz kilidi kırılır. Uzun seri riski de yok:
karıştırma blok İÇİNDE olduğu için aynı değer en fazla blok sınırında komşulaşabilir.

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

### 8.1 Üç ayrı tohum

Üretim rastgeleliğe dayanır (oyuncu hatası simüle edilir), dolayısıyla her kazanma
oranı bir **ölçümdür**, gerçeğin kendisi değil. Tek tohum kullanmak, sınavı cevap
anahtarıyla okumaktır. Bu yüzden üç ayrı çekiliş var ve hiçbiri diğerinin yerine
geçemez:

| Tohum | Nerede | Deneme | İşi |
|---|---|---|---|
| `URETIM_TOHUMU` = 777 | `tune` taraması | 50 | ucuz eleme: hangi tolerans hedefe yakın |
| `SECIM_TOHUMU` = 424242 | finalist ölçümü | 200 | **karar**: hangi aday tabloya girer |
| `DENETIM_TOHUMU` = 20260923 | `npm run verify` | 200 | **sınav**: tablo hedefi tutturmuş mu |

Bu ayrım eklenmeden önce `verify`, ayarlayıcının optimize ettiği aynı 50 çekilişi
tekrar oynatıyordu; ölçülen sapma gerçeğin yaklaşık **1/28'i** kadar çıkıyordu.

### 8.2 Kazananın laneti

Ayrı tohum eklenince ortaya çıkan ilk bulgu şuydu: 12 bölüm hedefinin **20-30 puan
üstünde**, ve sapmaların hepsi **aynı yönde** — yani gürültü değil yanlılık.

Sebep seçim kuralının kendisiydi. Tarama, bölüm başına 36 adayı 8 tolerans adımıyla
deniyor ve hedefe en yakın **ölçümü** seçiyor. 50 denemede standart sapma ~7 puan
olduğu için, 288 gürültülü ölçümün en iyisini seçmek klasik **kazananın laneti**ni
üretir: hedefin altında ölçülen aday seçilme şansı yüksek olduğundan, seçilenin
gerçek kazanma oranı sistematik olarak hedefin üstüne çıkar. Beklenen yanlılık
yaklaşık `2σ ≈ 14 puan`; ölçülen 15-22 puandı.

Çare standarttır — seçimi ikiye bölmek:

1. **Tarama** ucuz ve gürültülü kalır (36 aday × 50 deneme, tohum 777).
2. **Finalistler** (hedefe en yakın 4 aday) bağımsız bir tohumla ve 200 denemeyle
   yeniden ölçülür; karar o ölçüme göre verilir.

Yeniden ölçüm seçimden bağımsız olduğu için lanet 4 finaliste ve 200 denemeye iner
(`≈ 1,2 × 3,2 ≈ 4 puan`). Ek maliyet taramanın yanında yaklaşık %5.

### 8.3 Bant ve nokta tahmini sorunu

Karar ölçümü 200 denemedir; `p ≈ 0,4` civarında standart hata:

```
SE = √(p(1−p)/200) = 0,035  →  3,5 puan
```

Hedef eğriden izin verilen sapma **±20 puan**, patronlarda ±25. Bant, ölçüm hatasının
değil **tasarım toleransının** ölçüsüdür: bir bölümün hedefinden 20 puan sapması
oyuncunun hissedeceği ama eğriyi bozmayacak bir farktır.

Ama bant, bölümün **gerçek** kazanma oranı hakkındadır; elimizdeki ise 3,5 puan
hatalı bir tahmin. Nokta tahminini sert bir eşikle karşılaştırmak, gerçek sapması 17
puan olan bir bölümün koşuların yaklaşık beşte birinde "ihlal" görünmesi demektir. Ve
`verify` yayın kapısı olduğu için bu, tablonun değil ölçümün gürültüsüyle kırmızıya
dönen bir kapı olurdu. Ölçtüm: art arda koşularda bantta kalamayan bölüm kümesi her
seferinde değişiyordu (192/233/380/428/828/860/928 → 623/663 → 428), hiçbiri sabit
değildi; sayıları da 1 ile 3 arasında gidip geliyordu.

Bu yüzden karar iki ayrı ölçüyle verilir ve ikisi farklı şeyi yakalar:

| Ölçü | Eşik | Neyi yakalar |
|---|---|---|
| Tek bölüm | `\|sapma\| > bant + 2·SE` (±27, patron ±32) | gerçekten eğri dışına düşmüş bölüm |
| Toplam | bandı aşan bölüm sayısı > **10** (%1) | tek tek marjinal olsalar bile eğrinin kayması |

Gevşeyen yalnızca "bir bölüm sınıra değdi" durumudur. Sistematik bir bozulma — ki
denetimin asıl işi odur — eskisinden daha kesin yakalanır, çünkü eskiden sayı hiç
ölçülmüyordu. Aynı mantık süre şiddeti kuralına da uygulandı: o kuralın işi **bozuk
bir arketipi** yakalamaktı ve öyle bir arketip onlarca bölüm üretir (ölçülen 22); tek
şanssız bir bölüm onunla aynı kovaya konmamalı. Ölçü artık sayı tavanı (3) artı tek
bölüm için mutlak tavan (%55).

### 8.4 Ritim: tavanı elle koymamak

Ritim denetimi "oyun kendini tekrar ediyor mu" sorusunu sorar. İki kere yeniden
yazıldı, çünkü ilk iki hâli yanlış şeyi ölçüyordu:

- İlk hâli **tek bir gecikmeye** (120) bakıyordu ve düzeltme tepeyi 70'e taşıyınca
  kör kaldı.
- İkinci hâli bütün gecikmeleri tarıyordu ama **kazanma oranı serisine** bakıyordu —
  oysa o seri zaten hedefe oturtulmuş durumda, yani yapıdaki tekrarı gizliyor. Üstelik
  tavanı (0,60) elle konmuştu; ölçüm aştığında tavanı yükseltmek cazip hale geliyordu,
  ki bu sınavı cevaba uydurmaktır.

Şimdiki hâli üç seriyi birden ölçer ve **her birinin tavanını kendi boş hipotezinden
türetir**:

| Seri | Ne ölçer | İstatistik |
|---|---|---|
| Halka sayısı (patronsuz) | oyuncunun doğrudan gördüğü yapı | `s[i] = s[i+ℓ]` eşleşme oranı |
| Arketip (patronsuz) | hangi mekanikler var | eşleşme oranı |
| Hedeften sapma | tasarımın tutturulamadığı yer | tarafsız özilinti |

**Neden patronsuz.** Altı patron tasarımı 10 bölümde bir dönüyor, yani aynısı 60
bölümde bir geliyor. Bu kasıtlı ve oyuncuya görünür bir dönüm noktası; şartnamede
yazılı, `levels.test.ts` ayrıca garanti ediyor. Seriye katıldığında 60'ın katı olan
gecikmelere sabit bir eşleşme sinyali ekliyor (ölçtüm: lag 240'ta 74 patron çiftinin
73'ü eşleşiyor) ve denetimin ASIL aradığı şeyi — sıradan bölümlerde istemeden oluşan
tekrarı — bastırıyor.

**Neden "hedeften sapma", "eğilimden arındırılmış oran" değil.** Zorluk serisinin
kalıntısı önce 25 pencereli hareketli ortalamayla çıkarılıyordu. Ölçtüm: o kalıntının
en güçlü gecikmeleri 120, 50, 190, 310, 240, 290, 70 — **hepsi 10'un katı**, yani
patron temposu. Patronlar çıkarılınca tepe düşüyor ama geniş bir yükselme kalıyordu;
sebebi zorluk eğrisinin kendi dalgası: `DALGA_PERIYOT = 24` ve 25'lik bir hareketli
ortalama 24 periyotlu bir sinüsü izleyemez, dolayısıyla kalıntıda dalganın tamamı
duruyordu. Yani denetim, tasarımın KASITLI ritmini kusur sayıyordu.

Doğru kalıntı hedeften sapmadır: hedef eğrisi dalgayı, nefesi ve patron çukurunu
zaten içerir. Geriye kalan "tasarımdan sapma"dır, beyaz gürültü olmalıdır, ve orada
bulunan her periyot istemsizdir. Permütasyon boş hipotezi de ancak bu seri için
geçerlidir — süzgeçten geçmiş bir seri sıra değişimine duyarsız değildir.

Tavan şu soruyla bulunur: *"aynı seri rastgele sıralansaydı bu istatistik en fazla ne
kadar yükselirdi?"* Seri 200 kez karıştırılır, her karıştırmada istatistiğin
gecikmeler üstündeki **maksimumu** alınır, tavan bu dağılımın %99'luk dilimidir.
İstatistik zaten bir maksimum olduğu için çoklu karşılaştırma düzeltmesi de bedava
gelir: boş hipotez de aynı maksimumu alıyor.

**Bu denetim işe yaradı.** İlk çalıştırmada halka sayısı serisinde lag 240'ta %53,2
eşleşme buldu (tavan %37,0) ve teşhis `RHYTHM`'i değil **arketip rotasyonunu**
gösterdi: `hassasiyet` 3-4, `dayaniklilik` 5-6 halka zorunlu kıldığı ve arketip
`(n−60) mod 8` ile seçildiği için halka sayısı da 8 periyotluydu — 8'in katı olan her
gecikmede eşleşme %48, katı olmayanda %28. Patronlar seriden çıkarılınca tepe %30'a
düşüyordu, yani kalan imzayı arketip basıyordu. İkisi de blok karıştırmasıyla
düzeltildi (küme korunur, sıra karıştırılır).

### 8.5 Ritim denetiminin bulduğu ikinci şey: kilitli zorluk kolu

Kalıntı hedeften sapma olarak yeniden tanımlandıktan sonra denetim bir periyot daha
gösterdi: en güçlü iki gecikme **120 ve 240** (0,24 ve 0,16), yani gerçek bir periyot
ve katı. 120 = EKOK(dalga 24, patron 10).

Teşhis: sapmayı üreten bölümler `merkez` patronunun dalga çukuruna denk gelen
örnekleriydi — hedef %22, ulaşılan %49. Sebep tasarımın içindeydi. `merkez`'in baştan
kilitli bir halkası var, dolayısıyla `gerekenPay(4) = 15°` kuralı başlangıç
açıklığına taban koyuyor ve boşluk `NEED_PASS + 15° = 33°`in altına inemiyor. Tabloda
ölçülen boşluk tam **33,0°**: kısıt birebir bağlıyordu. Yani ayarlayıcının zorluk kolu
kilitliydi; hedef ne derse desin o bölüm daha zor olamıyordu.

Çözüm hedefi indirmek değil, çalışan kolu kullanmak: `τ = (boşluk − NEED_PASS) / Σ'|ω|`
olduğu için hızları 1,5 katına çıkarmak aynı boşlukta τ'yu **48,5 ms'den 32,3 ms'ye**
indirir — insan sınırının (25 ms) hâlâ üstünde. `buyukKasa`da yapılan düzeltmenin
aynısı.

> Bu, ritim denetiminin neden zorluk serisini de ölçmesi gerektiğinin örneğidir:
> yapı serileri temizdi, bant ihlali yalnızca iki bölümdü, ama periyot analizin
> gösterdiği şey iki bölüm değil **bir tasarım kusuruydu** ve her 120 bölümde
> tekrar ediyordu.

### 8.6 Zor seri

Ritmin bedeli ayrıca denetlenir: periyodikliği kırmanın kolay yolu zor bölümleri arka
arkaya dizmektir. Bu ölçü de iki kere düzeltildi. Eskiden **mutlak** eşiklerle
çalışıyordu (%35/%40/%45 altı); ama hedef eğrisi 200. bölümde zaten %35'e indiği için
sonraki 800 bölümün neredeyse tamamı "%45 altı" sayılıyordu — denetim ritmi değil
eğrinin kendisini ölçüyordu.

Şimdi ölçü **yerel hedefe** göre: bir bölüm ancak kendi hedefinin 7 puan (≈2 SE)
altındaysa "olması gerekenden zor" sayılır. Tavan yine boş hipotezden gelir — aynı
oranda ama bağımsız dağılmış zor bölümlerle en uzun kesintisiz serinin %99'luk dilimi.

---

## 9. Ölçülen son durum (1000 bölüm)

| | |
|---|---|
| Hassasiyet τ | en düşük **25,0 ms**, medyan 31 ms, en yüksek 326 ms |
| 25 ms altında bölüm | **0** |
| Halka dağılımı | 2:4, 3:173, 4:138, 5:250, 6:435 |
| Mekanik | iki kapılı 516, flip 482, hızlanan 550, baştan kilitli 371 bölüm |
| Patron | 100 (altı tasarım dönüşümlü + kapanış) |
| Yıldız eşikleri | q3 = 0,67, q2 = 0,41 |
| Yıldız dağılımı (usta) | %25 / %35 / %41 |
| Süre sınırı | 5,3–33,6 sn, ortalama 11,9 sn |
| γ | ortalama 0,58, en yüksek 1,31 (tavan 1,3) |
| Bant dışı bölüm | **1** / 1000 (tavan 10); en büyük sapma +20 puan (tavan ±27) |
| Saate yenilme | baskın olduğu bölüm 1/1000; %30 üstü 1 bölüm (tavan 3) |
| Ritim | halka 0,359 / 0,375 — arketip 0,234 / 0,254 — zorluk 0,139 / 0,156 (hepsi tavan altı) |
| Zor seri | en uzun 2 (tavan 2) |

Bu sayıların hepsi **üretimden bağımsız bir tohumla** ölçülmüştür (bkz. §8.1).
Önceki sürümde aynı satır "doğrulama: 0 sorun" diyordu ve bu doğru değildi —
ayarlayıcının optimize ettiği çekilişi tekrar oynatıyordu.

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
