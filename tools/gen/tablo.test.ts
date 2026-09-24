import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { damga, serialize } from "./tablo.ts";
import type { LevelTable } from "../../src/core/index.ts";

const YOL = path.join(import.meta.dirname, "..", "..", "data", "levels.json");
const ham = fs.readFileSync(YOL, "utf8");
const tablo = JSON.parse(ham) as LevelTable & { v: string };

// `npm run verify` bunu da yakalıyor ama 7 dakika sonra ve Monte Carlo'nun arkasında.
// Burada bir saniyede ve Vercel'in hızlı denetiminde yakalanır.
test("tablo damgası içerikle uyuşuyor (elle düzenleme yok)", () => {
  assert.equal(tablo.v, damga(tablo));
});

test("okunup yeniden yazılan tablo bayt bayt aynı", () => {
  assert.equal(serialize(tablo), ham);
});

test("damga içerikteki en küçük değişikliği yakalar", () => {
  const kopya = structuredClone(tablo);
  kopya.levels[499].limit += 0.1;
  assert.notEqual(damga(kopya), tablo.v);
});
