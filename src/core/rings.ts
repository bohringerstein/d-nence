// Halka modeli ve hareketi.
import { TAU, DEG } from "./geometry.ts";

/** Level tablosundaki halka tanımı (data/levels.json biçimi). */
export interface RingDef {
  /** Dönüş hızı, rad/sn. İşaret yönü belirtir. */
  speed: number;
  /** Boşluk genişliği, derece. */
  gap: number;
  /** Boşluk sayısı. */
  gaps: 1 | 2;
  /** İkinci boşluğun birinciye göre açısı, derece. */
  gapOffset: number;
  /** Kaç saniyede bir yön değiştirir. 0 = hiç. */
  flip: number;
  /** Hızı sinüs dalgasıyla değişir mi. */
  wobble: boolean;
  /** Level başında kilitli mi. */
  preLocked: boolean;
  /** Başlangıç açısı, rad (birinci boşluğun merkezi). */
  start: number;
}

/** Oyun sırasındaki halka: tanıma durum alanları eklenir. */
export interface Ring extends RingDef {
  angle: number;
  dir: 1 | -1;
  /** Yön değişimi sayacı. */
  t: number;
  locked: boolean;
}

/**
 * Halkaları bir adım ilerletir. `lt` levelin başından beri geçen süredir.
 *
 * `dt` negatif olabilir (simülasyonda erken dokunuşu geri sarmak için). Geri sarma ancak
 * `lt` dizisi birebir eşleşirse tam tersine çevrilebilir: ileri adım (lt_k → lt_k+1) wobble
 * çarpanını lt_k+1'de hesaplar, o adımı geri almak da lt_k+1 kullanmalıdır.
 */
export function stepRings(rs: Ring[], dt: number, lt: number): void {
  for (const r of rs) {
    if (r.locked) continue;
    r.t += dt;
    if (r.flip && r.t >= r.flip) { r.t = 0; r.dir = r.dir === 1 ? -1 : 1; }
    const w = r.wobble ? 1 + 0.7 * Math.sin(lt * 2.3 + r.start) : 1;
    r.angle += r.speed * r.dir * w * dt;
  }
}

/** Halkanın boşluk merkezleri (bir ya da iki tane). */
export function gapCenters(r: Ring | RingDef & { angle: number }): number[] {
  const c = [r.angle];
  if (r.gaps === 2) c.push(r.angle + r.gapOffset * DEG);
  return c;
}

/** Level tanımından oynanabilir halka dizisi üretir. */
export const liveRings = (def: readonly RingDef[]): Ring[] =>
  def.map(r => ({ ...r, angle: r.start, dir: 1 as const, t: 0, locked: !!r.preLocked }));

export { TAU };
