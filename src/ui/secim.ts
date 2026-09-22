// Bölüm seçimi: açılan her bölüme geri dönebilme.
//
// Neden var: oyunun yıldız sistemi ölçülebilir biçimde ölü bir para birimiydi. Sıradan
// bir oyuncu bölümlerin %68'ini 1 yıldızla bitiriyor ve 1000 bölümün 294'ünde 3 yıldız
// 60 denemede bir kez bile çıkmıyor — ama bitirilen bir bölüme DÖNMENİN yolu yoktu,
// yani toplanan yıldız hiçbir zaman düzeltilemiyordu. Yıldızı hedef yapan şey, ona
// tekrar gidebilmek.
//
// Sayfalama şart: 1000 düğmeyi birden çizmek hem telefonu yorar hem de içinde
// kaybolunur. Sayfa boyu 100 çünkü oyuncunun zihnindeki birim de yüzlük dilim.
import type { Metinler } from "../dil/index.ts";
import { sayi } from "../dil/index.ts";
import type { Best } from "../core/index.ts";

export const SAYFA_BOYU = 100;

export const sayfaSayisi = (toplam: number): number => Math.max(1, Math.ceil(toplam / SAYFA_BOYU));

/** n numaralı bölümün bulunduğu sayfa (0 tabanlı). */
export const sayfasi = (n: number): number => Math.floor((n - 1) / SAYFA_BOYU);

export interface IzgaraGirdi {
  m: Metinler;
  /** 0 tabanlı sayfa. */
  sayfa: number;
  toplam: number;
  /** Ulaşılan en uzak bölüm; buraya kadarı açık. */
  enUzak: number;
  bests: Record<number, Best>;
  /** Şu an oynanan bölüm; vurgulanır. */
  simdiki: number;
}

/** Sayfadaki ilk ve son bölüm numarası (dahil). */
export function aralik(sayfa: number, toplam: number): [number, number] {
  const bas = sayfa * SAYFA_BOYU + 1;
  return [bas, Math.min(toplam, bas + SAYFA_BOYU - 1)];
}

/** Yıldızları düğmenin içinde gösterilecek biçimde: "★★☆", hiç oynanmadıysa boş. */
const yildizlar = (b: Best | undefined): string =>
  b ? "★".repeat(b.s) + "☆".repeat(3 - b.s) : "";

/**
 * Sayfanın düğmeleri.
 *
 * Kilitli bölümler `disabled`: görünmeleri "burada devamı var" demek, tıklanabilmeleri
 * ise ilerlemeyi anlamsız kılardı.
 */
export function izgaraHtml(g: IzgaraGirdi): string {
  const [bas, son] = aralik(g.sayfa, g.toplam);
  const parca: string[] = [];
  for (let n = bas; n <= son; n++) {
    const acik = n <= g.enUzak;
    const b = g.bests[n];
    const sinif = ["secimDugme"];
    if (n === g.simdiki) sinif.push("simdiki");
    if (b) sinif.push("bitti");
    const etiket = acik
      ? g.m.bolumEtiketi(n, b ? b.s : 0)
      : g.m.bolumKilitli(n);
    parca.push(
      `<button type="button" class="${sinif.join(" ")}" data-n="${n}"` +
      `${acik ? "" : " disabled"}${n === g.simdiki ? ' aria-current="true"' : ""}` +
      ` aria-label="${etiket}">` +
      `<b aria-hidden="true">${sayi(g.m, n, 0)}</b>` +
      `<i aria-hidden="true">${acik ? yildizlar(b) : "·"}</i>` +
      `</button>`);
  }
  return parca.join("");
}
