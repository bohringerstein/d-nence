// ===== ORTAK ÇEKİRDEK: oyun ve level üretici aynı kodu kullanır =====
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
// Topun geçmesi için gereken en küçük açıklık (top yarıçapı / iç halka yarıçapı oranından; ekran boyutundan bağımsız)
const NEED = 2 * Math.asin(0.022 / 0.17) + 3 * DEG;
const REACT = 0.3;
const norm = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
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
if (typeof module !== "undefined") module.exports = { TAU, DEG, NEED, REACT, norm, stepRings, gapCenters, liveRings };
