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
 * Kazanma satırının eki: bir üst yıldıza ne kadar kaldı?
 *
 * Önce DERECE yazılıyordu ("· 2,4° pay") ve bu ölçeksizdi: 3 yıldız eşiğinin derece
 * karşılığı bölümden bölüme 3,32° ile 44,89° arasında, yani 13,5 kat değişiyor.
 * Ölçüldü: "5,0° pay" 39 bölümde 3 yıldız, 797 bölümde 1 yıldız demek. Oyuncu sayıya
 * bakıp bir şey öğrenemiyordu — daha kötüsü, YANLIŞ öğreniyordu.
 *
 * `q` ise her bölümde aynı ölçekte (0 = kıl payı, 1 = boşluk hiç daralmadı), çünkü
 * bölümün kendi en dar boşluğuna göre normalize edilmiş. Eşiğe olan uzaklığı yüzde
 * olarak yazmak iki şeyi birden veriyor: ölçek her bölümde aynı, ve sayı bir HEDEFE
 * bağlı — "bir üst basamak var, mesafe şu kadar, kapatılabilir".
 *
 * 3 yıldızda ek yok: "Temiz açılış ★★★" zaten üst basamakta olunduğunu söylüyor.
 *
 * Kayıp mesajındaki derece (bkz. kayipYazisi) BİLEREK derece kalıyor: onun referansı
 * bölümün boşluğu değil, her bölümde aynı olan geçiş eşiği (NEED_PASS = 18°). "3° dar
 * kaldı" her bölümde aynı şeyi anlatır.
 */
export function kalanYazisi(q: number, q3: number, q2: number, m: Metinler): string {
  if (!Number.isFinite(q)) return "";
  if (q >= q3) return "";
  const hedefYildiz = q >= q2 ? 3 : 2;
  const esik = q >= q2 ? q3 : q2;
  // Yüzde, eşiğe olan uzaklık; q zaten 0..1 olduğu için doğrudan orantılı.
  const yuzde = Math.max(1, Math.round((esik - q) * 100));
  return m.yildizaKalan(hedefYildiz, sayi(m, yuzde, 0));
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
