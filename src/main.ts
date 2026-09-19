// Uygulamanın giriş noktası. Oyun ekranı 2. aşamada buraya bağlanacak.
// Şimdilik iskeletin ayakta olduğunu ve çekirdeğin tarayıcıda yüklendiğini gösterir.
import { NEED, NEED_PASS, DEG, BINS, validateTable } from "./core/index.ts";
import type { LevelTable } from "./core/index.ts";
import tablo from "../data/levels.json";

const data = tablo as LevelTable;
const hatalar = validateTable(data);

const app = document.getElementById("app");
if (app) {
  const satir = (k: string, v: string) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  app.innerHTML = `
    <main>
      <h1>Kasa</h1>
      <p class="durum">İskelet ayakta. Oyun ekranı 2. aşamada gelecek.</p>
      <table>
        ${satir("Level sayısı", String(data.levels.length))}
        ${satir("Yıldız eşikleri", `q3 = ${data.q3}, q2 = ${data.q2}`)}
        ${satir("Gereken açıklık", `${(NEED / DEG).toFixed(3)}°`)}
        ${satir("Geçiş eşiği", `${(NEED_PASS / DEG).toFixed(1)}° (${BINS} dilim)`)}
        ${satir("Tablo doğrulaması", hatalar.length ? `${hatalar.length} sorun` : "sağlam")}
      </table>
      ${hatalar.length ? `<ul class="hata">${hatalar.map(h => `<li>${h}</li>`).join("")}</ul>` : ""}
    </main>`;
}
