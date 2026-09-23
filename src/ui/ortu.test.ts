// Örtülerin ortak sözleşmesi: okunur zemin, kayabilen kutu, görünür çıkış.
//
// Bu dosya tek bir kök sebep yüzünden var. Taşma ayarı ve opak zemin, ihtiyaç duyulan
// ilk yerde — "nasıl oynanır" ekranında — tek tek verilmiş, ortak sınıfa taşınmamıştı.
// Sonuç: ayarlar paneli 320x568 bir telefonda 604 piksel yer isteyip ekranın dışına
// taşıyor, "Tamam" görünmüyor ve panelden çıkış kalmıyordu; aynı panelin zemini de
// %88 saydam kalıp kontrastı 3,87:1'e düşürüyordu. Aynı hata üç kez tekrarladı, bu
// yüzden denetim tek örtüye değil SINIFA bakar.
import test from "node:test";
import assert from "node:assert";
import { kuralGovdesi } from "./cssOku.ts";
import fs from "node:fs";
import path from "node:path";

const kok = path.join(import.meta.dirname, "..", "..");
const css = fs.readFileSync(path.join(kok, "src", "styles.css"), "utf8");
import { html } from "./shell.ts";
import { TR } from "../dil/tr.ts";
/** Gerçek üretilmiş markup (bkz. shell.ts html). */
const shell = html(TR);
const main = fs.readFileSync(path.join(kok, "src", "main.ts"), "utf8");

/** CSS kural gövdesi; yuvalanmayı sayar ve yorumları eler (bkz. cssOku.ts). */
const blok = (secici: string): string => kuralGovdesi(secici);

test("örtü zemini OPAK, tek istisna duraklatma", () => {
  assert.ok(/background:\s*var\(--bg\)\s*;/.test(blok(".ortu")),
    ".ortu zemini opak olmalı: arkada dönen halkalar metni okunmaz yapıyordu");
  assert.ok(/#duraklat\s*\{[^}]*color-mix/.test(css),
    "duraklatma örtüsü saydam kalmalı: donmuş halkaları görmek bilginin kendisi");
});

test("kutu kayabilir: uzun panel ekranın dışına taşmaz", () => {
  const b = blok(".kutu");
  assert.ok(/max-height:/.test(b), ".kutu'nun yükseklik sınırı olmalı");
  assert.ok(/overflow-y:\s*auto/.test(b), ".kutu taşınca kaymalı");
});

test("ayarlar panelinin çıkışı her zaman görünür", () => {
  // "Tamam" ekrandan taşınca geriye görünen son düğme "Baştan başla" kalıyordu:
  // oyundaki geri dönüşü olmayan tek eylem.
  assert.ok(/<div class="kutuAlt"><button id="ayarKapat"/.test(shell),
    "Tamam düğmesi yapışkan şeritte olmalı");
  assert.ok(/position:\s*sticky/.test(blok(".kutuAlt")), ".kutuAlt yapışkan olmalı");
});

test("zemine dokunmak yıkıcı olmayan örtüleri kapatır", () => {
  // Ayarlar ve bölüm seçimi: kazara kapanması oyuncuyu yalnızca oyuna döndürür.
  assert.ok(/ui\.ayarPanel\.addEventListener\("click"/.test(main),
    "ayarlar panelinde zemine dokunma kapatmalı");
  assert.ok(/ui\.secim\.addEventListener\("click"/.test(main),
    "bölüm seçiminde zemine dokunma kapatmalı");
  for (const id of ["nasil", "duraklat", "bitis"]) {
    assert.ok(!main.includes(`ui.${id}.addEventListener("click"`),
      `${id} zemine dokunarak kapanmamalı: kazara kapatılması kabul edilemez`);
  }
});

test("örtüler tek bir açma/kapama deseni kullanıyor", () => {
  // Beş ayrı çağrı yerinde elle dizilen beş satır vardı ve hepsinde aynı hata:
  // önce gizle, sonra başka bir öğeye blur(). Odak o sırada örtünün İÇİNDEYDİ, yani
  // gizlenen ağacın içinde kalıyordu — body'ye bile düşmüyordu (tarayıcıda ölçüldü).
  // Sonraki Tab görünmez bir noktadan başlıyordu: WCAG 2.2 SC 2.4.3 ihlali.
  assert.ok(/import \{ ortuAc, ortuKapat \}/.test(main), "örtü deseni içe aktarılmalı");
  for (const id of ["ayarPanel", "secim", "nasil", "duraklat", "bitis", "yedek"]) {
    assert.ok(main.includes(`ortuAc(ui.${id}, `), id + " ortuAc ile açılmalı");
    assert.ok(main.includes(`ortuKapat(ui.${id}, `), id + " ortuKapat ile kapanmalı");
  }
  // Eski desenin kalıntısı kalmamalı.
  assert.ok(!/ui\.\w+\.blur\(\)/.test(main), "kapatmada blur() kalmamalı: yerine açık bir focus() var");
});

test("kapanışta odak OYUN ALANINA döner, düğmeye değil", () => {
  // Bu oyunun tek kontrolü boşluk/Enter. Odağı açan düğmeye geri vermek, oyuncunun
  // bir sonraki boşluk tuşunun o düğmeyi çalıştırması demek olurdu — ayarları
  // kapatıp boşluğa basan oyuncu ayarları yeniden açardı.
  const kapatmalar = main.match(/ortuKapat\(ui\.\w+, ui\.\w+, [^)]+\)/g) ?? [];
  assert.ok(kapatmalar.length >= 6, "altı örtünün de kapanışı olmalı");
  for (const k of kapatmalar) {
    assert.ok(/ortuKapat\(ui\.\w+, ui\.canvas,/.test(k), "odak oyun alanına dönmeli: " + k);
  }
  assert.ok(/<canvas id="c" tabindex="0"/.test(shell), "oyun alanı odaklanabilir olmalı");
});

test("panel açılınca odak BAŞLIĞA gider, en alttaki düğmeye değil", () => {
  // Odak "Tamam"a veriliyordu; o düğme kutunun en altında olduğu için klavyeyle gelen
  // oyuncu bütün denetimlerin arkasına düşüyor ve Tab ona ne ayarları, ne dili, ne de
  // "Nasıl oynanır"ı gösteriyordu. Başlık odakta olunca ekran okuyucu panelin adını
  // okur ve gezinme baştan başlar.
  assert.ok(/id="ayarBaslik" tabindex="-1"/.test(shell), "ayarlar başlığı odaklanabilir olmalı");
  assert.ok(/ortuAc\(ui\.ayarPanel, ui\.ayarBaslik,/.test(main), "ayarlar açılınca odak başlığa gitmeli");
  assert.ok(!/ortuAc\(ui\.ayarPanel, ui\.ayarKapat,/.test(main), "odak kapatma düğmesine verilmemeli");
  assert.ok(/ortuAc\(ui\.nasil, ui\.nasilBaslik,/.test(main), "nasıl oynanır açılınca odak başlığa gitmeli");
  assert.ok(!/ortuAc\(ui\.nasil, ui\.nasilKapat,/.test(main), "odak kapatma düğmesine verilmemeli");
});

test("bölüm seçimi örtüsü tam takım: Escape, çıkış şeridi, sayfalama", () => {
  // Bu ekran 1000 bölümün yüzünü birden çiziyor; kutunun kayabilmesi ve çıkışın
  // her zaman görünmesi burada başka her yerden daha önemli.
  assert.ok(/<div class="kutu secimKutu">/.test(shell), "seçim kutusu .kutu tabanını kullanmalı");
  assert.ok(/<div class="kutuAlt"><button id="secimKapat"/.test(shell), "çıkış şeridi eksik");
  assert.ok(/if \(!ui\.secim\.hidden\) \{ ui\.secimKapat\.click\(\); return; \}/.test(main),
    "Escape bölüm seçimini kapatmalı");
  assert.ok(/id="secimGeri"[^>]*aria-label/.test(shell) && /id="secimIleri"[^>]*aria-label/.test(shell),
    "sayfa okları yalnızca ok işaretinden ibaret; erişilebilir adları olmalı");
});

test("bölüm seçiminden çıkış da geri sayımla oluyor", () => {
  // Oyuna dönen her yol korumalı: oyuncu halkaları bir anda hareket hâlinde bulmamalı.
  const govde = main.slice(main.indexOf("function secimKapat("), main.indexOf("ui.secimAc.addEventListener"));
  assert.ok(govde.includes("geriSayimBaslat()"), "seçimi kapatmak geri sayımla dönmeli");
  const izgara = main.slice(main.indexOf('ui.secimIzgara.addEventListener'));
  assert.ok(izgara.slice(0, 700).includes("geriSayimBaslat()"), "bölüm seçmek de geri sayımla başlamalı");
  assert.ok(izgara.slice(0, 700).includes("ipucuKilidiSifirla()"),
    "eski bölümün sonuç mesajı yeni bölüme taşmamalı");
});

test("bölüm seçiminde sayfa değişimi duyuruluyor", () => {
  // 100 düğme sessizce değişiyordu; hangi yüzlük dilimde olunduğunu söyleyen tek öğe
  // aria-hidden'dı. WCAG 2.2, SC 4.1.3 Durum Mesajları.
  assert.ok(/id="secimAralik" role="status"/.test(shell), "aralık yazısı canlı bölge olmalı");
  assert.ok(!/id="secimAralik"[^>]*aria-hidden/.test(shell), "aralık yazısı gizlenmemeli");
});

test("bölüm seçimi doğru YERDE açılıyor ve sayfa değişiminde başa sarıyor", () => {
  assert.ok(/\.simdiki"\)\?\.scrollIntoView/.test(main),
    "panel açılınca oyuncunun kendi bölümüne sarmalı");
  assert.ok(/function secimSayfaDegistir/.test(main) && /\.kutu"\)\?\.scrollTo/.test(main),
    "sayfa değişiminde kutu başa sarmalı");
  // Kaydıran öğe .secimIzgara DEĞİL; ona yazmak ölü satırdı.
  assert.ok(!/secimIzgara\.scrollTop/.test(main), "secimIzgara kaydırıcı değil");
});

test("örtü kapanırken önce inert açılıyor, sonra odak taşınıyor", () => {
  // İkinci sıra hatası: odak doğru zamanda dışarı taşınıyordu ama HEDEF odak
  // alamıyordu — oyun alanının atası hâlâ `inert` taşıyordu, çünkü `arkaKilit(false)`
  // `ortuKapat`'tan SONRA çağrılıyordu. `inert` ağacındaki öğe odaklanamaz; `focus()`
  // sessizce hiçbir şey yapmıyordu. Altı çağrı yerinde birden.
  const ortu = fs.readFileSync(path.join(kok, "src", "ui", "ortu.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const govde = ortu.slice(ortu.indexOf("export function ortuKapat"));
  const kilit = govde.indexOf("arkaKilit(arka, false)");
  const odak = govde.indexOf("geriOdak.focus");
  const gizle = govde.indexOf("ortu.hidden = true");
  assert.ok(kilit >= 0 && odak > kilit, "önce arkanın kilidi açılmalı, sonra odak taşınmalı");
  assert.ok(gizle > odak, "gizleme en son olmalı");
  // Sıra bir çağrı sözleşmesi OLAMAZ: main.ts'te elle arkaKilit çağrısı kalmamalı.
  assert.ok(!/^\s*arkaKilit\(/m.test(main), "arkaKilit main.ts'ten elle çağrılmamalı");
});

test("ekran durumu TEK bir değerde, üç bağımsız bayrakta değil", () => {
  // Eskiden `bitti`, `panelAcik` ve `duraklatildi` bağımsız üç boole idi: sekiz
  // temsil edilebilir kombinasyon, dördü geçerli. Bedeli kodda görünüyordu — tek bir
  // tıklamada dört örtü ve iki bayrak birden sıfırlanıyordu ("durumu çözemiyorum,
  // hepsini sıfırlayayım"). Bu proje doğru deseni zaten biliyor (TapSonuc, Sonraki);
  // ekran durumu onun dışında kalmıştı.
  assert.ok(/type Mod = "oyun" \| "panel" \| "duraklat" \| "bitis";/.test(main),
    "ekran modu ayrık birleşim olmalı");
  assert.ok(/const oyunDonuk = \(\): boolean => mod !== "oyun" \|\| geriSayim > 0;/.test(main),
    "donukluk tek bir karşılaştırmaya inmeli");
  for (const eski of ["panelAcik", "duraklatildi"]) {
    assert.ok(!new RegExp("^\\s*(let|const)\\s+" + eski, "m").test(main),
      `${eski} bayrağı kalmamalı`);
  }
  // `bitti` adında bir bayrak da kalmamalı (state.ts'teki "bitti" ADIM SONUCU ayrı şey).
  assert.ok(!/^\s*let bitti\b/m.test(main), "bitti bayrağı kalmamalı");
});
