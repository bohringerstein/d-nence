// Kasa level üretici. Kullanım:
//   npm run gen           -> data/levels.json dosyasını yeniden üretir (sabit tohum, her seferinde aynı sonuç)
//   npm run verify        -> mevcut tabloyu denetler
//   npm run verify:full   -> üstüne determinizmi de sınar
import fs from "node:fs";
import path from "node:path";
import {
  TAU, DEG, NEED, NEED_PASS, SOLVER_MARGIN, REACT, GAP_MAX_DEG,
  canPass, stepRings, liveRings, validateTable, solve,
  OPEN_ALL, lockOpen, peekOpen, largestOpen, initialOpen, starRatio
} from "../src/core/index.ts";
import type { RingDef, Level, LevelTable } from "../src/core/index.ts";

/** Üretim sırasındaki ham halka: tanıma gapScale eklenir, gap'i sizeGaps hesaplar. */
interface RawRing extends RingDef { gapScale?: number }

interface PlayResult { win: boolean; t: number; q?: number }
interface Finalized { def: RingDef[]; best: number; limit: number; want: number; roomy: boolean }
interface Evaluated { win: number; qs: number[] }
type Candidate = Finalized & Evaluated & { tol: number; boss?: string; hint?: string };
interface Boss { name: string; hint: string; tol: number; rings: () => RawRing[] }
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

// Hata payı milisaniye cinsinden: boşluk = gereken açıklık + tolerans süresi × tüm hareketli halkaların hızı toplamı.
// Halkalar bu ortak genişliği kendi gapScale çarpanıyla ölçekler: dar halka "dikkat et", geniş halka
// "burada nefes alabilirsin" der. Ortalama tolerans korunur, zorluğu tune() yine hedefe oturtur.
function sizeGaps(rings: RawRing[], tolSec: number): void {
  const vsum = rings.filter(r => !r.preLocked).reduce((s: number, r) => s + Math.abs(r.speed) * (r.wobble ? 1.7 : 1), 0);
  const base = NEED / DEG + tolSec * vsum / DEG;
  for (const r of rings) {
    const gap = Math.min(base * (r.gapScale || 1), GAP_MAX);
    r.gap = gap;
    if (r.gaps === 2 && (gap > 80 || r.gapOffset < gap + 30 || 360 - r.gapOffset < gap + 30)) r.gaps = 1;
  }
}

const GAP_MAX = GAP_MAX_DEG;
// 17. levelden sonra halka sayısı 6'da sabitleniyordu; 60 levelin 41'i aynı yapıdaydı.
// Bu ritim araya daha az halkalı ama daha dar boşluklu (hassasiyet isteyen) leveller serpiştirir.
const RHYTHM = [6, 6, 5, 6, 4, 6, 5, 6];
const ringCount = (n: number): number => { const grow = Math.min(2 + Math.floor((n - 1) / 4), 6); return grow < 6 ? grow : RHYTHM[(n - 1) % RHYTHM.length]; };
// Süre limiti artık tasarım girdisi: hareketli halka sayısından gelir ve geç levellerde kademeli sıkılaşır.
// Çözücü süresi limiti belirlemez, yalnızca "bu limit yeterli mi" diye denetlenir.
const limitFor = (n: number, moving: number): number => +((4 + 2 * moving) * (1 - 0.22 * ((n - 1) / 59))).toFixed(1);

function candidate(n: number): RawRing[] {
  const count = ringCount(n);
  const base = Math.min(0.8 + n * 0.03, 2.2);
  const rings: RawRing[] = [];
  for (let i = 0; i < count; i++) {
    const dir = n < 3 ? 1 : (R() < 0.5 ? -1 : 1);
    rings.push({ speed: dir * base * (0.7 + R() * 0.6), gap: 0, gapScale: 0.82 + R() * 0.36, gaps: n >= 11 && R() < 0.3 ? 2 : 1, gapOffset: 130 + R() * 50,
      flip: n >= 12 && R() < Math.min(0.2 + n * 0.008, 0.45) ? 1.4 + R() * 1.8 : 0, wobble: n >= 18 && R() < 0.3, preLocked: false, start: R() * TAU });
  }
  if (n >= 6 && R() < 0.5) {
    const pre = n >= 15 && count >= 4 && R() < 0.5 ? 2 : 1, anchor = R() * TAU, picks: number[] = [];
    while (picks.length < pre) { const k = Math.floor(R() * count); if (!picks.includes(k)) picks.push(k); }
    picks.forEach((k, j) => { Object.assign(rings[k], { preLocked: true, gaps: 1, flip: 0, wobble: false, start: anchor + (j ? (R() - 0.5) * 0.15 : 0) }); });
  }
  // Bosluk genisligini tune() belirler; burada hesaplamak gereksizdi ve yan etkisi
  // (gap > 80 ise gaps 2 -> 1) uretilen iki kapili halkalarin %80'ini yok ediyordu.
  return rings;
}

// ===== Patron levelleri (elle tasarlandı) =====
const A = -Math.PI / 2;
// speed ve start varsayilanlari hicbir cagrida kullanilmaz; yalnizca tip tamligi icin.
const mk = (o: Partial<RawRing>): RawRing =>
  ({ speed: 0, start: 0, gap: 0, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, ...o });
const BOSSES: Record<number, Boss | undefined> = {
  10: { name: 'Ayna', hint: 'Hepsi aynı anda hizalanıyor, o anı bekle ve hızlı dokun', tol: 0.2,
    // Hizlar birbirinden farkli olmali: esit hiz + esit start = birebir ayni halka, o kilit acikligi hic daraltmaz.
    // start = A - s * 2.5 oldugu icin hepsi yine t = 2,5 sn'de A acisinda hizalanir.
    rings: () => [1.3, -1.3, 1.9, -1.9].map(s => mk({ speed: s, start: A - s * 2.5 })) },
  20: { name: 'Merkez', hint: 'Ortadaki kilitli halka yolu gösteriyor', tol: 0.15,
    rings: () => [2.0, -1.4, 0, 1.4, -2.0].map((s, i) => mk(i === 2 ? { speed: 1, preLocked: true, start: A } : { speed: s, start: R() * TAU })) },
  30: { name: 'Metronom', hint: 'Halkalar sallanıyor, orta noktadan geçerken yakala', tol: 0.13,
    rings: () => [1.5, -1.6, 1.4, -1.5, 1.6].map(s => mk({ speed: s, flip: 1.2, start: A - s * 0.6 + (R() - 0.5) * 0.4 })) },
  40: { name: 'Çatal', hint: 'Her halkada iki kapı var, hangisini seçtiğin sonrakini belirler', tol: 0.12,
    rings: () => [1.2, -1.5, 1.3, -1.1, 1.6].map(s => mk({ speed: s, gaps: 2, gapOffset: 150 + R() * 30, start: R() * TAU })) },
  50: { name: 'Tavşan ile kaplumbağa', hint: 'Yavaşlar sabırlı, hızlılar keskin nişan ister', tol: 0.11,
    rings: () => [0.5, -2.4, 0.6, -2.5, 0.5, -2.3].map(s => mk({ speed: s, start: R() * TAU })) },
  60: { name: 'Büyük kasa', hint: 'Son kasa. Her şey bir arada', tol: 0.11,
    rings: () => [mk({ speed: 1, preLocked: true, start: A }), mk({ speed: -1.9, flip: 2.1, start: R() * TAU }), mk({ speed: 1.6, gaps: 2, gapOffset: 165, start: R() * TAU }),
      mk({ speed: -1.4, wobble: true, start: R() * TAU }), mk({ speed: 2.1, flip: 1.7, start: R() * TAU }), mk({ speed: -1.7, start: R() * TAU })] }
};

function finalize(rings: RawRing[], n: number): Finalized | null {
  const def = rings.map(r => ({ speed: rnd4(r.speed), gap: rnd4(r.gap), gaps: r.gaps, gapOffset: rnd4(r.gapOffset), flip: rnd4(r.flip), wobble: r.wobble, preLocked: r.preLocked, start: rnd4(((r.start % TAU) + TAU) % TAU) }));
  const cozum = solve(def); if (!cozum) return null;
  const best = cozum.t;
  const moving = def.filter(r => !r.preLocked).length;
  const want = limitFor(n, moving);
  // Tasarım limiti kural; çözücü sığmıyorsa aday zaten elenir (bkz. tune), ama son çare olarak
  // limit yine de çözücünün üstünde kalır ki level bitirilebilir olsun.
  const limit = +Math.max(want, best * 1.5 + 1.5).toFixed(1);
  return { def, best, limit, want, roomy: best <= want * 0.65 };
}
function evaluate(L: { def: RingDef[]; limit: number }, trials = 50): Evaluated {
  es = 777; let w = 0; const qs: number[] = [];
  for (let k = 0; k < trials; k++) { const r = play(L.def, L.limit); if (r.win) { w++; qs.push(r.q as number); } }
  return { win: w / trials, qs };
}

const target = (n: number): number => 0.97 - 0.57 * Math.pow((n - 1) / 59, 1.1);
// Yapıyı sabit tutup tolerans süresini ayarlayarak kazanma oranını hedefe oturt
function tune(rawRings: RawRing[], want: number, n: number, lo = 0.03, hi = 0.45): Candidate | null {
  let best: Candidate | null = null;
  for (let it = 0; it < 8; it++) {
    const tol = (lo + hi) / 2;
    const rings = rawRings.map(r => ({ ...r })); sizeGaps(rings, tol);
    const L = finalize(rings, n);
    if (!L) { lo = tol; continue; }
    const ev = evaluate(L, 50);
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
  const levels: Candidate[] = []; const allQ: number[] = []; let prev = 1;
  for (let n = 1; n <= 60; n++) {
    const boss = BOSSES[n];
    const want = boss ? target(n) - 0.12 : Math.min(target(n), prev);
    let pick: Candidate | null = null;
    for (let k = 0; k < (boss ? 6 : 8); k++) {
      const raw = boss ? boss.rings() : candidate(n);
      const c = tune(raw, want, n);
      if (c) {
        // pick yokken eski kod dp = Infinity ile ilk kosuldan kisa devre yapiyordu; ayni davranis.
        if (!pick) pick = c;
        else {
          const dc = Math.abs(c.win - want), dp = Math.abs(pick.win - want);
          const dahaIyi = dc < dp - 0.04 || (dc < dp + 0.04 && c.roomy && !pick.roomy) || (dc < dp && !(pick.roomy && !c.roomy));
          if (dahaIyi) pick = c;
        }
      }
      if (pick && pick.roomy && Math.abs(pick.win - want) < 0.03) break;
    }
    if (!pick) { console.error('level', n, 'bulunamadı'); process.exit(1); }
    if (boss) Object.assign(pick, { boss: boss.name, hint: boss.hint }); else prev = Math.min(prev, pick.win + 0.03);
    pick.qs.forEach(q => allQ.push(q));
    levels.push(pick);
  }
  allQ.sort((a, b) => a - b);
  const pct = (p: number): number => allQ[Math.floor(allQ.length * p)];
  const out = { q3: +pct(0.75).toFixed(2), q2: +pct(0.4).toFixed(2), levels: levels.map((l, i) => ({ n: i + 1, boss: l.boss || null, hint: l.hint || null, limit: l.limit, rings: l.def })) };
  log('yıldız eşikleri q3/q2:', out.q3, out.q2);
  log(levels.map((l, i) => `${i + 1}${l.boss ? '*' : ''}:${Math.round(l.win * 100)}%/${l.limit}s/${l.def.length}h/${Math.round(l.def[0].gap)}°`).join('  '));
  return out;
}

// data/levels.json biçimi: her level tek satır, okunabilir kalsın diye elle diziliyor.
const serialize = (o: LevelTable): string => '{"q3":' + o.q3 + ',"q2":' + o.q2 + ',"levels":[\n' + o.levels.map(l => JSON.stringify(l)).join(',\n') + '\n]}\n';

// ===== Doğrulama =====
// Eski --verify yalnızca "kazanma oranı %20'nin üstünde mi" diye bakıyordu; oysa üretim
// hedefi %97'den %28'e inen bir eğri. Bir level hedefinin 25 puan altına düşse bile geçiyordu.
const BAND = 0.15;          // hedef eğriden izin verilen sapma
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
  let oncekiNormal: number | null = null;

  for (const l of data.levels) {
    const ad = `${l.n}${l.boss ? "*" : ""}`;
    const cozum = solve(l.rings);
    const best = cozum ? cozum.t : null;
    const ev = evaluate({ def: l.rings, limit: l.limit }, 50);
    const hedef = l.boss ? target(l.n) - 0.12 : target(l.n);
    const sapma = ev.win - hedef;
    const moving = l.rings.filter(r => !r.preLocked).length;

    if (best == null) sorunlar.push(`${ad}: referans çözücü bitiremiyor`);
    else if (best > l.limit * SOLVER_HEADROOM) sorunlar.push(`${ad}: çözücü ${best.toFixed(1)} sn, limit ${l.limit} sn — pay yok`);
    if (Math.abs(sapma) > BAND) sorunlar.push(`${ad}: kazanma %${Math.round(ev.win * 100)}, hedef %${Math.round(hedef * 100)} (${sapma > 0 ? "+" : ""}${Math.round(sapma * 100)} puan)`);
    if (l.limit < limitFor(l.n, moving) - 0.05) sorunlar.push(`${ad}: limit tasarım değerinin altında`);
    if (!l.boss) {
      if (oncekiNormal != null && ev.win > oncekiNormal + 0.06) sorunlar.push(`${ad}: bir önceki normal levelden belirgin kolay`);
      oncekiNormal = ev.win;
    }
    rows.push(`${ad}:${Math.round(ev.win * 100)}%`);
  }

  // Yıldız dağılımı: eşikler yüzdelikten geldiği için ~%25/%35/%40 çıkmalı
  const tumQ: number[] = data.levels.flatMap((l: Level) => evaluate({ def: l.rings, limit: l.limit }, 30).qs);
  const pay = [tumQ.filter(q => q >= data.q3).length, tumQ.filter(q => q < data.q3 && q >= data.q2).length, tumQ.filter(q => q < data.q2).length].map(v => v / tumQ.length);
  if (pay[0] < 0.15 || pay[0] > 0.35) sorunlar.push(`3 yıldız oranı %${Math.round(pay[0] * 100)} — %15-35 dışında`);

  console.log(rows.join("  "));
  console.log(`yıldız dağılımı: 3★ %${Math.round(pay[0] * 100)}  2★ %${Math.round(pay[1] * 100)}  1★ %${Math.round(pay[2] * 100)}`);

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
