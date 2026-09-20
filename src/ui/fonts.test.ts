// Yazı tipi gömülü mü, ve Türkçe harfleri gerçekten kapsıyor mu?
//
// Fredoka eskiden Google Fonts CDN'inden geliyordu. Mağaza sürümüne giderken gömüldü:
// çevrimdışı açılışta yedek yazı tipine düşüyordu ve CDN ziyaretçinin IP adresini
// üçüncü bir tarafa iletiyordu (bkz. src/fonts/README.md). Bu testler o kararın
// sessizce geri alınmasını ve Türkçe alt kümesinin düşmesini engeller.
//
// reference/donence.html kapsam dışıdır: kullanıcıya sunulmayan, çift tıklanıp açılan
// tek dosyalık geliştirici referansıdır.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const kok = path.join(import.meta.dirname, "..", "..");
const oku = (...p: string[]): string => fs.readFileSync(path.join(kok, ...p), "utf8");

const html = oku("index.html");
const css = oku("src", "styles.css");

test("index.html dışarıdan yazı tipi çekmiyor", () => {
  const disKaynak = /https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|[^"'\s]*\.typekit\.[^"'\s]*)/g;
  const bulunan = [...html.matchAll(disKaynak)].map(m => m[0]);
  assert.deepEqual(bulunan, [], "dış yazı tipi kaynağı: " + bulunan.join(", "));
});

test("index.html hiçbir dış alan adına bağlanmıyor", () => {
  // preconnect/dns-prefetch dahil: oyun tamamen kendi kendine yeten bir PWA.
  const disBaglanti = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(disBaglanti, [], "dış bağlantı: " + disBaglanti.join(", "));
});

test("gömülü woff2 dosyaları var ve geçerli", () => {
  const kaynaklar = [...css.matchAll(/url\("\.\/(fonts\/[^"]+\.woff2)"\)/g)].map(m => m[1]);
  assert.ok(kaynaklar.length >= 2, `@font-face kaynağı az: ${kaynaklar.length}`);

  for (const göreli of kaynaklar) {
    const tam = path.join(kok, "src", göreli);
    assert.ok(fs.existsSync(tam), `yazı tipi dosyası yok: ${göreli}`);
    // woff2 imzası: "wOF2". Bozuk ya da yanlışlıkla HTML kaydedilmiş dosyayı yakalar.
    const bas = fs.readFileSync(tam).subarray(0, 4).toString("latin1");
    assert.equal(bas, "wOF2", `${göreli} geçerli bir woff2 değil (imza: ${JSON.stringify(bas)})`);
  }
});

/** styles.css'teki bütün unicode-range bildirimlerini tek bir aralık listesine toplar. */
function kapsananAraliklar(): Array<[number, number]> {
  const araliklar: Array<[number, number]> = [];
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const parca of m[1].split(",")) {
      const t = parca.trim().replace(/^U\+/i, "");
      if (!t) continue;
      const [bas, son] = t.split("-");
      const b = parseInt(bas, 16);
      araliklar.push([b, son === undefined ? b : parseInt(son, 16)]);
    }
  }
  return araliklar;
}

test("Türkçe harfler gömülü alt kümelerde var", () => {
  const araliklar = kapsananAraliklar();
  assert.ok(araliklar.length > 0, "hiç unicode-range bildirilmemiş");
  const kapsiyor = (kod: number): boolean => araliklar.some(([b, s]) => kod >= b && kod <= s);

  // Oyunda gerçekten geçen metinlerden: "Dönence", "Baştan başla", "Nasıl oynanır",
  // "Çatal", "Işığa duyarlılık", "Büyük kasa", "yön değiştirir".
  const harfler = "ğĞıİşŞöÖüÜçÇ";
  const eksik = [...harfler].filter(h => !kapsiyor(h.codePointAt(0)!));
  assert.deepEqual(eksik, [], "alt kümelerde olmayan Türkçe harf: " + eksik.join(" "));

  // Temel latin, rakamlar (level numarası canvas'a bununla yazılıyor) ve ipuçlarındaki
  // orta nokta ("Deneme 2 · Sarı kama ortak açıklık").
  const temel = [..."ABCabc0123456789 ,.:·"].filter(h => !kapsiyor(h.codePointAt(0)!));
  assert.deepEqual(temel, [], "kapsanmayan temel karakter: " + temel.join(" "));
});

test("Fredoka'nın kapsamadığı yıldız işaretleri için yedek yığın var", () => {
  // ★ ve ☆ Fredoka'da YOK; Google'ın yayınladığı alt kümeler de onları içermiyor, yani
  // bu CDN'den yüklerken de böyleydi. Yıldızlar alt çubuktaki ipucunda HTML metni olarak
  // yazılıyor (game/hints.ts, yildizYazisi), dolayısıyla yedek yazı tipinden çizilirler.
  // Gereken tek şey, gövdenin yığınında Fredoka'dan SONRA gerçek bir aile bulunması.
  const araliklar = kapsananAraliklar();
  const kapsiyor = (k: number): boolean => araliklar.some(([b, s]) => k >= b && k <= s);
  assert.ok(!kapsiyor(0x2605), "★ artık kapsanıyorsa bu testin gerekçesi değişmiş demektir");

  const m = css.match(/font-family:\s*"Fredoka"\s*,([^;]+);/);
  assert.ok(m, "gövdede Fredoka + yedek yığını bulunamadı");
  const yedekler = (m as RegExpMatchArray)[1].split(",").map(s => s.trim()).filter(Boolean);
  assert.ok(yedekler.length >= 2, "yedek yazı tipi yığını çok kısa: " + yedekler.join(", "));
});

test("bildirilen ağırlık aralığı kullanılan ağırlıkları içeriyor", () => {
  // Değişken yazı tipi: tek dosya bir ağırlık ARALIĞI taşır. CSS'te 400, 500 ve 600
  // kullanılıyor; aralık daraltılırsa tarayıcı en yakın ağırlığa kırpar ve başlık
  // ile sayaç arasındaki hiyerarşi sessizce kaybolur.
  const aralik = [...css.matchAll(/font-weight:\s*(\d+)\s+(\d+)\s*;/g)].map(m => [+m[1], +m[2]]);
  assert.ok(aralik.length >= 2, "değişken ağırlık aralığı bildirilmemiş");

  const kullanilan = new Set<number>([400]);   // gövde varsayılanı
  for (const m of css.matchAll(/font-weight:\s*(\d{3})\s*;/g)) kullanilan.add(+m[1]);
  for (const [alt, ust] of aralik) {
    for (const w of kullanilan) {
      assert.ok(w >= alt && w <= ust, `font-weight ${w} bildirilen ${alt}-${ust} aralığının dışında`);
    }
  }
});
