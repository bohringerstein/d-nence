// Tema renkleri: CSS gecikirse oyun siyah beyaz çizilmemeli.
//
// Regresyon: telefonda tüm oyun siyah beyaz göründü. Sebep, canvas'ta
// `ctx.fillStyle = ""` hata vermeyip SESSİZCE yok sayılması ve önceki değerin
// (varsayılan siyah) kalmasıydı. Renkler modül yüklenirken bir kez okunuyordu;
// geliştirme sunucusunda CSS ayrı bir istekle geldiği için yavaş bağlantıda o
// okuma boş dönüyor ve oturum boyunca siyah kalıyordu.
import test from "node:test";
import assert from "node:assert";

/** styles.css uygulanmış/uygulanmamış bir belgeyi taklit eder. */
function sahneKur(degerler: Record<string, string>, tema: string | null = null): void {
  const kok = {
    getAttribute: (ad: string) => (ad === "data-theme" ? tema : null)
  };
  Object.defineProperty(globalThis, "document", {
    value: { documentElement: kok },
    configurable: true
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    value: () => ({ getPropertyValue: (ad: string) => degerler[ad] ?? "" }),
    configurable: true
  });
}

function medya(koyu: boolean): void {
  Object.defineProperty(globalThis, "window", {
    value: { matchMedia: (q: string) => ({ matches: koyu && q.includes("dark") }) },
    configurable: true
  });
}

const CSS_ACIK = {
  "--bg": "#E9EEF0", "--ink": "#1D3440", "--ball": "#E89B00",
  "--fail": "#E5484D", "--win": "#2E9E6A", "--muted": "#5A6E79"
};

const { renkleriOku, renklerHazir } = await import("./theme.ts");
const ANAHTARLAR = ["bg", "ink", "ball", "fail", "win", "muted"] as const;

test("CSS hazırken gerçek değerler okunur", () => {
  medya(false); sahneKur(CSS_ACIK);
  const r = renkleriOku();
  assert.equal(r.ink, "#1D3440");
  assert.equal(r.ball, "#E89B00");
  assert.ok(renklerHazir());
});

test("CSS henüz gelmediyse hiçbir renk boş kalmaz", () => {
  medya(false); sahneKur({});
  const r = renkleriOku();
  for (const k of ANAHTARLAR) {
    assert.ok(r[k].length > 0, `--${k} boş döndü; canvas bunu sessizce yok sayıp siyah çizer`);
    assert.match(r[k], /^#[0-9A-Fa-f]{6}$/, `--${k} geçerli bir renk olmalı, "${r[k]}" geldi`);
  }
  assert.ok(!renklerHazir(), "CSS yokken hazır denmemeli");
});

test("CSS gelmediyse sistem temasına uygun yedek seçilir", () => {
  medya(true); sahneKur({});
  const koyu = renkleriOku();
  medya(false); sahneKur({});
  const acik = renkleriOku();
  assert.notEqual(koyu.bg, acik.bg, "koyu ve açık yedek farklı olmalı");
  assert.equal(koyu.bg, "#13232B");
  assert.equal(acik.bg, "#E9EEF0");
});

test("data-theme sistem tercihini ezer", () => {
  medya(false); sahneKur({}, "dark");
  assert.equal(renkleriOku().bg, "#13232B", "data-theme=dark koyu yedeği seçmeli");
  medya(true); sahneKur({}, "light");
  assert.equal(renkleriOku().bg, "#E9EEF0", "data-theme=light açık yedeği seçmeli");
});

test("kısmen gelen CSS'te eksik olanlar yedekten tamamlanır", () => {
  medya(false); sahneKur({ "--bg": "#E9EEF0", "--ink": "#1D3440" });
  const r = renkleriOku();
  assert.equal(r.ink, "#1D3440", "gelen değer korunmalı");
  assert.equal(r.ball, "#E89B00", "eksik olan yedekten gelmeli");
  assert.ok(r.fail.length > 0);
});

test("transparent geçerli sayılmaz", () => {
  medya(false); sahneKur({ ...CSS_ACIK, "--ball": "transparent" });
  assert.equal(renkleriOku().ball, "#E89B00", "transparent top rengi görünmez yapardı");
});

test("yedek palet styles.css ile aynı", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const css = fs.readFileSync(path.join(import.meta.dirname, "..", "styles.css"), "utf8");
  const blok = (bas: string): Record<string, string> => {
    const i = css.indexOf(bas);
    const govde = css.slice(i, css.indexOf("}", i));
    const o: Record<string, string> = {};
    for (const m of govde.matchAll(/--([a-z]+):\s*(#[0-9A-Fa-f]{6})/g)) o[m[1]] = m[2];
    return o;
  };
  const acikCss = blok(":root {");
  const koyuCss = blok(':root[data-theme="dark"]');

  medya(false); sahneKur({});
  const acikYedek = renkleriOku();
  medya(true); sahneKur({});
  const koyuYedek = renkleriOku();

  for (const k of ANAHTARLAR) {
    assert.equal(acikYedek[k].toUpperCase(), acikCss[k].toUpperCase(), `açık tema --${k} yedeği CSS'ten farklı`);
    assert.equal(koyuYedek[k].toUpperCase(), koyuCss[k].toUpperCase(), `koyu tema --${k} yedeği CSS'ten farklı`);
  }
});
