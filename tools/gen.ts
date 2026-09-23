// Dönence level üretici. Kullanım:
//   npm run gen           -> data/levels.json dosyasını yeniden üretir (sabit tohum, her seferinde aynı sonuç)
//   npm run verify        -> mevcut tabloyu denetler
//   npm run verify:full   -> üstüne determinizmi de sınar
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  TAU, DEG, NEED_PASS, SOLVER_MARGIN, REACT, GAP_MAX_DEG, LEVEL_COUNT, BOSS_ARALIGI, bossMu,
  canPass, stepRings, liveRings, validateTable, solve, ADIM, wrap,
  OPEN_ALL, lockOpen, peekOpen, largestOpen, initialOpen, starRatio
} from "../src/core/index.ts";
import type { RingDef, LevelTable, Open, PatronAnahtari } from "../src/core/index.ts";

/** Üretim sırasındaki ham halka: tanıma gapScale eklenir, gap'i sizeGaps hesaplar. */
interface RawRing extends RingDef { gapScale?: number }

/** Kayıp sebebi: "sure" = zaman doldu, "kanal" = açıklık geçilemeyecek kadar daraldı. */
type Sebep = "sure" | "kanal";
/**
 * Bir oynanış denemesinin sonucu. AYRIK BİRLEŞİM: `q` yalnız kazanılan denemede,
 * `sebep` yalnız kaybedilende vardır. Tek bir arayüzle yazıldığında üç yerde
 * `r.q` gerekiyordu ve "kaybedilen bir denemenin q'sunu okuma" hatası
 * derleyicide değil çalışma zamanında ortaya çıkardı.
 */
type PlayResult =
  | { win: true; t: number; q: number }
  | { win: false; t: number; sebep: Sebep };
interface Finalized { def: RingDef[]; best: number; limit: number; want: number; roomy: boolean }
interface Evaluated { win: number; qs: number[]; sureKaybi: number }
type Candidate = Finalized & Evaluated & { tol: number; boss?: PatronAnahtari;
  /** Finalist ölçümü (bağımsız tohum) yapıldı mı; aynı aday iki turda da finale kalabilir. */
  olculdu?: boolean };
/**
 * Patron tasarımı. Görünen ad ve ipucu BURADA DEĞİL, src/dil/ altında: tabloya yalnızca
 * anahtar yazılır. Eskiden Türkçe metin 1000 satırın içine gömülüydü ve çevrilemezdi.
 */
interface Boss { anahtar: PatronAnahtari; rings: () => RawRing[] }
type Log = (...args: unknown[]) => void;

import * as IST from "./gen/istatistik.ts";
import type { Tepe } from "./gen/istatistik.ts";

const OUT = path.join(import.meta.dirname, "..", "data", "levels.json");
let seed = 12345; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let es = 1; const ER = () => { es = (es * 16807) % 2147483647; return es / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(ER() + 1e-9)) * Math.cos(TAU * ER());
const rnd4 = (x: number): number => Math.round(x * 1e4) / 1e4;
// Çözücünün kendine bıraktığı pay: geçiş eşiğinin biraz üstünü hedefler ki insan oyuncuya yer kalsın.
const needS = NEED_PASS + SOLVER_MARGIN;

// İnsan benzeri oyuncu: dokunuşu ±sigma sn sapar
function play(def: RingDef[], limit: number, { tol = 0.7, sigma = 0.06 } = {}): PlayResult {
  const rs = liveRings(def), dt = ADIM; let open = initialOpen(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r.locked) continue;
    const rem = rs.filter((x, k) => k > i && !x.locked).length; let done = false;
    while (t < limit) {
      let want = false;
      if (t >= last + REACT) {
        if (open === OPEN_ALL) want = true;
        else {
          const cur = largestOpen(open).w, allow = (cur - needS) / (rem + 1) * tol;
          const p = peekOpen(open, r);
          if (p.w >= needS && cur - p.w <= allow) want = true;
        }
      }
      if (want) {
        // Dokunus hatasi: erken de gec de olsa TUM halkalari birlikte sarar (gercek oyunda oyuncu zamani kaydirir, tek halkayi degil)
        const e = gauss() * sigma;
        const sdt = e >= 0 ? dt : -dt;
        // İleri adım lt'yi adımdan SONRA, geri adım ÖNCE alır: ancak böyle tam tersine çevrilebilir.
        for (let k = Math.abs(e); k > 0; k -= dt) { const lt = sdt > 0 ? t + sdt : t; stepRings(rs, sdt, lt); t += sdt; }
        open = lockOpen(open, r);
        if (!canPass(largestOpen(open).w)) return { win: false, t, sebep: "kanal" };
        r.locked = true; last = t; done = true; break;
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return { win: false, t, sebep: "sure" };
  }
  const minGap = Math.min(...def.map(r => r.gap)) * DEG;
  return { win: true, t, q: starRatio(largestOpen(open).w, minGap) };
}

/**
 * Boşluk genişliği, hata payından türetilir.
 *
 * Türetme: kanal [−W/2, W/2], halkanın boşluğu ideal konumdan d kadar kaymış, yarım
 * genişliği h olsun. Kesişim [max(−W/2, d−h), min(W/2, d+h)]'dir, yani kanal en fazla
 * |d| kadar daralır. Oyuncu i. halkaya ε saniye hatayla dokunursa d = ω_i·ε olur ve
 * toplam kayıp Σ|ω_i·ε_i| ile sınırlıdır. Boşluk bu üst sınırı karşılamalıdır:
 *
 *     gap = NEED_PASS + tolSn × Σ|ω_i|
 *
 * **İlk kilit toplama girmez.** İlk kilit kanalı DARALTMAZ, tanımlar: kanal o halkanın
 * boşluğunun kendisidir, hangi açıda kilitlendiği genişliği değiştirmez. Daraltan
 * kilitler 2..n'dir. Eskiden formül ilk halkayı da topluyordu; bu zorluğu bozmuyordu
 * (tune her bölümün tol'unu ayrı ayarlar) ama tol'un "saniye cinsinden hata payı"
 * anlamını bozuyordu: 2 halkalı bölümde %100, 6 halkalıda %20 şişiriyordu.
 *
 * Halkalar bu ortak genişliği kendi gapScale çarpanıyla ölçekler.
 */
function sizeGaps(rings: RawRing[], tolSec: number): void {
  const base = NEED_PASS / DEG + tolSec * daraltanHizToplami(rings) / DEG;
  for (const r of rings) {
    const gap = Math.min(base * (r.gapScale || 1), GAP_MAX_DEG);
    r.gap = gap;
    if (r.gaps === 2 && (gap > 80 || r.gapOffset < gap + 30 || 360 - r.gapOffset < gap + 30)) r.gaps = 1;
  }
}


/**
 * Bir bölümü geçmek için gereken zamanlama hassasiyeti (saniye):
 *
 *     tau = (en dar boşluk − NEED_PASS) / (kanalı daraltan kilitlerin hız toplamı)
 *
 * Zorluğun TEK gerçek ekseni budur ve aşağıdan insan refleksiyle sınırlıdır. İnsanın
 * dokunuş zamanlaması ~60 ms standart sapmayla dağılır; tau 60 ms iken oyuncu kilit
 * başına 1 sigma isabet tutturmak zorundadır, 30 ms iken 0,5 sigma.
 *
 * 25 ms'nin altı adil değildir: orada bölüm beceriyle değil şansla geçilir.
 */
const TAU_TABAN = 0.025;

/**
 * Kanalı daraltan kilitlerin hız toplamı — `sizeGaps` ve `tauHesapla` AYNI değeri
 * kullanmak zorunda, çünkü τ o formülün tersidir:
 *   gap = NEED_PASS + tol · Σ'|ω|   ⇒   τ = (minGap − NEED_PASS) / Σ'|ω|
 *
 * En yavaş halka toplamdan DÜŞÜLÜR, çünkü oyuncunun ilk kilidi kanalı KURAR,
 * daraltmaz; kanalı en yavaş halkadan kurmak en az şey kaybettirir.
 *
 * AMA bu yalnız baştan kilitli halka YOKKEN doğrudur. Baştan kilitli halka varsa
 * kanalı onlar tanımlar; oyuncunun ilk kilidi de kanalı daraltır ve düşülecek bir
 * "bedava kilit" kalmaz. Ölçtüm: 384 bölümde bu varsayım geçersizdi ve tutarlı
 * tanımla τ medyanı 35,2 → 28,6 ms'ye iniyor, **92 bölüm 25 ms insan sınırının
 * altına düşüyordu** (en düşüğü 17,7 ms). Yani düzeltilmiş sayılan hatanın (τ'nun
 * şişmesi) bir kalıntısı tam olarak orada duruyordu.
 */
function daraltanHizToplami(def: readonly { speed: number; wobble: boolean; preLocked: boolean }[]): number {
  const hareketli = def.filter(r => !r.preLocked);
  const hizlar = hareketli
    .map(r => Math.abs(r.speed) * (r.wobble ? 1.7 : 1))
    .sort((a, b) => a - b);
  const bedavaKilit = !def.some(r => r.preLocked);
  return (bedavaKilit ? hizlar.slice(1) : hizlar).reduce((t, v) => t + v, 0);
}

/**
 * τ: oyuncunun zamanlama payı (saniye). Tanım ve türetme için bkz. MATEMATIK §3.
 * Payda `daraltanHizToplami` — `sizeGaps` ile birebir aynı olmak zorunda.
 *
 * Eskiden `(k−1) · (Σ|ω|/k)` kullanılıyordu ve `min ≤ ortalama` olduğu için bu her
 * zaman Σ'den KÜÇÜKTÜ, yani τ'yu şişiriyordu: ölçülen oran medyan 1,070. Sonuç:
 * 25 ms tabanı ortalama %7 gevşek çalışıyordu.
 */
function tauHesapla(def: RingDef[]): number {
  const vsum = daraltanHizToplami(def);
  const B = Math.min(...def.map(r => r.gap)) * DEG - NEED_PASS;
  // Daraltan kilit yoksa zamanlama payı sınırsızdır.
  return vsum > 0 ? B / vsum : Infinity;
}

/**
 * Baştan kilitli halkalardan sonra kalması gereken en az hata payı.
 *
 * Tipik bir oyuncunun 60 ms'lik zamanlama sapması ~1,5 rad/sn hızda 5°'ye denk gelir;
 * bunun altında ilk dokunuş kaçınılmaz ölüme dönüşür. Test oyuncuları tam bundan
 * şikâyet etti: eski tabloda halka başına 3,7-4,4° kalan bölümler vardı.
 *
 * Kural AFİNDİR: `6° × (1 + (kalan−1)/2)` = `3°·kalan + 3°`. Eğimi halka başına 6°
 * değil 3°; yani "ilk halkaya tam pay, sonrakilere yarısı". (Eski yorum bunu
 * "doğrusal değildir" diye niteliyordu — yanlış: değişen şey doğrusallık değil eğim.)
 *
 * Neden sonrakilere yarısı: korunmak istenen şey "hiç tepki veremeden ölmek"tir ve bu
 * yalnız BİRİNCİ dokunuşta olur. Dar bir kanalı fark eden oyuncu sonraki halkalarda
 * bekleyebilir; bekleyemediği tek kilit ilkidir.
 *
 * Eski kural (kalan × 6°) 5 halkalı bir bölümde 30° pay şart koşuyordu ve boşluğu
 * zorunlu olarak geniş bırakıyordu; baştan kilitli halkası olan patronlar bu yüzden
 * hedeflerinin 30-44 puan üstünde, yani kolay kalıyordu.
 *
 * Etki alanı geniş: 396 bölümde baştan kilitli halka var ve kısıt SIKI bağlıyor
 * (ölçülen en küçük pay fazlası 0,033°).
 */
const EN_AZ_PAY = 6 * DEG;
const gerekenPay = (kalan: number): number => EN_AZ_PAY * (1 + (kalan - 1) * 0.5);
/**
 * Tek yönlü karıştırıcı (xorshift-multiply). Nefes yürüyüşü ve halka sayısı ritmi
 * bundan beslenir; ikisi de "periyodik değil ama deterministik" olmak zorunda.
 *
 * Math.imul ŞART: `x * 2246822519` çift hassasiyette 2^53'ü aşar ve alt ~11 bit
 * yuvarlanarak kaybolur. Ölçüldü: 300 yinelemenin 149'unda çarpım taşıyor, parite
 * 153'ünde doğru sürümden farklı çıkıyor. Yani düz çarpım bir xorshift-multiply değil,
 * "deterministik bir şey"di; istenen özellikleri (aperiyodik, dengeli) tesadüfen
 * sağlıyordu.
 */
const karistir = (i: number): number => {
  let x = Math.imul(i, 2654435761) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13;
  return x >>> 0;
};

// 17. levelden sonra halka sayısı 6'da sabitleniyordu; 60 levelin 41'i aynı yapıdaydı.
// Bu ritim araya daha az halkalı ama daha dar boşluklu (hassasiyet isteyen) leveller serpiştirir.
const RHYTHM = [6, 6, 5, 6, 4, 6, 5, 6];
/**
 * Ritim kümesi DİZİ olarak uygulandığında (`RHYTHM[(n-1) % 8]`) halka sayısı tam
 * 8 periyotluydu: 4 halkalı bölüm hep n ≡ 5 (mod 8)'e düşüyordu. Arketip döngüsü de
 * 8 periyotlu olduğu için ikisi faz kilitleniyor, oyuncu "her sekizincisi aynı" diye
 * okunabilen bir desen görüyordu.
 *
 * Çözüm nefesteki ile aynı: küme korunur, SIRA karıştırılır. Her 8'lik blok kendi
 * karmasıyla yeniden sıralanır — dağılım blok blok birebir aynı kalır (yani "her 8
 * bölümde bir 4 halkalı" garantisi durur), ama yeri artık öngörülemez ve arketip
 * döngüsüyle faz kilidi kırılır.
 */
const blokOnbellek = new Map<string, unknown[]>();
function blokSirasi<T>(kume: readonly T[], blok: number, tuz: number): T[] {
  // Anahtar kümenin KİMLİĞİNİ de taşımak zorunda. Taşımadığında iki farklı küme aynı
  // tuzla çağrılırsa ikincisi birincinin karıştırılmış dizisini alır ve `as T[]`
  // dönüşümü yüzünden derleyici de yakalamaz. Bugün iki çağrı yeri farklı tuz
  // kullandığı için zararsız, ama bu yazılı olmayan bir sözleşmeydi.
  const anahtar = tuz + ":" + blok + ":" + kume.length + ":" + kume.join(",");
  const hazir = blokOnbellek.get(anahtar);
  if (hazir) return hazir as T[];
  const a = [...kume];
  let x = karistir(blok ^ tuz);
  for (let i = a.length - 1; i > 0; i--) {   // Fisher-Yates
    x = karistir(x + i);
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  blokOnbellek.set(anahtar, a as unknown[]);
  return a;
}
/** Bir döngüsel kümeden, sırası blok blok karıştırılmış olarak seç. */
const blokSec = <T,>(kume: readonly T[], i: number, tuz: number): T =>
  blokSirasi(kume, Math.floor(i / kume.length), tuz)[i % kume.length];

/** Blok karıştırma tuzları. Değerleri keyfidir; tek şart birbirinden FARKLI olmaları. */
const TUZ_RITIM = 0x5bf03635;
const TUZ_ARKETIP = 0x7f4a7c15;

const ringCount = (n: number): number => {
  const grow = Math.min(2 + Math.floor((n - 1) / 4), 6);
  if (grow < 6) return grow;
  return blokSec(RHYTHM, n - 1, TUZ_RITIM);
};
// Süre limiti artık tasarım girdisi: hareketli halka sayısından gelir ve geç levellerde kademeli sıkılaşır.
// Çözücü süresi limiti belirlemez, yalnızca "bu limit yeterli mi" diye denetlenir.
const limitFor = (n: number, moving: number): number =>
  +((4 + 2 * moving) * (1 - 0.22 * Math.min(1, (n - 1) / (TABAN_BOLUM - 1)))).toFixed(1);

/** Tasarim limiti: arketip carpani dahil. Uretim ve dogrulama AYNI fonksiyonu kullanir. */
const tasarimLimiti = (n: number, moving: number): number =>
  +(limitFor(n, moving) * ARKETIP_AYARI[arketip(n)].sureCarpani).toFixed(1);

/**
 * Bir halkanın kilitlenme anının kabaca tahmini.
 *
 * Eğim 0,6 DEĞİL 1,27. Eski değer gerçeğin yarısıydı: referans çözücüyle 1000 bölümde
 * ölçülen medyan kilit anları 0,30 / 1,94 / 3,25 / 4,54 / 5,42 / 6,65 saniye, yani
 * kilitler arası medyan aralık 1,17 sn. Eksik tahmin "güvenli" görünüyordu ama bedeli
 * vardı: `an < 1,2` kuralı ilk iki halkanın flip'ini siliyor ve kalanların periyodunu
 * 0,21-2,31 sn'ye sıkıştırıyordu — flip halkalarının %87'sinin çemberi hiç tarayamamasının
 * doğrudan sebebi buydu (bkz. firsatPeriyodu).
 *
 * Bu yalnızca bir ÖN ELEME; gerçek denetim `finalize` içinde çözücünün kendi kilit
 * anlarıyla yapılır.
 */
const tahminiKilitAni = (sira: number): number => 0.3 + sira * 1.27;

/**
 * Yön değiştiren halkanın dönüşü, o halka kilitlenmeden ÖNCE görülebilmeli.
 * Ölçüm: eski tabloda 68 flip halkasının 55'i (%81) hiç dönmeden kilitleniyordu; ipucu
 * 13. levelde çıkıyor ama dönüş ilk kez 30. levelde (Metronom patronu) görülebiliyordu.
 * Oyuncu mekaniği bir patronda, cezayla öğreniyordu.
 *
 * Kural: flip yalnızca kilitlenmesi 1,2 saniyeden geç olan halkalara verilir ve periyot
 * o süreye sığacak şekilde kısaltılır. Erken kilitlenen halkanın flip'i kaldırılır.
 */
function gorunurFlip(rings: RawRing[]): void {
  let sira = 0;
  for (const r of rings) {
    if (r.preLocked) continue;
    const an = tahminiKilitAni(sira);
    sira++;
    if (!r.flip) continue;
    if (an < 1.2) { r.flip = 0; continue; }          // bu halka dönüşü gösteremeyecek kadar erken kilitlenir
    r.flip = Math.min(r.flip, an * 0.7);             // periyodu kilitlenme anına sığdır
  }
}

/**
 * Zorluk arketipleri.
 *
 * Hassasiyet ekseni (tau) yaklaşık 150. bölümde tabanına oturur ve oradan sonra
 * artırılamaz. Buna rağmen 1000 bölümün birbirinin aynısı olmaması gerekir. Çözüm,
 * aynı kazanma oranını FARKLI BECERİLERLE tutturmak: her arketip başka bir ekseni
 * zorlar, tune() gerekli boşluk genişliğini ona göre ayarlar.
 *
 *   hassasiyet — az halka, yön değiştirme ve dalgalanma yok, en dar pay. Saf zamanlama.
 *   tahmin     — halkaların çoğu yön değiştiriyor veya hızlanıp yavaşlıyor. Nereye
 *                geleceğini öngörmek gerekir.
 *   catal      — halkaların çoğu iki kapılı. Hangi kapıyı seçtiğin sonrakini belirler.
 *   dayaniklilik — altı halka, sıkı süre. Çok karar, az zaman.
 *   karma      — hepsi bir arada.
 */
type Arketip = "hassasiyet" | "tahmin" | "catal" | "dayaniklilik" | "karma";

const ARKETIP_SIRASI: Arketip[] = [
  "karma", "hassasiyet", "tahmin", "karma", "catal", "dayaniklilik", "tahmin", "hassasiyet"
];

/** Arketipler hassasiyet ekseni tükendikten sonra devreye girer. */
const ARKETIP_BASLANGIC = 60;
/**
 * Arketip de DİZİ olarak uygulandığında (`(n−60) mod 8`) tam 8 periyotluydu ve asıl
 * faz kilidini bu üretiyordu — `RHYTHM` değil.
 *
 * Ölçüm: `hassasiyet` 3-4 halka, `dayaniklilik` 5-6 halka zorunlu kılıyor. Arketip
 * 8 periyotlu olduğu için halka sayısı da öyle oluyordu: 8'in KATI olan her
 * gecikmede eşleşme %48, katı olmayanda %28 (beklenen taban %30). `RHYTHM`
 * karıştırıldıktan sonra bile tablo lag 240'ta %53 eşleşme gösterdi; patronlar
 * çıkarılınca %30'a düştü, yani kalan imzayı arketip basıyordu.
 *
 * Çözüm aynı: küme korunur (her 8 bölümde aynı arketip dağılımı), sıra karıştırılır.
 */
const arketip = (n: number): Arketip =>
  n < ARKETIP_BASLANGIC ? "karma" : blokSec(ARKETIP_SIRASI, n - ARKETIP_BASLANGIC, TUZ_ARKETIP);

interface ArketipAyari {
  halka?: [number, number];  // halka sayısı aralığı (kapsayıcı)
  gaps2: number;            // iki kapılı halka olasılığı
  flip: number;             // yön değiştirme olasılığı
  wobble: number;           // hızlanma olasılığı
  preLocked: number;        // baştan kilitli halka olasılığı
  sureCarpani: number;      // süre sınırı çarpanı
}

const ARKETIP_AYARI: Record<Arketip, ArketipAyari> = {
  // halka: [en az, en cok] -> dagilim 3 ile 6 arasinda yigilmasin
  hassasiyet:   { halka: [3, 4], gaps2: 0.00, flip: 0.00, wobble: 0.00, preLocked: 0.15, sureCarpani: 1.15 },
  tahmin:       {           gaps2: 0.10, flip: 0.70, wobble: 0.60, preLocked: 0.30, sureCarpani: 1.10 },
  catal:        {           gaps2: 0.75, flip: 0.15, wobble: 0.15, preLocked: 0.25, sureCarpani: 1.00 },
  dayaniklilik: { halka: [5, 6], gaps2: 0.25, flip: 0.25, wobble: 0.25, preLocked: 0.30, sureCarpani: 0.80 },
  karma:        {           gaps2: 0.30, flip: 0.35, wobble: 0.30, preLocked: 0.50, sureCarpani: 1.00 }
};

/**
 * `hizCarpani` NEDEN VAR — ve neden varsayılanı 1.
 *
 * Normalde hız artırılmaz. Bu tasarımda hız ve boşluk genişliği birbirine bağlıdır:
 * `sizeGaps` boşluğu "tolerans süresi × hız toplamı" ile hesaplar, yani hızlı halka
 * aynı hata payı için daha geniş boşluk ister. τ ≈ tolerans çıkar, hızdan bağımsız.
 * Hızı artırmak zorluğu artırmaz, yalnızca her şeyi büyütüp 85° tavanına dayar.
 * Zorluğun gerçek kolu tolerans süresidir ve onu `tune` ayarlar.
 *
 * AMA bu, boşluğu `sizeGaps`in belirlediği durumda doğrudur. Baştan kilitli halkası
 * olan bölümlerde başlangıç kanalına `gerekenPay` taban koyar ve boşluk o tabanın
 * altına inemez. O zaman tolerans kolu ÖLÜR: `tune` ne yaparsa yapsın bölüm daha zor
 * olamaz. Ölçtüm: 623. bölümde 2 baştan kilitli halka var, hedef %33, ulaşılan %55;
 * `merkez` patronunda aynı kısıt hedefi %22 iken %49'da bırakıyordu.
 *
 * Kanal tabanlandığında τ = (kanal − NEED_PASS) / Σ'|ω| olur ve o zaman hız bir kol
 * haline gelir. Bu yüzden arama, bant dışında kaldığı GEÇ turlarda hızı kademeli artırır.
 *
 * `ekHalka` ise ÜÇÜNCÜ kol ve en son çaredir. Tolerans kolu `TAU_TABAN`'a (25 ms insan
 * sınırı) dayandığında bölüm daha zor OLAMAZ; kalan tek yol daraltan kilit sayısını
 * artırmaktır. Ölçtüm: 332. bölümde 4 halka, τ = 25,5 ms — taban birebir bağlıyordu ve
 * hedef %28 iken ulaşılan %50'de kalıyordu. Beşinci halka o kilidi açar.
 *
 * İkisi de yalnız KOLAY yönde ve yalnız tur sonunda çıkış olmadığında devreye girer;
 * bant içinde ve temiz bölümler ilk turda çıktığı için bu kollar onlara hiç dokunmaz.
 */
function candidate(n: number, hizCarpani = 1, ekHalka = 0): RawRing[] {
  const a = ARKETIP_AYARI[arketip(n)];
  const temel = a.halka ? a.halka[0] + Math.floor(R() * (a.halka[1] - a.halka[0] + 1)) : ringCount(n);
  // `ekHalka`: zorluğun ÜÇÜNCÜ kolu, yalnız ilk ikisi tükendiğinde. Bkz. aday döngüsü.
  const count = Math.min(6, temel + ekHalka);
  const base = Math.min(0.8 + n * 0.03, 2.2) * hizCarpani;
  const rings: RawRing[] = [];
  for (let i = 0; i < count; i++) {
    const dir = n < 3 ? 1 : (R() < 0.5 ? -1 : 1);
    rings.push({ speed: dir * base * (0.7 + R() * 0.6), gap: 0, gapScale: 0.82 + R() * 0.36,
      gaps: n >= 11 && R() < a.gaps2 ? 2 : 1, gapOffset: 130 + R() * 50,
      flip: n >= 12 && R() < a.flip ? 1.4 + R() * 1.8 : 0,
      wobble: n >= 18 && R() < a.wobble, preLocked: false, start: R() * TAU });
  }
  gorunurFlip(rings);
  if (n >= 6 && R() < a.preLocked) {
    const pre = n >= 15 && count >= 4 && R() < 0.5 ? 2 : 1, anchor = R() * TAU, picks: number[] = [];
    while (picks.length < pre) { const k = Math.floor(R() * count); if (!picks.includes(k)) picks.push(k); }
    picks.forEach((k, j) => { Object.assign(rings[k], { preLocked: true, gaps: 1, flip: 0, wobble: false, start: anchor + (j ? (R() - 0.5) * 0.15 : 0) }); });
  }
  // preLocked atamasi siralamayi degistirdigi icin gorunurluk yeniden hesaplanir.
  gorunurFlip(rings);
  // Bosluk genisligini tune() belirler; burada hesaplamak gereksizdi ve yan etkisi
  // (gap > 80 ise gaps 2 -> 1) uretilen iki kapili halkalarin %80'ini yok ediyordu.
  return rings;
}

// ===== Patron levelleri (elle tasarlandı) =====
const A = -Math.PI / 2;
// speed ve start varsayilanlari hicbir cagrida kullanilmaz; yalnizca tip tamligi icin.
const mk = (o: Partial<RawRing>): RawRing =>
  ({ speed: 0, start: 0, gap: 0, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, ...o });
/**
 * Altı patron tasarımı sırayla tekrar eder: 10, 20, ... bölümlerinde sırasıyla
 * Ayna, Merkez, Metronom, Çatal, Tavşan ile kaplumbağa, Büyük kasa, sonra baştan.
 * Tekrar eden tasarım her turda daha zor ayarlanır, çünkü hedef eğri aşağıdadır.
 */
const BOSS_SIRASI = [10, 20, 30, 40, 50, 60];
const bossTasarimi = (n: number): Boss | undefined => {
  if (!bossMu(n)) return undefined;
  // SON BÖLÜM her zaman kapanış patronudur. Döngü 6'lı, patron aralığı 10 ve
  // 1000. bölüm 100. patrona denk geliyor: 100 mod 6 = "çatal". Yani 1000 bölümlük
  // oyunun kapanışı altı tasarımdan rastgele birine düşüyordu — finali yoktu.
  // Yapı "Büyük kasa"nın aynısı, yalnızca anahtarı (ve dolayısıyla metni) farklı.
  if (n === LEVEL_COUNT) {
    const b = BOSSES[60];
    return b && { ...b, anahtar: "sonKasa" };
  }
  const tur = Math.floor(n / BOSS_ARALIGI) - 1;          // 0, 1, 2, ...
  return BOSSES[BOSS_SIRASI[tur % BOSS_SIRASI.length]];
};

const BOSSES: Record<number, Boss | undefined> = {
  /**
   * Hizalanma KADEMELİ hale getirildi (eskiden `start = A − s·2,5`, yani dördü de
   * t = 2,5 sn'de aynı anda A açısında buluşuyordu).
   *
   * Ölçüm: bu tasarımın 17 örneğinin HEPSİ hedefin üstünde, ortalama +6,5 puan,
   * en büyüğü +11,6. Örnek başına standart hata ~1,1 puan olduğu için bu gürültü
   * değil sistematik.
   *
   * Sebep model uyuşmazlığı: dört halka aynı anda hizalanınca oyuncu dört ayrı an
   * değil TEK bir an yakalıyor — dört dokunuşu birkaç kare içine sığdırabiliyor.
   * Oysa τ bunu dört bağımsız daraltan kilit sayıyor, yani ayarlayıcı sandığından
   * kolay bir bölüm üretiyor. Tolerans kolunu kısmak da yetmiyor: zorluk boşluk
   * genişliğinden değil, o tek anın varlığından geliyor.
   *
   * Kademe 0,6 sn: ölçülen kilit temposundan (1,27 sn) kasıtlı olarak farklı, yani
   * hizalanmalar oyuncunun doğal dokunuş ritmine de denk gelmiyor. Aynalı hız
   * çiftleri — tasarımın kimliği — olduğu gibi duruyor.
   *
   * Hızlar birbirinden farklı olmalı: eşit hız + eşit start = birebir aynı halka,
   * o kilit açıklığı hiç daraltmaz.
   */
  10: { anahtar: 'ayna',
    rings: () => [1.3, -1.3, 1.9, -1.9].map((s, i) => mk({ speed: s, start: A - s * (2.5 + i * 0.6) })) },
  /**
   * Hızlar 1,5 KATINA çıkarıldı (eski küme: 2,0 / -1,4 / 1,4 / -2,0).
   *
   * Sebep ölçüldü: bu tasarım dalga çukuruna denk geldiğinde hedefi tutturamıyordu —
   * 260. ve 500. bölümde hedef %22, ulaşılan %49. Zorluk kolu KİLİTLİYDİ. Tasarımda
   * baştan kilitli bir halka var, dolayısıyla `gerekenPay(4) = 15°` kuralı başlangıç
   * açıklığına taban koyuyor ve boşluk `NEED_PASS + 15° = 33°`in altına inemiyor.
   * Tabloda ölçülen boşluk tam 33,0°: kısıt birebir bağlıyordu.
   *
   * Boşluk kolu kilitliyse zorluk hızdan gelmeli. τ = (boşluk − NEED_PASS) / Σ'|ω|
   * olduğu için hızı 1,5 katına çıkarmak aynı boşlukta τ'yu 48,5 ms'den 32,3 ms'ye
   * indirir — insan sınırının (25 ms) hâlâ üstünde, ama ayarlayıcıya hareket alanı
   * açar. Kolay merkez bölümleri boşluğu genişleterek aynı kalır.
   *
   * Bu, `buyukKasa`da yapılan düzeltmenin aynısı: süre ya da boşluk kolu ölünce
   * hedefi indirmek değil, çalışan kolu kullanmak.
   */
  20: { anahtar: 'merkez',
    rings: () => [3.0, -2.1, 0, 2.1, -3.0].map((s, i) => mk(i === 2 ? { speed: 1, preLocked: true, start: A } : { speed: s, start: R() * TAU })) },
  30: { anahtar: 'metronom',
    rings: () => [1.5, -1.6, 1.4, -1.5, 1.6].map(s => mk({ speed: s, flip: 1.2, start: A - s * 0.6 + (R() - 0.5) * 0.4 })) },
  40: { anahtar: 'catal',
    rings: () => [1.2, -1.5, 1.3, -1.1, 1.6].map(s => mk({ speed: s, gaps: 2, gapOffset: 150 + R() * 30, start: R() * TAU })) },
  /**
   * Bütün hızlar 1,7 KATINA çıkarıldı (eski küme: 0,5 / -2,4 / 0,6 / -2,5 / 0,5 / -2,3).
   * Oran korundu, yani "tavşan ve kaplumbağa" karşıtlığı — tasarımın kimliği — aynı.
   *
   * Sebep ölçüldü: bu tasarım 16 örneğinin ortalamasında hedeften **+8 puan** sapıyordu
   * (470. ve 710. bölümde +37 ve +43). Sınırlayan şey tolerans DEĞİLDİ — o bölümlerde
   * boşluk 50,0°, yani tolerans 67 ms ve insan sınırının (25 ms) çok üstünde; ayarlayıcı
   * daraltabilirdi ama daraltamıyordu.
   *
   * Bağlayan kısıt ÇÖZÜCÜNÜN 16 SANİYE SINIRIYDI. 0,5 rad/sn'lik bir halkanın fırsat
   * periyodu 12,6 sn; üç tanesi birden varken dar boşlukta çözücü 16 sn'yi aşıyor ve
   * aday eleniyordu. Hızı 1,7 katına çıkarmak periyotları 7,4 sn'ye indirir, çözücü
   * rahatlar ve ayarlayıcı boşluğu gerçekten daraltabilir.
   *
   * Bu, `merkez` ve `ayna`da olduğu gibi üçüncü bir "kilitli zorluk kolu" vakası —
   * ve bu kez onu bulan şey tahmin değil, yeni eklenen tasarım başına sapma denetimi.
   */
  50: { anahtar: 'tavsanKaplumbaga',
    rings: () => [0.85, -4.08, 1.02, -4.25, 0.85, -3.91].map(s => mk({ speed: s, start: R() * TAU })) },
  /**
   * Hızlar 1,6 KATINA çıkarıldı (eski küme: 1 / -1,9 / 1,6 / -1,4 / 2,1 / -1,7).
   *
   * Ölçüm: bu tasarımın 16 örneğinden dördünde ve kapanış bölümünde denemelerin
   * yarıdan fazlası "süre doldu" ile bitiyordu — 1000. bölümde %77. Yani 1000
   * bölümlük oyunun son anısı hassasiyet değil sabır sınavıydı.
   *
   * Ve süre kolu ÖLÜYDÜ: 200 denemeyle ölçüldü, limiti 22,6 sn'den 33,9 sn'ye
   * çıkarmak kazanma oranını bir puan bile değiştirmedi (%22 → %22, süre kaybı
   * %77 → %77). Fırsat geç gelmiyor, HİÇ gelmiyor: ters yönlü + iki flip'li altı
   * halkanın ortak açıklığının geçiş eşiğini aşma sıklığı neredeyse sıfır.
   * Boşluğu daraltmak durumu kötüleştiriyor (%94 saat), çünkü darlık fırsat
   * sıklığını da düşürüyor.
   *
   * Doğru kol HIZ: fırsatı sıklaştırıyor. Ölçülen: hızlar ×1,6 ile süre kaybı
   * %77 → %1, kazanma %22 → %84, çözücü 14,1 sn → 6,4 sn. Kaybedilen zorluğu
   * ayarlayıcı boşluğu daraltarak geri alır — o zaman zorluk hassasiyetten gelir,
   * saatten değil. 240 (%56→%4) ve 420 (%64→%0) için de aynı.
   */
  60: { anahtar: 'buyukKasa',
    rings: () => [mk({ speed: 1.6, preLocked: true, start: A }), mk({ speed: -3.04, flip: 2.1, start: R() * TAU }), mk({ speed: 2.56, gaps: 2, gapOffset: 165, start: R() * TAU }),
      mk({ speed: -2.24, wobble: true, start: R() * TAU }), mk({ speed: 3.36, flip: 1.7, start: R() * TAU }), mk({ speed: -2.72, start: R() * TAU })] }
};

function finalize(rings: RawRing[], n: number): Finalized | null {
  const def = rings.map(r => ({ speed: rnd4(r.speed), gap: rnd4(r.gap), gaps: r.gaps, gapOffset: rnd4(r.gapOffset), flip: rnd4(r.flip), wobble: r.wobble, preLocked: r.preLocked, start: rnd4(wrap(r.start)) }));
  // Baştan kilitli halkalar kanalı fazla daralttıysa aday elenir (bkz. EN_AZ_PAY).
  const canli = liveRings(def);
  const baslangic = initialOpen(canli);
  if (baslangic !== OPEN_ALL) {
    const kalan = canli.filter(r => !r.locked).length;
    const pay = largestOpen(baslangic).w - NEED_PASS;
    if (pay < gerekenPay(kalan)) return null;
  }
  // İnsan sınırının altındaki bölümler elenir: orada başarı beceriye değil şansa bağlıdır.
  if (tauHesapla(def) < TAU_TABAN) return null;
  const cozum = solve(def); if (!cozum) return null;
  // Flip görünürlüğünün GERÇEK denetimi. `gorunurFlip` doğrusal bir tahminle
  // (`tahminiKilitAni`) çalışır; burada çözücünün ölçülmüş kilit anlarına bakılır.
  //
  // Kural neden "flip >= an" ve neden ELEME değil DÜZELTME:
  //   • Tahmin MEDYANA kalibre edilmiştir, yani adayların yaklaşık yarısı doğası
  //     gereği tahminin altında kilitlenir. `flip > an * 0.7` gibi bir kapı bu yüzden
  //     kusuru değil DAĞILIMI ölçerdi; ölçtüm, 30. bölümde 486 adayın 225'ini eliyordu.
  //   • Ölçülebilir kusur ikili ve kalibrasyonsuzdur: halka kilitlenene kadar hiç
  //     dönmüyorsa (`flip >= an`) o flip oyuncunun asla görmediği bir parametredir —
  //     zorluk defterine girer, ekranda karşılığı yoktur.
  //   • Böyle bir flip'i sıfırlamak yörüngeyi DEĞİŞTİRMEZ: zaten kilide kadar hiç
  //     tetiklenmiyordu. Yani adayı atmak yerine defteri düzeltiyoruz; τ, γ ve fırsat
  //     periyodu artık ekranda olan şeyi ölçer.
  {
    let sira = 0;
    for (const r of def) {
      if (r.preLocked) continue;
      const an = cozum.kilitler[sira]?.t ?? Infinity;
      sira++;
      if (r.flip > 0 && r.flip >= an) r.flip = 0;
    }
  }
  const best = cozum.t;
  const moving = def.filter(r => !r.preLocked).length;
  const want = tasarimLimiti(n, moving);
  // Tasarım limiti kural; çözücü sığmıyorsa aday zaten elenir (bkz. tune), ama son çare olarak
  // limit yine de çözücünün üstünde kalır ki level bitirilebilir olsun.
  const guvenli = best * 1.5 + 1.5;
  // Bekleme bütçesi tavanı (bkz. GAMA_TAVAN). Çözülebilirlik tavanı aşıyorsa bu yapıya
  // adil bir süre verilemez demektir: aday elenir, limit zorlanmaz.
  const tavan = gamaTavani(def);
  if (guvenli > tavan) return null;
  const limit = +Math.min(Math.max(want, guvenli), tavan).toFixed(1);
  return { def, best, limit, want, roomy: best <= want * 0.65 };
}
/**
 * Ustalık referansı: açıklığın EN GENİŞ anını bekleyip vuran, zamanlaması keskin oyuncu.
 *
 * Yıldız eşikleri bundan hesaplanır, zorluk eğrisi ise play() ile. Sebep: eşikler
 * "iyi oynamak" ölçüsüdür, ortalama oyuncu ölçüsü değil. Eski tabloda eşikler play()'in
 * yüzdeliklerinden geliyordu ve play() nişan almıyordu; sonuçta nişan almayı öğrenen bir
 * oyuncu 60 levelin ~52'sinde 3 yıldız alıyor, 11-20 arasında %100'e çıkıyordu.
 */
const USTA_SAPMA = 0.035;   // keskin ama insan: ~35 ms zamanlama sapmasi

function playUsta(def: RingDef[], limit: number): PlayResult {
  const rs = liveRings(def), dt = ADIM;
  let open: Open = initialOpen(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]; if (r.locked) continue;
    let done = false, oncekiGenis = -1;
    while (t < limit) {
      let want = false;
      if (t >= last + REACT) {
        const p = peekOpen(open, r);
        if (open === OPEN_ALL) want = true;
        // Tepe noktası: açıklık daralmaya başladıysa en geniş an geçildi demektir.
        else if (canPass(p.w) && oncekiGenis >= 0 && p.w < oncekiGenis) want = true;
        oncekiGenis = p.w;
      }
      if (want) {
        // Usta da insan: tepe noktasini bulur ama tam ustune basamaz.
        const e = gauss() * USTA_SAPMA;
        const sdt = e >= 0 ? dt : -dt;
        for (let k = Math.abs(e); k > 0; k -= dt) { const lt = sdt > 0 ? t + sdt : t; stepRings(rs, sdt, lt); t += sdt; }
        open = lockOpen(open, r);
        if (!canPass(largestOpen(open).w)) return { win: false, t, sebep: "kanal" };
        r.locked = true; last = t; done = true; break;
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return { win: false, t, sebep: "sure" };
  }
  const minGap = Math.min(...def.map(r => r.gap)) * DEG;
  return { win: true, t, q: starRatio(largestOpen(open).w, minGap) };
}

/**
 * Ayarlayıcının kullandığı tohum. Üretim boyunca sabittir: aynı kod aynı tabloyu verir.
 */
const URETIM_TOHUMU = 777;
/**
 * Denetimin kullandığı tohum. ÜRETİMDEN FARKLI olması zorunludur.
 *
 * Neden: `tune` her bölümde toleransı 8 kez ikiye bölüp aynı 50 gürültü çekilişine karşı
 * en iyi sonucu seçiyor. Denetim de aynı çekilişleri oynatırsa, ayarlayıcının o örnekleme
 * uydurduğu sapmayı ölçemez — kendi sınavını kendi cevap anahtarıyla okumuş olur.
 * Ölçtüm: K=36 adayda aynı tohumla görülen sapma, gerçeğin ~1/28'i kadar çıkıyor.
 * Bu tohum, üretimin hiçbir yerinde kullanılmayan bağımsız bir çekiliş üretir.
 */
const DENETIM_TOHUMU = 20260923;
/**
 * Denetimde deneme sayısı.
 *
 * 200 denemede standart hata `√(0,4·0,6/200) = 3,5 puan`. Nokta tahminini ±20 puanlık
 * bandın sert eşiğiyle karşılaştırmak, gerçek sapması 17 puan olan bir bölümün
 * koşuların beşte birinde "ihlal" görünmesi demekti — ve `verify` yayın kapısı olduğu
 * için kapı, tablonun değil ölçümün gürültüsüyle kırmızıya dönüyordu.
 *
 * Bir ara bunu kabul bölgesini genişleterek çözmüştüm (bandı 2·SE kadar gevşetmek).
 * Yanlış çözümdü: gürültünün çaresi eşiği gevşetmek değil GÜRÜLTÜYÜ KÜÇÜLTMEKTİR.
 * 1000 denemede standart hata **1,55 puana** iner, 3σ = 4,6 puan olur ve ±20 bandı
 * tasarlandığı sertlikte, hiç gevşetilmeden uygulanabilir. Bedeli birkaç dakika.
 */
const DENETIM_DENEME = 1000;

/**
 * Ustalık referansının tohumları. Yıldız eşikleri (q3/q2) ÜRETİMDE bu örneklemin
 * yüzdeliklerinden hesaplanır; denetim "ustanın 3 yıldız oranı %15-35 arasında mı"
 * diye sorar. İki taraf aynı tohumu kullanırsa denetim kendi cevap anahtarını okur:
 * cevap inşa gereği ~%25 çıkar ve kapı pratikte hiç ateşlenmez. Bu yüzden denetim
 * BAŞKA bir tohum kullanır — eşiklerin bağımsız bir örneklemde de bandı tutup
 * tutmadığı gerçekten sınansın.
 */
const USTA_TOHUMU = 4242;
const USTA_DENETIM_TOHUMU = 909090;

/**
 * Finalist ölçümünün tohumu. Hem üretimden hem denetimden FARKLI olmak zorunda.
 * (Üretim: tarama. Bu: karar. Denetim: sınav. Üçü de ayrı çekiliş.)
 */
const SECIM_TOHUMU = 424242;
/**
 * Kaç aday bağımsız tohumla yeniden ölçülüp karara sokulur.
 *
 * Dört, çünkü kazananın laneti finalist sayısının maksimumundan doğar: 4 adayda
 * beklenen yanlılık `≈ 1,2 · SE`, 200 denemede `1,2 · 3,5 ≈ 4 puan` (bkz. MATEMATIK
 * §8.2). Daha fazla finalist yanlılığı büyütür, daha azı iyi adayı kaçırır.
 */
const FINALIST = 4;
/**
 * Finalist ölçümünde deneme sayısı — denetimle AYNI, bilerek.
 *
 * Karar ölçümü ile denetim ölçümü farklı tohumlardan gelir; aralarındaki fark
 * `√2·SE` kadar dalgalanır. Karar 200 denemeyle (SE 3,5 puan) verilirken denetim
 * 1000 denemeyle (SE 1,5) yapılınca bu fark 3,8 puana çıkıyordu ve bant sınırına
 * yapışık çıkan bölümler denetimde dışarı düşüyordu. Ölçtüm: 332. bölüm kararda
 * %45 (hedef %28, 17 puan — erken çıkış payının içinde), denetimde %50 (+22 puan).
 */
const FINALIST_DENEME = 1000;
/** Karar ölçümünün standart hatası; erken çıkış payı bundan türetilir. */
const SECIM_SE = Math.sqrt(0.24 / FINALIST_DENEME);

/**
 * Bölüm başına ayrı bir rastgele akış tohumu.
 *
 * Eskiden `evaluate` her bölümde `es = tohum` diyordu, yani **1000 bölümün hepsi aynı
 * 200 hata dizisiyle** oynanıyordu. Tek bir bölümün tahminini yanlı yapmaz ama 1000
 * bölümü birbirine BAĞLAR: bir koşunun ortalaması, bağımsızlığın öngördüğü 0,11 puan
 * yerine 1,89 puan standart sapmayla dalgalanıyordu (≈17 kat). Sonuç: bütün toplam
 * istatistikler tohuma esirdi — "hedefin 7 puan altındaki bölüm oranı" 12 koşuda
 * %1,4 ile %22,7 arasında zıplıyor, bağımsız akışla ise %8,6–%10,3 arasında kararlı
 * duruyordu. Yani belgedeki "zor bölüm %1" satırı tablonun değil tohumun eseriydi.
 *
 * Daha kötüsü üretim tarafındaydı: bütün tablo TEK bir gürültü gerçeklemesine göre
 * ayarlanıyordu. Bu sefer zararsız çıktı, ama o akışın ilk 200 dizisi biraz "sert"
 * olsaydı 1000 bölümün tamamı aynı yönde kayardı ve hiçbir denetim bunu ayırt edemezdi.
 */
const bolumTohumu = (tohum: number, bolum: number): number =>
  1 + ((karistir(bolum) ^ karistir(tohum)) >>> 0) % 2147483646;

function evaluate(L: { def: RingDef[]; limit: number }, bolum: number,
                  trials = 50, tohum = URETIM_TOHUMU): Evaluated {
  es = bolumTohumu(tohum, bolum); let w = 0, sure = 0; const qs: number[] = [];
  for (let k = 0; k < trials; k++) {
    const r = play(L.def, L.limit);
    if (r.win) { w++; qs.push(r.q); } else if (r.sebep === "sure") sure++;
  }
  // Ölçü TÜM denemelerin içindeki paydır, kayıpların içindeki değil. Doğru olan
  // budur: %92 kazanılan bir bölümde kayıpların %75'i süre dolması olsa bile
  // oyuncunun yalnızca %6'sı saate yenilir, bu bir sorun değildir.
  return { win: w / trials, qs, sureKaybi: sure / trials };
}

/**
 * Zorluk eğrisi. Üç parça:
 *
 *   taban  — %94'ten %35'e iner ve 200. bölümde tabana oturur. Üs 0,45 olduğu için
 *            iniş BAŞTA diktir: oyuncu 11. bölümde %80'in, 39'da %60'ın altına düşer.
 *            Eski 60 bölümlük eğri %80'e ancak 21. bölümde iniyordu ve "zorluk çok
 *            yavaş artıyor" şikâyetinin sebebi buydu.
 *   dalga  — ±8 puanlık, 24 bölümlük salınım. 200'den sonra eğri düz kalsaydı geri
 *            kalan 800 bölüm tek bir duvar olurdu; dalga oraya ritim veriyor.
 *   nefes  — hash'le seçilen {3,4} aralıklarıyla +12 puan, dalgayı ezerek (bkz. nefesMi).
 */
const TABAN_BOLUM = 200;
const DALGA_GENLIK = 0.08;
const DALGA_PERIYOT = 24;
/**
 * Zorluk tabanı. Daha aşağısı (%15 denendi) ayarlamayı kararsızlaştırıyor: o hedefte
 * boşluğun bir derece değişmesi kazanma oranını onlarca puan oynatıyor ve üretici
 * bölümlerin bir kısmını hiç çözülemez bırakıyor. %35 taban + dalga, %27-43 bandı verir.
 */
const EN_ZOR = 0.35;
const TABAN_KLAMP = 0.25;

const egriTaban = (n: number): number =>
  0.94 - (0.94 - EN_ZOR) * Math.pow(Math.min(1, (n - 1) / (TABAN_BOLUM - 1)), 0.45);
const egriDalga = (n: number): number => DALGA_GENLIK * Math.sin(2 * Math.PI * n / DALGA_PERIYOT);
/**
 * Zorluk kalıntısı taramasının gecikme aralığı.
 *
 * Alt sınır 15: daha kısa gecikmeler zorluk eğrisinin kendi yerel dalgalanmasını
 * ölçer, tekrarı değil. Üst sınır `LAG_UST` (N/3'e yakın): daha uzun gecikmelerde
 * karşılaştırılacak terim sayısı düşer ve tahmin gürültüye boğulur.
 *
 * Bu denetimin tarihçesi (tek gecikmeye bakan ilk hâli, elle konmuş 0,60 tavanı,
 * hareketli ortalamayla arındırma) MATEMATIK §8.4'te.
 */
const RITIM_TARAMA_ALT = 15;


/**
 * YAPI serisi taraması. Kazanma oranı dolaylı ve gürültülü bir ölçüdür; oyuncunun
 * "bunu daha önce gördüm" dediği şey kazanma oranı değil YAPIdır: kaç halka,
 * hangi mekanik. Bu yüzden tekrar önce yapı serisinde aranır.
 *
 * Tarama 2'den başlar. Eski hatanın tam yeri burasıydı: halka sayısı 8 periyotluydu
 * ve denetim 15'ten başladığı için onu hiç göremiyordu.
 */
const YAPI_LAG_ALT = 2;
/** Tarama üst sınırı: N/3'e yakın. Ötesinde kalan terim sayısı tahmini gürültüye boğar. */
const LAG_UST = 336;
/**
 * Permütasyon boş hipotezinde kaç tur.
 *
 * Tavan, turların `1 − 0,01/3` dilimidir. Üç seri birden sınandığı için düz %99
 * kullanmak aile bazında yanlış alarmı ~%3'e çıkarırdı: yapıyı bozulmamış bir tablo
 * 33 çalıştırmanın birinde ritimden kalırdı. Bonferroni düzeltmesi aile bazında
 * yanlış alarmı %1'de tutar. (Bu düzeltme tek başına hiçbir bayrağı kaldırmaz;
 * yalnızca "kıl payı geçti/kaldı" bölgesini gürültüden arındırır.)
 */
const PERM_TUR = 600;
const PERM_DILIM = 1 - 0.01 / 3;
/** Yapı serisinin durağan sayıldığı ilk bölüm (öncesinde halka sayısı büyüyor). */
const YAPI_BASLANGIC = 21;

/**
 * "Zor seri" artık MUTLAK eşikle ölçülmüyor.
 *
 * Eskiden eşikler sabitti ([%35, %40, %45]). Hedef eğrisi 200. bölümde zaten %35'e
 * indiği için 800 bölümün neredeyse tamamı "%45 altı" sayılıyordu: denetim ritmi
 * değil, eğrinin KENDİSİNİ ölçüyordu. Ölçü artık YEREL hedefe göre — bir bölüm
 * ancak kendi hedefinin bu kadar altındaysa "olması gerekenden zor" sayılır.
 *
 * Pay, 200 denemelik ölçümün standart hatasının (~0,035) iki katıdır: gürültünün
 * tek başına ürettiği sapmalar seriye girmesin.
 */
const ZOR_PAY = 0.07;

// Saf istatistik `tools/gen/istatistik.ts`'te yaşıyor ve orada birim testleri var
// (`istatistik.test.ts`). Yayın kapısı olan bir hesabın test edilebilir olması şart:
// bu kapı daha önce iki kez fark edilmeden anlamsız çalıştı.
//
// Buradaki sarmalayıcılar yalnız bu dosyanın ayarlarını (tarama aralığı, tur sayısı,
// dilim) bağlar.
const eslesmeTepesi = (d: readonly number[]): Tepe => IST.eslesmeTepesi(d, YAPI_LAG_ALT, LAG_UST);
const ozilintiTepesi = (d: readonly number[]): Tepe =>
  IST.tepeNoktasi(IST.ozilintiler(d, RITIM_TARAMA_ALT, LAG_UST), RITIM_TARAMA_ALT);
const permutasyonTavani = <T,>(seri: readonly T[], olc: (d: T[]) => number, tohum: number): number =>
  IST.permutasyonTavani(seri, olc, tohum, PERM_TUR, PERM_DILIM);
const { enUzunSeri, yerelRng, ozilintiler } = IST;

/** Bir bölümde denemelerin en çok bu kadarı saate yenilebilir (bkz. doğrulama). */
const SURE_KAYBI_SIDDET = 0.30;

/**
 * Nefes levelleri: hedef eğrinin belirgin üstünde tutulan, patron olmayan bölümler.
 * Test oyuncuları 44-57 arasında 12 levelin 9'unu "duvar" olarak işaretledi ve art arda
 * 20-29 kayıp serileri yaşadı; sıradan oyuncuyu kaçıran şey tek bir zor level değil,
 * zor levellerin arka arkaya gelmesi.
 *
 * Konumlar MODÜLER BİR DESENDEN GELMİYOR; `n`'in karıştırıcısıyla seçilen 3 ya da 4
 * aralıklarla yürüyerek üretiliyor. Sebebi ölçülmüş bir başarısızlık:
 *
 *   sabit 4      -> dalga(24) × nefes(4) × patron(10) × arketip(8), EKOK tam 120;
 *                   1000 bölüm pratikte aynı 120 bölümün sekiz tekrarıydı.
 *   mod 7 (3-4)  -> 120'deki tekrar gerçekten kırıldı (0,84 -> 0,26) ama tepe
 *                   YOK OLMADI, 70'e taşındı (0,75) — yani daha SIK tekrar.
 *                   Sebep: EKOK(nefes 7, patron 10) = 70.
 *   hash{3,4}    -> hiçbir EKOK doğmuyor; ölçülen tepe 0,94 -> 0,50.
 *
 * Patronla çakışan nefes İPTAL EDİLMEZ, `n+1`'e kaydırılır. İptal etmek, nefesi
 * patronun fonksiyonu yapıyordu: mod-10 deseni nefes desenine geri giriyor ve
 * periyodu diriltiyordu. Üstelik kural kendi amacına ters çalışıyordu — rahatlamayı
 * tam da en zor bölümün bulunduğu yerde iptal ediyordu. Kaydırma hem periyodu
 * temiz bırakıyor hem "zirve → boşalma" ritmini veriyor: ölçülen en uzun zor seri
 * %35/%40/%45 eşiklerinin üçünde de 6 -> 4.
 */
const NEFES_BONUS = 0.12;
/**
 * Nefes konumları. Aralık {3, 4}, seçim `n`'in karıştırıcısıyla — deterministik ama
 * periyodik değil. Tablo üretimi sabit tohumla çalıştığı için bu küme her çalıştırmada
 * aynıdır (bkz. `npm run verify -- --deterministic`).
 */
const nefesKumesi = ((): Set<number> => {
  const küme = new Set<number>();
  let n = 1, i = 0;
  while (n <= LEVEL_COUNT) { küme.add(n); n += (karistir(i++) % 2) ? 3 : 4; }
  return küme;
})();

const nefesMi = (n: number): boolean => {
  if (bossMu(n)) return false;                 // patron bölümü nefes olamaz
  if (nefesKumesi.has(n)) return true;
  // Patrona denk gelen nefes iptal edilmez, buraya kayar.
  return bossMu(n - 1) && nefesKumesi.has(n - 1);
};
/**
 * Nefes bölümlerinde dalga UYGULANMAZ; nefes onun yerine geçer.
 *
 * Bu, ritim düzeltmesinin ikinci yarısı ve olmazsa olmazı. Ölçüm şunu gösterdi:
 * eski düzende dalga periyodu (24) nefes aralığının (4) tam katı olduğu için nefesler
 * HER ZAMAN dalganın aynı evrelerine düşüyordu — 120 bölümlük tekrarın sebebi de,
 * nefeslerin hep uygun evrede kalmasının sebebi de aynı hizalanmaydı. Aralığı 7'ye
 * çıkarıp burayı dokunmadan bırakmak tekrarı kırıyor ama nefeslerin bir kısmını
 * dalganın çukuruna düşürüyordu: %40 altında kalan en uzun seri 7'den 10'a çıkıyordu.
 * Yani ritmi kazanıp güvenceyi kaybediyorduk.
 *
 * Dalgayı nefeste ezmek ikisini birden veriyor. Ölçülen: 120 gecikmeli özilinti
 * 0,47 -> 0,20; en uzun zor seri %35'te 7 -> 6, %40'ta 7 -> 6, %45'te 15 -> 6.
 * Ortalama zorluk neredeyse değişmiyor (0,402 -> 0,408).
 *
 * Kuralın kendisi de okunur: dalganın işi 24 bölümlük ritim, nefesin işi rahatlama.
 * Çakıştıklarında rahatlama kazanır.
 */
const egri = (n: number): number =>
  nefesMi(n) ? egriTaban(n) : egriTaban(n) + egriDalga(n);

/**
 * Patron bölümlerinin hedefi.
 *
 * Patronlar elle tasarlandığı için halka sayıları ve hızları sabittir; ayarlayıcının
 * elinde yalnızca boşluk genişliği vardır. Eğrinin en dibinde (%27-35) bu yapılar
 * hedefi tutturamıyor, en fazla ~%40'a inebiliyorlardı. Bu yüzden patron cezası sabit
 * puan değil ORAN: hedefin %75'i. Eğri yüksekken belirgin bir sıçrama, dibe yakınken
 * yapının fiziksel sınırına uygun.
 */
const BOSS_ORAN = 0.75;
const bossHedefi = (n: number, boss: boolean): number =>
  boss ? Math.max(0.22, target(n) * BOSS_ORAN) : target(n);

const target = (n: number): number =>
  Math.max(TABAN_KLAMP, Math.min(0.95, egri(n) + (nefesMi(n) ? NEFES_BONUS : 0)));
// Yapıyı sabit tutup tolerans süresini ayarlayarak kazanma oranını hedefe oturt
/**
 * Kayıpların en çok bu kadarı "süre doldu" olabilir.
 *
 * Neden gerekli: limit, referans çözücünün süresinden türetiliyordu (best × 1,5 + 1,5).
 * Çözücü açgözlüdür, ilk uygun hizalanmayı alır; insan daha iyisini bekler. Hizalanma
 * fırsatının seyrek olduğu bölümlerde 1,5 kat pay yetmiyordu ve oyuncu bütün kilitleri
 * doğru yapıp SON kilitte saate yeniliyordu. Ölçüm: 1000 bölümün 123'ünde kayıpların
 * yarısından fazlası süre dolmasıydı; bazılarında %100. O bölümlerde oyun hassasiyet
 * oyunu olmaktan çıkıp bekleme oyunu oluyordu — türdeki en kötü kayıp hissi.
 *
 * Artık zorluk yalnızca DARALMADAN gelir: süre, beceriyi ölçen değil taahhüde zorlayan
 * bir sınır olarak kalır.
 */
const SURE_KAYBI_ESIGI = 0.10;
/** Limit tasarım değerinin bu katından fazla açılmaz: süre baskısı büsbütün kaybolmasın. */
const SURE_TAVANI = 2.2;

/**
 * Bir halkanın "fırsat periyodu": kanalın istenen yönüne bir boşluğun gelmesi için
 * EN KÖTÜ durumda geçen süre. γ bir TAVAN hesabı olduğu için ortalama değil en kötü
 * durum kullanılır.
 *
 * İKİ KAPILI halkada boşluklar eşit aralıklı DEĞİL. `gapOffset` medyanı 157°, yani
 * fırsatlar `off/|ω|` ve `(2π−off)/|ω|` aralıklarıyla dönüşümlü gelir. `2π/(2|ω|)`
 * bunların ortalamasıdır ve en uzun beklemeyi %11 (medyan) – %22 (en kötü) eksik sayar.
 * Bu yüzden EN UZUN yay kullanılır.
 *
 * FLIP'li halkada periyot `min(2·flip, temel)`. Gerekçe: flip'li halkanın açısı
 * `2·flip` periyotlu KAPALI bir yörünge çizer, yani halka ulaştığı her açıya çevrim
 * başına en az bir kez döner — en kötü bekleme bir çevrimdir. Halka çemberi çevrimden
 * daha hızlı tarıyorsa (`temel < 2·flip`) beklemek daha da kısadır.
 *
 * ÖNCEKİ SÜRÜM BURADA TERS ÇALIŞIYORDU. Çemberi hiç taramayan flip halkaları için
 * `Infinity` döndürüp "aday elenir" diyordu. Elemiyordu: `gamaTavani` toplamı da
 * `Infinity` oluyor, `guvenli > tavan` hiç tetiklenmiyor ve `gamaHesapla` `x/∞ = 0`
 * veriyordu. Yani γ kapısı 1000 bölümün **334'ünde sessizce kapanmıştı** ve o bölümler
 * "γ = 0" diye raporlanıyordu. Kapıyı sıkılaştırmak isteyen değişiklik onu gevşetmişti.
 *
 * Hata semantikteydi: "ulaşılmayan yönler için periyot sonsuzdur" doğru ama ilgisiz —
 * kanalın yönünü öteki kilitler belirliyor ve çözücü zaten uygulanabilir bir yön
 * bulmuş oluyor. Doğru soru "ULAŞILAN yönler için en kötü bekleme ne kadar", cevabı da
 * bir flip çevrimi. Artık hiçbir dalda `Infinity` dönmüyor.
 */
function firsatPeriyodu(r: RingDef): number {
  const w = Math.abs(r.speed);
  // İki kapılı halkada kapılar eşit aralıklı değil: en uzun yay esas alınır.
  const enUzunYay = r.gaps === 2
    ? Math.max(r.gapOffset * DEG, TAU - r.gapOffset * DEG)
    : TAU;
  const temel = enUzunYay / w;
  return r.flip > 0 ? Math.min(2 * r.flip, temel) : temel;
}

/**
 * γ = (limit − m × REACT) / Σ fırsat periyodu — "halka başına kaç TUR izlemeye vakit var".
 *
 * Süre sınırının gerçek anlamı budur ve bir TAVANI olmalıdır: oyuncu halkaların ikinci
 * turunu bekleyebiliyorsa zamanlama kararı kararsızlaşır, oyun "doğru anı yakala"dan
 * "otur bekle"ye döner. Ölçüm: γ ortalaması 0,92 ama 39 bölüm 1,4'ün üstündeydi, en
 * gevşeği 2,45. Simülasyonda halkayı bir tam tur izlemek zorunda olan oyuncu %2,2
 * kazanıyor, yarım tur izleyen %58,8 — yani bütçe "yarım tur izle, sonra karar ver".
 *
 * Taban (süre kaybı onarımı) ile tavan çakışırsa aday elenir; limit zorlanmaz.
 */
const GAMA_TAVAN = 1.3;

function gamaTavani(def: RingDef[]): number {
  const h = def.filter(r => !r.preLocked);
  const toplamP = h.reduce((s, r) => s + firsatPeriyodu(r), 0);
  return GAMA_TAVAN * toplamP + h.length * REACT;
}

const gamaHesapla = (def: RingDef[], limit: number): number => {
  const h = def.filter(r => !r.preLocked);
  const toplamP = h.reduce((s, r) => s + firsatPeriyodu(r), 0);
  return toplamP > 0 ? (limit - h.length * REACT) / toplamP : Infinity;
};

/**
 * İki aday arasında tercih. Hedefe yakınlık birincil; eşit yakınlıkta önce "saate
 * değil daralmaya yenilen" aday, sonra ferah olan tercih edilir.
 * "Temiz" = oyuncu kayda değer oranda saate yenilmiyor. Temiz bir aday, hedefe biraz
 * daha uzak olsa bile kirli olanı yener: zorluk daralmadan gelmeli, bekleyişten değil.
 */
function adayDahaIyi(c: Candidate, pick: Candidate, want: number): boolean {
  const dc = Math.abs(c.win - want), dp = Math.abs(pick.win - want);
  const cTemiz = c.sureKaybi <= SURE_KAYBI_ESIGI, pTemiz = pick.sureKaybi <= SURE_KAYBI_ESIGI;
  return (cTemiz && !pTemiz && dc < dp + 0.10)
    || (cTemiz === pTemiz && (dc < dp - 0.04
      || (dc < dp + 0.04 && c.roomy && !pick.roomy)
      || (dc < dp && !(pick.roomy && !c.roomy))));
}

function tune(rawRings: RawRing[], want: number, n: number, lo = 0.012, hi = 0.45): Candidate | null {
  let best: Candidate | null = null;
  for (let it = 0; it < 8; it++) {
    const tol = (lo + hi) / 2;
    const rings = rawRings.map(r => ({ ...r })); sizeGaps(rings, tol);
    const aday = finalize(rings, n);
    if (!aday) { lo = tol; continue; }
    let L: Finalized = aday;
    let ev = evaluate(L, n, 50);
    // Süre dolması baskın kayıp sebebiyse yapı değil limit yanlıştır: limiti aç.
    const tavan = gamaTavani(L.def);
    for (let tur = 0; tur < 5 && ev.sureKaybi > SURE_KAYBI_ESIGI; tur++) {
      const yeni = +(L.limit * 1.2).toFixed(1);
      if (yeni > L.want * SURE_TAVANI) break;
      // Bekleme bütçesi tavanı tabandan önce gelir: saate yenilmeyi azaltmak uğruna
      // oyuncuya ikinci turu bekleme lüksü verilmez. Aday öyleyse elenir.
      if (yeni > tavan) break;
      L = { ...L, limit: yeni };
      ev = evaluate(L, n, 50);
    }
    const c = { ...L, ...ev, tol };
    if (L.best <= 16 && (!best || Math.abs(c.win - want) < Math.abs(best.win - want))) best = c;
    if (ev.win > want) hi = tol; else lo = tol;
  }
  return best;
}
// ===== Üretim =====
// Sabit tohumla çalışır: aynı kod her çalıştırmada birebir aynı tabloyu verir.
function generate(log: Log = () => {}): LevelTable {
  seed = 12345; es = 1;
  const levels: Candidate[] = []; const allQ: number[] = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const boss = bossTasarimi(n);
    // Eğri artık dalgalı: katı monotonluk yerine eğrinin kendisi izleniyor.
    // (Eğilimin düştüğünü --verify hareketli ortalamayla denetler.)
    const want = bossHedefi(n, !!boss);
    let pick: Candidate | null = null;
    // Bandın dışında kalırsak aday denemeye devam: 1000 bölümde birkaç zor vaka
    // normal deneme sayısıyla tutturulamıyor ve eşiği gevşetmek yanlış çözüm olurdu.
    // Taban (saate yenilme) ile tavan (γ) çakıştığında doğru cevap ikisini de bükmek
    // değil, O YAPIYI elemektir: daha çok aday denenir. Patronların yapısı elle
    // tasarlandığı için orada çeşitlilik sınırlı, deneme sayısı da öyle.
    // ---- Aday araması ve kazananın laneti -----------------------------------
    //
    // Tarama, bölüm başına 36 adayı 8 tolerans adımıyla ve 50 denemeyle ölçüp hedefe
    // en yakın ÖLÇÜMÜ seçer. 50 denemede standart sapma ~7 puandır; 288 gürültülü
    // ölçümün en iyisini seçmek seçileni sistematik olarak yanlı yapar ("kazananın
    // laneti"): hedefin ALTINDA ölçülen adayın seçilme şansı yüksektir, dolayısıyla
    // seçilenin GERÇEK kazanma oranı hedefin üstüne çıkar. Beklenen yanlılık ~2σ ≈ 14
    // puan; ölçtüm, bağımsız tohumla 12 bölüm hedefinin 20-30 puan üstünde çıkıyordu
    // ve sapmaların HEPSİ aynı yöndeydi — gürültü değil yanlılık.
    //
    // Çare iki parçalı:
    //
    //   1. KARAR bağımsız ölçümle verilir. Finalistler (tercih kuralına göre en iyi
    //      dört aday) `SECIM_TOHUMU` ile ve dört kat denemeyle yeniden ölçülür.
    //      Yeniden ölçüm seçimden bağımsız olduğu için lanet ~4 puana iner.
    //
    //   2. ERKEN ÇIKIŞ da o ölçüme bakar. Eski kod `pick.win`'e — yani taramanın
    //      yanlı sayısına — bakarak `olagan` adaydan sonra çıkıyordu. Yanlı sayı
    //      "bant içindeyim" dediği için kalan 28 deneme hiç kullanılmıyordu; ölçtüm,
    //      7 bölüm bu yüzden hedefinin 22-30 puan üstünde kalmıştı. Artık her
    //      `olagan` adayda bir dürüst karar verilir ve çıkış ona göre olur.
    // `enCok` 36 → 60 (patron 24 → 36). Erken çıkış artık dürüst ölçüme baktığı için
    // bant içindeki bölümler zaten ilk turda çıkıyor; ek deneme YALNIZCA tutturamayan
    // bölümlerde harcanıyor. Ölçtüm: 36 denemeyle iki bölüm bantta kalamıyordu ve
    // tutturamayan bölüm kümesi koşudan koşuya değişiyordu — yani sabit bir tasarım
    // sınırı değil arama şanssızlığı.
    // `enCok`, `olagan`'ın TAM KATI olmalı: karar yalnız tur sonlarında veriliyor,
    // dolayısıyla artan adaylar hiçbir zaman karara giremezdi (60/8'de son 4 aday).
    // Bu tabloda hiç tetiklenmedi ama sessiz bir kırılganlıktı.
    const olagan = boss ? 6 : 8, enCok = boss ? 36 : 64;
    // Erken çıkış payı bandın kendisinden değil, bandın DENETİMDE de tutacağı
    // mesafeden gelir. Karar ve denetim ayrı tohumlar kullandığı için aralarında
    // `√2·SE` fark olabilir; 3σ pay bırakılır. Eski pay `BAND × 0,9` idi, yani bant
    // sınırına yalnız 2 puan kalıyordu — ölçüm farkının standart sapmasından küçük.
    const bant = (boss ? BAND_BOSS : BAND) - 3 * Math.SQRT2 * SECIM_SE;
    const adaylar: Candidate[] = [];

    /** Finalistleri bağımsız tohumla ölçüp aralarından en iyisini döndürür. */
    const finalistSec = (): Candidate => {
      const havuz = adaylar.slice();
      const sirali: Candidate[] = [];
      // Havuz, tarama kazananını seçen kuralın TA KENDİSİYLE kurulur. İlk sürümde
      // havuzu ham `|win − hedef|` ile sıralamıştım; `adayDahaIyi`'nin "temiz aday
      // (saate yenilmeyen) hedefe biraz daha uzak olsa bile kirliyi yener" kuralı
      // devre dışı kalıyordu ve temiz adaylar karara GİRMEDEN eleniyordu. Ölçtüm:
      // 23 bölümde denemelerin dörtte birinden fazlası saate yenilir hale geldi.
      while (sirali.length < FINALIST && havuz.length) {
        let en = 0;
        for (let i = 1; i < havuz.length; i++) if (adayDahaIyi(havuz[i], havuz[en], want)) en = i;
        sirali.push(havuz.splice(en, 1)[0]);
      }
      let enIyi: Candidate | null = null;
      for (const f of sirali) {
        // Aynı aday iki turda da finale kalabilir; ölçümü tekrarlamaya gerek yok.
        if (!f.olculdu) { Object.assign(f, evaluate(f, n, FINALIST_DENEME, SECIM_TOHUMU), { olculdu: true }); }
        if (!enIyi || adayDahaIyi(f, enIyi, want)) enIyi = f;
      }
      return enIyi as Candidate;
    };

    // Hız kolu yalnızca KOLAY yönde devreye girer (`pick.win > want`). Tur sonunda
    // çıkış olmadığı her durumda tetiklenir — yani bölüm bant dışındayken DE, bant
    // içinde ama "kirli" (süre kaybı > %10) olduğunda da. Ölçüldü: üretim boyunca 156
    // kez tetikleniyor ve bunların bir kısmı bant içi/kirli durumlar (ör. bölüm 110:
    // %35, hedef %34, ama süre kaybı %16). Bu doğru davranış — kirli bir bölümün de
    // düzelmesi gerekir — ama önceki yorum "bant içindeki bölümlere hiç dokunmaz"
    // diyordu ve bu yanlıştı.
    let hizCarpani = 1, ekHalka = 0;
    for (let k = 0; k < enCok; k++) {
      // Hız kolu patronlara da uygulanır. Patron halkaları elle tasarlandığı için
      // ayarlayıcının tek kolu toleranstı; `merkez`, `ayna` ve `tavsanKaplumbaga`'nın
      // üçünde de o kol kilitlendi ve üçünü de tek tek elle düzeltmek gerekti. Genel
      // kaçış kapısı olarak hız burada da açılıyor — tasarımın oranları korunur,
      // yalnızca ölçeği büyür.
      const raw = boss
        ? boss.rings().map(r => ({ ...r, speed: r.speed * hizCarpani }))
        : candidate(n, hizCarpani, ekHalka);
      const c = tune(raw, want, n);
      if (c) adaylar.push(c);
      if (adaylar.length && (k + 1) % olagan === 0) {
        // `pick` GERİLEYEMEZ. Eski kod her turda `pick = finalistSec()` diyerek önceki
        // turun seçimini atıyordu; ölçüldü, 25 bölümde seçim geriledi. 21'i bilinçli
        // takastı (kirli aday temiziyle değişti) ama 4 bölümde seçilen aday her iki
        // eksende de önceki turdan kötüydü (ör. 410: %30/sk %12 → %35/sk %17).
        // Eski döngünün bedavaya verdiği "seçim hiç kötüleşmez" güvencesi geri geldi.
        const yeni = finalistSec();
        if (!pick || adayDahaIyi(yeni, pick, want)) pick = yeni;
        if (Math.abs(pick.win - want) <= bant && pick.sureKaybi <= SURE_KAYBI_ESIGI) break;
        if (pick.win > want) {
          hizCarpani = Math.min(1.8, hizCarpani + 0.15);
          // İki tur üst üste tutturulamadıysa halka da ekle: tolerans kolu insan
          // sınırına dayanmış olabilir ve o zaman tek çare daraltan kilit sayısıdır.
          if ((k + 1) / olagan >= 2 && ((k + 1) / olagan) % 2 === 0) ekHalka = Math.min(2, ekHalka + 1);
        }
      }
    }
    if (!pick && adaylar.length) pick = finalistSec();
    if (!pick) { console.error('level', n, 'bulunamadı'); process.exit(1); }

    if (boss) Object.assign(pick, { boss: boss.anahtar });
    // Yıldız eşikleri için ustalık referansı her levelde 25 kez oynatılır (bkz. playUsta).
    es = bolumTohumu(USTA_TOHUMU, n);
    for (let k = 0; k < 25; k++) {
      const usta = playUsta(pick.def, pick.limit);
      if (usta.win) allQ.push(usta.q);
    }
    levels.push(pick);
  }
  allQ.sort((a, b) => a - b);
  // Ustalık referansının levellerin %25'inde 3 yıldız, %60'ında en az 2 yıldız alması
  // hedefleniyor: 3 yıldız gerçekten iyi oynamanın karşılığı olsun.
  const pct = (p: number): number => allQ[Math.min(allQ.length - 1, Math.floor(allQ.length * p))];
  const out = { q3: +pct(0.75).toFixed(2), q2: +pct(0.4).toFixed(2), levels: levels.map((l, i) => ({ n: i + 1, boss: l.boss ?? null, limit: l.limit, rings: l.def })) };
  log('yıldız eşikleri q3/q2:', out.q3, out.q2);
  log(levels.map((l, i) => `${i + 1}${l.boss ? '*' : ''}:${Math.round(l.win * 100)}%/${l.limit}s/${l.def.length}h/${Math.round(l.def[0].gap)}°`).join('  '));
  return out;
}

// data/levels.json biçimi: her level tek satır, okunabilir kalsın diye elle diziliyor.
/**
 * Tablonun sürüm damgası: bölümlerin ve yıldız eşiklerinin özeti.
 *
 * Neden var: kayıt, bölümleri NUMARAYLA saklıyor (`bests: { "47": {...} }`). Tablo
 * yeniden üretildiğinde o numara başka bir bulmacaya ait oluyor. Bir kez yaşandı ve
 * ölçüldü: 1000 bölümün 966'sının tanımı, 761'inin süre sınırı değişti; 303 bölümde
 * kayıtlı rekor yeni sınırı aşıyordu, yani oyuncuya ulaşılamaz bir hedef gösteriliyordu.
 * Kayıtta bir `surum` alanı vardı ama hiç okunmuyordu — ölü alandı.
 *
 * Damga sayesinde oyun, elindeki kaydın hangi tabloya ait olduğunu bilir.
 */
const damga = (o: LevelTable): string =>
  crypto.createHash("sha256")
    .update(o.q3 + "|" + o.q2 + "|" + o.levels.map(l => JSON.stringify(l)).join(""))
    .digest("hex").slice(0, 12);

const serialize = (o: LevelTable): string =>
  '{"v":"' + damga(o) + '","q3":' + o.q3 + ',"q2":' + o.q2 + ',"levels":[\n' +
  o.levels.map(l => JSON.stringify(l)).join(',\n') + '\n]}\n';

// ===== Doğrulama =====
// Eski --verify yalnızca "kazanma oranı %20'nin üstünde mi" diye bakıyordu; oysa üretim
// hedefi %97'den %28'e inen bir eğri. Bir level hedefinin 25 puan altına düşse bile geçiyordu.
/**
 * Hedef eğriden izin verilen sapma.
 *
 * Kazanma oranı 50 denemeyle ölçülüyor. p = 0,4 civarında bir oranın standart hatası
 * sqrt(p(1-p)/50) = 6,9 puandır; yani ±20 puan yaklaşık 3 sigmadır. Daha dar bir bant
 * ölçüm gürültüsünü hata sanardı.
 *
 * Patronlarda daha geniş: yapıları elle tasarlandığı için halka sayısı ve hızları
 * sabittir, ayarlayıcının elinde yalnızca boşluk genişliği vardır.
 */
const BAND = 0.20;
const BAND_BOSS = 0.25;
/** Bir bölümde denemelerin en çok bu kadarı saate yenilebilir (bkz. SURE_KAYBI_ESIGI). */
const SURE_KAYBI_VERIFY = 0.25;

/**
 * Bandı aşan bölüm SAYISI için tavan.
 *
 * Tek bölüm kuralı (±20 puan) artık sert uygulanıyor; bu ölçü onun yerine geçmez,
 * ONA EKLENİR ve başka bir şeyi yakalar: tek tek bandın içinde kalan ama hepsi aynı
 * yöne kaymış bir tablo. Eskiden bu sayı hiç ölçülmüyordu.
 */
const BANT_SAYI_TAVANI = Math.round(LEVEL_COUNT * 0.01);

/**
 * Süre şiddeti: kaç bölüm eşiği aşabilir, ve tek bölüm için mutlak tavan.
 *
 * Bu kuralın işi BOZUK BİR ARKETİPİ yakalamaktır ve öyle bir arketip tek tük değil
 * onlarca bölüm üretir — ölçülen 22 (`buyukKasa` ve kapanış sürümü). Tek şanssız bir
 * bölüm onunla aynı kovaya konmamalı, bu yüzden ölçü sayı tavanıdır. Mutlak tavan
 * 0,50: oyuncunun denemelerinin YARIDAN FAZLASINI saate kaptırdığı bir bölüm, kaç
 * tane olursa olsun, tek başına kusurdur.
 */
const SIDDET_SAYI_TAVANI = 3;
const SIDDET_MUTLAK = 0.50;
const SOLVER_HEADROOM = 0.9; // çözücü, süre sınırının en fazla %90'ını kullanabilir

function verify(): number {
  const data: LevelTable = JSON.parse(fs.readFileSync(OUT, "utf8"));
  // Şema doğrulaması çekirdekte (src/core/levels.ts): oyun da aynı kontrolü kullanabilsin diye.
  const semaHatalari = validateTable(data);
  if (semaHatalari.length) {
    console.error(semaHatalari.length + " şema sorunu:");
    semaHatalari.forEach(h => console.error("  - " + h));
    return 1;
  }
  const rows: string[] = []; const sorunlar: string[] = [];
  const oranlar: number[] = [];
  /** Bandı aşan bölümler; tek tek marjinal olabilirler, sayıları ayrıca denetlenir. */
  const bantDisi: string[] = [];
  /** Patron TASARIMI başına sapmalar; tek tek bölümler değil, tasarımın kendisi denetlenir. */
  const patronSapmalari: Partial<Record<string, number[]>> = {};
  /** Bölüm başına hedef; zor seri artık buna göre ölçülüyor (bkz. ZOR_PAY). */
  const hedefler: number[] = [];
  /** Oyuncunun gördüğü YAPI: halka sayısı, ve mekanik imzası (flip/wobble/iki kapı). */
  const halkaSerisi: number[] = [];
  const arketipSerisi: number[] = [];
  // Denemelerin dörtte birinden fazlası saate yenilen bölümler: orada oyun hassasiyet
  // oyunu olmaktan çıkıp bekleme oyunu olur (bkz. SURE_KAYBI_ESIGI).
  const sureliler: string[] = [];
  // Süre sınırının ÖTEKİ ucu: γ tavanını aşan, yani oyuncunun halkaların ikinci turunu
  // bekleyebildiği bölümler (bkz. GAMA_TAVAN). İkisi karşıt hatalardır, ayrı sayılır.
  const gevsekler: string[] = [];
  const gamalar: number[] = [];
  /** Bölüm başına süre kaybı oranı; şiddet tavanı için (bkz. SURE_KAYBI_SIDDET). */
  const sureKayiplari: number[] = [];

  for (const l of data.levels) {
    const ad = `${l.n}${l.boss ? "*" : ""}`;
    const cozum = solve(l.rings);
    const best = cozum ? cozum.t : null;
    const ev = evaluate({ def: l.rings, limit: l.limit }, l.n, DENETIM_DENEME, DENETIM_TOHUMU);
    const hedef = bossHedefi(l.n, !!l.boss);
    const sapma = ev.win - hedef;
    const moving = l.rings.filter(r => !r.preLocked).length;

    if (best == null) sorunlar.push(`${ad}: referans çözücü bitiremiyor`);
    else if (best > l.limit * SOLVER_HEADROOM) sorunlar.push(`${ad}: çözücü ${best.toFixed(1)} sn, limit ${l.limit} sn — pay yok`);
    const bandi = l.boss ? BAND_BOSS : BAND;
    if (Math.abs(sapma) > bandi) {
      const metin = `${ad}: kazanma %${Math.round(ev.win * 100)}, hedef %${Math.round(hedef * 100)} (${sapma > 0 ? "+" : ""}${Math.round(sapma * 100)} puan)`;
      bantDisi.push(metin);
      sorunlar.push(metin);
    }
    // Tasarım limiti kuraldır ama bekleme bütçesi tavanı onu kesebilir (bkz. GAMA_TAVAN):
    // hızlı halkalı bir bölümde tasarım süresi oyuncuya ikinci turu bekletirdi.
    const altSinir = Math.min(tasarimLimiti(l.n, moving), gamaTavani(l.rings));
    if (l.limit < altSinir - 0.05) sorunlar.push(`${ad}: limit tasarım değerinin altında`);
    const g = gamaHesapla(l.rings, l.limit);
    gamalar.push(g);
    if (g > GAMA_TAVAN + 0.05) gevsekler.push(`${ad}: γ ${g.toFixed(2)}`);
    sureKayiplari.push(ev.sureKaybi);
    if (ev.sureKaybi > SURE_KAYBI_VERIFY) sureliler.push(`${ad}: denemelerin %${Math.round(ev.sureKaybi * 100)}'i süre dolmasıyla bitiyor`);
    oranlar.push(ev.win);
    hedefler.push(hedef);
    if (l.boss) (patronSapmalari[l.boss] ??= []).push(sapma);
    // Patronlar seriye GİRMEZ. Altı patron tasarımı 10 bölümde bir dönüyor, yani
    // 60 bölümde bir aynısı geliyor — bu KASITLI ve oyuncuya görünür bir dönüm
    // noktası, şartnamede yazılı ve `levels.test.ts` ayrıca garanti ediyor. Seriye
    // katıldığında 60'ın katı olan gecikmelerde sabit bir eşleşme sinyali ekliyor
    // (ölçtüm: lag 240'ta 74 patron çiftinin 73'ü eşleşiyor) ve bu denetimin ASIL
    // aradığı şeyi — sıradan bölümlerde istemeden oluşan tekrarı — bastırıyor.
    if (l.n >= YAPI_BASLANGIC && !l.boss) {
      halkaSerisi.push(l.rings.length);
      arketipSerisi.push(
        (l.rings.some(r => r.flip > 0) ? 1 : 0) |
        (l.rings.some(r => r.wobble) ? 2 : 0) |
        (l.rings.some(r => r.gaps === 2) ? 4 : 0));
    }
    rows.push(`${ad}:${Math.round(ev.win * 100)}%`);
  }

  // Zorluk EĞİLİMİ düşüyor mu? Eğri dalgalı olduğu için tek tek leveller birbirinden
  // kolay olabilir; anlamlı olan 20 bölümlük hareketli ortalamanın inmesi.
  const pencere = 20;
  const ortalama = (i: number): number => {
    const a = Math.max(0, i - pencere / 2), b = Math.min(oranlar.length, i + pencere / 2);
    let t = 0; for (let k = a; k < b; k++) t += oranlar[k];
    return t / (b - a);
  };
  const bas = ortalama(pencere), son = ortalama(oranlar.length - pencere);
  if (son > bas - 0.25) {
    sorunlar.push(`zorluk eğilimi yetersiz: başta %${Math.round(bas * 100)}, sonda %${Math.round(son * 100)} (en az 25 puan düşmeli)`);
  }
  // Eğilim hiçbir yerde belirgin şekilde geri gitmemeli.
  for (let i = pencere; i + pencere < oranlar.length; i += pencere) {
    const su = ortalama(i), sonraki = ortalama(i + pencere);
    if (sonraki > su + 0.10) {
      sorunlar.push(`${i}-${i + pencere} arası zorluk eğilimi geri gidiyor: %${Math.round(su * 100)} -> %${Math.round(sonraki * 100)}`);
    }
  }

  // Yıldız dağılımı USTALIK REFERANSINA göre ölçülür (bkz. playUsta): eşikler
  // "iyi oynamanın karşılığı" olduğu için ortalama oyuncuyla değil ustayla kalibre edilir.
  const tumQ: number[] = [];
  for (const l of data.levels) {
    es = bolumTohumu(USTA_DENETIM_TOHUMU, l.n);
    for (let k = 0; k < 25; k++) {
      const u = playUsta(l.rings, l.limit);
      if (u.win) tumQ.push(u.q);
    }
  }
  const pay = [tumQ.filter(q => q >= data.q3).length, tumQ.filter(q => q < data.q3 && q >= data.q2).length, tumQ.filter(q => q < data.q2).length].map(v => v / tumQ.length);
  if (pay[0] < 0.15 || pay[0] > 0.35) sorunlar.push(`ustanın 3 yıldız oranı %${Math.round(pay[0] * 100)} — %15-35 dışında`);

  // Süre dolması baskın kayıp sebebi olan bölümler (bkz. SURE_KAYBI_VERIFY). Tek tük
  // olması normal; yaygınlaşması zorluğun daralmadan değil saatten geldiği anlamına gelir.
  const SURELI_TAVAN = Math.round(LEVEL_COUNT * 0.02);
  if (sureliler.length > SURELI_TAVAN) {
    sorunlar.push(`${sureliler.length} bölümde denemelerin dörtte birinden fazlası saate yeniliyor (en çok ${SURELI_TAVAN} olmalı): ` +
      sureliler.slice(0, 6).join("; ") + (sureliler.length > 6 ? " …" : ""));
  }

  // γ tavanı üreticide zorlanır; burada tek bir ihlal bile kaçak demektir.
  if (gevsekler.length) {
    sorunlar.push(`${gevsekler.length} bölümde γ tavanı (${GAMA_TAVAN}) aşılmış — oyuncu ikinci turu bekleyebiliyor: ` +
      gevsekler.slice(0, 6).join("; ") + (gevsekler.length > 6 ? " …" : ""));
  }

  const gOrt = gamalar.reduce((a, b) => a + b, 0) / gamalar.length;
  console.log(rows.join("  "));
  console.log(`yıldız dağılımı (ustalık referansı): 3★ %${Math.round(pay[0] * 100)}  2★ %${Math.round(pay[1] * 100)}  1★ %${Math.round(pay[2] * 100)}`);
  console.log(`saate yenilmenin baskın olduğu bölüm: ${sureliler.length} / ${LEVEL_COUNT}`);
  console.log(`γ (halka başına izlenebilen tur): ortalama ${gOrt.toFixed(2)}, en yüksek ${Math.max(...gamalar).toFixed(2)}, tavan ${GAMA_TAVAN}`);

  console.log(`bant: ${bantDisi.length} bölüm ±${Math.round(BAND * 100)} puan dışında ` +
    `(sayı tavanı ${BANT_SAYI_TAVANI}; ${DENETIM_DENEME} denemede SE ≈ ${(Math.sqrt(0.24 / DENETIM_DENEME) * 100).toFixed(1)} puan)` +
    (bantDisi.length ? " — " + bantDisi.slice(0, 6).join("; ") + (bantDisi.length > 6 ? " …" : "") : ""));
  if (bantDisi.length > BANT_SAYI_TAVANI) {
    sorunlar.push(`${bantDisi.length} bölüm hedef bandının dışında (en çok ${BANT_SAYI_TAVANI} olmalı) — ` +
      `tek tek marjinal olsalar bile bu, eğrinin kaydığı anlamına gelir`);
  }

  // ---- Patron TASARIMI başına ortalama sapma --------------------------------
  //
  // Bant tek tek bölümlere bakar ve patronlarda ±25 puandır; bir TASARIMIN bütün
  // örneklerinin aynı yöne 6-7 puan kayması bu kapıdan rahatça geçer. Oysa tam da o,
  // bir tasarım kusurudur: `merkez`de kilitli zorluk kolu, `ayna`da eşzamanlı
  // hizalanma böyle bulundu — ikisi de bant denetimine hiç takılmamıştı.
  //
  // Tasarım başına 16-17 örnek var, yani ortalamanın standart hatası ~0,4 puan
  // (bölüm başına SE ≈ 1,55 / √16). 6 puanlık bir tavan gürültünün 15 katı: bu kural
  // yanlış alarm vermez, yalnızca gerçek kaymayı yakalar.
  const PATRON_SAPMA_TAVANI = 0.06;
  const patronSatir: string[] = [];
  for (const [ad, xs] of Object.entries(patronSapmalari)) {
    if (!xs || !xs.length) continue;
    const ort = xs.reduce((a, b) => a + b, 0) / xs.length;
    patronSatir.push(`${ad} ${ort > 0 ? "+" : ""}${Math.round(ort * 100)}`);
    if (Math.abs(ort) > PATRON_SAPMA_TAVANI) {
      sorunlar.push(`patron tasarımı "${ad}" ${xs.length} örneğinin ortalamasında hedeften ` +
        `${ort > 0 ? "+" : ""}${Math.round(ort * 100)} puan sapıyor (tavan ±${Math.round(PATRON_SAPMA_TAVANI * 100)}) — ` +
        `tek bölüm değil TASARIM kusuru`);
    }
  }
  console.log("patron tasarımı başına ortalama sapma (puan): " + patronSatir.join("  "));

  // ---- Ritim: oyun kendini tekrar ediyor mu? --------------------------------
  //
  // Üç ölçü, üçü de tavanını KENDİ boş hipotezinden alır (bkz. permutasyonTavani):
  //   1. Yapı serisi  — halka sayısı: oyuncunun doğrudan gördüğü şey.
  //   2. Arketip serisi — hangi mekanikler var: "bunu daha önce oynadım" hissi.
  //   3. Zorluk kalıntısı — eğilimden arındırılmış kazanma oranı; dolaylı ama
  //      parametrelerden gelen gizli periyotları yakalar.
  // Ayrıca ritmin BEDELİ denetlenir: periyodikliği kırmanın kolay yolu zor bölümleri
  // arka arkaya dizmektir; o zaman "zor seri" uzar. İkisi birlikte ölçülmezse biri
  // kazanılırken öbürü sessizce kaybedilir.
  const ritimSatir: string[] = [];

  for (const [ad, seri, tohum] of [
    ["halka sayısı", halkaSerisi, 101],
    ["arketip", arketipSerisi, 202]
  ] as Array<[string, number[], number]>) {
    const t = eslesmeTepesi(seri);
    const tavan = permutasyonTavani(seri, d => eslesmeTepesi(d).deger, tohum);
    ritimSatir.push(`${ad} lag ${t.lag} = ${t.deger.toFixed(3)} (tavan ${tavan.toFixed(3)})`);
    if (t.deger > tavan) {
      sorunlar.push(`${ad} serisi ${t.lag} bölümde bir kendini tekrar ediyor: ` +
        `eşleşme ${(t.deger * 100).toFixed(1)}%, rastgele sıralamada en çok ${(tavan * 100).toFixed(1)}%`);
    }
  }

  // Zorluk kalıntısı = HEDEFTEN sapma. Bu tanım iki kez düzeltildi.
  //
  // Önce 25 pencereli hareketli ortalamayla eğilim çıkarılıyordu. Ölçtüm: o kalıntının
  // en güçlü gecikmeleri 120, 50, 190, 310, 240, 290, 70… — hepsi 10'un katı, yani
  // PATRON temposu. Patronlar çıkarılınca tepe düşüyor ama hâlâ geniş bir yükselme
  // kalıyordu; sebebi zorluk eğrisinin kendi dalgası (DALGA_PERIYOT = 24): 25'lik bir
  // hareketli ortalama 24 periyotlu sinüsü izleyemez, dolayısıyla kalıntıda dalganın
  // TAMAMI duruyordu. Yani denetim, tasarımın KASITLI ritmini kusur sayıyordu.
  //
  // Doğru kalıntı hedeften sapmadır: hedef eğrisi dalgayı, nefesi ve patron çukurunu
  // zaten içerir. Geriye kalan şey "tasarımdan sapma"dır ve beyaz gürültü olmalıdır —
  // orada bulunan her periyot istemsizdir. Permütasyon boş hipotezi de ancak bu seri
  // için geçerlidir: süzgeçten geçmiş bir seri değişim sırasına duyarsız değildir.
  const kalinti = oranlar.map((o, i) => o - hedefler[i]);
  // Tek hesap, üç kullanım: ölçüm, tavan ve teşhis. Bu satırlar bir ara üç ayrı yerde
  // elle yazılıydı; biri düzeltilip öbürü unutulsa ölçüm ile tavan FARKLI metrikten
  // gelir ve denetim sessizce anlamsızlaşırdı.
  const zorlukEgrisi = ozilintiler(kalinti, RITIM_TARAMA_ALT, LAG_UST);
  const { lag: tepeLag, deger: tepe } = IST.tepeNoktasi(zorlukEgrisi, RITIM_TARAMA_ALT);
  const zorlukTavani = permutasyonTavani(kalinti, d => ozilintiTepesi(d).deger, 303);
  ritimSatir.push(`zorluk lag ${tepeLag} = ${tepe.toFixed(3)} (tavan ${zorlukTavani.toFixed(3)})`);
  // Teşhis: tepe tek bir gecikmede mi, yoksa bir periyodun KATLARINDA mı? İkincisi
  // gerçek periyodikliktir; birincisi çoğu zaman gürültüdür. (`merkez` patronundaki
  // kilitli zorluk kolu böyle bulundu: tepe 120'deydi, ikincisi 240.)
  {
    const hepsi = Array.from(zorlukEgrisi, (c, i) => [RITIM_TARAMA_ALT + i, c] as [number, number]);
    hepsi.sort((x, y) => y[1] - x[1]);
    console.log("  zorluk kalıntısının en güçlü 8 gecikmesi: " +
      hepsi.slice(0, 8).map(([l, c]) => `${l}:${c.toFixed(2)}`).join("  "));
  }
  if (tepe > zorlukTavani) {
    sorunlar.push(`zorluk ${tepeLag} bölümde bir kendini tekrar ediyor: özilinti ${tepe.toFixed(2)}, ` +
      `rastgele sıralamada en çok ${zorlukTavani.toFixed(2)}`);
  }
  console.log("ritim: " + ritimSatir.join("  |  "));

  // Zor seri: MUTLAK eşik değil, her bölümün KENDİ hedefine göre (bkz. ZOR_PAY).
  const zorMu = oranlar.map((o, i) => o < hedefler[i] - ZOR_PAY);
  const enUzunZor = enUzunSeri(zorMu);
  const zorOran = zorMu.filter(Boolean).length / zorMu.length;
  // Tavan yine boş hipotezden: aynı oranda ama BAĞIMSIZ dağılmış zor bölümlerle
  // en uzun seri ne kadar olurdu? %99'luk dilim.
  const zorTavan = ((): number => {
    const r = yerelRng(404), v: number[] = [];
    for (let k = 0; k < 400; k++) {
      const d: boolean[] = [];
      for (let i = 0; i < zorMu.length; i++) d.push(r() < zorOran);
      v.push(enUzunSeri(d));
    }
    v.sort((x, y) => x - y);
    return v[Math.floor(400 * 0.99)];
  })();
  console.log(`zor seri (hedefin ${Math.round(ZOR_PAY * 100)} puan altı): ` +
    `%${Math.round(zorOran * 100)} bölüm, en uzun kesintisiz ${enUzunZor} (tavan ${zorTavan})`);
  if (enUzunZor > zorTavan) {
    const bas = zorMu.findIndex((_, i) => zorMu.slice(i, i + enUzunZor).every(Boolean)) + 1;
    sorunlar.push(`${bas}. bölümden başlayan ${enUzunZor} bölümlük kesintisiz zor seri var ` +
      `(bağımsız dağılımda en çok ${zorTavan}): sıradan oyuncuyu kaçıran şey tek bir zor ` +
      `bölüm değil, arka arkaya gelenler`);
  }

  // ---- Süre kaybının ŞİDDETİ ------------------------------------------------
  //
  // Sayı tavanı (SURELI_TAVAN) kaç bölümün saate yenildiğini sınırlıyor ama
  // şiddetini sınırlamıyordu: %26 ile %70 aynı kovadaydı. Ölçüldü, bozuk olan tek
  // bir arketipti — büyükKasa ve onun kapanış sürümü.
  const siddetliler = data.levels
    .map((l, i) => ({ n: l.n, k: sureKayiplari[i] }))
    .filter(x => x.k > SURE_KAYBI_SIDDET);
  // Bu kuralın işi BOZUK BİR ARKETİPİ yakalamaktı ve öyle bir arketip tek tük değil
  // onlarca bölüm üretir (ölçülen: 22). Tek bir şanssız bölüm onunla aynı kovaya
  // konmamalı. Bu yüzden ölçü ikili: sayı tavanı, artı tek bölüm için mutlak tavan.
  const listele = (x: Array<{ n: number; k: number }>): string =>
    x.slice(0, 6).map(y => `${y.n} (%${Math.round(y.k * 100)})`).join("; ") + (x.length > 6 ? " …" : "");
  if (siddetliler.length) {
    console.log(`süre şiddeti: ${siddetliler.length} bölüm %${SURE_KAYBI_SIDDET * 100} üstünde ` +
      `(tavan ${SIDDET_SAYI_TAVANI}): ` + listele(siddetliler));
  }
  if (siddetliler.length > SIDDET_SAYI_TAVANI) {
    sorunlar.push(`${siddetliler.length} bölümde denemelerin %${SURE_KAYBI_SIDDET * 100}'inden fazlası ` +
      `saate yeniliyor (en çok ${SIDDET_SAYI_TAVANI} olmalı): ` + listele(siddetliler));
  }
  const cokSiddetli = siddetliler.filter(x => x.k > SIDDET_MUTLAK);
  if (cokSiddetli.length) {
    sorunlar.push(`${cokSiddetli.length} bölümde denemelerin yarıdan fazlası (>%${SIDDET_MUTLAK * 100}) saate yeniliyor: ` +
      listele(cokSiddetli));
  }

  // Baştan kilitli halkalar kalan halkalara yeterli pay bırakıyor mu? (bkz. EN_AZ_PAY)
  for (const l of data.levels) {
    const canli = liveRings(l.rings);
    const b = initialOpen(canli);
    if (b === OPEN_ALL) continue;
    const kalan = canli.filter(r => !r.locked).length;
    const p = largestOpen(b).w - NEED_PASS;
    if (p < gerekenPay(kalan)) {
      sorunlar.push(`${l.n}: baştan kilitli halkalardan sonra ${(p / DEG).toFixed(1)}° pay kalıyor, ${(gerekenPay(kalan) / DEG).toFixed(1)}° gerek (${kalan} halka)`);
    }
  }

  // Yön değiştiren halka kilitlenmeden önce dönüşünü gösterebiliyor mu? (bkz. gorunurFlip)
  for (const l of data.levels) {
    if (l.boss) continue;   // patronlar elle tasarlandı
    let sira = 0;
    for (const r of l.rings) {
      if (r.preLocked) continue;
      const an = tahminiKilitAni(sira); sira++;
      if (r.flip > 0 && r.flip >= an) {
        sorunlar.push(`${l.n}: flip periyodu ${r.flip.toFixed(1)}s, halka ~${an.toFixed(1)}s'de kilitleniyor — oyuncu dönüşü göremez`);
      }
    }
  }

  if (process.argv.includes("--deterministic")) {
    const tekrar = serialize(generate());
    if (tekrar !== fs.readFileSync(OUT, "utf8")) sorunlar.push("üretim deterministik değil ya da dosya elle değiştirilmiş: gen.ts yeniden üretince farklı tablo çıkıyor");
    else console.log("determinizm: yeniden üretim birebir aynı dosyayı veriyor");
  }

  if (sorunlar.length) { console.error("\n" + sorunlar.length + " sorun:"); sorunlar.forEach(s => console.error("  - " + s)); return 1; }
  console.log(`Tüm leveller çözülebilir, zorluk eğrisi hedefin ±${Math.round(BAND * 100)} puanı içinde ` +
    `(patronlarda ±${Math.round(BAND_BOSS * 100)})`);
  return 0;
}

if (process.argv.includes("--verify")) process.exit(verify());
fs.writeFileSync(OUT, serialize(generate(console.log)));
