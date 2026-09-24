// "Nasıl oynanır" ekranının yapısı. Metinler src/dil/ altında.
//
// Alt çubuktaki ipuçları geçici ve tek satırlık; bir mekaniği ilk göründüğü levelde
// bir kez anlatıp kayboluyorlar. Oyuncunun "kırmızı nokta neydi?" diye geri
// dönebileceği kalıcı bir yer gerekiyordu.
import type { Metinler, GostergeAnahtari } from "../dil/index.ts";

/** Göstergedeki simgeler oyunun çizimiyle aynı görünmeli (bkz. game/render.ts). */
const SIMGE: Record<GostergeAnahtari, string> = {
  // Sarı kama: topun çıkış yolu
  kama: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12 L36 4 L36 20 Z" fill="var(--ball)" opacity="0.35"/><circle cx="7" cy="12" r="3.5" fill="var(--ball)"/></svg>`,
  // Yön değiştiren halka: çizginin üstünde kırmızı nokta
  flip: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h32" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="20" cy="12" r="4" fill="var(--fail)"/></svg>`,
  // Baştan kilitli halka: çizginin üstünde küçük kare. Oyunda olduğu gibi zemin renginde
  // dolu ve mürekkeple çevrili — mürekkeple doldurulsaydı mürekkep rengindeki halkanın
  // üstünde görünmezdi (oyunda tam olarak bu oluyordu, bkz. game/render.ts).
  preLocked: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h32" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/><rect x="15.25" y="7.25" width="9.5" height="9.5" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/></svg>`,
  // İki kapılı halka: iki ayrı boşluk
  gaps2: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12h9M18 12h6M30 12h7" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  // Hızlanıp yavaşlayan halka. Eskiden DALGALI bir çizgiydi ve oyuncuya halkanın
  // şeklinin dalgalı olduğunu ima ediyordu — oysa dalgalanan şey hız, halka düz.
  // Oyuncu ekranda dalgalı bir halka arayıp bulamıyordu. Yeni simge aralıkları
  // değişen noktalar: sık = yavaş, seyrek = hızlı.
  wobble: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h33" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/><circle cx="4" cy="12" r="2.3" fill="var(--ink)"/><circle cx="8" cy="12" r="2.3" fill="var(--ink)"/><circle cx="13" cy="12" r="2.3" fill="var(--ink)"/><circle cx="20" cy="12" r="2.3" fill="var(--ink)"/><circle cx="28" cy="12" r="2.3" fill="var(--ink)"/><circle cx="33" cy="12" r="2.3" fill="var(--ink)"/><circle cx="37" cy="12" r="2.3" fill="var(--ink)"/></svg>`,
  // Duraklatma: üst çubuktaki sayacın yanındaki iki çubuğun aynısı (bkz. styles.css .duraklatIm)
  duraklat: `<svg viewBox="0 0 40 24" aria-hidden="true"><rect x="14" y="5" width="4" height="14" rx="1" fill="var(--ink)"/><rect x="22" y="5" width="4" height="14" rx="1" fill="var(--ink)"/></svg>`
};

/** Göstergedeki satır sırası. Simge anahtarları bu sırayla çizilir. */
const SIRA: GostergeAnahtari[] = ["kama", "flip", "preLocked", "gaps2", "wobble", "duraklat"];

export function nasilHtml(m: Metinler): string {
  const satirlar = SIRA.map(k => {
    const s = m.nasil.satir[k];
    return `<li data-anahtar="${k}"><i>${SIMGE[k]}</i><span><b class="ad">${s.baslik}</b>${s.metin}</span></li>`;
  }).join("\n  ");

  return `
<h2 id="nasilBaslik" tabindex="-1">${m.nasil.baslik}</h2>

<p class="giris kisaGiris">${m.nasil.kisaGiris}</p>

<p class="giris tamGiris">${m.nasil.giris}</p>

<ul class="gosterge">
  ${satirlar}
</ul>

<p class="giris yildizNot">${m.nasil.yildizlar}</p>

<p class="uyari kisaUyari">${m.nasil.kisaUyari}</p>

<p class="uyari tamUyari">${m.nasil.uyari}</p>
`;
}
