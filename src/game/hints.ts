// Alt çubuktaki ipucu metni (şartname 7. bölüm).
//
// Metinlerin kendisi burada DEĞİL, src/dil/ altında. Burada yalnızca hangi metnin
// ne zaman gösterileceği kuralı var — o kural dilden bağımsızdır.
import { firstSeen } from "../core/index.ts";
import type { Level, Best, Stars } from "../core/index.ts";
import { sayi } from "../dil/index.ts";
import type { Metinler, OzellikAnahtari } from "../dil/index.ts";

/** Tablodan bir kez hesaplanır: level numarası -> öğretici ipucu. */
export function ogreticiTablosu(levels: Level[], m: Metinler): Record<number, string> {
  const out: Record<number, string> = { ...m.ogretici };
  const ilk = firstSeen(levels);
  for (const k in ilk) {
    const n = ilk[k];
    // Aynı levelde iki özellik ilk kez görünürse ilki kazanır; ikisini birden göstermek
    // alt çubuğa sığmaz ve oyuncuyu boğar.
    const metin = m.ozellik[k as OzellikAnahtari];
    if (!(n in out) && metin) out[n] = metin;
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
export function kayipYazisi(payDerece: number, m: Metinler): string {
  if (!Number.isFinite(payDerece) || payDerece < 0) return m.aciklikKapandi;
  if (payDerece < 0.05) return m.kilPayiKayip;
  if (payDerece > 10) return m.erkenDaraldi;
  return m.darKaldi(payDerece < 1 ? sayi(m, payDerece, 1) : sayi(m, Math.round(payDerece), 0));
}

/**
 * Kazanma satırının pay eki: " · 2,4° pay".
 *
 * Yıldız üç kovadan ibaret ve ölçüm şunu söylüyor: sıradan bir oyuncu bölümlerin
 * %68'ini 1 yıldızla bitiriyor, 1000 bölümün 294'ünde 3 yıldız 60 denemede bir kez
 * bile çıkmıyor. Yani oyuncunun gelişmesi ekranda görünmüyordu. Çözüm eşikleri
 * sıkmak değil — o, oyunu yalnızca daha cezalı yapardı — ARA BASAMAK göstermek:
 * kalan payın kendisi. İki deneme arasındaki küçük fark artık okunabilir.
 *
 * Bir ondalık, 10 derecenin üstünde tam sayı: 14,6 derecelik bir payda ondalık
 * bilgi taşımaz, yalnızca satırı uzatır.
 */
export function payYazisi(payDerece: number, m: Metinler): string {
  if (!Number.isFinite(payDerece) || payDerece < 0) return "";
  return m.payEki(payDerece < 10 ? sayi(m, payDerece, 1) : sayi(m, Math.round(payDerece), 0));
}

/** Süre: ondalık ayırıcı dile göre değişir (Türkçe "8,0", İngilizce "8.0"). */
export const sureYazisi = (t: number, m: Metinler): string => sayi(m, t, 1);

export interface IpucuGirdi {
  level: Level;
  deneme: number;
  rekor: Best | undefined;
  ogretici: Record<number, string>;
  m: Metinler;
}

export function ipucu({ level, deneme, rekor, ogretici, m }: IpucuGirdi): string {
  // Patron ipucu da öğretici ipucu gibi davranır: bölüm daha önce BİTİRİLMEMİŞSE
  // deneme sayacı onu ezmez. Eskiden yalnızca ilk denemede gösteriliyordu ve
  // "Ayna: Hepsi aynı anda hizalanıyor" cümlesi tam da oyuncunun ona ihtiyaç duyduğu
  // anda — ilk kayıptan sonra — siliniyordu. Aşağıdaki kuralın tersiydi.
  if (level.boss && !rekor) {
    const p = m.patron[level.boss];
    const metin = `${p.ad}: ${p.ipucu}`;
    return deneme > 1 ? m.denemeVeIpucu(deneme, metin) : metin;
  }

  // Öğretici ipucu deneme sayacını EZER, tersi değil.
  //
  // Eskiden "Deneme N" öndeydi ve ilk kayıpta öğretici metin kayboluyordu. Oysa oyuncu
  // kuralı tam da kaybettiği için öğrenmeye çalışıyor: Level 2'deki "Sarı kama ortak
  // açıklık" cümlesi oyunun belkemiği ve tek kayıpla siliniyordu. Deneme sayısı yine
  // görünüyor, sadece ipucunun önüne geçmiyor.
  const ogr = !rekor ? ogretici[level.n] : undefined;
  if (ogr) return deneme > 1 ? m.denemeVeIpucu(deneme, ogr) : ogr;

  if (deneme > 1) return rekor ? m.denemeVeRekor(deneme, yildizYazisi(rekor.s)) : m.deneme(deneme);
  return rekor ? m.enIyin(yildizYazisi(rekor.s), sureYazisi(rekor.t, m)) : m.ilkDokunus;
}
