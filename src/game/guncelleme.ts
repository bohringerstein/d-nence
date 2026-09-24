// Yeni sürümü ne zaman uygulayacağımız.
//
// SORUN: `registerType: "autoUpdate"` ile üretilen `registerSW.js` YALNIZCA kaydediyor
// ("navigator.serviceWorker.register(...)") — başka hiçbir şey yapmıyor. Yeni servis
// çalışanı `skipWaiting` + `clientsClaim` ile devralıyor, ama **zaten çizilmiş sayfa
// eski varlıkları tutmaya devam ediyor**. Üstelik gezinme isteği önbellekteki
// `index.html`den karşılandığı için sıradan bir yenileme de eski sayfayı geri
// verebiliyor. Oyuncunun gördüğü: "güncelledik ama bende eski sürüm, sert yenileme
// yapmam gerekiyor."
//
// ÇÖZÜM: kaydı biz yapıyoruz (`registerType: "prompt"`), yeni sürüm hazır olduğunda
// bunu bir bayrağa yazıyoruz ve GÜVENLİ BİR ANDA uyguluyoruz. `uygula(true)` yeni
// servis çalışanına `skipWaiting` dedirtir ve sayfayı yeniler.
//
// Neden hemen değil: yenileme sayfayı baştan yükler. Oyun ortasında yapılırsa
// oyuncunun turu kesilir — en kötüsü de kilit basmak üzereyken. Güvenli anlar:
// bir bölüm kazanıldıktan sonra (sıradaki bölüm zaten yükleniyor) ve duraklatmadan
// dönerken. Oyuncu en geç bir bölüm sonra güncel olur ve hiçbir şey kaybetmez.
//
// Neden görünür bir "yeni sürüm var" düğmesi değil: tek dokunuşluk bir oyuna teknik
// bir kavram sokmak olurdu. Oyuncunun bir sürüm numarasıyla ilgilenmesi gerekmiyor.
import { registerSW } from "virtual:pwa-register";
import { kayitEskidiMi } from "./storage.ts";

let hazir = false;

/**
 * Yeni sürümü ne sıklıkla soracağız. Tarayıcı servis çalışanını yalnız gezinmede
 * denetler; ana ekrana eklenmiş oyun arka plandan dönünce sayfa yeniden YÜKLENMEZ,
 * yani oyuncu yeni sürümü günlerce almayabilirdi. Tablo değiştiğinde bu gecikme
 * oyuncunun eski tabloda rekor biriktirmesi demek.
 */
const YOKLAMA_MS = 60 * 60 * 1000;

const uygula = registerSW({
  immediate: true,
  onNeedRefresh() { hazir = true; },
  onRegisteredSW(_url, kayit) {
    if (!kayit) return;
    const sor = (): void => { if (navigator.onLine) void kayit.update().catch(() => { /* çevrimdışı */ }); };
    setInterval(sor, YOKLAMA_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sor(); });
  },
  // Kayıt başarısız olursa oyun çalışmaya devam eder; çevrimdışı desteği kaybolur,
  // o kadar. Sessiz kalmak doğru: oyuncunun yapabileceği bir şey yok.
  onRegisterError() { hazir = false; }
});

/** Yeni sürüm indirildi ve uygulanmayı bekliyor mu? */
export const guncellemeHazir = (): boolean => hazir || kayitEskidiMi();

/**
 * Yeni sürümü uygular. SAYFA YENİLENİR — yalnızca güvenli bir anda çağrılmalı.
 * Çağrıldıktan sonra bu karede başka iş yapılmamalı.
 */
export function guncellemeyiUygula(): void {
  if (hazir) {
    hazir = false;
    void uygula(true);
    return;
  }
  // Başka bir sekme yeni sürüme geçip kaydı yeni tabloya taşıdı (bkz. storage.ts
  // birlestirVeYaz). Yeni servis çalışanı o sekmede zaten devraldı; bekleyen işçi
  // olmadığı için `uygula(true)` hiçbir şey yapmaz. Düz yenileme yeni sürümü getirir.
  if (kayitEskidiMi()) location.reload();
}
