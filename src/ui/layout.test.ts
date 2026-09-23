// Düzen (şartname 10. bölüm: "360×640 ve 1440×900 ekranlarda halkalar ekrana sığıyor").
// Geometrinin matematiksel tarafı; üst/alt çubuğun taşmadığı tarayıcıda doğrulanır.
import test from "node:test";
import { KAMA_TASMA } from "../game/render.ts";
import assert from "node:assert";
import { layout, RATIO, LINE_WIDTH_MIN, LINE_WIDTH_MAX } from "../core/index.ts";

/** Üst çubuk + süre çubuğu + alt çubuğun oyun alanından aldığı yaklaşık yükseklik. */
const KROM = 110;
/** Kamalar halkaların dışına S × 0,05 kadar taşar (render.ts). */
// render.ts bu değeri zaten export ediyor; kopyalamak, oradaki değer değişince
// testin eski değerle "sığıyor" demeye devam etmesi demekti.

const ekranlar: Array<[string, number, number]> = [
  ["telefon dikey (şartname)", 360, 640],
  ["masaüstü (şartname)", 1440, 900],
  ["küçük telefon", 320, 568],
  ["telefon yatay", 640, 360],
  ["tablet", 768, 1024],
  ["çok dar", 280, 653],
  ["kare", 700, 700]
];

for (const [ad, W, H] of ekranlar) {
  test(`halkalar ekrana sığıyor: ${ad} (${W}×${H})`, () => {
    const oyunH = H - KROM;
    assert.ok(oyunH > 0, "oyun alanına yer kalmalı");
    for (let n = 2; n <= 6; n++) {
      const g = layout(W, oyunH, n);
      const enDis = g.outer + g.S * KAMA_TASMA + g.lineWidth / 2;
      assert.ok(enDis * 2 <= Math.min(W, oyunH) + 0.001,
        `${n} halka: en dış çap ${(enDis * 2).toFixed(1)}, alan ${Math.min(W, oyunH)}`);
      assert.ok(g.inner - g.lineWidth / 2 > g.ballR,
        `${n} halka: top en iç halkanın içine sığmıyor`);
      for (let i = 0; i < n; i++) {
        assert.ok(g.radius(i) > 0, `${n} halka: ${i}. yarıçap pozitif olmalı`);
        assert.ok(g.radius(i) <= g.outer + 0.001, `${n} halka: ${i}. yarıçap dıştan taşıyor`);
      }
    }
  });
}

test("halkalar birbirine değmiyor (çizgi kalınlığı hesaba katılarak)", () => {
  const sorun: string[] = [];
  for (const [ad, W, H] of ekranlar) {
    for (let n = 3; n <= 6; n++) {
      const g = layout(W, H - KROM, n);
      if (g.step <= g.lineWidth) sorun.push(`${ad}, ${n} halka: aralık ${g.step.toFixed(1)} ≤ kalınlık ${g.lineWidth.toFixed(1)}`);
    }
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("çizgi kalınlığı 5–9 piksel arasında sıkıştırılıyor", () => {
  for (const [, W, H] of ekranlar) {
    const g = layout(W, H - KROM, 4);
    assert.ok(g.lineWidth >= LINE_WIDTH_MIN && g.lineWidth <= LINE_WIDTH_MAX,
      `kalınlık ${g.lineWidth} sınırların dışında`);
  }
});

test("oranlar şartnamedeki değerlerle aynı", () => {
  assert.equal(RATIO.outer, 0.44);
  assert.equal(RATIO.inner, 0.17);
  assert.equal(RATIO.ball, 0.022);
  const g = layout(1000, 1000, 5);
  assert.equal(g.outer, 440);
  assert.equal(g.inner, 170);
  assert.equal(g.ballR, 22);
  assert.equal(g.step, (440 - 170) / 4);
});

test("tek halkalı durumda bölme hatası olmuyor", () => {
  const g = layout(400, 400, 1);
  assert.equal(g.step, 0);
  assert.equal(g.radius(0), g.outer);
});
