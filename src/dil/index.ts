// Dil seçimi, cihaz dili algılama ve sayı biçimi.
import { TR } from "./tr.ts";
import { EN } from "./en.ts";
import type { DilKodu, Metinler } from "./tipler.ts";

export type { DilKodu, Metinler, GostergeAnahtari, PatronAnahtari, OzellikAnahtari } from "./tipler.ts";

export const DILLER: Record<DilKodu, Metinler> = { tr: TR, en: EN };

/**
 * Desteklenmeyen bir cihaz dilinde ne gösterilir.
 *
 * Türkçe DEĞİL, İngilizce. Oyun Türkçe yazıldı ama küresel pazara çıkıyor: Japon bir
 * oyuncu için Türkçe, İngilizce'den daha anlaşılmaz. Türk oyuncu zaten cihaz diliyle
 * Türkçe alır; yedek dilin işi yalnızca "hiçbirini bilmiyorsak ne olsun" sorusudur.
 */
export const YEDEK_DIL: DilKodu = "en";

const KODLAR = Object.keys(DILLER) as DilKodu[];

export const gecerliDilMi = (k: unknown): k is DilKodu =>
  typeof k === "string" && (KODLAR as string[]).includes(k);

/**
 * Cihazın dilinden bir dil kodu çıkarır.
 *
 * `navigator.languages` sırayla denenir: kullanıcı "de-DE, en-GB, tr" gibi bir öncelik
 * listesi tutar ve ilk DESTEKLEDİĞİMİZ dili vermek doğrusudur — ilkini alıp
 * desteklemiyorsak yedeğe düşmek, listede aşağıda duran ama bildiğimiz dili çöpe atar.
 * Bölge eki atılır: "tr-CY" de Türkçedir.
 */
export function cihazDili(): DilKodu {
  const liste: readonly string[] =
    typeof navigator === "undefined" ? []
      : navigator.languages?.length ? navigator.languages
      : navigator.language ? [navigator.language] : [];
  for (const etiket of liste) {
    const kok = etiket.toLowerCase().split("-")[0];
    if (gecerliDilMi(kok)) return kok;
  }
  return YEDEK_DIL;
}

/** Sayıyı seçili dilin ondalık ayırıcısıyla yazar: Türkçe "8,0", İngilizce "8.0". */
export function sayi(m: Metinler, deger: number, basamak = 1): string {
  try {
    return new Intl.NumberFormat(m.yerel, {
      minimumFractionDigits: basamak, maximumFractionDigits: basamak
    }).format(deger);
  } catch {
    // Intl yoksa ya da yerel etiketi reddedilirse: en azından doğru ayırıcı.
    const d = deger.toFixed(basamak);
    return m.kod === "tr" ? d.replace(".", ",") : d;
  }
}
