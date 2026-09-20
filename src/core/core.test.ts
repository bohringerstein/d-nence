import test from "node:test";
import assert from "node:assert";
import * as C from "./index.ts";
import type { Ring, RingDef } from "./rings.ts";
import type { Open } from "./opening.ts";

const { TAU, DEG, BIN, BINS } = C;

const ring = (o: Partial<RingDef> = {}): RingDef =>
  ({ speed: 1, gap: 40, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, start: 0, ...o });
const live = (o: Partial<RingDef> = {}): Ring => {
  const r = ring(o);
  return { ...r, angle: r.start, dir: 1, t: 0, locked: false };
};
const deg = (r: number): number => r / DEG;
const yakin = (a: number, b: number, tol: number, mesaj: string): void =>
  assert.ok(Math.abs(a - b) <= tol, `${mesaj}: ${a} ile ${b} arasi fark ${Math.abs(a - b)} > ${tol}`);

// ---- açı normalleştirme ----
test("norm açıyı -pi..pi aralığına taşır", () => {
  yakin(C.norm(0), 0, 1e-12, "sifir");
  yakin(C.norm(TAU), 0, 1e-12, "tam tur");
  yakin(C.norm(-TAU), 0, 1e-12, "negatif tam tur");
  yakin(Math.abs(C.norm(Math.PI * 3)), Math.PI, 1e-9, "1,5 tur (-pi ve +pi ayni aciyi gosterir)");
  yakin(C.norm(0.1 - TAU * 5), 0.1, 1e-9, "bes tur geride");
  for (let k = -10; k <= 10; k++) {
    const a = 1.234 + k * TAU;
    assert.ok(C.norm(a) >= -Math.PI - 1e-12 && C.norm(a) <= Math.PI + 1e-12, "aralik disi: " + a);
  }
});

test("wrap açıyı 0..TAU aralığına taşır", () => {
  yakin(C.wrap(-0.1), TAU - 0.1, 1e-9, "negatif");
  yakin(C.wrap(TAU + 0.3), 0.3, 1e-9, "tur ustu");
});

// ---- maske ----
test("maske uygulama: tek boşluklu halka yalnızca boşluğu açık bırakır", () => {
  const m = C.newMask();
  C.applyMask(m, live({ gap: 40, start: 0 }));
  const acik = m.reduce((s, v) => s + v, 0);
  yakin(acik * 0.5, 40, 1, "acik dilimlerin toplam genisligi ~40 derece");
  assert.equal(m[0], 1, "0 derece (bosluk merkezi) acik olmali");
  assert.equal(m[BINS / 2], 0, "180 derece kapali olmali");
});

test("maske uygulama: iki boşluklu halka iki ayrı bölge bırakır", () => {
  const m = C.newMask();
  C.applyMask(m, live({ gap: 30, gaps: 2, gapOffset: 150, start: 0 }));
  assert.equal(C.maskRuns(m).length, 2, "iki ayri acik bolge olmali");
});

test("maske uygulama yalnızca daraltır, hiç genişletmez", () => {
  const m = C.newMask();
  C.applyMask(m, live({ gap: 60, start: 0 }));
  const once = m.reduce((s, v) => s + v, 0);
  C.applyMask(m, live({ gap: 60, start: 0.4 }));
  const sonra = m.reduce((s, v) => s + v, 0);
  assert.ok(sonra <= once, "ikinci kilit acikligi genisletemez");
  assert.ok(sonra > 0, "bu ornekte tamamen kapanmamali");
});

// ---- çembersel en büyük açıklık, başa sarma dahil ----
test("en büyük açıklık başa sarmayı hesaba katar", () => {
  const m = C.newMask();
  C.applyMask(m, live({ gap: 40, start: 0 }));  // bosluk 340..20 derece, 0'i asiyor
  const en = C.maskLargest(m);
  yakin(deg(en.w), 40, 1, "genislik");
  const merkez = deg(C.norm(en.center));
  yakin(merkez, 0, 1, "merkez 0 derecede olmali (basa sarma dogru cozuldu)");
  assert.equal(C.maskRuns(m).length, 1, "basa saran bolge tek parca sayilmali, iki degil");
});

test("hiç halka kilitli değilken tüm çember açıktır", () => {
  const en = C.maskLargest(C.newMask());
  assert.equal(en.len, BINS);
  yakin(en.w, TAU, 1e-12, "tam cember");
});

test("açıklık tamamen kapanabilir", () => {
  const m = C.newMask();
  C.applyMask(m, live({ gap: 30, start: 0 }));
  C.applyMask(m, live({ gap: 30, start: Math.PI }));
  assert.equal(C.maskLargest(m).len, 0, "kesismeyen iki bosluk cemberi kapatir");
});

// ---- geçiş eşiği ----
test("geçiş eşiği tek ve dilime hizalı", () => {
  assert.equal(C.NEED_PASS, C.NEED_BINS * BIN);
  assert.ok(C.NEED_PASS >= C.NEED, "esik NEED'in altina dusmemeli");
  assert.ok(C.NEED_PASS - C.NEED < BIN, "esik NEED'den en fazla bir dilim genis olmali");
  assert.ok(!C.canPass(C.NEED_PASS - 1e-9), "esigin hemen altindan gecemez");
  assert.ok(C.canPass(C.NEED_PASS), "esikte gecer");
});

// ---- analitik aralık modeli maske modeliyle uyumlu ----
test("analitik aralık modeli ile dilim modeli en fazla 1 dilim ayrışır", () => {
  let seed = 99; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let enBuyukFark = 0, denendi = 0, kapananUyusmazlik = 0;
  for (let deneme = 0; deneme < 400; deneme++) {
    const n = 2 + Math.floor(R() * 5);
    const rs = [];
    for (let i = 0; i < n; i++) rs.push(live({ gap: 25 + R() * 60, gaps: R() < 0.35 ? 2 : 1, gapOffset: 120 + R() * 70, start: R() * TAU }));
    let open: Open = C.OPEN_ALL; const m = C.newMask();
    for (const r of rs) {
      open = C.lockOpen(open, r); C.applyMask(m, r);
      const a = C.largestOpen(open).w, b = C.maskLargest(m).w;
      // lockOpen NEED_PASS altini budar; karsilastirmayi yalnizca ikisi de gecerken yap
      if (C.canPass(a) || C.canPass(b)) {
        enBuyukFark = Math.max(enBuyukFark, Math.abs(a - b)); denendi++;
        if (C.canPass(a) !== C.canPass(b)) kapananUyusmazlik++;
      }
    }
  }
  assert.ok(denendi > 200, "yeterli ornek uretilmedi: " + denendi);
  assert.ok(enBuyukFark <= BIN + 1e-9, "en buyuk fark " + deg(enBuyukFark).toFixed(4) + " derece, bir dilimi (0,5) asiyor");
  assert.equal(kapananUyusmazlik, 0, "iki model kayip kararinda ayrismamali");
});

test("lockOpen geçemeyecek aralıkları budar", () => {
  const open = C.lockOpen(C.OPEN_ALL, live({ gap: 10, start: 0 }));
  assert.equal(open.length, 0, "NEED_PASS altindaki bosluk aralik olarak tutulmamali");
});

test("peekOpen halkayı kilitlemeden ölçer", () => {
  const r = live({ gap: 40, start: 0 });
  const open = C.lockOpen(C.OPEN_ALL, live({ gap: 50, start: 0 }));
  const oncekiUzunluk = open.length;
  const p = C.peekOpen(open, r);
  assert.equal(open.length, oncekiUzunluk, "peekOpen listeyi degistirmemeli");
  yakin(p.w, C.largestOpen(C.lockOpen(open, r)).w, 1e-12, "peekOpen lockOpen ile ayni sonucu vermeli");
});

// ---- halka hareketi ----
test("kilitli halka hareket etmez", () => {
  const r = live({ speed: 2 }); r.locked = true;
  C.stepRings([r], 1, 1);
  assert.equal(r.angle, 0);
});

// Geri sarma yalnızca lt dizisi birebir eşleşirse tam tersine çevrilebilir:
// ileri adım (lt_k -> lt_k+1) w'yi lt_k+1'de hesaplar, o adımı geri almak da lt_k+1 kullanmalıdır.
// wobble'lı halkalarda bu kuralı bozmak sessiz bir sapma bırakır.
test("stepRings geri sarılabilir (simülasyondaki erken dokunuş)", () => {
  const r = live({ speed: 1.7, wobble: true, start: 0.3 });
  const dt = 1 / 120;
  for (let i = 0; i < 60; i++) C.stepRings([r], dt, (i + 1) * dt);
  const aci = r.angle;
  for (let j = 0; j < 20; j++) C.stepRings([r], -dt, (60 - j) * dt);
  for (let j = 0; j < 20; j++) C.stepRings([r], dt, (41 + j) * dt);
  yakin(r.angle, aci, 1e-12, "geri sarip ileri sarinca ayni aciya donmeli");
});

test("flip halkası yön değiştirir", () => {
  const r = live({ speed: 1, flip: 0.5 });
  const dt = 1 / 120;
  for (let i = 0; i < 60; i++) C.stepRings([r], dt, (i + 1) * dt);  // 0,5 sn
  assert.equal(r.dir, -1, "0,5 sn sonra yon donmeli");
});

// ---- yıldız ----
test("yıldız hesabı", () => {
  const minGap = 40 * DEG;
  assert.equal(C.starCount(C.starRatio(minGap, minGap), 0.4, 0.2), 3, "bosluk hic daralmadiysa 3 yildiz");
  assert.equal(C.starCount(C.starRatio(C.NEED, minGap), 0.4, 0.2), 1, "kil payi gecildiyse 1 yildiz");
  yakin(C.starRatio(minGap, minGap), 1, 1e-12, "tam koruma q = 1");
  yakin(C.starRatio(C.NEED, minGap), 0, 1e-12, "sinirda q = 0");
  const orta = C.NEED + 0.3 * (minGap - C.NEED);
  yakin(C.starRatio(orta, minGap), 0.3, 1e-9, "ara deger");
  assert.equal(C.starCount(0.3, 0.4, 0.2), 2, "esikler arasi 2 yildiz");
  assert.equal(C.starCount(0.4, 0.4, 0.2), 3, "esikte 3 yildiz");
  assert.equal(C.starCount(0.2, 0.4, 0.2), 2, "esikte 2 yildiz");
});

// ---- İşaret konumu ----
// Regresyon: işaret `angle + π`'ye konuyordu; iki kapılı halkada gapOffset 180°'ye
// yakınsa bu, ikinci boşluğun tam ortasıydı ve nokta boşlukta havada duruyordu.
const bosluktaMi = (r: Ring, aci: number): boolean => {
  const yarim = r.gap * DEG / 2;
  return C.gapCenters(r).some(c => Math.abs(C.norm(aci - c)) <= yarim);
};

test("işaret tek kapılı halkada çizginin üstünde", () => {
  for (const gap of [25, 45, 85]) {
    const r = live({ gap, gaps: 1, start: 0.7 });
    assert.ok(!bosluktaMi(r, C.isaretAcisi(r)), `gap ${gap}: işaret boşlukta`);
  }
});

test("işaret iki kapılı halkada da çizginin üstünde", () => {
  // gapOffset 180'e yakınken eski davranış boşluğun tam ortasına düşüyordu.
  for (const gapOffset of [130, 145, 160, 175, 179.8, 180]) {
    for (const gap of [30, 50, 76.8]) {
      const r = live({ gap, gaps: 2, gapOffset, start: 1.3 });
      const a = C.isaretAcisi(r);
      assert.ok(!bosluktaMi(r, a),
        `gapOffset ${gapOffset}, gap ${gap}: işaret boşlukta (${deg(C.norm(a - r.angle)).toFixed(1)}°)`);
    }
  }
});

test("işaret en geniş yayın ortasına düşüyor", () => {
  const r = live({ gap: 40, gaps: 2, gapOffset: 140, start: 0 });
  const a = C.isaretAcisi(r);
  // İki yay var: 20..120 (100°) ve 160..340 (180°). Geniş olanın ortası 250°.
  yakin(deg(C.wrap(a)), 250, 1, "en geniş yayın ortası");
});

test("işaret boşluk kenarlarından uzak duruyor", () => {
  let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let enYakin = Infinity;
  for (let i = 0; i < 300; i++) {
    const r = live({ gap: 25 + R() * 60, gaps: R() < 0.5 ? 2 : 1, gapOffset: 130 + R() * 50, start: R() * TAU });
    const a = C.isaretAcisi(r), yarim = r.gap * DEG / 2;
    for (const c of C.gapCenters(r)) enYakin = Math.min(enYakin, Math.abs(C.norm(a - c)) - yarim);
  }
  assert.ok(enYakin > 2 * DEG, `işaret bir boşluk kenarına ${deg(enYakin).toFixed(2)}° kadar yaklaştı`);
});
