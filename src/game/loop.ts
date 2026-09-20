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
  /** Bir fizik adımı. false dönerse döngü o kare için adım atmayı bırakır (level değişti). */
  adim: (dt: number) => boolean;
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

  const kare = (now: number): void => {
    raf = requestAnimationFrame(kare);
    const gercek = Math.min((now - son) / 1000, EN_COK_BIRIKME);
    son = now;
    if (gizli) return;

    birikim += gercek;
    // Girdi, adımlardan önce işlenir (bkz. input.ts): dokunuş anı en fazla bir adım kayar.
    while (birikim >= ADIM) {
      birikim -= ADIM;
      if (!adim(ADIM)) { birikim = 0; break; }
    }
    cizim(gercek);
  };

  const gorunurluk = (): void => {
    gizli = document.hidden;
    // Geri dönüşte biriken süre atılır: oyuncu yokken geçen zaman levele yazılmaz.
    if (!gizli) { son = performance.now(); birikim = 0; }
  };

  return {
    basla() {
      if (calisiyor) return;
      calisiyor = true;
      gizli = document.hidden;
      son = performance.now();
      birikim = 0;
      document.addEventListener("visibilitychange", gorunurluk);
      window.addEventListener("blur", gorunurluk);
      window.addEventListener("focus", gorunurluk);
      raf = requestAnimationFrame(kare);
    },
    dur() {
      if (!calisiyor) return;
      calisiyor = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", gorunurluk);
      window.removeEventListener("blur", gorunurluk);
      window.removeEventListener("focus", gorunurluk);
    },
    duraklatildi: () => gizli
  };
}
