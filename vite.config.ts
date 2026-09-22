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
      // "autoUpdate" DEĞİL. O mod yalnızca bir kayıt satırı üretiyordu ve sayfayı hiç
      // yenilemiyordu: yeni servis çalışanı devralıyor ama açık sayfa eski varlıkları
      // tutmaya devam ediyordu — oyuncu "sert yenileme" yapmadan yeni sürümü hiç
      // görmüyordu. "prompt" ile kaydı biz yapıyoruz ve yenilemeyi GÜVENLİ BİR ANDA
      // kendimiz tetikliyoruz (bkz. src/game/guncelleme.ts). Oyuncuya soru sorulmuyor.
      registerType: "prompt",
      // Kaydı src/game/guncelleme.ts yapıyor; eklentinin kendi betiği gerekmez.
      injectRegister: false,
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      manifest: {
        // id BUGÜN örtük olarak start_url'den ("/") türetiliyor; açıkça yazmak
        // davranışı hiç değiştirmiyor ama yarın base ya da start_url değiştirilirse
        // kurulu uygulamaların kopmasını önlüyor. Kurulu kitle büyümeden yazılmalı:
        // sonradan FARKLI bir değer vermek kurulu uygulamaları ikiye böler.
        id: "/",
        name: "Dönence",
        short_name: "Dönence",
        description: "A one-tap vault-cracking game: lock the spinning rings and keep the ball a way out.",
        lang: "en",
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
        // 1000 bölümlük tablo 643 KB. Sınır 1 MB: tablo sessizce şişerse derleme
        // uyarı versin. 4 MB "geniş" bir ayardı, doğru bir ayar değil.
        maximumFileSizeToCacheInBytes: 1024 * 1024,
        // Oyun tamamen statik: her şey önbelleğe alınır, çevrimdışı tam çalışır.
        cleanupOutdatedCaches: true
        // runtimeCaching YOK ve olmamalı: oyun hiçbir dış adrese istek atmaz.
        // Yazı tipi projeye gömülü (src/fonts/), tablo kendi dosyamız. Buraya bir
        // kural eklemek, gizlilik politikasının "başka hiçbir alan adına istek
        // atılmaz" cümlesini çürütmek demektir (public/gizlilik.html).
      },
      devOptions: {
        // Geliştirme sırasında servis çalışanı kapalı kalsın: önbellek, değişiklikleri gizler.
        enabled: false
      }
    })
  ]
});
