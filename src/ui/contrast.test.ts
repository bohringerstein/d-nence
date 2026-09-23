// Tema okunabilirliği (şartname 10. bölüm: "Açık ve koyu temada tüm öğeler okunabilir").
// Göz kararıyla değil, WCAG 2.1 kontrast oranıyla ölçülür.
//
// Renkler src/styles.css içinde tanımlıdır; bu test onları dosyadan okur, böylece
// CSS'te bir renk değişirse test de onu görür (kopya tutulmaz).
import test from "node:test";
import assert from "node:assert";
import { kuralGovdesi } from "./cssOku.ts";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(import.meta.dirname, "..", "styles.css"), "utf8");

/** styles.css içindeki bir blokta tanımlı --değişkenleri toplar. */
function blokRenkleri(baslangic: string): Record<string, string> {
  const govde = kuralGovdesi(baslangic.replace(" {", ""));
  const out: Record<string, string> = {};
  // Tire de kabul edilir: --ui-accent gibi çok parçalı adlar atlanmasın.
  for (const m of govde.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}

const acik = blokRenkleri(":root {");
const koyu = blokRenkleri(':root[data-theme="dark"]');

const kanal = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

function parlaklik(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = kanal((n >> 16) & 255), g = kanal((n >> 8) & 255), b = kanal(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const la = parlaklik(a), lb = parlaklik(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Canvas'ta saydamlıkla çizilen öğenin arka planla harmanlanmış hali. */
function harmanla(on: string, arka: string, alfa: number): string {
  const o = parseInt(on.slice(1), 16), a = parseInt(arka.slice(1), 16);
  const k = (kaydir: number): number =>
    Math.round((((o >> kaydir) & 255) * alfa) + (((a >> kaydir) & 255) * (1 - alfa)));
  return "#" + [16, 8, 0].map(s => k(s).toString(16).padStart(2, "0")).join("");
}

const temalar: Array<[string, Record<string, string>]> = [["açık", acik], ["koyu", koyu]];

test("CSS'te iki tema da tam renk kümesi tanımlıyor", () => {
  for (const [ad, t] of temalar) {
    for (const k of ["bg", "ink", "ball", "fail", "win", "muted", "track", "ui-accent"]) {
      assert.ok(t[k], `${ad} temada --${k} eksik`);
    }
  }
});

test("metin renkleri arka planda okunabilir (WCAG AA, 4.5:1)", () => {
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    // ink: başlık ve level numarası. muted: alt çubuk ve düğme, küçük punto.
    for (const k of ["ink", "muted"]) {
      const o = kontrast(t[k], t.bg);
      if (o < 4.5) sorun.push(`${ad} tema: --${k} / --bg = ${o.toFixed(2)}:1 (en az 4,5 gerek)`);
    }
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("sayaç rengi büyük punto eşiğini geçiyor (3:1)", () => {
  // fail: kalan süre azalınca sayaç kırmızıya döner (1,9rem, kalın = büyük punto).
  //
  // --ball ve --win bu ölçüte dahil DEĞİL, çünkü ikisi de okunacak metin taşımıyor:
  //   --ball  açık temada 1,97:1. Yalnızca canvas'ta kullanılır (top, sıradaki halka,
  //           geçer kama); ikisi de ince koyu kenarla ya da haleyle çizilir, şekil
  //           renkten bağımsız okunur. Oyunun imza rengi olduğu için koyultulmadı.
  //           Arayüz öğelerinde kullanılmadığı ayrıca sınanıyor (aşağıda).
  //   --win   yalnızca başarı flaşında ve %18 opaklıkla kullanılıyor; okunacak bir
  //           öğe değil, kısa süreli bir geri bildirim.
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const o = kontrast(t.fail, t.bg);
    if (o < 3) sorun.push(`${ad} tema: --fail / --bg = ${o.toFixed(2)}:1 (en az 3 gerek)`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("süre çubuğu arka plandan ayırt edilebiliyor", () => {
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const oluk = kontrast(t.track, t.bg);
    // Eşik 1,2 iken koyu temadaki 1,28 geçiyordu ama boş çubuk fiilen görünmüyordu:
    // CSS'teki yorum açık temayı bilerek 1,42'ye çekmiş, koyu temayı atlamıştı.
    if (oluk < 1.35) sorun.push(`${ad} tema: --track / --bg = ${oluk.toFixed(2)}:1, oluk görünmüyor`);
    const dolu = kontrast(t.ink, t.track);
    if (dolu < 3) sorun.push(`${ad} tema: --ink / --track = ${dolu.toFixed(2)}:1, dolu kısım seçilmiyor`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("halkalar arka plandan ayırt edilebiliyor (en soluk halka dahil)", () => {
  // Kilitsiz halkalar %40 opaklıkla çizilir; en soluk öğe budur.
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const soluk = harmanla(t.ink, t.bg, 0.4);
    const o = kontrast(soluk, t.bg);
    if (o < 1.5) sorun.push(`${ad} tema: %40 opak halka / --bg = ${o.toFixed(2)}:1, görünmüyor`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

/** render.ts'teki geçer kama opaklığı. Geçmez kama doldurulmaz. */
const KAMA_OPAKLIK = 0.35;

test("geçer ve geçmez kama birbirinden ayırt edilebiliyor", () => {
  // Eskiden ikisi de dolduruluyordu (sarı %22, kırmızı %15). Açık temada zemine göre
  // 1,17 ve 1,20 çıkıyorlardı, yani aralarındaki fark 1,03:1 idi: fiilen ayırt
  // edilemiyorlardı ve "geçer mi" bilgisi tamamen renk tonuna kalıyordu.
  //
  // Artık ayrım DOLGU VAR/YOK: geçmez kama boş bırakılıp yalnızca kesik konturla
  // çevriliyor (render.ts). Ayrım hem parlaklığa hem doluluğa bağlı, yani renkten
  // bağımsız iki kanal taşıyor. Geçmez kamanın rengi çıplak zemindir.
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const gecer = harmanla(t.ball, t.bg, KAMA_OPAKLIK);
    const ayrim = kontrast(gecer, t.bg);
    if (ayrim < 1.2) {
      sorun.push(`${ad} tema: geçer/geçmez kama ayrımı ${ayrim.toFixed(2)}:1 (en az 1,2 gerek)`);
    }
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("arayüz vurgusu metin dışı kontrast eşiğini geçiyor (3:1)", () => {
  // --ui-accent onay kutusunun işaretli/işaretsiz farkını taşır. Bu daha önce --ball idi
  // ve açık temada 1,97:1 veriyordu: "deseni yumuşat" ayarının durumu, tam da o ayara
  // ihtiyacı olan kişi için okunmuyordu.
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const o = kontrast(t["ui-accent"], t.bg);
    if (o < 3) sorun.push(`${ad} tema: --ui-accent / --bg = ${o.toFixed(2)}:1 (en az 3 gerek)`);
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});

test("amber arayüz öğelerinde kullanılmıyor", () => {
  // --ball canvas'ta kalır (top, sıradaki halka, geçer kama): orada şekil, kalınlık ve
  // koyu hale ikinci kanalı taşır. Ama metin rengi, odak halkası ve accent-color'da tek
  // kanal renktir ve açık temada 1,97:1 okunmaz. Bu test o ayrımın geri kaymasını
  // engeller; dekoratif kullanımlar (border gibi) kapsam dışıdır.
  const yasak = new RegExp(
    "(^|[;{\\s])(color|accent-color|outline)\\s*:\\s*[^;}]*var\\(--ball\\)", "g");
  const bulunan = [...css.matchAll(yasak)].map(m => m[0].trim());
  assert.deepEqual(bulunan, [], "arayüzde var(--ball): " + bulunan.join(" | "));
});

test("duraklatma simgesi arayüz bileşeni eşiğini geçiyor (3:1)", () => {
  // Sayaç `border:none; background:none` ile çiziliyor; bu iki çubuk onun bir DENETİM
  // olduğunu söyleyen tek görsel işaret (SC 1.4.11 Metin Dışı Kontrast). Eskiden
  // `currentColor` + `opacity:0.5` ile çiziliyordu ve açık temada 2,78:1 ölçülüyordu.
  // Opaklık kanalı bilerek terk edildi: değeri arkasındaki her neyse onunla harmanlanır,
  // yani kararsızdır ve teste bağlanamaz. Token kararlıdır.
  // kuralGovdesi yorumları zaten eliyor: kuralın NEDEN böyle olduğunu anlatan yorum,
  // kuralın kendisi sanılmasın. (Bu testin ilk hâli tam olarak buna takıldı.)
  const blok = kuralGovdesi(".duraklatIm");
  assert.ok(!/opacity/.test(blok), "opaklık kanalı kullanılmamalı: değeri kararsız ve ölçülemez");
  assert.ok(/border-left:[^;]*var\(--muted\)/.test(blok), "simge --muted token'ını kullanmalı");
  for (const [ad, t] of temalar) {
    const o = kontrast(t.muted, t.bg);
    assert.ok(o >= 3, `${ad} temada duraklatma simgesi ${o.toFixed(2)}:1, 3:1 gerek`);
  }
});
