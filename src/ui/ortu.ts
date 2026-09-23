// Örtü açma/kapama: üç küçük fonksiyon, bir tek kural — SIRA.
//
// Bu dosya iki kez aynı sıra hatasından doğdu.
//
// BİRİNCİ HATA: kod örtüyü `hidden = true` ile gizleyip ardından açan düğmeye `blur()`
// çağırıyordu; odak ise o sırada örtünün İÇİNDEKİ başlıktaydı. Tarayıcıda ölçüldü:
// odak, gizlenen ağacın içinde kalıyor — `body`'ye bile düşmüyor. Sonraki Tab görünmez
// bir noktadan başlıyor, ekran okuyucu yerini kaybediyor (WCAG 2.2, SC 2.4.3).
//
// İKİNCİ HATA (birincisi düzeltildikten SONRA ortaya çıktı): odak artık doğru zamanda
// dışarı taşınıyordu ama HEDEF odak alamıyordu — oyun alanının atası hâlâ `inert`
// taşıyordu, çünkü `arkaKilit(false)` çağrısı `ortuKapat`'tan SONRA geliyordu. `inert`
// ağacındaki bir öğe odaklanamaz; `focus()` sessizce hiçbir şey yapmıyordu. Aynı hata
// altı çağrı yerinde birden vardı, çünkü sıra yine çağıranlara bırakılmıştı.
//
// Ders: bu iki adımın sırası bir çağrı sözleşmesi olamaz, tek bir fonksiyonun içi olmalı.
//
// Kapanışta odak NEREYE dönüyor: oyun alanına, açan düğmeye değil. Bu oyunun tek
// kontrolü boşluk/Enter; odağı "Ayarlar" düğmesine geri vermek, oyuncunun bir sonraki
// boşluk tuşunun ayarları yeniden açması demek olurdu.

/** Örtü açıkken arka planı Tab ile gezilemez yapar. */
export function arkaKilit(arka: readonly HTMLElement[], kapali: boolean): void {
  for (const el of arka) el.toggleAttribute("inert", kapali);
}

/** Örtüyü gösterir, arkayı kilitler ve odağı içeri alır. */
export function ortuAc(ortu: HTMLElement, odak: HTMLElement, arka: readonly HTMLElement[]): void {
  arkaKilit(arka, true);
  ortu.hidden = false;
  odak.focus({ preventScroll: true });
}

/**
 * Örtüyü kapatır. Sıra: ÖNCE arkanın kilidini aç (yoksa hedef odak alamaz), SONRA
 * odağı dışarı taşı, EN SON gizle (ters sırada odak gizlenen ağacın içinde kalır).
 */
export function ortuKapat(ortu: HTMLElement, geriOdak: HTMLElement, arka: readonly HTMLElement[]): void {
  arkaKilit(arka, false);
  if (ortu.contains(document.activeElement)) geriOdak.focus({ preventScroll: true });
  ortu.hidden = true;
}
