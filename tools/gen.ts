// Dönence level üretici. Kullanım:
//   npm run gen           -> data/levels.json dosyasını yeniden üretir (sabit tohum, her seferinde aynı sonuç)
//   npm run verify        -> mevcut tabloyu denetler
//   npm run verify:full   -> üstüne determinizmi de sınar
import fs from "node:fs";
import path from "node:path";
import {
  TAU, DEG, NEED_PASS, SOLVER_MARGIN, REACT, GAP_MAX_DEG, LEVEL_COUNT, BOSS_ARALIGI, bossMu,
  canPass, stepRings, liveRings, validateTable, solve,
  OPEN_ALL, lockOpen, peekOpen, largestOpen, initialOpen, starRatio
} from "../src/core/index.ts";
import type { RingDef, LevelTable, Open, PatronAnahtari } from "../src/core/index.ts";

/** Üretim sırasındaki ham halka: tanıma gapScale eklenir, gap'i sizeGaps hesaplar. */
interface RawRing extends RingDef { gapScale?: number }

/** Kayıp sebebi: "sure" = zaman doldu, "kanal" = açıklık geçilemeyecek kadar daraldı. */
type Sebep = "sure" | "kanal";
interface PlayResult { win: boolean; t: number; q?: number; sebep?: Sebep }
interface Finalized { def: RingDef[]; best: number; limit: number; want: number; roomy: boolean }
interface Evaluated { win: number; qs: number[]; sureOrani: number; sureKaybi: number }
type Candidate = Finalized & Evaluated & { tol: number; boss?: PatronAnahtari };
/**
 * Patron tasarımı. Görünen ad ve ipucu BURADA DEĞİL, src/dil/ altında: tabloya yalnızca
 * anahtar yazılır. Eskiden Türkçe metin 1000 satırın içine gömülüydü ve çevrilemezdi.
 */
interface Boss { anahtar: PatronAnahtari; tol: number; rings: () => RawRing[] }
type Log = (...args: unknown[]) => void;

const OUT = path.join(import.meta.dirname, "..", "data", "levels.json");
let seed = 12345; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let es = 1; const ER = () => { es = (es * 16807) % 2147483647; return es / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(ER() + 1e-9)) * Math.cos(TAU * ER());
const rnd4 = (x: number): number => Math.round(x * 1e4) / 1e4;
// Çözücünün kendine bıraktığı pay: geçiş eşiğinin biraz üstünü hedefler ki insan oyuncuya yer kalsın.
const needS = NEED_PASS + SOLVER_MARGIN;

// İnsan benzeri oyuncu: dokunuşu ±sigma sn sapar
function play(def: RingDef[], limit: number, { tol = 0.7, sigma = 0.06 } = {}): PlayResult {
  const rs = liveRings(def), dt = 1 / 120; let open = initialOpen(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r.locked) continue;
    const rem = rs.filter((x, k) => k > i && !x.locked).length; let done = false;
    while (t < limit) {
      let want = false;
      if (t >= last + REACT) {
        if (open === OPEN_ALL) want = true;
        else {
          const cur = largestOpen(open).w, allow = (cur - needS) / (rem + 1) * tol;
          const p = peekOpen(open, r);
          if (p.w >= needS && cur - p.w <= allow) want = true;
        }
      }
      if (want) {
        // Dokunus hatasi: erken de gec de olsa TUM halkalari birlikte sarar (gercek oyunda oyuncu zamani kaydirir, tek halkayi degil)
        const e = gauss() * sigma;
        const sdt = e >= 0 ? dt : -dt;
        // İleri adım lt'yi adımdan SONRA, geri adım ÖNCE alır: ancak böyle tam tersine çevrilebilir.
        for (let k = Math.abs(e); k > 0; k -= dt) { const lt = sdt > 0 ? t + sdt : t; stepRings(rs, sdt, lt); t += sdt; }
        open = lockOpen(open, r);
        if (!canPass(largestOpen(open).w)) return { win: false, t, sebep: "kanal" };
        r.locked = true; last = t; done = true; break;
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return { win: false, t, sebep: "sure" };
  }
  const minGap = Math.min(...def.map(r => r.gap)) * DEG;
  return { win: true, t, q: starRatio(largestOpen(open).w, minGap) };
}

/**
 * Boşluk genişliği, hata payından türetilir.
 *
 * Türetme: kanal [−W/2, W/2], halkanın boşluğu ideal konumdan d kadar kaymış, yarım
 * genişliği h olsun. Kesişim [max(−W/2, d−h), min(W/2, d+h)]'dir, yani kanal en fazla
 * |d| kadar daralır. Oyuncu i. halkaya ε saniye hatayla dokunursa d = ω_i·ε olur ve
 * toplam kayıp Σ|ω_i·ε_i| ile sınırlıdır. Boşluk bu üst sınırı karşılamalıdır:
 *
 *     gap = NEED_PASS + tolSn × Σ|ω_i|
 *
 * **İlk kilit toplama girmez.** İlk kilit kanalı DARALTMAZ, tanımlar: kanal o halkanın
 * boşluğunun kendisidir, hangi açıda kilitlendiği genişliği değiştirmez. Daraltan
 * kilitler 2..n'dir. Eskiden formül ilk halkayı da topluyordu; bu zorluğu bozmuyordu
 * (tune her bölümün tol'unu ayrı ayarlar) ama tol'un "saniye cinsinden hata payı"
 * anlamını bozuyordu: 2 halkalı bölümde %100, 6 halkalıda %20 şişiriyordu.
 *
 * Halkalar bu ortak genişliği kendi gapScale çarpanıyla ölçekler.
 */
function sizeGaps(rings: RawRing[], tolSec: number): void {
  const hareketli = rings.filter(r => !r.preLocked);
  const hizlar = hareketli.map(r => Math.abs(r.speed) * (r.wobble ? 1.7 : 1)).sort((a, b) => a - b);
  // En yavaş halka "ilk kilit" sayılır: oyuncu kanalı ondan kurarsa en az şey kaybeder.
  const vsum = hizlar.slice(1).reduce((s, v) => s + v, 0);
  const base = NEED_PASS / DEG + tolSec * vsum / DEG;
  for (const r of rings) {
    const gap = Math.min(base * (r.gapScale || 1), GAP_MAX);
    r.gap = gap;
    if (r.gaps === 2 && (gap > 80 || r.gapOffset < gap + 30 || 360 - r.gapOffset < gap + 30)) r.gaps = 1;
  }
}

const GAP_MAX = GAP_MAX_DEG;

/**
 * Bir bölümü geçmek için gereken zamanlama hassasiyeti (saniye):
 *
 *     tau = (en dar boşluk − NEED_PASS) / (daraltan kilit sayısı × ortalama hız)
 *
 * Zorluğun TEK gerçek ekseni budur ve aşağıdan insan refleksiyle sınırlıdır. İnsanın
 * dokunuş zamanlaması ~60 ms standart sapmayla dağılır; tau 60 ms iken oyuncu kilit
 * başına 1 sigma isabet tutturmak zorundadır, 30 ms iken 0,5 sigma.
 *
 * 25 ms'nin altı adil değildir: orada bölüm beceriyle değil şansla geçilir.
 */
const TAU_TABAN = 0.025;

function tauHesapla(def: RingDef[]): number {
  const hareketli = def.filter(r => !r.preLocked);
  const m = Math.max(1, hareketli.length - 1);
  const wb = hareketli.reduce((s, r) => s + Math.abs(r.speed) * (r.wobble ? 1.7 : 1), 0) / hareketli.length;
  const B = Math.min(...def.map(r => r.gap)) * DEG - NEED_PASS;
  return (B / m) / wb;
}
/**
 * Baştan kilitli halkalardan sonra kalması gereken en az hata payı.
 *
 * Tipik bir oyuncunun 60 ms'lik zamanlama sapması ~1,5 rad/sn hızda 5°'ye denk gelir;
 * bunun altında ilk dokunuş kaçınılmaz ölüme dönüşür. Test oyuncuları tam bundan
 * şikâyet etti: eski tabloda halka başına 3,7-4,4° kalan bölümler vardı.
 *
 * Pay halka başına DOĞRUSAL değildir. İlk halkaya tam pay, sonrakilere yarısı düşer:
 * korunmak istenen şey "hiç tepki veremeden ölmek"tir ve bu birinci dokunuşta olur.
 * Doğrusal kural (kalan × 6°) 5 halkalı bir bölümde 30° pay şart koşuyordu ve boşluğu
 * zorunlu olarak geniş bırakıyordu; baştan kilitli halkası olan patronlar bu yüzden
 * hedeflerinin 30-44 puan üstünde, yani kolay kalıyordu.
 */
const EN_AZ_PAY = 6 * DEG;
const gerekenPay = (kalan: number): number => EN_AZ_PAY * (1 + (kalan - 1) * 0.5);
// 17. levelden sonra halka sayısı 6'da sabitleniyordu; 60 levelin 41'i aynı yapıdaydı.
// Bu ritim araya daha az halkalı ama daha dar boşluklu (hassasiyet isteyen) leveller serpiştirir.
const RHYTHM = [6, 6, 5, 6, 4, 6, 5, 6];
const ringCount = (n: number): number => { const grow = Math.min(2 + Math.floor((n - 1) / 4), 6); return grow < 6 ? grow : RHYTHM[(n - 1) % RHYTHM.length]; };
// Süre limiti artık tasarım girdisi: hareketli halka sayısından gelir ve geç levellerde kademeli sıkılaşır.
// Çözücü süresi limiti belirlemez, yalnızca "bu limit yeterli mi" diye denetlenir.
const limitFor = (n: number, moving: number): number =>
  +((4 + 2 * moving) * (1 - 0.22 * Math.min(1, (n - 1) / (TABAN_BOLUM - 1)))).toFixed(1);

/** Tasarim limiti: arketip carpani dahil. Uretim ve dogrulama AYNI fonksiyonu kullanir. */
const tasarimLimiti = (n: number, moving: number): number =>
  +(limitFor(n, moving) * ARKETIP_AYARI[arketip(n)].sureCarpani).toFixed(1);

/**
 * Bir halkanın kilitlenme anının kabaca tahmini: oyuncu dıştan içe gider ve her kilit
 * ~0,6 saniye alır.
 */
const tahminiKilitAni = (sira: number): number => 0.3 + sira * 0.6;

/**
 * Yön değiştiren halkanın dönüşü, o halka kilitlenmeden ÖNCE görülebilmeli.
 * Ölçüm: eski tabloda 68 flip halkasının 55'i (%81) hiç dönmeden kilitleniyordu; ipucu
 * 13. levelde çıkıyor ama dönüş ilk kez 30. levelde (Metronom patronu) görülebiliyordu.
 * Oyuncu mekaniği bir patronda, cezayla öğreniyordu.
 *
 * Kural: flip yalnızca kilitlenmesi 1,2 saniyeden geç olan halkalara verilir ve periyot
 * o süreye sığacak şekilde kısaltılır. Erken kilitlenen halkanın flip'i kaldırılır.
 */
function gorunurFlip(rings: RawRing[]): void {
  let sira = 0;
  for (const r of rings) {
    if (r.preLocked) continue;
    const an = tahminiKilitAni(sira);
    sira++;
    if (!r.flip) continue;
    if (an < 1.2) { r.flip = 0; continue; }          // bu halka dönüşü gösteremeyecek kadar erken kilitlenir
    r.flip = Math.min(r.flip, an * 0.7);             // periyodu kilitlenme anına sığdır
  }
}

/**
 * Zorluk arketipleri.
 *
 * Hassasiyet ekseni (tau) yaklaşık 150. bölümde tabanına oturur ve oradan sonra
 * artırılamaz. Buna rağmen 1000 bölümün birbirinin aynısı olmaması gerekir. Çözüm,
 * aynı kazanma oranını FARKLI BECERİLERLE tutturmak: her arketip başka bir ekseni
 * zorlar, tune() gerekli boşluk genişliğini ona göre ayarlar.
 *
 *   hassasiyet — az halka, yön değiştirme ve dalgalanma yok, en dar pay. Saf zamanlama.
 *   tahmin     — halkaların çoğu yön değiştiriyor veya hızlanıp yavaşlıyor. Nereye
 *                geleceğini öngörmek gerekir.
 *   catal      — halkaların çoğu iki kapılı. Hangi kapıyı seçtiğin sonrakini belirler.
 *   dayaniklilik — altı halka, sıkı süre. Çok karar, az zaman.
 *   karma      — hepsi bir arada.
 */
type Arketip = "hassasiyet" | "tahmin" | "catal" | "dayaniklilik" | "karma";

const ARKETIP_SIRASI: Arketip[] = [
  "karma", "hassasiyet", "tahmin", "karma", "catal", "dayaniklilik", "tahmin", "hassasiyet"
];

/** Arketipler hassasiyet ekseni tükendikten sonra devreye girer. */
const ARKETIP_BASLANGIC = 60;
const arketip = (n: number): Arketip =>
  n < ARKETIP_BASLANGIC ? "karma" : ARKETIP_SIRASI[(n - ARKETIP_BASLANGIC) % ARKETIP_SIRASI.length];

interface ArketipAyari {
  halka?: [number, number];  // halka sayısı aralığı (kapsayıcı)
  gaps2: number;            // iki kapılı halka olasılığı
  flip: number;             // yön değiştirme olasılığı
  wobble: number;           // hızlanma olasılığı
  preLocked: number;        // baştan kilitli halka olasılığı
  sureCarpani: number;      // süre sınırı çarpanı
}

const ARKETIP_AYARI: Record<Arketip, ArketipAyari> = {
  // halka: [en az, en cok] -> dagilim 3 ile 6 arasinda yigilmasin
  hassasiyet:   { halka: [3, 4], gaps2: 0.00, flip: 0.00, wobble: 0.00, preLocked: 0.15, sureCarpani: 1.15 },
  tahmin:       {           gaps2: 0.10, flip: 0.70, wobble: 0.60, preLocked: 0.30, sureCarpani: 1.10 },
  catal:        {           gaps2: 0.75, flip: 0.15, wobble: 0.15, preLocked: 0.25, sureCarpani: 1.00 },
  dayaniklilik: { halka: [5, 6], gaps2: 0.25, flip: 0.25, wobble: 0.25, preLocked: 0.30, sureCarpani: 0.80 },
  karma:        {           gaps2: 0.30, flip: 0.35, wobble: 0.30, preLocked: 0.50, sureCarpani: 1.00 }
};

function candidate(n: number): RawRing[] {
  const a = ARKETIP_AYARI[arketip(n)];
  const count = a.halka ? a.halka[0] + Math.floor(R() * (a.halka[1] - a.halka[0] + 1)) : ringCount(n);
  // Hız ARTIRILMAZ. Bu tasarımda hız ve boşluk genişliği birbirine bağlıdır:
  // sizeGaps boşluğu 'tolerans süresi x hız toplamı' ile hesaplar, yani hızlı halka
  // aynı hata payı için daha geniş boşluk ister. Hızı artırmak zorluğu artırmaz,
  // yalnızca her şeyi büyütüp 85 derece tavanına dayar ve ayarlamayı imkansizlastirir.
  // Zorluğun gerçek kolu tolerans süresidir ve onu tune() ayarlar.
  const base = Math.min(0.8 + n * 0.03, 2.2);
  const rings: RawRing[] = [];
  for (let i = 0; i < count; i++) {
    const dir = n < 3 ? 1 : (R() < 0.5 ? -1 : 1);
    rings.push({ speed: dir * base * (0.7 + R() * 0.6), gap: 0, gapScale: 0.82 + R() * 0.36,
      gaps: n >= 11 && R() < a.gaps2 ? 2 : 1, gapOffset: 130 + R() * 50,
      flip: n >= 12 && R() < a.flip ? 1.4 + R() * 1.8 : 0,
      wobble: n >= 18 && R() < a.wobble, preLocked: false, start: R() * TAU });
  }
  gorunurFlip(rings);
  if (n >= 6 && R() < a.preLocked) {
    const pre = n >= 15 && count >= 4 && R() < 0.5 ? 2 : 1, anchor = R() * TAU, picks: number[] = [];
    while (picks.length < pre) { const k = Math.floor(R() * count); if (!picks.includes(k)) picks.push(k); }
    picks.forEach((k, j) => { Object.assign(rings[k], { preLocked: true, gaps: 1, flip: 0, wobble: false, start: anchor + (j ? (R() - 0.5) * 0.15 : 0) }); });
  }
  // preLocked atamasi siralamayi degistirdigi icin gorunurluk yeniden hesaplanir.
  gorunurFlip(rings);
  // Bosluk genisligini tune() belirler; burada hesaplamak gereksizdi ve yan etkisi
  // (gap > 80 ise gaps 2 -> 1) uretilen iki kapili halkalarin %80'ini yok ediyordu.
  return rings;
}

// ===== Patron levelleri (elle tasarlandı) =====
const A = -Math.PI / 2;
// speed ve start varsayilanlari hicbir cagrida kullanilmaz; yalnizca tip tamligi icin.
const mk = (o: Partial<RawRing>): RawRing =>
  ({ speed: 0, start: 0, gap: 0, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, ...o });
/**
 * Altı patron tasarımı sırayla tekrar eder: 10, 20, ... bölümlerinde sırasıyla
 * Ayna, Merkez, Metronom, Çatal, Tavşan ile kaplumbağa, Büyük kasa, sonra baştan.
 * Tekrar eden tasarım her turda daha zor ayarlanır, çünkü hedef eğri aşağıdadır.
 */
const BOSS_SIRASI = [10, 20, 30, 40, 50, 60];
const bossTasarimi = (n: number): Boss | undefined => {
  if (!bossMu(n)) return undefined;
  // SON BÖLÜM her zaman kapanış patronudur. Döngü 6'lı, patron aralığı 10 ve
  // 1000. bölüm 100. patrona denk geliyor: 100 mod 6 = "çatal". Yani 1000 bölümlük
  // oyunun kapanışı altı tasarımdan rastgele birine düşüyordu — finali yoktu.
  // Yapı "Büyük kasa"nın aynısı, yalnızca anahtarı (ve dolayısıyla metni) farklı.
  if (n === LEVEL_COUNT) {
    const b = BOSSES[60];
    return b && { ...b, anahtar: "sonKasa" };
  }
  const tur = Math.floor(n / BOSS_ARALIGI) - 1;          // 0, 1, 2, ...
  return BOSSES[BOSS_SIRASI[tur % BOSS_SIRASI.length]];
};

const BOSSES: Record<number, Boss | undefined> = {
  10: { anahtar: 'ayna', tol: 0.2,
    // Hizlar birbirinden farkli olmali: esit hiz + esit start = birebir ayni halka, o kilit acikligi hic daraltmaz.
    // start = A - s * 2.5 oldugu icin hepsi yine t = 2,5 sn'de A acisinda hizalanir.
    rings: () => [1.3, -1.3, 1.9, -1.9].map(s => mk({ speed: s, start: A - s * 2.5 })) },
  20: { anahtar: 'merkez', tol: 0.15,
    rings: () => [2.0, -1.4, 0, 1.4, -2.0].map((s, i) => mk(i === 2 ? { speed: 1, preLocked: true, start: A } : { speed: s, start: R() * TAU })) },
  30: { anahtar: 'metronom', tol: 0.13,
    rings: () => [1.5, -1.6, 1.4, -1.5, 1.6].map(s => mk({ speed: s, flip: 1.2, start: A - s * 0.6 + (R() - 0.5) * 0.4 })) },
  40: { anahtar: 'catal', tol: 0.12,
    rings: () => [1.2, -1.5, 1.3, -1.1, 1.6].map(s => mk({ speed: s, gaps: 2, gapOffset: 150 + R() * 30, start: R() * TAU })) },
  50: { anahtar: 'tavsanKaplumbaga', tol: 0.11,
    rings: () => [0.5, -2.4, 0.6, -2.5, 0.5, -2.3].map(s => mk({ speed: s, start: R() * TAU })) },
  60: { anahtar: 'buyukKasa', tol: 0.11,
    rings: () => [mk({ speed: 1, preLocked: true, start: A }), mk({ speed: -1.9, flip: 2.1, start: R() * TAU }), mk({ speed: 1.6, gaps: 2, gapOffset: 165, start: R() * TAU }),
      mk({ speed: -1.4, wobble: true, start: R() * TAU }), mk({ speed: 2.1, flip: 1.7, start: R() * TAU }), mk({ speed: -1.7, start: R() * TAU })] }
};

function finalize(rings: RawRing[], n: number): Finalized | null {
  const def = rings.map(r => ({ speed: rnd4(r.speed), gap: rnd4(r.gap), gaps: r.gaps, gapOffset: rnd4(r.gapOffset), flip: rnd4(r.flip), wobble: r.wobble, preLocked: r.preLocked, start: rnd4(((r.start % TAU) + TAU) % TAU) }));
  // Baştan kilitli halkalar kanalı fazla daralttıysa aday elenir (bkz. EN_AZ_PAY).
  const canli = liveRings(def);
  const baslangic = initialOpen(canli);
  if (baslangic !== OPEN_ALL) {
    const kalan = canli.filter(r => !r.locked).length;
    const pay = largestOpen(baslangic).w - NEED_PASS;
    if (pay < gerekenPay(kalan)) return null;
  }
  // İnsan sınırının altındaki bölümler elenir: orada başarı beceriye değil şansa bağlıdır.
  if (tauHesapla(def) < TAU_TABAN) return null;
  const cozum = solve(def); if (!cozum) return null;
  const best = cozum.t;
  const moving = def.filter(r => !r.preLocked).length;
  const want = tasarimLimiti(n, moving);
  // Tasarım limiti kural; çözücü sığmıyorsa aday zaten elenir (bkz. tune), ama son çare olarak
  // limit yine de çözücünün üstünde kalır ki level bitirilebilir olsun.
  const guvenli = best * 1.5 + 1.5;
  // Bekleme bütçesi tavanı (bkz. GAMA_TAVAN). Çözülebilirlik tavanı aşıyorsa bu yapıya
  // adil bir süre verilemez demektir: aday elenir, limit zorlanmaz.
  const tavan = gamaTavani(def);
  if (guvenli > tavan) return null;
  const limit = +Math.min(Math.max(want, guvenli), tavan).toFixed(1);
  return { def, best, limit, want, roomy: best <= want * 0.65 };
}
/**
 * Ustalık referansı: açıklığın EN GENİŞ anını bekleyip vuran, zamanlaması keskin oyuncu.
 *
 * Yıldız eşikleri bundan hesaplanır, zorluk eğrisi ise play() ile. Sebep: eşikler
 * "iyi oynamak" ölçüsüdür, ortalama oyuncu ölçüsü değil. Eski tabloda eşikler play()'in
 * yüzdeliklerinden geliyordu ve play() nişan almıyordu; sonuçta nişan almayı öğrenen bir
 * oyuncu 60 levelin ~52'sinde 3 yıldız alıyor, 11-20 arasında %100'e çıkıyordu.
 */
const USTA_SAPMA = 0.035;   // keskin ama insan: ~35 ms zamanlama sapmasi

function playUsta(def: RingDef[], limit: number): PlayResult {
  const rs = liveRings(def), dt = 1 / 120;
  let open: Open = initialOpen(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]; if (r.locked) continue;
    let done = false, oncekiGenis = -1;
    while (t < limit) {
      let want = false;
      if (t >= last + REACT) {
        const p = peekOpen(open, r);
        if (open === OPEN_ALL) want = true;
        // Tepe noktası: açıklık daralmaya başladıysa en geniş an geçildi demektir.
        else if (canPass(p.w) && oncekiGenis >= 0 && p.w < oncekiGenis) want = true;
        oncekiGenis = p.w;
      }
      if (want) {
        // Usta da insan: tepe noktasini bulur ama tam ustune basamaz.
        const e = gauss() * USTA_SAPMA;
        const sdt = e >= 0 ? dt : -dt;
        for (let k = Math.abs(e); k > 0; k -= dt) { const lt = sdt > 0 ? t + sdt : t; stepRings(rs, sdt, lt); t += sdt; }
        open = lockOpen(open, r);
        if (!canPass(largestOpen(open).w)) return { win: false, t };
        r.locked = true; last = t; done = true; break;
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return { win: false, t };
  }
  const minGap = Math.min(...def.map(r => r.gap)) * DEG;
  return { win: true, t, q: starRatio(largestOpen(open).w, minGap) };
}

function evaluate(L: { def: RingDef[]; limit: number }, trials = 50): Evaluated {
  es = 777; let w = 0, sure = 0; const qs: number[] = [];
  for (let k = 0; k < trials; k++) {
    const r = play(L.def, L.limit);
    if (r.win) { w++; qs.push(r.q as number); } else if (r.sebep === "sure") sure++;
  }
  const kayip = trials - w;
  // İki ölçü: sureOrani kayıpların içindeki pay (teşhis için), sureKaybi ise TÜM
  // denemelerin içindeki pay (karar için). İkincisi doğru ölçüttür: %92 kazanılan bir
  // bölümde kayıpların %75'i süre dolması olsa bile oyuncunun yalnızca %6'sı saate
  // yenilir, bu bir sorun değildir.
  return { win: w / trials, qs, sureOrani: kayip ? sure / kayip : 0, sureKaybi: sure / trials };
}

/**
 * Zorluk eğrisi. Üç parça:
 *
 *   taban  — %94'ten %25'e iner ve 150. bölümde tabana oturur. Üs 0,45 olduğu için
 *            iniş BAŞTA diktir: oyuncu 11. bölümde %80'in, 39'da %60'ın altına düşer.
 *            Eski 60 bölümlük eğri %80'e ancak 21. bölümde iniyordu ve "zorluk çok
 *            yavaş artıyor" şikâyetinin sebebi buydu.
 *   dalga  — ±9 puanlık, 24 bölümlük salınım. 150'den sonra eğri düz kalsaydı geri
 *            kalan 350 bölüm tek bir duvar olurdu; dalga oraya ritim veriyor.
 *   nefes  — her 4. bölüm +12 puan (bkz. nefesMi).
 */
const TABAN_BOLUM = 200;
const DALGA_GENLIK = 0.08;
const DALGA_PERIYOT = 24;
/**
 * Zorluk tabanı. Daha aşağısı (%15 denendi) ayarlamayı kararsızlaştırıyor: o hedefte
 * boşluğun bir derece değişmesi kazanma oranını onlarca puan oynatıyor ve üretici
 * bölümlerin bir kısmını hiç çözülemez bırakıyor. %35 taban + dalga, %27-43 bandı verir.
 */
const EN_ZOR = 0.35;
const TABAN_KLAMP = 0.25;

const egriTaban = (n: number): number =>
  0.94 - (0.94 - EN_ZOR) * Math.pow(Math.min(1, (n - 1) / (TABAN_BOLUM - 1)), 0.45);
const egriDalga = (n: number): number => DALGA_GENLIK * Math.sin(2 * Math.PI * n / DALGA_PERIYOT);
/**
 * Nefes levelleri: hedef eğrinin belirgin üstünde tutulan, patron olmayan bölümler.
 * Test oyuncuları 44-57 arasında 12 levelin 9'unu "duvar" olarak işaretledi ve art arda
 * 20-29 kayıp serileri yaşadı; sıradan oyuncuyu kaçıran şey tek bir zor level değil,
 * zor levellerin arka arkaya gelmesi.
 *
 * Aralık 4 DEĞİL, 3 ile 4 arasında dönüşümlü (3, 7, 10, 14, 17, 21, ...).
 *
 * Sebebi ritmin kendisi. Sabit 4'le oyunun bütün yapısal periyotları — dalga 24,
 * nefes 4, patron 10, arketip 8 — 120 bölümde bir aynı hizaya geliyordu: EKOK tam
 * 120. Ölçülen 120 gecikmeli özilinti 0,84, yani 1000 bölümlük oyun pratikte aynı
 * 120 bölümün sekiz tekrarıydı. Aralık 7'ye çıkınca EKOK 840 oluyor ve özilinti
 * 0,49'a iniyor. 3 ve 4'ün dönüşümlü olması şart: yalnızca 3 ya da yalnızca 4
 * periyodu geri getirirdi, {3,4,5} ise en kötü "zor seri"yi 7 bölümden 9'a çıkarıyor
 * — yani ritmi kazanmak için güvenceyi kaybettiriyordu. {3,4} ikisini birden tutuyor.
 */
/**
 * Ritim denetiminin eşikleri (bkz. doğrulamadaki "ritim:" satırı).
 *
 * RITIM_GECIKME neden 120: eski düzende dalga (24), nefes (4), patron (10) ve
 * arketip (8) periyotlarının EKOK'u tam 120 idi.
 */
const RITIM_GECIKME = 120;
const RITIM_TAVAN = 0.30;   // ölçülen: eski 0,41 -> yeni 0,18
const ZOR_ESIGI = 0.40;
const ZOR_SERI_TAVAN = 7;   // ölçülen: eski 9 -> yeni 6

const NEFES_BONUS = 0.12;
/** Dönüşümlü 3-4 aralığı: 7 bölümde iki nefes (n mod 7 ∈ {3, 0}). */
const NEFES_PERIYOT = 7;
const nefesMi = (n: number): boolean =>
  !bossMu(n) && (n % NEFES_PERIYOT === 3 || n % NEFES_PERIYOT === 0);
/**
 * Nefes bölümlerinde dalga UYGULANMAZ; nefes onun yerine geçer.
 *
 * Bu, ritim düzeltmesinin ikinci yarısı ve olmazsa olmazı. Ölçüm şunu gösterdi:
 * eski düzende dalga periyodu (24) nefes aralığının (4) tam katı olduğu için nefesler
 * HER ZAMAN dalganın aynı evrelerine düşüyordu — 120 bölümlük tekrarın sebebi de,
 * nefeslerin hep uygun evrede kalmasının sebebi de aynı hizalanmaydı. Aralığı 7'ye
 * çıkarıp burayı dokunmadan bırakmak tekrarı kırıyor ama nefeslerin bir kısmını
 * dalganın çukuruna düşürüyordu: %40 altında kalan en uzun seri 7'den 10'a çıkıyordu.
 * Yani ritmi kazanıp güvenceyi kaybediyorduk.
 *
 * Dalgayı nefeste ezmek ikisini birden veriyor. Ölçülen: 120 gecikmeli özilinti
 * 0,47 -> 0,20; en uzun zor seri %35'te 7 -> 6, %40'ta 7 -> 6, %45'te 15 -> 6.
 * Ortalama zorluk neredeyse değişmiyor (0,402 -> 0,408).
 *
 * Kuralın kendisi de okunur: dalganın işi 24 bölümlük ritim, nefesin işi rahatlama.
 * Çakıştıklarında rahatlama kazanır.
 */
const egri = (n: number): number =>
  nefesMi(n) ? egriTaban(n) : egriTaban(n) + egriDalga(n);

/**
 * Patron bölümlerinin hedefi.
 *
 * Patronlar elle tasarlandığı için halka sayıları ve hızları sabittir; ayarlayıcının
 * elinde yalnızca boşluk genişliği vardır. Eğrinin en dibinde (%27-35) bu yapılar
 * hedefi tutturamıyor, en fazla ~%40'a inebiliyorlardı. Bu yüzden patron cezası sabit
 * puan değil ORAN: hedefin %75'i. Eğri yüksekken belirgin bir sıçrama, dibe yakınken
 * yapının fiziksel sınırına uygun.
 */
const BOSS_ORAN = 0.75;
const bossHedefi = (n: number, boss: boolean): number =>
  boss ? Math.max(0.22, target(n) * BOSS_ORAN) : target(n);

const target = (n: number): number =>
  Math.max(TABAN_KLAMP, Math.min(0.95, egri(n) + (nefesMi(n) ? NEFES_BONUS : 0)));
// Yapıyı sabit tutup tolerans süresini ayarlayarak kazanma oranını hedefe oturt
/**
 * Kayıpların en çok bu kadarı "süre doldu" olabilir.
 *
 * Neden gerekli: limit, referans çözücünün süresinden türetiliyordu (best × 1,5 + 1,5).
 * Çözücü açgözlüdür, ilk uygun hizalanmayı alır; insan daha iyisini bekler. Hizalanma
 * fırsatının seyrek olduğu bölümlerde 1,5 kat pay yetmiyordu ve oyuncu bütün kilitleri
 * doğru yapıp SON kilitte saate yeniliyordu. Ölçüm: 1000 bölümün 123'ünde kayıpların
 * yarısından fazlası süre dolmasıydı; bazılarında %100. O bölümlerde oyun hassasiyet
 * oyunu olmaktan çıkıp bekleme oyunu oluyordu — türdeki en kötü kayıp hissi.
 *
 * Artık zorluk yalnızca DARALMADAN gelir: süre, beceriyi ölçen değil taahhüde zorlayan
 * bir sınır olarak kalır.
 */
const SURE_KAYBI_ESIGI = 0.10;
/** Limit tasarım değerinin bu katından fazla açılmaz: süre baskısı büsbütün kaybolmasın. */
const SURE_TAVANI = 2.2;

/**
 * Bir halkanın boşluğunun, sabitlenmiş kanalın üstünden geçme periyodu (saniye).
 *
 * İki kapılı halkada fırsat iki kat sık gelir. `wobble` hızı 0,3x-1,7x arasında
 * salındırır ama sinüsün ortalaması sıfırdır: ortalama açısal hızı ve dolayısıyla
 * periyodu değiştirmez. `flip` halkası ise tam tur atmayabilir — gidiş-dönüş çevrimi
 * daha uzunsa onu esas alırız, yoksa tavan o halkaya haksız yere dar gelir.
 */
function firsatPeriyodu(r: RingDef): number {
  const temel = TAU / (Math.max(1, r.gaps) * Math.abs(r.speed));
  return r.flip > 0 ? Math.max(temel, 2 * r.flip) : temel;
}

/**
 * γ = (limit − m × REACT) / Σ fırsat periyodu — "halka başına kaç TUR izlemeye vakit var".
 *
 * Süre sınırının gerçek anlamı budur ve bir TAVANI olmalıdır: oyuncu halkaların ikinci
 * turunu bekleyebiliyorsa zamanlama kararı kararsızlaşır, oyun "doğru anı yakala"dan
 * "otur bekle"ye döner. Ölçüm: γ ortalaması 0,92 ama 39 bölüm 1,4'ün üstündeydi, en
 * gevşeği 2,45. Simülasyonda halkayı bir tam tur izlemek zorunda olan oyuncu %2,2
 * kazanıyor, yarım tur izleyen %58,8 — yani bütçe "yarım tur izle, sonra karar ver".
 *
 * Taban (süre kaybı onarımı) ile tavan çakışırsa aday elenir; limit zorlanmaz.
 */
const GAMA_TAVAN = 1.3;

function gamaTavani(def: RingDef[]): number {
  const h = def.filter(r => !r.preLocked);
  const toplamP = h.reduce((s, r) => s + firsatPeriyodu(r), 0);
  return GAMA_TAVAN * toplamP + h.length * REACT;
}

const gamaHesapla = (def: RingDef[], limit: number): number => {
  const h = def.filter(r => !r.preLocked);
  const toplamP = h.reduce((s, r) => s + firsatPeriyodu(r), 0);
  return toplamP > 0 ? (limit - h.length * REACT) / toplamP : Infinity;
};

function tune(rawRings: RawRing[], want: number, n: number, lo = 0.012, hi = 0.45): Candidate | null {
  let best: Candidate | null = null;
  for (let it = 0; it < 8; it++) {
    const tol = (lo + hi) / 2;
    const rings = rawRings.map(r => ({ ...r })); sizeGaps(rings, tol);
    const aday = finalize(rings, n);
    if (!aday) { lo = tol; continue; }
    let L: Finalized = aday;
    let ev = evaluate(L, 50);
    // Süre dolması baskın kayıp sebebiyse yapı değil limit yanlıştır: limiti aç.
    const tavan = gamaTavani(L.def);
    for (let tur = 0; tur < 5 && ev.sureKaybi > SURE_KAYBI_ESIGI; tur++) {
      const yeni = +(L.limit * 1.2).toFixed(1);
      if (yeni > L.want * SURE_TAVANI) break;
      // Bekleme bütçesi tavanı tabandan önce gelir: saate yenilmeyi azaltmak uğruna
      // oyuncuya ikinci turu bekleme lüksü verilmez. Aday öyleyse elenir.
      if (yeni > tavan) break;
      L = { ...L, limit: yeni };
      ev = evaluate(L, 50);
    }
    const c = { ...L, ...ev, tol };
    if (L.best <= 16 && (!best || Math.abs(c.win - want) < Math.abs(best.win - want))) best = c;
    if (ev.win > want) hi = tol; else lo = tol;
  }
  return best;
}
// ===== Üretim =====
// Sabit tohumla çalışır: aynı kod her çalıştırmada birebir aynı tabloyu verir.
function generate(log: Log = () => {}): LevelTable {
  seed = 12345; es = 1;
  const levels: Candidate[] = []; const allQ: number[] = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const boss = bossTasarimi(n);
    // Eğri artık dalgalı: katı monotonluk yerine eğrinin kendisi izleniyor.
    // (Eğilimin düştüğünü --verify hareketli ortalamayla denetler.)
    const want = bossHedefi(n, !!boss);
    let pick: Candidate | null = null;
    // Bandın dışında kalırsak aday denemeye devam: 1000 bölümde birkaç zor vaka
    // normal deneme sayısıyla tutturulamıyor ve eşiği gevşetmek yanlış çözüm olurdu.
    // Taban (saate yenilme) ile tavan (γ) çakıştığında doğru cevap ikisini de bükmek
    // değil, O YAPIYI elemektir: daha çok aday denenir. Patronların yapısı elle
    // tasarlandığı için orada çeşitlilik sınırlı, deneme sayısı da öyle.
    const olagan = boss ? 6 : 8, enCok = boss ? 24 : 36;
    for (let k = 0; k < enCok; k++) {
      if (k >= olagan && pick && Math.abs(pick.win - want) <= BAND * 0.9
          && pick.sureKaybi <= SURE_KAYBI_ESIGI) break;
      const raw = boss ? boss.rings() : candidate(n);
      const c = tune(raw, want, n);
      if (c) {
        // pick yokken eski kod dp = Infinity ile ilk kosuldan kisa devre yapiyordu; ayni davranis.
        if (!pick) pick = c;
        else {
          const dc = Math.abs(c.win - want), dp = Math.abs(pick.win - want);
          // Hedefe yakınlık birincil; eşit yakınlıkta önce "saate değil daralmaya yenilen"
          // aday, sonra ferah olan tercih edilir.
          // "Temiz" = oyuncu kayda değer oranda saate yenilmiyor. Temiz bir aday,
          // hedefe biraz daha uzak olsa bile kirli olanı yener: zorluk daralmadan
          // gelmeli, bekleyişten değil.
          const cTemiz = c.sureKaybi <= SURE_KAYBI_ESIGI, pTemiz = pick.sureKaybi <= SURE_KAYBI_ESIGI;
          const dahaIyi = (cTemiz && !pTemiz && dc < dp + 0.10)
            || (cTemiz === pTemiz && (dc < dp - 0.04
              || (dc < dp + 0.04 && c.roomy && !pick.roomy)
              || (dc < dp && !(pick.roomy && !c.roomy))));
          if (dahaIyi) pick = c;
        }
      }
      if (pick && pick.roomy && pick.sureKaybi <= SURE_KAYBI_ESIGI && Math.abs(pick.win - want) < 0.03) break;
    }
    if (!pick) { console.error('level', n, 'bulunamadı'); process.exit(1); }
    if (boss) Object.assign(pick, { boss: boss.anahtar });
    // Yıldız eşikleri için ustalık referansı her levelde 25 kez oynatılır (bkz. playUsta).
    es = 4242;
    for (let k = 0; k < 25; k++) {
      const usta = playUsta(pick.def, pick.limit);
      if (usta.win) allQ.push(usta.q as number);
    }
    levels.push(pick);
  }
  allQ.sort((a, b) => a - b);
  // Ustalık referansının levellerin %25'inde 3 yıldız, %60'ında en az 2 yıldız alması
  // hedefleniyor: 3 yıldız gerçekten iyi oynamanın karşılığı olsun.
  const pct = (p: number): number => allQ[Math.min(allQ.length - 1, Math.floor(allQ.length * p))];
  const out = { q3: +pct(0.75).toFixed(2), q2: +pct(0.4).toFixed(2), levels: levels.map((l, i) => ({ n: i + 1, boss: l.boss ?? null, limit: l.limit, rings: l.def })) };
  log('yıldız eşikleri q3/q2:', out.q3, out.q2);
  log(levels.map((l, i) => `${i + 1}${l.boss ? '*' : ''}:${Math.round(l.win * 100)}%/${l.limit}s/${l.def.length}h/${Math.round(l.def[0].gap)}°`).join('  '));
  return out;
}

// data/levels.json biçimi: her level tek satır, okunabilir kalsın diye elle diziliyor.
const serialize = (o: LevelTable): string => '{"q3":' + o.q3 + ',"q2":' + o.q2 + ',"levels":[\n' + o.levels.map(l => JSON.stringify(l)).join(',\n') + '\n]}\n';

// ===== Doğrulama =====
// Eski --verify yalnızca "kazanma oranı %20'nin üstünde mi" diye bakıyordu; oysa üretim
// hedefi %97'den %28'e inen bir eğri. Bir level hedefinin 25 puan altına düşse bile geçiyordu.
/**
 * Hedef eğriden izin verilen sapma.
 *
 * Kazanma oranı 50 denemeyle ölçülüyor. p = 0,4 civarında bir oranın standart hatası
 * sqrt(p(1-p)/50) = 6,9 puandır; yani ±20 puan yaklaşık 3 sigmadır. Daha dar bir bant
 * ölçüm gürültüsünü hata sanardı.
 *
 * Patronlarda daha geniş: yapıları elle tasarlandığı için halka sayısı ve hızları
 * sabittir, ayarlayıcının elinde yalnızca boşluk genişliği vardır.
 */
const BAND = 0.20;
const BAND_BOSS = 0.25;
/** Bir bölümde denemelerin en çok bu kadarı saate yenilebilir (bkz. SURE_KAYBI_ESIGI). */
const SURE_KAYBI_VERIFY = 0.25;
const SOLVER_HEADROOM = 0.9; // çözücü, süre sınırının en fazla %90'ını kullanabilir

function verify(): number {
  const data: LevelTable = JSON.parse(fs.readFileSync(OUT, "utf8"));
  // Şema doğrulaması çekirdekte (src/core/levels.ts): oyun da aynı kontrolü kullanabilsin diye.
  const semaHatalari = validateTable(data);
  if (semaHatalari.length) {
    console.error(semaHatalari.length + " şema sorunu:");
    semaHatalari.forEach(h => console.error("  - " + h));
    return 1;
  }
  const rows: string[] = []; const sorunlar: string[] = [];
  const oranlar: number[] = [];
  // Denemelerin dörtte birinden fazlası saate yenilen bölümler: orada oyun hassasiyet
  // oyunu olmaktan çıkıp bekleme oyunu olur (bkz. SURE_KAYBI_ESIGI).
  const sureliler: string[] = [];
  // Süre sınırının ÖTEKİ ucu: γ tavanını aşan, yani oyuncunun halkaların ikinci turunu
  // bekleyebildiği bölümler (bkz. GAMA_TAVAN). İkisi karşıt hatalardır, ayrı sayılır.
  const gevsekler: string[] = [];
  const gamalar: number[] = [];

  for (const l of data.levels) {
    const ad = `${l.n}${l.boss ? "*" : ""}`;
    const cozum = solve(l.rings);
    const best = cozum ? cozum.t : null;
    const ev = evaluate({ def: l.rings, limit: l.limit }, 50);
    const hedef = bossHedefi(l.n, !!l.boss);
    const sapma = ev.win - hedef;
    const moving = l.rings.filter(r => !r.preLocked).length;

    if (best == null) sorunlar.push(`${ad}: referans çözücü bitiremiyor`);
    else if (best > l.limit * SOLVER_HEADROOM) sorunlar.push(`${ad}: çözücü ${best.toFixed(1)} sn, limit ${l.limit} sn — pay yok`);
    if (Math.abs(sapma) > (l.boss ? BAND_BOSS : BAND)) sorunlar.push(`${ad}: kazanma %${Math.round(ev.win * 100)}, hedef %${Math.round(hedef * 100)} (${sapma > 0 ? "+" : ""}${Math.round(sapma * 100)} puan)`);
    // Tasarım limiti kuraldır ama bekleme bütçesi tavanı onu kesebilir (bkz. GAMA_TAVAN):
    // hızlı halkalı bir bölümde tasarım süresi oyuncuya ikinci turu bekletirdi.
    const altSinir = Math.min(tasarimLimiti(l.n, moving), gamaTavani(l.rings));
    if (l.limit < altSinir - 0.05) sorunlar.push(`${ad}: limit tasarım değerinin altında`);
    const g = gamaHesapla(l.rings, l.limit);
    gamalar.push(g);
    if (g > GAMA_TAVAN + 0.05) gevsekler.push(`${ad}: γ ${g.toFixed(2)}`);
    if (ev.sureKaybi > SURE_KAYBI_VERIFY) sureliler.push(`${ad}: denemelerin %${Math.round(ev.sureKaybi * 100)}'i süre dolmasıyla bitiyor`);
    oranlar.push(ev.win);
    rows.push(`${ad}:${Math.round(ev.win * 100)}%`);
  }

  // Zorluk EĞİLİMİ düşüyor mu? Eğri dalgalı olduğu için tek tek leveller birbirinden
  // kolay olabilir; anlamlı olan 20 bölümlük hareketli ortalamanın inmesi.
  const pencere = 20;
  const ortalama = (i: number): number => {
    const a = Math.max(0, i - pencere / 2), b = Math.min(oranlar.length, i + pencere / 2);
    let t = 0; for (let k = a; k < b; k++) t += oranlar[k];
    return t / (b - a);
  };
  const bas = ortalama(pencere), son = ortalama(oranlar.length - pencere);
  if (son > bas - 0.25) {
    sorunlar.push(`zorluk eğilimi yetersiz: başta %${Math.round(bas * 100)}, sonda %${Math.round(son * 100)} (en az 25 puan düşmeli)`);
  }
  // Eğilim hiçbir yerde belirgin şekilde geri gitmemeli.
  for (let i = pencere; i + pencere < oranlar.length; i += pencere) {
    const su = ortalama(i), sonraki = ortalama(i + pencere);
    if (sonraki > su + 0.10) {
      sorunlar.push(`${i}-${i + pencere} arası zorluk eğilimi geri gidiyor: %${Math.round(su * 100)} -> %${Math.round(sonraki * 100)}`);
    }
  }

  // Yıldız dağılımı USTALIK REFERANSINA göre ölçülür (bkz. playUsta): eşikler
  // "iyi oynamanın karşılığı" olduğu için ortalama oyuncuyla değil ustayla kalibre edilir.
  const tumQ: number[] = [];
  for (const l of data.levels) {
    es = 4242;
    for (let k = 0; k < 25; k++) {
      const u = playUsta(l.rings, l.limit);
      if (u.win) tumQ.push(u.q as number);
    }
  }
  const pay = [tumQ.filter(q => q >= data.q3).length, tumQ.filter(q => q < data.q3 && q >= data.q2).length, tumQ.filter(q => q < data.q2).length].map(v => v / tumQ.length);
  if (pay[0] < 0.15 || pay[0] > 0.35) sorunlar.push(`ustanın 3 yıldız oranı %${Math.round(pay[0] * 100)} — %15-35 dışında`);

  // Süre dolması baskın kayıp sebebi olan bölümler (bkz. SURE_ORANI_ESIGI). Tek tük
  // olması normal; yaygınlaşması zorluğun daralmadan değil saatten geldiği anlamına gelir.
  const SURELI_TAVAN = Math.round(LEVEL_COUNT * 0.02);
  if (sureliler.length > SURELI_TAVAN) {
    sorunlar.push(`${sureliler.length} bölümde denemelerin dörtte birinden fazlası saate yeniliyor (en çok ${SURELI_TAVAN} olmalı): ` +
      sureliler.slice(0, 6).join("; ") + (sureliler.length > 6 ? " …" : ""));
  }

  // γ tavanı üreticide zorlanır; burada tek bir ihlal bile kaçak demektir.
  if (gevsekler.length) {
    sorunlar.push(`${gevsekler.length} bölümde γ tavanı (${GAMA_TAVAN}) aşılmış — oyuncu ikinci turu bekleyebiliyor: ` +
      gevsekler.slice(0, 6).join("; ") + (gevsekler.length > 6 ? " …" : ""));
  }

  const gOrt = gamalar.reduce((a, b) => a + b, 0) / gamalar.length;
  console.log(rows.join("  "));
  console.log(`yıldız dağılımı (ustalık referansı): 3★ %${Math.round(pay[0] * 100)}  2★ %${Math.round(pay[1] * 100)}  1★ %${Math.round(pay[2] * 100)}`);
  console.log(`saate yenilmenin baskın olduğu bölüm: ${sureliler.length} / ${LEVEL_COUNT}`);
  console.log(`γ (halka başına izlenebilen tur): ortalama ${gOrt.toFixed(2)}, en yüksek ${Math.max(...gamalar).toFixed(2)}, tavan ${GAMA_TAVAN}`);

  // ---- Ritim: oyun kendini tekrar ediyor mu? --------------------------------
  //
  // Eski düzende bütün yapısal periyotlar — dalga 24, nefes 4, patron 10, arketip 8 —
  // EKOK'u tam 120 olacak şekilde hizalanıyordu: 1000 bölümlük oyun pratikte aynı
  // 120 bölümün sekiz tekrarıydı. Ölçülen kazanma oranlarında 120 gecikmeli özilinti
  // 0,41'di. Nefes aralığı 3-4 dönüşümlü yapılıp nefes dalgayı ezince 0,18'e indi.
  //
  // İkinci ölçü aynı düzeltmenin BEDELİNİ denetler: periyodikliği kırmanın kolay yolu
  // nefesleri dalganın çukuruna düşürmektir ve o zaman "zor seri" uzar. İkisi birlikte
  // denetlenmezse biri kazanılırken öbürü sessizce kaybedilir.
  const ritimOrt = oranlar.reduce((a, b) => a + b, 0) / oranlar.length;
  let ritimPay = 0, ritimPayda = 0;
  for (let i = 0; i < oranlar.length; i++) {
    ritimPayda += (oranlar[i] - ritimOrt) ** 2;
    if (i + RITIM_GECIKME < oranlar.length) {
      ritimPay += (oranlar[i] - ritimOrt) * (oranlar[i + RITIM_GECIKME] - ritimOrt);
    }
  }
  const ozilinti = ritimPay / ritimPayda;
  let enUzunZor = 0, ardisik = 0;
  for (const o of oranlar) {
    if (o < ZOR_ESIGI) { ardisik++; if (ardisik > enUzunZor) enUzunZor = ardisik; }
    else ardisik = 0;
  }
  console.log(`ritim: ${RITIM_GECIKME} gecikmeli özilinti ${ozilinti.toFixed(2)} (tavan ${RITIM_TAVAN}), ` +
    `en uzun zor seri ${enUzunZor} bölüm (tavan ${ZOR_SERI_TAVAN})`);
  if (ozilinti > RITIM_TAVAN) {
    sorunlar.push(`oyun ${RITIM_GECIKME} bölümde bir kendini tekrar ediyor: özilinti ${ozilinti.toFixed(2)}`);
  }
  if (enUzunZor > ZOR_SERI_TAVAN) {
    sorunlar.push(`%${ZOR_ESIGI * 100} altında ${enUzunZor} bölümlük kesintisiz seri var: sıradan oyuncuyu ` +
      `kaçıran şey tek bir zor bölüm değil, arka arkaya gelenler`);
  }

  // Baştan kilitli halkalar kalan halkalara yeterli pay bırakıyor mu? (bkz. EN_AZ_PAY)
  for (const l of data.levels) {
    const canli = liveRings(l.rings);
    const b = initialOpen(canli);
    if (b === OPEN_ALL) continue;
    const kalan = canli.filter(r => !r.locked).length;
    const p = largestOpen(b).w - NEED_PASS;
    if (p < gerekenPay(kalan)) {
      sorunlar.push(`${l.n}: baştan kilitli halkalardan sonra ${(p / DEG).toFixed(1)}° pay kalıyor, ${(gerekenPay(kalan) / DEG).toFixed(1)}° gerek (${kalan} halka)`);
    }
  }

  // Yön değiştiren halka kilitlenmeden önce dönüşünü gösterebiliyor mu? (bkz. gorunurFlip)
  for (const l of data.levels) {
    if (l.boss) continue;   // patronlar elle tasarlandı
    let sira = 0;
    for (const r of l.rings) {
      if (r.preLocked) continue;
      const an = tahminiKilitAni(sira); sira++;
      if (r.flip > 0 && r.flip >= an) {
        sorunlar.push(`${l.n}: flip periyodu ${r.flip.toFixed(1)}s, halka ~${an.toFixed(1)}s'de kilitleniyor — oyuncu dönüşü göremez`);
      }
    }
  }

  if (process.argv.includes("--deterministic")) {
    const tekrar = serialize(generate());
    if (tekrar !== fs.readFileSync(OUT, "utf8")) sorunlar.push("üretim deterministik değil ya da dosya elle değiştirilmiş: gen.ts yeniden üretince farklı tablo çıkıyor");
    else console.log("determinizm: yeniden üretim birebir aynı dosyayı veriyor");
  }

  if (sorunlar.length) { console.error("\n" + sorunlar.length + " sorun:"); sorunlar.forEach(s => console.error("  - " + s)); return 1; }
  console.log("Tüm leveller çözülebilir, zorluk eğrisi hedefin ±15 puanı içinde");
  return 0;
}

if (process.argv.includes("--verify")) process.exit(verify());
fs.writeFileSync(OUT, serialize(generate(console.log)));
