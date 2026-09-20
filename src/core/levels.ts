// Level tablosunun biçimi ve şema doğrulaması.
// Oynanabilirlik denetimi ayrıdır: tools/gen.ts --verify.
import { TAU, NEED, DEG } from "./geometry.ts";
import type { RingDef } from "./rings.ts";

export interface Level {
  n: number;
  /** Patron leveliyse adı, değilse null. */
  boss: string | null;
  /** Patron leveli ipucu, değilse null. */
  hint: string | null;
  /** Süre sınırı, saniye. */
  limit: number;
  /** Dıştan içe sıralı. */
  rings: RingDef[];
}

export interface LevelTable {
  /** 3 yıldız eşiği. */
  q3: number;
  /** 2 yıldız eşiği. */
  q2: number;
  levels: Level[];
}

export const GAP_MAX_DEG = 85;

/**
 * Bölüm sayısı. Tek sabit: değiştirip `npm run gen` çalıştırmak yeterli.
 *
 * Oyun "aa" gibi uzun soluklu olmalı; 60 bölüm bir saatte bitiyordu. Bu tür bir oyunda
 * yapı tekrarı rahatsız edici değildir, çünkü bölümler arasındaki fark hız ve boşluk
 * genişliğiyle taşınır ve oyuncu iki bölümü yan yana görmez.
 */
export const LEVEL_COUNT = 1000;

/** Her 10 bölümde bir patron. */
export const BOSS_ARALIGI = 10;
export const BOSS_LEVELS: number[] =
  Array.from({ length: Math.floor(LEVEL_COUNT / BOSS_ARALIGI) }, (_, i) => (i + 1) * BOSS_ARALIGI);
export const bossMu = (n: number): boolean => n % BOSS_ARALIGI === 0;

const RING_FIELDS: Array<[keyof RingDef, string]> = [
  ["speed", "number"], ["gap", "number"], ["gaps", "number"], ["gapOffset", "number"],
  ["flip", "number"], ["wobble", "boolean"], ["preLocked", "boolean"], ["start", "number"]
];

/** Tabloyu biçim açısından denetler. Boş dizi dönerse tablo sağlam. */
export function validateTable(data: LevelTable): string[] {
  const err: string[] = [];
  if (typeof data.q3 !== "number" || typeof data.q2 !== "number") err.push("q3/q2 sayı değil");
  else if (!(data.q3 > data.q2)) err.push("q3, q2 değerinden büyük olmalı");
  if (!Array.isArray(data.levels) || data.levels.length !== LEVEL_COUNT) {
    err.push(LEVEL_COUNT + " level olmalı");
    return err;
  }
  data.levels.forEach((l, i) => {
    const ad = "level " + (i + 1);
    if (l.n !== i + 1) err.push(ad + ": n alanı sırayla gitmiyor");
    if (typeof l.limit !== "number" || l.limit <= 0) err.push(ad + ": limit geçersiz");
    if (!Array.isArray(l.rings) || l.rings.length < 2 || l.rings.length > 6) {
      err.push(ad + ": halka sayısı 2-6 dışında");
      return;
    }
    if (!l.rings.some(r => !r.preLocked)) err.push(ad + ": tüm halkalar baştan kilitli");
    const gorulen = new Set<string>();
    l.rings.forEach((r, k) => {
      const nerede = ad + " halka " + k + ": ";
      const kayit = r as unknown as Record<string, unknown>;
      let tipTamam = true;
      for (const [alan, tur] of RING_FIELDS) {
        if (typeof kayit[alan] !== tur) { err.push(nerede + alan + " " + tur + " olmalı"); tipTamam = false; }
      }
      if (!tipTamam) return;
      if (r.gaps !== 1 && r.gaps !== 2) err.push(nerede + "gaps 1 veya 2 olmalı");
      if (r.gap < NEED / DEG || r.gap > GAP_MAX_DEG) err.push(nerede + "gap " + r.gap.toFixed(1) + " derece, sınırların dışında");
      if (r.start < 0 || r.start >= TAU) err.push(nerede + "start 0..2pi dışında");
      if (r.flip < 0) err.push(nerede + "flip negatif");
      // Birebir aynı iki halka ikinci kilidi bedava yapar (10. patronda böyle bir hata vardı).
      const anahtar = JSON.stringify(r);
      if (gorulen.has(anahtar)) err.push(nerede + "bir öncekiyle birebir aynı");
      gorulen.add(anahtar);
    });
  });
  return err;
}

/** Bir özelliğin patron olmayan ilk göründüğü level. Öğretici ipuçları bundan hesaplanır. */
export function firstSeen(levels: Level[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of levels) {
    if (l.boss) continue;
    const var_: Record<string, boolean> = {
      preLocked: l.rings.some(r => r.preLocked),
      gaps2: l.rings.some(r => r.gaps === 2),
      flip: l.rings.some(r => r.flip > 0),
      wobble: l.rings.some(r => r.wobble)
    };
    for (const k in var_) if (var_[k] && !(k in out)) out[k] = l.n;
  }
  return out;
}
