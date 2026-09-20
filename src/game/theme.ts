// Tema renkleri ve erişilebilirlik tercihleri.
// Renkler CSS'te tanımlıdır (tek kaynak); canvas onları hesaplanmış değerlerden okur.

export interface Renkler {
  bg: string; ink: string; ball: string; fail: string; win: string; muted: string;
}

const ANAHTARLAR = ["bg", "ink", "ball", "fail", "win", "muted"] as const;

export function renkleriOku(): Renkler {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Renkler;
  for (const k of ANAHTARLAR) out[k] = cs.getPropertyValue("--" + k).trim();
  return out;
}

/**
 * Hareket azaltma tercihi (şartname 7. bölüm): açıksa sarsıntı ve flaş kapatılır.
 * Prototipte bu hiç uygulanmamıştı.
 */
export function hareketAzalt(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tema ya da hareket tercihi değişince haber verir. */
export function tercihleriIzle(geriCagir: () => void): () => void {
  const sorgular = [
    window.matchMedia("(prefers-color-scheme: dark)"),
    window.matchMedia("(prefers-reduced-motion: reduce)")
  ];
  for (const s of sorgular) s.addEventListener("change", geriCagir);
  return () => { for (const s of sorgular) s.removeEventListener("change", geriCagir); };
}
