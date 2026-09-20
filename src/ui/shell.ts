// Ekran düzeni (şartname 7. bölüm): üst çubuk, süre çubuğu, oyun alanı, alt çubuk.
export interface Kabuk {
  kok: HTMLElement;
  clock: HTMLElement;
  bar: HTMLElement;
  barFill: HTMLElement;
  lvl: HTMLElement;
  canvas: HTMLCanvasElement;
  hint: HTMLElement;
  reset: HTMLButtonElement;
  bitis: HTMLElement;
  bitisMetin: HTMLElement;
  bitisDugme: HTMLButtonElement;
  flas: HTMLElement;
  ayarAc: HTMLButtonElement;
  ayarPanel: HTMLElement;
  ayarKapat: HTMLButtonElement;
  desenKutu: HTMLInputElement;
  hareketKutu: HTMLInputElement;
  uyari: HTMLElement;
}

const HTML = `
<div class="app">
  <header>
    <h1>Kasa</h1>
    <span class="clock" id="clock" aria-label="Kalan süre">0,0</span>
    <div class="lvl">Level <b id="lvl">1</b></div>
  </header>
  <div class="bar" id="bar"><i id="barFill"></i></div>
  <div class="alan">
    <canvas id="c" aria-label="Oyun alanı. Dokunarak sıradaki halkayı kilitle."></canvas>
    <div class="flas" id="flas" aria-hidden="true"></div>
  </div>
  <footer>
    <span id="hint" role="status" aria-live="polite"></span>
    <button id="ayarAc" type="button" class="ikon" aria-label="Ayarlar">Ayarlar</button>
    <button id="reset" type="button">Baştan başla</button>
  </footer>

  <div class="ortu" id="ayarPanel" hidden role="dialog" aria-modal="true" aria-labelledby="ayarBaslik">
    <div class="kutu">
      <h2 id="ayarBaslik">Ayarlar</h2>
      <p class="uyari" id="uyari"></p>
      <label class="secenek">
        <input type="checkbox" id="desenKutu">
        <span><b>Deseni yumuşat</b><small>Kilitlenmemiş halkalar daha soluk çizilir.</small></span>
      </label>
      <label class="secenek">
        <input type="checkbox" id="hareketKutu">
        <span><b>Hareketi azalt</b><small>Kayıptaki sarsıntı ve ekran flaşı kapanır.</small></span>
      </label>
      <button id="ayarKapat" type="button">Tamam</button>
    </div>
  </div>
  <div class="ortu" id="bitis" hidden role="dialog" aria-modal="true" aria-labelledby="bitisBaslik">
    <div class="kutu">
      <h2 id="bitisBaslik">Kasa açıldı</h2>
      <p id="bitisMetin"></p>
      <button id="bitisDugme" type="button">Baştan oyna</button>
    </div>
  </div>
</div>`;

const bul = <T extends HTMLElement>(kok: ParentNode, id: string): T => {
  const el = kok.querySelector<T>("#" + id);
  if (!el) throw new Error("öğe bulunamadı: " + id);
  return el;
};

export function kabukKur(hedef: HTMLElement): Kabuk {
  hedef.innerHTML = HTML;
  return {
    kok: hedef,
    clock: bul(hedef, "clock"),
    bar: bul(hedef, "bar"),
    barFill: bul(hedef, "barFill"),
    lvl: bul(hedef, "lvl"),
    canvas: bul<HTMLCanvasElement>(hedef, "c"),
    hint: bul(hedef, "hint"),
    reset: bul<HTMLButtonElement>(hedef, "reset"),
    bitis: bul(hedef, "bitis"),
    bitisMetin: bul(hedef, "bitisMetin"),
    bitisDugme: bul<HTMLButtonElement>(hedef, "bitisDugme"),
    flas: bul(hedef, "flas"),
    ayarAc: bul<HTMLButtonElement>(hedef, "ayarAc"),
    ayarPanel: bul(hedef, "ayarPanel"),
    ayarKapat: bul<HTMLButtonElement>(hedef, "ayarKapat"),
    desenKutu: bul<HTMLInputElement>(hedef, "desenKutu"),
    hareketKutu: bul<HTMLInputElement>(hedef, "hareketKutu"),
    uyari: bul(hedef, "uyari")
  };
}
