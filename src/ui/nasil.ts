// "Nasıl oynanır" ekranının içeriği.
//
// Alt çubuktaki ipuçları geçici ve tek satırlık; bir mekaniği ilk göründüğü levelde
// bir kez anlatıp kayboluyorlar. Oyuncunun "kırmızı nokta neydi?" diye geri
// dönebileceği kalıcı bir yer gerekiyordu.

/** Göstergedeki simgeler oyunun çizimiyle aynı görünmeli (bkz. game/render.ts). */
const SIMGE = {
  // Yön değiştiren halka: çizginin üstünde kırmızı nokta
  flip: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h32" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="20" cy="12" r="4" fill="var(--fail)"/></svg>`,
  // Baştan kilitli halka: çizginin üstünde küçük kare
  preLocked: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12h32" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/><rect x="16" y="8" width="8" height="8" fill="var(--ink)"/></svg>`,
  // İki kapılı halka: iki ayrı boşluk
  gaps2: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12h9M18 12h6M30 12h7" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  // Hızlanıp yavaşlayan halka: dalgalı çizgi
  wobble: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12q5-6 10 0t10 0 10 0" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  // Sarı kama: topun çıkış yolu
  kama: `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M4 12 L36 4 L36 20 Z" fill="var(--ball)" opacity="0.35"/><circle cx="7" cy="12" r="3.5" fill="var(--ball)"/></svg>`
};

const satir = (simge: string, baslik: string, metin: string): string =>
  `<li><i>${simge}</i><span><b class="ad">${baslik}</b>${metin}</span></li>`;

export const NASIL_HTML = `
<h2 id="nasilBaslik">Nasıl oynanır</h2>

<p class="giris">Ekrana her dokunduğunda <b>dıştan içe</b> sıradaki halka olduğu yerde kilitlenir.
Kilitli halkaların boşluklarının kesiştiği yer <b>sarı kama</b>dır: topun çıkış yolu.
Her yeni kilit bu yolu ancak <b>daraltır</b>. Yol topun geçemeyeceği kadar daralırsa kaybedersin.
Tüm halkalar kilitlenince kasa açılır.</p>

<ul class="gosterge">
  ${satir(SIMGE.kama, "Sarı kama", "Şu anki çıkış yolun. Sonraki halkanın boşluğunu buna hizala. Kırmızı kesik çizgili kama, topun geçemeyeceği kadar dardır.")}
  ${satir(SIMGE.flip, "Kırmızı nokta", "Bu halka ara ara <b>yön değiştirir</b>. Dönüşünü izlemeden dokunma.")}
  ${satir(SIMGE.preLocked, "Küçük kare", "Bu halka <b>baştan kilitli</b>. Yolun yönünü o belirler, sen değiştiremezsin.")}
  ${satir(SIMGE.gaps2, "İki boşluk", "Halkanın <b>iki kapısı</b> var. Hangisini kullandığın sonraki halkalar için kalan payı değiştirir.")}
  ${satir(SIMGE.wobble, "Dalgalı halka", "Sabit hızda dönmez, <b>hızlanıp yavaşlar</b>. Yavaşladığı anı bekle.")}
</ul>

<p class="giris"><b>Yıldızlar hızı değil hassasiyeti ölçer.</b> Kasa açıldığında kalan yol ne kadar
genişse o kadar yıldız alırsın. Hızlı bitirmek tek başına yıldız kazandırmaz; süre yalnızca
eşit yıldızda rekoru belirler.</p>

<p class="uyari">Kasa'da iç içe dönen halkalar var. Işığa duyarlı epilepsi ya da desenlerden
rahatsız olma geçmişin varsa, <b>Ayarlar</b>'dan &ldquo;Deseni yumuşat&rdquo; seçeneğini açabilir
ve ara vererek oynayabilirsin.</p>
`;
