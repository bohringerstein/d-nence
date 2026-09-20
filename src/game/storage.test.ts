// Kayıt katmanı: bozuk veri oyunu düşürmemeli, tek bozuk rekor diğerlerini götürmemeli.
import test from "node:test";
import assert from "node:assert";

// Node'da localStorage yok; test için basit bir sahte kurulur. storage.ts modülü
// içe aktarıldığında localStorage'a dokunmaz, yalnızca çağrıldığında dokunur.
class SahteDepo {
  private veri = new Map<string, string>();
  patlasin = false;
  getItem(k: string): string | null {
    if (this.patlasin) throw new Error("erişim engellendi");
    return this.veri.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.patlasin) throw new Error("kota doldu");
    this.veri.set(k, v);
  }
  temizle(): void { this.veri.clear(); }
}

const depo = new SahteDepo();
Object.defineProperty(globalThis, "localStorage", { value: depo, configurable: true });

const { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel } =
  await import("./storage.ts");
const { LEVEL_COUNT } = await import("../core/index.ts");

const KEY = "kasa:v1";
const yaz = (v: unknown): void => { depo.temizle(); depo.setItem(KEY, JSON.stringify(v)); };

test("kayıt yokken Level 1'den başlar", () => {
  depo.temizle();
  const k = oku();
  assert.equal(k.level, 1);
  assert.deepEqual(k.bests, {});
});

test("bozuk JSON oyunu düşürmez", () => {
  depo.temizle();
  depo.setItem(KEY, "{bu json değil");
  const k = oku();
  assert.equal(k.level, 1);
});

test("localStorage erişilemezse (gizli sekme) sessizce varsayılana döner", () => {
  depo.patlasin = true;
  const k = oku();
  assert.equal(k.level, 1);
  // Yazma da patlamamalı
  levelKaydet(k, 5);
  depo.patlasin = false;
});

test("geçersiz level numarası yok sayılır", () => {
  for (const kotu of [0, -3, LEVEL_COUNT + 1, 2.5, "7", null]) {
    yaz({ surum: 1, level: kotu, bests: {} });
    assert.equal(oku().level, 1, "level " + JSON.stringify(kotu) + " kabul edilmemeli");
  }
  yaz({ surum: 1, level: 42, bests: {} });
  assert.equal(oku().level, 42);
});

test("bozuk tek rekor diğerlerini götürmez", () => {
  yaz({
    surum: 1, level: 3, bests: {
      1: { s: 3, t: 4.2 },
      2: { s: 9, t: 1 },          // geçersiz yıldız
      3: { s: 2, t: -5 },         // negatif süre
      4: { s: "2", t: 3 },        // yanlış tür
      5: null,
      6: { s: 1, t: 12.5 },
      [LEVEL_COUNT + 1]: { s: 3, t: 1 },   // aralık dışı level
      abc: { s: 3, t: 1 }                  // sayı olmayan anahtar
    }
  });
  const k = oku();
  assert.deepEqual(Object.keys(k.bests).sort((a, b) => +a - +b), ["1", "6"]);
  assert.deepEqual(k.bests[1], { s: 3, t: 4.2 });
  assert.deepEqual(k.bests[6], { s: 1, t: 12.5 });
});

test("rekor kuralı: çok yıldız her zaman daha iyi, eşit yıldızda kısa süre", () => {
  depo.temizle();
  const k = oku();
  assert.equal(rekorKaydet(k, 1, { s: 2, t: 10 }), true, "ilk sonuç rekordur");
  assert.equal(rekorKaydet(k, 1, { s: 2, t: 12 }), false, "daha yavaş, rekor değil");
  assert.equal(rekorKaydet(k, 1, { s: 2, t: 8 }), true, "daha hızlı, rekor");
  assert.equal(rekorKaydet(k, 1, { s: 1, t: 1 }), false, "az yıldız, süre kısa olsa da rekor değil");
  assert.equal(rekorKaydet(k, 1, { s: 3, t: 20 }), true, "çok yıldız, süre uzun olsa da rekor");
  assert.deepEqual(k.bests[1], { s: 3, t: 20 });
});

test("baştan başla Level 1'e döner ama rekorları silmez", () => {
  depo.temizle();
  const k = oku();
  rekorKaydet(k, 1, { s: 3, t: 5 });
  rekorKaydet(k, 2, { s: 2, t: 7 });
  levelKaydet(k, 9);
  bastanBasla(k);
  assert.equal(k.level, 1);
  assert.equal(Object.keys(k.bests).length, 2, "rekorlar korunmalı");
  // Diskten okuyunca da korunmuş olmalı
  const tekrar = oku();
  assert.equal(tekrar.level, 1);
  assert.equal(Object.keys(tekrar.bests).length, 2);
});

test("toplam yıldız ve bitirilen level sayısı", () => {
  depo.temizle();
  const k = oku();
  rekorKaydet(k, 1, { s: 3, t: 5 });
  rekorKaydet(k, 2, { s: 2, t: 7 });
  rekorKaydet(k, 3, { s: 1, t: 9 });
  assert.equal(toplamYildiz(k), 6);
  assert.equal(bitirilenLevel(k), 3);
});

// ---- Eski ada ait kayıt taşınıyor mu ----------------------------------------
// Oyun "Kasa" adıyla yayındayken oynayanların ilerlemesi, ad "Dönence" olunca
// kaybolmamalı. Eski anahtar okunur ve içerik yeni anahtara yazılır.
const ESKI_KEY = "kasa:v1";

test("eski addan kalan kayıt okunuyor ve yeni anahtara taşınıyor", () => {
  depo.temizle();
  depo.setItem(ESKI_KEY, JSON.stringify({ surum: 1, level: 37, bests: { 5: { s: 3, t: 4.1 } } }));

  const k = oku();
  assert.equal(k.level, 37, "eski kayıttaki level okunmalı");
  assert.deepEqual(k.bests[5], { s: 3, t: 4.1 }, "eski rekorlar korunmalı");

  const yeni = depo.getItem("donence:v1");
  assert.ok(yeni, "kayıt yeni anahtara yazılmalı");
  assert.equal(JSON.parse(yeni!).level, 37);
});

test("yeni anahtar varsa eski yok sayılır", () => {
  depo.temizle();
  depo.setItem(ESKI_KEY, JSON.stringify({ surum: 1, level: 5, bests: {} }));
  depo.setItem("donence:v1", JSON.stringify({ surum: 1, level: 200, bests: {} }));
  assert.equal(oku().level, 200, "güncel kayıt kazanmalı");
});

test("eski kayıt da doğrulamadan geçiyor", () => {
  depo.temizle();
  depo.setItem(ESKI_KEY, JSON.stringify({ surum: 1, level: 99999, bests: { 1: { s: 7, t: -1 } } }));
  const k = oku();
  assert.equal(k.level, 1, "aralık dışı level eski kayıtta da yok sayılmalı");
  assert.deepEqual(k.bests, {}, "geçersiz rekor eski kayıtta da elenmeli");
});
