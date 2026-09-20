// Level durumu ve oyun kuralları.
//
// TEK NESNE KURALI: bir level yüklenirken durum alanları tek tek sıfırlanmaz,
// createLevel() eksiksiz yeni bir nesne üretir ve çağıran onu topluca değiştirir.
// Prototipteki donma hatası (kayıptan sonra kazanınca oyunun takılması) tam olarak
// "bir alanı sıfırlamayı unutmak" hatasıydı; bu yapıda o hata mümkün değil.
import {
  liveRings, stepRings, newMask, applyMask, maskLargest, maskRuns, canPass,
  starRatio, starCount, DEG
} from "../core/index.ts";
import type { Level, Ring, Mask, Run, Stars } from "../core/index.ts";

export type Asama = "idle" | "fire" | "crash";

/** Kayıpta kırmızıya dönecek halka: tek bir halka, ya da süre dolduysa hepsi. */
export const HEPSI = -2;
export const YOK = -1;

export interface LevelState {
  readonly level: Level;
  readonly deneme: number;
  rings: Ring[];
  mask: Mask;
  anyLocked: boolean;
  asama: Asama;
  /** Sıradaki kilitsiz halka; rings.length ise hepsi kilitli. */
  active: number;
  levelTime: number;
  /** Aşama bitişine kalan süre (fire ve crash için). */
  endTimer: number;
  finishTime: number;
  // Görsel durum
  flash: number;
  shake: number;
  lockPulse: number;
  crashRing: number;
  lastLocked: number;
  fireAngle: number;
  ballDist: number;
}

export const CRASH_SURE = 0.9;
export const FIRE_SURE = 1.4;
/** Top, kısa kenarın 1,3 katı kadar mesafeyi saniyede kat eder. */
export const TOP_HIZI = 1.3;

const sonraki = (rings: Ring[], from: number): number => {
  let i = from;
  while (i < rings.length && rings[i].locked) i++;
  return i;
};

/** Eksiksiz, taze bir level durumu. Hiçbir alan çağırana bırakılmaz. */
export function createLevel(level: Level, deneme: number): LevelState {
  const rings = liveRings(level.rings);
  const mask = newMask();
  let anyLocked = false;
  for (const r of rings) if (r.locked) { applyMask(mask, r); anyLocked = true; }
  return {
    level, deneme, rings, mask, anyLocked,
    asama: "idle",
    active: sonraki(rings, 0),
    levelTime: 0,
    endTimer: 0,
    finishTime: 0,
    flash: 0,
    shake: 0,
    lockPulse: 0,
    crashRing: YOK,
    lastLocked: YOK,
    fireAngle: 0,
    ballDist: 0
  };
}

export type TapSonuc =
  | { tip: "yok" }
  | { tip: "kilit" }
  | { tip: "kayip"; sebep: "aciklik" }
  | { tip: "acildi"; yildiz: Stars; q: number; sure: number };

/** Kayba düşür. Görsel alanları da burada ayarlar ki çağıran unutamasın. */
function cokert(s: LevelState, halka: number): void {
  s.asama = "crash";
  s.crashRing = halka;
  s.flash = 1;
  s.shake = 1;
  s.endTimer = CRASH_SURE;
}

/** Ekrana dokunuş. Yalnızca "idle" aşamasında iş yapar. */
export function tap(s: LevelState, q3: number, q2: number): TapSonuc {
  if (s.asama !== "idle" || s.active >= s.rings.length) return { tip: "yok" };

  const r = s.rings[s.active];
  r.locked = true;
  s.lastLocked = s.active;
  s.lockPulse = 1;
  applyMask(s.mask, r);
  s.anyLocked = true;

  const en = maskLargest(s.mask);
  if (!canPass(en.w)) { cokert(s, s.active); return { tip: "kayip", sebep: "aciklik" }; }

  s.active = sonraki(s.rings, s.active + 1);
  if (s.active < s.rings.length) return { tip: "kilit" };

  // Son hareketli halka kilitlendi: kasa açılıyor.
  s.asama = "fire";
  s.fireAngle = en.center;
  s.ballDist = 0;
  s.finishTime = s.levelTime;
  s.endTimer = FIRE_SURE;

  const minGap = Math.min(...s.level.rings.map(x => x.gap)) * DEG;
  const q = starRatio(en.w, minGap);
  return { tip: "acildi", yildiz: starCount(q, q3, q2), q, sure: s.finishTime };
}

export type AdimSonuc = { tip: "yok" } | { tip: "sureDoldu" } | { tip: "bitti" };

/**
 * Sabit adımlı fizik güncellemesi (şartname 3. bölüm: 1/120 sn).
 * Yalnızca oyun mantığı; görsel sönümleme decay() içinde, çünkü o ekran hızına bağlı olabilir.
 */
export function step(s: LevelState, dt: number): AdimSonuc {
  if (s.asama === "idle") {
    s.levelTime += dt;
    stepRings(s.rings, dt, s.levelTime);
    if (s.levelTime >= s.level.limit) { cokert(s, HEPSI); return { tip: "sureDoldu" }; }
    return { tip: "yok" };
  }
  s.endTimer -= dt;
  if (s.endTimer <= 0) return { tip: "bitti" };
  return { tip: "yok" };
}

/** Görsel sönümleme ve topun uçuşu. S = oyun alanının kısa kenarı. */
export function decay(s: LevelState, dt: number, S: number, outer: number): void {
  if (s.asama === "fire") {
    s.ballDist += S * TOP_HIZI * dt;
    // Top halkaların dışına çıktığında yeşil flaş
    if (s.flash === 0 && s.endTimer > 0.6 && s.ballDist > outer) s.flash = 1;
  }
  s.flash = Math.max(0, s.flash - dt * 2);
  s.shake = Math.max(0, s.shake - dt * 3);
  s.lockPulse = Math.max(0, s.lockPulse - dt * 4);
}

/** Kalan süre (fire aşamasında sayaç durur). */
export const kalanSure = (s: LevelState): number =>
  Math.max(0, s.level.limit - (s.asama === "fire" ? s.finishTime : s.levelTime));

/** Çizim için açık bölgeler. */
export const aciklikBolgeleri = (s: LevelState): Run[] => maskRuns(s.mask);

/** Sıradakinden sonraki halka: ileriyi okumayı mümkün kılar. */
export const sonrakiHalka = (s: LevelState): number =>
  s.asama === "idle" ? sonraki(s.rings, s.active + 1) : YOK;
