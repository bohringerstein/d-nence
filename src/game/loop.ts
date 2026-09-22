// Sabit adımlı oyun döngüsü (şartname 3. bölüm).
//
// Fizik sabit 1/120 sn adımlarla ilerler; çizim ekran yenileme hızında kalır.
// Level süreleri bu adımla hesaplanmıştır ve yön değiştiren halkalar adım
// büyüklüğüne duyarlıdır, bu yüzden değişken dt kabul edilmez.

/** Fizik adımı. Level tablosu bu değerle üretildi; değiştirilirse tablo yeniden üretilmelidir. */
export const ADIM = 1 / 120;

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
}

export interface Dongu {
  basla: () => void;
  dur: () => void;
  /** Duraklatılmış mı (sekme arkaplanda). */
  duraklatildi: () => boolean;
}

export function dongu({ adim, cizim }: DonguGeriCagirmalari): Dongu {
  let raf = 0;
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

  const kare = (now: number): void => {
    raf = requestAnimationFrame(kare);
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
    gizli = document.hidden || pencereDisinda;
    // Geri dönüşte biriken süre atılır: oyuncu yokken geçen zaman levele yazılmaz.
    if (!gizli) { son = performance.now(); birikim = 0; }
  };

  /** Başlangıç durumu; hasFocus her ortamda tanımlı değil. */
  const odaksizMi = (): boolean =>
    typeof document.hasFocus === "function" ? !document.hasFocus() : false;

  const odakGitti = (): void => { pencereDisinda = true; gorunurluk(); };
  const odakGeldi = (): void => { pencereDisinda = false; gorunurluk(); };

  return {
    basla() {
      if (calisiyor) return;
      calisiyor = true;
      pencereDisinda = odaksizMi();
      gizli = document.hidden || pencereDisinda;
      son = performance.now();
      birikim = 0;
      document.addEventListener("visibilitychange", gorunurluk);
      window.addEventListener("blur", odakGitti);
      window.addEventListener("focus", odakGeldi);
      raf = requestAnimationFrame(kare);
    },
    dur() {
      if (!calisiyor) return;
      calisiyor = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("blur", odakGitti);
      window.removeEventListener("focus", odakGeldi);
    },
    duraklatildi: () => gizli
  };
}
