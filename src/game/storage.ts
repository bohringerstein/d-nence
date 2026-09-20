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
  /** Son oynanan level. */
  level: number;
  /** Level numarası -> en iyi sonuç. */
  bests: Record<number, Best>;
}

const bos = (): Kayit => ({ surum: SURUM, level: 1, bests: {} });

const gecerliYildiz = (s: unknown): s is Stars => s === 1 || s === 2 || s === 3;

/** Bilinmeyen biçimdeki veriyi ayıklar; tek bir bozuk kayıt tüm rekorları düşürmez. */
function ayikla(ham: unknown): Kayit {
  if (typeof ham !== "object" || ham === null) return bos();
  const o = ham as Record<string, unknown>;
  const k = bos();

  if (typeof o.level === "number" && Number.isInteger(o.level) && o.level >= 1 && o.level <= LEVEL_COUNT) {
    k.level = o.level;
  }
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
  yaz(k);
}

/** Rekor kırıldıysa kaydeder ve true döner. */
export function rekorKaydet(k: Kayit, level: number, yeni: Best): boolean {
  if (!isBetter(yeni, k.bests[level])) return false;
  k.bests[level] = yeni;
  yaz(k);
  return true;
}

/** "Baştan başla": Level 1'e döner ama rekorları silmez. */
export function bastanBasla(k: Kayit): void {
  levelKaydet(k, 1);
}

export const toplamYildiz = (k: Kayit): number =>
  Object.values(k.bests).reduce((s, b) => s + b.s, 0);

export const bitirilenLevel = (k: Kayit): number => Object.keys(k.bests).length;
