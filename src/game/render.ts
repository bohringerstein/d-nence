// Canvas çizimi (şartname 7. bölüm).
import { TAU, canPass, isaretAcisi, layout, ciziliYaylar } from "../core/index.ts";
import type { Layout, Ring } from "../core/index.ts";
import { aciklikBolgeleri, sonrakiHalka, HEPSI } from "./state.ts";
import type { LevelState } from "./state.ts";
import type { Renkler } from "./theme.ts";

/** Kamalar halkalarin disina S x bu kadar tasar. */
export const KAMA_TASMA = 0.05;

/**
 * Kama opaklıkları. TEK KAYNAK: kontrast testi (ui/contrast.test.ts) bunları buradan
 * okur. Eskiden testte elle kopyalanmışlardı; biri burada değişse test eski değeri
 * ölçüp yeşil yanmaya devam ederdi.
 */
export const KAMA = {
  /** Geçer kama dolgusu (top rengi). Tek başına 3:1'e ulaşamaz, bkz. kontur. */
  dolgu: 0.35,
  /** Geçer kama konturu (mürekkep rengi, düz). WCAG 1.4.11'i bu taşır. */
  kontur: 0.7,
  /** Geçmez kama konturu (kırmızı, kesik). */
  gecmezKontur: 0.9,
  /** Kayıpta geçmez kamanın dolgusu. */
  kayipDolgu: 0.3,
  /** Kontur kalınlığı, CSS pikseli. */
  kalinlik: 1.5
} as const;

export interface Tuval {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Kare başına bir kez hesaplanan yerleşim; prototipte kare başına üç kez üretiliyordu. */
  yerlesim: (halkaSayisi: number) => Layout;
  boyutla: () => void;
  /**
   * Bir önceki karede temizlenen kutunun yarı genişliği. Temizleme alanı daralırsa
   * (top merkeze dönünce, level değişince) önceki karenin izi kalırdı; bu yüzden
   * her kare önceki ve şimdiki kutunun birleşimi temizlenir.
   */
  sonYari: number;
}

export function tuvalKur(canvas: HTMLCanvasElement, degisti: () => void): Tuval {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d bağlamı alınamadı");

  let kendi: Tuval | null = null;

  let W = 0, H = 0;
  let onbellekSayi = -1;
  let onbellek: Layout | null = null;

  const boyutla = (): void => {
    // Üst sınır 2: 3x ekranlı telefonlarda tuval 9 kat piksel taşıyordu (2x'te 4 kat).
    // İnce çizgili, düz renkli bir çizimde 2x ile 3x arasındaki fark gözle seçilmez,
    // doldurma maliyeti ise 2,25 kat artar.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onbellekSayi = -1;
    // Arka tamponu yeniden boyutlandırmak tuvali zaten tamamen siler.
    if (kendi) kendi.sonYari = 0;
    degisti();
  };

  // Alt çubuktaki ipucu uzayıp kısaldıkça canvas'ın CSS yüksekliği değişir ama pencere
  // boyutu değişmez; window.resize tek başına bunu kaçırır ve çizim ezilir.
  const gozlemci = new ResizeObserver(boyutla);
  gozlemci.observe(canvas);
  window.addEventListener("resize", boyutla);

  // Sekme gizliyken ResizeObserver bildirimleri ertelenir. Uygulamaya dönen oyuncu,
  // gözlemci yetişene kadar bir kare ezik çizim görebilir; dönüşte ölçüyü tazeliyoruz.
  const gorunurlukte = (): void => { if (!document.hidden) boyutla(); };
  document.addEventListener("visibilitychange", gorunurlukte);

  kendi = {
    canvas, ctx,
    sonYari: 0,
    get W() { return W; },
    get H() { return H; },
    yerlesim(halkaSayisi: number) {
      if (halkaSayisi !== onbellekSayi || !onbellek) {
        onbellek = layout(W || 380, H || 380, halkaSayisi);
        onbellekSayi = halkaSayisi;
      }
      return onbellek;
    },
    boyutla
  };
  return kendi;
}

/**
 * Halkanın çizgili kısımları: boşlukların arasında kalan yaylar.
 *
 * lineCap "round" olduğu için yuvarlak uç, yayın bittiği noktadan teğet yönünde
 * w/2 kadar taşar. Düzeltilmezse GÖRÜNEN boşluk, mantıksal boşluktan her iki uçtan
 * (w/2)/R radyan dar olur: 360 piksellik bir ekranda eşik geçişte top, görünen
 * açıklıktan %24 geniş kalıyordu — oyun "geçti" derken göz "değdi" görüyordu.
 * Yay her iki uçtan bu kadar kısaltılır, böylece yuvarlak uç tam boşluk sınırında biter.
 */
function halkaCiz(ctx: CanvasRenderingContext2D, r: Ring, R: number, kalinlik: number): void {
  // Yay bölütleme çekirdekte (bkz. core/rings.ts ciziliYaylar): aynı döngü burada bir
  // kez daha yazılıyordu ve halka geometrisinin ikinci kopyasıydı.
  for (const [a0, a1] of ciziliYaylar(r, (kalinlik / 2) / R)) {
    ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.stroke();
  }
}

export interface CizimSecenekleri {
  hareketAzalt: boolean;
  /** Kilitsiz halkaların opaklığı. "Deseni yumuşat" açıkken düşer (bkz. game/ayarlar.ts). */
  halkaOpakligi: number;
  /**
   * Arka plandaki bölüm numarası çizilmesin. Geri sayım sırasında: sayımın büyük rakamı
   * ("3") soluk bölüm numarasının ("1") tam üstüne düşüyor ve ikisi üst üste okunuyordu.
   */
  numaraGizle?: boolean;
}

/** Kareden kareye değişmeyen çizim nesneleri, bağlam başına. */
interface CizimOnbellegi {
  yaziAnahtari: string; font: string;
  delikYari: number; delik: CanvasGradient | null;
}
const onbellekler = new WeakMap<CanvasRenderingContext2D, CizimOnbellegi>();
function onbellekAl(ctx: CanvasRenderingContext2D): CizimOnbellegi {
  let o = onbellekler.get(ctx);
  if (!o) { o = { yaziAnahtari: "", font: "", delikYari: -1, delik: null }; onbellekler.set(ctx, o); }
  return o;
}

export function ciz(t: Tuval, s: LevelState, renk: Renkler, { hareketAzalt, halkaOpakligi, numaraGizle = false }: CizimSecenekleri): void {
  const { ctx, W, H } = t;
  if (W === 0 || H === 0) return;
  const g = t.yerlesim(s.rings.length);

  const sarsinti = hareketAzalt ? 0 : s.shake;
  const sx = sarsinti ? (Math.random() - 0.5) * 12 * sarsinti : 0;
  const sy = sarsinti ? (Math.random() - 0.5) * 12 * sarsinti : 0;

  // Yalnızca çizimin gerçekten dokunduğu kareyi temizle. Geniş ekranda tüm tuvali
  // temizlemek 1920×1000'de tek başına 2,4 ms tutuyordu; çizim ortalanmış bir kare
  // alana sığdığı için gerisi zaten hep boş.
  // Top "fire" aşamasında halkaların dışına uçar; kutu onu da kapsamalı, yoksa iz bırakır.
  const buYari = Math.max(
    g.outer + g.S * KAMA_TASMA + g.lineWidth,
    s.asama === "fire" ? s.ballDist + g.ballR : 0
  ) + Math.abs(sx) + Math.abs(sy) + 2;
  // Kutu daralıyorsa (top merkeze döndü, level değişti) önceki karenin izi kalırdı:
  // her kare önceki ve şimdiki kutunun birleşimi temizlenir.
  const yariAlan = Math.max(buYari, t.sonYari);
  t.sonYari = buYari;
  const kx = Math.max(0, W / 2 - yariAlan);
  const ky = Math.max(0, H / 2 - yariAlan);
  ctx.clearRect(kx, ky, Math.min(W, W / 2 + yariAlan) - kx, Math.min(H, H / 2 + yariAlan) - ky);
  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);

  // 1) Arka planda levelin numarası
  //
  // İki düzeltme var:
  // (a) Genişlik sınırı. Punto sabit S*0,5 idi; dört hanede ("1000") metnin yarı
  //     genişliği en dış halkayı da, temizlenen kutuyu da aşıyordu ve sarsıntıda iz
  //     bırakabiliyordu. Ölçülüp gerekirse küçültülür — yalnızca 4 hanede devreye girer.
  // (b) Topun çevresi. Rakamın gövdesi tam topun altından geçiyordu (1, 4, 7 gibi
  //     merkezden geçen rakamlarda, yani herkesin gördüğü Level 1'de). Rakam çizildikten
  //     sonra merkezde yumuşak kenarlı bir delik silinir; halkalar henüz çizilmediği için
  //     silme yalnızca rakama dokunur.
  // Yazı tipi dizesi ve ölçüm bölüm ve yerleşim başına bir kez: her karede metni ölçmek
  // ve dize kurmak boşa işti. Önbellek bağlama bağlı (WeakMap): yazı tipi yüklenince
  // ölçü değişebilir, o da tuvali yeniden boyutlandırmaz; bu yüzden anahtar ölçüyü
  // değil, ölçünün girdilerini taşır ve yükleme sonrası ilk karede tazelenir.
  const ob = onbellekAl(ctx);
  const metin = String(s.level.n);
  const yaziAnahtari = metin + "|" + g.S + "|" + g.outer + "|" + (typeof document !== "undefined" ? document.fonts?.status ?? "" : "");
  if (ob.yaziAnahtari !== yaziAnahtari) {
    let punto = g.S * 0.5;
    ctx.font = `600 ${punto}px Fredoka, "Trebuchet MS", sans-serif`;
    const yariGenislik = ctx.measureText(metin).width / 2;
    if (yariGenislik > g.outer) punto *= g.outer / yariGenislik;
    ob.yaziAnahtari = yaziAnahtari;
    ob.font = `600 ${punto}px Fredoka, "Trebuchet MS", sans-serif`;
  }
  ctx.font = ob.font;
  if (!numaraGizle) {
    ctx.globalAlpha = s.level.boss ? 0.14 : 0.07;
    ctx.fillStyle = s.level.boss ? renk.ball : renk.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(metin, 0, g.S * 0.03);
    ctx.globalAlpha = 1;
  }

  const delikDis = g.ballR * 4;
  // Gradyan merkeze (0,0) göre tanımlı; çevirme çizim anında uygulandığı için aynı
  // nesne her karede kullanılabilir. Yalnız top yarıçapı değişince yeniden kurulur.
  if (ob.delikYari !== g.ballR || !ob.delik) {
    const d = ctx.createRadialGradient(0, 0, g.ballR * 1.6, 0, 0, delikDis);
    d.addColorStop(0, "rgba(0,0,0,1)");
    d.addColorStop(1, "rgba(0,0,0,0)");
    ob.delik = d; ob.delikYari = g.ballR;
  }
  const delik = ob.delik;
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = delik;
  ctx.beginPath();
  ctx.arc(0, 0, delikDis, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // 2) Açıklık kamaları
  //
  // Kayıpta kamalar eskiden TAMAMEN gizleniyordu: oyuncunun "neden kaybettim" sorusuna
  // cevap veren tek öğe, tam da o soruyu sorduğu anda ekrandan siliniyordu. Artık
  // daralmış kanal kırmızı DOLU çiziliyor; topun ona sığmadığı görünüyor.
  if (s.anyLocked) {
    const dis = g.outer + g.S * KAMA_TASMA;
    /** Çentiklerin başladığı yer: dış halkanın çizgisinin hemen dışı. */
    const icKenar = g.outer + g.lineWidth / 2;
    // Geçer ve geçmez kama eskiden ikisi de dolduruluyordu (sarı %22, kırmızı %15).
    // Açık temada ikisinin zemine göre kontrastı 1,17 ve 1,20 çıkıyordu; aralarındaki
    // fark 1,03:1, yani fiilen ayırt edilemiyorlardı ve ayrım tamamen renk tonuna
    // kalıyordu. Artık ayrım DOLGU VAR/YOK: geçer kama %35 dolu, geçmez kama yalnızca
    // kesik konturlu. Aradaki fark 1,03 -> 1,28 ve renkten bağımsız ikinci bir kanal.
    for (const bolge of aciklikBolgeleri(s)) {
      const genis = canPass(bolge.w);
      // Dolgu merkezden çıkan dilim; KONTUR ise yalnız halkaların DIŞINDA kalır: dış yay
      // ve iki uçta dış halkadan yaya kısa birer çentik. Eskiden kontur dolgu yolunun
      // kendisiydi, yani merkezden çıkan iki radyal çizgi halkalarla aynı mürekkep
      // renginde bütün halkaları kesiyordu — boşluk uçlarının üstüne binen "teller".
      // Şeklin sınırı yine belirli (1.4.11), ama halka bölgesinde çizgi yok.
      const dilim = (): void => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, dis, bolge.from, bolge.to);
        ctx.closePath();
      };
      const kenar = (): void => {
        ctx.beginPath();
        ctx.moveTo(Math.cos(bolge.from) * icKenar, Math.sin(bolge.from) * icKenar);
        ctx.arc(0, 0, dis, bolge.from, bolge.to);
        ctx.lineTo(Math.cos(bolge.to) * icKenar, Math.sin(bolge.to) * icKenar);
      };
      if (genis) {
        dilim();
        ctx.fillStyle = renk.ball;
        ctx.globalAlpha = KAMA.dolgu;
        ctx.fill();
        // KONTUR ŞART (WCAG 1.4.11). Amber dolgu tek başına açık temada zeminden
        // yalnızca 1,28:1 ayrılıyor — ölçüt 3:1. Oyunun kendi öğretici metni bu nesneyi
        // adıyla gösteriyor ("Sarı kama ortak açıklık"), yani anlamak için gerekli.
        //
        // Dolgu opaklığını artırmak İŞE YARAMIYOR: amber ile açık zeminin parlaklığı
        // neredeyse aynı, 0,35 → 0,70 yapmak oranı yalnız 1,62'ye taşıyor. Çözüm
        // mürekkep konturu: alfa 0,7 → zemine karşı açık temada 4,68:1, koyu 6,93:1.
        //
        // Kontur DÜZ çizgi: kesik kontur geçmez kamanın işareti olarak kalsın, ikisi
        // arasındaki ikinci kanal (dolgu var/yok) ve üçüncü kanal (düz/kesik) bozulmasın.
        kenar();
        ctx.strokeStyle = renk.ink;
        ctx.globalAlpha = KAMA.kontur;
        ctx.lineWidth = KAMA.kalinlik;
        ctx.setLineDash([]);
        ctx.stroke();
      } else {
        // Kayıpta dolgu geri gelir: "işte sığmadığın yer" tek bakışta okunmalı.
        if (s.asama === "crash") {
          dilim();
          ctx.fillStyle = renk.fail;
          ctx.globalAlpha = KAMA.kayipDolgu;
          ctx.fill();
        }
        // Renk körlüğü için ikinci işaret: kesik kontur. Geçer kamayla aynı yol.
        kenar();
        ctx.globalAlpha = KAMA.gecmezKontur;
        ctx.strokeStyle = renk.fail;
        ctx.lineWidth = KAMA.kalinlik;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 3) Halkalar. Sıradaki belirgin, ondan sonraki yarı saydam: ileriyi okumak mümkün.
  const sonraki = sonrakiHalka(s);
  ctx.lineCap = "round";
  s.rings.forEach((r, i) => {
    const R = g.radius(i);
    let renkli = renk.ink;
    let alpha = r.locked ? 1 : halkaOpakligi;
    let kalinlik = g.lineWidth;
    if (i === sonraki) alpha = Math.min(0.75, halkaOpakligi + 0.35);
    const aktif = i === s.active && s.asama === "idle";
    if (aktif) { renkli = renk.ball; alpha = 1; kalinlik = g.lineWidth * 1.25; }
    if (i === s.crashRing || s.crashRing === HEPSI) { renkli = renk.fail; alpha = 1; }
    if (i === s.lastLocked && s.lockPulse > 0) kalinlik = g.lineWidth * (1 + s.lockPulse * 0.8);

    // Amber, açık temada arka planla 1,97:1 kontrast veriyor; tek başına zayıf.
    // Altına ince koyu bir kenar çizip şeklin renkten bağımsız okunmasını sağlıyoruz.
    if (aktif) {
      ctx.strokeStyle = renk.ink;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = kalinlik + 3;
      halkaCiz(ctx, r, R, kalinlik + 3);
    }

    ctx.strokeStyle = renkli;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = kalinlik;
    halkaCiz(ctx, r, R, kalinlik);
    ctx.globalAlpha = 1;

    // 4) İşaretler: en geniş çizili yayın ortasında (bkz. core/rings.ts isaretAcisi).
    //    Sabit bir açı kullanmak iki kapılı halkalarda işareti boşluğun içine düşürüyordu.
    const a = isaretAcisi(r);
    if (r.preLocked) {
      // Kare eskiden MÜREKKEP rengiyle dolduruluyordu — ama baştan kilitli halka da
      // mürekkep rengiyle ve tam opaklıkla çizilir (locked: true), yani kare halkanın
      // üstünde görünmez oluyordu. 1000 bölümün 431'inde durum buydu ve Level 7'deki
      // ipucu "kareli halka baştan kilitli" diyerek olmayan bir şeyi arattırıyordu.
      //
      // Artık zemin renginde dolup mürekkeple çevriliyor: halkada delik açmış gibi değil,
      // üstüne oturmuş bir perçin gibi okunuyor. Kenarlık şart — dolgusu tek başına
      // kalsaydı küçük bir boşluk sanılabilirdi.
      const yan = Math.max(7, g.lineWidth * 1.6);
      const mx = Math.cos(a) * R, my = Math.sin(a) * R;
      ctx.fillStyle = renk.bg;
      ctx.strokeStyle = renk.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(mx - yan / 2, my - yan / 2, yan, yan);
      ctx.fill();
      ctx.stroke();
    }
    if (r.flip && !r.locked) {
      ctx.fillStyle = renk.fail;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R, Math.sin(a) * R, 4, 0, TAU);
      ctx.fill();
    }
  });

  // 5) Top. Halka gibi burada da ince koyu kenar: amber açık zeminde tek başına silik.
  const d = s.asama === "fire" ? s.ballDist : 0;
  ctx.fillStyle = s.asama === "crash" ? renk.fail : renk.ball;
  ctx.beginPath();
  ctx.arc(Math.cos(s.fireAngle) * d, Math.sin(s.fireAngle) * d, g.ballR, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = renk.ink;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = Math.max(1, g.ballR * 0.16);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}
