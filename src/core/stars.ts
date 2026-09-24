// Yıldız kuralı: hassasiyeti ölçer, hızı değil.
// Kasa açıldığında kalan açıklığın, levelin en dar boşluğuna göre ne kadarını koruyabildin.
import { NEED_PASS } from "./geometry.ts";

export type Stars = 1 | 2 | 3;

/**
 * 0 = kıl payı geçildi, 1 = boşluk hiç daralmadı.
 *
 * Ölçü GEÇİŞ EŞİĞİNDEN (NEED_PASS) alınır, ham NEED'den değil: oyuncunun kazandığı
 * an eşiği geçtiği andır, dolayısıyla "sıfır pay" o noktadır. Eskiden NEED
 * kullanılıyordu ve q, kaybedilen bir genişlikte bile küçük pozitif çıkabiliyordu.
 */
export const starRatio = (widthRad: number, minGapRad: number): number =>
  // Math.min ŞART: analitik modelde `w ≤ minGap` garantili ama OYUN dilim sayar ve
  // bir dilime (0,5°) kadar fazla ölçebilir. Tablodaki en küçük payda 3,729° olduğu
  // için q teorik olarak 1,13'e çıkabilir. 592 gerçek oyunda gözlenmedi (en büyük
  // 0,960) ama yapısal olarak engellenmemişti — ve aynı oranın ses perdesi için
  // kullanılan ikizi (game/state.ts aciklikOrani) zaten sıkıştırıyordu.
  Math.min(1, (widthRad - NEED_PASS) / (minGapRad - NEED_PASS));

export const starCount = (q: number, q3: number, q2: number): Stars =>
  q >= q3 ? 3 : q >= q2 ? 2 : 1;

/** Rekor karşılaştırması: daha çok yıldız her zaman daha iyi, eşit yıldızda kısa süre kazanır. */
export interface Best {
  s: Stars; t: number;
  /**
   * Rekorun kırıldığı bölümün özeti (bkz. levels.ts `bolumOzeti`). Tablo değişince yalnız
   * TANIMI değişen bölümlerin rekorları silinir. Yoksa rekor özetten önceki dönemden gelir.
   */
  h?: string;
}

export const isBetter = (yeni: Best, eski: Best | undefined): boolean =>
  !eski || yeni.s > eski.s || (yeni.s === eski.s && yeni.t < eski.t);
