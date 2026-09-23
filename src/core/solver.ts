// Referans çözücü: kusursuz zamanlamalı bir oyuncu (şartname 8. bölüm, 3. adım).
// İlk kilidi hemen vurur, kalan hata payını kalan halkalara eşit böler, dokunuşlar
// arasında en az REACT kadar bekler.
//
// Tek kopya: level üretici de, testler de bunu kullanır. Üretici bir leveli bu çözücüyle
// doğruladığında, oyunun kendi döngüsünü aynı kilit anlarıyla sürmek anlamlı bir sınama olur.
import { NEED_PASS, SOLVER_MARGIN, REACT } from "./geometry.ts";
import { liveRings, stepRings, ADIM } from "./rings.ts";
import { OPEN_ALL, lockOpen, peekOpen, largestOpen, initialOpen } from "./opening.ts";
import type { Open } from "./opening.ts";
import type { RingDef } from "./rings.ts";

/** Çözücünün hedeflediği genişlik: geçiş eşiğinin biraz üstü, insan oyuncuya yer kalsın diye. */
export const SOLVER_HEDEF = NEED_PASS + SOLVER_MARGIN;

/** Bir kilidin hangi halkaya, hangi anda vurulduğu. */
export interface Kilit { halka: number; t: number }

export interface Cozum {
  /** Son kilidin anı (saniye). */
  t: number;
  kilitler: Kilit[];
  /** Kasa açıldığında kalan açıklık (rad). */
  w: number;
}

/** Çözülemezse null. Bir halka 30 saniye içinde vurulamıyorsa aday elenir. */
export function solve(def: readonly RingDef[]): Cozum | null {
  const rs = liveRings(def);
  const dt = ADIM;
  let open: Open = initialOpen(rs);
  let t = 0, last = 0;
  const kilitler: Kilit[] = [];

  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (r.locked) continue;
    const rem = rs.filter((x, k) => k > i && !x.locked).length;
    const until = t + 30;
    let done = false;
    while (t < until) {
      if (t >= last + REACT) {
        if (open === OPEN_ALL) done = true;
        else {
          const cur = largestOpen(open).w;
          const allow = (cur - SOLVER_HEDEF) / (rem + 1);
          const p = peekOpen(open, r);
          if (p.w >= SOLVER_HEDEF && cur - p.w <= allow) done = true;
        }
        if (done) {
          open = lockOpen(open, r);
          r.locked = true;
          last = t;
          kilitler.push({ halka: i, t });
          break;
        }
      }
      t += dt;
      stepRings(rs, dt, t);
    }
    if (!done) return null;
  }
  return { t, kilitler, w: largestOpen(open).w };
}
