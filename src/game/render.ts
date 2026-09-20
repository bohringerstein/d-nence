// Canvas çizimi (şartname 7. bölüm).
import { TAU, DEG, canPass, gapCenters, isaretAcisi, layout, wrap } from "../core/index.ts";
import type { Layout, Ring } from "../core/index.ts";
import { aciklikBolgeleri, sonrakiHalka, HEPSI } from "./state.ts";
import type { LevelState } from "./state.ts";
import type { Renkler } from "./theme.ts";

/** Kamalar halkalarin disina S x bu kadar tasar. */
export const KAMA_TASMA = 0.05;

export interface Tuval {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  /** Kare başına bir kez hesaplanan yerleşim; prototipte kare başına üç kez üretiliyordu. */
  yerlesim: (halkaSayisi: number) => Layout;
  boyutla: () => void;
  birak: () => void;
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
    const dpr = window.devicePixelRatio || 1;
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
    boyutla,
    birak() {
      gozlemci.disconnect();
      window.removeEventListener("resize", boyutla);
      document.removeEventListener("visibilitychange", gorunurlukte);
    }
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
  const yarim = r.gap * DEG / 2;
  const ucPayi = (kalinlik / 2) / R;
  const merkezler = gapCenters(r).map(wrap).sort((a, b) => a - b);
  for (let i = 0; i < merkezler.length; i++) {
    const a0 = merkezler[i] + yarim + ucPayi;
    const a1 = (i + 1 < merkezler.length ? merkezler[i + 1] : merkezler[0] + TAU) - yarim - ucPayi;
    if (a1 > a0) { ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.stroke(); }
  }
}

export interface CizimSecenekleri {
  hareketAzalt: boolean;
  /** Kilitsiz halkaların opaklığı. "Deseni yumuşat" açıkken düşer (bkz. game/ayarlar.ts). */
  halkaOpakligi: number;
}

export function ciz(t: Tuval, s: LevelState, renk: Renkler, { hareketAzalt, halkaOpakligi }: CizimSecenekleri): void {
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
  const metin = String(s.level.n);
  let punto = g.S * 0.5;
  ctx.font = `600 ${punto}px Fredoka, "Trebuchet MS", sans-serif`;
  const yariGenislik = ctx.measureText(metin).width / 2;
  if (yariGenislik > g.outer) {
    punto *= g.outer / yariGenislik;
    ctx.font = `600 ${punto}px Fredoka, "Trebuchet MS", sans-serif`;
  }
  ctx.globalAlpha = s.level.boss ? 0.14 : 0.07;
  ctx.fillStyle = s.level.boss ? renk.ball : renk.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(metin, 0, g.S * 0.03);
  ctx.globalAlpha = 1;

  const delikDis = g.ballR * 4;
  const delik = ctx.createRadialGradient(0, 0, g.ballR * 1.6, 0, 0, delikDis);
  delik.addColorStop(0, "rgba(0,0,0,1)");
  delik.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = delik;
  ctx.beginPath();
  ctx.arc(0, 0, delikDis, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // 2) Açıklık kamaları
  if (s.anyLocked && s.asama !== "crash") {
    const dis = g.outer + g.S * KAMA_TASMA;
    // Geçer ve geçmez kama eskiden ikisi de dolduruluyordu (sarı %22, kırmızı %15).
    // Açık temada ikisinin zemine göre kontrastı 1,17 ve 1,20 çıkıyordu; aralarındaki
    // fark 1,03:1, yani fiilen ayırt edilemiyorlardı ve ayrım tamamen renk tonuna
    // kalıyordu. Artık ayrım DOLGU VAR/YOK: geçer kama %35 dolu, geçmez kama yalnızca
    // kesik konturlu. Aradaki fark 1,03 -> 1,28 ve renkten bağımsız ikinci bir kanal.
    for (const bolge of aciklikBolgeleri(s)) {
      const genis = canPass(bolge.w);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, dis, bolge.from, bolge.to);
      ctx.closePath();
      if (genis) {
        ctx.fillStyle = renk.ball;
        ctx.globalAlpha = 0.35;
        ctx.fill();
      } else {
        // Renk körlüğü için ikinci işaret ve artık tek işaret: kesik kontur.
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = renk.fail;
        ctx.lineWidth = 1.5;
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
      ctx.fillStyle = renk.ink;
      ctx.fillRect(Math.cos(a) * R - 4, Math.sin(a) * R - 4, 8, 8);
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
