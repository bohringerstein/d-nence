// Tek kontrol: dokunuş, boşluk ya da Enter. İkinci bir kontrol yoktur.
//
// Dokunuşlar ZAMAN DAMGASIYLA kuyruğa alınır ve fizik saati o ana ulaştığında işlenir.
//
// Neden: tarayıcı dokunuş olayını anında üretir ama oyun onu ancak bir sonraki animasyon
// karesinde okuyabilir. Damga kullanılmazsa dokunuş o karenin başına yuvarlanır ve
// 60 fps'te ±8,3 ms sapar — en zor bölümlerde oyuncunun TÜM hata payının (25 ms) üçte biri.
// Bu, oyuncunun kendi hatası değil motorun eklediği hatadır ve ekran hızına göre değişir.
// Damgayla oyun, girdi açısından kare hızından bağımsız olur.

export interface Girdi {
  /**
   * Fizik saati `gercekZaman`'a (performance.now() ölçeğinde, ms) ulaştığında
   * işlenmesi gereken dokunuş sayısını alır ve onları kuyruktan çıkarır.
   */
  al: (gercekZaman: number) => number;
  /** Bekleyenleri atar (level değişiminde: eski levele basılan tuş yenisine geçmesin). */
  temizle: () => void;
  birak: () => void;
}

/** Odaktaki öğe düğme/bağlantı/form ise Enter ve boşluk oraya aittir, oyuna değil. */
function etkilesimliMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof Element)) return false;
  return !!hedef.closest("button, a, input, select, textarea, [contenteditable='true']");
}

/**
 * Olayın zaman damgası. Modern tarayıcılarda `performance.now()` ile aynı ölçektedir;
 * olmadığı ya da sıfır geldiği durumda şimdiki zamana düşeriz.
 */
const damga = (e: Event): number =>
  typeof e.timeStamp === "number" && e.timeStamp > 0 ? e.timeStamp : performance.now();

export function girdiBagla(canvas: HTMLCanvasElement): Girdi {
  let kuyruk: number[] = [];

  const dokun = (e: PointerEvent): void => {
    // Çoklu dokunuş tek harekette iki halka kilitlemesin: yalnızca birincil işaretçi.
    if (!e.isPrimary) return;
    e.preventDefault();
    kuyruk.push(damga(e));
  };

  const tus = (e: KeyboardEvent): void => {
    if (e.code !== "Space" && e.code !== "Enter") return;
    if (e.repeat) return;              // basılı tutmak seri kilit üretmesin
    if (etkilesimliMi(e.target)) return;
    e.preventDefault();
    kuyruk.push(damga(e));
  };

  // Çift dokunuşla yakınlaştırmayı ve kaydırmayı canvas üzerinde tamamen kapat.
  // user-scalable=no iOS Safari'de yok sayılır, touch-action ise sayılmaz.
  const jest = (e: Event): void => e.preventDefault();

  canvas.addEventListener("pointerdown", dokun);
  window.addEventListener("keydown", tus);
  canvas.addEventListener("gesturestart", jest);
  canvas.addEventListener("dblclick", jest);

  return {
    al(gercekZaman: number) {
      let n = 0;
      while (kuyruk.length && kuyruk[0] <= gercekZaman) { kuyruk.shift(); n++; }
      return n;
    },
    temizle() { kuyruk = []; },
    birak() {
      canvas.removeEventListener("pointerdown", dokun);
      window.removeEventListener("keydown", tus);
      canvas.removeEventListener("gesturestart", jest);
      canvas.removeEventListener("dblclick", jest);
    }
  };
}
