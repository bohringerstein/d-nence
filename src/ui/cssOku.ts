// styles.css'i testlerden okumak için tek yardımcı.
//
// Altı test dosyasında birbirinden hafifçe farklı altı kopya vardı ve hepsi aynı iki
// tuzağa açıktı: (1) ilk `}`'de duruyorlardı, yani `@media` içinde yuvalanmış bir
// kural okunursa yanlış metin dönüyordu; (2) yorumları elemiyorlardı, yani bir
// kuralın NEDEN böyle olduğunu anlatan yorum, kuralın kendisi sanılabiliyordu —
// bu tuzak bu projede gerçekten iki kez ısırdı.
//
// Yalnızca testler içe aktarır; üretim paketine girmez.
import fs from "node:fs";
import path from "node:path";

export const CSS: string = fs.readFileSync(
  path.join(import.meta.dirname, "..", "styles.css"), "utf8");

/** CSS yorumlarını eler. */
export const yorumsuz = (metin: string): string => metin.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Verilen seçicinin kural gövdesi (yorumsuz). Seçici bulunamazsa hata fırlatır —
 * sessizce boş dize dönmek, testin yanlış sebepten geçmesine yol açardı.
 */
export function kuralGovdesi(secici: string, kaynak = CSS): string {
  const i = kaynak.indexOf(secici + " {");
  if (i < 0) throw new Error("CSS kuralı yok: " + secici);
  const bas = kaynak.indexOf("{", i) + 1;
  // Yuvalanmayı say: `@media` içindeki bir kuralın ilk `}`'i onun kendi kapanışı değil.
  let derinlik = 1, j = bas;
  while (j < kaynak.length && derinlik > 0) {
    if (kaynak[j] === "{") derinlik++;
    else if (kaynak[j] === "}") derinlik--;
    j++;
  }
  return yorumsuz(kaynak.slice(bas, j - 1));
}

/** Bir kuraldaki bildirimleri `{ özellik: değer }` olarak döner. */
export function bildirimler(secici: string, kaynak = CSS): Record<string, string> {
  const out: Record<string, string> = {};
  for (const parca of kuralGovdesi(secici, kaynak).split(";")) {
    const k = parca.indexOf(":");
    if (k > 0) out[parca.slice(0, k).trim()] = parca.slice(k + 1).trim();
  }
  return out;
}
