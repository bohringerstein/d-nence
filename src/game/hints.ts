// Alt çubuktaki ipucu metni (şartname 7. bölüm).
import { firstSeen } from "../core/index.ts";
import type { Level, Best, Stars } from "../core/index.ts";

/** Öğretici ipuçları: her biri yalnızca level daha önce bitirilmemişse gösterilir. */
const SABIT: Record<number, string> = {
  1: "Dokun, dış halkayı kilitle",
  2: "Sarı kama ortak açıklık. Sonraki boşluğu ona hizala",
  3: "Yıldızlar, kasa açıldığında kalan açıklığın genişliğine göre",
  4: "İpucu: ilk kilidi, ikinci halkanın boşluğu yaklaşırken vur"
};

/** Her özelliğin patron olmayan ilk göründüğü levelde gösterilecek açıklama. */
const OZELLIK: Record<string, string> = {
  preLocked: "Kareli halka baştan kilitli, kanalın yönünü o belirler",
  gaps2: "İki kapılı halka: hangi kapıyı kullandığın sonrakileri etkiler",
  flip: "Kırmızı noktalı halkalar ara ara yön değiştirir",
  wobble: "Bazı halkalar hızlanıp yavaşlıyor"
};

/** Tablodan bir kez hesaplanır: level numarası -> öğretici ipucu. */
export function ogreticiTablosu(levels: Level[]): Record<number, string> {
  const out: Record<number, string> = { ...SABIT };
  const ilk = firstSeen(levels);
  for (const k in ilk) {
    const n = ilk[k];
    // Aynı levelde iki özellik ilk kez görünürse ilki kazanır; ikisini birden göstermek
    // alt çubuğa sığmaz ve oyuncuyu boğar.
    if (!(n in out) && OZELLIK[k]) out[n] = OZELLIK[k];
  }
  return out;
}

export const yildizYazisi = (s: Stars): string => "★".repeat(s) + "☆".repeat(3 - s);

/**
 * Kayıp mesajı: yol ne kadarla kapandı?
 *
 * "Açıklık kapandı" tek başına oyuncuya hiçbir şey öğretmiyordu; 1 derece mi kaçırdı
 * yoksa 20 derece mi, ikisi de aynı cümleyi veriyordu. Oysa bu iki durum oyuncu için
 * tamamen farklı: birincisi "bir daha", ikincisi "yanlış an". Pay derece cinsinden
 * yazılır; 10 dereceden büyük farklarda sayı anlamını yitirir, orada söz yeter.
 */
export function kayipYazisi(payDerece: number): string {
  if (!Number.isFinite(payDerece) || payDerece < 0) return "Açıklık kapandı";
  if (payDerece < 0.05) return "Açıklık kapandı · kıl payı";
  if (payDerece > 10) return "Açıklık kapandı · yol erken daraldı";
  const sayi = payDerece < 1 ? payDerece.toFixed(1) : Math.round(payDerece).toString();
  return `Açıklık kapandı · ${sayi.replace(".", ",")}° dar kaldı`;
}

/** Türkçe ondalık ayırıcı virgüldür. */
export const sureYazisi = (t: number): string => t.toFixed(1).replace(".", ",");

export interface IpucuGirdi {
  level: Level;
  deneme: number;
  rekor: Best | undefined;
  ogretici: Record<number, string>;
}

export function ipucu({ level, deneme, rekor, ogretici }: IpucuGirdi): string {
  if (level.boss && deneme === 1) return `${level.boss}: ${level.hint}`;

  // Öğretici ipucu deneme sayacını EZER, tersi değil.
  //
  // Eskiden "Deneme N" öndeydi ve ilk kayıpta öğretici metin kayboluyordu. Oysa oyuncu
  // kuralı tam da kaybettiği için öğrenmeye çalışıyor: Level 2'deki "Sarı kama ortak
  // açıklık" cümlesi oyunun belkemiği ve tek kayıpla siliniyordu. Deneme sayısı yine
  // görünüyor, sadece ipucunun önüne geçmiyor.
  const ogr = !rekor ? ogretici[level.n] : undefined;
  if (ogr) return deneme > 1 ? `Deneme ${deneme} · ${ogr}` : ogr;

  if (deneme > 1) return `Deneme ${deneme}` + (rekor ? `, en iyin ${yildizYazisi(rekor.s)}` : "");
  return rekor ? `En iyin ${yildizYazisi(rekor.s)} ${sureYazisi(rekor.t)} sn` : "Dokun, sıradaki halkayı kilitle";
}
