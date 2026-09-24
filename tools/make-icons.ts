// Uygulama simgelerini üretir. Kullanım: npm run icons
//
// Simge, oyunun kendi geometrisinden (src/core) türetilir: halkalar ve top aynı
// oranlarla çizilir, böylece simge ile oyun ekranı birbirinden kopamaz.
//
// Rasterleştirme elle yapılır (halka = merkeze uzaklık + açı testi) ve PNG doğrudan
// kodlanır. Böylece bir çizim kütüphanesine bağımlılık yok ve üretim deterministik.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { TAU, DEG, RATIO, norm } from "../src/core/index.ts";

const KOK = path.join(import.meta.dirname, "..");
const CIKTI = path.join(KOK, "public");

// ---- PNG kodlama -------------------------------------------------------------
const CRC_TABLO = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLO[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parca(tur: string, veri: Buffer): Buffer {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tur, "ascii"), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde));
  return Buffer.concat([uzunluk, govde, crc]);
}

/** RGBA piksel dizisini PNG'ye çevirir. */
function png(genislik: number, yukseklik: number, rgba: Uint8Array): Buffer {
  const imza = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(genislik, 0);
  ihdr.writeUInt32BE(yukseklik, 4);
  ihdr[8] = 8;    // bit derinliği
  ihdr[9] = 6;    // renk tipi: RGBA
  // 10,11,12 = sıkıştırma / filtre / geçiş: hepsi 0
  // Her satırın başına filtre baytı (0 = filtresiz)
  const ham = Buffer.alloc(yukseklik * (1 + genislik * 4));
  for (let y = 0; y < yukseklik; y++) {
    const hedef = y * (1 + genislik * 4);
    ham[hedef] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * genislik * 4, genislik * 4).copy(ham, hedef + 1);
  }
  return Buffer.concat([
    imza,
    parca("IHDR", ihdr),
    parca("IDAT", zlib.deflateSync(ham, { level: 9 })),
    parca("IEND", Buffer.alloc(0))
  ]);
}

// ---- Simge çizimi ------------------------------------------------------------
interface Renk { r: number; g: number; b: number }
const hex = (h: string): Renk => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16)
});

// Koyu zemin: hem açık hem koyu ana ekranda aynı okunur.
const ZEMIN = hex("#13232B");
const HALKA = hex("#DCE6EA");
const TOP = hex("#FFC93C");

/** Simgedeki halkalar: boşluk merkezi (rad) ve genişliği (derece). */
const HALKALAR = [
  { yaricap: RATIO.outer, bosluk: -55 * DEG, genislik: 62 },
  { yaricap: RATIO.outer - (RATIO.outer - RATIO.inner) / 2, bosluk: -35 * DEG, genislik: 54 },
  { yaricap: RATIO.inner, bosluk: -20 * DEG, genislik: 70 }
];

/**
 * @param boyut genişlik (piksel)
 * @param olcek içeriğin kapladığı oran (kısa kenara göre); maskable simgelerde güvenli
 *   alan için küçültülür
 * @param yukseklik verilmezse kare. Paylaşım önizlemesi ve iOS açılış görselleri dikdörtgen.
 */
function simgeCiz(boyut: number, olcek: number, yukseklik = boyut): Uint8Array {
  const AA = 3;                       // kenar yumuşatma için alt örnekleme
  const px = new Uint8Array(boyut * yukseklik * 4);
  const merkez = boyut / 2, merkezY = yukseklik / 2;
  const S = Math.min(boyut, yukseklik) * olcek;
  const cizgi = S * 0.075;            // halka kalınlığı
  // Oyundaki top oranı simgede çok küçük kalıyor (192 pikselde ~4 piksel yarıçap);
  // simge küçük boyutlarda da okunmalı, bu yüzden odak noktası büyütüldü.
  const topR = S * 0.115;

  for (let y = 0; y < yukseklik; y++) {
    for (let x = 0; x < boyut; x++) {
      let rT = 0, gT = 0, bT = 0;
      for (let ay = 0; ay < AA; ay++) {
        for (let ax = 0; ax < AA; ax++) {
          const px0 = x + (ax + 0.5) / AA - merkez;
          const py0 = y + (ay + 0.5) / AA - merkezY;
          const uzaklik = Math.hypot(px0, py0);
          const aci = Math.atan2(py0, px0);

          let renk: Renk = ZEMIN;
          if (uzaklik <= topR) renk = TOP;
          else {
            for (const h of HALKALAR) {
              const R = S * h.yaricap;
              if (Math.abs(uzaklik - R) > cizgi / 2) continue;
              // Boşluğun içinde mi? İçindeyse çizgi yok.
              if (Math.abs(norm(aci - h.bosluk)) <= h.genislik * DEG / 2) continue;
              renk = HALKA;
              break;
            }
          }
          rT += renk.r; gT += renk.g; bT += renk.b;
        }
      }
      const n = AA * AA, i = (y * boyut + x) * 4;
      px[i] = Math.round(rT / n);
      px[i + 1] = Math.round(gT / n);
      px[i + 2] = Math.round(bT / n);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** Tarayıcı sekmesi için ölçekten bağımsız simge; aynı geometriyi SVG olarak yazar. */
function simgeSvg(): string {
  const S = 100, m = 50;
  const yay = (R: number, bosluk: number, genislik: number): string => {
    const y = genislik * DEG / 2;
    const a0 = bosluk + y, a1 = bosluk + TAU - y;
    const x0 = m + R * Math.cos(a0), y0 = m + R * Math.sin(a0);
    const x1 = m + R * Math.cos(a1), y1 = m + R * Math.sin(a1);
    const buyuk = TAU - genislik * DEG > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R.toFixed(2)} ${R.toFixed(2)} 0 ${buyuk} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const yollar = HALKALAR
    .map(h => `<path d="${yay(S * h.yaricap, h.bosluk, h.genislik)}" fill="none" stroke="#DCE6EA" stroke-width="${(S * 0.075).toFixed(2)}" stroke-linecap="round"/>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="Dönence">
  <rect width="${S}" height="${S}" rx="${S * 0.22}" fill="#13232B"/>
  ${yollar}
  <circle cx="${m}" cy="${m}" r="${(S * 0.115 * 0.44).toFixed(2)}" fill="#FFC93C"/>
</svg>
`;
}

// ---- Üretim ------------------------------------------------------------------
fs.mkdirSync(CIKTI, { recursive: true });

const isler: Array<[string, number, number]> = [
  // [dosya, boyut, içerik ölçeği]
  ["icon-192.png", 192, 0.42],
  ["icon-512.png", 512, 0.42],
  // Maskable: güvenli alan simgenin ortadaki %80'i; içerik küçültülür ki kırpılmasın.
  ["icon-maskable-512.png", 512, 0.33],
  // iOS ana ekran simgesi
  ["apple-touch-icon.png", 180, 0.42]
];

for (const [ad, boyut, olcek] of isler) {
  const veri = png(boyut, boyut, simgeCiz(boyut, olcek));
  fs.writeFileSync(path.join(CIKTI, ad), veri);
  console.log(`${ad.padEnd(24)} ${boyut}×${boyut}  ${(veri.length / 1024).toFixed(1)} kB`);
}

// Paylaşım önizlemesi (Open Graph / Twitter): 1200×630, bağlantı WhatsApp, X, Telegram
// gibi yerlerde paylaşıldığında görünen görsel. Metin yok: başlık ve açıklama
// etiketlerden gelir ve iki dilde okunur; görselde yazı olsaydı tek dilde kalırdı.
{
  const [G, Y] = [1200, 630];
  const veri = png(G, Y, simgeCiz(G, 0.62, Y));
  fs.writeFileSync(path.join(CIKTI, "og.png"), veri);
  console.log(`${"og.png".padEnd(24)} ${G}×${Y}  ${(veri.length / 1024).toFixed(1)} kB`);
}

fs.writeFileSync(path.join(CIKTI, "icon.svg"), simgeSvg());
console.log("icon.svg".padEnd(24) + " ölçekten bağımsız");
