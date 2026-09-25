// Geometri ve geçiş eşiği. Oranlar burada tek yerde durur; NEED onlardan türetilir.
// Bu oranlardan biri değişirse NEED değişir ve TÜM LEVEL TABLOSU yeniden üretilmelidir
// (bkz. docs/SPEC.md, 2. ve 8. bölüm).

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Oyun alanının kısa kenarına (S) oranlı ölçüler. */
export const RATIO = {
  outer: 0.44,      // en dış halka yarıçapı
  inner: 0.17,      // en iç halka yarıçapı
  ball: 0.022,      // top yarıçapı
  lineWidth: 0.018  // halka çizgi kalınlığı (5–9 piksel arasına sıkıştırılır)
} as const;

export const LINE_WIDTH_MIN = 5;
export const LINE_WIDTH_MAX = 9;

/** Topun en iç halkadan geçebilmesi için gereken en küçük açı. Ekran boyutundan bağımsızdır. */
export const NEED = 2 * Math.asin(RATIO.ball / RATIO.inner) + 3 * DEG;

/** Çember 720 dilime bölünür (dilim başına 0,5°). */
export const BINS = 720;
export const BIN = TAU / BINS;
export const NEED_BINS = Math.ceil(NEED / BIN);

/**
 * Geçiş eşiği. Oyun dilim sayar, üretici analitik ölçer; ikisi de AYNI eşiği kullansın diye
 * eşik dilime yuvarlanmış halidir (18,0°). Eskiden üç yerde üç farklı değer vardı.
 */
export const NEED_PASS = NEED_BINS * BIN;
export const canPass = (w: number): boolean => w >= NEED_PASS;

/**
 * Topun ÇİZİLDİĞİ yarıçap (kısa kenara oran). Kuralın kendisi değil, kuraldan türetilir.
 *
 * Kural topun geçmesi için gerçek boyutuna (`RATIO.ball`, 14,9°) 3° emniyet payı ekleyip
 * 18° istiyor. Top gerçek boyutunda çizildiğinde kıl payı bir kayıpta (17,5°) en iç halkadaki
 * açıklık 360 px ekranda ~18,6 px, topun çapı 15,8 px'ti: oyun "sığmadı" derken göz "sığdı"
 * görüyordu ve oyuncu haksız yere kaybettiğini düşünüyordu (proje sahibinin gözlemi).
 *
 * Top artık kuralın gerçekten beklediği boyutta çizilir: en iç halkada tam `NEED_PASS`
 * genişliğine oturan top. Eşikte açıklığa tam sığar, eşiğin altında sığmadığı görülür.
 * Zorluk DEĞİŞMEZ: `NEED` ve tablo aynı kalır, yalnız görüntü kuralla örtüşür.
 */
export const TOP_CIZIM = RATIO.inner * Math.sin(NEED_PASS / 2);

/** Referans çözücünün kendine bıraktığı pay: insan oyuncunun sapması için yer açar. */
export const SOLVER_MARGIN = 2 * BIN;

/** Dokunuşlar arası en kısa tepki süresi (saniye). Simülasyondaki oyuncu bundan hızlı basmaz. */
export const REACT = 0.3;

/** Açıyı -π..π aralığına taşır. İki açı arasındaki en kısa farkı ölçmek için. */
export const norm = (a: number): number => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** Açıyı 0..2π aralığına taşır. */
export const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

export interface Layout {
  S: number; outer: number; inner: number; step: number; ballR: number; lineWidth: number;
  radius: (i: number) => number;
}

/** Ekran ölçülerinden halka yarıçaplarını hesaplar. ringCount >= 1. */
export function layout(width: number, height: number, ringCount: number): Layout {
  const S = Math.min(width, height);
  const outer = S * RATIO.outer, inner = S * RATIO.inner;
  const step = ringCount > 1 ? (outer - inner) / (ringCount - 1) : 0;
  return {
    S, outer, inner, step,
    ballR: S * TOP_CIZIM,
    lineWidth: Math.max(LINE_WIDTH_MIN, Math.min(LINE_WIDTH_MAX, S * RATIO.lineWidth)),
    radius: (i: number) => outer - i * step
  };
}
