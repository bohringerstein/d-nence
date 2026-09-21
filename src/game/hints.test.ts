// İpucu önceliği (şartname 7. bölüm).
import test from "node:test";
import assert from "node:assert";
import { ipucu, ogreticiTablosu, yildizYazisi, sureYazisi , kayipYazisi } from "./hints.ts";
import type { Level, Best } from "../core/index.ts";
import { TR } from "../dil/tr.ts";

const level = (o: Partial<Level> = {}): Level =>
  ({ n: 2, boss: null, limit: 9, rings: [], ...o });
const ogretici = { 1: "Dokun, dış halkayı kilitle", 2: "Sarı kama ortak açıklık" };
const rekor: Best = { s: 2, t: 4.5 };

test("patron leveli ilk denemede adını ve ipucunu gösterir", () => {
  const m = ipucu({ level: level({ n: 10, boss: "ayna" as const}), deneme: 1, rekor: undefined, ogretici, m: TR });
  // Ad ve ipucu artık dil dosyasından gelir, tablodan değil.
  assert.equal(m, TR.patron.ayna.ad + ": " + TR.patron.ayna.ipucu);
});

test("öğretici ipucu ilk kayıptan sonra KAYBOLMAZ", () => {
  // Asıl regresyon: eskiden "Deneme 2" öğretici metni tamamen eziyordu ve oyuncu
  // kuralı tam da öğrenmeye çalıştığı anda açıklamayı kaybediyordu.
  const m = ipucu({ level: level({ n: 2 }), deneme: 2, rekor: undefined, ogretici, m: TR });
  assert.ok(m.includes("Sarı kama"), `öğretici metin kayboldu: "${m}"`);
  assert.ok(m.includes("Deneme 2"), `deneme sayısı da görünmeli: "${m}"`);
});

test("öğretici ipucu beşinci denemede de duruyor", () => {
  const m = ipucu({ level: level({ n: 2 }), deneme: 5, rekor: undefined, ogretici, m: TR });
  assert.ok(m.includes("Sarı kama") && m.includes("Deneme 5"), m);
});

test("ilk denemede öğretici ipucu tek başına gösterilir", () => {
  assert.equal(ipucu({ level: level({ n: 2 }), deneme: 1, rekor: undefined, ogretici, m: TR }), "Sarı kama ortak açıklık");
});

test("level daha önce bitirildiyse öğretici ipucu gösterilmez", () => {
  const m = ipucu({ level: level({ n: 2 }), deneme: 1, rekor, ogretici, m: TR });
  assert.ok(!m.includes("Sarı kama"), m);
  assert.ok(m.includes("En iyin"), m);
});

test("bitirilmiş levelde deneme sayacı ve rekor birlikte görünür", () => {
  const m = ipucu({ level: level({ n: 2 }), deneme: 3, rekor, ogretici, m: TR });
  assert.ok(m.includes("Deneme 3") && m.includes("★"), m);
});

test("öğreticisi olmayan, bitirilmemiş level varsayılan metni gösterir", () => {
  assert.equal(ipucu({ level: level({ n: 40 }), deneme: 1, rekor: undefined, ogretici, m: TR }), "Dokun, sıradaki halkayı kilitle");
});

test("ogreticiTablosu her mekaniğe bir ipucu atıyor", () => {
  const levels: Level[] = [
    { n: 1, boss: null, limit: 9, rings: [{ speed: 1, gap: 40, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, start: 0 }] },
    { n: 7, boss: null, limit: 9, rings: [{ speed: 1, gap: 40, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: true, start: 0 }] },
    { n: 11, boss: null, limit: 9, rings: [{ speed: 1, gap: 40, gaps: 2, gapOffset: 150, flip: 0, wobble: false, preLocked: false, start: 0 }] }
  ];
  const t = ogreticiTablosu(levels, TR);
  assert.ok(t[1], "sabit öğretici korunmalı");
  assert.ok(t[7] && t[7].includes("Kareli"), "baştan kilitli halka ipucu");
  assert.ok(t[11] && t[11].includes("İki kapılı"), "iki kapılı halka ipucu");
});

test("yıldız ve süre biçimleri", () => {
  assert.equal(yildizYazisi(3), "★★★");
  assert.equal(yildizYazisi(1), "★☆☆");
  assert.equal(sureYazisi(4.25, TR), "4,3");   // Türkçe ondalık ayırıcı virgül
  assert.equal(sureYazisi(12, TR), "12,0");
});

// --- Kayıp mesajı: "az kalmıştı" mı, "yanlış an" mı? -------------------------
//
// Eskiden her kayıp aynı cümleyi veriyordu ("Açıklık kapandı"): 1 derece kaçıran da
// 20 derece kaçıran da aynı şeyi okuyordu. Oysa bu iki durum oyuncu için tamamen farklı.
test("kayıp mesajı payı söyler", () => {
  assert.ok(kayipYazisi(0.02, TR).includes("kıl payı"), kayipYazisi(0.02, TR));
  assert.ok(kayipYazisi(0.6, TR).includes("0,6°"), kayipYazisi(0.6, TR));
  assert.ok(kayipYazisi(3.4, TR).includes("3°"), kayipYazisi(3.4, TR));
  assert.ok(kayipYazisi(25, TR).includes("erken daraldı"), kayipYazisi(25, TR));
});

test("ölçülemeyen pay sayı uydurmaz", () => {
  // Süre dolduğunda "şu kadar dar kaldı" diye bir şey yoktur.
  for (const v of [-1, NaN, Infinity]) {
    const m = kayipYazisi(v, TR);
    assert.equal(m, "Açıklık kapandı", `pay ${v} için sayı yazılmamalı: ${m}`);
  }
});

test("pay mesajında ondalık ayırıcı virgül", () => {
  // Oyunun geri kalanı virgül kullanıyor (süre: "8,0"); nokta tutarsız olurdu.
  assert.ok(!kayipYazisi(0.6, TR).includes("."), kayipYazisi(0.6, TR));
});

// --- Patron ipucu ilk kayıptan sonra da kalır --------------------------------
//
// Regresyon: patron metni yalnızca deneme === 1 iken dönüyordu; ikinci denemede alt
// çubukta sadece "Deneme 2" kalıyordu. Yani "Ayna: Hepsi aynı anda hizalanıyor" cümlesi
// tam da oyuncunun ona ihtiyaç duyduğu anda siliniyordu — öğretici ipucu için bilerek
// kurulan kuralın tersi.
test("patron ipucu ikinci denemede de görünür", () => {
  const p = TR.patron.ayna;
  const m = ipucu({ level: level({ n: 10, boss: "ayna" as const }), deneme: 3, rekor: undefined, ogretici, m: TR });
  assert.ok(m.includes(p.ad) && m.includes(p.ipucu), `patron metni kayboldu: "${m}"`);
  assert.ok(m.includes("Deneme 3"), `deneme sayısı da görünmeli: "${m}"`);
});

test("patron bölümü bitirilmişse ipucu yerini rekora bırakır", () => {
  // Kuralı bilen oyuncuya tekrar anlatmaya gerek yok; öğretici ipucuyla aynı mantık.
  const m = ipucu({
    level: level({ n: 10, boss: "ayna" as const }), deneme: 2,
    rekor: { s: 2, t: 6.1 }, ogretici, m: TR
  });
  assert.ok(!m.includes(TR.patron.ayna.ipucu), `rekor varken ipucu gösterilmemeli: "${m}"`);
  assert.ok(m.includes("en iyin"), m);
});
