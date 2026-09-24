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

/** Mesajın bir parçası: düz metin ya da yıldız gösterimi (`yildiz` doluysa). */
export interface Parca { metin: string; yildiz?: number }

/**
 * Mesajı düz metin ve yıldız gösterimi parçalarına ayırır.
 *
 * Neden: ipucu satırı canlı bölge (`role=status`) ve "Açıldı ★☆☆ 3,2 sn" ekran
 * okuyucuda ya hiç okunmuyor (NVDA'nın noktalama ayarına bağlı) ya da "siyah yıldız,
 * beyaz yıldız" diye okunuyordu. Çağıran, yıldız parçasını görünür ama `aria-hidden`
 * yazar ve yanına gizli bir "3 üzerinden 1 yıldız" koyar (bkz. main.ts `yaz`).
 */
export function yildizParcalari(metin: string): Parca[] {
  const out: Parca[] = [];
  let son = 0;
  for (const e of metin.matchAll(/[★☆]{3}/g)) {
    const i = e.index;
    if (i > son) out.push({ metin: metin.slice(son, i) });
    out.push({ metin: e[0], yildiz: [...e[0]].filter(c => c === "★").length });
    son = i + e[0].length;
  }
  if (son < metin.length) out.push({ metin: metin.slice(son) });
  return out;
}

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
  // EŞİK TEK DİLİM (0,5°). Eskiden 0,05 idi ve bu mesaj MATEMATİKSEL OLARAK HİÇ
  // TETİKLENEMİYORDU: oyun kanalı 0,5°'lik maske dilimleriyle ölçer ve NEED_PASS
  // (18,0°) tam sayı dilim olduğu için kayıpta pay her zaman en az 0,5°. Ölçüldü:
  // 991 "açıklık kapandı" kaybının SIFIRI bu mesajı aldı. İki dile çevrilmiş,
  // test edilmiş bir cümle hiç görünmüyordu — ve kaybın en yakın hâli, oyuncuyu
  // "bir daha" dedirtecek tek an, "0,5° dar kaldı" gibi soğuk bir sayıyla geçiyordu.
  //
  // Bu mesaj ancak 1 yıldızlı kazanma etiketi "Kıl payı"dan "Açıldı"ya çevrildikten
  // SONRA canlandırılabildi: ikisi aynı sözü kullandığında kazanan ve kaybeden oyuncu
  // aynı iki kelimeyi görüyordu. Artık "kıl payı" yalnız kıl payı KAYBIN adı.
  if (payDerece < 0.6) return m.kilPayiKayip;
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

/** Her patron tasarımının ilk göründüğü bölüm (tasarımlar ~70 bölümde bir tekrarlanır). */
export function patronIlkGorunus(levels: Level[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of levels) if (l.boss && !(l.boss in out)) out[l.boss] = l.n;
  return out;
}

export interface IpucuGirdi {
  level: Level;
  deneme: number;
  rekor: Best | undefined;
  ogretici: Record<number, string>;
  m: Metinler;
  /** Verilmezse her patron ilk kez görülüyor sayılır. */
  patronIlk?: Record<string, number>;
}

export function ipucu({ level, deneme, rekor, ogretici, m, patronIlk }: IpucuGirdi): string {
  // Patron ipucu da öğretici ipucu gibi davranır: bölüm daha önce BİTİRİLMEMİŞSE
  // deneme sayacı onu ezmez. Eskiden yalnızca ilk denemede gösteriliyordu ve
  // "Ayna: Hepsi aynı anda hizalanıyor" cümlesi tam da oyuncunun ona ihtiyaç duyduğu
  // anda — ilk kayıptan sonra — siliniyordu. Aşağıdaki kuralın tersiydi.
  //
  // Uzunluk: "Deneme 12 · Çatal: Her halkada iki kapı var, …" dar ekranda üç satıra
  // taşıyor, alt çubuk büyüyor ve halkalar zıplıyordu. İki kısaltma:
  // - Denemelerde ad düşer (ilk denemede zaten okundu): "Deneme 12 · <ipucu>".
  // - Tasarım DAHA ÖNCE GÖRÜLDÜYSE (aynı patron ~70 bölümde bir döner) yalnız ad
  //   yazılır; oyuncu kuralı ilk karşılaşmada öğrendi, her seferinde okumak zorunda değil.
  if (level.boss && !rekor) {
    const p = m.patron[level.boss];
    const ilk = !patronIlk || (patronIlk[level.boss] ?? level.n) >= level.n;
    if (!ilk) return deneme > 1 ? m.denemeVeIpucu(deneme, p.ad) : p.ad;
    return deneme > 1 ? m.denemeVeIpucu(deneme, p.ipucu) : `${p.ad}: ${p.ipucu}`;
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
