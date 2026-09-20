# Kasa: proje klasörü

Bu klasör, Kasa oyununu Claude Code ile geliştirmek için hazırlandı.

## Nasıl başlarsın

1. Bu klasörü bilgisayarında istediğin bir yere çıkar, örneğin `C:\Projeler\kasa`.
2. Terminali (PowerShell) bu klasörde aç ve `claude` yazarak Claude Code'u başlat.
3. İlk mesaj olarak şunu yaz:

   > CLAUDE.md ve docs/SPEC.md dosyalarını oku, prototipi incele. Sonra bana platform sorusunu sor ve 1. aşamaya başla.

Claude Code, `CLAUDE.md` dosyasını her oturumda kendiliğinden okur. Bu yüzden her seferinde projeyi baştan anlatman gerekmez.

## Klasörde ne var

| Dosya | Ne işe yarar |
|---|---|
| `CLAUDE.md` | Claude Code'un proje yönergesi: kurallar, çalışma planı, seninle nasıl iletişim kuracağı. |
| `docs/SPEC.md` | Oyunun tam teknik şartnamesi. |
| `docs/MATEMATIK.md` | Oyunun sayısal temeli: formüllerin türetilmesi ve sınırların nereden geldiği. |
| `reference/kasa.html` | Çalışan prototip. Çift tıklayıp tarayıcıda oynayabilirsin. |
| `src/core/` | Oyunun kuralları: geometri, halka hareketi, açıklık, yıldız (TypeScript). Tek kaynak budur. |
| `src/game/` | Oyun katmanı: durum, döngü, girdi, çizim, kayıt, ipuçları, tema. |
| `src/ui/` | Ekran düzeni. |
| `src/main.ts` | Uygulamanın giriş noktası; parçaları bağlar, kural içermez. |
| `src/core/*.test.ts` | Çekirdek ve level tablosu testleri. |
| `tools/gen.ts` | Level üretici ve doğrulayıcı. |
| `tools/sync-prototype.ts` | Çekirdeği ve level tablosunu prototipe gömer. |
| `tools/make-icons.ts` | Uygulama simgelerini üretir (oyunun kendi geometrisinden). |
| `public/` | Simgeler. `npm run icons` ile üretilir, elle düzenlenmez. |
| `data/levels.json` | Hazır 1000 bölüm. |

## Oyunu nasıl oynarsın

Bu klasörde PowerShell açıp:

```
npm install
npm run dev
```

Ardından tarayıcıda `http://localhost:5173` adresini aç. Telefonundan denemek istersen
`npm run dev -- --host` yaz; verdiği `Network` adresini telefonun tarayıcısına gir
(bilgisayarla aynı Wi-Fi ağında olman gerek).

`reference/kasa.html` eski prototiptir; yan yana karşılaştırmak için duruyor, çift tıklayıp açabilirsin.

## Telefona uygulama gibi kurmak

Kasa bir PWA'dır: mağazaya gerek kalmadan telefona kurulur ve **çevrimdışı çalışır**.

```
npm run build
npm run preview -- --host
```

Verdiği `Network` adresini telefonun tarayıcısına gir (bilgisayarla aynı Wi-Fi ağında ol).
Sonra:

- **Android / Chrome:** menüden "Uygulamayı yükle" ya da "Ana ekrana ekle".
- **iPhone / Safari:** paylaş düğmesi → "Ana Ekrana Ekle".

Kurduktan sonra oyun tarayıcı çubuğu olmadan, kendi simgesiyle açılır ve internet
olmadan da oynanır. Rekorların telefonda saklanır.

> Not: `npm run preview` yalnızca senin ağında çalışır. Oyunu başkalarına açmak için
> `dist` klasörünü herhangi bir statik site servisine (Netlify, Vercel, GitHub Pages)
> yüklemen yeterli; başka bir kuruluma gerek yok.

## İşine yarayacak komutlar

```
npm run check
```
**En çok işine yarayacak komut bu.** Testleri çalıştırır, tüm levellerin hâlâ bitirilebilir ve
zorluk eğrisine uygun olduğunu doğrular, prototipin güncel olup olmadığına bakar. Claude Code
oyunun kurallarında bir şey değiştirdiyse bunu çalıştırmasını iste; geçmezse iş bitmemiştir.

```
npm run verify
```
Yalnızca level tablosunu denetler: her level bitirilebiliyor mu, kazanma oranı hedefin ±15 puanı
içinde mi, yıldız dağılımı makul mü. Sorun varsa hangi levelde ne olduğunu tek tek yazar.

```
npm test
```
Çekirdek kuralların birim testleri (açı hesabı, açıklık, yıldız, girdi zamanlaması) ve 1000 bölümün tablo testi.

```
npm run gen
```
Level tablosunu yeniden üretir. Sabit tohumla çalışır: aynı kod her zaman aynı tabloyu verir.
Bunu çalıştırdıktan sonra `npm run sync` ile prototipi de güncelle.

```
npm run build
```
Yayına hazır sürümü `dist` klasörüne üretir (servis çalışanı ve simgeler dahil).
