// Çizim: kaybın ekranda açıklanması ve kamaların ayrımı.
//
// Canvas yerine çağrıları kaydeden sahte bir bağlam kullanılır. Ölçülen şey piksel
// değil KARAR: hangi renkle, hangi opaklıkla, dolduruldu mu yoksa yalnızca konturlandı mı.
import test from "node:test";
import assert from "node:assert";
import { newMask, BINS, layout } from "../core/index.ts";
import type { Level } from "../core/index.ts";
import { createLevel } from "./state.ts";
import { ciz, KAMA } from "./render.ts";
import type { Tuval } from "./render.ts";

interface Dolgu { renk: string; alfa: number }
interface Kontur {
  renk: string; alfa: number; kesikli: boolean; kalinlik: number;
  /** Yolun merkeze en yakın noktası (moveTo/lineTo/arc'tan). */
  enYakin: number;
}

function sahteTuval(): { tuval: Tuval; dolgular: Dolgu[]; konturlar: Kontur[] } {
  const dolgular: Dolgu[] = [];
  const konturlar: Kontur[] = [];
  let kesikli = false;
  let yol: number[] = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1,
    lineCap: "butt" as CanvasLineCap, font: "", textAlign: "center" as CanvasTextAlign,
    textBaseline: "middle" as CanvasTextBaseline,
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    save() {}, restore() {}, translate() {}, beginPath() { yol = []; }, closePath() {},
    moveTo(x: number, y: number) { yol.push(Math.hypot(x, y)); },
    lineTo(x: number, y: number) { yol.push(Math.hypot(x, y)); },
    arc(_x: number, _y: number, r: number) { yol.push(r); },
    rect() {}, clearRect() {}, fillRect() {}, fillText() {},
    measureText: (t: string) => ({ width: t.length * 20 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    setLineDash(d: number[]) { kesikli = d.length > 0; },
    fill() { dolgular.push({ renk: String(ctx.fillStyle), alfa: ctx.globalAlpha }); },
    stroke() {
      konturlar.push({ renk: String(ctx.strokeStyle), alfa: ctx.globalAlpha, kesikli,
        kalinlik: ctx.lineWidth, enYakin: Math.min(...yol) });
    }
  };
  const tuval = {
    canvas: {} as HTMLCanvasElement,
    ctx: ctx as unknown as CanvasRenderingContext2D,
    W: 400, H: 700,
    yerlesim: (n: number) => layout(400, 700, n),
    boyutla() {}, birak() {}, sonYari: 0
  } as unknown as Tuval;
  return { tuval, dolgular, konturlar };
}

const RENK = { bg: "#E9EEF0", ink: "#1D3440", ball: "#E89B00", fail: "#E5484D", win: "#2E9E6A", muted: "#5A6E79" };
const SECENEK = { hareketAzalt: true, halkaOpakligi: 0.4 };

const level = (): Level => ({
  n: 5, boss: null, limit: 10,
  rings: [
    { speed: 1, gap: 60, gaps: 1, gapOffset: 180, flip: 0, wobble: false, preLocked: false, start: 0 },
    { speed: -1.2, gap: 60, gaps: 1, gapOffset: 180, flip: 0, wobble: false, preLocked: false, start: 1 }
  ]
});

/** Verilen dilim sayısı kadar açık bir kanal bırakır (1 dilim = 0,5°). */
function kanalKur(s: ReturnType<typeof createLevel>, acikDilim: number): void {
  const m = newMask();
  for (let b = 0; b < BINS; b++) m[b] = 0;
  for (let b = 100; b < 100 + acikDilim; b++) m[b] = 1;
  s.mask = m;
  s.anyLocked = true;
}

test("geçer kama doldurulur, geçmez kama yalnızca kesik konturla çizilir", () => {
  // 60 dilim = 30°, geçiş eşiği 18° -> geçer.
  const g = sahteTuval();
  const s = createLevel(level(), 1);
  kanalKur(s, 60);
  ciz(g.tuval, s, RENK, SECENEK);
  assert.ok(g.dolgular.some(d => d.renk === RENK.ball && Math.abs(d.alfa - 0.35) < 1e-6),
    "geçer kama top rengiyle %35 dolmalı");

  // 20 dilim = 10°, eşiğin altında -> dolgu YOK, kesik kontur VAR.
  const d2 = sahteTuval();
  const s2 = createLevel(level(), 1);
  kanalKur(s2, 20);
  ciz(d2.tuval, s2, RENK, SECENEK);
  assert.ok(!d2.dolgular.some(x => x.renk === RENK.fail),
    "oyun sürerken geçmez kama doldurulmamalı: ayrım dolgu var/yok olmalı");
  assert.ok(d2.konturlar.some(k => k.renk === RENK.fail && k.kesikli),
    "geçmez kama kesik kırmızı konturla işaretlenmeli (renk körlüğü)");
});

test("KAYIPTA daralmış kanal kırmızı DOLU çizilir", () => {
  // Bu türün en kritik saniyesi: oyuncu neden kaybettiğini görmeli. Kamalar eskiden
  // kayıpta tamamen gizleniyordu; "neden" sorusuna cevap veren tek öğe, tam da o soru
  // sorulduğu anda siliniyordu.
  const g = sahteTuval();
  const s = createLevel(level(), 1);
  kanalKur(s, 20);
  s.asama = "crash";
  s.crashRing = 1;
  s.crashPay = 0.05;
  ciz(g.tuval, s, RENK, SECENEK);

  assert.ok(g.dolgular.some(d => d.renk === RENK.fail && d.alfa > 0.2),
    "kayıpta kanal kırmızı dolu olmalı");
  assert.ok(g.konturlar.some(k => k.renk === RENK.fail && k.kesikli),
    "kesik kontur kayıpta da kalmalı");
});

test("hiç kilit yokken kama çizilmez", () => {
  // Kanal ancak ilk kilitle tanımlanır; öncesinde gösterilecek bir şey yok.
  const g = sahteTuval();
  const s = createLevel(level(), 1);
  ciz(g.tuval, s, RENK, SECENEK);
  assert.ok(!g.dolgular.some(d => d.renk === RENK.fail), "kilit yokken kırmızı kama olmaz");
});

test("top kayıpta kırmızı, normalde amber", () => {
  const a = sahteTuval();
  const s1 = createLevel(level(), 1);
  ciz(a.tuval, s1, RENK, SECENEK);
  assert.ok(a.dolgular.some(d => d.renk === RENK.ball), "top amber çizilmeli");

  const b = sahteTuval();
  const s2 = createLevel(level(), 1);
  s2.asama = "crash";
  ciz(b.tuval, s2, RENK, SECENEK);
  assert.ok(b.dolgular.some(d => d.renk === RENK.fail), "kayıpta top kırmızı olmalı");
});

// --- Baştan kilitli halkanın işareti görünür mü? -----------------------------
//
// Regresyon: kare MÜREKKEP rengiyle dolduruluyordu, ama baştan kilitli halka da
// mürekkep rengiyle ve tam opaklıkla çizilir — kare halkanın üstünde görünmez oluyordu.
// 1000 bölümün 431'inde durum buydu ve Level 7'deki ipucu "kareli halka baştan kilitli"
// diyerek olmayan bir şeyi arattırıyordu.
const kilitliLevel = (): Level => ({
  n: 7, boss: null, limit: 10,
  rings: [
    { speed: 1, gap: 60, gaps: 1, gapOffset: 180, flip: 0, wobble: false, preLocked: false, start: 0 },
    { speed: 0, gap: 60, gaps: 1, gapOffset: 180, flip: 0, wobble: false, preLocked: true, start: 1 }
  ]
});

test("baştan kilitli halkanın karesi halkadan farklı renkte", () => {
  const g = sahteTuval();
  ciz(g.tuval, createLevel(kilitliLevel(), 1), RENK, SECENEK);
  assert.ok(g.dolgular.some(d => d.renk === RENK.bg),
    "kare zemin renginde dolmalı; mürekkeple dolarsa mürekkep rengindeki halkanın üstünde kaybolur");
  assert.ok(g.konturlar.some(k => k.renk === RENK.ink && !k.kesikli),
    "karenin mürekkep kenarlığı olmalı: dolgusu tek başına kalsa halkada boşluk sanılırdı");
});

test("baştan kilitli halka yokken zemin renkli dolgu da yok", () => {
  // Kare yalnızca preLocked halkada çizilmeli; başka bir şeyi zemin rengiyle doldurmuyoruz.
  const g = sahteTuval();
  ciz(g.tuval, createLevel(level(), 1), RENK, SECENEK);
  assert.ok(!g.dolgular.some(d => d.renk === RENK.bg),
    "preLocked halka yokken zemin renginde dolgu olmamalı");
});

test("geçer kamanın konturu çiziliyor: mürekkep, düz, KAMA opaklığında (1.4.11 bunu taşır)", () => {
  // Kontrast testi opaklığı KAMA'dan okuyor; bu test o değerle GERÇEKTEN çizildiğini
  // doğruluyor. İkisi birlikte: `stroke()` silinse ya da renk değişse biri düşer.
  const g = sahteTuval();
  const s = createLevel(level(), 1);
  kanalKur(s, 60);
  ciz(g.tuval, s, RENK, SECENEK);
  const k = g.konturlar.find(x => x.renk === RENK.ink && !x.kesikli && Math.abs(x.alfa - KAMA.kontur) < 1e-6);
  assert.ok(k, "geçer kamada mürekkep renginde düz kontur olmalı");
  assert.equal(k.kalinlik, KAMA.kalinlik);
});

test("kama konturu halkaların içine girmez (merkezden çıkan 'tel' yok)", () => {
  const yer = layout(400, 700, 2);
  for (const acik of [60, 20]) {
    const g = sahteTuval();
    const s = createLevel(level(), 1);
    kanalKur(s, acik);
    ciz(g.tuval, s, RENK, SECENEK);
    const kama = g.konturlar.filter(x => (x.renk === RENK.ink && Math.abs(x.alfa - KAMA.kontur) < 1e-6) ||
      (x.renk === RENK.fail && x.kesikli));
    assert.ok(kama.length > 0, acik + " dilim: kama konturu bulunamadı");
    for (const x of kama) {
      assert.ok(x.enYakin >= yer.outer + yer.lineWidth / 2 - 1e-6,
        `${acik} dilim: kontur merkeze ${x.enYakin.toFixed(1)} px kadar giriyor (dış halka ${yer.outer.toFixed(1)})`);
    }
  }
});
