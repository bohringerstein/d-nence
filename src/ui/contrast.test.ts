// Tema okunabilirliği (şartname 10. bölüm: "Açık ve koyu temada tüm öğeler okunabilir").
// Göz kararıyla değil, WCAG 2.1 kontrast oranıyla ölçülür.
//
// Renkler src/styles.css içinde tanımlıdır; bu test onları dosyadan okur, böylece
// CSS'te bir renk değişirse test de onu görür (kopya tutulmaz).
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(import.meta.dirname, "..", "styles.css"), "utf8");

/** styles.css içindeki bir blokta tanımlı --değişkenleri toplar. */
function blokRenkleri(baslangic: string): Record<string, string> {
  const i = css.indexOf(baslangic);
  assert.ok(i >= 0, "CSS bloğu bulunamadı: " + baslangic);
  const govde = css.slice(i, css.indexOf("}", i));
  const out: Record<string, string> = {};
  for (const m of govde.matchAll(/--([a-z]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
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
    for (const k of ["bg", "ink", "ball", "fail", "win", "muted", "track"]) {
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
  // fail: kalan süre azalınca sayaç kırmızıya döner (1,5rem, kalın = büyük punto).
  //
  // --ball ve --win bu ölçüte dahil DEĞİL, çünkü ikisi de okunacak metin taşımıyor:
  //   --ball  açık temada 1,97:1. Top ve sıradaki halka; ikisi de artık ince koyu
  //           kenarla çiziliyor (render.ts), şekil renkten bağımsız okunuyor.
  //           Oyunun imza rengi olduğu için koyultulmadı.
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
    if (oluk < 1.2) sorun.push(`${ad} tema: --track / --bg = ${oluk.toFixed(2)}:1, oluk görünmüyor`);
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

test("açıklık kamaları birbirinden ayırt edilebiliyor", () => {
  // Yeterli kama sarı %22, yetersiz kama kırmızı %15 opaklıkla çizilir.
  // Renk körlüğü için kesik kontur da var (render.ts), ama kamalar yine de
  // birbirinden ve arka plandan ayrılmalı.
  const sorun: string[] = [];
  for (const [ad, t] of temalar) {
    const genis = harmanla(t.ball, t.bg, 0.22);
    const dar = harmanla(t.fail, t.bg, 0.15);
    if (kontrast(genis, t.bg) < 1.1) sorun.push(`${ad} tema: sarı kama arka planda kayboluyor`);
    if (kontrast(dar, t.bg) < 1.05) sorun.push(`${ad} tema: kırmızı kama arka planda kayboluyor`);
    // İki kamanın birbirinden RENKLE ayrılması beklenmiyor: ikisi de düşük opaklıkta
    // yıkama ve açık temada 1,03:1 kalıyorlar. Ayrım kesik konturla yapılıyor
    // (render.ts), ki renk körlüğü için zaten doğru çözüm bu.
  }
  assert.deepEqual(sorun, [], sorun.join("; "));
});
