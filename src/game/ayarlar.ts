// Erişilebilirlik ayarları ve ilk açılış uyarısı.
//
// Oyunun görsel uyaranı ışığa duyarlılık rehberlerindeki eşiklerle karşılaştırıldı
// (docs/SPEC.md, 7. bölüm "Işığa duyarlılık"). Yanıp sönme eşiklerin çok altında, ama
// 6 halkalı levellerde desen üç ölçütü birden işaretliyor: yarıçapta 6 açık-koyu çift
// (eşik >5), 1,48 çevrim/derece uzamsal frekans (riskli bant 1-4) ve 0,96 Michelson
// kontrast (riskli >0,4). Deseni küçük tutan şey görüş açısı: telefonda sadece 11°.
// Yine de bir uyarı ve bir yumuşatma seçeneği sunuyoruz.

import { gecerliDilMi } from "../dil/index.ts";
import type { DilKodu } from "../dil/index.ts";

const KEY = "donence:ayarlar:v1";
/** Oyunun eski adıyla yazılmış ayarlar. Bulunursa okunur ve yeni anahtara taşınır. */
const ESKI_KEY = "kasa:ayarlar:v1";

export interface Ayarlar {
  /** Kilitsiz halkaların opaklığı düşürülür; en yüksek kontrastlı durumu hedefler. */
  desenYumusat: boolean;
  /** Sistem tercihinden bağımsız olarak sarsıntı ve flaşı kapatır. */
  hareketAzalt: boolean;
  /** Kilitte ve kayıpta telefon titreşimi. */
  titresim: boolean;
  /**
   * Ses. Varsayılan AÇIK: tek dokunuşla oynanan bir oyunda dokunuşun ödülü sestir,
   * ve iOS'ta titreşim desteklenmediği için orada tek dokunsal olmayan geri bildirim
   * kanalı budur.
   */
  ses: boolean;
  /** İlk açılış uyarısı gösterildi mi. */
  uyariGoruldu: boolean;
  /**
   * Oyuncunun seçtiği dil. **null = cihazın dilini izle** (varsayılan).
   *
   * Varsayılanın "tr" değil null olması önemli: küresel pazara çıkan bir oyunda
   * Almanya-daki biri uygulamayı açtığında Türkçe görürse ayarları bulamaz ve siler.
   * null ile cihaz ne diyorsa o gelir; oyuncu isterse üstüne yazar ve seçimi kalır.
   */
  dil: DilKodu | null;
}

const varsayilan = (): Ayarlar => ({ desenYumusat: false, hareketAzalt: false, titresim: true, ses: true, uyariGoruldu: false, dil: null });

export function ayarlariOku(): Ayarlar {
  try {
    const ham = localStorage.getItem(KEY) ?? localStorage.getItem(ESKI_KEY);
    if (!ham) return varsayilan();
    const o = JSON.parse(ham) as Record<string, unknown>;
    const a = varsayilan();
    if (typeof o.desenYumusat === "boolean") a.desenYumusat = o.desenYumusat;
    if (typeof o.hareketAzalt === "boolean") a.hareketAzalt = o.hareketAzalt;
    if (typeof o.titresim === "boolean") a.titresim = o.titresim;
    if (typeof o.ses === "boolean") a.ses = o.ses;
    if (typeof o.uyariGoruldu === "boolean") a.uyariGoruldu = o.uyariGoruldu;
    if (gecerliDilMi(o.dil)) a.dil = o.dil;
    if (!localStorage.getItem(KEY)) ayarlariYaz(a);
    return a;
  } catch {
    return varsayilan();
  }
}

export function ayarlariYaz(a: Ayarlar): void {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* kayıt olmadan da oynanır */ }
}

/** Kilitsiz halkaların çizim opaklığı. */
export const halkaOpakligi = (a: Ayarlar): number => a.desenYumusat ? 0.25 : 0.4;

/**
 * Telefon titreşimi destekleniyor mu? iOS Safari `navigator.vibrate` sağlamaz;
 * orada ayarı göstermenin anlamı yok.
 */
export const titresimVarMi = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Kilitte kısa, kayıpta belirgin. Ayar kapalıysa ya da cihaz desteklemiyorsa sessiz. */
export function titret(a: Ayarlar, tur: "kilit" | "kayip" | "acildi"): void {
  if (!a.titresim || !titresimVarMi()) return;
  const desen = tur === "kilit" ? 12 : tur === "acildi" ? [18, 40, 18] : 45;
  try { navigator.vibrate(desen); } catch { /* titreşim olmadan da oynanır */ }
}
