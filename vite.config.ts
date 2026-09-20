import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Dönence, telefonda "ana ekrana ekle" ile kurulabilen bir web uygulaması olarak yayınlanır.
// Mağaza sürümü istenirse ileride Capacitor ile paketlenir; bu yüzden oyun kodu DOM'a
// bağımlı katmanlarla (src/game) çekirdek kurallardan (src/core) ayrı tutulur.
export default defineConfig({
  // Göreli taban: oyun bir alan adının kökünde de, alt klasörde de aynı şekilde çalışır.
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
  },
  plugins: [
    VitePWA({
      // Yeni sürüm sessizce kurulur; oyuncuya "güncelle" diye sormaya gerek yok.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "Dönence",
        short_name: "Dönence",
        description: "Tek dokunuşla oynanan, level tabanlı bir kasa açma oyunu.",
        lang: "tr",
        dir: "ltr",
        start_url: ".",
        scope: ".",
        display: "standalone",
        // Oyun dikey düzen için tasarlandı (şartname 7. bölüm).
        orientation: "portrait",
        // Açılış ekranı simgeyle aynı koyu zemini kullanır ki geçiş sıçramasın.
        background_color: "#13232B",
        theme_color: "#13232B",
        categories: ["games", "puzzle"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          // maskable: Android simgeyi kendi şekline kırpar; güvenli alan için içerik küçük.
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,json,webmanifest,woff2}"],
        // 1000 bölümlük tablo 643 KB; varsayılan 2 MB sınırı yeter ama açıkça yazalım.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Oyun tamamen statik: her şey önbelleğe alınır, çevrimdışı tam çalışır.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Fredoka Google Fonts'tan geliyor; çevrimdışıyken de doğru yazı tipi görünsün.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stil" }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-dosya",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        // Geliştirme sırasında servis çalışanı kapalı kalsın: önbellek, değişiklikleri gizler.
        enabled: false
      }
    })
  ]
});
