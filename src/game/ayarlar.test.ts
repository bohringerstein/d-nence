// Erişilebilirlik ayarları: bozuk veri oyunu düşürmemeli, ilk açılış uyarısı bir kez çıkmalı.
import test from "node:test";
import assert from "node:assert";

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

const { ayarlariOku, ayarlariYaz, halkaOpakligi, UYARI_METIN } = await import("./ayarlar.ts");
const KEY = "kasa:ayarlar:v1";

test("kayıt yokken her şey kapalı ve uyarı henüz görülmemiş", () => {
  depo.temizle();
  const a = ayarlariOku();
  assert.equal(a.desenYumusat, false);
  assert.equal(a.hareketAzalt, false);
  assert.equal(a.uyariGoruldu, false, "ilk açılışta uyarı gösterilmeli");
});

test("ayarlar diske yazılıp geri okunuyor", () => {
  depo.temizle();
  const a = ayarlariOku();
  a.desenYumusat = true;
  a.uyariGoruldu = true;
  ayarlariYaz(a);
  const b = ayarlariOku();
  assert.equal(b.desenYumusat, true);
  assert.equal(b.uyariGoruldu, true, "uyarı ikinci açılışta tekrar çıkmamalı");
  assert.equal(b.hareketAzalt, false);
});

test("bozuk JSON varsayılana düşer", () => {
  depo.temizle();
  depo.setItem(KEY, "{bu json degil");
  const a = ayarlariOku();
  assert.equal(a.desenYumusat, false);
  assert.equal(a.uyariGoruldu, false);
});

test("yanlış türler yok sayılır, doğru olanlar korunur", () => {
  depo.temizle();
  depo.setItem(KEY, JSON.stringify({ desenYumusat: "evet", hareketAzalt: true, uyariGoruldu: 1 }));
  const a = ayarlariOku();
  assert.equal(a.desenYumusat, false, "metin boolean yerine geçmemeli");
  assert.equal(a.hareketAzalt, true, "geçerli alan korunmalı");
  assert.equal(a.uyariGoruldu, false, "sayı boolean yerine geçmemeli");
});

test("localStorage erişilemezse oyun düşmez", () => {
  depo.patlasin = true;
  const a = ayarlariOku();
  assert.equal(a.desenYumusat, false);
  ayarlariYaz(a);   // patlamamalı
  depo.patlasin = false;
});

test("deseni yumuşat kilitsiz halkaların opaklığını düşürür", () => {
  const kapali = { desenYumusat: false, hareketAzalt: false, uyariGoruldu: true };
  const acik = { desenYumusat: true, hareketAzalt: false, uyariGoruldu: true };
  assert.equal(halkaOpakligi(kapali), 0.4);
  assert.ok(halkaOpakligi(acik) < halkaOpakligi(kapali), "yumuşatma opaklığı düşürmeli");
  assert.ok(halkaOpakligi(acik) > 0.15, "halkalar tamamen kaybolmamalı");
});

test("uyarı metni epilepsiden ve çözümden söz ediyor", () => {
  assert.ok(UYARI_METIN.includes("epilepsi"), "uyarı ne hakkında olduğunu söylemeli");
  assert.ok(UYARI_METIN.includes("Deseni yumuşat"), "uyarı ne yapılabileceğini söylemeli");
});
