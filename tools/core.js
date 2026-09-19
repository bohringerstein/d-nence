// ===== ORTAK ÇEKİRDEK =====
// Oyun ve level üretici bu dosyayı paylaşır. Halka hareketi, geometri, açıklık hesabı
// ve yıldız kuralı yalnızca burada yaşar; iki taraf da kendi kopyasını tutmaz.
// Tarayıcıda bu dosya reference/kasa.html içine `tools/sync-prototype.js` ile gömülür.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// Topun geçmesi için gereken en küçük açıklık (top yarıçapı / iç halka yarıçapı oranından;
// ekran boyutundan bağımsız). Geometri oranları değişirse tüm level tablosu yeniden üretilmelidir.
const NEED = 2 * Math.asin(0.022 / 0.17) + 3 * DEG;

// Çember 720 dilime bölünür (dilim başına 0,5°).
const BINS = 720;
const BIN = TAU / BINS;
const NEED_BINS = Math.ceil(NEED / BIN);

// Geçiş eşiği. Oyun dilim sayar, üretici analitik ölçer; ikisi de AYNI eşiği kullansın diye
// eşik dilime yuvarlanmış halidir. Eskiden üç yerde üç farklı değer vardı.
const NEED_PASS = NEED_BINS * BIN;
const canPass = w => w >= NEED_PASS;

// Referans çözücünün kendine bıraktığı pay: insan oyuncunun sapması için yer açar.
const SOLVER_MARGIN = 2 * BIN;

const REACT = 0.3;

const norm = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const wrap = a => ((a % TAU) + TAU) % TAU;

// ---- Halka hareketi ----------------------------------------------------------
// lt: levelin başından beri geçen süre. dt negatif olabilir (simülasyonda geri sarma).
function stepRings(rs, dt, lt) {
  for (const r of rs) {
    if (r.locked) continue;
    r.t += dt;
    if (r.flip && r.t >= r.flip) { r.t = 0; r.dir *= -1; }
    const w = r.wobble ? 1 + 0.7 * Math.sin(lt * 2.3 + r.start) : 1;
    r.angle += r.speed * r.dir * w * dt;
  }
}

function gapCenters(r) {
  const c = [r.angle];
  if (r.gaps === 2) c.push(r.angle + r.gapOffset * DEG);
  return c;
}

const liveRings = def => def.map(r => ({ ...r, angle: r.start, dir: 1, t: 0, locked: !!r.preLocked }));

// ---- Açıklık: analitik aralık modeli ----------------------------------------
// Açık bölge {merkez, genişlik} aralıklarının listesidir. null = henüz hiçbir halka
// kilitlenmedi, tüm çember açık. Her kilit bu listeyi ancak daraltabilir.
const OPEN_ALL = null;

// Geçemeyecek kadar dar aralıklar atılır: kesişim yalnızca daraltacağı için bir daha açılamazlar.
// Bu budama olmadan iki kapılı halkalarda aralık sayısı 2^n büyür.
function lockOpen(open, r) {
  const half = r.gap * DEG / 2;
  const centers = gapCenters(r);
  if (open === OPEN_ALL) return centers.map(c => ({ c, w: half * 2 })).filter(o => canPass(o.w));
  const out = [];
  for (const o of open) {
    for (const c of centers) {
      const d = norm(c - o.c);
      const lo = Math.max(-o.w / 2, d - half), hi = Math.min(o.w / 2, d + half);
      if (hi - lo > 0 && canPass(hi - lo)) out.push({ c: wrap(o.c + (lo + hi) / 2), w: hi - lo });
    }
  }
  return out;
}

// Kilitlenseydi kalan en geniş açıklık ne olurdu? (Halkayı gerçekten kilitlemeden ölçer.)
function peekOpen(open, r) {
  const half = r.gap * DEG / 2;
  const centers = gapCenters(r);
  if (open === OPEN_ALL) return { c: r.angle, w: half * 2 };
  let best = { c: 0, w: 0 };
  for (const o of open) {
    for (const c of centers) {
      const d = norm(c - o.c);
      const lo = Math.max(-o.w / 2, d - half), hi = Math.min(o.w / 2, d + half);
      if (hi - lo > best.w) best = { c: wrap(o.c + (lo + hi) / 2), w: hi - lo };
    }
  }
  return best;
}

const largestOpen = open => open === OPEN_ALL
  ? { c: 0, w: TAU }
  : open.reduce((a, o) => o.w > a.w ? o : a, { c: 0, w: 0 });

// Baştan kilitli halkaları uygula
function initialOpen(rs) { let open = OPEN_ALL; for (const r of rs) if (r.locked) open = lockOpen(open, r); return open; }

// ---- Açıklık: dilim (maske) modeli -------------------------------------------
// Oyun kamaları çizmek için bunu kullanır. Analitik modelle en fazla 1 dilim
// farklı olmalıdır (bkz. tools/core.test.js).
const newMask = () => new Uint8Array(BINS).fill(1);

function applyMask(mask, r) {
  const half = r.gap * DEG / 2, cs = gapCenters(r);
  for (let b = 0; b < BINS; b++) {
    if (!mask[b]) continue;
    const a = (b + 0.5) * BIN;
    mask[b] = cs.some(c => Math.abs(norm(a - c)) <= half) ? 1 : 0;
  }
}

// Çembersel açık dilim dizileri (başa sarmayı hesaba katarak)
function maskRuns(mask) {
  const out = []; let start = -1;
  for (let b = 0; b < BINS; b++) if (!mask[b]) { start = b; break; }
  if (start < 0) return [{ from: 0, to: TAU, len: BINS, w: TAU }];
  let cur = 0, curStart = 0;
  for (let k = 1; k <= BINS; k++) {
    const b = (start + k) % BINS;
    if (mask[b]) { if (!cur) curStart = b; cur++; }
    else if (cur) { out.push({ from: curStart * BIN, to: (curStart + cur) * BIN, len: cur, w: cur * BIN }); cur = 0; }
  }
  return out;
}

function maskLargest(mask) {
  let best = { len: 0, from: 0, to: 0 };
  for (const r of maskRuns(mask)) if (r.len > best.len) best = r;
  return { len: best.len, w: best.len * BIN, center: (best.from + best.to) / 2 };
}

// ---- Yıldız ------------------------------------------------------------------
// Hassasiyeti ölçer, hızı değil: kasa açıldığında kalan açıklığın, levelin en dar
// boşluğuna göre ne kadarını koruyabildin.
function starRatio(widthRad, minGapRad) { return (widthRad - NEED) / (minGapRad - NEED); }
function starCount(q, q3, q2) { return q >= q3 ? 3 : q >= q2 ? 2 : 1; }

const API = {
  TAU, DEG, NEED, BINS, BIN, NEED_BINS, NEED_PASS, SOLVER_MARGIN, REACT, OPEN_ALL,
  norm, wrap, stepRings, gapCenters, liveRings,
  canPass, lockOpen, peekOpen, largestOpen, initialOpen,
  newMask, applyMask, maskRuns, maskLargest,
  starRatio, starCount
};
if (typeof module !== "undefined") module.exports = API;
