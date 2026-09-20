// Oyunu bir oyuncu profiliyle oynatır. Test ajanları bunu kullanır.
//
// ÖNEMLİ: burada oyunun kendisi oynanıyor — src/game/state.ts içindeki gerçek
// createLevel / tap / step çağrılıyor ve fizik oyunun kullandığı 1/120 sn adımla
// ilerliyor. Ayrı bir simülasyon değil.
//
// Kullanım:
//   node tools/play.ts --profil=aceleci --level=1-20 --deneme=6
//   node tools/play.ts --profil=sabirli --level=30-40 --tohum=7 --ayrinti
//
// Profiller aşağıda PROFILLER içinde; --tepki/--sapma/--acgozluluk/--sabir ile
// tek tek de ayarlanabilir.
import fs from "node:fs";
import path from "node:path";
import {
  canPass, largestOpen, peekOpen, lockOpen, initialOpen, OPEN_ALL, liveRings, stepRings, DEG
} from "../src/core/index.ts";
import type { LevelTable, Level, Open } from "../src/core/index.ts";
import { createLevel, tap, step } from "../src/game/state.ts";

const ADIM = 1 / 120;
const tablo: LevelTable = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "..", "data", "levels.json"), "utf8"));

// ---- Oyuncu profili ----------------------------------------------------------
export interface Profil {
  ad: string;
  aciklama: string;
  /** Dokunuştan sonra en erken ne zaman tekrar dokunabilir (sn). İnsan refleksi. */
  tepki: number;
  /** Dokunuş zamanlamasının standart sapması (sn). Küçük = keskin nişan. */
  sapma: number;
  /**
   * Kalan hata payının ne kadarını harcamaya razı (0-1).
   * Yüksek = "yeter ki geçsin" diye erken basar, düşük = daha iyi hizalanma bekler.
   */
  acgozluluk: number;
  /** Bir halka için en fazla kaç saniye bekler; dolunca eline geleni vurur. */
  sabir: number;
  /** Deneme başına öğrenme: her denemede sapma bu oranda azalır (0 = öğrenmez). */
  ogrenme: number;
}

export const PROFILLER: Record<string, Profil> = {
  aceleci: {
    ad: "Aceleci",
    aciklama: "Hızlı refleks, sabırsız. Beklemeyi sevmez, ilk geçer fırsatı vurur.",
    tepki: 0.18, sapma: 0.075, acgozluluk: 0.85, sabir: 1.6, ogrenme: 0.04
  },
  sabirli: {
    ad: "Sabırlı nişancı",
    aciklama: "Yavaş ama isabetli. İyi hizalanmayı bekler, hata payını korumaya çalışır.",
    tepki: 0.30, sapma: 0.045, acgozluluk: 0.30, sabir: 6.0, ogrenme: 0.06
  },
  acemi: {
    ad: "Acemi",
    aciklama: "İlk kez oynuyor. Zamanlaması dağınık, ne bekleyeceğini bilmiyor, ama çabuk öğreniyor.",
    tepki: 0.35, sapma: 0.13, acgozluluk: 0.75, sabir: 3.0, ogrenme: 0.10
  },
  ustalasan: {
    ad: "Ustalaşan",
    aciklama: "Oyunu çözmüş, yıldız peşinde. Keskin zamanlama, açgözlü değil.",
    tepki: 0.22, sapma: 0.030, acgozluluk: 0.18, sabir: 8.0, ogrenme: 0.03
  },
  dikkatsiz: {
    ad: "Dikkati dağınık",
    aciklama: "Telefonla başka şey yaparken oynuyor. Ara sıra geç kalıyor, bazen erken basıyor.",
    tepki: 0.40, sapma: 0.16, acgozluluk: 0.80, sabir: 2.5, ogrenme: 0.02
  }
};

// ---- Rastgelelik -------------------------------------------------------------
function rastgele(tohum: number): () => number {
  let s = tohum >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const gaussUret = (R: () => number) => (): number =>
  Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());

// ---- Bir levelin bir denemesi ------------------------------------------------
export interface DenemeSonucu {
  kazandi: boolean;
  sure: number;
  yildiz?: number;
  /** Kaybettiyse kaçıncı kilitte. */
  kacinciKilit?: number;
  sebep: "kasa açıldı" | "açıklık kapandı" | "süre doldu";
  /** Her kilitte kanalın ne kadarı korundu (oran). */
  korunan: number[];
}

function birDeneme(level: Level, p: Profil, sapma: number, R: () => number): DenemeSonucu {
  const gauss = gaussUret(R);
  const s = createLevel(level, 1);
  const korunan: number[] = [];
  let sonDokunus = -p.tepki;
  let halkaBaslangic = 0;
  let kilitSayisi = 0;

  // Dokunuş kararı için oyuncunun gördüğü açık bölgeyi ayrıca izliyoruz.
  let gorunen: Open = initialOpen(liveRings(level.rings));
  const olcuRings = liveRings(level.rings);

  let oncekiGenis = -1;   // bir önceki adımda "şimdi bassam" kaç derece kalırdı

  for (let adim = 0; adim < 120 * 180; adim++) {
    if (s.asama !== "idle") break;

    const t = s.levelTime;
    const aktif = s.rings[s.active];
    let basmakIstiyor = false;

    if (t >= sonDokunus + p.tepki) {
      // Aktif halkanın şu anki açısını oyunun durumundan al
      olcuRings[s.active].angle = aktif.angle;
      olcuRings[s.active].gaps = aktif.gaps;
      const simdiki = gorunen === OPEN_ALL ? null : largestOpen(gorunen).w;
      const sonuc = peekOpen(gorunen, olcuRings[s.active]);

      // İnsan oyuncu boşluğun hizalanmasını izler ve EN GENİŞ anda vurur; açıklık
      // daralmaya başladığı an tepe noktası geçilmiş demektir. "Geçer olan ilk ana"
      // basmak kenara basmaktır ve en küçük zamanlama hatası kapatır.
      const tepeyiGecti = oncekiGenis >= 0 && sonuc.w < oncekiGenis - 1e-9;
      const kalanHalka = s.rings.filter(r => !r.locked).length;
      const kalanSure = level.limit - t;
      const buSabir = Math.min(p.sabir, Math.max(0.15, kalanSure / Math.max(1, kalanHalka) - p.tepki));
      const sabirBitti = t - halkaBaslangic > buSabir;
      const sureBitiyor = kalanSure < kalanHalka * (p.tepki + 0.3);

      if (gorunen === OPEN_ALL) {
        // İlk kilit kanalın yönünü belirler; hangi açı seçilirse seçilsin genişlik aynı.
        // Aceleci hemen basar, sabırlı biraz düşünür.
        basmakIstiyor = t >= p.tepki + (1 - p.acgozluluk) * 0.8;
      } else if (simdiki !== null && canPass(sonuc.w) && tepeyiGecti) {
        const kayip = simdiki - sonuc.w;
        const pay = simdiki - 18 * DEG;          // geçiş eşiğine kalan pay
        // Sabır bittiyse ya da süre eriyorsa tepe noktasında eline geleni alır.
        basmakIstiyor = kayip <= pay * p.acgozluluk || sabirBitti || sureBitiyor;
      }
      oncekiGenis = sonuc.w;
    }

    if (basmakIstiyor) {
      // Zamanlama hatası: erken ya da geç
      const hata = gauss() * sapma;
      const adimSayisi = Math.round(Math.abs(hata) / ADIM);
      if (hata > 0) {
        for (let i = 0; i < adimSayisi && s.asama === "idle"; i++) step(s, ADIM);
      } else {
        for (let i = 0; i < adimSayisi; i++) {
          stepRings(s.rings, -ADIM, s.levelTime);
          s.levelTime -= ADIM;
        }
      }
      if (s.asama !== "idle") break;

      const oncekiGenislik = gorunen === OPEN_ALL ? null : largestOpen(gorunen).w;
      const hangiHalka = s.active;
      const r = tap(s, tablo.q3, tablo.q2);
      kilitSayisi++;
      olcuRings[hangiHalka].angle = s.rings[hangiHalka].angle;
      gorunen = lockOpen(gorunen, olcuRings[hangiHalka]);
      olcuRings[hangiHalka].locked = true;
      const yeniGenislik = gorunen.length ? largestOpen(gorunen).w : 0;
      korunan.push(oncekiGenislik ? +(yeniGenislik / oncekiGenislik).toFixed(3) : 1);

      sonDokunus = s.levelTime;
      halkaBaslangic = s.levelTime;
      oncekiGenis = -1;   // yeni halka: tepe izlemeyi sifirla

      if (r.tip === "kayip") return { kazandi: false, sure: s.levelTime, kacinciKilit: kilitSayisi, sebep: "açıklık kapandı", korunan };
      if (r.tip === "acildi") return { kazandi: true, sure: r.sure, yildiz: r.yildiz, sebep: "kasa açıldı", korunan };
      continue;
    }

    const a = step(s, ADIM);
    if (a.tip === "sureDoldu") return { kazandi: false, sure: s.levelTime, kacinciKilit: kilitSayisi, sebep: "süre doldu", korunan };
  }
  return { kazandi: false, sure: s.levelTime, kacinciKilit: kilitSayisi, sebep: "süre doldu", korunan };
}

// ---- Bir levelin tamamı (denemeler dahil) ------------------------------------
export interface LevelSonucu {
  n: number;
  boss: string | null;
  halka: number;
  limit: number;
  gecti: boolean;
  deneme: number;
  yildiz?: number;
  sure?: number;
  kayipSebepleri: string[];
  /** Kilit başına korunan kanal oranı (son, kazanılan denemeden). */
  korunan: number[];
}

export function leveliOyna(level: Level, p: Profil, enCokDeneme: number, R: () => number): LevelSonucu {
  const kayipSebepleri: string[] = [];
  let sapma = p.sapma;
  for (let d = 1; d <= enCokDeneme; d++) {
    const r = birDeneme(level, p, sapma, R);
    if (r.kazandi) {
      return { n: level.n, boss: level.boss, halka: level.rings.length, limit: level.limit,
        gecti: true, deneme: d, yildiz: r.yildiz, sure: +r.sure.toFixed(2), kayipSebepleri, korunan: r.korunan };
    }
    kayipSebepleri.push(`${r.sebep}${r.kacinciKilit ? ` (${r.kacinciKilit}. kilit, ${r.sure.toFixed(1)} sn)` : ""}`);
    sapma = Math.max(p.sapma * 0.45, sapma * (1 - p.ogrenme));   // deneye deneye keskinleşir
  }
  return { n: level.n, boss: level.boss, halka: level.rings.length, limit: level.limit,
    gecti: false, deneme: enCokDeneme, kayipSebepleri, korunan: [] };
}

// ---- CLI ---------------------------------------------------------------------
const arg = (ad: string, vars: string): string => {
  const e = process.argv.find(a => a.startsWith(`--${ad}=`));
  return e ? e.slice(ad.length + 3) : vars;
};

if (process.argv.includes("--profiller")) {
  for (const [k, p] of Object.entries(PROFILLER)) {
    console.log(`${k.padEnd(12)} ${p.ad} — ${p.aciklama}`);
    console.log(`${" ".repeat(13)}tepki ${p.tepki}s, sapma ${p.sapma}s, açgözlülük ${p.acgozluluk}, sabır ${p.sabir}s`);
  }
  process.exit(0);
}

const profilAdi = arg("profil", "sabirli");
const taban = PROFILLER[profilAdi];
if (!taban) { console.error(`Bilinmeyen profil: ${profilAdi}. Seçenekler: ${Object.keys(PROFILLER).join(", ")}`); process.exit(1); }
const p: Profil = {
  ...taban,
  tepki: +arg("tepki", String(taban.tepki)),
  sapma: +arg("sapma", String(taban.sapma)),
  acgozluluk: +arg("acgozluluk", String(taban.acgozluluk)),
  sabir: +arg("sabir", String(taban.sabir))
};
const aralik = arg("level", "1-60").split("-").map(Number);
const ilk = aralik[0], son = aralik.length > 1 ? aralik[1] : aralik[0];
const enCokDeneme = +arg("deneme", "8");
const R = rastgele(+arg("tohum", "1"));
const ayrinti = process.argv.includes("--ayrinti");

console.log(`Oyuncu: ${p.ad} — ${p.aciklama}`);
console.log(`Ayarlar: tepki ${p.tepki}s, sapma ${p.sapma}s, açgözlülük ${p.acgozluluk}, sabır ${p.sabir}s, level başına en çok ${enCokDeneme} deneme\n`);

const sonuclar: LevelSonucu[] = [];
for (let n = ilk; n <= son; n++) {
  const r = leveliOyna(tablo.levels[n - 1], p, enCokDeneme, R);
  sonuclar.push(r);
  const yildiz = r.yildiz ? "★".repeat(r.yildiz) + "☆".repeat(3 - r.yildiz) : "---";
  const etiket = `${r.n}${r.boss ? "*" : " "}`.padEnd(4);
  const durum = r.gecti ? `${r.deneme}. denemede  ${yildiz}  ${r.sure}s / ${r.limit}s` : `GEÇEMEDİ (${enCokDeneme} deneme)`;
  console.log(`${etiket} ${String(r.halka)}h  ${durum}`);
  if (ayrinti && r.kayipSebepleri.length) {
    for (const k of r.kayipSebepleri) console.log(`      kayıp: ${k}`);
  }
}

// ---- Özet --------------------------------------------------------------------
const gecen = sonuclar.filter(r => r.gecti);
const toplamDeneme = sonuclar.reduce((s, r) => s + r.deneme, 0);
const yildizToplam = gecen.reduce((s, r) => s + (r.yildiz || 0), 0);
const takilanlar = sonuclar.filter(r => r.deneme >= 4).map(r => `${r.n}${r.boss ? "*" : ""}(${r.deneme})`);
const gecemeyen = sonuclar.filter(r => !r.gecti).map(r => `${r.n}${r.boss ? "*" : ""}`);
const sebepSay: Record<string, number> = {};
for (const r of sonuclar) for (const k of r.kayipSebepleri) {
  const tur = k.startsWith("süre") ? "süre doldu" : "açıklık kapandı";
  sebepSay[tur] = (sebepSay[tur] || 0) + 1;
}

console.log(`\n--- ÖZET (${p.ad}) ---`);
console.log(`Geçilen level      : ${gecen.length}/${sonuclar.length}`);
console.log(`Toplam deneme      : ${toplamDeneme}  (level başına ${(toplamDeneme / sonuclar.length).toFixed(2)})`);
console.log(`Toplam yıldız      : ${yildizToplam}/${sonuclar.length * 3}  (level başına ${(yildizToplam / Math.max(1, gecen.length)).toFixed(2)})`);
console.log(`Yıldız dağılımı    : 3★ ${gecen.filter(r => r.yildiz === 3).length}  2★ ${gecen.filter(r => r.yildiz === 2).length}  1★ ${gecen.filter(r => r.yildiz === 1).length}`);
console.log(`Kayıp sebepleri    : ${Object.entries(sebepSay).map(([k, v]) => `${k} ${v}`).join(", ") || "yok"}`);
console.log(`4+ denemelik duvar : ${takilanlar.join(" ") || "yok"}`);
console.log(`Hiç geçilemeyen    : ${gecemeyen.join(" ") || "yok"}`);
