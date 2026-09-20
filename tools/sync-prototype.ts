// reference/donence.html tek dosya olmak zorunda (çift tıklayıp açılabilsin diye), ama içindeki
// çekirdek kod ve level tablosu kopya olmamalı. Bu betik ikisini de kaynaklarından enjekte eder:
// çekirdek src/core/ dizininden esbuild ile paketlenir, tablo data/levels.json'dan okunur.
//
//   npm run sync                         -> prototipi günceller
//   node tools/sync-prototype.ts --check -> güncel mi diye bakar, değilse 1 koduyla çıkar
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import * as core from "../src/core/index.ts";

const kok = path.join(import.meta.dirname, "..");
const HTML = path.join(kok, "reference", "donence.html");
const CORE_BAS = "// >>> core.js (tools/sync-prototype.ts ile gömülür, elle düzenleme)";
const CORE_SON = "// <<< core.js";

function blok(s: string, bas: string, son: string, icerik: string): string {
  const i = s.indexOf(bas), j = s.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error("işaretçi bulunamadı: " + bas);
  return s.slice(0, i + bas.length) + "\n" + icerik + "\n" + s.slice(j);
}

async function bundleCore(): Promise<string> {
  const r = await build({
    entryPoints: [path.join(kok, "src", "core", "index.ts")],
    bundle: true,
    format: "iife",
    globalName: "DonenceCore",
    target: "es2022",
    charset: "utf8",
    write: false,
    logLevel: "silent"
  });
  const js = r.outputFiles[0].text.trimEnd();
  // Prototipin oyun kodu çıplak isimler kullanır (TAU, newMask, ...): paketin dışa açtıklarını
  // aynı isimlerle tanımla. Liste modülün kendisinden okunur, elle tutulmaz.
  const isimler = Object.keys(core).sort();
  const dagit = "const { " + isimler.join(", ") + " } = DonenceCore;";
  return js + "\n" + dagit;
}

const levels = fs.readFileSync(path.join(kok, "data", "levels.json"), "utf8").trim();
const html = fs.readFileSync(HTML, "utf8");
const yeni = blok(
  blok(html, CORE_BAS, CORE_SON, await bundleCore()),
  "window.KASA_LEVELS =", "</script>", levels + ";");

if (process.argv.includes("--check")) {
  if (yeni !== html) {
    console.error("reference/donence.html güncel değil. Çalıştır: npm run sync");
    process.exit(1);
  }
  console.log("reference/donence.html güncel");
} else {
  fs.writeFileSync(HTML, yeni);
  const n = (JSON.parse(levels) as { levels: unknown[] }).levels.length;
  console.log("reference/donence.html güncellendi (çekirdek + " + n + " level)");
}
