// Cihazda yerel kayıt. Okunamazsa oyun hata vermeden Level 1'den başlar.
//
// Sürümlü ve doğrulanmış: prototipte kayıt ham JSON.parse ile okunuyordu, bozuk ya da
// elle kurcalanmış veri sessizce garip skorlara dönüşebiliyordu.
import { LEVEL_COUNT, isBetter } from "../core/index.ts";
import type { Best, Stars } from "../core/index.ts";

const KEY = "donence:v1";
/** Oyunun eski adıyla yazılmış kayıt. Bulunursa okunur ve yeni anahtara taşınır. */
const ESKI_KEY = "kasa:v1";
const SURUM = 1;

export interface Kayit {
  surum: number;
  /** Son oynanan level. Bölüm seçiminden geriye dönünce bu küçülür. */
  level: number;
  /**
   * Ulaşılan EN UZAK bölüm; bölüm seçiminde buraya kadarı açıktır.
   *
   * `level`den ayrı tutulması şart: bölüm seçimi eklendiğinde 412. bölümdeki oyuncu
   * 5. bölüme dönebiliyor ve tek alan olsaydı 412'yi kaybediyordu. İlerleme "en uzak"
   * ile ölçülür, "şu an oynanan" ile değil.
   */
  enUzak: number;
  /**
   * Rekorların ait olduğu TABLO sürümü (bkz. core/levels.ts `v`).
   *
   * Bölümler numarayla saklanıyor; tablo yeniden üretildiğinde "47. bölümde 2 yıldız"
   * kaydı başka bir bulmacaya ait oluyor. Bir kez yaşandı: 966 bölümün tanımı değişti
   * ve 303 bölümde gösterilen rekor ulaşılamaz bir hedef hâline geldi.
   *
   * Alan YOKSA kayıt damgadan önceki dönemden gelir ve mevcut tabloyu benimser —
   * silme yapılmaz. Alan VARSA ve eşleşmezse yalnız `bests` temizlenir.
   */
  tabloSurum?: string;
  /** Level numarası -> en iyi sonuç. */
  bests: Record<number, Best>;
}

const bos = (): Kayit => ({ surum: SURUM, level: 1, enUzak: 1, bests: {} });

const gecerliYildiz = (s: unknown): s is Stars => s === 1 || s === 2 || s === 3;

/** Bilinmeyen biçimdeki veriyi ayıklar; tek bir bozuk kayıt tüm rekorları düşürmez. */
function ayikla(ham: unknown): Kayit {
  if (typeof ham !== "object" || ham === null) return bos();
  const o = ham as Record<string, unknown>;
  const k = bos();

  if (typeof o.level === "number" && Number.isInteger(o.level) && o.level >= 1 && o.level <= LEVEL_COUNT) {
    k.level = o.level;
  }
  if (typeof o.tabloSurum === "string" && o.tabloSurum.length <= 64) k.tabloSurum = o.tabloSurum;
  const enUzakVar = typeof o.enUzak === "number" && Number.isInteger(o.enUzak) &&
    o.enUzak >= 1 && o.enUzak <= LEVEL_COUNT;
  if (enUzakVar) k.enUzak = o.enUzak as number;
  if (typeof o.bests === "object" && o.bests !== null) {
    for (const [anahtar, deger] of Object.entries(o.bests as Record<string, unknown>)) {
      const n = Number(anahtar);
      if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) continue;
      if (typeof deger !== "object" || deger === null) continue;
      const b = deger as Record<string, unknown>;
      if (!gecerliYildiz(b.s)) continue;
      if (typeof b.t !== "number" || !Number.isFinite(b.t) || b.t < 0) continue;
      k.bests[n] = { s: b.s, t: b.t };
    }
  }
  // Bu alan sonradan eklendi ve eski kayıtlarda YOK. O durumda türetilir: oynanmış en
  // yüksek bölüm ile bitirilmiş en yüksek bölümün büyüğü. Böylece güncellemeyle birlikte
  // kimse açtığı bölümleri kaybetmez.
  //
  // Alan VARSA rekorlardan türetilmez — bu ayrım şart: "Baştan başla" yıldızları
  // koruyup açılan bölümleri kilitler, rekorlardan türetilseydi kilitleme anında geri
  // alınırdı. Yalnızca `level` ile tutarlılık sağlanır; oynanan bölüm açık olmalıdır.
  if (enUzakVar) {
    k.enUzak = Math.max(k.enUzak, k.level);
  } else {
    const enYuksekBitirilen = Object.keys(k.bests).reduce((en, x) => Math.max(en, Number(x)), 0);
    k.enUzak = Math.min(LEVEL_COUNT, Math.max(k.level, enYuksekBitirilen));
  }
  return k;
}

export function oku(): Kayit {
  try {
    // Oyun "Kasa" adıyla oynanmışsa kayıt eski anahtardadır; taşınır, ilerleme kaybolmaz.
    const ham = localStorage.getItem(KEY) ?? localStorage.getItem(ESKI_KEY);
    if (!ham) return bos();
    const k = ayikla(JSON.parse(ham));
    if (!localStorage.getItem(KEY)) yaz(k);
    return k;
  } catch {
    // Gizli sekmede, site verisi engelliyken ya da bozuk JSON'da buraya düşer.
    return bos();
  }
}

function yaz(k: Kayit): void {
  try { localStorage.setItem(KEY, JSON.stringify(k)); } catch { /* kayıt olmadan da oynanır */ }
}

export function levelKaydet(k: Kayit, level: number): void {
  k.level = level;
  if (level > k.enUzak) k.enUzak = level;
  yaz(k);
}

/**
 * Kaydı, yüklenen tablonun sürümüyle hizalar. Kaç rekorun silindiğini döner.
 *
 * Kural: alan YOKSA benimse (silme yok) — damgadan önceki kayıtlar cezalandırılmaz.
 * Alan VARSA ve eşleşmiyorsa yalnız `bests` temizlenir; `level` ve `enUzak` KORUNUR.
 * Yani oyuncu yıldızlarını kaybeder ama 412 bölümlük ilerlemesini kaybetmez — yanlış
 * bir rekoru taşımakla bütün ilerlemeyi silmek arasında seçim yapmak gerekmiyor.
 */
export function tabloSurumuUygula(k: Kayit, surum: string | undefined): number {
  if (!surum || k.tabloSurum === surum) return 0;
  const silinen = k.tabloSurum === undefined ? 0 : Object.keys(k.bests).length;
  if (k.tabloSurum !== undefined) k.bests = {};
  k.tabloSurum = surum;
  yaz(k);
  return silinen;
}

/** Bölüm seçiminde oynanabilir mi? Ulaşılan en uzak bölüme kadar her şey açıktır. */
export const acikMi = (k: Kayit, n: number): boolean => n >= 1 && n <= k.enUzak;

/** Rekor kırıldıysa kaydeder ve true döner. */
export function rekorKaydet(k: Kayit, level: number, yeni: Best): boolean {
  if (!isBetter(yeni, k.bests[level])) return false;
  k.bests[level] = yeni;
  yaz(k);
  return true;
}

/**
 * "Baştan başla": Level 1'e döner ve açılan bölümleri kilitler; rekorlar KALIR.
 *
 * `enUzak` da sıfırlanır, yoksa eylem geri alınabilir olurdu (oyuncu bölüm seçiminden
 * hemen 412'ye dönerdi) ve iki aşamalı onayın bir anlamı kalmazdı. Bölümleri kaybetmeden
 * baştan oynamanın yolu artık bölüm seçimi; bu düğme bilerek yıkıcı kalıyor.
 */
export function bastanBasla(k: Kayit): void {
  k.level = 1;
  k.enUzak = 1;
  yaz(k);
}

export const toplamYildiz = (k: Kayit): number =>
  Object.values(k.bests).reduce((s, b) => s + b.s, 0);

export const bitirilenLevel = (k: Kayit): number => Object.keys(k.bests).length;
