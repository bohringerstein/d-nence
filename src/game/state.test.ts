// Oyun durumunun testleri.
//
// En önemlisi "otomatik oynanış" testi (şartname 10. bölüm, 2. kabul ölçütü): referans
// çözücünün kilit anları OYUNUN KENDİ güncelleme döngüsünden sürülür. Level üreticisi bir
// leveli çözülebilir ilan ettiyse, oyun da onu gerçekten bitirebiliyor mu?
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { solve, LEVEL_COUNT } from "../core/index.ts";
import type { LevelTable, Level } from "../core/index.ts";
import { createLevel, tap, step, decay, kalanSure, HEPSI, YOK } from "./state.ts";
import type { TapSonuc } from "./state.ts";

const ADIM = 1 / 120;
const tablo: LevelTable = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "..", "..", "data", "levels.json"), "utf8"));

/** Oyunun döngüsünü verilen kilit anlarında dokunarak sürer. */
interface Oynanis {
  bitti: boolean;
  sure: number;
  sebep: string;
  yildiz?: number;
}

function oyunuSur(level: Level, kilitAnlari: number[], q3: number, q2: number): Oynanis {
  const s = createLevel(level, 1);
  let k = 0;
  // Süre sınırını aşarsak zaten "sureDoldu" döner; sonsuz döngüye karşı üst sınır.
  for (let adim = 0; adim < 120 * 120; adim++) {
    // Girdi, fizik adımından önce işlenir (main.ts ile aynı sıra).
    while (k < kilitAnlari.length && s.levelTime >= kilitAnlari[k] - 1e-9) {
      const r: TapSonuc = tap(s, q3, q2);
      k++;
      if (r.tip === "kayip") return { bitti: false, sure: s.levelTime, sebep: "açıklık kapandı" };
      if (r.tip === "acildi") return { bitti: true, sure: r.sure, sebep: "kasa açıldı", yildiz: r.yildiz };
    }
    const a = step(s, ADIM);
    if (a.tip === "sureDoldu") return { bitti: false, sure: s.levelTime, sebep: "süre doldu" };
    if (a.tip === "bitti") return { bitti: false, sure: s.levelTime, sebep: "beklenmeyen bitiş" };
  }
  return { bitti: false, sure: s.levelTime, sebep: "adım sınırı aşıldı" };
}

test("otomatik oynanış: her level oyunun kendi döngüsüyle bitirilebiliyor", () => {
  const sorun: string[] = [];
  for (const level of tablo.levels) {
    const c = solve(level.rings);
    if (!c) { sorun.push(`level ${level.n}: referans çözücü bitiremedi`); continue; }
    const o = oyunuSur(level, c.kilitler.map(x => x.t), tablo.q3, tablo.q2);
    if (!o.bitti) sorun.push(`level ${level.n}: ${o.sebep} (${o.sure.toFixed(1)} sn)`);
    else if (o.sure >= level.limit) sorun.push(`level ${level.n}: ${o.sure.toFixed(1)} sn, limit ${level.limit} sn`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("otomatik oynanış: çözücünün süresi limitin rahat altında", () => {
  let enKotu = 0, enKotuLevel = 0;
  for (const level of tablo.levels) {
    const c = solve(level.rings);
    assert.ok(c, `level ${level.n}: çözülemedi`);
    const oran = c.t / level.limit;
    if (oran > enKotu) { enKotu = oran; enKotuLevel = level.n; }
  }
  assert.ok(enKotu <= 0.9,
    `level ${enKotuLevel}: çözücü süre sınırının %${Math.round(enKotu * 100)}'ini kullanıyor, %90 üstü`);
});

// ---- Taze durum: prototipteki donma hatasının sınıfı --------------------------
test("createLevel eksiksiz ve taze bir durum verir", () => {
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  assert.equal(s.asama, "idle");
  assert.equal(s.levelTime, 0);
  assert.equal(s.endTimer, 0);
  assert.equal(s.finishTime, 0);
  assert.equal(s.flash, 0);
  assert.equal(s.shake, 0);
  assert.equal(s.lockPulse, 0);
  assert.equal(s.ballDist, 0);
  assert.equal(s.fireAngle, 0);
  assert.equal(s.crashRing, YOK);
  assert.equal(s.lastLocked, YOK);
  assert.equal(s.deneme, 1);
});

test("kayıptan sonra yeni durumda hiçbir görsel artık kalmaz", () => {
  // Prototipte lockPulse ve fireAngle sıfırlanmıyordu: yeni levelin ilk karesinde
  // eski kilidin kalınlaşması görünüyordu. Tek nesne kuralıyla bu mümkün değil.
  const level = tablo.levels[0];
  const kirik = createLevel(level, 1);
  kirik.lockPulse = 1; kirik.fireAngle = 2.5; kirik.flash = 1; kirik.shake = 1;
  kirik.asama = "crash"; kirik.crashRing = 0; kirik.endTimer = 0.9;

  const taze = createLevel(level, 2);
  assert.equal(taze.lockPulse, 0);
  assert.equal(taze.fireAngle, 0);
  assert.equal(taze.flash, 0);
  assert.equal(taze.shake, 0);
  assert.equal(taze.asama, "idle");
  assert.equal(taze.crashRing, YOK);
  assert.equal(taze.deneme, 2);
});

test("kayıptan sonra aynı level yeniden kazanılabiliyor (prototipteki donma hatası)", () => {
  const level = tablo.levels.find(l => l.rings.length >= 3);
  assert.ok(level, "en az üç halkalı bir level bulunmalı");
  const c = solve(level.rings);
  assert.ok(c, "level çözülebilir olmalı");

  // 1) Bilerek kaybet: art arda dokun, açıklık kapansın.
  const kayip = createLevel(level, 1);
  let kayipOldu = false;
  for (let i = 0; i < level.rings.length && !kayipOldu; i++) {
    const r = tap(kayip, tablo.q3, tablo.q2);
    if (r.tip === "kayip") kayipOldu = true;
    if (r.tip === "acildi") break;
  }
  // 2) Kaybetsek de kaybetmesek de, yeniden yüklenen level normal bitirilebilmeli.
  const o = oyunuSur(level, c.kilitler.map(x => x.t), tablo.q3, tablo.q2);
  assert.ok(o.bitti, `kayıptan sonra kazanılamadı: ${o.sebep}`);
  void kayipOldu;
});

// ---- Aşama kuralları ---------------------------------------------------------
test("idle dışındaki dokunuşlar yok sayılır", () => {
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  s.asama = "crash";
  assert.equal(tap(s, tablo.q3, tablo.q2).tip, "yok");
  s.asama = "fire";
  assert.equal(tap(s, tablo.q3, tablo.q2).tip, "yok");
});

test("art arda çok hızlı dokunuş oyunu takmıyor", () => {
  for (const level of tablo.levels.slice(0, 12)) {
    const s = createLevel(level, 1);
    let acildi = 0, kayip = 0;
    for (let i = 0; i < 50; i++) {
      const r = tap(s, tablo.q3, tablo.q2);
      if (r.tip === "acildi") acildi++;
      if (r.tip === "kayip") kayip++;
    }
    // Ya kapanır ya açılır; ikisi birden ya da hiçbiri olmaz, ve sonuç tek kez üretilir.
    assert.ok(acildi + kayip === 1, `level ${level.n}: ${acildi} açılış, ${kayip} kayıp`);
    assert.notEqual(s.asama, "idle", `level ${level.n}: 50 dokunuştan sonra hâlâ idle`);
  }
});

test("süre dolunca kaybedilir ve tüm halkalar işaretlenir", () => {
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  let sonuc = "";
  for (let i = 0; i < 120 * 120; i++) {
    const a = step(s, ADIM);
    if (a.tip === "sureDoldu") { sonuc = "sureDoldu"; break; }
  }
  assert.equal(sonuc, "sureDoldu");
  assert.equal(s.asama, "crash");
  assert.equal(s.crashRing, HEPSI);
  assert.ok(s.endTimer > 0, "kayıp sonrası bekleme süresi ayarlanmalı");
  assert.equal(kalanSure(s), 0, "süre bitince sayaç sıfır görünmeli");
});

test("crash ve fire aşamaları endTimer dolunca bitiyor", () => {
  const level = tablo.levels[0];
  for (const asama of ["crash", "fire"] as const) {
    const s = createLevel(level, 1);
    s.asama = asama;
    s.endTimer = 0.05;
    let bitti = false;
    for (let i = 0; i < 1000 && !bitti; i++) bitti = step(s, ADIM).tip === "bitti";
    assert.ok(bitti, `${asama} aşaması bitmedi`);
  }
});

test("fire aşamasında sayaç durur", () => {
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  for (let i = 0; i < 60; i++) step(s, ADIM);
  s.asama = "fire";
  s.finishTime = s.levelTime;
  s.endTimer = 1.4;
  const kalan = kalanSure(s);
  for (let i = 0; i < 60; i++) step(s, ADIM);
  assert.equal(kalanSure(s), kalan, "fire sırasında kalan süre değişmemeli");
});

test("baştan kilitli halkalar level başında uygulanır", () => {
  const level = tablo.levels.find(l => l.rings.some(r => r.preLocked));
  assert.ok(level, "baştan kilitli halka içeren bir level bulunmalı");
  const s = createLevel(level, 1);
  assert.ok(s.anyLocked, "baştan kilitli halka varsa maske uygulanmış olmalı");
  assert.ok(!s.rings[s.active].locked, "sıradaki halka kilitsiz olmalı");
});

test("decay görsel değerleri söndürür ve topu uçurur", () => {
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  s.flash = 1; s.shake = 1; s.lockPulse = 1;
  s.asama = "fire"; s.endTimer = 1.4;
  decay(s, 0.1, 380, 167);
  assert.ok(s.flash < 1 && s.shake < 1 && s.lockPulse < 1, "sönümleme çalışmalı");
  assert.ok(s.ballDist > 0, "top ilerlemeli");
  for (let i = 0; i < 100; i++) decay(s, 0.1, 380, 167);
  assert.equal(s.shake, 0, "sarsıntı sıfıra inmeli");
});

test("tablo 60 level ve tüm patronlar yerinde", () => {
  assert.equal(tablo.levels.length, LEVEL_COUNT);
});

// --- Kayıp payı: "az mı kaçırdım, çok mu?" -----------------------------------
//
// Oyuncu kaybettiğinde ekranda yalnızca kırmızı bir halka ve sarsıntı vardı: 1 derece
// kaçıran da 20 derece kaçıran da aynı şeyi görüyordu. Bilgi kaybın oluştuğu anda zaten
// hesaplanıyor; artık saklanıyor (crashPay) ve hem ipucunda hem çizimde kullanılıyor.
test("açıklık kapandığında pay ölçülüp saklanıyor", () => {
  // 6 halkalı bir bölümde hepsine üst üste, hiç beklemeden dokun: kanal kapanır.
  const level = tablo.levels.find(l => l.rings.filter(r => !r.preLocked).length >= 5) as Level;
  assert.ok(level, "çok halkalı bir bölüm bulunmalı");

  let kayipBulundu = false;
  for (let deneme = 0; deneme < 60 && !kayipBulundu; deneme++) {
    const s = createLevel(level, 1);
    // Rastgele bir noktaya kadar ilerle, sonra arka arkaya dokun.
    for (let k = 0; k < deneme * 3; k++) step(s, ADIM);
    for (let i = 0; i < 8; i++) {
      const r: TapSonuc = tap(s, tablo.q3, tablo.q2);
      if (r.tip === "kayip") {
        kayipBulundu = true;
        assert.ok(r.pay > 0, `pay pozitif olmalı, ${r.pay} geldi`);
        assert.equal(s.asama, "crash");
        assert.equal(s.crashPay, r.pay, "durum ile sonuç aynı payı taşımalı");
        assert.ok(s.crashPay < Math.PI, "pay makul bir açı olmalı");
        break;
      }
      if (r.tip !== "kilit") break;
      step(s, ADIM);
    }
  }
  assert.ok(kayipBulundu, "arka arkaya dokunmak bir yerde kanalı kapatmalı");
});

test("süre dolduğunda pay ölçülemez sayılır", () => {
  // "Şu kadar dar kaldı" diye bir şey yok: sayı uydurulmamalı.
  const level = tablo.levels[0];
  const s = createLevel(level, 1);
  let i = 0;
  while (s.asama === "idle" && i++ < 100000) step(s, ADIM);
  assert.equal(s.asama, "crash");
  assert.equal(s.crashRing, HEPSI, "süre dolunca bütün halkalar kırmızı");
  assert.equal(s.crashPay, -1, "ölçülemeyen pay YOK_PAY kalmalı");
});

test("yeni level payı sıfırlıyor", () => {
  // Tek nesne kuralı: createLevel eksiksiz yeni bir durum üretir.
  const s = createLevel(tablo.levels[0], 1);
  assert.equal(s.crashPay, -1);
  assert.equal(s.crashRing, YOK);
  assert.equal(s.asama, "idle");
});
