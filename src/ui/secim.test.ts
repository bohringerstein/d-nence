// Bölüm seçimi: açılan bölüme dönüş, kilitli bölümün kapalı kalması, sayfalama.
//
// Bu ekran yıldız sisteminin ölçülen sorununa verilen cevap: sıradan oyuncu
// bölümlerin %68'ini 1 yıldızla bitiriyor ve bitirilen bir bölüme dönmenin yolu yoktu,
// yani toplanan yıldız hiçbir zaman düzeltilemiyordu.
import test from "node:test";
import assert from "node:assert";
import { izgaraHtml, sayfaSayisi, sayfasi, aralik, SAYFA_BOYU } from "./secim.ts";
import { TR } from "../dil/tr.ts";
import { EN } from "../dil/en.ts";
import type { Best } from "../core/index.ts";

const bests: Record<number, Best> = { 1: { s: 3, t: 4 }, 2: { s: 1, t: 9 }, 3: { s: 2, t: 6 } };
const ciz = (o: Partial<Parameters<typeof izgaraHtml>[0]> = {}): string =>
  izgaraHtml({ m: TR, sayfa: 0, toplam: 1000, enUzak: 5, bests, simdiki: 3, ...o });

test("sayfalama 1000 bölümü yüzerlik dilimlere ayırıyor", () => {
  assert.equal(SAYFA_BOYU, 100);
  assert.equal(sayfaSayisi(1000), 10);
  assert.deepEqual(aralik(0, 1000), [1, 100]);
  assert.deepEqual(aralik(4, 1000), [401, 500]);
  // Son sayfa taşmamalı.
  assert.deepEqual(aralik(9, 950), [901, 950]);
  // Oyuncunun bulunduğu sayfa: 412. bölümdeyken her açılışta dört kez ileri
  // bastırmak yerine doğrudan 401-500 açılmalı.
  assert.equal(sayfasi(412), 4);
  assert.equal(sayfasi(1), 0);
  assert.equal(sayfasi(100), 0);
  assert.equal(sayfasi(101), 1);
});

test("açık bölümler tıklanabilir, kilitliler değil", () => {
  const h = ciz();
  const dugme = (n: number): string => {
    const m = h.match(new RegExp('<button[^>]*data-n="' + n + '"[^>]*>'));
    assert.ok(m, "düğme yok: " + n);
    return m[0];
  };
  for (const n of [1, 2, 3, 4, 5]) assert.ok(!dugme(n).includes("disabled"), n + " açık olmalı");
  for (const n of [6, 7, 100]) assert.ok(dugme(n).includes("disabled"), n + " kilitli olmalı");
});

test("her düğmenin erişilebilir adı bölüm numarasını ve yıldızı söylüyor", () => {
  // Izgarada görünen sayı ve yıldız glifleri aria-hidden; ekran okuyucu için tek
  // bilgi kaynağı aria-label. Eksik kalırsa ekran "düğme, düğme, düğme" olur.
  const h = ciz();
  assert.ok(h.includes('aria-label="Level 1, 3 yıldız"'));
  assert.ok(h.includes('aria-label="Level 2, 1 yıldız"'));
  assert.ok(h.includes('aria-label="Level 4, henüz bitirilmedi"'));
  assert.ok(h.includes('aria-label="Level 6, kilitli"'));
  const en = ciz({ m: EN });
  assert.ok(en.includes('aria-label="Level 1, 3 stars"'));
  assert.ok(en.includes('aria-label="Level 2, 1 star"'), "İngilizcede tek yıldız tekil olmalı");
});

test("şu an oynanan bölüm işaretli", () => {
  const h = ciz({ simdiki: 3 });
  const m = h.match(/<button[^>]*data-n="3"[^>]*>/);
  assert.ok(m && m[0].includes('aria-current="true"'), "aria-current eksik");
  assert.ok(m && m[0].includes("simdiki"), "görsel işaret eksik");
});

test("yıldızlar dolu/boş glifle ayrılıyor, renkle değil", () => {
  // Renk körlüğü ve küçük punto: 0,55 rem'lik bir glifte renk tek kanal olamaz.
  const h = ciz();
  assert.ok(h.includes("★★★"), "3 yıldız dolu gösterilmeli");
  assert.ok(h.includes("★☆☆"), "1 yıldız iki boş yıldızla gösterilmeli");
});

test("sayfa sınırları dışına taşmıyor", () => {
  const son = izgaraHtml({ m: TR, sayfa: 9, toplam: 1000, enUzak: 1000, bests: {}, simdiki: 1 });
  assert.ok(son.includes('data-n="1000"'), "son bölüm çizilmeli");
  assert.ok(!son.includes('data-n="1001"'), "tablonun dışına çıkılmamalı");
  assert.equal((son.match(/data-n=/g) ?? []).length, 100);
});

// --- Altı durum, dört kanal ---------------------------------------------------
//
// Ölçüm: ızgarada altı durum vardı (kilitli / açık-oynanmamış / 1★ / 2★ / 3★ / şu anki)
// ama pratikte yalnız İKİSİ ayrışıyordu — soluk ve koyu. Sebep bir CSS özgüllük
// çakışmasıydı: `.kutu button` (0-1-1) `.secimDugme` (0-1-0) renklerini eziyordu, yani
// yazılmış üç renk kararı da aynı piksele çıkıyordu. Geriye tek kanal olarak 8,8
// pikselik yıldız glifi kalmıştı.
test("her durum kendi sınıfını taşıyor", () => {
  const h = izgaraHtml({
    m: TR, sayfa: 0, toplam: 1000, enUzak: 12,
    bests: { 1: { s: 3, t: 4 }, 10: { s: 1, t: 9 } }, simdiki: 7
  });
  const dugme = (n: number): string => {
    const m = h.match(new RegExp('<button[^>]*data-n="' + n + '"[^>]*>'));
    assert.ok(m, "düğme yok: " + n);
    return m[0];
  };
  assert.ok(dugme(1).includes("bitti"), "bitirilmiş bölüm işaretli olmalı");
  assert.ok(!dugme(2).includes("bitti"), "oynanmamış bölüm 'bitti' olmamalı");
  assert.ok(dugme(7).includes("simdiki"), "şu anki bölüm işaretli olmalı");
  assert.ok(dugme(13).includes("disabled"), "kilitli bölüm kapalı olmalı");
});

test("patron bölümleri ızgarada da işaretli", () => {
  // Her 10 bölümde bir gelen ritim, 100 düğmelik bir sayfada göz için çapa.
  const h = izgaraHtml({ m: TR, sayfa: 0, toplam: 1000, enUzak: 1000, bests: {}, simdiki: 1 });
  const patron = (h.match(/class="[^"]*patron[^"]*"/g) ?? []).length;
  assert.equal(patron, 10, "bir sayfada on patron olmalı");
  assert.ok(/data-n="10"[^>]*aria-label/.test(h.replace(/\n/g, "")), "10. bölüm çizilmeli");
});

test("ızgara bir LİSTE: ekran okuyucu konum bilgisi verebilsin", () => {
  // Düz bir <div>'de okuyucu ne "100 öğeli liste" ne de "12 / 100" diyebiliyor.
  const h = izgaraHtml({ m: TR, sayfa: 0, toplam: 1000, enUzak: 5, bests: {}, simdiki: 1 });
  assert.equal((h.match(/<li>/g) ?? []).length, 100, "her düğme bir liste öğesinde olmalı");
});

test("bölüm numarası binlik ayırıcı ALMIYOR", () => {
  // "1.000" bir sayı değil etiket; ondalık gibi okunuyordu.
  const h = izgaraHtml({ m: TR, sayfa: 9, toplam: 1000, enUzak: 1000, bests: {}, simdiki: 1 });
  assert.ok(h.includes("<b aria-hidden=\"true\">1000</b>"), "etiket gruplamasız olmalı");
  assert.ok(!h.includes("1.000"), "binlik ayırıcı olmamalı");
});

test("kilitli düğmede yıldız glifi yok", () => {
  // Kilit işareti CSS ile çizilir; glif alanı boş bırakılır ki 100 satır inline SVG
  // sayfanın HTML'ini iki katına çıkarmasın.
  const h = izgaraHtml({ m: TR, sayfa: 0, toplam: 1000, enUzak: 3, bests: {}, simdiki: 1 });
  const kilitli = h.match(/<button[^>]*data-n="50"[\s\S]*?<\/button>/);
  assert.ok(kilitli, "50. düğme bulunamadı");
  assert.ok(kilitli[0].includes('<i aria-hidden="true"></i>'), "kilitlide glif boş olmalı");
});
