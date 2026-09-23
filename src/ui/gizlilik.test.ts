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
import { html } from "./shell.ts";
import { TR } from "../dil/tr.ts";
/** Gerçek üretilmiş markup: yorum ayıklamaya gerek yok. */
const shell = html(TR);

test("sayfa uygulamayla birlikte yayınlanıyor ve ayarlardan açılıyor", () => {
  assert.ok(shell.includes('href="./gizlilik.html"'), "ayarlarda bağlantı olmalı");
  // Bağlantının KENDİSİNE bak, belgenin tamamına değil: HTML yorumları da üretilen
  // markup'ın parçası ve bir yorumda "target=_blank" sözü geçebiliyor.
  const bag = shell.match(/<a href="\.\/gizlilik\.html"[^>]*>/);
  assert.ok(bag, "gizlilik bağlantısı bulunamadı");
  assert.ok(!bag[0].includes("target="),
    "gizlilik bağlantısı yeni sekmede açılmamalı: PWA'da uygulamadan çıkarıyor");
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

test("yayıncı kimliği ve iletişim adresi", { todo: "mağazaya çıkmadan önce doldurulmalı" }, () => {
  // Yer tutucu BİLEREK duruyor (Kader'in kararı): kimseye ait bir adı ya da e-postayı
  // sormadan yayınlamayız. Ama testin "hatırlatması" için DÜŞEBİLİR olması şart —
  // önceki hâli `assert.ok(true)` idi, yani hiçbir şey yazmadan geçiyordu ve
  // hatırlatmıyordu. `todo` işaretiyle her çalıştırmada görünür bir satır bırakır.
  //
  // Apple 5.1.1(i) ve Play User Data Policy ikisini de zorunlu tutuyor: politika,
  // veri sorumlusunun kim olduğunu ve bir iletişim yolunu içermek zorunda — veri
  // toplanmasa bile.
  for (const yerTutucu of ["[YAYINCI ADI]", "[PUBLISHER NAME]", "[İLETİŞİM E-POSTASI]", "[CONTACT EMAIL]"]) {
    assert.ok(!sayfa.includes(yerTutucu), "doldurulmamış alan: " + yerTutucu);
  }
  assert.ok(/[\w.+-]+@[\w-]+\.[\w.]+/.test(sayfa), "iletişim adresi eksik");
});

test("politika iki dil parçasını işaretliyor", () => {
  // Sayfa <html lang="tr"> ve içinde tam bir İngilizce bölüm var; işaretlenmezse
  // ekran okuyucu onu Türkçe sesiyle okur (WCAG 2.2, SC 3.1.2 Parçaların Dili).
  assert.ok(/<section lang="tr">/.test(sayfa), "Türkçe bölüm işaretlenmeli");
  assert.ok(/<section lang="en">/.test(sayfa), "İngilizce bölüm işaretlenmeli");
});

test("gizlilik sayfasından oyuna dönüş yolu BAŞTA da var", () => {
  // Sayfa 390 px'te ~3800 piksel; tek dönüş bağlantısı en alttaydı. Ayrıca bağlantı
  // artık yeni sekmede açılmıyor (bkz. ui/shell.ts), yani dönüş yolu şart.
  const bas = sayfa.slice(0, sayfa.indexOf("<h1>"));
  assert.ok(/href="\.\/"/.test(bas), "sayfanın başında oyuna dönüş bağlantısı olmalı");
});
