# Kasa oyunu: Claude Code için proje yönergesi

Bu projede tek dokunuşla oynanan, level tabanlı, 2 boyutlu bir mobil oyun olan **Kasa**'yı üretime hazır hale getiriyoruz. Oyunun çalışan bir prototipi var; görevin onu temiz, test edilmiş ve bakımı kolay bir projeye dönüştürmek.

## Önce oku

1. `docs/SPEC.md`: oyunun tüm kuralları, formülleri ve kabul ölçütleri. Tek doğru kaynak budur.
2. `reference/kasa.html`: çalışan prototip. Tarayıcıda açılabilir. Şartnamede açıkça yazmayan davranışlarda bunu örnek al.
3. `tools/core.js`: halka hareketi ve temel sabitler. Oyun ve level üretici bu dosyayı paylaşır.
4. `tools/gen.js`: level üretici ve doğrulayıcı.
5. `data/levels.json`: 60 levellik hazır tablo.

## Kullanıcı hakkında

Proje sahibi Kader, mühendislik ve IoT geçmişi olan bir proje analisti; yazılım geliştirici değil. Windows kullanıyor ve Türkçe konuşuyor.
- Kendisiyle Türkçe konuş. Kod, değişken adları ve commit mesajları İngilizce olabilir.
- Teknik kararları kısa ve sade gerekçelerle açıkla, jargonu gerektiğinde bir cümleyle tanımla.
- Komutları Windows'ta (PowerShell) çalışacak şekilde ver.
- Her aşamanın sonunda oyunu nasıl açıp deneyeceğini adım adım söyle.

## Başlamadan önce sor

Hedef platformu Kader'e sor. Cevap yoksa varsayılan: **web + PWA** (telefona "ana ekrana ekle" ile kurulabilen web uygulaması), TypeScript + Vite + HTML Canvas. Mağaza sürümü istenirse ileride Capacitor ile paketlenir; mimari buna uygun kurulmalı.

## Değişmez kurallar

- Oyun mantığını `docs/SPEC.md`'ye göre kur. Şartnameden sapman gerekirse önce Kader'e sor ve nedenini açıkla.
- Halka hareketi, geometri ve açıklık hesabı tek bir çekirdek modülde yaşar; oyun da level üretici de onu kullanır. Mantığı kopyalama.
- Fizik güncellemesi sabit 1/120 sn adımla yapılır.
- Oyun içinde rastgele level üretme; `data/levels.json`'u oku.
- Çekirdek kurallarda her değişiklikten sonra tabloyu yeniden üret ve `node tools/gen.js --verify` çalıştır. Geçmezse işi bitmiş sayma.
- Bir level yüklenirken tüm zamanlayıcıları ve durum değerlerini sıfırla (prototipteki donma hatası buradan çıkmıştı).

## Çalışma planı

Her aşamanın sonunda dur, Kader'e ne yaptığını ve nasıl deneyeceğini anlat, onayını al.

1. **İskelet ve çekirdek:** proje kurulumu, çekirdek modül (TypeScript), birim testleri, `tools/` araçlarının bu modülü kullanması, `--verify` geçmesi.
2. **Oyun ekranı:** oyun döngüsü, çizim, dokunma, durumlar, süre, yıldızlar, ipuçları, kayıt. Prototiple yan yana karşılaştırıldığında aynı hissettirmeli.
3. **Otomatik oynanış testi:** her levelin referans çözücüyle oyunun kendi döngüsü üzerinden bitirilebildiğini gösteren test.
4. **Cila:** tema, güvenli alanlar, hareket azaltma, performans, şartnamedeki kabul ölçütlerinin hepsi.
5. **Yayın:** PWA ayarları (simge, çevrimdışı çalışma) ya da seçilen platformun paketi.
