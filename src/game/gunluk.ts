// Günün bölümü ve günlük seri.
//
// Neden: yayın öncesi incelemede "geri dönme sebebi yok" bulundu — günlük görev, seri,
// bildirim yoktu; tek çekici "sonraki bölüm"dü. Günün bölümü küçük, günde bir kez
// verilen bir hedef ve üst üste oynanan günler bir seri oluşturur.
//
// KURALLAR:
// - Yalnız oyuncunun AÇTIĞI bölümler arasından seçilir: kilitli bir bölümü açmaz,
//   ilerlemeyi atlatmaz, tabloya dokunmaz.
// - Oyuncu en az ESIK bölüm açınca görünür; daha önce havuz çok küçük (hep 1. bölüm).
// - Seri AYRI bir anahtarda tutulur: tablo değişip rekorlar silinse bile seri kalır.
// - Gün, cihazın YEREL tarihidir (gece yarısında değişir).

const KEY = "donence:gunluk:v1";

/** Günün bölümü bu kadar bölüm açılınca görünür. */
export const GUNLUK_ESIK = 10;

export interface Gunluk {
  /** Günün bölümünün son bitirildiği gün (YYYY-AA-GG) ya da null. */
  son: string | null;
  /** Üst üste bitirilen gün sayısı. */
  seri: number;
  /** En uzun seri. */
  enUzunSeri: number;
}

const bos = (): Gunluk => ({ son: null, seri: 0, enUzunSeri: 0 });

/** Yerel tarih: YYYY-AA-GG. */
export function gunAnahtari(t: Date): string {
  const a = String(t.getMonth() + 1).padStart(2, "0"), g = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${a}-${g}`;
}

/** Bir önceki gün (takvim aritmetiği UTC'de, yaz saati geçişinden etkilenmez). */
export function oncekiGun(gun: string): string {
  const [y, a, g] = gun.split("-").map(Number);
  const t = new Date(Date.UTC(y, a - 1, g) - 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Günün bölümü. Havuz 10'luk basamaklara yuvarlanır ki oyuncu gün içinde ilerledikçe
 * günün bölümü her kazançta değişmesin. Esikten azsa null.
 */
export function gununBolumu(gun: string, enUzak: number): number | null {
  if (enUzak < GUNLUK_ESIK) return null;
  const havuz = Math.floor(enUzak / 10) * 10;
  let h = 0x811c9dc5;
  for (let i = 0; i < gun.length; i++) { h ^= gun.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % havuz) + 1;
}

/** Bugün bitirildi: seriyi günceller. Aynı gün ikinci kez sayılmaz. */
export function gunuTamamla(g: Gunluk, gun: string): Gunluk {
  if (g.son === gun) return g;
  const seri = g.son === oncekiGun(gun) ? g.seri + 1 : 1;
  return { son: gun, seri, enUzunSeri: Math.max(g.enUzunSeri, seri) };
}

/** Gösterilecek seri: dün de bitirilmediyse seri kopmuştur. */
export const guncelSeri = (g: Gunluk, bugun: string): number =>
  g.son === bugun || g.son === oncekiGun(bugun) ? g.seri : 0;

export function gunlukOku(): Gunluk {
  try {
    const ham = localStorage.getItem(KEY);
    if (!ham) return bos();
    const o = JSON.parse(ham) as Record<string, unknown>;
    const g = bos();
    if (typeof o.son === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.son)) g.son = o.son;
    if (typeof o.seri === "number" && Number.isInteger(o.seri) && o.seri >= 0) g.seri = o.seri;
    if (typeof o.enUzunSeri === "number" && Number.isInteger(o.enUzunSeri) && o.enUzunSeri >= 0) g.enUzunSeri = o.enUzunSeri;
    return g;
  } catch { return bos(); }
}

export function gunlukYaz(g: Gunluk): void {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* seri olmadan da oynanır */ }
}
