// Kasa: uygulamanın giriş noktası. Parçaları birbirine bağlar, kural içermez.
import "./styles.css";
import { LEVEL_COUNT, validateTable, STAR_LABEL } from "./core/index.ts";
import type { LevelTable, Best } from "./core/index.ts";
import tabloHam from "../data/levels.json";

import { createLevel, tap, step, decay, kalanSure } from "./game/state.ts";
import type { LevelState } from "./game/state.ts";
import { dongu, ADIM } from "./game/loop.ts";
import { girdiBagla } from "./game/input.ts";
import { tuvalKur, ciz } from "./game/render.ts";
import { renkleriOku, hareketAzalt, tercihleriIzle } from "./game/theme.ts";
import { ogreticiTablosu, ipucu, yildizYazisi, sureYazisi } from "./game/hints.ts";
import { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel } from "./game/storage.ts";
import { kabukKur } from "./ui/shell.ts";

const tablo = tabloHam as LevelTable;

const hedef = document.getElementById("app");
if (!hedef) throw new Error("#app bulunamadı");

// Tablo bozuksa sessizce garip bir oyun açmak yerine durumu söyle.
const semaHatalari = validateTable(tablo);
if (semaHatalari.length) {
  hedef.innerHTML = `<main style="padding:24px"><h1>Kasa</h1>
    <p>Level tablosu okunamadı. <code>npm run verify</code> çalıştırın.</p>
    <ul>${semaHatalari.slice(0, 10).map(h => `<li>${h}</li>`).join("")}</ul></main>`;
  throw new Error("level tablosu geçersiz: " + semaHatalari.length + " sorun");
}

const ui = kabukKur(hedef);
const kayit = oku();
const ogretici = ogreticiTablosu(tablo.levels);

let renk = renkleriOku();
let azalt = hareketAzalt();
let durum: LevelState = null as unknown as LevelState;
let bitti = false;

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

function cizVeYaz(): void {
  ciz(tuval, durum, renk, { hareketAzalt: azalt });
}

// ---- Dokunuş ---------------------------------------------------------------
function dokunusIsle(): void {
  const n = girdi.al();
  for (let i = 0; i < n; i++) {
    const sonuc = tap(durum, tablo.q3, tablo.q2);
    if (sonuc.tip === "kayip") { yaz("Açıklık kapandı"); return; }
    if (sonuc.tip === "acildi") {
      const yeni: Best = { s: sonuc.yildiz, t: +sonuc.sure.toFixed(2) };
      const oncekiVardi = kayit.bests[durum.level.n] !== undefined;
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
  adim(dt) {
    if (bitti) return false;
    dokunusIsle();
    const s = step(durum, dt);
    if (s.tip === "sureDoldu") { yaz("Süre doldu"); return true; }
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
    const g = tuval.yerlesim(durum.rings.length);
    decay(durum, dt, g.S, g.outer);
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
  ui.bitisDugme.focus();
}

ui.bitisDugme.addEventListener("click", () => {
  ui.bitis.hidden = true;
  bitti = false;
  bastanBasla(kayit);
  levelYukle(1);
});

ui.reset.addEventListener("click", e => {
  e.stopPropagation();
  bitti = false;
  ui.bitis.hidden = true;
  bastanBasla(kayit);
  levelYukle(1);
  ui.reset.blur();   // sonraki Enter oyuna gitsin, düğmeye değil
});

tercihleriIzle(() => { renk = renkleriOku(); azalt = hareketAzalt(); });

levelYukle(kayit.level);
tuval.boyutla();
oyun.basla();

// Geliştirme sırasında elle sınamak için; oyun bunu kullanmaz.
Object.assign(window, { KASA: { durum: () => durum, kayit, tablo, ADIM } });
