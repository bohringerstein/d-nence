// Tablo dosyasının biçimi ve damgası. `gen.ts`'ten ayrıldı çünkü `gen.ts` bir betiktir:
// içe aktarıldığında tabloyu yeniden üretiyordu. Damgayı sınamak isteyen her test ya da
// betik 35 dakikalık bir üretim başlatıp `data/levels.json`'u ezecekti.
import crypto from "node:crypto";
import type { LevelTable } from "../../src/core/index.ts";

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
export const damga = (o: LevelTable): string =>
  crypto.createHash("sha256")
    .update(o.q3 + "|" + o.q2 + "|" + o.levels.map(l => JSON.stringify(l)).join(""))
    .digest("hex").slice(0, 12);

// data/levels.json biçimi: her level tek satır, okunabilir kalsın diye elle diziliyor.
export const serialize = (o: LevelTable): string =>
  '{"v":"' + damga(o) + '","q3":' + o.q3 + ',"q2":' + o.q2 + ',"levels":[\n' +
  o.levels.map(l => JSON.stringify(l)).join(',\n') + '\n]}\n';
