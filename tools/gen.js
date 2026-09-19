// Kasa level üretici. Kullanım:
//   node tools/gen.js           -> data/levels.json dosyasını yeniden üretir (sabit tohum, her seferinde aynı sonuç)
//   node tools/gen.js --verify  -> mevcut data/levels.json dosyasını sanal oyuncularla test eder
const fs = require("fs"); const path = require("path");
const { TAU, DEG, NEED, REACT, norm, stepRings, gapCenters, liveRings } = require("./core.js");
const OUT = path.join(__dirname, "..", "data", "levels.json");
let seed = 12345; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let es = 1; const ER = () => { es = (es * 16807) % 2147483647; return es / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(ER() + 1e-9)) * Math.cos(TAU * ER());
const rnd4 = x => Math.round(x * 1e4) / 1e4;
const needS = NEED + 2 * TAU / 720;

function lockInto(ch, r) { // kilit sonrası açıklık; en geniş sonucu verir
  const h = r.gap * DEG / 2;
  if (!ch) return { c: r.angle, w: h * 2 };
  let best = null;
  for (const g of gapCenters(r)) {
    const d = norm(g - ch.c), lo = Math.max(-ch.w / 2, d - h), hi = Math.min(ch.w / 2, d + h);
    if (!best || hi - lo > best.w) best = { c: ch.c + (lo + hi) / 2, w: hi - lo };
  }
  return best;
}
function initialChannel(rs) { let ch = null; for (const r of rs) if (r.locked) ch = lockInto(ch, r); return ch; }

// Referans çözücü: hemen ilk kilit, hata payını eşit böl, kusursuz zamanlama
function solve(def) {
  const rs = liveRings(def), dt = 1 / 120; let ch = initialChannel(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r.locked) continue;
    const rem = rs.filter((x, k) => k > i && !x.locked).length; const until = t + 30; let done = false;
    while (t < until) {
      if (t >= last + REACT) {
        if (!ch) { ch = lockInto(null, r); done = true; }
        else { const allow = (ch.w - needS) / (rem + 1), h = r.gap * DEG / 2;
          for (const g of gapCenters(r)) { const d = norm(g - ch.c), lo = Math.max(-ch.w / 2, d - h), hi = Math.min(ch.w / 2, d + h);
            if (hi - lo >= needS && ch.w - (hi - lo) <= allow) { ch = { c: ch.c + (lo + hi) / 2, w: hi - lo }; done = true; break; } } }
        if (done) { r.locked = true; last = t; break; }
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return null;
  }
  return t;
}
// İnsan benzeri oyuncu: dokunuşu ±sigma sn sapar
function play(def, limit, { tol = 0.7, sigma = 0.06 } = {}) {
  const rs = liveRings(def), dt = 1 / 120; let ch = initialChannel(rs), t = 0, last = 0;
  for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r.locked) continue;
    const rem = rs.filter((x, k) => k > i && !x.locked).length; let done = false;
    while (t < limit) {
      let want = false;
      if (t >= last + REACT) {
        if (!ch) want = true;
        else { const allow = (ch.w - needS) / (rem + 1) * tol, h = r.gap * DEG / 2;
          for (const g of gapCenters(r)) { const d = norm(g - ch.c), lo = Math.max(-ch.w / 2, d - h), hi = Math.min(ch.w / 2, d + h); if (hi - lo >= needS && ch.w - (hi - lo) <= allow) want = true; } }
      }
      if (want) {
        // Dokunus hatasi: erken de gec de olsa TUM halkalari birlikte sarar (gercek oyunda oyuncu zamani kaydirir, tek halkayi degil)
        const e = gauss() * sigma;
        const sdt = e >= 0 ? dt : -dt;
        for (let k = Math.abs(e); k > 0; k -= dt) { t += sdt; stepRings(rs, sdt, t); }
        ch = lockInto(ch, r); if (ch.w < NEED) return { win: false, t };
        r.locked = true; last = t; done = true; break;
      }
      t += dt; stepRings(rs, dt, t);
    }
    if (!done) return { win: false, t };
  }
  const minGap = Math.min(...def.map(r => r.gap)) * DEG;
  return { win: true, t, q: (ch.w - NEED) / (minGap - NEED) };
}

// Hata payı milisaniye cinsinden: boşluk = gereken açıklık + tolerans süresi × tüm hareketli halkaların hızı toplamı
function sizeGaps(rings, tolSec) {
  const vsum = rings.filter(r => !r.preLocked).reduce((s, r) => s + Math.abs(r.speed) * (r.wobble ? 1.7 : 1), 0);
  let gap = NEED / DEG + tolSec * vsum / DEG;
  gap = Math.min(gap, 110);
  for (const r of rings) {
    r.gap = gap;
    if (r.gaps === 2 && (gap > 80 || r.gapOffset < gap + 30 || 360 - r.gapOffset < gap + 30)) r.gaps = 1;
  }
}

function candidate(n) {
  const count = Math.min(2 + Math.floor((n - 1) / 4), 6);
  const base = Math.min(0.8 + n * 0.03, 2.2);
  const rings = [];
  for (let i = 0; i < count; i++) {
    const dir = n < 3 ? 1 : (R() < 0.5 ? -1 : 1);
    rings.push({ speed: dir * base * (0.7 + R() * 0.6), gap: 0, gaps: n >= 11 && R() < 0.3 ? 2 : 1, gapOffset: 130 + R() * 50,
      flip: n >= 12 && R() < Math.min(0.2 + n * 0.008, 0.45) ? 1.4 + R() * 1.8 : 0, wobble: n >= 18 && R() < 0.3, preLocked: false, start: R() * TAU });
  }
  if (n >= 6 && R() < 0.5) {
    const pre = n >= 15 && count >= 4 && R() < 0.5 ? 2 : 1, anchor = R() * TAU, picks = [];
    while (picks.length < pre) { const k = Math.floor(R() * count); if (!picks.includes(k)) picks.push(k); }
    picks.forEach((k, j) => { Object.assign(rings[k], { preLocked: true, gaps: 1, flip: 0, wobble: false, start: anchor + (j ? (R() - 0.5) * 0.15 : 0) }); });
  }
  // Bosluk genisligini tune() belirler; burada hesaplamak gereksizdi ve yan etkisi
  // (gap > 80 ise gaps 2 -> 1) uretilen iki kapili halkalarin %80'ini yok ediyordu.
  return rings;
}

// ===== Patron levelleri (elle tasarlandı) =====
const A = -Math.PI / 2;
const mk = o => ({ gap: 0, gaps: 1, gapOffset: 150, flip: 0, wobble: false, preLocked: false, ...o });
const BOSSES = {
  10: { name: 'Ayna', hint: 'Hepsi aynı anda hizalanıyor, o anı bekle ve hızlı dokun', tol: 0.2,
    // Hizlar birbirinden farkli olmali: esit hiz + esit start = birebir ayni halka, o kilit acikligi hic daraltmaz.
    // start = A - s * 2.5 oldugu icin hepsi yine t = 2,5 sn'de A acisinda hizalanir.
    rings: () => [1.3, -1.3, 1.9, -1.9].map(s => mk({ speed: s, start: A - s * 2.5 })) },
  20: { name: 'Merkez', hint: 'Ortadaki kilitli halka yolu gösteriyor', tol: 0.15,
    rings: () => [2.0, -1.4, 0, 1.4, -2.0].map((s, i) => mk(i === 2 ? { speed: 1, preLocked: true, start: A } : { speed: s, start: R() * TAU })) },
  30: { name: 'Metronom', hint: 'Halkalar sallanıyor, orta noktadan geçerken yakala', tol: 0.13,
    rings: () => [1.5, -1.6, 1.4, -1.5, 1.6].map(s => mk({ speed: s, flip: 1.2, start: A - s * 0.6 + (R() - 0.5) * 0.4 })) },
  40: { name: 'Çatal', hint: 'Her halkada iki kapı var, hangisini seçtiğin sonrakini belirler', tol: 0.12,
    rings: () => [1.2, -1.5, 1.3, -1.1, 1.6].map(s => mk({ speed: s, gaps: 2, gapOffset: 150 + R() * 30, start: R() * TAU })) },
  50: { name: 'Tavşan ile kaplumbağa', hint: 'Yavaşlar sabırlı, hızlılar keskin nişan ister', tol: 0.11,
    rings: () => [0.5, -2.4, 0.6, -2.5, 0.5, -2.3].map(s => mk({ speed: s, start: R() * TAU })) },
  60: { name: 'Büyük kasa', hint: 'Son kasa. Her şey bir arada', tol: 0.11,
    rings: () => [mk({ speed: 1, preLocked: true, start: A }), mk({ speed: -1.9, flip: 2.1, start: R() * TAU }), mk({ speed: 1.6, gaps: 2, gapOffset: 165, start: R() * TAU }),
      mk({ speed: -1.4, wobble: true, start: R() * TAU }), mk({ speed: 2.1, flip: 1.7, start: R() * TAU }), mk({ speed: -1.7, start: R() * TAU })] }
};

function finalize(rings) {
  const def = rings.map(r => ({ speed: rnd4(r.speed), gap: rnd4(r.gap), gaps: r.gaps, gapOffset: rnd4(r.gapOffset), flip: rnd4(r.flip), wobble: r.wobble, preLocked: r.preLocked, start: rnd4(((r.start % TAU) + TAU) % TAU) }));
  const best = solve(def); if (best == null) return null;
  const moving = def.filter(r => !r.preLocked).length;
  const limit = +Math.max(best * 1.6 + 2, 4 + 1.5 * moving).toFixed(1);
  return { def, best, limit };
}
function evaluate(L, trials = 50) {
  es = 777; let w = 0, qs = []; for (let k = 0; k < trials; k++) { const r = play(L.def, L.limit); if (r.win) { w++; qs.push(r.q); } }
  return { win: w / trials, qs };
}

if (process.argv.includes("--verify")) {
  const data = JSON.parse(fs.readFileSync(OUT, "utf8")); let bad = 0; const rows = [];
  for (const l of data.levels) {
    const best = solve(l.rings); const ev = evaluate({ def: l.rings, limit: l.limit }, 50);
    const ok = best != null && best < l.limit && ev.win >= 0.2; if (!ok) bad++;
    rows.push(`${l.n}${l.boss ? "*" : ""}:${ok ? "" : "HATA "}${Math.round(ev.win * 100)}%`);
  }
  console.log(rows.join("  ")); console.log(bad ? `${bad} level sorunlu` : "Tüm leveller çözülebilir");
  process.exit(bad ? 1 : 0);
}
const target = n => 0.97 - 0.57 * Math.pow((n - 1) / 59, 1.1);
// Yapıyı sabit tutup tolerans süresini ayarlayarak kazanma oranını hedefe oturt
function tune(rawRings, want, lo = 0.03, hi = 0.45) {
  let best = null;
  for (let it = 0; it < 8; it++) {
    const tol = (lo + hi) / 2;
    const rings = rawRings.map(r => ({ ...r })); sizeGaps(rings, tol);
    const L = finalize(rings);
    if (!L) { lo = tol; continue; }
    const ev = evaluate(L, 50);
    const c = { ...L, ...ev, tol };
    if (L.best <= 16 && (!best || Math.abs(c.win - want) < Math.abs(best.win - want))) best = c;
    if (ev.win > want) hi = tol; else lo = tol;
  }
  return best;
}
const levels = []; const allQ = []; let prev = 1;
for (let n = 1; n <= 60; n++) {
  const boss = BOSSES[n];
  const want = boss ? target(n) - 0.12 : Math.min(target(n), prev);
  let pick = null;
  for (let k = 0; k < (boss ? 6 : 8); k++) {
    const raw = boss ? boss.rings() : candidate(n);
    const c = tune(raw, want);
    if (c && (!pick || Math.abs(c.win - want) < Math.abs(pick.win - want))) pick = c;
    if (pick && Math.abs(pick.win - want) < 0.03) break;
  }
  if (!pick) { console.error('level', n, 'bulunamadı'); process.exit(1); }
  if (boss) Object.assign(pick, { boss: boss.name, hint: boss.hint }); else prev = Math.min(prev, pick.win + 0.03);
  pick.qs.forEach(q => allQ.push(q));
  levels.push(pick);
}
allQ.sort((a, b) => a - b);
const pct = p => allQ[Math.floor(allQ.length * p)];
const out = { q3: +pct(0.75).toFixed(2), q2: +pct(0.4).toFixed(2), levels: levels.map((l, i) => ({ n: i + 1, boss: l.boss || null, hint: l.hint || null, limit: l.limit, rings: l.def })) };
fs.writeFileSync(OUT, '{"q3":' + out.q3 + ',"q2":' + out.q2 + ',"levels":[\n' + out.levels.map(l => JSON.stringify(l)).join(',\n') + '\n]}\n');
console.log('yıldız eşikleri q3/q2:', out.q3, out.q2);
console.log(levels.map((l, i) => `${i + 1}${l.boss ? '*' : ''}:${Math.round(l.win * 100)}%/${l.limit}s/${l.def.length}h/${Math.round(l.def[0].gap)}°`).join('  '));
