// Örtü açma/kapama: iki küçük fonksiyon, bir tek kural.
//
// Bu dosya SIRA yüzünden var. Örtü kapatılırken kod `hidden = true` yazıp ardından
// açan düğmeye `blur()` çağırıyordu; odak ise o sırada örtünün İÇİNDEKİ başlıkta
// duruyordu. Sonuç tarayıcıda ölçüldü: odak, gizlenen ağacın içinde kalıyor —
// `body`'ye bile düşmüyor. Sonraki Tab görünmez bir noktadan başlıyor ve ekran
// okuyucu yerini tamamen kaybediyor (WCAG 2.2, SC 2.4.3 Odak Sırası).
//
// Hata beş ayrı çağrı yerinde tekrarlanmıştı, çünkü örtü yönetimi bir soyutlama
// değil elle dizilen beş satırdı. Artık tek yerde.
//
// Kapanışta odak NEREYE dönüyor: oyun alanına, açan düğmeye değil. Bu oyunun tek
// kontrolü boşluk/Enter; odağı "Ayarlar" düğmesine geri vermek, oyuncunun bir
// sonraki boşluk tuşunun ayarları yeniden açması demek olurdu. Oyun alanı hem
// doğru hedef hem de ekran okuyucuya "Oyun alanı. Dokunarak sıradaki halkayı
// kilitle." diye okunuyor — menüden çıkınca duyulması gereken tam olarak bu.

/** Örtüyü gösterir ve odağı içeri alır. */
export function ortuAc(ortu: HTMLElement, odak: HTMLElement): void {
  ortu.hidden = false;
  odak.focus({ preventScroll: true });
}

/**
 * Örtüyü kapatır. ÖNCE odağı dışarı çıkarır, SONRA gizler — ters sırada odak
 * gizlenen ağacın içinde kalır.
 */
export function ortuKapat(ortu: HTMLElement, geriOdak: HTMLElement): void {
  if (ortu.contains(document.activeElement)) geriOdak.focus({ preventScroll: true });
  ortu.hidden = true;
}
