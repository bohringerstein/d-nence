// Yıldız kuralı: hassasiyeti ölçer, hızı değil.
// Kasa açıldığında kalan açıklığın, levelin en dar boşluğuna göre ne kadarını koruyabildin.
import { NEED } from "./geometry.ts";

export type Stars = 1 | 2 | 3;

/** 0 = kıl payı geçildi, 1 = boşluk hiç daralmadı. */
export const starRatio = (widthRad: number, minGapRad: number): number =>
  (widthRad - NEED) / (minGapRad - NEED);

export const starCount = (q: number, q3: number, q2: number): Stars =>
  q >= q3 ? 3 : q >= q2 ? 2 : 1;

export const STAR_LABEL: Record<Stars, string> = {
  3: "Temiz açılış",
  2: "İyi açılış",
  1: "Kıl payı"
};

/** Rekor karşılaştırması: daha çok yıldız her zaman daha iyi, eşit yıldızda kısa süre kazanır. */
export interface Best { s: Stars; t: number }

export const isBetter = (yeni: Best, eski: Best | undefined): boolean =>
  !eski || yeni.s > eski.s || (yeni.s === eski.s && yeni.t < eski.t);
