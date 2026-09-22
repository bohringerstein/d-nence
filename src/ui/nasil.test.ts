// "Nasıl oynanır" ekranı: oyuncunun geri dönebileceği kalıcı açıklama.
//
// Kader'in bildirdiği eksik: "üzerinde kırmızı nokta olan halkalar terse dönebilir
// halkalar ama kullanıcı bunu anlamayabilir." Alt çubuktaki ipuçları geçici ve
// mekaniği yalnızca ilk göründüğü levelde bir kez anlatıyordu.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { nasilHtml } from "./nasil.ts";
import { TR } from "../dil/tr.ts";

const css = fs.readFileSync(
  path.join(import.meta.dirname, "..", "styles.css"), "utf8");

/** Testler Türkçe metinle çalışır; İngilizce eksiksizliği dil.test.ts sınar. */
const NASIL_HTML = nasilHtml(TR);

test("her mekanik göstergede açıklanıyor", () => {
  const gerekli = [
    ["Kırmızı nokta", "yön değiştir"],
    ["Küçük kare", "baştan kilitli"],
    ["İki boşluk", "iki kapı"],
    ["Değişken hız", "hızlanıp yavaşlar"],
    ["Sarı kama", "çıkış yolun"]
  ];
  for (const [baslik, anahtar] of gerekli) {
    assert.ok(NASIL_HTML.includes(baslik), `gösterge başlığı eksik: ${baslik}`);
    assert.ok(NASIL_HTML.toLowerCase().includes(anahtar.toLowerCase()),
      `${baslik} için açıklama eksik: "${anahtar}"`);
  }
});

test("temel kural anlatılıyor", () => {
  for (const k of ["dıştan içe", "daralt", "kaybedersin", "kasa açılır"]) {
    assert.ok(NASIL_HTML.toLowerCase().includes(k.toLowerCase()), `temel kural eksik: ${k}`);
  }
});

test("yıldızın hıza değil hassasiyete bağlı olduğu yazıyor", () => {
  assert.ok(NASIL_HTML.includes("hızı değil hassasiyeti"), "yıldız kuralı yanlış anlaşılmaya açık");
});

test("ışığa duyarlılık notu ilk açılış ekranında", () => {
  assert.ok(NASIL_HTML.includes("epilepsi"), "uyarı metni eksik");
  assert.ok(NASIL_HTML.includes("Deseni yumuşat"), "ne yapılabileceği yazmalı");
});

test("kısa sürümde uyarı gösterge listesinin ÜSTÜNE alınıyor", () => {
  // Kısaltma bu uyarıyı ekranın altına itmişti: 320x568'de metin 529 pikselde
  // başlıyor, görünen alan 512'de bitiyordu — ama "Anladım" görünüyordu, yani uyarı
  // okunmadan kapatılabiliyordu. Düzeltme DOM sırasını değil görüntü sırasını
  // değiştirir ki TAM sürümün düzeni bozulmasın (bkz. styles.css .nasilKutu.kisa).
  assert.ok(/\.nasilKutu\s*\{[^}]*flex-direction:\s*column/.test(css),
    "sıra değiştirmek için kutu esnek sütun olmalı");
  /** Seçicinin kuralındaki order değerini okur (düz metin araması, regex kurmadan). */
  const sira = (secici: string): number => {
    const i = css.indexOf(secici + " {");
    assert.ok(i >= 0, "sıra kuralı yok: " + secici);
    const m = css.slice(i, css.indexOf("}", i)).match(/order:\s*(\d+)/);
    assert.ok(m, "order değeri yok: " + secici);
    return Number(m[1]);
  };
  assert.ok(sira(".nasilKutu.kisa > .uyari") < sira(".nasilKutu.kisa > .gosterge"),
    "kısa sürümde uyarı gösterge listesinden önce gelmeli");
  assert.ok(sira(".nasilKutu.kisa > .giris:not(.yildizNot)") < sira(".nasilKutu.kisa > .uyari"),
    "uyarı girişten sonra gelmeli");
  // TAM sürümde sıra kuralı OLMAMALI: orada uyarı yerinde kalır.
  assert.ok(!/\.nasilKutu\s*>\s*\.uyari\s*\{[^}]*order/.test(css),
    "sıra değişikliği yalnızca .kisa hâline ait");
});

test("her gösterge satırının bir simgesi var", () => {
  const satir = (NASIL_HTML.match(/<li data-anahtar=/g) || []).length;
  const simge = (NASIL_HTML.match(/<svg/g) || []).length;
  assert.equal(satir, simge, `${satir} satır ama ${simge} simge`);
  assert.ok(satir >= 5, "en az beş mekanik anlatılmalı");
});

test("simgeler tema değişkenlerini kullanıyor, sabit renk gömülü değil", () => {
  const svgler = NASIL_HTML.match(/<svg[\s\S]*?<\/svg>/g) || [];
  assert.ok(svgler.length > 0);
  for (const s of svgler) {
    assert.ok(!/#[0-9A-Fa-f]{6}/.test(s), `simgede sabit renk var: ${s.slice(0, 60)}`);
    assert.ok(s.includes("var(--"), "simge tema değişkeni kullanmalı");
  }
});

test("simgeler ekran okuyucudan gizli", () => {
  const svgler = NASIL_HTML.match(/<svg[^>]*>/g) || [];
  for (const s of svgler) assert.ok(s.includes('aria-hidden="true"'), `simge gizlenmemiş: ${s}`);
});
