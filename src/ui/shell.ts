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
    <button id="reset" type="button">Baştan başla</button>
  </footer>
  <div class="bitis" id="bitis" hidden role="dialog" aria-modal="true" aria-labelledby="bitisBaslik">
    <div class="bitisKutu">
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
    flas: bul(hedef, "flas")
  };
}
