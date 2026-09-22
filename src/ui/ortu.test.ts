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
import fs from "node:fs";
import path from "node:path";

const kok = path.join(import.meta.dirname, "..", "..");
const css = fs.readFileSync(path.join(kok, "src", "styles.css"), "utf8");
const shell = fs.readFileSync(path.join(kok, "src", "ui", "shell.ts"), "utf8");
const main = fs.readFileSync(path.join(kok, "src", "main.ts"), "utf8");

/** Bir seçicinin gövdesini döndürür (ilk eşleşme). */
function blok(secici: string): string {
  const i = css.indexOf(secici + " {");
  assert.ok(i >= 0, `CSS kuralı yok: ${secici}`);
  return css.slice(i, css.indexOf("}", i));
}

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

test("panel açılınca odak BAŞLIĞA gider, en alttaki düğmeye değil", () => {
  // Odak "Tamam"a veriliyordu; o düğme kutunun en altında olduğu için klavyeyle gelen
  // oyuncu bütün denetimlerin arkasına düşüyor ve Tab ona ne ayarları, ne dili, ne de
  // "Nasıl oynanır"ı gösteriyordu. Başlık odakta olunca ekran okuyucu panelin adını
  // okur ve gezinme baştan başlar.
  assert.ok(/id="ayarBaslik" tabindex="-1"/.test(shell), "ayarlar başlığı odaklanabilir olmalı");
  assert.ok(/ui\.ayarBaslik\.focus/.test(main), "ayarlar açılınca odak başlığa gitmeli");
  assert.ok(!/ui\.ayarKapat\.focus/.test(main), "odak kapatma düğmesine verilmemeli");
  assert.ok(/ui\.nasilBaslik\.focus/.test(main), "nasıl oynanır açılınca odak başlığa gitmeli");
  assert.ok(!/ui\.nasilKapat\.focus/.test(main), "odak kapatma düğmesine verilmemeli");
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
