// Tek kontrol: dokunuş, boşluk ya da Enter. İkinci bir kontrol yoktur.
//
// Dokunuşlar kuyruğa alınır ve fizik adımlarından önce işlenir; böylece dokunuş anı
// en fazla bir adım (8,3 ms) kayar. Prototipte kare hızına bağlıydı: 60 fps'te 16 ms,
// yani zorluk modelinin varsaydığı 60 ms insan sapmasının dörtte biri kadar hata.

export interface Girdi {
  /** Bekleyen dokunuş sayısını alır ve kuyruğu boşaltır. */
  al: () => number;
  /** Bekleyenleri atar (level değişiminde: eski levele basılan tuş yenisine geçmesin). */
  temizle: () => void;
  birak: () => void;
}

/** Odaktaki öğe düğme/bağlantı/form ise Enter ve boşluk oraya aittir, oyuna değil. */
function etkilesimliMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof Element)) return false;
  return !!hedef.closest("button, a, input, select, textarea, [contenteditable='true']");
}

export function girdiBagla(canvas: HTMLCanvasElement): Girdi {
  let bekleyen = 0;

  const dokun = (e: PointerEvent): void => {
    // Çoklu dokunuş tek harekette iki halka kilitlemesin: yalnızca birincil işaretçi.
    if (!e.isPrimary) return;
    e.preventDefault();
    bekleyen++;
  };

  const tus = (e: KeyboardEvent): void => {
    if (e.code !== "Space" && e.code !== "Enter") return;
    if (e.repeat) return;              // basılı tutmak seri kilit üretmesin
    if (etkilesimliMi(e.target)) return;
    e.preventDefault();
    bekleyen++;
  };

  // Çift dokunuşla yakınlaştırmayı ve kaydırmayı canvas üzerinde tamamen kapat.
  // user-scalable=no iOS Safari'de yok sayılır, touch-action ise sayılmaz.
  const jest = (e: Event): void => e.preventDefault();

  canvas.addEventListener("pointerdown", dokun);
  window.addEventListener("keydown", tus);
  canvas.addEventListener("gesturestart", jest);
  canvas.addEventListener("dblclick", jest);

  return {
    al() { const n = bekleyen; bekleyen = 0; return n; },
    temizle() { bekleyen = 0; },
    birak() {
      canvas.removeEventListener("pointerdown", dokun);
      window.removeEventListener("keydown", tus);
      canvas.removeEventListener("gesturestart", jest);
      canvas.removeEventListener("dblclick", jest);
    }
  };
}
