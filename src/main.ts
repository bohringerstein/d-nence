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
import { ogreticiTablosu, ipucu, yildizYazisi, sureYazisi, kayipYazisi } from "./game/hints.ts";
import { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel } from "./game/storage.ts";
import { ayarlariOku, ayarlariYaz, halkaOpakligi, titret, titresimVarMi } from "./game/ayarlar.ts";
import { cal, sesiAc, sesiDuraklat, sesVarMi } from "./game/ses.ts";
import { kabukKur } from "./ui/shell.ts";
import { nasilHtml } from "./ui/nasil.ts";
import { DILLER, cihazDili, gecerliDilMi } from "./dil/index.ts";

const tablo = await fetch(tabloUrl).then(r => r.json()) as LevelTable;

const hedef = document.getElementById("app");
if (!hedef) throw new Error("#app bulunamadı");

// Tablo bozuksa sessizce garip bir oyun açmak yerine durumu söyle.
const semaHatalari = validateTable(tablo);
if (semaHatalari.length) {
  // Bu ekran ayarlar okunmadan önce çalışabilir: cihaz dilini kullan.
  const h = DILLER[cihazDili()];
  hedef.innerHTML = `<main style="padding:24px"><h1>Dönence</h1>
    <p>${h.tabloHatasiBaslik}. ${h.tabloHatasiMetin}</p>
    <ul>${semaHatalari.slice(0, 10).map(x => `<li>${x}</li>`).join("")}</ul></main>`;
  throw new Error("level tablosu geçersiz: " + semaHatalari.length + " sorun");
}

const ayarlar = ayarlariOku();
// Oyuncunun seçimi varsa o, yoksa cihazın dili (bkz. dil/index.ts cihazDili).
const dilKodu = gecerliDilMi(ayarlar.dil) ? ayarlar.dil : cihazDili();
const M = DILLER[dilKodu];
// Ekran okuyucu ve tarayıcının tireleme/yazım kuralları doğru dili bilmeli.
document.documentElement.lang = dilKodu;

const ui = kabukKur(hedef, M, nasilHtml(M));
const kayit = oku();
const ogretici = ogreticiTablosu(tablo.levels, M);
let renk = renkleriOku();
// Sistem tercihi VEYA oyuncunun kendi seçimi; ikisinden biri yeterli.
let azalt = hareketAzalt() || ayarlar.hareketAzalt;
let durum: LevelState = null as unknown as LevelState;
let bitti = false;
/** Ayarlar paneli açıkken oyun durur: uyarıyı okumak oyuncunun süresini yakmamalı. */
let panelAcik = false;
/** Oyuncunun kendi duraklatması (sayaca dokunarak ya da Esc ile). */
let duraklatildi = false;

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
const oyunDonuk = (): boolean => bitti || panelAcik || duraklatildi || geriSayim > 0;

const tuval = tuvalKur(ui.canvas, () => { if (durum) cizVeYaz(); });
// Ekranın tamamı dokunma alanı: canvas'a bağlansaydı üst ve alt çubuk ölü bölge olurdu.
const girdi = girdiBagla(ui.kok);

// iOS ses bağlamını yalnızca bir kullanıcı hareketinin İÇİNDE açar. Oyunun dokunuşları
// zaman damgasıyla kuyruğa alınıp fizik adımında işlendiği için ses çalma anı artık
// hareketin içinde değil; bu yüzden bağlam doğrudan buradan açılıyor.
ui.kok.addEventListener("pointerdown", () => { if (ayarlar.ses) sesiAc(); });
// Sekme arkaplana alınınca oyun zaten duruyor (game/loop.ts); ses bağlamı da askıya
// alınır, sonraki dokunuşta kendiliğinden uyanır.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { sesiDuraklat(); return; }
  // Arkaplandan dönüşte oyun doğrudan canlıya dönüyordu: uygulamayı değiştirip geri
  // gelen oyuncu halkaları bir anda hareket hâlinde buluyordu. Duraklatmayla aynı
  // muamele: önce geri sayım.
  if (!oyunDonuk()) geriSayimBaslat();
});

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

function saatiGuncelle(): void {
  const kalan = kalanSure(durum);
  ui.clockSayi.textContent = sureYazisi(kalan, M);
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
      else if (durum.level.n >= LEVEL_COUNT) { bitisGoster(); return false; }
      else levelYukle(durum.level.n + 1);
      return false;   // level değişti: bu karede daha fazla adım atma
    }
    return true;
  },
  cizim(dt) {
    if (bitti) return;
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

// ---- Duraklatma ------------------------------------------------------------
//
// Oyuncunun ara vermesi gereken bir durum her zaman olur. Eskiden tek yol ayarlar
// panelini açmaktı ve panel kapanınca level BAŞTAN başlıyordu — yani ara vermenin
// bedeli ilerlemeydi. Artık oyun tam durduğu karede bekler ve oradan devam eder.

/** Geri sayımı başlatır: oyun donuk kalır, ekranda 3-2-1 görünür. */
function geriSayimBaslat(): void {
  if (bitti) return;
  geriSayim = GERI_SAYIM_ADET * GERI_SAYIM_BEKLEME;
  sonGeriSayimRakami = -1;
  girdi.temizle();   // "Devam et"e basarken sızan dokunuş oyuna gitmesin
  geriSayimIlerlet(0);
}

function geriSayimDurdur(): void {
  geriSayim = 0;
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
  duraklatildi = true;
  geriSayimDurdur();
  girdi.temizle();
  ui.duraklatMetin.textContent = M.duraklatAciklama(sureYazisi(kalanSure(durum), M));
  ui.duraklat.hidden = false;
  arkaKilit(true);
  ui.devamDugme.focus({ preventScroll: true });
}

function duraklatmaKapat(): void {
  ui.duraklat.hidden = true;
  arkaKilit(false);
  duraklatildi = false;
  ui.devamDugme.blur();
  geriSayimBaslat();
}

ui.clock.addEventListener("click", e => { e.stopPropagation(); duraklatmaAc(); ui.clock.blur(); });
ui.devamDugme.addEventListener("click", duraklatmaKapat);

// Masaüstünde Esc de duraklatır. Devam etmek bilinçli olmalı, o yüzden Esc geri almaz.
window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  // Açıkken kapatır, kapalıyken duraklatır. DURAKLATMA ÖRTÜSÜ hariç: devam etmek
  // bilinçli olmalı (bkz. duraklatmaKapat). Eskiden Escape yalnızca açıyordu, yani
  // herhangi bir örtü açıkken tamamen ölüydü ve dört diyalogdan çıkış yolu tek düğmeydi.
  if (!ui.nasil.hidden) { ui.nasilKapat.click(); return; }
  if (!ui.ayarPanel.hidden) { ui.ayarKapat.click(); return; }
  if (!ui.bitis.hidden) { ui.bitisDugme.click(); return; }
  if (!oyunDonuk()) duraklatmaAc();
});

// ---- Bitiş ekranı ----------------------------------------------------------
function bitisGoster(): void {
  bitti = true;
  const y = toplamYildiz(kayit);
  const b = bitirilenLevel(kayit);
  ui.bitisMetin.textContent = M.bitisMetni(LEVEL_COUNT, b, y, b * 3);
  ui.bitis.hidden = false;
  arkaKilit(true);
  ui.bitisDugme.focus({ preventScroll: true });
}

ui.bitisDugme.addEventListener("click", () => {
  ui.bitis.hidden = true;
  arkaKilit(false);
  bitti = false;
  ipucuKilidiSifirla();
  bastanBasla(kayit);
  levelYukle(1);
  geriSayimBaslat();
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
    ui.reset.textContent = M.bastanBaslaOnay(durum.level.n);
    ui.reset.classList.add("onayBekliyor");
    ui.resetNot.textContent = "";
    return;
  }
  resetOnayiSifirla();
  ayarlariUygula();
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  ui.ayarPanel.hidden = true;
  arkaKilit(false);
  panelAcik = false;
  bitti = false;
  ui.bitis.hidden = true;
  ipucuKilidiSifirla();
  bastanBasla(kayit);
  levelYukle(1);
  geriSayimBaslat();
  ui.reset.blur();   // sonraki Enter oyuna gitsin, düğmeye değil
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

/**
 * Örtü açıkken arka planı Tab ile gezilemez yapar.
 *
 * `aria-modal="true"` yalnızca ekran okuyucuya bilgi verir; klavye odağını tutmaz.
 * Bu olmadan Tab örtüden çıkıp arkadaki düğmelere gidiyordu.
 */
function arkaKilit(kapali: boolean): void {
  for (const el of ui.arka) el.toggleAttribute("inert", kapali);
}

/** "312 bölüm açıldı · 714 / 936 yıldız" — birikimi görünür kılar. */
function ilerlemeOzeti(): string {
  const b = bitirilenLevel(kayit);
  if (b === 0) return M.ilerlemeYok;
  return M.ilerleme(b, toplamYildiz(kayit), b * 3);
}

// ---- Ayarlar paneli --------------------------------------------------------
function ayarPaneliAc(): void {
  panelAcik = true;
  arkaKilit(true);
  ui.desenKutu.checked = ayarlar.desenYumusat;
  ui.hareketKutu.checked = ayarlar.hareketAzalt;
  ui.titresimKutu.checked = ayarlar.titresim;
  ui.sesKutu.checked = ayarlar.ses;
  ui.sesSatir.hidden = !sesVarMi();
  ui.dilKutu.value = dilKodu;
  // Cihaz titreşimi desteklemiyorsa (iOS Safari) seçeneği hiç gösterme.
  ui.titresimSatir.hidden = !titresimVarMi();
  ui.uyari.textContent = "";
  ui.ozet.textContent = ilerlemeOzeti();
  resetOnayiSifirla();   // panel yeniden açılınca uyarı hali taşınmasın
  ui.ayarPanel.hidden = false;
  // preventScroll şart: odaklanan düğme kutunun ALTINDA olduğu için tarayıcı onu
  // görünür kılmak adına kutuyu en aşağı kaydırıyor ve panel sondan açılıyordu.
  ui.ayarKapat.focus({ preventScroll: true });
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

ui.ayarAc.addEventListener("click", e => { e.stopPropagation(); if (!bitti) ayarPaneliAc(); ui.ayarAc.blur(); });

// ---- Nasıl oynanır ---------------------------------------------------------
/**
 * @param kisa İlk açılışta true: oyuncunun henüz göremeyeceği mekanik satırları ve
 *   yıldız paragrafı gizlenir (bkz. styles.css .nasilKutu.kisa). Tamamı Ayarlar'dan
 *   açılınca görünür. Işığa duyarlılık uyarısı HER İKİ HALDE de kalır.
 */
function nasilAc(kisa = false): void {
  panelAcik = true;
  arkaKilit(true);
  ui.nasilIcerik.classList.toggle("kisa", kisa);
  ui.ayarPanel.hidden = true;
  ui.nasil.hidden = false;
  // Önce odak (kaydırmadan), sonra başa sar: ters sırada tarayıcı kutuyu aşağı kaydırıyor.
  ui.nasilKapat.focus({ preventScroll: true });
  ui.nasilIcerik.scrollTop = 0;
}

ui.nasilAc.addEventListener("click", () => { ayarlariUygula(); nasilAc(); });
ui.nasilKapat.addEventListener("click", () => {
  ui.nasil.hidden = true;
  arkaKilit(false);
  ui.nasilKapat.blur();
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  panelAcik = false;
  geriSayimBaslat();
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
  ui.ayarPanel.hidden = true;
  arkaKilit(false);
  ui.ayarKapat.blur();
  panelAcik = false;
  // Panelde geçen süre zaten işlemiyordu (oyun donuktu). Eskiden level yine de baştan
  // başlatılıyordu ve ayarları açmanın bedeli ilerlemeydi — oyuncu ara vermek için
  // paneli kullanınca bölümü kaybediyordu. Artık kaldığı karede devam eder.
  geriSayimBaslat();
});

levelYukle(kayit.level);
tuval.boyutla();
oyun.basla();

// İlk açılışta kuralları ve ışığa duyarlılık notunu bir kez göster (bkz. ui/nasil.ts).
if (!ayarlar.uyariGoruldu) nasilAc(true);

// Geliştirme sırasında elle sınamak için; oyun bunu kullanmaz ve üretim derlemesine girmez.
if (import.meta.env.DEV) {
  Object.assign(window, { KASA: { durum: () => durum, kayit, tablo, ADIM } });
}
