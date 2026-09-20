import { defineConfig } from "vite";

// Kasa, telefonda "ana ekrana ekle" ile kurulabilen bir web uygulaması olarak yayınlanır.
// Mağaza sürümü istenirse ileride Capacitor ile paketlenir; bu yüzden oyun kodu DOM'a
// bağımlı katmanlarla (src/game) çekirdek kurallardan (src/core) ayrı tutulur.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    assetsInlineLimit: 0
  },
  server: {
    // Telefondan aynı ağ üzerinden denemek için: npm run dev -- --host
    port: 5173,
    // Port doluysa Vite sessizce başka bir porta kayar ve elindeki adres tutmaz.
    // Tarayıcıyı kendisi açsın ki doğru adres her zaman açılan sekmede olsun.
    open: true
  }
});
