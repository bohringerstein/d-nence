// English text.
//
// Not a literal translation. The Turkish how-to was written sentence by sentence and a
// word-for-word rendering would read worse than either; these were rewritten in English
// to say the same thing as plainly.
//
// Terminology (kept consistent everywhere): kasa = vault, halka = ring, boşluk = gap,
// kama = wedge, kanal/yol = path, kilitlemek = lock, deneme = try.
import type { Metinler } from "./tipler.ts";

/** "1 levels opened" olmasın diye: İngilizcede sayı 1 ise tekil. */
const cogul = (n: number, tekil: string, coklu: string): string => `${n} ${n === 1 ? tekil : coklu}`;

export const EN: Metinler = {
  kod: "en",
  yerel: "en-GB",
  ad: "English",

  oyunAlani: "Play area. Tap to lock the next ring.",
  duraklatDugmesi: "Pause",
  kalanSureSesli: saniye => `${saniye} seconds left`,
  levelOneki: "Level",
  patronEki: ", boss",
  ayarlar: "Settings",
  tamam: "Done",
  nasilOynanir: "How to play",
  bastanBasla: "Start over",
  bastanBaslaAciklama: "Goes back to level 1 and locks the levels you opened. Your stars stay.",
  bastanBaslaOnay: level => `Are you sure? You will lose level ${level}`,
  anladim: "Got it",

  bolumSec: "Choose a level",
  bolumSecAciklama: "You can go back to any level you have opened. Your progress stays.",
  bolumAraligi: (bas, son) => `${bas}–${son}`,
  oncekiSayfa: "Previous hundred levels",
  sonrakiSayfa: "Next hundred levels",
  bolumEtiketi: (n, yildiz) =>
    yildiz > 0 ? `Level ${n}, ${cogul(yildiz, "star", "stars")}` : `Level ${n}, not finished yet`,
  bolumKilitli: n => `Level ${n}, locked`,

  ilerlemeYok: "No levels opened yet.",
  ilerleme: (bolum, yildiz, enCok) =>
    `${cogul(bolum, "level", "levels")} opened · ${yildiz} / ${enCok} stars`,
  desen: { baslik: "Soften the pattern", aciklama: "Unlocked rings are drawn fainter." },
  hareket: { baslik: "Reduce motion", aciklama: "Turns off the shake and screen flash on a loss." },
  ses: { baslik: "Sound", aciklama: "A short note on each lock; the pitch rises as the path narrows." },
  titresim: { baslik: "Vibration", aciklama: "The phone vibrates on a lock and on a loss." },
  dil: "Language",
  grupOyun: "Game",
  grupGorunum: "Look and feel",
  yedek: "Back up progress",
  yedekAciklama: "The only way to carry your progress to another phone.",
  yedekKopyala: "Copy the code",
  yedekKopyalandi: "Copied",
  yedekYapistir: "Paste your backup code here",
  yedekYukle: "Restore",
  yedekYukleOnay: "Are you sure? Your current progress will be erased",
  yedekGecersiz: "Could not read the code",
  yedekYuklendi: bolum => `Progress restored: ${cogul(bolum, "level", "levels")}`,
  gizlilik: "Privacy policy",

  duraklatildi: "Paused",
  duraklatAciklama: kalan => `${kalan} seconds left. The rings are waiting exactly where you stopped them.`,
  devamEt: "Resume",

  kasaAcildi: "Vault opened",
  bitisMetni: (toplam, bolum, yildiz, enCok) =>
    `You opened all ${toplam} vaults. You collected ${yildiz} stars across ` +
    `${cogul(bolum, "level", "levels")}` +
    (yildiz < enCok ? `; for all ${enCok} you will need to open them cleaner.` : ". Every one of them clean."),
  bastanOyna: "Play again",

  ogretici: {
    1: "Tap to lock the outer ring",
    2: "The yellow wedge is the shared opening. Line the next gap up with it",
    3: "Stars depend on how wide the path still is when the vault opens",
    4: "Tip: time the first lock as the second ring's gap comes round"
  },
  ozellik: {
    preLocked: "The ring with a square starts locked — it sets the path's direction",
    gaps2: "A ring with two gates: which one you use changes what is left for the rest",
    flip: "Rings with a red dot reverse direction now and then",
    wobble: "Some rings speed up and slow down"
  },
  deneme: n => `Try ${n}`,
  denemeVeIpucu: (n, ipucu) => `Try ${n} · ${ipucu}`,
  denemeVeRekor: (n, yildiz) => `Try ${n}, best ${yildiz}`,
  enIyin: (yildiz, sure) => `Best ${yildiz} ${sure} s`,
  ilkDokunus: "Tap to lock the next ring",
  sureDoldu: "Out of time",

  aciklikKapandi: "Path closed",
  kilPayiKayip: "Path closed · by a hair",
  erkenDaraldi: "Path closed · it narrowed too early",
  darKaldi: derece => `Path closed · missed by ${derece}°`,

  yildizEtiketi: { 3: "Clean open", 2: "Good open", 1: "Opened" },
  sonucSatiri: (etiket, yildiz, sure) => `${etiket} ${yildiz} ${sure} s`,
  yildizaKalan: (yildiz, yuzde) => ` · ${yuzde}% short of ${yildiz} stars`,
  rekorEki: ", new best",

  patron: {
    ayna: { ad: "Mirror", ipucu: "They all line up at the same moment — wait for it, then tap fast" },
    merkez: { ad: "Core", ipucu: "The locked ring in the middle is showing you the path" },
    metronom: { ad: "Metronome", ipucu: "The rings swing back and forth; catch them crossing the middle" },
    catal: { ad: "Fork", ipucu: "Every ring has two gates, and the one you pick decides the next" },
    tavsanKaplumbaga: { ad: "Tortoise and hare", ipucu: "The slow ones ask for patience, the fast ones for sharp aim" },
    buyukKasa: { ad: "Grand vault", ipucu: "Everything at once: speed, direction, two gates" },
    sonKasa: { ad: "Final vault", ipucu: "The last of a thousand. Whatever you have left, use it now" }
  },

  nasil: {
    baslik: "How to play",
    giris: `Every tap locks the next ring right where it is, working <b>from the outside in</b>.
Where the gaps of the locked rings overlap is the <b>yellow wedge</b>: the ball's way out.
Each new lock can only <b>narrow</b> it. If it gets too narrow for the ball, you lose.
Lock every ring and the vault opens. <b>Running out of time also loses the level</b> — the number at the top is your time left.`,
    satir: {
      kama: {
        baslik: "Yellow wedge",
        metin: "Your way out as it stands. Line the next ring's gap up with it. A wedge outlined in dashed red is too narrow for the ball."
      },
      flip: {
        baslik: "Red dot",
        metin: "This ring <b>reverses direction</b> now and then. Watch it turn before you tap."
      },
      preLocked: {
        baslik: "Small square",
        metin: "The light square sitting on a ring: that ring <b>starts locked</b>. It sets the direction of the path and you cannot change it."
      },
      gaps2: {
        baslik: "Two gaps",
        metin: "This ring has <b>two gates</b>. Which one you use changes the margin left for the rings after it."
      },
      wobble: {
        baslik: "Variable speed",
        metin: "This ring does not turn at a steady speed — it <b>speeds up and slows down</b>. There is no marker for it; you recognise it by its movement. Wait for the slow moment."
      },
      duraklat: {
        baslik: "Pause",
        metin: "<b>Tap the timer</b> at the top and the game stops on that exact frame. When you resume it counts down from three; the rings stay put until the count ends."
      }
    },
    yildizlar: `<b>Stars measure precision, not speed.</b> The wider the path still is when the
vault opens, the more stars you get. Finishing fast earns no stars on its own; time only
breaks ties between equal stars.`,
    uyari: `Dönence has rings turning inside one another. If you have photosensitive epilepsy
or a history of discomfort from patterns, you can turn on &ldquo;Soften the pattern&rdquo; in
<b>Settings</b> and take breaks while you play.`
  },

  rekorlarYenilendi: "Levels were rebuilt, records reset",
  yukleniyor: "Loading levels…",
  tabloIndirilemediBaslik: "Could not load the levels",
  tabloIndirilemediMetin: "Check your connection and try again. Once the game has opened, it works offline too.",
  tekrarDene: "Try again",
  tabloHatasiBaslik: "Could not read the level table",
  tabloHatasiMetin: "For the developer: run <code>npm run verify</code>."
};
