// Ritim denetiminin saf istatistik çekirdeği.
//
// Neden ayrı dosya: bu fonksiyonlar YAYIN KAPISIDIR — `npm run verify` onlara bakıp
// tabloyu geçirir ya da reddeder. Belgenin kendi anlattığına göre bu kapı iki kez
// anlamsızdı (ilk hâli tek bir gecikmeye bakıyordu, ikincisinin tavanı elle konmuştu)
// ve ikisi de fark edilmeden çalıştı. "Hiç ateşlendiğini görmediğimiz kapı" bu projede
// yaşanmış bir hata; bu yüzden hepsi saf tutuldu ve `istatistik.test.ts` ile sınanıyor.
//
// Hiçbiri modül düzeyinde durum kullanmaz; `yerelRng` üreticinin `es`/`seed`
// akışlarına DOKUNMAZ, yoksa denetim ölçtüğü şeyi bozardı.

/** Deterministik yerel RNG (Lehmer). Aynı tohum her zaman aynı diziyi verir. */
export function yerelRng(tohum: number): () => number {
  let s = tohum >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Fisher-Yates. Girdi dizisini DEĞİŞTİRMEZ; çokküme korunur. */
/**
 * Seriyi ardışık `blok` uzunluğundaki parçaların İÇİNDE karıştırır; parçalar yerinde kalır.
 *
 * Neden: dizi bilerek EĞİLİMLİ olduğunda (ör. geç oyunda 6 halkalı bölümlerin payı
 * artıyor) tam karıştırma bu eğilimi de yok eder. O zaman komşu bölümlerin benzer
 * olması — yavaş değişen bir dağılımın doğal sonucu — "tekrar" sayılır ve boş hipotez
 * haksız yere düşük kalır. Blok içi karıştırma eğilimi blok çözünürlüğünde korur ama
 * blok içindeki ve bloklar arası her HİZALAMAYI rastgeleler; aranan şey (belirli bir
 * gecikmede kendini tekrar eden desen) yine yok edilir.
 */
export function blokKaristir<T>(a: readonly T[], r: () => number, blok: number): T[] {
  const b = [...a];
  for (let bas = 0; bas < b.length; bas += blok) {
    const son = Math.min(b.length, bas + blok);
    for (let i = son - 1; i > bas; i--) {
      const j = bas + Math.floor(r() * (i - bas + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
  }
  return b;
}

export function seriKaristir<T>(a: readonly T[], r: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/**
 * Tarafsız özilinti dizisi: `lagAlt`..`lagUst` arası her gecikme için bir değer.
 *
 * Payda da `N−lag` terim üzerinden normalize edilir. Taraflı tahminci (payda `N`)
 * uzun gecikmeleri YAPISAL olarak küçültür — lag 840'ta yalnız 160 terim kalır ve
 * sonuç kaçınılmaz olarak ~0 çıkar, yani metrik uzun periyotları prensip olarak
 * bulamazdı.
 *
 * Tek kopya olması şart: bu hesap bir ara üç ayrı yerde elle yazılıydı (ölçüm, tavan
 * ve teşhis için). Biri düzeltilip öbürü unutulsaydı ölçüm ile tavan FARKLI metrikten
 * gelir ve denetim sessizce anlamsızlaşırdı.
 */
export function ozilintiler(d: readonly number[], lagAlt: number, lagUst: number): Float64Array {
  const n = d.length;
  const ort = d.reduce((a, b) => a + b, 0) / n;
  let toplamKare = 0;
  for (const x of d) toplamKare += (x - ort) ** 2;
  const ust = Math.min(lagUst, n - 1);
  const out = new Float64Array(Math.max(0, ust - lagAlt + 1));
  for (let lag = lagAlt; lag <= ust; lag++) {
    const m = n - lag;
    let p = 0;
    for (let i = 0; i < m; i++) p += (d[i] - ort) * (d[i + lag] - ort);
    out[lag - lagAlt] = toplamKare > 0 ? p / (toplamKare * m / n) : 0;
  }
  return out;
}

export interface Tepe { lag: number; deger: number }

/** Bir gecikme dizisinin en büyük değeri ve yeri. */
export function tepeNoktasi(v: Float64Array, lagAlt: number): Tepe {
  let lag = lagAlt, deger = -Infinity;
  for (let i = 0; i < v.length; i++) if (v[i] > deger) { deger = v[i]; lag = lagAlt + i; }
  return { lag, deger };
}

/**
 * Kategorik seride tekrar ölçüsü: `s[i] === s[i+lag]` eşleşme oranı.
 * En az `enAzTerim` çift kalmayan gecikmeler taranmaz — daha azında oran tek tük
 * çiftin eseri olur.
 */
export function eslesmeTepesi(
  d: readonly number[], lagAlt: number, lagUst: number, enAzTerim = 30
): Tepe {
  let lag = lagAlt, deger = -Infinity;
  const ust = Math.min(lagUst, d.length - enAzTerim);
  for (let l = lagAlt; l <= ust; l++) {
    const n = d.length - l;
    let e = 0;
    for (let i = 0; i < n; i++) if (d[i] === d[i + l]) e++;
    const o = e / n;
    if (o > deger) { deger = o; lag = l; }
  }
  return { lag, deger };
}

/** En uzun kesintisiz `true` serisi. */
export function enUzunSeri(d: readonly boolean[]): number {
  let en = 0, ard = 0;
  for (const x of d) { if (x) { ard++; if (ard > en) en = ard; } else ard = 0; }
  return en;
}

/**
 * Tavanı elle koymak yerine BOŞ HİPOTEZDEN türetir.
 *
 * Sorulan soru: "aynı seri rastgele sıralanmış olsaydı bu istatistik en fazla ne kadar
 * yükselirdi?" Tavan, o dağılımın `dilim`'lik yüzdeliği. Böylece eşik serinin kendi
 * dağılımından gelir, elden değil — ve ölçüm tavanı aştığında tavanı yükseltmek gibi
 * bir seçenek kalmaz.
 *
 * `olc` gecikmeler üzerinde bir MAKSİMUM döndürdüğü için gecikmeler arası çoklu
 * karşılaştırma düzeltmesi bedava gelir: boş hipotez de aynı maksimumu alıyor.
 * Seriler arası düzeltme çağıranın işi (bkz. PERM_DILIM, Bonferroni).
 */
export function permutasyonTavani<T>(
  seri: readonly T[], olc: (d: T[]) => number, tohum: number, tur: number, dilim: number, blok = 0
): number {
  const r = yerelRng(tohum);
  const v: number[] = [];
  for (let k = 0; k < tur; k++) v.push(olc(blok > 0 ? blokKaristir(seri, r, blok) : seriKaristir(seri, r)));
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(tur * dilim))];
}
