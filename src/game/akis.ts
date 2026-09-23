// Akış kararları: "şimdi ne olmalı" sorusunun cevapları.
//
// Neden ayrı bir dosya: bu kararların hepsi `src/main.ts` içinde, olay dinleyicilerinin
// gövdesinde yaşıyordu ve main.ts test edilemiyor (en üst düzeyde `await fetch` var,
// `?url` soneki Vite'a özgü, `styles.css` içe aktarılıyor). Sonuç olarak oyunun en
// ağır hataları — bitiş ekranının ilerlemeyi silmesi, onay metninin yanlış bölümü
// söylemesi, eski bir bölümü bitirmenin devam noktasını yok etmesi — hiçbir testin
// göremediği yerde duruyordu. Kararlar saf fonksiyonlara çıkınca sınanabilir oldu.
//
// Buraya YALNIZCA karar giriyor; DOM, zamanlayıcı ve yan etki main.ts'te kalıyor.
import { LEVEL_COUNT } from "../core/index.ts";
import type { Kayit } from "./storage.ts";

/**
 * Uygulama açılınca hangi bölüm yüklenir?
 *
 * `enUzak`, `level` DEĞİL. Bölüm seçimi eklendiğinde şu oluyordu: 412. bölümdeki
 * oyuncu 5. bölüme dönüp kazanınca oyun 6'ya geçiyor ve `level` de 6 oluyordu;
 * ertesi gün uygulama Level 6 ile açılıyordu. İlerleme silinmiş değildi ama devam
 * noktası yoktu. `enUzak` "ulaşılan en uzak bölüm" demek ve tam da çıpa olması
 * gereken şey bu. "Baştan başla" sonrası `enUzak = 1` olduğu için o yol da doğru.
 *
 * Kabul edilen bedel: tekrar oynamanın ortasında uygulamayı kapatan oyuncu, döndüğünde
 * o bölümde değil sınırda olur. Bölüm seçimi bir dokunuş ötede.
 */
export const acilisBolumu = (k: Kayit): number =>
  Math.min(LEVEL_COUNT, Math.max(1, k.enUzak));

/**
 * "Baştan başla" onayının söylemesi gereken bölüm numarası.
 *
 * Kaybedilecek olan `enUzak`tır, OYNANAN bölüm değil. Bölüm seçiminden 5. bölüme
 * dönmüş 412'lik bir oyuncu "Emin misin? Level 5 kaybolur" görüyordu ve "5'i zaten
 * tekrar oynuyordum" deyip onaylıyordu. İki aşamalı onayın tek işi doğru bilgi
 * vermekti ve tam da bölüm seçimi eklendiği için yanlış bilgi veriyordu.
 */
export const resetOnayHedefi = (k: Kayit): number => k.enUzak;

export type Sonraki = { tip: "level"; n: number } | { tip: "bitis" };

/** Bir bölüm kazanıldıktan sonra nereye gidilir? */
export const kazanincaSonraki = (n: number, toplam = LEVEL_COUNT): Sonraki =>
  n >= toplam ? { tip: "bitis" } : { tip: "level", n: n + 1 };

/** Bitiş ekranından çıkış yolları. */
export type BitisSecimi = "bastanOyna" | "iptal";

/**
 * Bitiş ekranından çıkınca hangi bölüm yüklenir? İlerleme HİÇBİR HÂLDE silinmez.
 *
 * Silen sürüm kısa bir süre yayındaydı ve oyundaki en kötü hataydı: "Baştan başla"nın
 * açılan bölümleri kilitlemesi (bilinçli bir karar) bitiş ekranına da sızmıştı, üstelik
 * orada iki aşamalı onay yoktu ve Escape de aynı düğmeyi tetikliyordu. 1000 bölümü
 * bitiren oyuncunun ekrandan tek çıkışı, açtığı her şeyi kilitleyen düğmeydi; sayfayı
 * yenilemek de kurtarmıyordu çünkü `level` 1000'de kalıp aynı ekrana geri çarpıyordu.
 *
 * Escape "iptal" demektir ve durum değiştirmemeli: kapanış bölümüne döner.
 * Kilitlemeyi isteyen oyuncu ayarlardaki onaylı düğmeyi kullanır.
 */
export const bitisCikisi = (secim: BitisSecimi, toplam = LEVEL_COUNT): number =>
  secim === "bastanOyna" ? 1 : toplam;
