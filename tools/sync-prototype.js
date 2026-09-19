// reference/kasa.html tek dosya olmak zorunda (çift tıklayıp açılabilsin diye), ama içindeki
// çekirdek kod ve level tablosu kopya olmamalı. Bu betik ikisini de kaynaklarından enjekte eder.
//   node tools/sync-prototype.js          -> prototipi günceller
//   node tools/sync-prototype.js --check  -> güncel mi diye bakar, değilse 1 koduyla çıkar
const fs = require("fs"), path = require("path");
const kok = path.join(__dirname, "..");
const HTML = path.join(kok, "reference", "kasa.html");

const blok = (s, bas, son, icerik) => {
  const i = s.indexOf(bas), j = s.indexOf(son, i);
  if (i < 0 || j < 0) throw new Error(`işaretçi bulunamadı: ${bas}`);
  return s.slice(0, i + bas.length) + "\n" + icerik + "\n" + s.slice(j);
};

const core = fs.readFileSync(path.join(kok, "tools", "core.js"), "utf8")
  .replace(/\nconst API = \{[\s\S]*$/, "\n")                    // tarayıcıda export'a gerek yok
  .replace(/^\/\/ node --test[\s\S]*?\n/, "")
  .trimEnd();
const levels = fs.readFileSync(path.join(kok, "data", "levels.json"), "utf8").trim();

let html = fs.readFileSync(HTML, "utf8");
const yeni = blok(
  blok(html, "// >>> core.js (tools/sync-prototype.js ile gömülür, elle düzenleme)", "// <<< core.js", core),
  "window.KASA_LEVELS =", "</script>", levels + ";");

if (process.argv.includes("--check")) {
  if (yeni !== html) { console.error("reference/kasa.html güncel değil. Çalıştır: node tools/sync-prototype.js"); process.exit(1); }
  console.log("reference/kasa.html güncel"); process.exit(0);
}
fs.writeFileSync(HTML, yeni);
console.log("reference/kasa.html güncellendi (çekirdek + " + JSON.parse(levels).levels.length + " level)");
