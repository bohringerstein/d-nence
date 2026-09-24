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
  /**
   * Sayacın YANINDAKİ role="timer" öğesinin tam cümlesi.
   *
   * Kalan süre bilerek düğmenin DIŞINDA: düğmenin içinde olduğu sürece erişilebilir
   * adın parçası olur ve ad her karede değişirdi ("Duraklat, kalan süre 17,4" →
   * "…12,3"). aria-hidden'la gizlemek de çözmüyor, çünkü NVDA tarama kipi ve
   * VoiceOver rotoru bir <button>'ı TEK öğe olarak sunar: içindeki metne ok tuşuyla
   * girilemez, yani rakam düğmenin içinde kaldıkça hiç okunamaz.
   */
  kalanSureSesli: (saniye: string) => string;
  levelOneki: string;
  patronEki: string;
  ayarlar: string;
  tamam: string;
  nasilOynanir: string;
  bastanBasla: string;
  /** "Baştan başla" düğmesinin altındaki açıklama; paneldeki tek açıklamasız kontroldü. */
  bastanBaslaAciklama: string;
  /** İlk basıştan sonra düğmenin aldığı hal: hangi bölümün kaybolacağını söyler. */
  bastanBaslaOnay: (level: number) => string;
  anladim: string;
  /** İlk açılış kartının düğmesi. */
  oyna: string;

  // ---- Bölüm seçimi ----
  bolumSec: string;
  /** Ayarlardaki düğmenin altındaki açıklama. */
  bolumSecAciklama: string;
  /** "101–200": sayfadaki bölüm aralığı. */
  bolumAraligi: (bas: string, son: string) => string;
  oncekiSayfa: string;
  sonrakiSayfa: string;
  /** Izgaradaki düğmenin erişilebilir adı. yildiz=0 ise "henüz açılmadı". */
  bolumEtiketi: (n: number, yildiz: number) => string;
  bolumKilitli: (n: number) => string;

  // ---- Ayarlar ----
  ilerlemeYok: string;
  ilerleme: (bolum: number, yildiz: number, enCok: number) => string;
  desen: Secenek;
  hareket: Secenek;
  ses: Secenek;
  titresim: Secenek;
  dil: string;
  tema: string;
  temaSecenek: Record<"sistem" | "acik" | "koyu", string>;
  /** Ayarlar panelindeki grup başlıkları. */
  grupOyun: string;
  grupGorunum: string;

  // ---- İlerleme yedeği ----
  //
  // Kayıt tek bir tarayıcı profilinde duruyor ve onu kurtarmanın başka yolu yok:
  // telefon değiştiren oyuncu ilerlemesini kaybeder, mağaza sürümüne geçen oyuncu da
  // (farklı origin, kayıt görünmez).
  yedek: string;
  yedekAciklama: string;
  yedekKopyala: string;
  yedekKopyalandi: string;
  yedekYapistir: string;
  yedekYukle: string;
  /** İkinci basışta çıkan onay: yükleme var olan ilerlemenin üstüne yazar. */
  yedekYukleOnay: string;
  yedekGecersiz: string;
  /** Kod okundu ama içinde ilerleme yok; mevcut ilerlemenin üstüne yazılmaz. */
  yedekBos: string;
  yedekYuklendi: (bolum: number) => string;

  /** Ayarlardaki gizlilik politikası bağlantısı (public/gizlilik.html). */
  gizlilik: string;
  /** Erişilebilirlik beyanı bağlantısı (public/erisilebilirlik.html). */
  erisilebilirlik: string;
  /** Açık kaynak lisansları bağlantısı (public/lisanslar.html, üretilir). */
  lisanslar: string;
  /** Ayarların altındaki sürüm satırı: derleme ve tablo damgası. */
  surum: (derleme: string, tablo: string) => string;

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
  /**
   * Süre dolunca. Kalan halka sayısıyla: "Süre doldu" tek başına oyuncuya ne kadar
   * yaklaştığını söylemiyordu; bir halka kala ile hiç kilitlemeden aynı cümleydi.
   */
  sureDoldu: (kalanHalka: number) => string;

  // ---- Kayıp ----
  aciklikKapandi: string;
  kilPayiKayip: string;
  erkenDaraldi: string;
  darKaldi: (derece: string) => string;

  // ---- Kazanma ----
  yildizEtiketi: Record<Stars, string>;
  /** Saniyenin kısaltması (kazanma sahnesi). */
  saniyeKisa: string;
  /** Kazanma sahnesinde toplam birikim. */
  toplamYildizSatiri: (yildiz: number, enCok: number) => string;
  /** Her 50 bölümde bir, bölüm İLK kez bitirilince: kilometre taşı. */
  kilometreTasi: (bolum: number) => string;
  /** ★☆☆ gliflerinin ekran okuyucu karşılığı. Glifler okunmaz ya da "siyah yıldız" diye okunur. */
  yildizSesli: (yildiz: number) => string;
  sonucSatiri: (etiket: string, yildiz: string, sure: string) => string;
  /**
   * Kazanma satırının eki: bir üst yıldıza kalan mesafe ("· 3 yıldıza %9 kaldı").
   *
   * Yıldız üç kovadır ve sıradan oyuncu bölümlerin %68'inde 1 yıldızda kalır — yani
   * gelişmesi yıldıza yansımaz. Eşikleri sıkmak yerine ARA BASAMAK eklendi. Ölçü
   * DERECE değil YÜZDE: 3 yıldız eşiğinin derece karşılığı bölümden bölüme 13,5 kat
   * değişiyor, yani derece hiçbir şey öğretmiyordu (bkz. game/hints.ts kalanYazisi).
   */
  yildizaKalan: (yildiz: number, yuzde: string) => string;
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
    /** İlk açılış kartının tek cümlelik kuralı (tam anlatım Ayarlar'dan açılır). */
    kisaGiris: string;
    /**
     * İlk açılış kartındaki ışığa duyarlılık uyarısı. Kısa ama üç şeyi söylemek zorunda:
     * riski adlandırır (desen + parlama), yapılacak işi söyler (iki ayar), rahatsızlıkta
     * oynamayı bırakmasını söyler.
     */
    kisaUyari: string;
  };

  // ---- Hata ekranı ----
  //
  // İki ayrı hâl, iki ayrı çare: tablo İNMEDİYSE (bağlantı, sunucu, önbellek) çare
  // oyuncudadır — tekrar denemek. Tablo indi ama BOZUKSA çare geliştiricidedir ve
  // oyuncunun yapabileceği bir şey yoktur. Tek metin ikisini de yanlış anlatırdı.
  /** Tablo yeniden üretildiği için rekorlar sıfırlandığında alt çubuğa yazılır. */
  rekorlarYenilendi: string;
  /** Tablo inerken, birkaç saniye sonra ekranda beliren yazı. */
  yukleniyor: string;
  tabloIndirilemediBaslik: string;
  tabloIndirilemediMetin: string;
  tekrarDene: string;
  tabloHatasiBaslik: string;
  tabloHatasiMetin: string;
}

export interface Secenek {
  baslik: string;
  aciklama: string;
}
