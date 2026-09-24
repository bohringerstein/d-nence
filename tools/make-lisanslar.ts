// public/lisanslar.html üretir: oyunla birlikte dağıtılan üçüncü taraf bileşenlerin
// lisans metinleri. Kaynak `licenses/` klasörü; sayfa elle düzenlenmez (`npm run lisanslar`).
//
// Neden: Fredoka (SIL OFL 1.1) ve Workbox (MIT) derleme çıktısına giriyor. İkisi de lisans
// metninin dağıtımla birlikte verilmesini istiyor; metin depoda vardı ama siteye hiç
// yüklenmiyordu. Mağazalar da uygulama içinde açık kaynak bildirimini bekler.
import fs from "node:fs";
import path from "node:path";

const kok = path.join(import.meta.dirname, "..");
const LISANSLAR: Array<{ ad: string; nerede: string; lisans: string; dosya: string }> = [
  { ad: "Fredoka", nerede: "Yazı tipi / Typeface", lisans: "SIL Open Font License 1.1", dosya: "Fredoka-OFL.txt" },
  { ad: "Workbox", nerede: "Çevrimdışı çalışma / Offline support", lisans: "MIT", dosya: "Workbox-MIT.txt" }
];

const kacir = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function lisansSayfasi(): string {
  const bolumler = LISANSLAR.map(l => {
    const metin = fs.readFileSync(path.join(kok, "licenses", l.dosya), "utf8");
    return `<section>
<h2>${l.ad}</h2>
<p class="tarih">${l.nerede} · ${l.lisans}</p>
<pre>${kacir(metin.trim())}</pre>
</section>`;
  }).join("\n\n");
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dönence — Lisanslar / Licences</title>
<link rel="icon" href="./icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="./gizlilik.css">
</head>
<body>
<main>
<p class="geri"><a href="./">&larr; Oyuna dön / Back to the game</a></p>
<h1>Dönence</h1>
<p class="tarih">Açık kaynak lisansları · Open-source licences</p>
<!-- Bu dosya tools/make-lisanslar.ts ile üretilir; elle düzenlenmez. -->

${bolumler}
</main>
</body>
</html>
`;
}

if (import.meta.main) {
  const cikti = path.join(kok, "public", "lisanslar.html");
  fs.writeFileSync(cikti, lisansSayfasi());
  console.log("public/lisanslar.html yazıldı");
}
