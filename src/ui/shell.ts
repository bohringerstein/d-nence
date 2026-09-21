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
  bar: HTMLElement;
  barFill: HTMLElement;
  lvl: HTMLElement;
  /** "/1000" soneki: 1000 bölümlük bir oyunda nerede olduğun görünsün. */
  lvlToplam: HTMLElement;
  canvas: HTMLCanvasElement;
  hint: HTMLElement;
  reset: HTMLButtonElement;
  bitis: HTMLElement;
  bitisMetin: HTMLElement;
  bitisDugme: HTMLButtonElement;
  flas: HTMLElement;
  /** Devam ederken çalışan 3-2-1 sayacı. */
  gerisayim: HTMLElement;
  duraklat: HTMLElement;
  duraklatMetin: HTMLElement;
  devamDugme: HTMLButtonElement;
  ayarAc: HTMLButtonElement;
  ayarPanel: HTMLElement;
  ayarKapat: HTMLButtonElement;
  desenKutu: HTMLInputElement;
  hareketKutu: HTMLInputElement;
  titresimKutu: HTMLInputElement;
  titresimSatir: HTMLElement;
  sesKutu: HTMLInputElement;
  /** Tarayıcı ses üretemiyorsa satır hiç gösterilmez. */
  sesSatir: HTMLElement;
  dilKutu: HTMLSelectElement;
  uyari: HTMLElement;
  /** Ayarlar panelindeki ilerleme özeti (bölüm + yıldız). */
  ozet: HTMLElement;
  nasil: HTMLElement;
  nasilIcerik: HTMLElement;
  nasilKapat: HTMLButtonElement;
  nasilAc: HTMLButtonElement;
  /** Örtü açıkken inert edilen arka plan öğeleri (üst çubuk, süre çubuğu, oyun alanı, alt çubuk). */
  arka: HTMLElement[];
}

const html = (m: Metinler): string => `
<div class="app">
  <header>
    <h1>Dönence</h1>
    <!-- Sayacın kendisi duraklatma düğmesidir. Ayrı bir düğme koymuyoruz: ekranın
         tamamı dokunma alanı olduğu için alt köşeye eklenen her düğme, başparmağın
         durduğu yere ölü bölge açar. Sayaç ise üst çubukta ve eşleşme birebir:
         zamanı durdurmak için zamana dokun. -->
    <button class="clock" id="clock" type="button" aria-label="${m.duraklatDugmesi}">
      <i class="duraklatIm" aria-hidden="true"></i><span id="clockSayi">0,0</span>
    </button>
    <div class="lvl">${m.levelOneki} <b id="lvl">1</b><small id="lvlToplam"></small></div>
  </header>
  <div class="bar" id="bar"><i id="barFill"></i></div>
  <div class="alan">
    <canvas id="c" aria-label="${m.oyunAlani}"></canvas>
    <div class="flas" id="flas" aria-hidden="true"></div>
    <div class="gerisayim" id="gerisayim" aria-hidden="true"></div>
  </div>
  <footer>
    <span id="hint" role="status" aria-live="polite"></span>
    <button id="ayarAc" type="button" class="ikon" aria-label="${m.ayarlar}">${m.ayarlar}</button>
  </footer>

  <div class="ortu" id="ayarPanel" hidden role="dialog" aria-modal="true" aria-labelledby="ayarBaslik">
    <div class="kutu">
      <h2 id="ayarBaslik">${m.ayarlar}</h2>
      <!-- Toplanan yıldız oyun boyunca hiçbir yerde görünmüyordu: yalnızca 1000. bölümü
           bitiren oyuncu toplamını öğreniyordu. Birikimin görünmesi, 1000 bölümlük bir
           oyunda devam etme sebebinin kendisi. -->
      <p class="ozet" id="ozet"></p>
      <p class="uyari" id="uyari"></p>
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
        <span><b>${m.dil}</b></span>
        <select id="dilKutu"><!--DILLER--></select>
      </label>
      <button id="nasilAc" type="button">${m.nasilOynanir}</button>
      <!-- "Baştan başla" alt çubuktaydı: Level 1'e döndüren bir eylem, hızlı hızlı
           dokunulan bir oyunda başparmağın durduğu sağ alt köşede duruyordu. Ekranın
           tamamı dokunma alanı olunca oraya kazara basma riski arttı; seyrek ve geri
           alınamaz bir eylem olduğu için ayarlara taşındı. -->
      <button id="reset" type="button">${m.bastanBasla}</button>
      <button id="ayarKapat" type="button">${m.tamam}</button>
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
    </div>
  </div>
  <div class="ortu" id="bitis" hidden role="dialog" aria-modal="true" aria-labelledby="bitisBaslik">
    <div class="kutu">
      <h2 id="bitisBaslik">${m.kasaAcildi}</h2>
      <p id="bitisMetin"></p>
      <button id="bitisDugme" type="button">${m.bastanOyna}</button>
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
    bar: bul(hedef, "bar"),
    barFill: bul(hedef, "barFill"),
    lvl: bul(hedef, "lvl"),
    lvlToplam: bul(hedef, "lvlToplam"),
    canvas: bul<HTMLCanvasElement>(hedef, "c"),
    hint: bul(hedef, "hint"),
    reset: bul<HTMLButtonElement>(hedef, "reset"),
    bitis: bul(hedef, "bitis"),
    bitisMetin: bul(hedef, "bitisMetin"),
    bitisDugme: bul<HTMLButtonElement>(hedef, "bitisDugme"),
    flas: bul(hedef, "flas"),
    gerisayim: bul(hedef, "gerisayim"),
    duraklat: bul(hedef, "duraklat"),
    duraklatMetin: bul(hedef, "duraklatMetin"),
    devamDugme: bul<HTMLButtonElement>(hedef, "devamDugme"),
    ayarAc: bul<HTMLButtonElement>(hedef, "ayarAc"),
    ayarPanel: bul(hedef, "ayarPanel"),
    ayarKapat: bul<HTMLButtonElement>(hedef, "ayarKapat"),
    desenKutu: bul<HTMLInputElement>(hedef, "desenKutu"),
    hareketKutu: bul<HTMLInputElement>(hedef, "hareketKutu"),
    titresimKutu: bul<HTMLInputElement>(hedef, "titresimKutu"),
    titresimSatir: bul(hedef, "titresimSatir"),
    sesKutu: bul<HTMLInputElement>(hedef, "sesKutu"),
    sesSatir: bul(hedef, "sesSatir"),
    dilKutu: bul<HTMLSelectElement>(hedef, "dilKutu"),
    uyari: bul(hedef, "uyari"),
    ozet: bul(hedef, "ozet"),
    nasil: bul(hedef, "nasil"),
    nasilIcerik: bul(hedef, "nasilIcerik"),
    nasilKapat: bul<HTMLButtonElement>(hedef, "nasilKapat"),
    nasilAc: bul<HTMLButtonElement>(hedef, "nasilAc")
  };
}
