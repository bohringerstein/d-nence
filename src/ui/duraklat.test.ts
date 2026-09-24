// Duraklatma: ekran iskeleti ve "nasıl oynanır" metniyle tutarlılık.
//
// Oyuncu ara vermek zorunda kaldığında tek yolu ayarlar panelini açmaktı ve panel
// kapanınca level baştan başlıyordu; yani ara vermenin bedeli ilerlemeydi. Bu testler
// duraklatmanın var olduğunu, sayacın denetim olduğunu ve metinlerin bunu anlattığını
// denetler. Davranışın kendisi main.ts'te; burada ölçülen sözleşme.
import test from "node:test";
import assert from "node:assert";
import { kuralGovdesi } from "./cssOku.ts";
import fs from "node:fs";
import path from "node:path";
import { nasilHtml } from "./nasil.ts";
import { html } from "./shell.ts";
import { TR } from "../dil/tr.ts";

/** Testler Türkçe metinle çalışır; İngilizce eksiksizliği dil.test.ts sınar. */
const NASIL_HTML = nasilHtml(TR);

const kok = path.join(import.meta.dirname, "..", "..");
/** Gerçek üretilmiş markup. Dosyayı metin olarak okuyup yorum ayıklamaktan
 *  kurtarır — o yol iki kez yanlış sonuç verdi. */
const shell = html(TR);
const css = fs.readFileSync(path.join(kok, "src", "styles.css"), "utf8");
const main = fs.readFileSync(path.join(kok, "src", "main.ts"), "utf8");

test("sayaç bir düğme ve duraklatma etiketi taşıyor", () => {
  // Ayrı bir duraklat düğmesi bilerek yok: ekranın tamamı dokunma alanı olduğu için
  // alt köşeye eklenen her düğme başparmağın durduğu yere ölü bölge açar.
  const m = shell.match(/<button class="clock" id="clock"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(m, "sayaç <button> olmalı");
  // Erişilebilir ad aria-label DEĞİL, görsel olarak gizli bir metin olmalı:
  // aria-label görünen metni ezer ve WCAG 2.5.3 (Label in Name) ihlali doğurur.
  assert.ok(!/aria-label/.test(m[0]), "sayaçta aria-label olmamalı");
  assert.ok(/<span class="gizli">Duraklat<\/span>/.test(m[0]),
    "düğmenin erişilebilir adı yalnızca duraklatma olmalı");
  assert.ok(/\.gizli\s*\{/.test(css), "görsel gizleme sınıfı tanımlı olmalı");
  assert.equal(TR.duraklatDugmesi, "Duraklat");
});

test("kalan süre düğmenin DIŞINDA ve düğmenin adı sabit", () => {
  // Regresyon: rakamlar düğmenin içindeydi ve erişilebilir adın parçası oluyordu,
  // yani ad saniyede 60 kez değişiyordu ("Duraklat, kalan süre 17,4" -> "...12,3").
  // aria-hidden tek başına yetmez: NVDA tarama kipi ve VoiceOver rotoru bir <button>'ı
  // TEK öğe olarak sunar, içindeki metne ok tuşuyla girilemez — yani rakam düğmenin
  // içinde kaldıkça ya adı bozuyor ya da hiç okunamıyordu. Çözüm onu dışarı almak.
  const dugme = shell.match(/<button class="clock" id="clock"[^>]*>[\s\S]*?<\/button>/);
  assert.ok(dugme, "sayaç düğmesi bulunamadı");
  assert.ok(/id="clockSayi"[^>]*aria-hidden="true"/.test(dugme[0]),
    "görünen rakamlar düğmenin adına karışmamalı: aria-hidden olmalı");
  assert.ok(!/role="timer"/.test(dugme[0]), "sesli sayaç düğmenin İÇİNDE olmamalı");

  const dis = shell.replace(dugme[0], "");
  assert.ok(/<span class="gizli" id="clockSes" role="timer">/.test(dis),
    "kalan süre düğmenin dışında, kendi role=\"timer\" öğesinde olmalı");
  // aria-live BİLEREK yok: role="timer" varsayılan olarak "off" demektir. Canlı
  // olsaydı ekran okuyucu her saniye kalan süreyi bağırırdı.
  assert.ok(!/id="clockSes"[^>]*aria-live/.test(shell),
    "sesli sayaç kendiliğinden okunmamalı");
  // Süre saniyede bir yazılmalı, her karede değil.
  assert.ok(/sonSesliSaniye/.test(main), "sesli sayaç tam saniyede bir güncellenmeli");
});

test("sayaç düğme gibi görünmüyor ama dokunma hedefi 44px", () => {
  const blok = kuralGovdesi("button.clock");
  assert.ok(/border:\s*none/.test(blok), "kenarlık alınmalı: sayaç düğmeye benzememeli");
  assert.ok(/min-height:\s*44px/.test(blok), "dokunma hedefi 44px kalmalı");
});

test("duraklatma örtüsü ve geri sayım öğesi var", () => {
  assert.ok(shell.includes('id="duraklat"'), "duraklatma örtüsü eksik");
  assert.ok(shell.includes('id="devamDugme"'), "devam düğmesi eksik");
  assert.ok(shell.includes('id="gerisayim"'), "geri sayım öğesi eksik");
  // Örtü yarı saydam kalmalı: donmuş halkalar arkadan görünsün.
  assert.ok(!/#duraklat\s*\{[^}]*background:\s*var\(--bg\)/.test(css),
    "duraklatma örtüsü opak yapılmamalı; donmuş halkalar görünmeli");
});

test("geri sayım halkaları dondurur", () => {
  // Bu bir adalet kuralı: geri sayım boyunca halkalar dönseydi oyuncu bedava gözlem
  // süresi kazanır ve süre bütçesi (γ) delinirdi — duraklat, izle, duraklat.
  assert.ok(/const oyunDonuk = \(\): boolean =>[^;]*geriSayim > 0/.test(main),
    "geri sayım sürerken oyun donuk sayılmalı");
});

test("ara vermek ilerlemeyi geri almıyor", () => {
  // Ayarlar ve "nasıl oynanır" kapanınca eskiden levelYukle çağrılıyordu: oyuncu
  // ara vermek için paneli açınca bölümü baştan oynamak zorunda kalıyordu.
  const ayarKapanis = main.slice(main.indexOf('ui.ayarKapat.addEventListener'));
  const govde = ayarKapanis.slice(0, ayarKapanis.indexOf("});"));
  assert.ok(govde.includes("geriSayimBaslat()"), "ayarlar kaldığı yerden devam etmeli");
  assert.ok(!govde.includes("levelYukle("), "ayarları kapatmak leveli baştan başlatmamalı");
});

test("donukluktan dönen HER yol geri sayımdan geçiyor", () => {
  // Haber artık DÖNGÜDEN geliyor. Sebep: donukluğu çözen olay `focus` olmak zorunda
  // değil — eşleşmeyen bir `blur` sonrası tek çıkış yolu DOKUNUŞ ve o dokunuş
  // `focus` dinleyicisini tetiklemiyordu; oyun geri sayım olmadan canlanıyor ve aynı
  // dokunuş bedava bir kilit oluyordu (çoğu durumda anında kayıp).
  assert.ok(/cozuldu\(\) \{ if \(!oyunDonuk\(\)\) geriSayimBaslat\(\); \}/.test(main),
    "döngü donukluğu çözdüğünü haber vermeli ve geri sayım başlamalı");
  const loop = fs.readFileSync(path.join(kok, "src", "game", "loop.ts"), "utf8");
  assert.ok(/if \(oncekiGizli\) cozuldu\?\.\(\)/.test(loop),
    "döngü yalnızca donukluktan ÇIKARKEN haber vermeli");
  // Eski, eksik yol kalmamalı: focus dinleyicisi tek başına yetmiyordu.
  assert.ok(!/window\.addEventListener\("focus"/.test(main),
    "geri sayım tek bir yerden başlamalı");
});

test("nasıl oynanır duraklatmayı anlatıyor", () => {
  // Sayaca dokunmak keşfedilebilir olmalı: simge tek başına yetmez.
  assert.ok(/duraklat/i.test(NASIL_HTML), "duraklatma açıklaması eksik");
  assert.ok(/sayac|sayaç|süre/i.test(NASIL_HTML), "duraklatmanın nerede olduğu yazmalı");
});

// --- Sonuç mesajı okunacak kadar kalıyor mu? ---------------------------------
//
// Kayıp animasyonu 0,9 saniye sürüyor ve bitince level yeniden yükleniyor; yükleme de
// ipucunu hemen eziyordu. Yani "Açıklık kapandı · 1,4° dar kaldı" — oyuncunun "neden
// kaybettim" sorusuna cevap veren tek cümle — ekranda 0,9 saniye duruyordu. O cümleyi
// okumak bundan uzun sürer.
test("kayıp, kazanma ve süre dolması mesajları korumalı yazılıyor", () => {
  for (const cagri of ["yazKoru(kayipYazisi(", "yazKoru(M.sonucSatiri(", "yazKoru(M.sureDoldu("]) {
    assert.ok(main.includes(cagri), `sonuç mesajı korumasız yazılıyor: ${cagri}`);
  }
  // Level yüklemesi mesajı EZMEMELİ, ertelemeli.
  assert.ok(/yazVeyaErtele\(ipucu\(/.test(main),
    "level yüklenirken ipucu doğrudan yazılırsa sonuç mesajı ezilir");
  assert.ok(!/[^a-zA-Z]yaz\(ipucu\(/.test(main), "level yüklemesi yaz() ile ipucunu ezmemeli");
});

test("mesaj süresi kayıp animasyonundan uzun", () => {
  // Kilit, kayıp animasyonunu (0,9 sn) aşmalı ki mesaj sonraki denemeye taşsın.
  const m = main.match(/const SONUC_SURESI = ([\d.]+)/);
  assert.ok(m, "SONUC_SURESI tanımlı olmalı");
  const state = fs.readFileSync(path.join(kok, "src", "game", "state.ts"), "utf8");
  const c = state.match(/CRASH_SURE = ([\d.]+)/);
  assert.ok(c, "CRASH_SURE okunamadı");
  assert.ok(Number(m[1]) > Number(c[1]) + 0.5,
    `mesaj ${m[1]} sn yaşıyor ama kayıp animasyonu ${c[1]} sn; okunacak süre kalmıyor`);
});

test("duraklatmak mesaj süresini yakmıyor", () => {
  // Oyuncu duraklatıp mesajı okuyabilmeli; kilit yalnızca oyun canlıyken işlemeli.
  assert.ok(/if \(!oyunDonuk\(\)\) ipucuKilidiIlerlet\(dt\)/.test(main),
    "ipucu kilidi oyun donukken de ilerliyor");
});

test("sayfa açılışı da geri sayımla başlıyor", () => {
  // Canlı oyuna açılan son korumasız yol buydu. Dil değiştirmek sayfayı yeniden
  // yüklüyor (bkz. main.ts dilKutu): oyuncu ayarlardan dili seçiyor, sayfa yenileniyor
  // ve halkalar çoktan dönüyordu. Soğuk açılış da aynı durum.
  assert.ok(/if \(!ayarlar\.uyariGoruldu\) nasilAc\(true\);\s*\n\s*else geriSayimBaslat\(\);/.test(main),
    "açılışta 'nasıl oynanır' gösterilmiyorsa geri sayım başlamalı");
});

test("odak kaybı da oyunu durduruyor", () => {
  // Sekme GÖRÜNÜR ama pencere odakta değilken tarayıcı kareyi saniyede bire kısıyor;
  // document.hidden hâlâ false olduğu için oyun çalışmaya devam ediyordu. Her kare
  // biriktiriciden 0,25 saniye aldığı için 60 saniyelik bir dalgınlık 15 saniyelik
  // fizik demekti: bildirim paneli, bölünmüş ekran ya da üste gelen bir pencere
  // bölümü yakıyordu.
  const loop = fs.readFileSync(path.join(kok, "src", "game", "loop.ts"), "utf8");
  assert.ok(/pencereDisinda/.test(loop), "döngü pencere odağını da izlemeli");
  assert.ok(/document\.hidden \|\| pencereDisinda/.test(loop),
    "gizli VEYA odaksız: ikisi de oyunu durdurmalı");
  // Olaya değil GERÇEĞE bakmalı: eşleşmeyen tek bir blur kalıcı kilitlenme üretiyordu
  // ve çıkış yolu yalnızca bir focus olayıydı. Tarayıcıda görüldü: ekranda hiç saymayan
  // bir geri sayım rakamı kalıyor, donmuş oyun ile başlamak üzere olan oyun ayrılmıyor.
  assert.ok(/pencereDisinda = odaksizMi\(\);/.test(loop),
    "görünürlük her çağrıldığında odak yeniden ölçülmeli");
  assert.ok(/addEventListener\("pointerdown", dokunusla/.test(loop),
    "dokunuş da donmayı çözmeli: oyuncu ekrana bastıysa oyun donuk kalmamalı");
  assert.ok(/cozuldu\(\)/.test(main), "donukluk çözülünce geri sayım başlamalı");
});

// --- Güncellemenin uygulandığı an --------------------------------------------
//
// Bildirilen hata: "oyunu her güncellediğimizde daha önce oynamış kimseler hep eski
// sürümü görüyor, sert yenileme yapmak gerekiyor." Sebep ölçüldü: `autoUpdate` modunun
// ürettiği registerSW.js YALNIZCA kaydediyordu; yeni servis çalışanı devralıyor ama
// çizilmiş sayfa eski varlıkları tutmaya devam ediyordu.
test("yeni sürüm yalnızca GÜVENLİ anlarda uygulanıyor", () => {
  assert.ok(/function guncellemeyiIste/.test(main), "güvenli an denetimi olmalı");
  // Bölüm kazanıldıktan sonra: yenileme oyuncudan hiçbir şey götürmüyor.
  const kazanma = main.slice(main.indexOf('if (sonraki.tip === "bitis")'));
  assert.ok(kazanma.slice(0, 700).includes("guncellemeyiIste(sonraki.n)"),
    "bölüm sınırında güncelleme istenmeli");
  // Duraklatmadan dönerken: oyuncu zaten durmuş.
  const devam = main.slice(main.indexOf("function duraklatmaKapat("));
  assert.ok(devam.slice(0, 400).includes("guncellemeyiIste("),
    "duraklatmadan dönerken güncelleme istenmeli");
  // Sonuca BAKILMAMALI: yenileme gelmezse oyun takılıp kalırdı.
  assert.ok(!/if \(guncellemeyiIste\(/.test(main),
    "güncelleme isteğinin sonucuna göre dallanılmamalı");
  // Oyun ORTASINDA uygulanmamalı: yenileme oyuncunun turunu keser.
  const adim = main.slice(main.indexOf("function dokunusIsle("), main.indexOf("// ---- Döngü"));
  assert.ok(!adim.includes("guncelleme"), "dokunuş işlenirken güncelleme uygulanmamalı");
});

test("güncelleme uygulanmadan önce ilerleme yazılıyor", () => {
  // Yenileme sayfayı baştan yükler; kayıt yazılmazsa oyuncu bir bölüm geriden başlar.
  const g = main.slice(main.indexOf("function guncellemeyiIste"), main.indexOf("// ---- Duraklatma"));
  const isaret = g.indexOf("devamNoktasiYaz(");
  const kayitSira = g.indexOf("levelKaydet(");
  const uygulaSira = g.indexOf("guncellemeyiUygula()");
  assert.ok(isaret >= 0 && kayitSira > isaret && uygulaSira > kayitSira,
    "önce devam noktası, sonra ilerleme, en son yenileme");
  // Devam noktası OTURUM depolamasında: kalıcı `enUzak` bölüm seçiminden geriye
  // dönmüş oyuncuyu yanlış yere atardı.
  const storage = fs.readFileSync(path.join(kok, "src", "game", "storage.ts"), "utf8");
  assert.ok(/sessionStorage\.setItem\(DEVAM_KEY/.test(storage),
    "devam noktası oturum depolamasında olmalı");
});
