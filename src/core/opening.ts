// Açıklık hesabı. İki eşdeğer model burada yaşar:
//   - aralık modeli: analitik, hızlı; level üretici bunu kullanır
//   - dilim (maske) modeli: oyunun kamaları çizmek için kullandığı biçim
// İkisinin en fazla 1 dilim ayrışması zorunludur (bkz. src/core/core.test.ts).
import { TAU, DEG, BINS, BIN, canPass, norm, wrap } from "./geometry.ts";
import { gapCenters, type Ring } from "./rings.ts";

// ---- Aralık modeli ----------------------------------------------------------

/** Açık bir aralık: merkez açısı ve genişliği (rad). */
export interface Span { c: number; w: number }

/** Açık bölge. null = henüz hiçbir halka kilitlenmedi, tüm çember açık. */
export type Open = Span[] | null;

// null olarak tiplenir ki open === OPEN_ALL karsilastirmasi TS tarafindan daraltilabilsin.
export const OPEN_ALL = null;

/**
 * Halkayı kilitler ve kalan açık bölgeyi döndürür.
 * Geçemeyecek kadar dar aralıklar atılır: kesişim yalnızca daraltacağı için bir daha
 * açılamazlar. Bu budama olmadan iki kapılı halkalarda aralık sayısı 2^n büyür.
 */
export function lockOpen(open: Open, r: Ring): Span[] {
  const half = r.gap * DEG / 2;
  const centers = gapCenters(r);
  if (open === OPEN_ALL) return centers.map(c => ({ c: wrap(c), w: half * 2 })).filter(o => canPass(o.w));
  const out: Span[] = [];
  for (const o of open) {
    for (const c of centers) {
      const d = norm(c - o.c);
      const lo = Math.max(-o.w / 2, d - half), hi = Math.min(o.w / 2, d + half);
      if (hi - lo > 0 && canPass(hi - lo)) out.push({ c: wrap(o.c + (lo + hi) / 2), w: hi - lo });
    }
  }
  return out;
}

/** Kilitlenseydi kalan en geniş açıklık ne olurdu? Halkayı kilitlemeden ölçer. */
export function peekOpen(open: Open, r: Ring): Span {
  const half = r.gap * DEG / 2;
  const centers = gapCenters(r);
  if (open === OPEN_ALL) return { c: wrap(r.angle), w: half * 2 };
  let best: Span = { c: 0, w: 0 };
  for (const o of open) {
    for (const c of centers) {
      const d = norm(c - o.c);
      const lo = Math.max(-o.w / 2, d - half), hi = Math.min(o.w / 2, d + half);
      if (hi - lo > best.w) best = { c: wrap(o.c + (lo + hi) / 2), w: hi - lo };
    }
  }
  return best;
}

export const largestOpen = (open: Open): Span =>
  open === OPEN_ALL ? { c: 0, w: TAU } : open.reduce((a, o) => o.w > a.w ? o : a, { c: 0, w: 0 });

/** Baştan kilitli halkaları uygular. */
export function initialOpen(rs: Ring[]): Open {
  let open: Open = OPEN_ALL;
  for (const r of rs) if (r.locked) open = lockOpen(open, r);
  return open;
}

// ---- Dilim (maske) modeli ---------------------------------------------------

export type Mask = Uint8Array;

export const newMask = (): Mask => new Uint8Array(BINS).fill(1);

export function applyMask(mask: Mask, r: Ring): void {
  const half = r.gap * DEG / 2, cs = gapCenters(r);
  for (let b = 0; b < BINS; b++) {
    if (!mask[b]) continue;
    const a = (b + 0.5) * BIN;
    mask[b] = cs.some(c => Math.abs(norm(a - c)) <= half) ? 1 : 0;
  }
}

export interface Run { from: number; to: number; len: number; w: number }

/** Çembersel açık dilim dizileri (başa sarmayı hesaba katarak). */
export function maskRuns(mask: Mask): Run[] {
  const out: Run[] = [];
  let start = -1;
  for (let b = 0; b < BINS; b++) if (!mask[b]) { start = b; break; }
  if (start < 0) return [{ from: 0, to: TAU, len: BINS, w: TAU }];
  let cur = 0, curStart = 0;
  for (let k = 1; k <= BINS; k++) {
    const b = (start + k) % BINS;
    if (mask[b]) { if (!cur) curStart = b; cur++; }
    else if (cur) { out.push({ from: curStart * BIN, to: (curStart + cur) * BIN, len: cur, w: cur * BIN }); cur = 0; }
  }
  return out;
}

export interface Largest { len: number; w: number; center: number }

export function maskLargest(mask: Mask): Largest {
  let best: Run = { from: 0, to: 0, len: 0, w: 0 };
  for (const r of maskRuns(mask)) if (r.len > best.len) best = r;
  return { len: best.len, w: best.w, center: (best.from + best.to) / 2 };
}
