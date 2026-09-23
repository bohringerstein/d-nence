// Halka modeli ve hareketi.
import { TAU, DEG, wrap } from "./geometry.ts";

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
 * Fizik adımı. Sabit 1/120 saniye.
 *
 * TEK KAYNAK. Beş ayrı yerde tanımlıydı (`solver.ts`, `game/loop.ts`, `tools/gen.ts`
 * iki kez, `tools/play.ts`) ve `solver.ts`'in yorumu "oyunun döngüsüyle aynı olmak
 * zorunda" diyordu — yani bir yorum, ortak bir sabitin işini yapmaya çalışıyordu.
 * Eşitliği sınayan bir test de yoktu.
 *
 * Neden önemli: level tablosu bu adımla üretildi ve yön değiştiren halkalar adım
 * büyüklüğüne DUYARLI. Etkin flip periyodu `⌈flip·120⌉/120`'dir ve hata birikir;
 * ölçüldü: bir bölüm boyunca en kötü birikimli açı hatası 13,1° — medyan boşluk
 * payının dörtte üçü. Beş kopyadan biri kaysaydı üretici "çözülebilir" dediği bir
 * bölümü oyunun kaybettiği bir bölüme çevirirdi ve hiçbir test bunu göstermezdi.
 */
export const ADIM = 1 / 120;

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
    if (r.flip) {
      // İleri: sayaç periyodu geçince yön değişir.
      if (r.t >= r.flip) { r.t = 0; r.dir = r.dir === 1 ? -1 : 1; }
      // GERİ: sayaç sıfırın altına düşerse flip GERİ ALINIR. Oyun hiç negatif adım
      // atmaz, ama level üretici "oyuncu ε saniye ERKEN dokundu" durumunu geri sararak
      // kuruyor. Geri alma olmadan `r.t` negatife düşüyor ve `dir` flip'lenmiş kalıyordu:
      // halka, zaman geri akarken flip SONRASI yönde dönmeye devam ediyordu. Ölçülen
      // hata 32,5° — tipik boşluk payının neredeyse iki katı.
      else if (r.t < 0) { r.t += r.flip; r.dir = r.dir === 1 ? -1 : 1; }
    }
    const w = r.wobble ? 1 + 0.7 * Math.sin(lt * 2.3 + r.start) : 1;
    r.angle += r.speed * r.dir * w * dt;
  }
}

/** Halkanın boşluk merkezleri (bir ya da iki tane). */
export function gapCenters(r: RingDef & { angle: number }): number[] {
  const c = [r.angle];
  if (r.gaps === 2) c.push(r.angle + r.gapOffset * DEG);
  return c;
}

/** Level tanımından oynanabilir halka dizisi üretir. */
export const liveRings = (def: readonly RingDef[]): Ring[] =>
  def.map(r => ({ ...r, angle: r.start, dir: 1 as const, t: 0, locked: !!r.preLocked }));

export { TAU };

/**
 * Halkanın işaretinin (baştan kilitli karesi, yön değiştiren kırmızı noktası) konacağı açı:
 * en geniş çizili yayın ortası.
 *
 * Eskiden işaret körlemesine `angle + π`'ye, yani birinci boşluğun tam karşısına konuyordu.
 * Tek kapılı halkada bu hep çizginin üstüne düşer, ama iki kapılı halkada ikinci boşluk
 * `angle + gapOffset`'tedir ve gapOffset 180°'ye yakınsa işaret boşluğun tam ortasına
 * düşüyordu — oyuncu boşlukta havada duran bir nokta görüyordu.
 */
/**
 * Halkanın ÇİZİLEN yaylarını verir: boşlukların arasında kalan parçalar.
 *
 * Tek kopya. Aynı döngü hem çekirdekte (`isaretAcisi`) hem çizimde (`game/render.ts`
 * `halkaCiz`) ayrı ayrı yazılmıştı; yorum bile iki yerin birbirine bağlı olduğunu
 * kabul ediyordu ama ortak fonksiyona çıkarılmamıştı. "Halka geometrisi tek çekirdek
 * modülde yaşar" kuralının sızıntısıydı.
 *
 * @param ucPayi Yuvarlak çizgi uçlarının taşmasını telafi eden pay (radyan). Çizim
 *   bunu verir; geometri hesapları 0 kullanır, çünkü yay ORTASINA konan bir işaret
 *   kısalmadan etkilenmez.
 * @returns `[başlangıç, bitiş]` çiftleri; boşluklar örtüşüyorsa boş yaylar elenir.
 */
export function ciziliYaylar(r: RingDef & { angle: number }, ucPayi = 0): Array<[number, number]> {
  const yarim = r.gap * DEG / 2;
  const merkezler = gapCenters(r).map(wrap).sort((a, b) => a - b);
  const yaylar: Array<[number, number]> = [];
  for (let i = 0; i < merkezler.length; i++) {
    const a0 = merkezler[i] + yarim + ucPayi;
    const a1 = (i + 1 < merkezler.length ? merkezler[i + 1] : merkezler[0] + TAU) - yarim - ucPayi;
    if (a1 > a0) yaylar.push([a0, a1]);
  }
  return yaylar;
}

export function isaretAcisi(r: Ring): number {
  // Yuvarlak uçlar yayı kısaltır (bkz. ciziliYaylar `ucPayi`); işaret yayın ORTASINA
  // konduğu için bu kısalma sonucu değiştirmez, o yüzden pay 0.
  const yaylar = ciziliYaylar(r);
  if (yaylar.length === 0) return r.angle + Math.PI;   // boşluklar örtüşüyor: güvenli varsayılan
  let enIyi = yaylar[0], enGenis = -1;
  for (const y of yaylar) {
    if (y[1] - y[0] > enGenis) { enGenis = y[1] - y[0]; enIyi = y; }
  }
  return (enIyi[0] + enIyi[1]) / 2;
}
