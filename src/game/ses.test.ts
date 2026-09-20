// Ses: sentezlenen notalar ve sessiz kalması gereken durumlar.
//
// Ses bu türde dekorasyon değil, dokunuşun ödülü. Ama oyun sessiz bir ortamda da,
// AudioContext olmayan bir tarayıcıda da hatasız çalışmak zorunda.
import test from "node:test";
import assert from "node:assert";

interface SahteOsc { type: string; frequency: { degerler: number[]; setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void }; connect: () => void; start: () => void; stop: () => void }

const notalar: SahteOsc[] = [];
let kazanclar = 0;
let durum = "running";
let resumeSayisi = 0;

class SahteCtx {
  currentTime = 0;
  destination = {};
  get state() { return durum; }
  createOscillator(): SahteOsc {
    const o: SahteOsc = {
      type: "sine",
      frequency: {
        degerler: [],
        setValueAtTime(v: number) { o.frequency.degerler.push(v); },
        exponentialRampToValueAtTime(v: number) { o.frequency.degerler.push(v); }
      },
      connect: () => {}, start: () => {}, stop: () => {}
    };
    notalar.push(o);
    return o;
  }
  createGain() {
    kazanclar++;
    return { gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} };
  }
  resume() { resumeSayisi++; durum = "running"; return Promise.resolve(); }
  suspend() { durum = "suspended"; return Promise.resolve(); }
}

Object.defineProperty(globalThis, "window", {
  value: { AudioContext: SahteCtx as unknown as typeof AudioContext },
  configurable: true
});

const { cal, sesiAc, sesVarMi, sesiDuraklat } = await import("./ses.ts");

const ayar = (ses: boolean) => ({ ses });
const sifirla = (): void => { notalar.length = 0; };

test("ses desteği algılanıyor", () => {
  assert.equal(sesVarMi(), true);
});

test("ayar kapalıyken hiç nota çalmaz", () => {
  sifirla();
  cal(ayar(false), "kilit");
  cal(ayar(false), "acildi");
  cal(ayar(false), "kayip");
  assert.equal(notalar.length, 0, "ses kapalıyken osilatör üretilmemeli");
});

test("kilit tek nota, açılış üç nota", () => {
  sifirla(); cal(ayar(true), "kilit");
  assert.equal(notalar.length, 1);
  sifirla(); cal(ayar(true), "acildi");
  assert.equal(notalar.length, 3, "kasa açılışı yükselen üçlü");
});

test("kanal daraldıkça kilit perdesi yükselir", () => {
  // Oyuncu sıkıştığını ekrana bakmadan da duymalı: bu, kaybın neden geldiğini
  // anlatan ikinci kanal (görseli için render.ts'teki kırmızı kama).
  const perde = (aciklik: number): number => {
    sifirla(); cal(ayar(true), "kilit", aciklik);
    return notalar[0].frequency.degerler[0];
  };
  const ferah = perde(1), orta = perde(0.5), sikisik = perde(0);
  assert.ok(sikisik > orta && orta > ferah,
    `perde daralmayla yükselmeli: ferah ${ferah}, orta ${orta}, sıkışık ${sikisik}`);
});

test("açıklık aralık dışında kalsa da nota üretilir", () => {
  // Kayan nokta hatası ya da ileride gelecek bir değişiklik 0-1 dışına taşırsa
  // dizi sınırı aşılıp undefined frekans üretilmemeli.
  for (const v of [-5, 1.5, NaN]) {
    sifirla();
    cal(ayar(true), "kilit", v);
    assert.equal(notalar.length, 1, `açıklık ${v} için nota üretilmeli`);
    assert.ok(Number.isFinite(notalar[0].frequency.degerler[0]), `açıklık ${v} için frekans sayı olmalı`);
  }
});

test("askıdaki bağlam uyandırılır", () => {
  durum = "suspended";
  const once = resumeSayisi;
  sesiAc();
  assert.ok(resumeSayisi > once, "suspended bağlam resume edilmeli (iOS bunu gerektirir)");
  assert.equal(durum, "running");
});

test("duraklatma bağlamı askıya alır", () => {
  durum = "running";
  sesiDuraklat();
  assert.equal(durum, "suspended");
  durum = "running";
});

test("AudioContext yoksa çağrılar hata vermez", async () => {
  // Eski tarayıcı ya da ses üretmeyen ortam: oyun sessiz çalışmalı, çökmemeli.
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  // Sorgu eki modülü ikinci kez yükletir (modül önbelleği anahtarı değişir). Yol değişken
  // tutuluyor ki tip denetimi onu gerçek bir dosya sanıp çözümlemeye çalışmasın.
  const yol = "./ses.ts?yeniden";
  const temiz = await import(yol) as typeof import("./ses.ts");
  assert.equal(temiz.sesVarMi(), false);
  assert.doesNotThrow(() => { temiz.sesiAc(); temiz.cal({ ses: true }, "kilit"); temiz.sesiDuraklat(); });
});
