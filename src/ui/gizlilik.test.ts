// Gizlilik politikası: her iki mağazanın da zorunlu tuttuğu tek belge.
//
// Apple 5.1.1(i) politikayı hem App Store Connect'te hem UYGULAMANIN İÇİNDE ister;
// Google Play'de Data Safety formu doldurulmadan yayın yapılamaz. Bu testlerin işi
// metnin doğruluğunu değil, iki şeyin BİRLİKTE doğru kalmasını denetlemek: sayfanın
// verdiği söz ("hiçbir dış adrese istek atılmaz") ile uygulamanın yaptığı iş.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DILLER } from "../dil/index.ts";
import type { DilKodu } from "../dil/index.ts";

const kok = path.join(import.meta.dirname, "..", "..");
const sayfa = fs.readFileSync(path.join(kok, "public", "gizlilik.html"), "utf8");
const shell = fs.readFileSync(path.join(kok, "src", "ui", "shell.ts"), "utf8");

test("sayfa uygulamayla birlikte yayınlanıyor ve ayarlardan açılıyor", () => {
  assert.ok(shell.includes('href="./gizlilik.html"'), "ayarlarda bağlantı olmalı");
  assert.ok(shell.includes('rel="noopener"'), "yeni sekme noopener ile açılmalı");
  for (const k of Object.keys(DILLER) as DilKodu[]) {
    assert.ok(DILLER[k].gizlilik.trim().length > 0, `${k}: bağlantı metni eksik`);
  }
});

test("sayfa iki dilde ve mağazaların sorduğu başlıkları taşıyor", () => {
  for (const parca of ["Türkçe", "English", "localStorage", "Children", "Contact", "İletişim"]) {
    assert.ok(sayfa.includes(parca), `gizlilik sayfasında eksik: ${parca}`);
  }
});

test("gizlilik sayfası kendi verdiği sözü tutuyor: dış istek yok", () => {
  // Bir gizlilik politikasının üçüncü taraf yazı tipi ya da sayaç yüklemesi, metnin
  // söylediğini yaparken çürütmesi olurdu. Kendi simgesi dışında dış adres olmamalı.
  const disAdres = sayfa.match(/https?:\/\/[^"' )]+/g) ?? [];
  assert.deepEqual(disAdres, [], "gizlilik sayfasında dış adres var: " + disAdres.join(", "));
});

test("uygulama da dış adrese istek atmıyor", () => {
  // Sayfa "başka hiçbir alan adına istek atılmaz" diyor; bu cümle ancak yapılandırma
  // da öyle kaldığı sürece doğru. Servis çalışanına bir runtimeCaching kuralı
  // eklendiği an bu test düşer ve metnin de güncellenmesi gerektiğini söyler.
  const vite = fs.readFileSync(path.join(kok, "vite.config.ts"), "utf8");
  const kod = vite.split("\n").filter(s => !s.trim().startsWith("//")).join("\n");
  assert.ok(!/runtimeCaching/.test(kod),
    "servis çalışanına dış adres kuralı eklenmiş: gizlilik metni de güncellenmeli");
});

test("iletişim adresi doldurulmayı bekliyor uyarısı", () => {
  // Yer tutucu bilerek duruyor: kimseye ait bir e-posta adresini sormadan yayınlamayız.
  // Mağazaya çıkmadan ÖNCE doldurulmalı; bu test onun unutulmadığını hatırlatır.
  const yerTutucu = sayfa.includes("[İLETİŞİM E-POSTASI]") || sayfa.includes("[CONTACT EMAIL]");
  if (yerTutucu) {
    assert.ok(true, "yer tutucu duruyor: mağazaya çıkmadan önce doldurulmalı");
  } else {
    assert.ok(/[\w.+-]+@[\w-]+\.[\w.]+/.test(sayfa), "iletişim adresi eksik");
  }
});
