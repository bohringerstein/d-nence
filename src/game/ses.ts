// Ses. Dosya yok: üç sesin üçü de Web Audio ile sentezlenir.
//
// Neden sentez: bu türde (tek dokunuş, zamanlama) ses dekorasyon değil, geri bildirim
// kanalının kendisidir — dokunuşun ödülü odur. Ama hazır ses dosyası indirmek hem paket
// boyutu hem lisans meselesi açar. Üç kısa ses osilatörle üretilince ikisi de yok olur:
// toplam maliyet birkaç yüz bayt kod ve çalma başına bir osilatör.
//
// iOS NOTU: AudioContext bir kullanıcı hareketi İÇİNDE açılmak zorundadır, yoksa
// "suspended" kalır ve hiçbir şey duyulmaz. Oyunun dokunuşları zaman damgasıyla
// kuyruğa alınıp fizik adımında işlendiği için (game/input.ts) ses çalma anı artık
// hareketin içinde değildir. Bu yüzden sesiAc() ayrıca ve doğrudan pointerdown'dan
// çağrılır; idempotenttir, açıkken hiçbir şey yapmaz.

type Tur = "kilit" | "acildi" | "kayip";

interface AyarBenzeri { ses: boolean }

type CtxYapici = typeof AudioContext;

let ctx: AudioContext | null = null;
let ana: GainNode | null = null;
/** Tarayıcı ses üretemiyorsa bir daha denenmez. */
let desteklenmiyor = false;

function yapici(): CtxYapici | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: CtxYapici; webkitAudioContext?: CtxYapici };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export const sesVarMi = (): boolean => !desteklenmiyor && yapici() !== null;

/**
 * Ses bağlamını açar ya da uyandırır. **Kullanıcı hareketi içinde çağrılmalıdır.**
 * Birden çok kez çağrılması zararsızdır.
 */
export function sesiAc(): void {
  if (desteklenmiyor) return;
  const Y = yapici();
  if (!Y) { desteklenmiyor = true; return; }
  try {
    if (!ctx) {
      ctx = new Y();
      ana = ctx.createGain();
      // Oyun sesi arka planda kalmalı: bu bir zamanlama oyunu, ses ipucu değil ödül.
      ana.gain.value = 0.12;
      ana.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    desteklenmiyor = true;
  }
}

/** Tek bir nota: kısa zarf, tıklama sesi çıkarmayacak kadar yumuşak iniş. */
function nota(baslangic: number, frekans: number, sure: number, dalga: OscillatorType, kazanc: number): void {
  if (!ctx || !ana) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = dalga;
  o.frequency.setValueAtTime(frekans, baslangic);
  // Sıfırdan başlayıp sıfıra inen zarf: anlık kesme "tık" sesi üretir.
  g.gain.setValueAtTime(0.0001, baslangic);
  g.gain.exponentialRampToValueAtTime(kazanc, baslangic + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, baslangic + sure);
  o.connect(g); g.connect(ana);
  o.start(baslangic);
  o.stop(baslangic + sure + 0.02);
}

/** Kayıpta alçalan ton: "bitti" duygusunu perde yönü taşır. */
function inen(baslangic: number, bas: number, son: number, sure: number): void {
  if (!ctx || !ana) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(bas, baslangic);
  o.frequency.exponentialRampToValueAtTime(son, baslangic + sure);
  g.gain.setValueAtTime(0.0001, baslangic);
  g.gain.exponentialRampToValueAtTime(0.9, baslangic + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, baslangic + sure);
  o.connect(g); g.connect(ana);
  o.start(baslangic);
  o.stop(baslangic + sure + 0.02);
}

/** Do majör beşli: kilit sesleri bu dizide yükselir, hangi sırada olursa olsun uyumlu. */
const DIZI = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

/**
 * @param aciklik Kalan açıklığın oranı (1 = kanal ferah, 0 = geçiş eşiğinde).
 *   Kilit sesinin perdesi kanal daraldıkça yükselir: oyuncu "sıkışıyorum" bilgisini
 *   ekrana bakmadan da alır. Bu, kaybın neden geldiğini anlatan ikinci kanaldır.
 */
export function cal(a: AyarBenzeri, tur: Tur, aciklik = 1): void {
  if (!a.ses || desteklenmiyor) return;
  sesiAc();
  if (!ctx || !ana || ctx.state !== "running") return;
  const t = ctx.currentTime;
  try {
    if (tur === "kilit") {
      // Önce 0-1'e sıkıştır: NaN ya da aralık dışı bir değer doğrudan kullanılsaydı
      // dizi indisi geçersiz olur ve frekans undefined giderdi (osilatör sessiz kalır).
      const a01 = Number.isFinite(aciklik) ? Math.min(1, Math.max(0, aciklik)) : 1;
      const k = Math.round((1 - a01) * (DIZI.length - 1));
      nota(t, DIZI[k], 0.09, "square", 0.5);
    } else if (tur === "acildi") {
      // Kasa açıldı: yükselen üçlü.
      nota(t, 523.25, 0.16, "triangle", 0.7);
      nota(t + 0.08, 659.25, 0.16, "triangle", 0.7);
      nota(t + 0.16, 783.99, 0.3, "triangle", 0.8);
    } else {
      inen(t, 240, 90, 0.28);
    }
  } catch { /* ses olmadan da oynanır */ }
}

/** Sekme arkaplana alınınca bağlamı askıya al: pil ve sessizlik. */
export function sesiDuraklat(): void {
  if (ctx && ctx.state === "running") { try { void ctx.suspend(); } catch { /* yok say */ } }
}
