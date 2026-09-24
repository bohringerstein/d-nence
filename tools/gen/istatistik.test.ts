// Ritim denetiminin saf çekirdeği. Bu testlerin varlık sebebi tek cümlede:
// bu kod YAYIN KAPISI ve daha önce iki kez fark edilmeden anlamsız çalıştı.
// En önemlisi "permütasyon tavanı gerçekten ateşleniyor mu" testidir.
import test from "node:test";
import assert from "node:assert";
import {
  yerelRng, seriKaristir, blokKaristir, ozilintiler, tepeNoktasi, eslesmeTepesi, enUzunSeri, permutasyonTavani
} from "./istatistik.ts";

test("yerelRng aynı tohumda aynı diziyi verir ve [0,1) aralığında kalır", () => {
  const a = yerelRng(7), b = yerelRng(7), c = yerelRng(8);
  const xa = Array.from({ length: 200 }, a);
  const xb = Array.from({ length: 200 }, b);
  assert.deepEqual(xa, xb, "aynı tohum aynı diziyi vermeli");
  assert.notDeepEqual(xa, Array.from({ length: 200 }, c), "farklı tohum farklı dizi vermeli");
  for (const x of xa) assert.ok(x >= 0 && x < 1, `aralık dışı: ${x}`);
});

test("seriKaristir girdiyi değiştirmez, çokkümeyi korur", () => {
  const girdi = [1, 1, 2, 3, 3, 3, 4];
  const kopya = [...girdi];
  const cikti = seriKaristir(girdi, yerelRng(42));
  assert.deepEqual(girdi, kopya, "girdi dizisi değişmemeli");
  assert.equal(cikti.length, girdi.length);
  assert.deepEqual([...cikti].sort(), [...girdi].sort(), "çokküme korunmalı");
});

test("enUzunSeri kenar durumları", () => {
  assert.equal(enUzunSeri([]), 0);
  assert.equal(enUzunSeri([false, false]), 0);
  assert.equal(enUzunSeri([true, true, true]), 3);
  assert.equal(enUzunSeri([true, true, false, true]), 2);
  assert.equal(enUzunSeri([false, true, true, true, false, true]), 3);
});

test("eslesmeTepesi periyodik seride periyodu bulur", () => {
  const periyodik = Array.from({ length: 400 }, (_, i) => i % 8);
  const t = eslesmeTepesi(periyodik, 2, 100);
  assert.equal(t.lag, 8, "periyot 8 bulunmalı, bulunan " + t.lag);
  assert.ok(t.deger > 0.99, "tam periyotta eşleşme ~1 olmalı, " + t.deger);

  const sabit = new Array(400).fill(3);
  assert.ok(eslesmeTepesi(sabit, 2, 100).deger > 0.99, "sabit seride eşleşme ~1");

  // Rastgele seride tepe, Simpson indeksine (burada 1/8) yakın kalmalı.
  const r = yerelRng(99);
  const rasgele = Array.from({ length: 400 }, () => Math.floor(r() * 8));
  assert.ok(eslesmeTepesi(rasgele, 2, 100).deger < 0.30,
    "rastgele seride tepe düşük olmalı: " + eslesmeTepesi(rasgele, 2, 100).deger);
});

test("ozilintiler bilinen periyotlu sinüste o periyotta tepe yapar", () => {
  const n = 600, periyot = 24;
  const seri = Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * i / periyot));
  const t = tepeNoktasi(ozilintiler(seri, 5, 200), 5);
  assert.equal(t.lag % periyot, 0, `tepe periyodun katında olmalı, lag ${t.lag}`);
  assert.ok(t.deger > 0.8, "saf sinüste özilinti yüksek olmalı: " + t.deger);
});

test("ozilintiler tarafsız: beyaz gürültüde uzun gecikmeler yapısal olarak küçülmez", () => {
  // Taraflı tahminci (payda N) lag büyüdükçe değeri sıfıra doğru ezerdi; o yüzden
  // denetim uzun periyotları prensip olarak bulamıyordu.
  const r = yerelRng(5);
  const seri = Array.from({ length: 900 }, () => r() - 0.5);
  const v = ozilintiler(seri, 15, 300);
  const ilk = Array.from(v.slice(0, 50)).map(Math.abs).reduce((a, b) => a + b, 0) / 50;
  const son = Array.from(v.slice(-50)).map(Math.abs).reduce((a, b) => a + b, 0) / 50;
  assert.ok(son > ilk * 0.5, `uzun gecikmeler ezilmemeli: ilk ${ilk.toFixed(3)}, son ${son.toFixed(3)}`);
});

// ---- Kapı gerçekten ateşleniyor mu? ---------------------------------------
//
// Bu projenin en pahalı hata sınıfı "hiç ateşlendiğini görmediğimiz kapı". İki yön de
// sınanmalı: gerçek periyotta tavanı AŞMALI, gürültüde AŞMAMALI.

test("permutasyonTavani gerçek periyodu yakalar, gürültüyü yakalamaz", () => {
  const TUR = 200, DILIM = 0.99, ALT = 2, UST = 100;
  const olc = (d: number[]): number => eslesmeTepesi(d, ALT, UST).deger;

  // (a) Enjekte edilmiş tam periyot: tavanı AŞMALI.
  const periyodik = Array.from({ length: 400 }, (_, i) => i % 8);
  const gozlenenP = olc(periyodik);
  const tavanP = permutasyonTavani(periyodik, olc, 101, TUR, DILIM);
  assert.ok(gozlenenP > tavanP,
    `periyodik seri tavanı aşmalıydı: gözlenen ${gozlenenP.toFixed(3)} vs tavan ${tavanP.toFixed(3)}`);

  // (b) Aynı ÇOKKÜME, sırası rastgele: tavanı AŞMAMALI.
  // Aynı kümeyi kullanmak şart — yoksa test periyodu değil dağılımı ölçerdi.
  const karisik = seriKaristir(periyodik, yerelRng(7));
  const gozlenenK = olc(karisik);
  const tavanK = permutasyonTavani(karisik, olc, 101, TUR, DILIM);
  assert.ok(gozlenenK <= tavanK,
    `karışık seri tavanı aşmamalıydı: gözlenen ${gozlenenK.toFixed(3)} vs tavan ${tavanK.toFixed(3)}`);
});

test("permutasyonTavani dilim yükseldikçe tavan yükselir", () => {
  const r = yerelRng(3);
  const seri = Array.from({ length: 300 }, () => Math.floor(r() * 5));
  const olc = (d: number[]): number => eslesmeTepesi(d, 2, 80).deger;
  const t90 = permutasyonTavani(seri, olc, 11, 300, 0.90);
  const t99 = permutasyonTavani(seri, olc, 11, 300, 0.99);
  assert.ok(t99 >= t90, `%99 dilimi %90'dan küçük olamaz: ${t99} < ${t90}`);
});

test("permutasyonTavani deterministik", () => {
  const seri = Array.from({ length: 200 }, (_, i) => i % 5);
  const olc = (d: number[]): number => eslesmeTepesi(d, 2, 60).deger;
  assert.equal(permutasyonTavani(seri, olc, 77, 100, 0.99),
               permutasyonTavani(seri, olc, 77, 100, 0.99), "aynı tohum aynı tavanı vermeli");
});

test("blokKaristir parçaların içeriğini korur, yalnız sırayı değiştirir", () => {
  const seri = Array.from({ length: 250 }, (_, i) => i);
  const k = blokKaristir(seri, yerelRng(7), 100);
  for (const [a, b] of [[0, 100], [100, 200], [200, 250]]) {
    assert.deepEqual([...k.slice(a, b)].sort((x, y) => x - y), seri.slice(a, b));
  }
  assert.notDeepEqual(k, seri);
});

test("blok içi boş hipotez eğilimli seride yanlış alarm vermez, gerçek periyodu yine yakalar", () => {
  // Eğilimli ama periyotsuz seri: 6'ların payı %40'tan %80'e çıkıyor.
  const r = yerelRng(11);
  const egilimli = Array.from({ length: 800 }, (_, i) => (r() < 0.4 + 0.4 * i / 800 ? 6 : 5));
  const olc = (d: number[]): number => eslesmeTepesi(d, 20, 300).deger;
  const olcum = olc(egilimli);
  assert.ok(olcum <= permutasyonTavani(egilimli, olc, 5, 400, 0.99, 100), "eğilim tekrar sayılmamalı");
  // Aynı seriye 37 periyotlu bir desen gömülürse yakalanmalı.
  const periyodik = egilimli.map((_, i) => (i % 37 < 18 ? 6 : 5));
  assert.ok(olc(periyodik) > permutasyonTavani(periyodik, olc, 5, 400, 0.99, 100), "periyot yakalanmalı");
});
