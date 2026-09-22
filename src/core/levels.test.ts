// Tablo testi: her levelin, OYUNUN kullandığı maske modeliyle de bitirilebildiğini gösterir.
// Üretici analitik aralık modeliyle çalışır; bu test ikisinin 60 levelin hiçbirinde ayrışmadığını
// kanıtlar. Ayrışırsa, üreticinin "çözülebilir" dediği bir level oyunda kaybedilir.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as C from "./index.ts";
import type { LevelTable } from "./levels.ts";
import type { RingDef } from "./rings.ts";

const { DEG, TAU, canPass, stepRings, liveRings, solve } = C;

const data: LevelTable = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "..", "..", "data", "levels.json"), "utf8"));
import type { Kilit } from "./solver.ts";

interface Replay { win: boolean; t: number; w: number; kacinci?: number }

// Aynı kilit anlarını oyunun maske modelinden geçir
function replayWithMask(def: RingDef[], kilitler: Kilit[]): Replay {
  const rs = liveRings(def), dt = 1 / 120;
  const mask = C.newMask();
  rs.forEach(r => { if (r.locked) C.applyMask(mask, r); });
  let t = 0, k = 0;
  while (k < kilitler.length) {
    if (t >= kilitler[k].t - 1e-9) {
      const r = rs[kilitler[k].halka];
      C.applyMask(mask, r); r.locked = true;
      const en = C.maskLargest(mask);
      if (!canPass(en.w)) return { win: false, kacinci: k, w: en.w, t };
      k++;
      continue;
    }
    t += dt; stepRings(rs, dt, t);
  }
  return { win: true, t, w: C.maskLargest(mask).w };
}

test("tablo dosyası okunabilir ve LEVEL_COUNT kadar level içeriyor", () => {
  assert.equal(data.levels.length, C.LEVEL_COUNT);
  assert.ok(data.q3 > data.q2 && data.q2 > 0);
});

test("her level referans çözücüyle bitirilebiliyor ve süre sınırına sığıyor", () => {
  const sorun: string[] = [];
  for (const l of data.levels) {
    const s = solve(l.rings);
    if (!s) { sorun.push(`level ${l.n}: çözücü bitiremedi`); continue; }
    if (s.t >= l.limit) sorun.push(`level ${l.n}: çözücü ${s.t.toFixed(1)} sn, limit ${l.limit} sn`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("çözücünün yolu oyunun maske modelinde de kazanıyor", () => {
  const sorun: string[] = []; let enBuyukFark = 0;
  for (const l of data.levels) {
    const s = solve(l.rings);
    assert.ok(s, `level ${l.n}: çözücü bitiremedi`);
    const g = replayWithMask(l.rings, s.kilitler);
    if (!g.win) sorun.push(`level ${l.n}: ${(g.kacinci ?? 0) + 1}. kilitte maske kapandı (${(g.w / DEG).toFixed(2)}°)`);
    else enBuyukFark = Math.max(enBuyukFark, Math.abs(g.w - s.w));
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
  assert.ok(enBuyukFark <= C.BIN + 1e-9, `iki model ${(enBuyukFark / DEG).toFixed(3)}° ayrıştı, bir dilimi (0,5°) aşıyor`);
});

test("her levelde en az bir hareketli halka ve makul geometri var", () => {
  for (const l of data.levels) {
    assert.ok(l.rings.some(r => !r.preLocked), `level ${l.n}: tüm halkalar baştan kilitli`);
    assert.ok(l.rings.length >= 2 && l.rings.length <= 6, `level ${l.n}: halka sayısı`);
    for (const r of l.rings) {
      assert.ok(r.gap >= C.NEED / DEG, `level ${l.n}: boşluk geçiş eşiğinin altında`);
      assert.ok(r.gap <= 85, `level ${l.n}: boşluk 85° üstünde`);
      assert.ok(r.start >= 0 && r.start < TAU, `level ${l.n}: start aralık dışı`);
    }
  }
});

test("patron levelleri işaretli ve tanınan bir anahtar taşıyor", () => {
  const patronlar = data.levels.filter(l => l.boss);
  // Her BOSS_ARALIGI bölümde bir patron; altı tasarım sırayla tekrar eder.
  assert.deepEqual(patronlar.map(l => l.n), C.BOSS_LEVELS);
  // Görünen ad ve ipucu artık tabloda DEĞİL (çevrilebilsin diye src/dil/ altında).
  // Burada yalnızca anahtarın tanındığı denetlenir; metinlerin eksiksizliği ayrı sınanır.
  patronlar.forEach(l => {
    assert.ok(l.boss && (C.PATRON_ANAHTARLARI as readonly string[]).includes(l.boss),
      `level ${l.n}: bilinmeyen patron anahtarı ${JSON.stringify(l.boss)}`);
  });
  // Altı tasarım döngüde tekrar eder, yedincisi yalnızca kapanışta kullanılır.
  const adlar = new Set(patronlar.map(l => l.boss));
  assert.equal(adlar.size, 7, "altı döngü tasarımı + kapanış patronu olmalı");
  assert.equal(new Set(patronlar.slice(0, -1).map(l => l.boss)).size, 6,
    "son bölüm dışında altı tasarım dönmeli");
});

test("aynı leveldeki hiçbir iki halka birebir aynı değil", () => {
  // Birebir aynı iki halka, ikinci kilidi bedava yapar (10. patronda böyle bir hata vardı).
  for (const l of data.levels) {
    const görülen = new Set();
    l.rings.forEach((r, i) => {
      const k = JSON.stringify(r);
      assert.ok(!görülen.has(k), `level ${l.n}: halka ${i} bir öncekiyle birebir aynı`);
      görülen.add(k);
    });
  }
});

test("son bölüm kapanış patronu", () => {
  // 1000 bölümlük bir oyunun kapanış anı olmalı; döngünün nereye denk geldiğine
  // bırakılamaz (bırakıldığında "çatal" çıkıyordu).
  const son = data.levels[data.levels.length - 1];
  assert.equal(son.boss, "sonKasa", `son bölüm kapanış patronu olmalı, ${son.boss} geldi`);
  // Ve bu anahtar BAŞKA hiçbir bölümde kullanılmamalı.
  const kacKez = data.levels.filter(l => l.boss === "sonKasa").length;
  assert.equal(kacKez, 1, `kapanış patronu yalnızca son bölümde olmalı, ${kacKez} yerde var`);
});

// --- validateTable bozuk veriyle ÇÖKMEMELİ --------------------------------
//
// Bu fonksiyonun tek işi güvenilmeyen veriyi denetlemek; girdisi diskten ya da ağdan
// gelir. Eskiden `LevelTable` tipiyle yazılmıştı ve gövde doğru biçimi varsayıyordu:
// `null`, `levels: [null]` ve `rings: [null]` geldiğinde TypeError'la çöküyordu — yani
// koruma, var olma sebebi olan durumda kırılıyordu. NaN de `typeof x === "number"`
// denetiminden geçip geçerli bir limit gibi davranıyordu.
test("validateTable bozuk girdide çökmez, hata listesi döner", () => {
  const bozuk: unknown[] = [
    null, undefined, 7, "tablo", [],
    { q3: 0.4, q2: 0.2, levels: null },
    { q3: 0.4, q2: 0.2, levels: [null] },
    { q3: NaN, q2: 0.2, levels: [] }
  ];
  for (const b of bozuk) {
    const hatalar = C.validateTable(b);
    assert.ok(Array.isArray(hatalar) && hatalar.length > 0,
      `${JSON.stringify(b)} için hata beklenirdi`);
  }
});

test("validateTable level ve halka yerine null gelince de dayanıyor", () => {
  const tek = JSON.parse(JSON.stringify(data)) as LevelTable;
  (tek.levels as unknown[])[5] = null;
  assert.ok(C.validateTable(tek).some(x => x.includes("level 6")), "null level bildirilmeli");

  const iki = JSON.parse(JSON.stringify(data)) as LevelTable;
  (iki.levels[0].rings as unknown[])[0] = null;
  assert.ok(C.validateTable(iki).some(x => x.includes("halka 0")), "null halka bildirilmeli");
});

test("NaN geçerli bir sayı sayılmıyor", () => {
  // NaN her karşılaştırmayı false döndürür: `limit <= 0` denetiminden sessizce geçer
  // ve oyunda süre sınırı hiç dolmayan bir bölüm olurdu.
  const t = JSON.parse(JSON.stringify(data)) as LevelTable;
  t.levels[0].limit = NaN;
  assert.ok(C.validateTable(t).some(x => x.includes("limit")), "NaN limit yakalanmalı");

  const u = JSON.parse(JSON.stringify(data)) as LevelTable;
  u.levels[0].rings[0].speed = NaN;
  assert.ok(C.validateTable(u).some(x => x.includes("speed")), "NaN speed yakalanmalı");
});
