// Dönence: uygulamanın giriş noktası. Parçaları birbirine bağlar, kural içermez.
import "./styles.css";
import { LEVEL_COUNT, validateTable, STAR_LABEL } from "./core/index.ts";
import type { LevelTable, Best } from "./core/index.ts";
// Level tablosu JS paketine GÖMÜLMEZ, ayrı bir dosya olarak indirilir.
// 1000 bölümde tablo 643 KB; bu kadar veriyi JavaScript nesne sabiti olarak
// ayrıştırmak telefonda yarım saniye yer, JSON.parse aynı veriyi `10 kat hızlı okur.
// Servis çalışanı dosyayı önbelleğe aldığı için çevrimdışı çalışma etkilenmez.
import tabloUrl from "../data/levels.json?url";

import { createLevel, tap, step, decay, kalanSure } from "./game/state.ts";
import type { LevelState } from "./game/state.ts";
import { dongu, ADIM } from "./game/loop.ts";
import { girdiBagla } from "./game/input.ts";
import { tuvalKur, ciz } from "./game/render.ts";
import { renkleriOku, renklerHazir, hareketAzalt, tercihleriIzle } from "./game/theme.ts";
import { ogreticiTablosu, ipucu, yildizYazisi, sureYazisi } from "./game/hints.ts";
import { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel } from "./game/storage.ts";
import { ayarlariOku, ayarlariYaz, halkaOpakligi, titret, titresimVarMi } from "./game/ayarlar.ts";
import { kabukKur } from "./ui/shell.ts";
import { NASIL_HTML } from "./ui/nasil.ts";

const tablo = await fetch(tabloUrl).then(r => r.json()) as LevelTable;

const hedef = document.getElementById("app");
if (!hedef) throw new Error("#app bulunamadı");

// Tablo bozuksa sessizce garip bir oyun açmak yerine durumu söyle.
const semaHatalari = validateTable(tablo);
if (semaHatalari.length) {
  hedef.innerHTML = `<main style="padding:24px"><h1>Dönence</h1>
    <p>Level tablosu okunamadı. <code>npm run verify</code> çalıştırın.</p>
    <ul>${semaHatalari.slice(0, 10).map(h => `<li>${h}</li>`).join("")}</ul></main>`;
  throw new Error("level tablosu geçersiz: " + semaHatalari.length + " sorun");
}

const ui = kabukKur(hedef, NASIL_HTML);
const kayit = oku();
const ogretici = ogreticiTablosu(tablo.levels);

const ayarlar = ayarlariOku();
let renk = renkleriOku();
// Sistem tercihi VEYA oyuncunun kendi seçimi; ikisinden biri yeterli.
let azalt = hareketAzalt() || ayarlar.hareketAzalt;
let durum: LevelState = null as unknown as LevelState;
let bitti = false;
/** Ayarlar paneli açıkken oyun durur: uyarıyı okumak oyuncunun süresini yakmamalı. */
let panelAcik = false;

const tuval = tuvalKur(ui.canvas, () => { if (durum) cizVeYaz(); });
const girdi = girdiBagla(ui.canvas);

// ---- Level yükleme: tek nesne toptan değişir, alan alan sıfırlama yok -------
function levelYukle(n: number, denemeyiKoru = false): void {
  const deneme = denemeyiKoru ? durum.deneme + 1 : 1;
  const level = tablo.levels[n - 1];
  durum = createLevel(level, deneme);
  girdi.temizle();

  ui.lvl.textContent = level.boss ? `${n}, patron` : String(n);
  yaz(ipucu({ level, deneme, rekor: kayit.bests[n], ogretici }));
  levelKaydet(kayit, n);
  saatiGuncelle();
}

const yaz = (metin: string): void => { ui.hint.textContent = metin; };

function saatiGuncelle(): void {
  const kalan = kalanSure(durum);
  ui.clock.textContent = sureYazisi(kalan);
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
    if (sonuc.tip === "kilit") titret(ayarlar, "kilit");
    if (sonuc.tip === "kayip") { titret(ayarlar, "kayip"); yaz("Açıklık kapandı"); return; }
    if (sonuc.tip === "acildi") {
      const yeni: Best = { s: sonuc.yildiz, t: +sonuc.sure.toFixed(2) };
      const oncekiVardi = kayit.bests[durum.level.n] !== undefined;
      titret(ayarlar, "acildi");
      const rekor = rekorKaydet(kayit, durum.level.n, yeni);
      yaz(`${STAR_LABEL[sonuc.yildiz]} ${yildizYazisi(sonuc.yildiz)} ${sureYazisi(sonuc.sure)} sn` +
          (rekor && oncekiVardi ? ", rekor" : ""));
      return;
    }
    if (sonuc.tip === "yok") return;
  }
}

// ---- Döngü -----------------------------------------------------------------
const oyun = dongu({
  adim(dt, gercekZaman) {
    if (bitti || panelAcik) { girdi.temizle(); return false; }
    dokunusIsle(gercekZaman);
    const s = step(durum, dt);
    if (s.tip === "sureDoldu") { titret(ayarlar, "kayip"); yaz("Süre doldu"); return true; }
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
    // Panel açıkken halkalar donar ama çizim sürer: oyuncu ayarın etkisini anında görür.
    const g = tuval.yerlesim(durum.rings.length);
    if (!panelAcik) decay(durum, dt, g.S, g.outer);
    saatiGuncelle();
    cizVeYaz();
  }
});

// ---- Bitiş ekranı ----------------------------------------------------------
function bitisGoster(): void {
  bitti = true;
  const y = toplamYildiz(kayit);
  const b = bitirilenLevel(kayit);
  ui.bitisMetin.textContent =
    `${LEVEL_COUNT} kasanın hepsini açtın. ${b} levelde toplam ${y} yıldız topladın` +
    (y < b * 3 ? `; ${b * 3} yıldızın tamamı için levelleri daha temiz açman gerek.` : ". Hepsi temiz.");
  ui.bitis.hidden = false;
  arkaKilit(true);
  ui.bitisDugme.focus({ preventScroll: true });
}

ui.bitisDugme.addEventListener("click", () => {
  ui.bitis.hidden = true;
  arkaKilit(false);
  bitti = false;
  bastanBasla(kayit);
  levelYukle(1);
});

ui.reset.addEventListener("click", e => {
  e.stopPropagation();
  bitti = false;
  ui.bitis.hidden = true;
  arkaKilit(false);
  bastanBasla(kayit);
  levelYukle(1);
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

// ---- Ayarlar paneli --------------------------------------------------------
function ayarPaneliAc(): void {
  panelAcik = true;
  arkaKilit(true);
  ui.desenKutu.checked = ayarlar.desenYumusat;
  ui.hareketKutu.checked = ayarlar.hareketAzalt;
  ui.titresimKutu.checked = ayarlar.titresim;
  // Cihaz titreşimi desteklemiyorsa (iOS Safari) seçeneği hiç gösterme.
  ui.titresimSatir.hidden = !titresimVarMi();
  ui.uyari.textContent = "";
  ui.ayarPanel.hidden = false;
  // preventScroll şart: odaklanan düğme kutunun ALTINDA olduğu için tarayıcı onu
  // görünür kılmak adına kutuyu en aşağı kaydırıyor ve panel sondan açılıyordu.
  ui.ayarKapat.focus({ preventScroll: true });
}

function ayarlariUygula(): void {
  ayarlar.desenYumusat = ui.desenKutu.checked;
  ayarlar.hareketAzalt = ui.hareketKutu.checked;
  ayarlar.titresim = ui.titresimKutu.checked;
  azalt = hareketAzalt() || ayarlar.hareketAzalt;
  ayarlariYaz(ayarlar);
  sonFlas = -1;   // flaş katmanı yeni ayara göre tazelensin
}

ui.ayarAc.addEventListener("click", e => { e.stopPropagation(); if (!bitti) ayarPaneliAc(); ui.ayarAc.blur(); });

// ---- Nasıl oynanır ---------------------------------------------------------
function nasilAc(): void {
  panelAcik = true;
  arkaKilit(true);
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
  levelYukle(durum.level.n);
});
ui.desenKutu.addEventListener("change", ayarlariUygula);
ui.hareketKutu.addEventListener("change", ayarlariUygula);
ui.titresimKutu.addEventListener("change", () => { ayarlariUygula(); titret(ayarlar, "kilit"); });
ui.ayarKapat.addEventListener("click", () => {
  ayarlariUygula();
  ayarlar.uyariGoruldu = true;
  ayarlariYaz(ayarlar);
  ui.ayarPanel.hidden = true;
  arkaKilit(false);
  ui.ayarKapat.blur();
  panelAcik = false;
  // Panelde geçen süre levele yazılmasın: level baştan başlar.
  levelYukle(durum.level.n);
});

levelYukle(kayit.level);
tuval.boyutla();
oyun.basla();

// İlk açılışta kuralları ve ışığa duyarlılık notunu bir kez göster (bkz. ui/nasil.ts).
if (!ayarlar.uyariGoruldu) nasilAc();

// Geliştirme sırasında elle sınamak için; oyun bunu kullanmaz ve üretim derlemesine girmez.
if (import.meta.env.DEV) {
  Object.assign(window, { KASA: { durum: () => durum, kayit, tablo, ADIM } });
}
