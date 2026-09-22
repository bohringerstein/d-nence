// Diller eksiksiz mi, cihaz dili doğru seçiliyor mu, sayılar doğru biçimleniyor mu?
//
// Eksik ÇEVİRİ zaten derleme hatasıdır (Metinler arayüzü her anahtarı zorunlu kılar).
// Burada denetlenen, tipin yakalayamadıkları: boş bırakılmış değerler, tabloyla dil
// arasındaki bağ, cihaz dili kuralı ve arayüz dosyalarında unutulmuş Türkçe metin.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DILLER, YEDEK_DIL, cihazDili, gecerliDilMi, sayi } from "./index.ts";
import type { DilKodu, Metinler } from "./index.ts";
import { PATRON_ANAHTARLARI } from "../core/index.ts";

const kodlar = Object.keys(DILLER) as DilKodu[];
const kok = path.join(import.meta.dirname, "..", "..");

/** Metinler nesnesindeki bütün yaprakları (dize ve fonksiyon sonuçlarını) dolaşır. */
function yapraklar(m: Metinler): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const gez = (deger: unknown, yol: string): void => {
    if (typeof deger === "string") out.push([yol, deger]);
    else if (typeof deger === "function") {
      // Örnek değerlerle çağır: boş şablon ya da unutulmuş yer tutucu yakalansın.
      try { out.push([yol, String((deger as (...a: unknown[]) => string)(7, 3, 9, 12))]); }
      catch { out.push([yol, ""]); }
    } else if (deger && typeof deger === "object") {
      for (const [k, v] of Object.entries(deger)) gez(v, yol ? yol + "." + k : k);
    }
  };
  gez(m, "");
  return out;
}

test("her dilde hiçbir metin boş değil", () => {
  for (const k of kodlar) {
    for (const [yol, deger] of yapraklar(DILLER[k])) {
      assert.ok(deger.trim().length > 0, `${k}: ${yol} boş`);
    }
  }
});

test("iki dil aynı anahtar kümesine sahip", () => {
  // Tip zaten zorunlu kılıyor; bu test tipin kaçırdığı durumu yakalar: bir dil
  // nesnesine fazladan anahtar eklenmesi (öbürü onu asla göstermez).
  const [a, b] = kodlar;
  const yol = (k: DilKodu) => yapraklar(DILLER[k]).map(([y]) => y).sort();
  assert.deepEqual(yol(a), yol(b), "diller arasında anahtar farkı var");
});

test("tablodaki her patron anahtarının karşılığı var", () => {
  for (const k of kodlar) {
    for (const anahtar of PATRON_ANAHTARLARI) {
      const p = DILLER[k].patron[anahtar];
      assert.ok(p && p.ad && p.ipucu, `${k}: ${anahtar} patronunun adı ya da ipucu eksik`);
    }
  }
});

// ---- Cihaz dili ------------------------------------------------------------

const navKur = (diller: string[] | undefined, tek?: string): void => {
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: diller, language: tek }, configurable: true
  });
};

test("cihaz dilindeki bölge eki yok sayılır", () => {
  navKur(["tr-CY"]);
  assert.equal(cihazDili(), "tr", "tr-CY de Türkçedir");
  navKur(["en-AU"]);
  assert.equal(cihazDili(), "en");
});

test("listede DESTEKLENEN ilk dil seçilir, ilki değil", () => {
  // Kullanıcı bir öncelik listesi tutar. İlkini alıp desteklemiyorsak yedeğe düşmek,
  // listede aşağıda duran ama bildiğimiz dili çöpe atmak olurdu.
  navKur(["de-DE", "tr-TR", "en-GB"]);
  assert.equal(cihazDili(), "tr");
  navKur(["fr-FR", "es-ES", "en-US"]);
  assert.equal(cihazDili(), "en");
});

test("hiçbiri desteklenmiyorsa yedek dil İNGİLİZCE, Türkçe değil", () => {
  // Oyun Türkçe yazıldı ama küresel pazara çıkıyor: Japon bir oyuncu için Türkçe,
  // İngilizce'den daha anlaşılmaz.
  navKur(["ja-JP", "ko-KR"]);
  assert.equal(cihazDili(), "en");
  assert.equal(YEDEK_DIL, "en");
});

test("navigator eksikse ya da boşsa çökmez", () => {
  navKur(undefined, undefined);
  assert.equal(cihazDili(), YEDEK_DIL);
  navKur([], "tr-TR");
  assert.equal(cihazDili(), "tr", "languages boşsa language kullanılmalı");
});

test("geçersiz dil kodu kabul edilmiyor", () => {
  for (const k of ["de", "", "TR", null, undefined, 7]) {
    assert.equal(gecerliDilMi(k), false, `${JSON.stringify(k)} geçerli sayılmamalı`);
  }
  assert.equal(gecerliDilMi("tr"), true);
  assert.equal(gecerliDilMi("en"), true);
});

// ---- Sayı biçimi -----------------------------------------------------------

test("ondalık ayırıcı dile göre değişiyor", () => {
  // Oyunun en çok göze çarpan sayısı sayaç. Türkçe "8,0", İngilizce "8.0".
  assert.equal(sayi(DILLER.tr, 8, 1), "8,0");
  assert.equal(sayi(DILLER.en, 8, 1), "8.0");
  assert.equal(sayi(DILLER.tr, 1.4, 1), "1,4");
  assert.equal(sayi(DILLER.en, 1.4, 1), "1.4");
  assert.equal(sayi(DILLER.tr, 12, 0), "12");
  assert.equal(sayi(DILLER.en, 12, 0), "12");
});

// ---- Arayüzde unutulmuş metin ---------------------------------------------

test("ekran iskeletinde elle yazılmış Türkçe metin kalmamış", () => {
  // Bu testin işi: yeni bir ekran eklerken metni doğrudan markup'a yazmayı yakalamak.
  // Yorumlar ve oyunun adı hariç; onlar çevrilmiyor.
  const shell = fs.readFileSync(path.join(kok, "src", "ui", "shell.ts"), "utf8");
  const sablon = shell.slice(shell.indexOf("const html ="), shell.indexOf("const bul ="))
    .replace(/<!--[\s\S]*?-->/g, "")        // HTML yorumları
    .replace(/\/\/[^\n]*/g, "")             // satır yorumları
    .replace(/\$\{[^}]*\}/g, "")            // dil yer tutucuları
    .replace(/Dönence/g, "");               // oyunun adı çevrilmez

  const turkce = sablon.match(/>[^<>]*[çğışöüÇĞİŞÖÜ][^<>]*</g) ?? [];
  assert.deepEqual(turkce, [], "markup'ta çevrilmemiş metin: " + turkce.join(" | "));
});

// ---- Kapanış bölümü --------------------------------------------------------

test("son bölümün kendi patronu var ve 'son' sözü tekrar etmiyor", () => {
  // Patron döngüsü 6'lı, patron aralığı 10: 1000. bölüm 100. patrona denk geliyor ve
  // 100 mod 6 = "çatal" ediyordu. Yani 1000 bölümlük oyunun kapanışı altı tasarımdan
  // rastgele birine düşüyor, finali olmuyordu. Üstelik "Büyük kasa: Son kasa..." metni
  // 60'tan 960'a kadar 16 kez çıkıp oyuncuya 60. bölümde "son kasa" diyordu.
  for (const k of kodlar) {
    const m = DILLER[k];
    assert.ok(m.patron.sonKasa, `${k}: kapanış patronu eksik`);
    const buyuk = (m.patron.buyukKasa.ad + " " + m.patron.buyukKasa.ipucu).toLowerCase();
    const sonSozu = k === "tr" ? "son" : "last";
    assert.ok(!buyuk.split(/\W+/).includes(sonSozu),
      `${k}: tekrar eden patron metni "${sonSozu}" demememeli — 16 bölümde çıkıyor`);
  }
});

test("İngilizcede sayı 1 ise tekil", () => {
  // "1 levels opened" küçük bir hata gibi görünür ama oyuncunun gördüğü ilk
  // İngilizce cümlelerden biri ve çeviriyi baştan özensiz gösterir.
  assert.ok(DILLER.en.ilerleme(1, 3, 3).startsWith("1 level opened"),
    "tek bölümde tekil olmalı: " + DILLER.en.ilerleme(1, 3, 3));
  assert.ok(DILLER.en.ilerleme(2, 5, 6).startsWith("2 levels opened"));
  assert.ok(DILLER.en.bitisMetni(1000, 1, 3, 3).includes("across 1 level."),
    "bitiş metninde de tekil olmalı: " + DILLER.en.bitisMetni(1000, 1, 3, 3));
});
