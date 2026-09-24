// Türkçe metinler. Oyunun ana dili; İngilizce sürüm buradan çevrildi.
import type { Metinler } from "./tipler.ts";

export const TR: Metinler = {
  kod: "tr",
  yerel: "tr-TR",
  ad: "Türkçe",

  oyunAlani: "Oyun alanı. Dokunarak sıradaki halkayı kilitle.",
  duraklatDugmesi: "Duraklat",
  kalanSureSesli: saniye => `Kalan süre ${saniye} saniye`,
  levelOneki: "Bölüm",
  patronEki: ", patron",
  ayarlar: "Ayarlar",
  tamam: "Tamam",
  nasilOynanir: "Nasıl oynanır",
  bastanBasla: "Baştan başla",
  bastanBaslaAciklama: "1. bölüme döner ve açtığın bölümler kilitlenir. Yıldızların kalır.",
  bastanBaslaOnay: level => `Emin misin? ${level}. bölüme kadar açtıkların kilitlenir`,
  anladim: "Anladım",
  oyna: "Oyna",

  bolumSec: "Bölüm seç",
  bolumSecAciklama: "Açtığın her bölüme dönebilirsin. İlerlemen bozulmaz.",
  bolumAraligi: (bas, son) => `${bas}–${son}`,
  oncekiSayfa: "Önceki yüz bölüm",
  sonrakiSayfa: "Sonraki yüz bölüm",
  bolumEtiketi: (n, yildiz) =>
    yildiz > 0 ? `Bölüm ${n}, ${yildiz} yıldız` : `Bölüm ${n}, henüz bitirilmedi`,
  bolumKilitli: n => `Bölüm ${n}, kilitli`,

  ilerlemeYok: "Henüz bölüm açılmadı.",
  ilerleme: (bolum, yildiz, enCok) => `${bolum} bölüm açıldı · ${yildiz} / ${enCok} yıldız`,
  desen: { baslik: "Deseni yumuşat", aciklama: "Kilitlenmemiş halkalar daha soluk çizilir." },
  hareket: { baslik: "Hareketi azalt", aciklama: "Kayıptaki sarsıntı ve ekran flaşı kapanır." },
  ses: { baslik: "Ses", aciklama: "Kilitte kısa bir nota; kanal daraldıkça perde yükselir." },
  titresim: { baslik: "Titreşim", aciklama: "Kilitte ve kayıpta telefon titreşir." },
  dil: "Dil",
  tema: "Tema",
  temaSecenek: { sistem: "Cihaza göre", acik: "Açık", koyu: "Koyu" },
  grupOyun: "Oyun",
  grupGorunum: "Görünüm ve his",
  yedek: "İlerlemeyi yedekle",
  yedekAciklama: "Telefon değiştirirken ilerlemeni taşımanın tek yolu.",
  yedekKopyala: "Kodu kopyala",
  yedekKopyalandi: "Kopyalandı",
  yedekYapistir: "Yedek kodunu buraya yapıştır",
  yedekYukle: "Geri yükle",
  yedekYukleOnay: "Emin misin? Şu anki ilerlemen silinir",
  yedekGecersiz: "Kod okunamadı",
  yedekBos: "Bu yedek boş; ilerlemenin üstüne yazılmadı",
  yedekYuklendi: bolum => `İlerleme yüklendi: ${bolum} bölüm`,
  gizlilik: "Gizlilik politikası",
  erisilebilirlik: "Erişilebilirlik",
  lisanslar: "Lisanslar",

  duraklatildi: "Duraklatıldı",
  duraklatAciklama: kalan => `${kalan} saniyen kaldı. Halkalar tam durduğun yerde bekliyor.`,
  devamEt: "Devam et",

  kasaAcildi: "Kasa açıldı",
  bitisMetni: (toplam, bolum, yildiz, enCok) =>
    `${toplam} kasanın hepsini açtın. ${bolum} bölümde toplam ${yildiz} yıldız topladın` +
    (yildiz < enCok ? `; ${enCok} yıldızın tamamı için bölümleri daha temiz açman gerek.` : ". Hepsi temiz."),
  bastanOyna: "Baştan oyna",

  ogretici: {
    1: "Dokun, dış halkayı kilitle",
    2: "Sarı kama ortak açıklık. Sonraki boşluğu ona hizala",
    3: "Yıldızlar, kasa açıldığında kalan açıklığın genişliğine göre",
    4: "İpucu: ilk kilidi, ikinci halkanın boşluğu yaklaşırken vur"
  },
  ozellik: {
    preLocked: "Kareli halka baştan kilitli, kanalın yönünü o belirler",
    gaps2: "İki kapılı halka: hangi kapıyı kullandığın sonrakileri etkiler",
    flip: "Kırmızı noktalı halkalar ara ara yön değiştirir",
    wobble: "Bazı halkalar hızlanıp yavaşlıyor"
  },
  deneme: n => `Deneme ${n}`,
  denemeVeIpucu: (n, ipucu) => `Deneme ${n} · ${ipucu}`,
  denemeVeRekor: (n, yildiz) => `Deneme ${n}, en iyin ${yildiz}`,
  enIyin: (yildiz, sure) => `En iyin ${yildiz} ${sure} sn`,
  ilkDokunus: "Dokun, sıradaki halkayı kilitle",
  sureDoldu: (kalan) => kalan > 0 ? `Süre doldu · ${kalan} halka kaldı` : "Süre doldu",

  aciklikKapandi: "Açıklık kapandı",
  kilPayiKayip: "Açıklık kapandı · kıl payı",
  erkenDaraldi: "Açıklık kapandı · yol erken daraldı",
  darKaldi: derece => `Açıklık kapandı · ${derece}° dar kaldı`,

  yildizEtiketi: { 3: "Temiz açılış", 2: "İyi açılış", 1: "Açıldı" },
  yildizSesli: (yildiz) => `3 üzerinden ${yildiz} yıldız`,
  sonucSatiri: (etiket, yildiz, sure) => `${etiket} ${yildiz} ${sure} sn`,
  yildizaKalan: (yildiz, yuzde) => ` · ${yildiz} yıldıza %${yuzde} kaldı`,
  rekorEki: ", rekor",

  patron: {
    ayna: { ad: "Ayna", ipucu: "Hepsi aynı anda hizalanıyor, o anı bekle ve hızlı dokun" },
    merkez: { ad: "Merkez", ipucu: "Ortadaki kilitli halka yolu gösteriyor" },
    metronom: { ad: "Metronom", ipucu: "Halkalar sallanıyor, orta noktadan geçerken yakala" },
    catal: { ad: "Çatal", ipucu: "Her halkada iki kapı var, hangisini seçtiğin sonrakini belirler" },
    tavsanKaplumbaga: { ad: "Tavşan ile kaplumbağa", ipucu: "Yavaşlar sabırlı, hızlılar keskin nişan ister" },
    buyukKasa: { ad: "Büyük kasa", ipucu: "Her şey bir arada: hız, yön, iki kapı" },
    sonKasa: { ad: "Son kasa", ipucu: "Bin kasanın sonuncusu. Elinde ne varsa şimdi" }
  },

  nasil: {
    baslik: "Nasıl oynanır",
    giris: `Ekrana her dokunduğunda <b>dıştan içe</b> sıradaki halka olduğu yerde kilitlenir.
Kilitli halkaların boşluklarının kesiştiği yer <b>sarı kama</b>dır: topun çıkış yolu.
Her yeni kilit bu yolu ancak <b>daraltır</b>. Yol topun geçemeyeceği kadar daralırsa kaybedersin.
Tüm halkalar kilitlenince kasa açılır. <b>Sayaç biterse de kaybedersin</b>: üstteki sayı kalan süren.`,
    satir: {
      kama: {
        baslik: "Sarı kama",
        metin: "Şu anki çıkış yolun. Sonraki halkanın boşluğunu buna hizala. Kırmızı kesik çizgili kama, topun geçemeyeceği kadar dardır."
      },
      flip: {
        baslik: "Kırmızı nokta",
        metin: "Bu halka ara ara <b>yön değiştirir</b>. Dönüşünü izlemeden dokunma."
      },
      preLocked: {
        baslik: "Küçük kare",
        metin: "Halkanın üstünde duran açık renkli kare: bu halka <b>baştan kilitli</b>. Yolun yönünü o belirler, sen değiştiremezsin."
      },
      gaps2: {
        baslik: "İki boşluk",
        metin: "Halkanın <b>iki kapısı</b> var. Hangisini kullandığın sonraki halkalar için kalan payı değiştirir."
      },
      wobble: {
        baslik: "Değişken hız",
        metin: "Bu halka sabit hızda dönmez, <b>hızlanıp yavaşlar</b>. Üstünde bir işaret yoktur; hareketinden tanırsın. Yavaşladığı anı bekle."
      },
      duraklat: {
        baslik: "Duraklat",
        metin: "Üstteki <b>sayaca dokun</b>, oyun tam o karede durur. Devam edince üçten geri sayar; halkalar sayım bitene kadar beklemeye devam eder."
      }
    },
    yildizlar: `<b>Yıldızlar hızı değil hassasiyeti ölçer.</b> Kasa açıldığında kalan yol ne kadar
genişse o kadar yıldız alırsın. Hızlı bitirmek tek başına yıldız kazandırmaz; süre yalnızca
eşit yıldızda rekoru belirler.`,
    uyari: `Dönence'de iç içe dönen halkalar var. Işığa duyarlı epilepsi ya da desenlerden
rahatsız olma geçmişin varsa, <b>Ayarlar</b>'dan &ldquo;Deseni yumuşat&rdquo; seçeneğini açabilir
ve ara vererek oynayabilirsin. Kayıptaki sarsıntıyı ve ekran parlamasını &ldquo;Hareketi azalt&rdquo;
kapatır. Rahatsızlık duyarsan oynamayı bırak.`,
    kisaGiris: `Dokun: halkalar <b>dıştan içe</b> sırayla kilitlenir. <b>Sarı kama</b> topun çıkış yolu; her kilit onu daraltır. Kapanmadan tüm halkaları kilitle.`,
    kisaUyari: `Dönen halka deseni ve kısa ekran parlaması içerir. Işığa ya da desenlere duyarlıysan <b>Ayarlar</b>'dan &ldquo;Deseni yumuşat&rdquo; ve &ldquo;Hareketi azalt&rdquo;ı aç; rahatsızlık duyarsan oynamayı bırak.`
  },

  rekorlarYenilendi: "Bölümler güncellendi: ilerlemen yerinde, yıldız rekorları sıfırlandı",
  yukleniyor: "Bölümler indiriliyor…",
  tabloIndirilemediBaslik: "Bölümler indirilemedi",
  tabloIndirilemediMetin: "Bağlantını kontrol edip tekrar dene. Oyun bir kez açıldıktan sonra çevrimdışı da çalışır.",
  tekrarDene: "Tekrar dene",
  tabloHatasiBaslik: "Bölüm tablosu okunamadı",
  tabloHatasiMetin: "Geliştirici için: <code>npm run verify</code> çalıştırın."
};
