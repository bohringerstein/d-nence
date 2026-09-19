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
| `reference/kasa.html` | Çalışan prototip. Çift tıklayıp tarayıcıda oynayabilirsin. |
| `tools/core.js` | Oyun ile level üreticinin paylaştığı çekirdek kurallar. |
| `tools/gen.js` | Level üretici ve doğrulayıcı. |
| `data/levels.json` | Hazır 60 level. |

## İşine yarayacak iki komut

Bilgisayarında Node.js kuruluysa:

```
node tools/gen.js --verify
```
Tüm levellerin hâlâ bitirilebilir olduğunu kontrol eder. Claude Code oyunun kurallarını değiştirdiyse bunu çalıştırmasını iste.

```
node tools/gen.js
```
Level tablosunu yeniden üretir.
