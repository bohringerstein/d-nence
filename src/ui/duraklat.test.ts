// Duraklatma: ekran iskeleti ve "nasıl oynanır" metniyle tutarlılık.
//
// Oyuncu ara vermek zorunda kaldığında tek yolu ayarlar panelini açmaktı ve panel
// kapanınca level baştan başlıyordu; yani ara vermenin bedeli ilerlemeydi. Bu testler
// duraklatmanın var olduğunu, sayacın denetim olduğunu ve metinlerin bunu anlattığını
// denetler. Davranışın kendisi main.ts'te; burada ölçülen sözleşme.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { nasilHtml } from "./nasil.ts";
import { TR } from "../dil/tr.ts";

/** Testler Türkçe metinle çalışır; İngilizce eksiksizliği dil.test.ts sınar. */
const NASIL_HTML = nasilHtml(TR);

const kok = path.join(import.meta.dirname, "..", "..");
const shell = fs.readFileSync(path.join(kok, "src", "ui", "shell.ts"), "utf8");
const css = fs.readFileSync(path.join(kok, "src", "styles.css"), "utf8");
const main = fs.readFileSync(path.join(kok, "src", "main.ts"), "utf8");

test("sayaç bir düğme ve duraklatma etiketi taşıyor", () => {
  // Ayrı bir duraklat düğmesi bilerek yok: ekranın tamamı dokunma alanı olduğu için
  // alt köşeye eklenen her düğme başparmağın durduğu yere ölü bölge açar.
  const m = shell.match(/<button class="clock" id="clock"[^>]*>/);
  assert.ok(m, "sayaç <button> olmalı");
  // Erişilebilir ad aria-label DEĞİL, görsel olarak gizli bir metin olmalı.
  // aria-label görünen rakamı EZER: ekran okuyucu sadece "Duraklat, düğme" der ve
  // kalan süreyi hiç duymaz — oysa süre iki kayıp koşulundan biri. Ayrıca erişilebilir
  // adın görünen metni içermemesi WCAG 2.5.3 (Label in Name) ihlalidir.
  assert.ok(!/aria-label/.test(m[0]), "sayaçta aria-label olmamalı: görünen rakamı ezer");
  assert.ok(shell.includes("{m.duraklatDugmesi}, ") && shell.includes("{m.kalanSure}"),
    "gizli etiket duraklatma adını ve kalan süreyi birlikte söylemeli");
  assert.ok(/\.gizli\s*\{/.test(css), "görsel gizleme sınıfı tanımlı olmalı");
  assert.equal(TR.duraklatDugmesi, "Duraklat");
  assert.ok(shell.includes('id="clockSayi"'), "rakamlar ayrı bir öğede olmalı (simge kardeş öğe)");
});

test("sayaç düğme gibi görünmüyor ama dokunma hedefi 44px", () => {
  const blok = css.slice(css.indexOf("button.clock {"), css.indexOf("}", css.indexOf("button.clock {")));
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

test("arkaplandan dönüşte de geri sayım var", () => {
  const blok = main.slice(main.indexOf('"visibilitychange"'));
  assert.ok(blok.slice(0, 600).includes("geriSayimBaslat()"),
    "uygulamadan çıkıp dönen oyuncu halkaları bir anda hareket hâlinde bulmamalı");
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
  for (const cagri of ["yazKoru(kayipYazisi(", "yazKoru(M.sonucSatiri(", "yazKoru(M.sureDoldu)"]) {
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
