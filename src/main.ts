// Dönence: uygulamanın giriş noktası. Parçaları birbirine bağlar, kural içermez.
import "./styles.css";
import { LEVEL_COUNT, validateTable, DEG } from "./core/index.ts";
import type { LevelTable, Best } from "./core/index.ts";
// Level tablosu JS paketine GÖMÜLMEZ, ayrı bir dosya olarak indirilir.
// 1000 bölümde tablo 643 KB; bu kadar veriyi JavaScript nesne sabiti olarak
// ayrıştırmak telefonda yarım saniye yer, JSON.parse aynı veriyi ~10 kat hızlı okur.
// Servis çalışanı dosyayı önbelleğe aldığı için çevrimdışı çalışma etkilenmez.
import tabloUrl from "../data/levels.json?url";

import { createLevel, tap, step, decay, kalanSure } from "./game/state.ts";
import type { LevelState } from "./game/state.ts";
import { dongu, ADIM } from "./game/loop.ts";
import { girdiBagla } from "./game/input.ts";
import { tuvalKur, ciz } from "./game/render.ts";
import { renkleriOku, renklerHazir, hareketAzalt, tercihleriIzle } from "./game/theme.ts";
import { ogreticiTablosu, ipucu, yildizYazisi, sureYazisi, kayipYazisi, kalanYazisi } from "./game/hints.ts";
import { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel, tabloSurumuUygula, disaAktar, iceAktar, kaydiDegistir,
  devamNoktasiYaz, devamNoktasiOku } from "./game/storage.ts";
import { izgaraHtml, sayfaSayisi, sayfasi, aralik } from "./ui/secim.ts";
import { acilisBolumu, resetOnayHedefi, kazanincaSonraki, bitisCikisi } from "./game/akis.ts";
import { ayarlariOku, ayarlariYaz, halkaOpakligi, titret, titresimVarMi } from "./game/ayarlar.ts";
import { cal, sesiAc, sesiDuraklat, sesVarMi } from "./game/ses.ts";
import { kabukKur } from "./ui/shell.ts";
import { nasilHtml } from "./ui/nasil.ts";
import { ortuAc, ortuKapat } from "./ui/ortu.ts";
import { guncellemeHazir, guncellemeyiUygula } from "./game/guncelleme.ts";
import { DILLER, cihazDili, gecerliDilMi, sayi } from "./dil/index.ts";

const hedef = document.getElementById("app");
if (!hedef) throw new Error("#app bulunamadı");

/**
 * Açılışta çıkılamayan bir hata: ekrana yazar ve modülü durdurur.
 *
 * Bu fonksiyon var olduğu için var: tablo isteği reddedildiğinde (bağlantı yok,
 * sunucu 404, önbellek boş) modülün EN ÜST düzeydeki `await`i çözülmüyor ve modül
 * hiç çalışmıyordu — ekranda tek satır yazı olmadan beyaz bir sayfa kalıyordu.
 * PWA olarak ana ekrana eklenmiş bir oyunda bunun anlamı, kalıcı olarak boş açılan
 * bir simge ve ayıklanacak hiçbir iz olmaması.
 */
function hataEkrani(baslik: string, metin: string, ayrinti: string[], yeniden: boolean): void {
  // Bu ekran ayarlar okunmadan önce çalışabilir: cihaz dilini kullan.
  const h = DILLER[cihazDili()];
  document.documentElement.lang = h.kod;
  hedef!.innerHTML = `<main class="hataEkrani"><h1>Dönence</h1>
    <h2>${baslik}</h2>
    <p>${metin}</p>
    ${yeniden ? `<button id="yeniden" type="button">${h.tekrarDene}</button>` : ""}
    ${ayrinti.length ? `<ul>${ayrinti.slice(0, 10).map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
  </main>`;
  hedef!.querySelector("#yeniden")?.addEventListener("click", () => location.reload());
}

/**
 * Tablo isteği. Zaman aşımı da bir başarısızlıktır: yanıtı hiç gelmeyen bir istek
 * ekranda sonsuza kadar bekleyen bir boşluktan farksızdır.
 *
 * `AbortSignal.timeout` DEĞİL, `AbortController` + `setTimeout`. Öncekinde özellik
 * denetimi vardı ve desteklenmeyen tarayıcıda (iOS 15 ve altı, Firefox <100,
 * Chrome <103) zaman aşımı sessizce iptal oluyordu — yani beyaz sayfa hatası, tam
 * da bu kodun kapatmak için var olduğu hata, o tarayıcılarda açık kalıyordu.
 * `AbortController` Safari 12.1'den beri var, yani hiçbir hedefte boşluk kalmıyor.
 *
 * `finally` şart: başarılı istekten sonra 30 saniye yaşayan bir zamanlayıcı kalırdı.
 */
const ISTEK_ZAMAN_ASIMI = 30_000;
/** Bu süreden sonra ekranda "indiriliyor" yazısı belirir. */
const YUKLENIYOR_GECIKMESI = 4_000;

async function tabloyuIndir(): Promise<unknown> {
  const iptal = new AbortController();
  const zamanlayici = setTimeout(() => iptal.abort(), ISTEK_ZAMAN_ASIMI);
  try {
    const r = await fetch(tabloUrl, { signal: iptal.signal });
    // 404 da bir Response'tur: r.ok denetlenmezse hata "beklenmeyen < karakteri"
    // olarak JSON çözücüden gelir ve asıl sebebi (dosya yok) gizler.
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(zamanlayici);
  }
}

// Yavaş bağlantıda ekran birkaç saniye boş kalıyordu ve boş ekran, hata ekranından
// ayırt edilemiyor. Bekleyen oyuncu bekleyeceğini bilmeli.
const yukleniyorYazisi = setTimeout(() => {
  const h = DILLER[cihazDili()];
  hedef.innerHTML = `<main class="hataEkrani"><h1>Dönence</h1><p>${h.yukleniyor}</p></main>`;
}, YUKLENIYOR_GECIKMESI);

let ham: unknown;
try {
  ham = await tabloyuIndir();
} catch (e) {
  clearTimeout(yukleniyorYazisi);
  const h = DILLER[cihazDili()];
  hataEkrani(h.tabloIndirilemediBaslik, h.tabloIndirilemediMetin, [], true);
  throw e;
}
clearTimeout(yukleniyorYazisi);

// Tablo bozuksa sessizce garip bir oyun açmak yerine durumu söyle.
const semaHatalari = validateTable(ham);
if (semaHatalari.length) {
  const h = DILLER[cihazDili()];
  hataEkrani(h.tabloHatasiBaslik, h.tabloHatasiMetin, semaHatalari, false);
  throw new Error("level tablosu geçersiz: " + semaHatalari.length + " sorun");
}
const tablo = ham as LevelTable;

const ayarlar = ayarlariOku();
// Oyuncunun seçimi varsa o, yoksa cihazın dili (bkz. dil/index.ts cihazDili).
const dilKodu = gecerliDilMi(ayarlar.dil) ? ayarlar.dil : cihazDili();
const M = DILLER[dilKodu];
// Ekran okuyucu ve tarayıcının tireleme/yazım kuralları doğru dili bilmeli.
document.documentElement.lang = dilKodu;

const ui = kabukKur(hedef, M, nasilHtml(M));
const kayit = oku();
// Tablo yeniden üretildiyse eski rekorlar başka bölümlere aittir (bkz. storage.ts).
// Damgadan önceki kayıtlar cezalandırılmaz: alan yoksa mevcut tablo benimsenir.
const silinenRekor = tabloSurumuUygula(kayit, tablo.v);
const ogretici = ogreticiTablosu(tablo.levels, M);
let renk = renkleriOku();
// Sistem tercihi VEYA oyuncunun kendi seçimi; ikisinden biri yeterli.
let azalt = hareketAzalt() || ayarlar.hareketAzalt;
/**
 * Yürürlükteki bölümün durumu. GERÇEKTEN kurulu başlar — `null as unknown as
 * LevelState` değil.
 *
 * Eski hâlde tip yalan söylüyordu: `durum` asla null olamaz diyordu ama açılışın
 * sonuna kadar null'du ve dört satır aşağıdaki `if (durum)` koruması derleyici
 * gözünde ölü koddu. Bir sonraki geliştirici ya korumayı "gereksiz" diye silerdi ya
 * da erken erişip `undefined` okuma hatası alırdı — üstelik `cizim()` zaten korumasız
 * `durum.rings.length` okuyor. Tip, sözleşmeyi kovalamalı; derleyiciyi susturmamalı.
 *
 * Buradaki değer geçicidir: `levelYukle` aşağıda arayüzü, kaydı ve sayacı da kurar.
 */
let durum: LevelState = createLevel(tablo.levels[acilisBolumu(kayit) - 1], 1);
/**
 * Ekranın modu. Üç ayrı boole yerine TEK bir değer.
 *
 * Eskiden `bitti`, `panelAcik` ve `duraklatildi` bağımsız üç bayraktı; üçü de aynı
 * soruyu (`oyunDonuk`) besliyordu ama birbirini dışlamıyordu. Sekiz temsil edilebilir
 * kombinasyon vardı, geçerli olan dördü. Bedeli kodda görünüyordu: tek bir tıklamada
 * dört örtü ve iki bayrak birden sıfırlanıyordu — "durumu çözemiyorum, hepsini
 * sıfırlayayım" refleksi. Bu proje doğru deseni zaten biliyor (`TapSonuc`,
 * `AdimSonuc`, `Sonraki` ayrık birleşimleri); ekran durumu onun dışında kalmıştı.
 *
 * `geriSayim` BİLEREK ayrı kaldı: o bir mod değil, bir sayaç — her modda değil,
 * yalnız "oyun" modunda ilerler ve sıfıra ulaşınca kendiliğinden biter.
 */
type Mod = "oyun" | "panel" | "duraklat" | "bitis";
let mod: Mod = "oyun";

/**
 * Devam ederken çalışan geri sayım (saniye). Sıfırdan büyükken oyun HÂLÂ donuktur.
 *
 * Neden halkalar da donuk: geri sayım boyunca dönselerdi oyuncu bedava gözlem süresi
 * kazanırdı ve süre bütçesi delinirdi — duraklat, izle, duraklat diye sömürülebilirdi
 * (bkz. docs/SPEC.md, γ). Geri sayımın işi bilgi vermek değil, oyuncunun parmağını
 * ekrana geri getirmesine zaman tanımak.
 */
let geriSayim = 0;
const GERI_SAYIM_ADET = 3;
const GERI_SAYIM_BEKLEME = 0.6;   // rakam başına saniye
let sonGeriSayimRakami = -1;

/** Oyun canlı değil: fizik durur, dokunuşlar yok sayılır. */
const oyunDonuk = (): boolean => mod !== "oyun" || geriSayim > 0;

const tuval = tuvalKur(ui.canvas, cizVeYaz);
// Ekranın tamamı dokunma alanı: canvas'a bağlansaydı üst ve alt çubuk ölü bölge olurdu.
const girdi = girdiBagla(ui.kok);

// iOS ses bağlamını yalnızca bir kullanıcı hareketinin İÇİNDE açar. Oyunun dokunuşları
// zaman damgasıyla kuyruğa alınıp fizik adımında işlendiği için ses çalma anı artık
// hareketin içinde değil; bu yüzden bağlam doğrudan buradan açılıyor.
ui.kok.addEventListener("pointerdown", () => { if (ayarlar.ses) sesiAc(); });
// Sekme arkaplana alınınca oyun zaten duruyor (game/loop.ts); ses bağlamı da askıya
// alınır, sonraki dokunuşta kendiliğinden uyanır.
// Sekme gizlenince ses bağlamı askıya alınır. Geri sayımı BURADAN başlatmıyoruz:
// donukluğun çözülmesi `focus` ya da `visibilitychange` olmak zorunda değil — dokunuş
// da çözüyor — o yüzden haber döngüden geliyor (bkz. dongu `cozuldu`).
document.addEventListener("visibilitychange", () => { if (document.hidden) sesiDuraklat(); });

// ---- Geliştirme kancası ----------------------------------------------------
//
// YALNIZCA `npm run dev`'de var; `import.meta.env.DEV` üretim paketinde `false`
// olduğu için bu blok bundle'dan tamamen düşer (tree-shaking).
//
// Varlık sebebi: oyunun zorluğu 60 ms'lik insan dokunuş sapmasına göre kalibre
// ediliyor ve bu simülasyonda doğrulanıyor. Ama simülasyon oyunun KENDİ döngüsünü
// değil, üreticinin modelini çalıştırıyor. Bu kanca, gerçek tarayıcıda gerçek
// `pointerdown` olaylarıyla, gerçek fizik döngüsüne karşı aynı oyuncuyu oynatmayı
// mümkün kılıyor — yani girdi hattının (zaman damgası kuyruğu dahil) kalibrasyonu
// bozmadığını uçtan uca sınamayı.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __donence: unknown }).__donence = {
    get durum() { return durum; },
    get kayit() { return kayit; },
    levelYukle: (n: number) => levelYukle(n),
    tablo
  };
}

// ---- Level yükleme: tek nesne toptan değişir, alan alan sıfırlama yok -------
function levelYukle(n: number, denemeyiKoru = false): void {
  const deneme = denemeyiKoru ? durum.deneme + 1 : 1;
  const level = tablo.levels[n - 1];
  durum = createLevel(level, deneme);
  girdi.temizle();
  geriSayimDurdur();

  // Numara kalın, geri kalanı künye tonunda: "patron" da sonekin içinde, çünkü kalın
  // 1,4 rem içinde 320 piksellik telefonda üst çubuğu taşırıyordu.
  ui.lvl.textContent = String(n);
  ui.lvlToplam.textContent = ` / ${LEVEL_COUNT}${level.boss ? M.patronEki : ""}`;
  yazVeyaErtele(ipucu({ level, deneme, rekor: kayit.bests[n], ogretici, m: M }));
  levelKaydet(kayit, n);
  saatiGuncelle();
}

/**
 * Alt çubuk metni. Sonuç mesajları KORUMALI yazılır.
 *
 * Neden: kayıp animasyonu 0,9 saniye sürüyor ve bitince level yeniden yükleniyor,
 * yüklenme de ipucunu hemen eziyordu. Yani "Açıklık kapandı · 1,4° dar kaldı" —
 * oyuncunun "neden kaybettim" sorusuna cevap veren tek cümle — ekranda 0,9 saniye
 * duruyordu. O cümleyi okumak bundan uzun sürer. Mesaj artık bir sonraki denemeye
 * taşar; yeniden başlama gecikmez, yalnızca açıklama okunacak kadar kalır.
 */
const yaz = (metin: string): void => { ui.hint.textContent = metin; };

/** Sonuç mesajının ekranda kalacağı süre (kayıp animasyonu dahil). */
const SONUC_SURESI = 2.4;
let ipucuKilidi = 0;
let bekleyenIpucu: string | null = null;

function yazKoru(metin: string): void {
  yaz(metin);
  ipucuKilidi = SONUC_SURESI;
  bekleyenIpucu = null;
}

/** Kilit varken ipucu bekletilir; yoksa hemen yazılır. */
function yazVeyaErtele(metin: string): void {
  if (ipucuKilidi > 0) bekleyenIpucu = metin;
  else yaz(metin);
}

function ipucuKilidiIlerlet(dt: number): void {
  if (ipucuKilidi <= 0) return;
  ipucuKilidi -= dt;
  if (ipucuKilidi > 0) return;
  if (bekleyenIpucu !== null) { yaz(bekleyenIpucu); bekleyenIpucu = null; }
}

/** Level değişiminde bekleyen mesaj kalmasın (yeniden başla, bitiş ekranı). */
function ipucuKilidiSifirla(): void { ipucuKilidi = 0; bekleyenIpucu = null; }

/** Sesli sayaçta en son yazılan tam saniye; her karede DOM'a yazmamak için. */
let sonSesliSaniye = -1;

function saatiGuncelle(): void {
  const kalan = kalanSure(durum);
  ui.clockSayi.textContent = sureYazisi(kalan, M);
  // Sesli sayaç saniyede bir tazelenir ve tam saniye söyler. role="timer" kendiliğinden
  // okunmaz (aria-live varsayılanı "off"): oyuncu rotordan/tarama kipinden istediğinde
  // okur. Ondalıkla ve her karede yazmanın tek etkisi boşa DOM trafiği olurdu.
  const tamSaniye = Math.max(0, Math.ceil(kalan));
  if (tamSaniye !== sonSesliSaniye) {
    sonSesliSaniye = tamSaniye;
    ui.clockSes.textContent = M.kalanSureSesli(sayi(M, tamSaniye, 0));
  }
  const az = kalan < durum.level.limit * 0.25;
  ui.clock.classList.toggle("low", az);
  ui.bar.classList.toggle("low", az);
  ui.barFill.style.transform = `scaleX(${kalan / durum.level.limit})`;
}

let sonFlas = -1;
function cizVeYaz(): void {
  ciz(tuval, durum, renk, { hareketAzalt: azalt, halkaOpakligi: halkaOpakligi(ayarlar) });
  // Flaş canvas yerine ayrı bir katmanda: tam ekran dolgu geniş ekranda 4 ms tutuyordu.
  const f = azalt ? 0 : durum.flash * 0.18;
  if (f !== sonFlas) {
    ui.flas.style.opacity = String(f);
    ui.flas.classList.toggle("kayip", durum.asama === "crash");
    sonFlas = f;
  }
}

// ---- Dokunuş ---------------------------------------------------------------
function dokunusIsle(gercekZaman: number): void {
  const n = girdi.al(gercekZaman);
  for (let i = 0; i < n; i++) {
    const sonuc = tap(durum, tablo.q3, tablo.q2);
    if (sonuc.tip === "kilit") { titret(ayarlar, "kilit"); cal(ayarlar, "kilit", sonuc.aciklik); }
    if (sonuc.tip === "kayip") {
      titret(ayarlar, "kayip"); cal(ayarlar, "kayip");
      yazKoru(kayipYazisi(sonuc.pay / DEG, M));
      return;
    }
    if (sonuc.tip === "acildi") {
      const yeni: Best = { s: sonuc.yildiz, t: +sonuc.sure.toFixed(2) };
      const oncekiVardi = kayit.bests[durum.level.n] !== undefined;
      titret(ayarlar, "acildi"); cal(ayarlar, "acildi");
      const rekor = rekorKaydet(kayit, durum.level.n, yeni);
      yazKoru(M.sonucSatiri(M.yildizEtiketi[sonuc.yildiz], yildizYazisi(sonuc.yildiz), sureYazisi(sonuc.sure, M)) +
          kalanYazisi(sonuc.q, tablo.q3, tablo.q2, M) +
          (rekor && oncekiVardi ? M.rekorEki : ""));
      return;
    }
    if (sonuc.tip === "yok") return;
  }
}

// ---- Döngü -----------------------------------------------------------------
const oyun = dongu({
  adim(dt, gercekZaman) {
    if (oyunDonuk()) { girdi.temizle(); return false; }
    dokunusIsle(gercekZaman);
    const s = step(durum, dt);
    if (s.tip === "sureDoldu") { titret(ayarlar, "kayip"); cal(ayarlar, "kayip"); yazKoru(M.sureDoldu); return true; }
    if (s.tip === "bitti") {
      if (durum.asama === "crash") levelYukle(durum.level.n, true);
      else {
        const sonraki = kazanincaSonraki(durum.level.n);
        if (sonraki.tip === "bitis") { bitisGoster(); return false; }
        // Bölüm sınırı, yenilemenin oyuncudan hiçbir şey götürmediği tek an.
        // Sonuca BAKMIYORUZ ve oyunu normal akışına bırakıyoruz: yenileme gerçekten
        // olursa aşağıdaki iş boşa gider, OLMAZSA (bekleyen işçi başka bir sekmede
        // çoktan uygulanmışsa `messageSkipWaiting` sessizce hiçbir şey yapar) oyun
        // takılıp kalmaz. Erken çıkış, yenilemenin kesin olduğunu varsayıyordu.
        guncellemeyiIste(sonraki.n);
        levelYukle(sonraki.n);
      }
      return false;   // level değişti: bu karede daha fazla adım atma
    }
    return true;
  },
  /**
   * Donukluk çözüldü: oyuna dönen her yol geri sayımdan geçer. `geriSayimBaslat`
   * girdi kuyruğunu da temizler, yani çözen dokunuş kilit olmaz.
   */
  cozuldu() { if (!oyunDonuk()) geriSayimBaslat(); },
  cizim(dt) {
    if (mod === "bitis") return;
    geriSayimIlerlet(dt);
    // Kilit yalnızca oyun CANLIYKEN işler: duraklatan oyuncu mesajı okuma süresini yakmasın.
    if (!oyunDonuk()) ipucuKilidiIlerlet(dt);
    // Oyun donukken halkalar durur ama çizim sürer: oyuncu ayarın etkisini anında görür
    // ve duraklatmada kaldığı kareyi olduğu gibi görür.
    const g = tuval.yerlesim(durum.rings.length);
    if (!oyunDonuk()) decay(durum, dt, g.S, g.outer);
    saatiGuncelle();
    cizVeYaz();
  }
});

/**
 * Yeni sürüm hazırsa ŞİMDİ uygular; sayfa yenilenir ve `true` döner.
 *
 * Önce ilerleme yazılır, yoksa oyuncu yenilemeden sonra bir bölüm geriden başlar.
 * Yalnızca güvenli anlardan çağrılır: bölüm kazanıldıktan sonra ve duraklatmadan
 * dönerken. Oyun ortasında yenilemek oyuncunun turunu keserdi.
 */
function guncellemeyiIste(sonrakiBolum: number): void {
  if (!guncellemeHazir()) return;
  // Yenilemeden sonra oyuncu TAM OLARAK buraya dönmeli. `acilisBolumu` kayıttaki
  // `enUzak`'ı kullanıyor; bölüm seçiminden 5. bölüme dönmüş 412'lik bir oyuncu
  // yenilemeden sonra 5'e değil 412'ye düşerdi — uygulamanın kendi başlattığı bir
  // eylem, oyuncunun bulunduğu yeri kaybettirirdi. Oturum çapındaki bu işaret tam
  // olarak doğru ömre sahip: yenilemeyi aşar, uygulamanın kapanmasını aşmaz.
  devamNoktasiYaz(sonrakiBolum);
  levelKaydet(kayit, sonrakiBolum);
  guncellemeyiUygula();
}

// ---- Duraklatma ------------------------------------------------------------
//
// Oyuncunun ara vermesi gereken bir durum her zaman olur. Eskiden tek yol ayarlar
// panelini açmaktı ve panel kapanınca level BAŞTAN başlıyordu — yani ara vermenin
// bedeli ilerlemeydi. Artık oyun tam durduğu karede bekler ve oradan devam eder.

/** Geri sayımı başlatır: oyun donuk kalır, ekranda 3-2-1 görünür. */
function geriSayimBaslat(): void {
  if (mod === "bitis") return;
  geriSayim = GERI_SAYIM_ADET * GERI_SAYIM_BEKLEME;
  sonGeriSayimRakami = -1;
  girdi.temizle();   // "Devam et"e basarken sızan dokunuş oyuna gitmesin
  geriSayimIlerlet(0);
}

function geriSayimDurdur(): void {
  geriSayim = 0;
  // KUYRUĞU BURADA DA TEMİZLE. Kuyruğu temizleyen tek yer `adim()` idi, ama `adim()`
  // yalnız `birikim >= ADIM` iken çalışır. Kare süresi fizik adımından (8,33 ms) kısa
  // olduğunda bazı karelerde `adim()` HİÇ çalışmaz; geri sayım o karelerin birinde
  // `cizim()` içinde sıfıra inerse, bir sonraki `adim()` artık canlıdır ve geri sayım
  // sırasında basılmış dokunuşu işler — oyun canlanır canlanmaz bedava bir kilit.
  //
  // Ölçüldü (döngü aritmetiği birebir taklit edilerek, 2000 deneme/hız): 60 Hz %0,0 ·
  // 90 Hz %0,0 · 120 Hz %10,8 · 144 Hz %16,6 · 165 Hz %18,0. 60 ve 90'da hiç
  // görünmediği için elle sınamayla yakalanamaz.
  girdi.temizle();
  sonGeriSayimRakami = -1;
  ui.gerisayim.classList.remove("aktif");
  ui.gerisayim.textContent = "";
}

function geriSayimIlerlet(dt: number): void {
  if (geriSayim <= 0) return;
  geriSayim = Math.max(0, geriSayim - dt);
  if (geriSayim <= 0) { geriSayimDurdur(); return; }
  const rakam = Math.ceil(geriSayim / GERI_SAYIM_BEKLEME);
  if (rakam === sonGeriSayimRakami) return;
  sonGeriSayimRakami = rakam;
  // Her rakamda sınıfı kapatıp açmak geçişi yeniden tetikler: rakamlar tek tek belirir.
  ui.gerisayim.classList.remove("aktif");
  ui.gerisayim.textContent = String(rakam);
  requestAnimationFrame(() => ui.gerisayim.classList.add("aktif"));
}

function duraklatmaAc(): void {
  if (oyunDonuk()) return;
  mod = "duraklat";
  geriSayimDurdur();
  girdi.temizle();
  ui.duraklatMetin.textContent = M.duraklatAciklama(sureYazisi(kalanSure(durum), M));
  ortuAc(ui.duraklat, ui.devamDugme, ui.arka);
}

function duraklatmaKapat(): void {
  // İkinci güvenli an: oyuncu zaten durmuş. Sonuca bakmadan devam ediyoruz —
  // yenileme gelmezse örtü açık kalır ve "Devam et" ölürdü.
  guncellemeyiIste(durum.level.n);
  ortuKapat(ui.duraklat, ui.canvas, ui.arka);
  mod = "oyun";
  geriSayimBaslat();
}

ui.clock.addEventListener("click", e => { e.stopPropagation(); duraklatmaAc(); });
ui.devamDugme.addEventListener("click", duraklatmaKapat);
// Duraklatmadan bölüm seçimine: oyuncu duraklatma örtüsünde kalmaz, seçim örtüsüne
// geçer; mod "panel" olur çünkü seçimden çıkış kendi geri sayımını başlatır.
ui.duraklatSecim.addEventListener("click", () => {
  ui.duraklat.hidden = true;   // odak seçim örtüsüne taşınıyor
  secimAc();
});

// Masaüstünde Esc de duraklatır. Devam etmek bilinçli olmalı, o yüzden Esc geri almaz.
window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  // Açıkken kapatır, kapalıyken duraklatır. DURAKLATMA ÖRTÜSÜ hariç: devam etmek
  // bilinçli olmalı (bkz. duraklatmaKapat). Eskiden Escape yalnızca açıyordu, yani
  // herhangi bir örtü açıkken tamamen ölüydü ve dört diyalogdan çıkış yolu tek düğmeydi.
  if (!ui.nasil.hidden) { ui.nasilKapat.click(); return; }
  if (!ui.secim.hidden) { ui.secimKapat.click(); return; }
  if (!ui.yedek.hidden) { ui.yedekKapat.click(); return; }
  if (!ui.ayarPanel.hidden) { ui.ayarKapat.click(); return; }
  // Bitiş ekranında Escape "Baştan oyna"yı TETİKLEMEZ: o düğme oyunu 1. bölüme alır,
  // Escape ise iptal demektir. Kapanış bölümüne dönülür, hiçbir durum değişmez.
  if (!ui.bitis.hidden) { bitisKapat(bitisCikisi("iptal")); return; }
  if (!oyunDonuk()) duraklatmaAc();
});

// ---- Bitiş ekranı ----------------------------------------------------------
function bitisGoster(): void {
  mod = "bitis";
  const y = toplamYildiz(kayit);
  const b = bitirilenLevel(kayit);
  ui.bitisMetin.textContent = M.bitisMetni(LEVEL_COUNT, b, y, b * 3);
  ortuAc(ui.bitis, ui.bitisDugme, ui.arka);
}

/**
 * Bitiş ekranından çıkış. İlerlemeyi SİLMEZ (bkz. game/akis.ts).
 *
 * @param n Yüklenecek bölüm. "Baştan oyna" 1'i, Escape ise kapanış bölümünü verir —
 *   Escape'in evrensel anlamı "iptal"dir, durum değiştirmemeli.
 */
function bitisKapat(n: number): void {
  ortuKapat(ui.bitis, ui.canvas, ui.arka);
  mod = "oyun";
  ipucuKilidiSifirla();
  levelYukle(n);
  geriSayimBaslat();
}

ui.bitisDugme.addEventListener("click", () => bitisKapat(bitisCikisi("bastanOyna")));
// İkinci çıkış: oyuncu eksik yıldızlarını toplamak isteyebilir. Tek düğmeli bir
// bitiş ekranı, o düğme ne yaparsa yapsın, oyuncuyu tek bir yola mahkûm ediyordu.
ui.bitisSecim.addEventListener("click", () => {
  ui.bitis.hidden = true;   // odak zaten seçim örtüsüne taşınıyor
  ipucuKilidiSifirla();
  // Durum HÂLÂ bitmiş 1000. bölümün durumu. Seçimden bölüm seçmeden çıkılırsa oyun
  // o durumla canlanır ve `step()` her adımda yine "bitti" döndürüp bitiş ekranını
  // geri açar — Escape "iptal" demek, ama iptal etmiyordu.
  levelYukle(LEVEL_COUNT);
  secimAc();
});

/**
 * "Baştan başla" İKİ AŞAMALIDIR.
 *
 * Bu, oyundaki geri dönüşü olmayan tek eylem: Level 1'e döndürür ve bölüm seçimi
 * olmadığı için 412. bölümdeki oyuncu 411 bölümü yeniden oynamak zorunda kalır.
 * Üstelik paneldeki en sık basılan düğmenin ("Tamam") hemen üstünde, 44 piksel
 * yüksekliğinde duruyor. İlk basış düğmeyi uyarıya çevirir, ikincisi çalıştırır.
 *
 * "Her dokunuş kalıcıdır" ilkesiyle çelişmez: o ilke halka kilitlerine aittir,
 * menüdeki yıkıcı bir eyleme değil.
 */
let resetOnayBekliyor = false;

function resetOnayiSifirla(): void {
  if (!resetOnayBekliyor) return;
  resetOnayBekliyor = false;
  ui.reset.textContent = M.bastanBasla;
  ui.reset.classList.remove("onayBekliyor");
  ui.resetNot.textContent = M.bastanBaslaAciklama;
}

ui.reset.addEventListener("click", () => {
  if (!resetOnayBekliyor) {
    resetOnayBekliyor = true;
    ui.reset.textContent = M.bastanBaslaOnay(resetOnayHedefi(kayit));
    ui.reset.classList.add("onayBekliyor");
    ui.resetNot.textContent = "";
    return;
  }
  resetOnayiSifirla();
  ayarlariUygula();
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  // ortuKapat: arkanın kilidini açar, odağı oyun alanına taşır, sonra gizler.
  // Doğrudan `hidden = true` yazmak `inert`'i açık bırakırdı.
  ortuKapat(ui.ayarPanel, ui.canvas, ui.arka);
  ui.secim.hidden = true;
  ui.yedek.hidden = true;
  ui.bitis.hidden = true;
  mod = "oyun";
  ipucuKilidiSifirla();
  bastanBasla(kayit);
  levelYukle(1);
  geriSayimBaslat();
});

tercihleriIzle(() => { renk = renkleriOku(); azalt = hareketAzalt() || ayarlar.hareketAzalt; });

// CSS geliştirme sunucusunda ayrı bir istekle gelir ve yavaş bağlantıda ilk okumaya
// yetişmeyebilir. O durumda yedek palet devreye girer (theme.ts), ama gerçek değerler
// hazır olur olmaz bir kez daha okunur ki tema değişkenleri esas kaynak kalsın.
if (!renklerHazir()) {
  let deneme = 0;
  const tekrarOku = (): void => {
    if (renklerHazir()) { renk = renkleriOku(); return; }
    if (++deneme < 120) requestAnimationFrame(tekrarOku);
  };
  requestAnimationFrame(tekrarOku);
  window.addEventListener("load", () => { if (renklerHazir()) renk = renkleriOku(); }, { once: true });
}


/** "312 bölüm açıldı · 714 / 936 yıldız" — birikimi görünür kılar. */
function ilerlemeOzeti(): string {
  const b = bitirilenLevel(kayit);
  if (b === 0) return M.ilerlemeYok;
  return M.ilerleme(b, toplamYildiz(kayit), b * 3);
}

// ---- Ayarlar paneli --------------------------------------------------------
function ayarPaneliAc(): void {
  mod = "panel";
  ui.desenKutu.checked = ayarlar.desenYumusat;
  ui.hareketKutu.checked = ayarlar.hareketAzalt;
  ui.titresimKutu.checked = ayarlar.titresim;
  ui.sesKutu.checked = ayarlar.ses;
  ui.sesSatir.hidden = !sesVarMi();
  ui.dilKutu.value = dilKodu;
  // Cihaz titreşimi desteklemiyorsa (iOS Safari) seçeneği hiç gösterme.
  ui.titresimSatir.hidden = !titresimVarMi();
  ui.secim.hidden = true;
  ui.yedek.hidden = true;
  ui.uyari.textContent = "";
  ui.ozet.textContent = ilerlemeOzeti();
  resetOnayiSifirla();   // panel yeniden açılınca uyarı hali taşınmasın
  // Odak BAŞLIĞA gider, "Tamam"a değil: kapatma düğmesi kutunun en altında ve odak
  // oraya verildiğinde klavyeyle gelen oyuncu bütün denetimlerin arkasına düşüyordu —
  // Tab ona ne ayarları ne dili ne de "Nasıl oynanır"ı gösteriyordu. Başlık odakta
  // olunca ekran okuyucu panelin adını okur ve Tab baştan başlar.
  // preventScroll + scrollTop: tarayıcı odaklanan öğeyi görünür kılmak için kutuyu
  // kaydırıyordu; panel her zaman baştan açılmalı.
  ortuAc(ui.ayarPanel, ui.ayarBaslik, ui.arka);
  ui.ayarPanel.querySelector(".kutu")?.scrollTo({ top: 0 });
}

function ayarlariUygula(): void {
  ayarlar.desenYumusat = ui.desenKutu.checked;
  ayarlar.hareketAzalt = ui.hareketKutu.checked;
  ayarlar.titresim = ui.titresimKutu.checked;
  ayarlar.ses = ui.sesKutu.checked;
  azalt = hareketAzalt() || ayarlar.hareketAzalt;
  ayarlariYaz(ayarlar);
  sonFlas = -1;   // flaş katmanı yeni ayara göre tazelensin
}

ui.ayarAc.addEventListener("click", e => { e.stopPropagation(); if (mod !== "bitis") ayarPaneliAc(); });

// ---- Nasıl oynanır ---------------------------------------------------------
/**
 * @param kisa İlk açılışta true: oyuncunun henüz göremeyeceği mekanik satırları ve
 *   yıldız paragrafı gizlenir (bkz. styles.css .nasilKutu.kisa). Tamamı Ayarlar'dan
 *   açılınca görünür. Işığa duyarlılık uyarısı HER İKİ HALDE de kalır.
 */
function nasilAc(kisa = false): void {
  mod = "panel";
  ui.nasilIcerik.classList.toggle("kisa", kisa);
  ui.ayarPanel.hidden = true;
  // Önce odak (kaydırmadan), sonra başa sar: ters sırada tarayıcı kutuyu aşağı kaydırıyor.
  // Odak başlıkta, kapatma düğmesinde değil: düğme en altta ve oradan Tab, metnin
  // tamamını atlıyordu (bkz. ayarPaneliAc).
  ortuAc(ui.nasil, ui.nasilBaslik, ui.arka);
  ui.nasilIcerik.scrollTop = 0;
}

ui.nasilAc.addEventListener("click", () => { ayarlariUygula(); nasilAc(); });
ui.nasilKapat.addEventListener("click", () => {
  ortuKapat(ui.nasil, ui.canvas, ui.arka);
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  mod = "oyun";
  geriSayimBaslat();
});
// Zemine dokunmak ayarları kapatır: kısa ekranlarda panelden çıkışın ikinci yolu.
// YALNIZCA bu örtüde — "nasıl oynanır" kapanışı ışığa duyarlılık uyarısının
// görüldüğünü işaretler, duraklatmadan çıkış bilinçli olmalı, bitiş ekranı ise oyunu
// baştan başlatır; üçü de kazara kapatılmamalı.
ui.ayarPanel.addEventListener("click", e => {
  if (e.target === ui.ayarPanel) ui.ayarKapat.click();
});
// ---- Bölüm seçimi ----------------------------------------------------------
//
// Oyunun yıldız sistemi ölçülebilir biçimde ölü bir para birimiydi: sıradan oyuncu
// bölümlerin %68'ini 1 yıldızla bitiriyor, 1000 bölümün 294'ünde 3 yıldız 60 denemede
// bir kez bile çıkmıyor — ve bitirilen bir bölüme dönmenin yolu yoktu. Toplanan yıldız
// hiçbir zaman düzeltilemiyordu. Yıldızı hedef yapan şey, ona tekrar gidebilmek.
let secimSayfa = 0;

function secimCiz(): void {
  const toplam = LEVEL_COUNT;
  secimSayfa = Math.max(0, Math.min(sayfaSayisi(toplam) - 1, secimSayfa));
  const [bas, son] = aralik(secimSayfa, toplam);
  ui.secimAralik.textContent = M.bolumAraligi(sayi(M, bas, 0), sayi(M, son, 0));
  ui.secimGeri.disabled = secimSayfa === 0;
  ui.secimIleri.disabled = secimSayfa >= sayfaSayisi(toplam) - 1;
  // Izgara baştan yazılıyor; odak içerideyse yok olur. Aynı numaralı düğmeye, yoksa
  // ilk düğmeye geri konur — bugün yalnız klavyeyle ulaşılan dar bir yol, ama
  // ızgaraya ok tuşu gezinmesi eklendiği gün ana yol olur.
  const odakNo = ui.secimIzgara.contains(document.activeElement)
    ? (document.activeElement as HTMLElement).dataset.n : null;
  ui.secimIzgara.innerHTML = izgaraHtml({
    m: M, sayfa: secimSayfa, toplam, enUzak: kayit.enUzak, bests: kayit.bests,
    simdiki: durum.level.n
  });
  if (odakNo) {
    const geri = ui.secimIzgara.querySelector<HTMLButtonElement>(`button[data-n="${odakNo}"]`)
      ?? ui.secimIzgara.querySelector<HTMLButtonElement>("button:not([disabled])");
    geri?.focus({ preventScroll: true });
  }
}

function secimAc(): void {
  mod = "panel";
  ui.ayarPanel.hidden = true;
  // Oyuncunun bulunduğu sayfayla açılır: 412. bölümdeyken 1-100 arasını göstermek,
  // her açılışta dört kez ileri bastırmak demekti.
  secimSayfa = sayfasi(durum.level.n);
  secimCiz();
  ortuAc(ui.secim, ui.secimBaslik, ui.arka);
  // Panel doğru SAYFAYLA açılıyordu ama doğru YERDE değil: 900. bölümdeki oyuncunun
  // kendi düğmesi kutunun 972 pikselinde, görünen alan 682 piksel — yani oyuncu
  // paneli açıp "neredeyim?" sorusunun cevabını göremiyordu. Kendi bölümü her zaman
  // açılan sayfadadır, o yüzden ona sarmak yeterli.
  ui.secimIzgara.querySelector(".simdiki")?.scrollIntoView({ block: "center" });
}

function secimKapat(): void {
  ortuKapat(ui.secim, ui.canvas, ui.arka);
  mod = "oyun";
  geriSayimBaslat();
}

ui.secimAc.addEventListener("click", () => { ayarlariUygula(); secimAc(); });
ui.secimKapat.addEventListener("click", secimKapat);
// Zemine dokunmak burada da kapatır: bölüm seçimi yıkıcı değil, kazara kapanması
// yalnızca oyuncuyu kaldığı bölüme döndürür.
ui.secim.addEventListener("click", e => { if (e.target === ui.secim) ui.secimKapat.click(); });
/**
 * Sayfa değiştirir ve görüntüyü başa sarar.
 *
 * Sarmadan çevirmek şunu veriyordu: oyuncu ızgaranın dibine kadar kaydırıp "›"ye
 * basıyor, yeni yüzlük çiziliyor ama görüntü dipte kalıyor — ekranda 580-600 var,
 * 501 yok, başlık ve oklar görüntünün dışında. Oyuncu ileri gittiğini anlamıyor.
 * Kaydıran öğe `.secimIzgara` DEĞİL (onun `overflow`u yok), `.kutu`.
 */
function secimSayfaDegistir(yon: number): void {
  secimSayfa += yon;
  secimCiz();
  ui.secim.querySelector(".kutu")?.scrollTo({ top: 0 });
}
ui.secimGeri.addEventListener("click", () => secimSayfaDegistir(-1));
ui.secimIleri.addEventListener("click", () => secimSayfaDegistir(1));
// Tek dinleyici, yüz düğme: olay yetkilendirme. Sayfa her çizildiğinde yüz dinleyici
// bağlayıp çözmek hem gereksiz hem de sızıntıya açık.
ui.secimIzgara.addEventListener("click", e => {
  const d = (e.target as Element | null)?.closest<HTMLButtonElement>("button[data-n]");
  if (!d || d.disabled) return;
  const n = Number(d.dataset.n);
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) return;
  secimKapat();
  ui.bitis.hidden = true;
  ipucuKilidiSifirla();
  levelYukle(n);
  geriSayimBaslat();
});

// ---- İlerleme yedeği -------------------------------------------------------
//
// Kayıt tek bir tarayıcı profilinin localStorage'ında; telefon değiştiren oyuncunun
// onu kurtarmasının başka yolu yok. Mağaza sürümüne geçişte de aynı olacak, çünkü
// Capacitor içeriği başka bir origin'den sunar (capacitor://localhost).
let yedekOnayBekliyor = false;

function yedekOnayiSifirla(): void {
  if (!yedekOnayBekliyor) return;
  yedekOnayBekliyor = false;
  ui.yedekYukle.textContent = M.yedekYukle;
  ui.yedekYukle.classList.remove("onayBekliyor");
}

function yedekAc(): void {
  mod = "panel";
  ui.ayarPanel.hidden = true;
  ui.yedekKod.value = disaAktar(kayit);
  ui.yedekGiris.value = "";
  ui.yedekNot.textContent = "";
  yedekOnayiSifirla();
  ortuAc(ui.yedek, ui.yedekBaslik, ui.arka);
}

ui.yedekAc.addEventListener("click", () => { ayarlariUygula(); yedekAc(); });
ui.yedekKapat.addEventListener("click", () => {
  ortuKapat(ui.yedek, ui.canvas, ui.arka);
  mod = "oyun";
  geriSayimBaslat();
});
ui.yedek.addEventListener("click", e => { if (e.target === ui.yedek) ui.yedekKapat.click(); });

ui.yedekKopyala.addEventListener("click", () => {
  // Panoya yazma bir kullanıcı hareketinin içinde olmalı; düğme tıklaması bu.
  // Başarısız olursa (izin yok, eski tarayıcı) metin seçilir: oyuncu elle kopyalar.
  ui.yedekKod.select();
  navigator.clipboard?.writeText(ui.yedekKod.value)
    .then(() => { ui.yedekNot.textContent = M.yedekKopyalandi; })
    .catch(() => { /* seçim zaten yapıldı */ });
});

/**
 * Geri yükleme İKİ AŞAMALIDIR: var olan ilerlemenin üstüne yazar, yani "Baştan
 * başla" ile aynı sınıftan geri alınamaz bir eylem.
 */
ui.yedekYukle.addEventListener("click", () => {
  const yeni = iceAktar(ui.yedekGiris.value);
  // Boş bir yedeğin DOLU bir ilerlemenin üstüne yazmasını engelle. Denetim `iceAktar`
  // içindeyken 1. bölümdeki oyuncunun kendi yedeği reddediliyor ve ekranda "Kod
  // okunamadı" yazıyordu — oyuncu özelliğin bozuk olduğu sonucuna varıyordu. Karar
  // yedeğin kendisine değil MEVCUT kayda bakmalı.
  const bosYedek = yeni !== null && yeni.enUzak <= 1 && Object.keys(yeni.bests).length === 0;
  const doluKayit = kayit.enUzak > 1 || Object.keys(kayit.bests).length > 0;
  if (!yeni || (bosYedek && doluKayit)) {
    yedekOnayiSifirla();
    ui.yedekNot.textContent = M.yedekGecersiz;
    return;
  }
  if (!yedekOnayBekliyor) {
    yedekOnayBekliyor = true;
    ui.yedekYukle.textContent = M.yedekYukleOnay;
    ui.yedekYukle.classList.add("onayBekliyor");
    return;
  }
  yedekOnayiSifirla();
  kaydiDegistir(kayit, yeni);
  // Yedek başka bir tablodan gelmiş olabilir; aynı kural işler.
  tabloSurumuUygula(kayit, tablo.v);
  ui.yedekNot.textContent = M.yedekYuklendi(bitirilenLevel(kayit));
  ipucuKilidiSifirla();
  levelYukle(acilisBolumu(kayit));
});

ui.desenKutu.addEventListener("change", ayarlariUygula);
ui.hareketKutu.addEventListener("change", ayarlariUygula);
ui.titresimKutu.addEventListener("change", () => { ayarlariUygula(); titret(ayarlar, "kilit"); });

// Dil değişince sayfa yeniden yüklenir. Ekran metinleri bir kez kuruluyor; canlı
// değiştirmek bütün kabuğu yeniden kurup dinleyicileri yeniden bağlamak demek olurdu
// ve yarı çevrilmiş ekran riski doğururdu. Seyrek bir eylem, yeniden yükleme temiz yol.
ui.dilKutu.addEventListener("change", () => {
  const secilen = ui.dilKutu.value;
  if (!gecerliDilMi(secilen) || secilen === dilKodu) return;
  ayarlar.dil = secilen;
  ayarlariYaz(ayarlar);
  location.reload();
});
// Ses açılınca hemen bir örnek: ayarın ne yaptığı duyulsun.
ui.sesKutu.addEventListener("change", () => { ayarlariUygula(); cal(ayarlar, "kilit", 0.6); });
ui.ayarKapat.addEventListener("click", () => {
  ayarlariUygula();
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  ortuKapat(ui.ayarPanel, ui.canvas, ui.arka);
  mod = "oyun";
  // Panelde geçen süre zaten işlemiyordu (oyun donuktu). Eskiden level yine de baştan
  // başlatılıyordu ve ayarları açmanın bedeli ilerlemeydi — oyuncu ara vermek için
  // paneli kullanınca bölümü kaybediyordu. Artık kaldığı karede devam eder.
  geriSayimBaslat();
});

// Güncelleme yenilemesinden dönülüyorsa oyuncu tam bıraktığı bölüme döner
// (bkz. guncellemeyiIste); değilse ulaşılan en uzak bölümden başlar.
// Rekorlar silindiyse oyuncu bunu sessizce öğrenmemeli. levelYukle'den ÖNCE:
// sonradan yazılırsa `yazKoru` bekleyen ipucunu da siler ve oyuncu o bölümün
// öğretici ipucunu hiç görmez.
if (silinenRekor > 0) yazKoru(M.rekorlarYenilendi);
levelYukle(devamNoktasiOku() ?? acilisBolumu(kayit));
tuval.boyutla();
oyun.basla();


// İlk açılışta kuralları ve ışığa duyarlılık notunu bir kez göster (bkz. ui/nasil.ts).
// Göstermiyorsak oyun yine de GERİ SAYIMLA başlar: sayfanın açıldığı an — ve dil
// değiştirdikten sonraki yeniden yükleme — canlı oyuna açılan son korumasız yoldu.
// Oyuncu ayarlardan dili seçiyor, sayfa yenileniyor ve halkalar çoktan dönüyordu.
if (!ayarlar.uyariGoruldu) nasilAc(true);
else geriSayimBaslat();

// Geliştirme sırasında elle sınamak için; oyun bunu kullanmaz ve üretim derlemesine girmez.
if (import.meta.env.DEV) {
  Object.assign(window, { KASA: { durum: () => durum, kayit, tablo, ADIM } });
}
