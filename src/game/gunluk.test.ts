import test from "node:test";
import assert from "node:assert";
import { gunAnahtari, oncekiGun, gununBolumu, gunuTamamla, guncelSeri, GUNLUK_ESIK } from "./gunluk.ts";

test("yerel gün anahtarı ve önceki gün (ay, yıl ve artık yıl sınırları)", () => {
  assert.equal(gunAnahtari(new Date(2026, 8, 4, 23, 59)), "2026-09-04");
  assert.equal(oncekiGun("2026-03-01"), "2026-02-28");
  assert.equal(oncekiGun("2028-03-01"), "2028-02-29");
  assert.equal(oncekiGun("2027-01-01"), "2026-12-31");
});

test("günün bölümü yalnız açılmış bölümlerden, eşik altında yok, gün içinde sabit", () => {
  assert.equal(gununBolumu("2026-09-24", GUNLUK_ESIK - 1), null);
  for (let enUzak = GUNLUK_ESIK; enUzak <= 1000; enUzak += 7) {
    const n = gununBolumu("2026-09-24", enUzak)!;
    assert.ok(n >= 1 && n <= enUzak, `${enUzak}: ${n} açılmamış bir bölüm`);
  }
  // Aynı 10'luk basamakta ilerlemek günün bölümünü değiştirmez.
  assert.equal(gununBolumu("2026-09-24", 41), gununBolumu("2026-09-24", 49));
  // Günler arasında değişir (30 günde en az 10 farklı bölüm).
  const farkli = new Set(Array.from({ length: 30 }, (_, i) => gununBolumu(`2026-10-${String(i + 1).padStart(2, "0")}`, 500)));
  assert.ok(farkli.size >= 10, `yalnız ${farkli.size} farklı bölüm`);
});

test("seri: üst üste artar, aynı gün iki kez sayılmaz, bir gün atlanınca 1'e döner", () => {
  let g = { son: null as string | null, seri: 0, enUzunSeri: 0 };
  g = gunuTamamla(g, "2026-09-22");
  g = gunuTamamla(g, "2026-09-23");
  g = gunuTamamla(g, "2026-09-23");
  assert.deepEqual(g, { son: "2026-09-23", seri: 2, enUzunSeri: 2 });
  assert.equal(guncelSeri(g, "2026-09-24"), 2, "dün bitirildi: seri sürüyor");
  assert.equal(guncelSeri(g, "2026-09-25"), 0, "bir gün atlandı: seri koptu");
  g = gunuTamamla(g, "2026-09-25");
  assert.deepEqual(g, { son: "2026-09-25", seri: 1, enUzunSeri: 2 });
});
