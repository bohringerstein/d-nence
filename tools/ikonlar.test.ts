import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ACILIS_GORSELLERI } from "./make-icons.ts";

const kok = path.join(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(kok, "index.html"), "utf8");

/** PNG başlığından (IHDR) genişlik ve yükseklik. */
function pngOlcu(dosya: string): [number, number] {
  const b = fs.readFileSync(dosya);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test("her iOS açılış görseli var, ölçüsü doğru ve index.html'de doğru medya sorgusuyla bağlı", () => {
  for (const [g, y, cw, ch, r] of ACILIS_GORSELLERI) {
    assert.equal(cw * r, g, `${g}x${y}: CSS genişlik × oran piksel genişliğe eşit olmalı`);
    assert.equal(ch * r, y, `${g}x${y}: CSS yükseklik × oran piksel yüksekliğe eşit olmalı`);
    const ad = `apple-splash-${g}x${y}.png`;
    const dosya = path.join(kok, "public", ad);
    assert.ok(fs.existsSync(dosya), `${ad} yok: npm run icons`);
    assert.deepEqual(pngOlcu(dosya), [g, y], `${ad} ölçüsü yanlış`);
    const medya = `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r})`;
    assert.ok(html.includes(medya) && html.includes(`href="./${ad}"`), `${ad} index.html'de bağlı değil`);
  }
  const bagli = [...html.matchAll(/apple-touch-startup-image/g)].length;
  assert.equal(bagli, ACILIS_GORSELLERI.length, "index.html'de listede olmayan açılış görseli var");
});

test("simge aracı içe aktarılınca dosya yazmaz", () => {
  // gen.ts'deki hatanın aynısı: araç içe aktarıldığında bütün görselleri yeniden yazıyordu.
  const kaynak = fs.readFileSync(path.join(import.meta.dirname, "make-icons.ts"), "utf8");
  const ust = kaynak.slice(0, kaynak.indexOf("if (import.meta.main)"));
  assert.ok(!/writeFileSync|mkdirSync/.test(ust.replace(/\/\/.*$/gm, "")), "koşulsuz dosya yazımı var");
});
