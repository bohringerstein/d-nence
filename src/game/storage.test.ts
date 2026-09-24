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

const { oku, levelKaydet, rekorKaydet, bastanBasla, toplamYildiz, bitirilenLevel, acikMi, tabloSurumuUygula, disaAktar, iceAktar, kayitEskidiMi, kaydiDegistir, kaliciKayitIste } =
  await import("./storage.ts");
const { LEVEL_COUNT } = await import("../core/index.ts");

/**
 * Birincil kayıt anahtarı. Eskiden burada "kasa:v1" yazıyordu — yani 10'dan fazla
 * doğrulama testi aslında GÖÇ yolunu sınıyor, birincil yolu hiç sınamıyordu. Eski
 * anahtar desteği bir gün kaldırılsa bu testler yanlış sebepten düşerdi.
 */
const KEY = "donence:v1";
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

// --- Ulaşılan en uzak bölüm (bölüm seçimi) -----------------------------------
//
// `level` tek başına yetmiyor: bölüm seçimi eklendiğinde 412. bölümdeki oyuncu
// 5. bölüme dönebiliyor ve tek alan olsaydı 412'yi kaybediyordu. İlerleme
// "en uzak" ile ölçülür, "şu an oynanan" ile değil.
test("geriye dönmek açılan bölümleri kapatmıyor", () => {
  depo.temizle();
  const k = oku();
  levelKaydet(k, 412);
  assert.equal(k.enUzak, 412);
  levelKaydet(k, 5);
  assert.equal(k.level, 5, "şu an oynanan bölüm geriye gitmeli");
  assert.equal(k.enUzak, 412, "ulaşılan en uzak bölüm geriye GİTMEMELİ");
  assert.ok(acikMi(k, 412) && acikMi(k, 1), "412'ye kadar her şey açık kalmalı");
  assert.ok(!acikMi(k, 413), "ulaşılmamış bölüm kilitli olmalı");
  // Diske de yazılmış olmalı: yeniden okuyunca kaybolmamalı.
  assert.equal(oku().enUzak, 412);
});

test("alanı olmayan ESKİ kayıtlar açtıkları bölümleri kaybetmiyor", () => {
  // Bu alan sonradan eklendi. Güncellemeyle birlikte herkesin ilerlemesi sıfırlansaydı
  // en kötü türden bir veri kaybı olurdu: sessiz ve kullanıcının fark edemediği.
  depo.temizle();
  depo.setItem("donence:v1", JSON.stringify({
    surum: 1, level: 318, bests: { 1: { s: 3, t: 4 }, 412: { s: 2, t: 8 } }
  }));
  const k = oku();
  assert.equal(k.enUzak, 412, "bitirilmiş en yüksek bölüm de hesaba katılmalı");
  assert.ok(acikMi(k, 318));
});

test("baştan başla açılan bölümleri de kilitliyor", () => {
  // Bilerek yıkıcı: geri alınabilir olsaydı (bölüm seçiminden hemen 412'ye dönmek)
  // iki aşamalı onayın bir anlamı kalmazdı. Bölümleri kaybetmeden baştan oynamanın
  // yolu bölüm seçimi.
  depo.temizle();
  const k = oku();
  levelKaydet(k, 412);
  rekorKaydet(k, 7, { s: 3, t: 5 });
  bastanBasla(k);
  assert.equal(k.level, 1);
  assert.equal(k.enUzak, 1);
  assert.ok(!acikMi(k, 2), "açılan bölümler kilitlenmeli");
  assert.equal(toplamYildiz(k), 3, "yıldızlar kalmalı");
  assert.equal(oku().enUzak, 1, "diske yazılmalı");
});

test("bozuk enUzak değeri türetilerek düzeltiliyor", () => {
  depo.temizle();
  depo.setItem("donence:v1", JSON.stringify({ surum: 1, level: 50, enUzak: 99999, bests: {} }));
  assert.equal(oku().enUzak, 50, "tablo dışı değer kabul edilmemeli");
  depo.temizle();
  depo.setItem("donence:v1", JSON.stringify({ surum: 1, level: 50, enUzak: 3, bests: {} }));
  assert.equal(oku().enUzak, 50, "en uzak, oynanan bölümün gerisinde kalamaz");
});

// --- Tablo sürümü ------------------------------------------------------------
//
// Kayıt bölümleri NUMARAYLA saklıyor. Tablo bir kez yeniden üretildi ve ölçüldü:
// 1000 bölümün 966'sının tanımı, 761'inin süre sınırı değişti; 303 bölümde kayıtlı
// rekor yeni sınırı aşıyordu, yani oyuncuya ulaşılamaz bir hedef gösteriliyordu.
// Kayıtta bir `surum` alanı vardı ama hiç okunmuyordu.
test("damgadan ÖNCEKİ kayıtlar cezalandırılmaz: benimser, silmez", () => {
  depo.temizle();
  const k = oku();
  levelKaydet(k, 412);
  rekorKaydet(k, 7, { s: 3, t: 5 });
  assert.equal(k.tabloSurum, undefined, "eski kayıtta alan yok");
  const silinen = tabloSurumuUygula(k, "abc123");
  assert.equal(silinen, 0, "alan yoksa silme yapılmamalı");
  assert.equal(k.tabloSurum, "abc123");
  assert.equal(bitirilenLevel(k), 1, "rekor korunmalı");
  assert.equal(oku().tabloSurum, "abc123", "diske yazılmalı");
});

test("tablo değişince YALNIZ rekorlar silinir, ilerleme korunur", () => {
  // Yanlış bir rekoru taşımakla 412 bölümlük ilerlemeyi silmek arasında seçim
  // yapmak gerekmiyor: üçüncü yol var ve doğru olan o.
  depo.temizle();
  const k = oku();
  levelKaydet(k, 412);
  rekorKaydet(k, 7, { s: 3, t: 5 });
  rekorKaydet(k, 9, { s: 2, t: 8 });
  tabloSurumuUygula(k, "surum1");
  const silinen = tabloSurumuUygula(k, "surum2");
  assert.equal(silinen, 2, "iki rekor silinmeliydi");
  assert.deepEqual(k.bests, {});
  assert.equal(k.enUzak, 412, "açılan bölümler KORUNMALI");
  assert.equal(k.level, 412, "kaldığı yer korunmalı");
  assert.equal(k.tabloSurum, "surum2");
});

test("aynı sürümde hiçbir şey olmuyor", () => {
  depo.temizle();
  const k = oku();
  rekorKaydet(k, 3, { s: 1, t: 9 });
  tabloSurumuUygula(k, "aynı");
  assert.equal(tabloSurumuUygula(k, "aynı"), 0);
  assert.equal(bitirilenLevel(k), 1, "rekor durmalı");
});

test("damgasız tabloyla da oyun açılır", () => {
  // Damgadan önce üretilmiş bir tablo hâlâ okunabilmeli.
  depo.temizle();
  const k = oku();
  rekorKaydet(k, 3, { s: 1, t: 9 });
  assert.equal(tabloSurumuUygula(k, undefined), 0);
  assert.equal(bitirilenLevel(k), 1);
});

// --- İlerlemeyi taşımak -------------------------------------------------------
//
// Kayıt tek bir tarayıcı profilinde duruyor. Telefon değiştiren oyuncu 412 bölümlük
// ilerlemesini kaybediyor; mağaza sürümüne geçişte de aynı olacak, çünkü Capacitor
// içeriği başka bir origin'den sunar ve localStorage origin'e bağlı.
test("yedek gidip geri geliyor", () => {
  depo.temizle();
  const k = oku();
  levelKaydet(k, 412);
  rekorKaydet(k, 7, { s: 3, t: 5.25 });
  rekorKaydet(k, 200, { s: 2, t: 9.5 });
  tabloSurumuUygula(k, "surum1");

  const geri = iceAktar(disaAktar(k));
  assert.ok(geri, "yedek okunabilmeli");
  assert.equal(geri.enUzak, 412);
  assert.equal(geri.level, 412);
  assert.equal(geri.tabloSurum, "surum1");
  assert.deepEqual(geri.bests[7], { s: 3, t: 5.25 });
  assert.equal(bitirilenLevel(geri), 2);
});

test("bozuk yedek reddedilir, kısmen yüklenmez", () => {
  // Elle yapıştırılan bir metin güvenilmeyen girdidir ve ayıklama `oku()` ile AYNI
  // yoldan geçer. Kısmi bir kayıt yüklemektense hiç yüklememek iyidir.
  for (const bozuk of ["", "{}", "merhaba", '{"level":5}', '{"dnc":99,"enUzak":5}']) {
    assert.equal(iceAktar(bozuk), null, `reddedilmeliydi: ${bozuk}`);
  }
  // BOŞ ama geçerli bir yedek artık burada reddedilmiyor: o karar mevcut kayda
  // bakmalı ve çağrı yerinde veriliyor (bkz. main.ts). Denetim burada olduğu sürece
  // 1. bölümdeki oyuncunun kendi yedeği "Kod okunamadı" diyordu.
  assert.ok(iceAktar('{"dnc":1,"level":1,"enUzak":1,"bests":{}}'),
    "boş ama geçerli yedek okunabilmeli");
});

test("yedekteki bozuk rekorlar ayıklanıyor", () => {
  const metin = JSON.stringify({
    dnc: 1, level: 10, enUzak: 10,
    bests: { 5: { s: 2, t: 4 }, 6: { s: 9, t: 4 }, "__proto__": { s: 1, t: 1 }, 99999: { s: 1, t: 1 } }
  });
  const k = iceAktar(metin);
  assert.ok(k);
  assert.deepEqual(Object.keys(k.bests), ["5"], "yalnız geçerli rekor kalmalı");
  // Bu iddia YANLIŞ NESNEYE bakıyordu ve başarısız OLAMAZDI: yük `bests["__proto__"]`,
  // yani koruma kaldırılsaydı kirlenecek olan Object.prototype değil `k.bests`'in
  // prototipiydi.
  assert.equal((k.bests as Record<string, unknown>).s, undefined, "bests prototipi kirlenmemeli");
  assert.equal(Object.getPrototypeOf(k.bests), Object.prototype, "bests prototipi değişmemeli");
  assert.equal(({} as Record<string, unknown>).s, undefined, "Object.prototype kirlenmemeli");
});

test("iki sekme: yazma diskle birleşir, öbür sekmenin ilerlemesi ve rekoru kaybolmaz", () => {
  yaz({ level: 10, enUzak: 10, tabloSurum: "aaa", bests: { 3: { s: 1, t: 5 } } });
  const a = oku(), b = oku();
  levelKaydet(a, 40);                        // A sekmesi 40'a ilerledi
  rekorKaydet(a, 3, { s: 3, t: 4 });         // ve 3'te rekor kırdı
  rekorKaydet(b, 7, { s: 2, t: 6 });         // B (belleğinde hâlâ 10) başka rekor kırdı
  const son = oku();
  assert.equal(son.enUzak, 40, "A'nın ilerlemesi B'nin yazmasıyla geri gitmemeli");
  assert.deepEqual(son.bests[3], { s: 3, t: 4 }, "A'nın rekoru korunmalı");
  assert.deepEqual(son.bests[7], { s: 2, t: 6 });
});

test("eski sekme yeni tablonun damgasını ve rekorlarını ezmez, yalnız ilerleme taşır", () => {
  yaz({ level: 10, enUzak: 10, tabloSurum: "eski", bests: { 3: { s: 1, t: 5 } } });
  const eski = oku(), yeni = oku();
  tabloSurumuUygula(yeni, "yeni");           // yeni sürüm açıldı, rekorlar silindi
  rekorKaydet(yeni, 5, { s: 3, t: 2 });
  assert.equal(kayitEskidiMi(), false);
  levelKaydet(eski, 12);                     // eski sekme bir bölüm daha bitirdi
  rekorKaydet(eski, 11, { s: 3, t: 1 });
  assert.equal(kayitEskidiMi(), true, "eski sekme yenilenmek üzere işaretlenmeli");
  const son = oku();
  assert.equal(son.tabloSurum, "yeni");
  assert.deepEqual(son.bests, { 5: { s: 3, t: 2 } }, "eski tablonun rekoru yazılmamalı");
  assert.equal(son.enUzak, 12, "ilerleme tablodan bağımsızdır, taşınmalı");
});

test("Baştan başla birleştirmeyle geri alınmaz", () => {
  yaz({ level: 400, enUzak: 412, tabloSurum: "aaa", bests: {} });
  const k = oku();
  bastanBasla(k);
  levelKaydet(k, 1);
  assert.equal(oku().enUzak, 1);
});

test("bölüm başına özet: yalnız tanımı değişen bölümün rekoru silinir", () => {
  const ozetA: Record<number, string> = { 1: "aaaa0001", 2: "aaaa0002", 3: "aaaa0003" };
  yaz({ level: 3, enUzak: 3, tabloSurum: "t1", bests: {
    1: { s: 3, t: 4, h: "aaaa0001" }, 2: { s: 2, t: 5, h: "aaaa0002" }, 3: { s: 1, t: 6, h: "aaaa0003" } } });
  const k = oku();
  // Yeni tablo: yalnız 2. bölüm değişti.
  const ozetB: Record<number, string> = { ...ozetA, 2: "bbbb0002" };
  const silinen = tabloSurumuUygula(k, "t2", n => ozetB[n]);
  assert.equal(silinen, 1);
  assert.deepEqual(Object.keys(k.bests).sort(), ["1", "3"]);
  assert.equal(oku().tabloSurum, "t2");
});

test("özetten önceki rekor: aynı tablodaysa benimsenir ve özet yazılır, başka tablodaysa silinir", () => {
  yaz({ level: 2, enUzak: 2, tabloSurum: "t1", bests: { 1: { s: 3, t: 4 }, 2: { s: 2, t: 5 } } });
  const k = oku();
  assert.equal(tabloSurumuUygula(k, "t1", n => "ozet" + n), 0);
  assert.equal(oku().bests[1].h, "ozet1", "benimsenen rekor özetini almalı");

  yaz({ level: 2, enUzak: 2, tabloSurum: "eski", bests: { 1: { s: 3, t: 4 } } });
  const e = oku();
  assert.equal(tabloSurumuUygula(e, "t1", n => "ozet" + n), 1, "başka tablonun özetsiz rekoru silinmeli");
  assert.equal(oku().enUzak, 2, "ilerleme korunmalı");
});

test("damgadan önceki kayıt özetle de cezalandırılmaz", () => {
  yaz({ level: 2, enUzak: 2, bests: { 1: { s: 3, t: 4 } } });
  const k = oku();
  assert.equal(tabloSurumuUygula(k, "t1", n => "ozet" + n), 0);
  assert.equal(oku().bests[1].h, "ozet1");
});

test("nesil: A'da Baştan başla, B'de kazanma — sıfırlama kalıcı, B eski sayılır", () => {
  yaz({ level: 412, enUzak: 412, tabloSurum: "t", bests: { 5: { s: 2, t: 4 } } });
  const a = oku(), b = oku();
  bastanBasla(a);
  levelKaydet(b, 413);
  const yeni = rekorKaydet(b, 412, { s: 3, t: 3 });
  const disk = oku();
  assert.equal(disk.enUzak, 1, "sıfırlama başka sekme tarafından geri alınmamalı");
  assert.equal(disk.bests[412], undefined, "eski sekmenin rekoru yazılmamalı");
  assert.equal(yeni, false, "yazılmayan rekor 'rekor' sayılmamalı");
  assert.equal(kayitEskidiMi(), true);
  assert.equal(b.enUzak, 1, "eski sekmenin belleği diskle tazelenmeli");
});

test("nesil: A'da yedek yükleme, B'de rekor — diskte yedeğin rekorları kalır", () => {
  yaz({ level: 20, enUzak: 20, tabloSurum: "t", bests: { 1: { s: 3, t: 2 } } });
  const a = oku(), b = oku();
  kaydiDegistir(a, { level: 3, enUzak: 3, tabloSurum: "t", bests: { 1: { s: 1, t: 9 } } });
  rekorKaydet(b, 1, { s: 3, t: 1 });
  const disk = oku();
  assert.deepEqual(disk.bests, { 1: { s: 1, t: 9 } });
  assert.equal(disk.enUzak, 3);
});

test("nesil: alanı olmayan kayıt 0 sayılır; art arda iki sıfırlama nesli iki artırır", () => {
  yaz({ level: 5, enUzak: 5, bests: {} });
  const k = oku();
  assert.equal(k.nesil, undefined);
  bastanBasla(k); bastanBasla(k);
  assert.equal(oku().nesil, 2);
  // Nesil eşitken bugünkü birleştirme aynen çalışır.
  const x = oku(), y = oku();
  levelKaydet(x, 7); levelKaydet(y, 3);
  assert.equal(oku().enUzak, 7);
});

test("kalıcı kayıt bir kez istenir; destek yoksa sessiz geçer", () => {
  let cagri = 0;
  Object.defineProperty(globalThis.navigator, "storage", {
    value: { persist: async () => { cagri++; return true; } }, configurable: true
  });
  kaliciKayitIste(); kaliciKayitIste(); kaliciKayitIste();
  assert.equal(cagri, 1);
});
