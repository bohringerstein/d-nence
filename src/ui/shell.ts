// Ekran düzeni (şartname 7. bölüm): üst çubuk, süre çubuğu, oyun alanı, alt çubuk.
//
// Metinlerin hiçbiri burada yazılı değil: hepsi src/dil/ altından gelir.
import { DILLER } from "../dil/index.ts";
import type { Metinler, DilKodu } from "../dil/index.ts";
export interface Kabuk {
  kok: HTMLElement;
  /** Sayaç aynı zamanda duraklatma düğmesidir (bkz. HTML). */
  clock: HTMLButtonElement;
  /** Sayacın rakam kısmı; duraklat simgesi kardeş öğe olduğu için ayrı tutulur. */
  clockSayi: HTMLElement;
  /** Kalan sürenin ekran okuyucuya açık hâli (role="timer"). Düğmenin dışındadır. */
  clockSes: HTMLElement;
  bar: HTMLElement;
  barFill: HTMLElement;
  lvl: HTMLElement;
  /** "/1000" soneki: 1000 bölümlük bir oyunda nerede olduğun görünsün. */
  lvlToplam: HTMLElement;
  canvas: HTMLCanvasElement;
  hint: HTMLElement;
  reset: HTMLButtonElement;
  resetNot: HTMLElement;
  bitis: HTMLElement;
  bitisMetin: HTMLElement;
  bitisDugme: HTMLButtonElement;
  /** Bitiş ekranından bölüm seçimine giden ikinci çıkış. */
  bitisSecim: HTMLButtonElement;
  flas: HTMLElement;
  /** Devam ederken çalışan 3-2-1 sayacı. */
  gerisayim: HTMLElement;
  kazanc: HTMLElement;
  kazancSatir1: HTMLElement;
  kazancSatir2: HTMLElement;
  duraklat: HTMLElement;
  duraklatMetin: HTMLElement;
  devamDugme: HTMLButtonElement;
  /** Duraklatma örtüsünden bölüm seçimine giden düğme. */
  duraklatSecim: HTMLButtonElement;
  ayarAc: HTMLButtonElement;
  ayarPanel: HTMLElement;
  /** Panel başlığı; açılışta odak buraya verilir (bkz. markup). */
  ayarBaslik: HTMLElement;
  ayarKapat: HTMLButtonElement;
  desenKutu: HTMLInputElement;
  hareketKutu: HTMLInputElement;
  titresimKutu: HTMLInputElement;
  titresimSatir: HTMLElement;
  sesKutu: HTMLInputElement;
  /** Tarayıcı ses üretemiyorsa satır hiç gösterilmez. */
  sesSatir: HTMLElement;
  dilKutu: HTMLSelectElement;
  temaKutu: HTMLSelectElement;
  surumSatir: HTMLElement;
  uyari: HTMLElement;
  /** Ayarlar panelindeki ilerleme özeti (bölüm + yıldız). */
  ozet: HTMLElement;
  /** İlerleme yedeği örtüsü ve parçaları (bkz. game/storage.ts disaAktar). */
  yedek: HTMLElement;
  yedekBaslik: HTMLElement;
  yedekAc: HTMLButtonElement;
  yedekKapat: HTMLButtonElement;
  yedekKod: HTMLTextAreaElement;
  yedekKopyala: HTMLButtonElement;
  yedekGiris: HTMLTextAreaElement;
  yedekYukle: HTMLButtonElement;
  yedekNot: HTMLElement;
  /** Bölüm seçimi örtüsü ve parçaları (bkz. ui/secim.ts). */
  secim: HTMLElement;
  secimBaslik: HTMLElement;
  secimAc: HTMLButtonElement;
  secimKapat: HTMLButtonElement;
  secimGeri: HTMLButtonElement;
  secimIleri: HTMLButtonElement;
  secimAralik: HTMLElement;
  secimIzgara: HTMLElement;
  nasil: HTMLElement;
  nasilIcerik: HTMLElement;
  nasilKapat: HTMLButtonElement;
  /** "Nasıl oynanır" başlığı; açılışta odak buraya verilir. */
  nasilBaslik: HTMLElement;
  nasilAc: HTMLButtonElement;
  /** Örtü açıkken inert edilen arka plan öğeleri (üst çubuk, süre çubuğu, oyun alanı, alt çubuk). */
  arka: HTMLElement[];
}

/**
 * Ekran iskeletinin markup'ı. DIŞA AKTARILIYOR çünkü testlerin buna ihtiyacı var.
 *
 * Testler bu dosyayı METİN olarak okuyup HTML yorumlarını ve `${…}` yer tutucularını
 * regex'le ayıklıyordu. Kırılgandı ve iki kez yanlış sonuç verdi: bir kuralın NEDEN
 * böyle olduğunu anlatan yorum, kuralın kendisi sanıldı. `html(TR)` çağırmak gerçek
 * üretilmiş markup'ı verir — ayıklama yok, kırılganlık yok.
 */
export const html = (m: Metinler): string => `
<div class="app">
  <header>
    <h1>Dönence</h1>
    <!-- Sayacın kendisi duraklatma düğmesidir. Ayrı bir düğme koymuyoruz: ekranın
         tamamı dokunma alanı olduğu için alt köşeye eklenen her düğme, başparmağın
         durduğu yere ölü bölge açar. Sayaç ise üst çubukta ve eşleşme birebir:
         zamanı durdurmak için zamana dokun. -->
    <button class="clock" id="clock" type="button">
      <i class="duraklatIm" aria-hidden="true"></i><span id="clockSayi" aria-hidden="true">0,0</span><span class="gizli">${m.duraklatDugmesi}</span>
    </button>
    <!-- Kalan süre düğmenin DIŞINDA, kendi role="timer" öğesinde. İçeride olduğunda
         düğmenin erişilebilir adı her karede değişiyordu; aria-hidden da çözmüyor,
         çünkü ekran okuyucular bir <button>'ı tek öğe olarak sunar ve içindeki metne
         girilemez. Burada oyuncu istediğinde okuyabilir, kimse üstüne bağırmaz:
         role="timer" varsayılan olarak aria-live="off" demektir. -->
    <span class="gizli" id="clockSes" role="timer"></span>
    <div class="lvl">${m.levelOneki} <b id="lvl">1</b><small id="lvlToplam"></small></div>
  </header>
  <!-- Süre çubuğu sayacın görsel kopyası; ekran okuyucuya iki kez söylenmesin. -->
  <div class="bar" id="bar" aria-hidden="true"><i id="barFill"></i></div>
  <div class="alan">
    <!-- tabindex="0": oyun alanı odaklanabilir. Bu oyunun tek kontrolü boşluk/Enter,
         yani örtü kapanınca odağın gidebileceği doğru yer burası — bir düğme olsaydı
         oyuncunun bir sonraki boşluk tuşu o düğmeyi çalıştırırdı. Ekran okuyucu da
         menüden çıkınca "Oyun alanı. Dokunarak sıradaki halkayı kilitle." okur. -->
    <canvas id="c" tabindex="0" aria-label="${m.oyunAlani}"></canvas>
    <div class="flas" id="flas" aria-hidden="true"></div>
    <div class="gerisayim" id="gerisayim" aria-hidden="true"></div>
    <!-- Kazanma sahnesi. aria-hidden: aynı sonuç alt çubuktaki canlı bölgede sözle
         duyuruluyor (yıldızlar dahil); burası yalnızca gözün ödülü. -->
    <div class="kazanc" id="kazanc" aria-hidden="true">
      <div class="kazancKutu">
        <div class="kazancYildiz"><i></i><i></i><i></i></div>
        <p class="kazancSatir" id="kazancSatir1"></p>
        <p class="kazancSatir kazancAlt" id="kazancSatir2"></p>
      </div>
    </div>
  </div>
  <footer>
    <span id="hint" role="status" aria-live="polite"></span>
    <button id="ayarAc" type="button" class="ikon" aria-label="${m.ayarlar}">${m.ayarlar}</button>
  </footer>

  <div class="ortu" id="ayarPanel" hidden role="dialog" aria-modal="true" aria-labelledby="ayarBaslik">
    <!-- tabindex="-1": panel açılınca odak BAŞLIĞA gider. Eskiden en alttaki
         "Tamam" düğmesine gidiyordu ve klavyeyle gelen oyuncu bütün denetimlerin
         arkasına düşüyordu; Tab ona hiçbirini göstermiyordu. -->
    <div class="kutu">
      <h2 id="ayarBaslik" tabindex="-1">${m.ayarlar}</h2>
      <!-- Toplanan yıldız oyun boyunca hiçbir yerde görünmüyordu: yalnızca 1000. bölümü
           bitiren oyuncu toplamını öğreniyordu. Birikimin görünmesi, 1000 bölümlük bir
           oyunda devam etme sebebinin kendisi. -->
      <p class="ozet" id="ozet"></p>
      <p class="uyari" id="uyari"></p>

      <!-- Panel düz bir listeydi ve 320 pikselde 1,47 ekran sürüyordu; fold altında
           kalanlar "Nasıl oynanır", "Baştan başla" ve gizlilikti — yani küçük
           telefonda yardım metnine giden tek yol görünmüyordu. Gruplama paneli 84
           piksel uzatıyor (1,63 ekran) ama oyuncunun tekrar tekrar aradığı iki eylemi
           fold üstüne çıkarıyor; fold altına itilen şey bir kez ayarlanıp unutulan
           onay kutuları. Üçüncü grubun başlığı bilerek yok: ayırıcı çizgi yetiyor. -->
      <h3 class="grupBaslik">${m.grupOyun}</h3>
      <!-- Bölüm seçimi: bitirilen bir bölüme dönmenin tek yolu. Yıldız sisteminin
           hedef olabilmesi buna bağlı (bkz. ui/secim.ts). Asıl giriş noktası
           duraklatma örtüsünde; burası ikinci yol. -->
      <button id="secimAc" type="button">${m.bolumSec}</button>
      <small class="dugmeNot">${m.bolumSecAciklama}</small>
      <button id="nasilAc" type="button">${m.nasilOynanir}</button>

      <h3 class="grupBaslik">${m.grupGorunum}</h3>
      <label class="secenek">
        <input type="checkbox" id="desenKutu">
        <span><b>${m.desen.baslik}</b><small>${m.desen.aciklama}</small></span>
      </label>
      <label class="secenek">
        <input type="checkbox" id="hareketKutu">
        <span><b>${m.hareket.baslik}</b><small>${m.hareket.aciklama}</small></span>
      </label>
      <label class="secenek" id="sesSatir">
        <input type="checkbox" id="sesKutu">
        <span><b>${m.ses.baslik}</b><small>${m.ses.aciklama}</small></span>
      </label>
      <label class="secenek" id="titresimSatir">
        <input type="checkbox" id="titresimKutu">
        <span><b>${m.titresim.baslik}</b><small>${m.titresim.aciklama}</small></span>
      </label>
      <label class="secenek dilSecim">
        <span><b>${m.tema}</b></span>
        <select id="temaKutu">
          <option value="sistem">${m.temaSecenek.sistem}</option>
          <option value="acik">${m.temaSecenek.acik}</option>
          <option value="koyu">${m.temaSecenek.koyu}</option>
        </select>
      </label>
      <label class="secenek dilSecim">
        <span><b>${m.dil}</b></span>
        <select id="dilKutu"><!--DILLER--></select>
      </label>

      <hr class="grupCizgi">
      <!-- İlerleme kaydı tek bir tarayıcı profilinde duruyor; telefon değiştiren
           oyuncunun onu kurtarmasının başka yolu yok. Mağaza sürümüne geçişte de
           aynı: Capacitor içeriği başka bir origin'den sunar. -->
      <button id="yedekAc" type="button">${m.yedek}</button>
      <small class="dugmeNot">${m.yedekAciklama}</small>
      <!-- "Baştan başla" alt çubuktaydı: Level 1'e döndüren bir eylem, hızlı hızlı
           dokunulan bir oyunda başparmağın durduğu sağ alt köşede duruyordu. Seyrek
           ve geri alınamaz olduğu için ayarlara taşındı. -->
      <button id="reset" type="button">${m.bastanBasla}</button>
      <small class="dugmeNot" id="resetNot">${m.bastanBaslaAciklama}</small>
      <!-- Gizlilik politikası her iki mağazanın da zorunlu tuttuğu bir bağlantı
           (Apple 5.1.1(i) uygulamanın İÇİNDE de ister). Sayfa uygulamayla birlikte
           yayınlanır ve çevrimdışı da açılır: public/gizlilik.html
           target="_blank" YOK: PWA ana ekrandan açıldığında yeni sekme, sayfayı
           uygulamanın DIŞINDA açar (iOS'ta Safari'ye atar) ve oyuncu kurulu
           uygulamasına dönemez. -->
      <p class="gizlilikSatir"><a href="./gizlilik.html">${m.gizlilik}</a> ·
        <a href="./erisilebilirlik.html">${m.erisilebilirlik}</a> ·
        <a href="./lisanslar.html">${m.lisanslar}</a></p>
      <p class="surumSatir" id="surumSatir"></p>
      <div class="kutuAlt"><button id="ayarKapat" type="button">${m.tamam}</button></div>
    </div>
  </div>

  <div class="ortu" id="yedek" hidden role="dialog" aria-modal="true" aria-labelledby="yedekBaslik">
    <div class="kutu yedekKutu">
      <h2 id="yedekBaslik" tabindex="-1">${m.yedek}</h2>
      <p>${m.yedekAciklama}</p>
      <!-- Kod ham JSON: base64 hem %33 daha uzun olurdu hem de oyuncu ne
           kopyaladığını göremezdi. -->
      <label class="gizli" for="yedekKod">${m.yedek}</label>
      <textarea id="yedekKod" class="yedekAlan" readonly rows="4"></textarea>
      <button id="yedekKopyala" type="button">${m.yedekKopyala}</button>
      <hr class="grupCizgi">
      <label class="gizli" for="yedekGiris">${m.yedekYapistir}</label>
      <textarea id="yedekGiris" class="yedekAlan" rows="4" placeholder="${m.yedekYapistir}"></textarea>
      <button id="yedekYukle" type="button">${m.yedekYukle}</button>
      <!-- role="status": yedek ekranının tek geri bildirim kanalı bu. Yıkıcı bir
           üzerine yazmanın onayı dahil hiçbir mesaj ekran okuyucuya ulaşmıyordu. -->
      <p class="uyari" id="yedekNot" role="status"></p>
      <div class="kutuAlt"><button id="yedekKapat" type="button">${m.tamam}</button></div>
    </div>
  </div>

  <div class="ortu" id="secim" hidden role="dialog" aria-modal="true" aria-labelledby="secimBaslik">
    <div class="kutu secimKutu">
      <h2 id="secimBaslik" tabindex="-1">${m.bolumSec}</h2>
      <div class="secimSayfa">
        <button id="secimGeri" type="button" class="ikon" aria-label="${m.oncekiSayfa}">&lsaquo;</button>
        <!-- role="status": sayfa oklarına basınca 100 düğme sessizce değişiyordu ve
             hangi yüzlük dilimde olunduğunu söyleyen tek öğe bu yazıydı — üstelik
             aria-hidden'dı. Ekran okuyucuyla bölüm seçimi kullanılamaz durumdaydı
             (WCAG 2.2, SC 4.1.3 Durum Mesajları). -->
        <span id="secimAralik" role="status"></span>
        <button id="secimIleri" type="button" class="ikon" aria-label="${m.sonrakiSayfa}">&rsaquo;</button>
      </div>
      <ul class="secimIzgara" id="secimIzgara"></ul>
      <div class="kutuAlt"><button id="secimKapat" type="button">${m.tamam}</button></div>
    </div>
  </div>

  <div class="ortu" id="nasil" hidden role="dialog" aria-modal="true" aria-labelledby="nasilBaslik">
    <div class="kutu nasilKutu" id="nasilIcerik"></div>
  </div>
  <!-- Duraklatma örtüsü bilerek yarı saydam: donmuş halkalar arkadan görünsün ki
       oyuncu "kaldığım yer duruyor" bilgisini gözüyle alsın. -->
  <div class="ortu" id="duraklat" hidden role="dialog" aria-modal="true" aria-labelledby="duraklatBaslik">
    <div class="kutu">
      <h2 id="duraklatBaslik">${m.duraklatildi}</h2>
      <p id="duraklatMetin"></p>
      <button id="devamDugme" type="button">${m.devamEt}</button>
      <!-- Bölüm seçiminin ikinci ve asıl giriş noktası. Üst çubuktaki bölüm numarasını
           düğme yapmak denendi ve elendi: orası CANLI dokunma yüzeyi (dinleyici kökte,
           bkz. game/input.ts), yani hızlı dokunan oyuncunun parmağı oyun ortasında
           modal açardı. Duraklatma örtüsünün maliyeti sıfır — örtü açıkken dokunuşlar
           zaten süzülüyor — ve niyet yolu doğru: bölüm değiştirmek isteyen oyuncu
           zaten duraklatmış oyuncudur. -->
      <button id="duraklatSecim" type="button">${m.bolumSec}</button>
    </div>
  </div>
  <div class="ortu" id="bitis" hidden role="dialog" aria-modal="true" aria-labelledby="bitisBaslik">
    <div class="kutu">
      <h2 id="bitisBaslik">${m.kasaAcildi}</h2>
      <p id="bitisMetin"></p>
      <button id="bitisDugme" type="button">${m.bastanOyna}</button>
      <!-- İkinci çıkış: 1000 bölümü bitiren oyuncunun eksik yıldızları olabilir.
           Tek düğmeli bir bitiş ekranı onu tek bir yola mahkûm ediyordu. -->
      <button id="bitisSecim" type="button">${m.bolumSec}</button>
    </div>
  </div>
</div>`;

const bul = <T extends HTMLElement>(kok: ParentNode, id: string): T => {
  const el = kok.querySelector<T>("#" + id);
  if (!el) throw new Error("öğe bulunamadı: " + id);
  return el;
};

export function kabukKur(hedef: HTMLElement, m: Metinler, nasilIcerik: string): Kabuk {
  const diller = (Object.keys(DILLER) as DilKodu[])
    .map(k => `<option value="${k}">${DILLER[k].ad}</option>`).join("");
  hedef.innerHTML = html(m).replace("<!--DILLER-->", diller);
  // "Nasıl oynanır" içeriği ayrı bir modülden gelir (ui/nasil.ts) ve kapatma
  // düğmesi burada eklenir ki bul() onu bulabilsin.
  const ic = hedef.querySelector("#nasilIcerik");
  // Kapatma düğmesi kendi yapışkan şeridinde: kutu kaydırılabilir ve düğme en altta
  // kalınca ilk açılışta görünmüyordu (bkz. styles.css .nasilAlt).
  if (ic) ic.innerHTML = nasilIcerik +
    `<div class="nasilAlt"><button id="nasilKapat" type="button">${m.anladim}</button></div>`;
  const arka = Array.from(
    hedef.querySelectorAll<HTMLElement>(".app > header, .app > .bar, .app > .alan, .app > footer"));
  if (arka.length !== 4) throw new Error("arka plan öğeleri eksik: " + arka.length);
  return {
    arka,
    kok: hedef,
    clock: bul<HTMLButtonElement>(hedef, "clock"),
    clockSayi: bul(hedef, "clockSayi"),
    clockSes: bul(hedef, "clockSes"),
    bar: bul(hedef, "bar"),
    barFill: bul(hedef, "barFill"),
    lvl: bul(hedef, "lvl"),
    lvlToplam: bul(hedef, "lvlToplam"),
    canvas: bul<HTMLCanvasElement>(hedef, "c"),
    hint: bul(hedef, "hint"),
    reset: bul<HTMLButtonElement>(hedef, "reset"),
    resetNot: bul(hedef, "resetNot"),
    bitis: bul(hedef, "bitis"),
    bitisMetin: bul(hedef, "bitisMetin"),
    bitisDugme: bul<HTMLButtonElement>(hedef, "bitisDugme"),
    bitisSecim: bul<HTMLButtonElement>(hedef, "bitisSecim"),
    flas: bul(hedef, "flas"),
    gerisayim: bul(hedef, "gerisayim"),
    kazanc: bul(hedef, "kazanc"),
    kazancSatir1: bul(hedef, "kazancSatir1"),
    kazancSatir2: bul(hedef, "kazancSatir2"),
    duraklat: bul(hedef, "duraklat"),
    duraklatMetin: bul(hedef, "duraklatMetin"),
    devamDugme: bul<HTMLButtonElement>(hedef, "devamDugme"),
    duraklatSecim: bul<HTMLButtonElement>(hedef, "duraklatSecim"),
    ayarAc: bul<HTMLButtonElement>(hedef, "ayarAc"),
    ayarPanel: bul(hedef, "ayarPanel"),
    ayarBaslik: bul(hedef, "ayarBaslik"),
    ayarKapat: bul<HTMLButtonElement>(hedef, "ayarKapat"),
    desenKutu: bul<HTMLInputElement>(hedef, "desenKutu"),
    hareketKutu: bul<HTMLInputElement>(hedef, "hareketKutu"),
    titresimKutu: bul<HTMLInputElement>(hedef, "titresimKutu"),
    titresimSatir: bul(hedef, "titresimSatir"),
    sesKutu: bul<HTMLInputElement>(hedef, "sesKutu"),
    sesSatir: bul(hedef, "sesSatir"),
    dilKutu: bul<HTMLSelectElement>(hedef, "dilKutu"),
    temaKutu: bul<HTMLSelectElement>(hedef, "temaKutu"),
    surumSatir: bul(hedef, "surumSatir"),
    uyari: bul(hedef, "uyari"),
    ozet: bul(hedef, "ozet"),
    yedek: bul(hedef, "yedek"),
    yedekBaslik: bul(hedef, "yedekBaslik"),
    yedekAc: bul<HTMLButtonElement>(hedef, "yedekAc"),
    yedekKapat: bul<HTMLButtonElement>(hedef, "yedekKapat"),
    yedekKod: bul<HTMLTextAreaElement>(hedef, "yedekKod"),
    yedekKopyala: bul<HTMLButtonElement>(hedef, "yedekKopyala"),
    yedekGiris: bul<HTMLTextAreaElement>(hedef, "yedekGiris"),
    yedekYukle: bul<HTMLButtonElement>(hedef, "yedekYukle"),
    yedekNot: bul(hedef, "yedekNot"),
    secim: bul(hedef, "secim"),
    secimBaslik: bul(hedef, "secimBaslik"),
    secimAc: bul<HTMLButtonElement>(hedef, "secimAc"),
    secimKapat: bul<HTMLButtonElement>(hedef, "secimKapat"),
    secimGeri: bul<HTMLButtonElement>(hedef, "secimGeri"),
    secimIleri: bul<HTMLButtonElement>(hedef, "secimIleri"),
    secimAralik: bul(hedef, "secimAralik"),
    secimIzgara: bul(hedef, "secimIzgara"),
    nasil: bul(hedef, "nasil"),
    nasilIcerik: bul(hedef, "nasilIcerik"),
    nasilKapat: bul<HTMLButtonElement>(hedef, "nasilKapat"),
    nasilBaslik: bul(hedef, "nasilBaslik"),
    nasilAc: bul<HTMLButtonElement>(hedef, "nasilAc")
  };
}
