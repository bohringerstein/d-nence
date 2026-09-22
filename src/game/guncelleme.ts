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

let hazir = false;

const uygula = registerSW({
  immediate: true,
  onNeedRefresh() { hazir = true; },
  // Kayıt başarısız olursa oyun çalışmaya devam eder; çevrimdışı desteği kaybolur,
  // o kadar. Sessiz kalmak doğru: oyuncunun yapabileceği bir şey yok.
  onRegisterError() { hazir = false; }
});

/** Yeni sürüm indirildi ve uygulanmayı bekliyor mu? */
export const guncellemeHazir = (): boolean => hazir;

/**
 * Yeni sürümü uygular. SAYFA YENİLENİR — yalnızca güvenli bir anda çağrılmalı.
 * Çağrıldıktan sonra bu karede başka iş yapılmamalı.
 */
export function guncellemeyiUygula(): void {
  if (!hazir) return;
  hazir = false;
  void uygula(true);
}
