// Girdi zamanlaması: dokunuş kare sınırına yuvarlanmamalı.
//
// Regresyon: dokunuş kuyruğu sayaçtı ve karenin ilk fizik adımında boşaltılıyordu.
// 60 fps'te bu ±8,3 ms sapma demekti — en zor bölümlerde oyuncunun TÜM hata payının
// (25 ms) üçte biri. Üstelik sapma ekran hızına bağlıydı: 120 Hz telefonda oyun
// 60 Hz telefondan daha kolay oluyordu. Artık dokunuş kendi zaman damgasını taşır.
import test from "node:test";
import assert from "node:assert";

interface SahteOlay { isPrimary?: boolean; repeat?: boolean; code?: string; timeStamp: number; target?: unknown; preventDefault: () => void }
type Dinleyici = (e: SahteOlay) => void;

const dinleyiciler = new Map<string, Dinleyici[]>();
const sahteEleman = {
  addEventListener: (t: string, f: Dinleyici) => {
    if (!dinleyiciler.has(t)) dinleyiciler.set(t, []);
    dinleyiciler.get(t)!.push(f);
  },
  removeEventListener: () => {}
};
Object.defineProperty(globalThis, "window", { value: sahteEleman, configurable: true });
Object.defineProperty(globalThis, "Element", { value: class {}, configurable: true });
Object.defineProperty(globalThis, "performance", { value: { now: () => 0 }, configurable: true });

const { girdiBagla } = await import("./input.ts");
const girdi = girdiBagla(sahteEleman as unknown as HTMLCanvasElement);

const dokun = (t: number): void => {
  for (const f of dinleyiciler.get("pointerdown") ?? []) f({ isPrimary: true, timeStamp: t, target: null, preventDefault: () => {} });
};
const tusla = (t: number, code = "Space"): void => {
  for (const f of dinleyiciler.get("keydown") ?? []) f({ code, repeat: false, timeStamp: t, target: null, preventDefault: () => {} });
};

test("dokunuş zaman damgasına ulaşılmadan işlenmez", () => {
  girdi.temizle();
  dokun(1000);
  assert.equal(girdi.al(999), 0, "damgadan önce işlenmemeli");
  assert.equal(girdi.al(1000), 1, "damgaya ulaşınca işlenmeli");
  assert.equal(girdi.al(2000), 0, "iki kez işlenmemeli");
});

test("dokunuşlar sırayla ve doğru adımlarda çıkar", () => {
  girdi.temizle();
  dokun(100); dokun(200); dokun(300);
  assert.equal(girdi.al(150), 1);
  assert.equal(girdi.al(250), 1);
  assert.equal(girdi.al(350), 1);
  assert.equal(girdi.al(999), 0);
});

test("aynı adımda biriken dokunuşlar birlikte çıkar", () => {
  girdi.temizle();
  dokun(10); dokun(12); dokun(15);
  assert.equal(girdi.al(20), 3);
});

test("GİRDİ KARE HIZINDAN BAĞIMSIZ", () => {
  // Aynı gerçek dokunuş anı, farklı kare hızlarında AYNI fizik adımında işlenmeli.
  const ADIM = 1000 / 120;          // fizik adımı, ms
  const dokunusAni = 507.3;

  /** Bir kare hızında döngüyü sürer ve dokunuşun işlendiği fizik adımını döndürür. */
  const calistir = (fps: number): number => {
    girdi.temizle();
    dokun(dokunusAni);
    const kareSuresi = 1000 / fps;
    let birikim = 0, fizik = 0, adimNo = 0;
    for (let k = 1; k <= 200; k++) {
      const now = k * kareSuresi;
      birikim += kareSuresi;
      let fizikGercek = now - birikim;
      while (birikim >= ADIM) {
        birikim -= ADIM;
        fizikGercek += ADIM;
        adimNo++;
        fizik = fizikGercek;
        if (girdi.al(fizikGercek) > 0) return fizik;
      }
    }
    return -1;
  };

  const a = calistir(60), b = calistir(120), c = calistir(30), d = calistir(90);
  for (const [ad, v] of [["60", a], ["120", b], ["30", c], ["90", d]] as const) {
    assert.ok(v > 0, `${ad} fps: dokunuş hiç işlenmedi`);
    // Fizik adımı 8,33 ms; dokunuş en fazla bir adım GECIKEBILIR, asla erken olamaz.
    assert.ok(v >= dokunusAni, `${ad} fps: dokunuş gerçek anından önce işlendi (${v.toFixed(1)} < ${dokunusAni})`);
    assert.ok(v - dokunusAni <= ADIM + 1e-6,
      `${ad} fps: dokunuş ${(v - dokunusAni).toFixed(1)} ms geç işlendi, en fazla ${ADIM.toFixed(1)} olmalı`);
  }
  // Asıl iddia: kare hızı değişince işlenme anı neredeyse hiç değişmiyor.
  const yayilma = Math.max(a, b, c, d) - Math.min(a, b, c, d);
  assert.ok(yayilma <= ADIM + 1e-6,
    `kare hızına göre ${yayilma.toFixed(1)} ms oynuyor; bir fizik adımından (${ADIM.toFixed(1)} ms) fazla olmamalı`);
});

test("çoklu dokunuşta yalnızca birincil işaretçi sayılır", () => {
  girdi.temizle();
  for (const f of dinleyiciler.get("pointerdown") ?? []) {
    f({ isPrimary: true, timeStamp: 10, target: null, preventDefault: () => {} });
    f({ isPrimary: false, timeStamp: 11, target: null, preventDefault: () => {} });
  }
  assert.equal(girdi.al(100), 1, "ikinci parmak ikinci kilit üretmemeli");
});

test("boşluk ve Enter sayılır, başka tuş sayılmaz", () => {
  girdi.temizle();
  tusla(10, "Space"); tusla(20, "Enter"); tusla(30, "KeyA"); tusla(40, "Escape");
  assert.equal(girdi.al(100), 2);
});

test("basılı tutmak seri kilit üretmez", () => {
  girdi.temizle();
  for (const f of dinleyiciler.get("keydown") ?? []) {
    f({ code: "Space", repeat: false, timeStamp: 10, target: null, preventDefault: () => {} });
    f({ code: "Space", repeat: true, timeStamp: 20, target: null, preventDefault: () => {} });
    f({ code: "Space", repeat: true, timeStamp: 30, target: null, preventDefault: () => {} });
  }
  assert.equal(girdi.al(100), 1);
});

test("temizle bekleyenleri atar", () => {
  girdi.temizle();
  dokun(10); dokun(20);
  girdi.temizle();
  assert.equal(girdi.al(1000), 0, "level değişiminde eski dokunuşlar yenisine geçmemeli");
});

test("damgası olmayan olay şimdiki zamana düşer", () => {
  girdi.temizle();
  for (const f of dinleyiciler.get("pointerdown") ?? []) f({ isPrimary: true, timeStamp: 0, target: null, preventDefault: () => {} });
  assert.equal(girdi.al(0), 1, "damga yoksa dokunuş kaybolmamalı");
});

// --- Dokunma alanı: ekranın tamamı, düğmeler ve örtüler hariç -----------------
//
// Regresyon: dinleyici yalnızca canvas'taydı, üst ve alt çubuk ölü bölgeydi. Alt çubuk
// ipucu için büyüyünce ölü bölge ekranın %29'una çıktı ve tam da başparmağın durduğu
// yere denk geldi: oyuncu kilitlemek için basıyor, hiçbir şey olmuyordu.

/** `closest` yanıtı sahte olan bir hedef; girdi.ts yalnızca bunu kullanır. */
const hedef = (eslesen: string | null) =>
  Object.assign(Object.create(Element.prototype as object), {
    closest: (secici: string) => (eslesen !== null && secici.includes(eslesen) ? {} : null)
  });

const dokunHedefli = (t: number, hedefi: unknown): void => {
  for (const f of dinleyiciler.get("pointerdown") ?? []) {
    f({ isPrimary: true, timeStamp: t, target: hedefi, preventDefault: () => {} });
  }
};

test("çubuklara dokunmak da halkayı kilitler", () => {
  girdi.temizle();
  // Üst/alt çubuk: Element ama düğme değil, örtüde de değil.
  dokunHedefli(10, hedef(null));
  assert.equal(girdi.al(100), 1, "canvas dışına dokunmak da sayılmalı");
});

test("düğmeye dokunmak kilit üretmez", () => {
  girdi.temizle();
  dokunHedefli(10, hedef("button"));
  assert.equal(girdi.al(100), 0, "Ayarlar düğmesine basmak aynı anda halka kilitlememeli");
});

test("örtü açıkken örtüye dokunmak kilit üretmez", () => {
  girdi.temizle();
  dokunHedefli(10, hedef(".ortu"));
  assert.equal(girdi.al(100), 0, "ayarlar/nasıl oynanır ekranına dokunmak oyuna gitmemeli");
});

test("oyun dokunuşunda preventDefault çağrılır, düğmede çağrılmaz", () => {
  girdi.temizle();
  let oyunda = false, dugmede = false;
  for (const f of dinleyiciler.get("pointerdown") ?? []) {
    f({ isPrimary: true, timeStamp: 10, target: hedef(null), preventDefault: () => { oyunda = true; } });
    f({ isPrimary: true, timeStamp: 20, target: hedef("button"), preventDefault: () => { dugmede = true; } });
  }
  assert.ok(oyunda, "oyun dokunuşunda çift dokunuş yakınlaştırması engellenmeli");
  assert.ok(!dugmede, "düğmede preventDefault tıklamayı ve kaydırmayı bozar");
});
