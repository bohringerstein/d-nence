// Akış kararları. Bu dosyanın var olma sebebi, oyunun en ağır üç hatasının
// main.ts'in olay dinleyicilerinde, hiçbir testin göremediği yerde yaşamasıydı.
import test from "node:test";
import assert from "node:assert";
import { acilisBolumu, resetOnayHedefi, kazanincaSonraki, BITIS_ILERLEMEYI_SILER } from "./akis.ts";
import type { Kayit } from "./storage.ts";
import { LEVEL_COUNT } from "../core/index.ts";

const kayit = (o: Partial<Kayit> = {}): Kayit =>
  ({ surum: 1, level: 1, enUzak: 1, bests: {}, ...o });

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

test("bitiş ekranı ilerlemeyi silmez", () => {
  // Kısa süre yayında kalan hata: "Baştan oyna" açılan bütün bölümleri kilitliyordu,
  // onaysız, ve Escape de aynı düğmeyi tetikliyordu.
  assert.equal(BITIS_ILERLEMEYI_SILER, false);
});
