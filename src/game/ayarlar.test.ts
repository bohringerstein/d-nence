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

const { ayarlariOku, ayarlariYaz, halkaOpakligi } = await import("./ayarlar.ts");
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
  const kapali = { desenYumusat: false, hareketAzalt: false, titresim: true, uyariGoruldu: true };
  const acik = { desenYumusat: true, hareketAzalt: false, titresim: true, uyariGoruldu: true };
  assert.equal(halkaOpakligi(kapali), 0.4);
  assert.ok(halkaOpakligi(acik) < halkaOpakligi(kapali), "yumuşatma opaklığı düşürmeli");
  assert.ok(halkaOpakligi(acik) > 0.15, "halkalar tamamen kaybolmamalı");
});

// ---- Telefon titreşimi -------------------------------------------------------
// Şartnamenin 12. bölümünde kapsam dışıydı; Kader telefonda eksik olduğunu bildirince
// kapsama alındı. iOS Safari navigator.vibrate sağlamaz, orada seçenek gizlenir.
const { titret, titresimVarMi } = await import("./ayarlar.ts");

function vibrateKur(destek: boolean): number[][] {
  const cagrilar: number[][] = [];
  Object.defineProperty(globalThis, "navigator", {
    value: destek
      ? { vibrate: (d: number | number[]) => { cagrilar.push(Array.isArray(d) ? d : [d]); return true; } }
      : {},
    configurable: true
  });
  return cagrilar;
}

const ayar = (titresim: boolean) => ({ desenYumusat: false, hareketAzalt: false, titresim, uyariGoruldu: true });

test("titreşim desteği doğru algılanıyor", () => {
  vibrateKur(true);
  assert.equal(titresimVarMi(), true);
  vibrateKur(false);
  assert.equal(titresimVarMi(), false, "iOS Safari gibi desteklemeyen cihazda false olmalı");
});

test("kilit, kayıp ve açılış farklı titreşim veriyor", () => {
  const c = vibrateKur(true);
  titret(ayar(true), "kilit");
  titret(ayar(true), "kayip");
  titret(ayar(true), "acildi");
  assert.equal(c.length, 3);
  assert.ok(c[1][0] > c[0][0], "kayıp kilitten daha belirgin olmalı");
  assert.ok(c[2].length > 1, "açılış çok darbeli bir desen olmalı");
});

test("ayar kapalıyken titreşim yok", () => {
  const c = vibrateKur(true);
  titret(ayar(false), "kayip");
  assert.equal(c.length, 0);
});

test("cihaz desteklemiyorsa sessizce geçilir", () => {
  vibrateKur(false);
  assert.doesNotThrow(() => titret(ayar(true), "kayip"));
});

test("vibrate hata fırlatırsa oyun düşmez", () => {
  Object.defineProperty(globalThis, "navigator", {
    value: { vibrate: () => { throw new Error("izin yok"); } },
    configurable: true
  });
  assert.doesNotThrow(() => titret(ayar(true), "kayip"));
});

test("varsayılan olarak titreşim açık", () => {
  depo.temizle();
  assert.equal(ayarlariOku().titresim, true);
});
