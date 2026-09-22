// Level tablosunun biçimi ve şema doğrulaması.
// Oynanabilirlik denetimi ayrıdır: tools/gen.ts --verify.
import { TAU, NEED, DEG } from "./geometry.ts";
import type { RingDef } from "./rings.ts";

/**
 * Patron bölümlerinin anahtarları.
 *
 * Bunlar VERİdir, metin değil: bir bölümün hangi patron tasarımı olduğunu söylerler.
 * Görünen ad ve ipucu src/dil/ altında bu anahtarlarla aranır. Çekirdek dil katmanını
 * tanımaz — oyun kuralları hangi dilde oynandığından bağımsızdır.
 */
export const PATRON_ANAHTARLARI =
  ["ayna", "merkez", "metronom", "catal", "tavsanKaplumbaga", "buyukKasa", "sonKasa"] as const;
export type PatronAnahtari = typeof PATRON_ANAHTARLARI[number];

export interface Level {
  n: number;
  /**
   * Patron leveliyse patron ANAHTARI ("ayna", "catal", ...), değilse null.
   *
   * Eskiden burada görünen adın kendisi ("Ayna") ve ayrı bir ipucu metni dururdu —
   * yani oyuncuya gösterilen Türkçe metin 1000 satırın içine gömülüydü ve
   * çevrilemezdi. Ad ve ipucu artık src/dil/ altında, anahtarla aranır.
   */
  boss: PatronAnahtari | null;
  /** Süre sınırı, saniye. */
  limit: number;
  /** Dıştan içe sıralı. */
  rings: RingDef[];
}

export interface LevelTable {
  /**
   * Tablonun sürüm damgası (bölümlerin ve eşiklerin özeti).
   *
   * Kayıt bölümleri NUMARAYLA saklar; tablo yeniden üretildiğinde o numara başka bir
   * bulmacaya ait olur. Damga, oyunun elindeki kaydın hangi tabloya ait olduğunu
   * bilmesini sağlar (bkz. game/storage.ts tabloSurumuUygula).
   *
   * İsteğe bağlı: damgadan önce üretilmiş bir tabloyla da oyun açılabilmeli.
   */
  v?: string;
  /** 3 yıldız eşiği. */
  q3: number;
  /** 2 yıldız eşiği. */
  q2: number;
  levels: Level[];
}

export const GAP_MAX_DEG = 85;

/**
 * Bölüm sayısı. Tek sabit: değiştirip `npm run gen` çalıştırmak yeterli.
 *
 * Oyun "aa" gibi uzun soluklu olmalı; 60 bölüm bir saatte bitiyordu. Bu tür bir oyunda
 * yapı tekrarı rahatsız edici değildir, çünkü bölümler arasındaki fark hız ve boşluk
 * genişliğiyle taşınır ve oyuncu iki bölümü yan yana görmez.
 */
export const LEVEL_COUNT = 1000;

/** Her 10 bölümde bir patron. */
export const BOSS_ARALIGI = 10;
export const BOSS_LEVELS: number[] =
  Array.from({ length: Math.floor(LEVEL_COUNT / BOSS_ARALIGI) }, (_, i) => (i + 1) * BOSS_ARALIGI);
export const bossMu = (n: number): boolean => n % BOSS_ARALIGI === 0;

const RING_FIELDS: Array<[keyof RingDef, string]> = [
  ["speed", "number"], ["gap", "number"], ["gaps", "number"], ["gapOffset", "number"],
  ["flip", "number"], ["wobble", "boolean"], ["preLocked", "boolean"], ["start", "number"]
];

/** Sonlu sayı mı? NaN ve Infinity `typeof x === "number"` denetiminden geçer. */
const sayiMi = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Nesne mi? `typeof null === "object"` olduğu için ayrıca null elenir. */
const nesneMi = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

/**
 * Tabloyu biçim açısından denetler. Boş dizi dönerse tablo sağlam.
 *
 * Girdi bilerek `unknown`: bu fonksiyonun işi zaten GÜVENİLMEYEN veriyi denetlemek.
 * `LevelTable` tipiyle yazıldığında gövde, doğru biçimi varsaymakta serbest kalıyordu
 * ve `null`, `levels: [null]` ya da `rings: [null]` gelen bir dosyada TypeError'la
 * çöküyordu — yani koruma, var olma sebebi olan durumda kırılıyordu. Dosya diskten
 * ya da ağdan gelir; tipi derleyicinin verdiği söz değildir.
 */
export function validateTable(data: unknown): string[] {
  const err: string[] = [];
  if (!nesneMi(data)) return ["tablo bir JSON nesnesi değil"];
  if (data.v !== undefined && typeof data.v !== "string") err.push("sürüm damgası dize değil");
  if (!sayiMi(data.q3) || !sayiMi(data.q2)) err.push("q3/q2 sayı değil");
  else if (!(data.q3 > data.q2)) err.push("q3, q2 değerinden büyük olmalı");
  if (!Array.isArray(data.levels) || data.levels.length !== LEVEL_COUNT) {
    err.push(LEVEL_COUNT + " level olmalı");
    return err;
  }
  (data.levels as unknown[]).forEach((ham, i) => {
    const ad = "level " + (i + 1);
    if (!nesneMi(ham)) { err.push(ad + ": bir nesne değil"); return; }
    const l = ham as unknown as Level;
    if (l.n !== i + 1) err.push(ad + ": n alanı sırayla gitmiyor");
    if (!sayiMi(l.limit) || l.limit <= 0) err.push(ad + ": limit geçersiz");
    // Patron anahtarı tanınmıyorsa oyun o bölümde adsız kalırdı; şemada yakala.
    if (l.boss !== null && !(PATRON_ANAHTARLARI as readonly string[]).includes(l.boss)) {
      err.push(ad + ": bilinmeyen patron anahtarı " + JSON.stringify(l.boss));
    }
    if (bossMu(i + 1) !== (l.boss !== null)) err.push(ad + ": patron olup olmadığı " + BOSS_ARALIGI + " kuralıyla uyuşmuyor");
    if (!Array.isArray(l.rings) || l.rings.length < 2 || l.rings.length > 6) {
      err.push(ad + ": halka sayısı 2-6 dışında");
      return;
    }
    if (!l.rings.some(r => nesneMi(r) && !r.preLocked)) err.push(ad + ": tüm halkalar baştan kilitli");
    const gorulen = new Set<string>();
    (l.rings as unknown[]).forEach((hamHalka, k) => {
      const nerede = ad + " halka " + k + ": ";
      if (!nesneMi(hamHalka)) { err.push(nerede + "bir nesne değil"); return; }
      const kayit = hamHalka;
      const r = hamHalka as unknown as RingDef;
      let tipTamam = true;
      for (const [alan, tur] of RING_FIELDS) {
        const deger = kayit[alan];
        const uygun = tur === "number" ? sayiMi(deger) : typeof deger === tur;
        if (!uygun) { err.push(nerede + alan + " " + tur + " olmalı"); tipTamam = false; }
      }
      if (!tipTamam) return;
      if (r.gaps !== 1 && r.gaps !== 2) err.push(nerede + "gaps 1 veya 2 olmalı");
      if (r.gap < NEED / DEG || r.gap > GAP_MAX_DEG) err.push(nerede + "gap " + r.gap.toFixed(1) + " derece, sınırların dışında");
      if (r.start < 0 || r.start >= TAU) err.push(nerede + "start 0..2pi dışında");
      if (r.flip < 0) err.push(nerede + "flip negatif");
      // Birebir aynı iki halka ikinci kilidi bedava yapar (10. patronda böyle bir hata vardı).
      const anahtar = JSON.stringify(r);
      if (gorulen.has(anahtar)) err.push(nerede + "bir öncekiyle birebir aynı");
      gorulen.add(anahtar);
    });
  });
  return err;
}

/** Bir özelliğin patron olmayan ilk göründüğü level. Öğretici ipuçları bundan hesaplanır. */
export function firstSeen(levels: Level[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of levels) {
    if (l.boss) continue;
    const var_: Record<string, boolean> = {
      preLocked: l.rings.some(r => r.preLocked),
      gaps2: l.rings.some(r => r.gaps === 2),
      flip: l.rings.some(r => r.flip > 0),
      wobble: l.rings.some(r => r.wobble)
    };
    for (const k in var_) if (var_[k] && !(k in out)) out[k] = l.n;
  }
  return out;
}
