// Akış kararları. Bu dosyanın var olma sebebi, oyunun en ağır üç hatasının
// main.ts'in olay dinleyicilerinde, hiçbir testin göremediği yerde yaşamasıydı.
import test from "node:test";
import assert from "node:assert";
import { acilisBolumu, resetOnayHedefi, kazanincaSonraki, bitisCikisi } from "./akis.ts";
import fs from "node:fs";
import path from "node:path";
import type { Kayit } from "./storage.ts";
import { LEVEL_COUNT } from "../core/index.ts";

const kayit = (o: Partial<Kayit> = {}): Kayit =>
  ({ level: 1, enUzak: 1, bests: {}, ...o });

test("açılış, ulaşılan en uzak bölümden başlar", () => {
  // 412'deki oyuncu 5'i tekrar oynayıp kazanınca oyun 6'ya akar ve `level` 6 olur.
  // Açılış `level`e bakarsa oyuncu ertesi gün Level 6'da uyanır: ilerleme silinmemiş
  // ama devam noktası yok olmuştur.
  assert.equal(acilisBolumu(kayit({ level: 6, enUzak: 412 })), 412);
  assert.equal(acilisBolumu(kayit({ level: 412, enUzak: 412 })), 412);
});

test("\"Baştan başla\" sonrası açılış 1. bölüm", () => {
  assert.equal(acilisBolumu(kayit({ level: 1, enUzak: 1 })), 1);
});

test("bozuk kayıt açılışı tablo dışına taşımıyor", () => {
  assert.equal(acilisBolumu(kayit({ enUzak: 0 })), 1);
  assert.equal(acilisBolumu(kayit({ enUzak: LEVEL_COUNT + 500 })), LEVEL_COUNT);
});

test("onay metni KAYBEDİLECEK bölümü söyler, oynananı değil", () => {
  // "Emin misin? Level 5 kaybolur" diyen bir onay, 412 bölümü silen bir eylemi
  // önemsiz gösteriyordu.
  assert.equal(resetOnayHedefi(kayit({ level: 5, enUzak: 412 })), 412);
});

test("kazanınca sıradaki bölüm, son bölümde bitiş", () => {
  assert.deepEqual(kazanincaSonraki(5), { tip: "level", n: 6 });
  assert.deepEqual(kazanincaSonraki(LEVEL_COUNT - 1), { tip: "level", n: LEVEL_COUNT });
  assert.deepEqual(kazanincaSonraki(LEVEL_COUNT), { tip: "bitis" });
});

test("bitiş ekranından iki çıkış: baştan oyna ve iptal", () => {
  assert.equal(bitisCikisi("bastanOyna"), 1);
  assert.equal(bitisCikisi("iptal"), LEVEL_COUNT, "Escape durum değiştirmemeli");
});

test("ilerlemeyi silen çağrı YALNIZCA onaylı düğmede", () => {
  // Önceki koruma bir totolojiydi: `BITIS_ILERLEMEYI_SILER === false` sabitini
  // sınıyordu ve hiçbir üretim kodu o sabiti okumuyordu. Biri `bitisKapat` içine
  // `bastanBasla(kayit)` eklerse — yani testin adını taşıdığı hatayı birebir geri
  // getirirse — test yine geçiyordu. Gerçek sözleşme şu: `bastanBasla` main.ts'te
  // TEK bir yerde, iki aşamalı onayın arkasında çağrılır.
  const main = fs.readFileSync(
    path.join(import.meta.dirname, "..", "main.ts"), "utf8");
  const cagri = (main.match(/bastanBasla\(kayit\)/g) ?? []).length;
  assert.equal(cagri, 1, `bastanBasla ${cagri} yerde çağrılıyor, yalnız 1 olmalı`);
  // Ve o tek yer onay dalının içinde olmalı.
  const onay = main.indexOf("resetOnayBekliyor = true");
  assert.ok(main.indexOf("bastanBasla(kayit)") > onay,
    "silme çağrısı onay mekanizmasından sonra gelmeli");
  // Bitiş ekranı yolunda hiç geçmemeli.
  const bitis = main.slice(main.indexOf("function bitisKapat"), main.indexOf("ui.bitisSecim"));
  assert.ok(!bitis.includes("bastanBasla"), "bitiş ekranı ilerlemeyi silmemeli");
});
