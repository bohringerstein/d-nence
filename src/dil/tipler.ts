// Oyuncunun gördüğü BÜTÜN metinlerin sözleşmesi.
//
// Neden ayrı bir katman: metin koda gömülü olduğu sürece ikinci bir dil eklemek her
// dosyaya dokunmak demektir. Burada toplanınca dil eklemek tek dosya yazmaya iner.
//
// Neden tipli: bir çeviri eksik kalırsa **derleme hatası** olur. "Şu ekran hâlâ Türkçe
// kalmış" diye bir hata bu yapıda mümkün değildir — ve bunu gözle aramak imkânsızdır.
//
// Çekirdek (src/core/) bu katmanı TANIMAZ. Oyun kuralları dilden bağımsızdır; yıldız
// etiketleri de bu yüzden çekirdekten buraya taşındı.
import type { Stars, PatronAnahtari } from "../core/index.ts";

export type { PatronAnahtari };

export type DilKodu = "tr" | "en";

/** "Nasıl oynanır" göstergesindeki satırlar. Simgeler koddadır, metinler burada. */
export type GostergeAnahtari = "kama" | "flip" | "preLocked" | "gaps2" | "wobble" | "duraklat";

/** Öğretici ipucunun bağlandığı halka özelliği. */
export type OzellikAnahtari = "preLocked" | "gaps2" | "flip" | "wobble";

export interface Metinler {
  readonly kod: DilKodu;
  /** Intl için BCP-47 etiketi. Sayı biçimi (ondalık ayırıcı) buradan gelir. */
  readonly yerel: string;
  /** Dil seçicide görünen, kendi dilindeki adı. */
  readonly ad: string;

  // ---- Ekran iskeleti ----
  oyunAlani: string;
  duraklatDugmesi: string;
  levelOneki: string;
  patronEki: string;
  ayarlar: string;
  tamam: string;
  nasilOynanir: string;
  bastanBasla: string;
  anladim: string;

  // ---- Ayarlar ----
  ilerlemeYok: string;
  ilerleme: (bolum: number, yildiz: number, enCok: number) => string;
  desen: Secenek;
  hareket: Secenek;
  ses: Secenek;
  titresim: Secenek;
  dil: string;

  // ---- Duraklatma ----
  duraklatildi: string;
  duraklatAciklama: (kalanSure: string) => string;
  devamEt: string;

  // ---- Bitiş ----
  kasaAcildi: string;
  bitisMetni: (toplam: number, bolum: number, yildiz: number, enCok: number) => string;
  bastanOyna: string;

  // ---- İpuçları ----
  ogretici: Record<1 | 2 | 3 | 4, string>;
  ozellik: Record<OzellikAnahtari, string>;
  deneme: (n: number) => string;
  denemeVeIpucu: (n: number, ipucu: string) => string;
  denemeVeRekor: (n: number, yildiz: string) => string;
  enIyin: (yildiz: string, sure: string) => string;
  ilkDokunus: string;
  sureDoldu: string;

  // ---- Kayıp ----
  aciklikKapandi: string;
  kilPayiKayip: string;
  erkenDaraldi: string;
  darKaldi: (derece: string) => string;

  // ---- Kazanma ----
  yildizEtiketi: Record<Stars, string>;
  sonucSatiri: (etiket: string, yildiz: string, sure: string) => string;
  rekorEki: string;

  // ---- Patronlar ----
  patron: Record<PatronAnahtari, { ad: string; ipucu: string }>;

  // ---- "Nasıl oynanır" ----
  nasil: {
    baslik: string;
    /** <b> ile vurgu içerir: metnin kendisi bizim, kullanıcı girdisi değil. */
    giris: string;
    satir: Record<GostergeAnahtari, { baslik: string; metin: string }>;
    yildizlar: string;
    uyari: string;
  };

  // ---- Hata ekranı (tablo bozuksa) ----
  tabloHatasiBaslik: string;
  tabloHatasiMetin: string;
}

export interface Secenek {
  baslik: string;
  aciklama: string;
}
