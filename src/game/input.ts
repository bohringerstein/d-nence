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

/** Odaktaki öğe düğme/bağlantı/form ise Enter, boşluk ve dokunuş oraya aittir, oyuna değil. */
function etkilesimliMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof Element)) return false;
  return !!hedef.closest("button, a, input, select, textarea, label, [contenteditable='true']");
}

/** Örtü (ayarlar, nasıl oynanır, bitiş) açıkken oyun alanı orası değildir. */
function ortudeMi(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof Element)) return false;
  return !!hedef.closest(".ortu");
}

/**
 * Olayın zaman damgası. Modern tarayıcılarda `performance.now()` ile aynı ölçektedir;
 * olmadığı ya da sıfır geldiği durumda şimdiki zamana düşeriz.
 */
const damga = (e: Event): number =>
  typeof e.timeStamp === "number" && e.timeStamp > 0 ? e.timeStamp : performance.now();

/**
 * Dokunuş dinleyicisi `kok` üzerine kurulur — canvas'a DEĞİL.
 *
 * Eskiden yalnızca canvas dinleniyordu; üst çubuk, süre çubuğu ve alt çubuk ölü
 * bölgeydi. Alt çubuk ipucuna tam satır verilince 65 pikselden 121 piksele çıktı ve
 * ölü bölge ekranın %19'undan %29'una yükseldi — üstelik tamamı, telefonu tutan
 * başparmağın doğal olarak durduğu yerde. Oyuncu halkayı kilitlemek için basıyor,
 * dokunuş hiçbir şey yapmıyordu.
 *
 * Oyunun kendi açıklaması da zaten "ekrana her dokunduğunda" diyor (ui/nasil.ts):
 * artık bu doğru. Düğmeler ve örtüler dışarıda tutulur.
 */
export function girdiBagla(kok: HTMLElement): Girdi {
  let kuyruk: number[] = [];

  const dokun = (e: PointerEvent): void => {
    // Çoklu dokunuş tek harekette iki halka kilitlemesin: yalnızca birincil işaretçi.
    if (!e.isPrimary) return;
    // Yalnızca ASIL düğme. Masaüstünde sağ tık hem bağlam menüsünü açıyor hem de
    // geri alınamaz bir kilit atıyordu; orta tık da öyle. Dokunmatikte ve kalemde
    // button zaten 0'dır, yani bu denetim telefondaki oynanışa dokunmaz.
    if (e.button !== 0) return;
    // Düğmeye basmak kilit değildir; örtü açıkken de ekran oyunun değildir.
    // preventDefault da yalnızca gerçek oyun dokunuşuna uygulanır, yoksa örtünün
    // içindeki kaydırma ve düğme tıklaması bozulur.
    if (etkilesimliMi(e.target) || ortudeMi(e.target)) return;
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

  kok.addEventListener("pointerdown", dokun);
  window.addEventListener("keydown", tus);
  kok.addEventListener("gesturestart", jest);
  kok.addEventListener("dblclick", jest);

  return {
    al(gercekZaman: number) {
      let n = 0;
      while (kuyruk.length && kuyruk[0] <= gercekZaman) { kuyruk.shift(); n++; }
      return n;
    },
    temizle() { kuyruk = []; },
    birak() {
      kok.removeEventListener("pointerdown", dokun);
      window.removeEventListener("keydown", tus);
      kok.removeEventListener("gesturestart", jest);
      kok.removeEventListener("dblclick", jest);
    }
  };
}
