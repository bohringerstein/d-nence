// Sabit adımlı oyun döngüsü (şartname 3. bölüm).
//
// Fizik sabit 1/120 sn adımlarla ilerler; çizim ekran yenileme hızında kalır.
// Level süreleri bu adımla hesaplanmıştır ve yön değiştiren halkalar adım
// büyüklüğüne duyarlıdır, bu yüzden değişken dt kabul edilmez.

// Fizik adımı tek kaynaktan gelir (src/core/rings.ts): tablo bu değerle üretildi
// ve yön değiştiren halkalar adım büyüklüğüne duyarlı.
export { ADIM } from "../core/index.ts";
import { ADIM } from "../core/index.ts";

/**
 * Biriktiricinin üst sınırı. Sekme arkaplana alınıp geri gelince ya da cihaz uyandığında
 * saat büyük bir sıçrama gösterir; sınır olmazsa tek karede yüzlerce fizik adımı çalışır
 * (ya donma, ya anında kayıp). Prototipte biriktirici yoktu, bu tuzak da görünmüyordu.
 */
export const EN_COK_BIRIKME = 0.25;

export interface DonguGeriCagirmalari {
  /**
   * Bir fizik adımı. false dönerse döngü o kare için adım atmayı bırakır (level değişti).
   *
   * `gercekZaman`, bu adımın SONUNUN karşılık geldiği gerçek dünya anıdır
   * (performance.now() ölçeğinde, ms). Girdi bu sayede kare sınırına yuvarlanmadan,
   * kendi zaman damgasının düştüğü adımda işlenir (bkz. game/input.ts).
   */
  adim: (dt: number, gercekZaman: number) => boolean;
  /** Görsel sönümleme ve çizim; gerçek geçen süreyi alır. */
  cizim: (dt: number) => void;
  /**
   * Donukluk çözüldüğünde çağrılır (sekmeye dönüş, odak, ya da ekrana dokunuş).
   *
   * Neden haberin DÖNGÜDEN gelmesi gerekiyor: donukluğu çözen olay `focus` olmak
   * zorunda değil. Eşleşmeyen bir `blur` sonrası tek çıkış yolu DOKUNUŞTUR ve o
   * dokunuş `main.ts`'in `focus` dinleyicisini tetiklemez — yani oyun geri sayım
   * olmadan canlanır ve aynı dokunuş bedava bir kilit olur, çoğu durumda anında
   * kayıp. Kod tabanındaki bütün öbür devam yolları geri sayımdan geçiyordu; tek
   * istisna buydu.
   */
  cozuldu?: () => void;
}

export interface Dongu {
  basla: () => void;
}

export function dongu({ adim, cizim, cozuldu }: DonguGeriCagirmalari): Dongu {
  let son = 0;
  let birikim = 0;
  let calisiyor = false;
  let gizli = false;
  /**
   * Pencere odakta değil (başka bir uygulama üstte, bölünmüş ekran, bildirim paneli).
   *
   * `document.hidden` bunu YAKALAMAZ: sekme hâlâ "görünür"dür. Ama tarayıcı kareyi
   * saniyede bire kısar ve her kare biriktiriciden EN_COK_BIRIKME (0,25 sn) alır —
   * yani 60 saniyelik bir dalgınlık 15 saniyelik fizik demekti. Medyan bir bölümü
   * tamamen yakmak için 43,6 saniye örtülü kalmak yetiyordu ve bu, kaldırmak için
   * emek harcadığımız kayıp türünü (süreye yenilme) arka kapıdan geri getiriyordu.
   */
  let pencereDisinda = false;

  /**
   * YALNIZCA `npm run dev`: gizli sekmede de kare üretmek için Web Worker zamanlayıcısı.
   *
   * Uzun otomatik oynanış testleri saatler sürüyor ve tarayıcı, sekme görünür
   * olmadığında `requestAnimationFrame`'i TAMAMEN durduruyor — `setTimeout` da gizli
   * sekmede saniyede bire, bir süre sonra dakikada bire kısılıyor. Kısılmayan tek
   * zamanlayıcı Worker içindekidir. Bu dal yalnızca `__odakYoksay` açıkken kurulur ve
   * `import.meta.env.DEV` false olduğu için üretim paketinde hiç yer almaz.
   *
   * Fizik, girdi ve zamanlama aynen çalışır; değişen tek şey kareyi kimin tetiklediği.
   */
  let worker: Worker | null = null;
  const workerKur = (): void => {
    // Koşul SABİT olmak zorunda. Eskiden `!donmaYoksay()` yazıyordu; esbuild fonksiyon
    // çağrısını satır içine almadığı için gövde ölü kod sayılmıyordu ve `new Worker`,
    // `URL.createObjectURL`, Blob kodu ile `donence:tik` ÜRETİM PAKETİNDE kalıyordu
    // (doğrulandı). Çalışma zamanında zararsızdı ama bu dosyanın kendi yorumu
    // "üretim paketinde hiç yer almaz" diyor; o yorum yanlış hale gelmişti.
    if (!import.meta.env.DEV) return;
    if (worker || !donmaYoksay()) return;
    const kod = "let id; onmessage = e => { clearInterval(id);" +
      " if (e.data) id = setInterval(() => postMessage(0), 4); };";
    worker = new Worker(URL.createObjectURL(new Blob([kod], { type: "text/javascript" })));
    worker.onmessage = () => {
      if (document.hidden) kare(performance.now(), true);
      // Otomatik oynanış testinin zamanlayıcısı. Gizli sekmede `setTimeout` 1 saniyeye
      // kısılıyor (ölçüldü: 10 ms istendi, 1000 ms geldi) ve test robotunun 60 ms'lik
      // hassasiyeti buna dayanamaz. Worker mesajları kısılmadığı için tik buradan verilir.
      window.dispatchEvent(new Event("donence:tik"));
    };
    worker.postMessage(true);
  };

  const kare = (now: number, workerdan = false): void => {
    if (!workerdan) requestAnimationFrame(kare as FrameRequestCallback);
    const gercek = Math.min((now - son) / 1000, EN_COK_BIRIKME);
    son = now;
    if (gizli) return;

    birikim += gercek;
    // Fizik saati gerçek zamanın `birikim` kadar gerisindedir; her adım onu ADIM kadar
    // ileri taşır. Girdi kendi zaman damgasının düştüğü adımda işlenir (bkz. input.ts).
    let fizikGercek = now - birikim * 1000;
    while (birikim >= ADIM) {
      birikim -= ADIM;
      fizikGercek += ADIM * 1000;
      if (!adim(ADIM, fizikGercek)) { birikim = 0; break; }
    }
    cizim(gercek);
  };

  const gorunurluk = (): void => {
    // Olaya DEĞİL gerçeğe bak. Önceki hâl yalnızca `blur`/`focus` olaylarının yazdığına
    // güveniyordu; eşleşmeyen tek bir `blur` (bfcache dönüşü, IME paneli, bazı Android
    // WebView'ları) kalıcı kilitlenme üretiyordu ve çıkış yolu YALNIZCA bir `focus`
    // olayıydı — tıklamak bile temizlemiyordu. Tarayıcıda görüldü: oyun sessizce
    // donuyor, ekranda hiç saymayan bir geri sayım rakamı kalıyor ve donmuş oyun ile
    // başlamak üzere olan oyun ayırt edilemiyordu.
    const oncekiGizli = gizli;
    pencereDisinda = odaksizMi();
    gizli = donmaYoksay() ? false : (document.hidden || pencereDisinda);
    // Geri dönüşte biriken süre atılır: oyuncu yokken geçen zaman levele yazılmaz.
    if (!gizli) {
      son = performance.now();
      birikim = 0;
      if (oncekiGizli) cozuldu?.();
    }
  };

  /** Başlangıç durumu; hasFocus her ortamda tanımlı değil. */
  /**
   * YALNIZCA `npm run dev`: donma (hem odak hem görünürlük kaynaklı) atlanır.
   *
   * Uzun otomatik oynanış testlerinde pencerenin saatlerce ön planda tutulması
   * gerekmesin diye. Fizik, girdi ve zamanlama aynen çalışır; atlanan tek şey
   * duraklatmanın kendisidir — ki onun doğru çalıştığı ayrıca sınanıyor. Üretim
   * paketinde `import.meta.env.DEV` false olduğu için bu dal tamamen düşer.
   */
  const donmaYoksay = (): boolean => {
    if (!import.meta.env.DEV) return false;
    if ((globalThis as unknown as { __odakYoksay?: boolean }).__odakYoksay) return true;
    // Sayfa yüklenirken global henüz kurulamaz; bayrak localStorage'da da tutulur.
    try { return localStorage.getItem("donence:odakYoksay") === "1"; } catch { return false; }
  };

  const odaksizMi = (): boolean => {
    if (donmaYoksay()) return false;
    return typeof document.hasFocus === "function" ? !document.hasFocus() : false;
  };

  const odakGitti = (): void => {
    // Yalnız DEV geçersiz kılması bu dalı atlar. Eskiden `odaksizMi() === false`
    // yazıyordu ve bu ÜRETİMDE de davranışı değiştiriyordu: `document.hasFocus`
    // tanımsız olan ortamlarda `odaksizMi()` false döndüğü için donma tamamen
    // kapanıyordu, ve `blur` anında `hasFocus()` hâlâ true dönen tarayıcılarda donma
    // bir `visibilitychange`'e kadar gecikiyordu — oysa bu kolun var olma sebebi tam
    // olarak `visibilitychange`'in YAKALAMADIĞI durum.
    if (donmaYoksay()) return;
    pencereDisinda = true; gizli = true;
  };
  const odakGeldi = (): void => { gorunurluk(); };
  /** Dokunuş her zaman çözer: oyuncu ekrana bastıysa oyun donuk kalmamalı. */
  const dokunusla = (): void => { if (gizli) gorunurluk(); };

  return {
    basla() {
      if (calisiyor) return;
      calisiyor = true;
      pencereDisinda = odaksizMi();
      gizli = donmaYoksay() ? false : (document.hidden || pencereDisinda);
      son = performance.now();
      birikim = 0;
      document.addEventListener("visibilitychange", gorunurluk);
      window.addEventListener("blur", odakGitti);
      window.addEventListener("focus", odakGeldi);
      window.addEventListener("pointerdown", dokunusla, true);
      workerKur();                       // DEV: gizli sekmede kare üreticisi
      requestAnimationFrame(kare);
    }
  };
}
