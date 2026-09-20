// Tema renkleri ve erişilebilirlik tercihleri.
// Renkler CSS'te tanımlıdır (tek kaynak); canvas onları hesaplanmış değerlerden okur.

export interface Renkler {
  bg: string; ink: string; ball: string; fail: string; win: string; muted: string;
}

const ANAHTARLAR = ["bg", "ink", "ball", "fail", "win", "muted"] as const;

/**
 * Yedek palet: styles.css'teki değerlerin aynısı.
 *
 * Neden gerekli: canvas'ta ~ctx.fillStyle = ""~ hata vermez, SESSİZCE yok sayılır ve
 * önceki değer (varsayılan siyah) kalır. CSS henüz uygulanmamışken renkler okunursa
 * tüm oyun siyah beyaz çizilir. Telefonda tam olarak bu oldu: geliştirme sunucusunda
 * CSS ayrı bir istekle geliyor ve yavaş bağlantıda ilk okumaya yetişmiyor.
 */
const YEDEK: Record<"acik" | "koyu", Renkler> = {
  acik: { bg: "#E9EEF0", ink: "#1D3440", ball: "#E89B00", fail: "#E5484D", win: "#2E9E6A", muted: "#5A6E79" },
  koyu: { bg: "#13232B", ink: "#DCE6EA", ball: "#FFC93C", fail: "#FF6369", win: "#4CC38A", muted: "#7F98A4" }
};

const koyuMu = (): boolean => {
  const el = document.documentElement.getAttribute("data-theme");
  if (el === "dark") return true;
  if (el === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/** Geçerli bir CSS rengi mi? Boş ya da bozuk değerler yedeğe düşmeli. */
const gecerli = (v: string): boolean => v.length > 0 && v !== "transparent";

export function renkleriOku(): Renkler {
  const yedek = YEDEK[koyuMu() ? "koyu" : "acik"];
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Renkler;
  for (const k of ANAHTARLAR) {
    const v = cs.getPropertyValue("--" + k).trim();
    out[k] = gecerli(v) ? v : yedek[k];
  }
  return out;
}

/** CSS'in gerçekten uygulanıp uygulanmadığı: tek bir değişkene bakmak yeter. */
export const renklerHazir = (): boolean =>
  gecerli(getComputedStyle(document.documentElement).getPropertyValue("--ink").trim());

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
