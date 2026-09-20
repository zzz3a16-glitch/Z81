/**
 * gen-animations.mjs — bakes zPopcorn's six meaningful-state Lottie files into
 * src/assets/anim/*.json for the Lordicon player (@lordicon/element).
 * Hand-authored Lottie (no export tooling): 64×64 canvas, round strokes 5u
 * (≈1.7px at 24 — same optical weight as the Phosphor family), one color
 * token __AC__ that IconFX swaps for the live accent at runtime.
 */
import fs from 'node:fs';
const V = '__AC__';                 // accent token replaced at runtime
const sh = (o, ks) => ({ ty: 'sh', ks });
const st = (w = 5) => ({ ty: 'st', c: { a: 0, k: hex(w) }, o: { a: 0, k: 100 }, w: { a: 0, k: w }, lc: 2, lj: 2 });
function hex() { return [parseInt(V.slice(2, 4), 16) / 255, parseInt(V.slice(4, 6), 16) / 255, parseInt(V.slice(6, 8), 16) / 255, 1]; }
// stroke color must be tokenized textually — build with placeholder then string-replace
const C = '"#AC#"';
const colorObj = { a: 0, k: '#AC#' };
const stroke = (w) => ({ ty: 'st', c: colorObj, o: { a: 0, k: 100 }, w: { a: 0, k: w }, lc: 2, lj: 2 });
const trim = (start, end, e) => ({ ty: 'tm', s: start, e: end, o: { a: 0, k: 0 }, m: 1 });
const kf = (t0, v0, t1, v1, ease = false) => ease
  ? { a: 1, k: [{ t: t0, s: v0, i: { x: [.4], y: [1] }, o: { x: [.6], y: [0] } }, { t: t1, s: v1 }] }
  : { a: 1, k: [{ t: t0, s: v0 }, { t: t1, s: v1 }] };
const stat = (v) => ({ a: 0, k: v });
const ell = (cx, cy, rx, ry = rx) => ({ ty: 'el', p: stat([cx, cy]), s: stat([rx * 2, ry * 2]), d: 1 });
const strk = (pts, closed = false) => ({ ty: 'sh', ks: stat({ i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), v: pts, c: closed }) });
const layer = (shapes, extra = {}, ind = 1) => ({ ddd: 0, ty: 4, ind, nm: 'l' + ind, sr: 1,
  ks: { o: stat(100), r: stat(0), p: stat([32, 32, 0]), a: stat([0, 0, 0]), s: stat([100, 100, 100]), ...extra },
  ao: 0, shapes: [{ ty: 'gr', it: [...shapes, { ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100) }] }], ip: 0, op: 90, st: 0 });
const doc = (layers, fr = 30, op = 90) => ({ v: '5.7.4', fr, ip: 0, op, w: 64, h: 64, nm: 'zpop', ddd: 0, assets: [], layers, markers: [] });
fs.mkdirSync('src/assets/anim', { recursive: true });
const out = {};

/* loading — 270° ring that rotates + trim breathes */
out.loading = doc([layer([ ell(0, 0, 11), stroke(5),
  { ty: 'tm', s: { a: 1, k: [{ t: 0, s: [0] }, { t: 90, s: [0] }] }, e: { a: 1, k: [{ t: 0, s: [72] }, { t: 45, s: [22] }, { t: 90, s: [72] }] }, o: stat(0), m: 1 } ],
  { r: kf(0, 0, 90, 360, false) })], 30, 90);

/* success — circle draws itself, check draws after, brief settle scale */
out.success = doc([
  layer([ ell(0, 0, 15), stroke(4),
    { ty: 'tm', s: stat(0), e: kf(0, 0, 30, 100), o: stat(0), m: 1 } ]),
  layer([ strk([[-6.5, 0.5], [-1.5, 6], [8, -6.5]]), stroke(5),
    { ty: 'tm', s: stat(0), e: kf(22, 0, 50, 100), o: stat(0), m: 1 } ]),
], 30, 62);

/* error — x pops in with two strokes, container pulse */
out.error = doc([
  layer([ ell(0, 0, 15), stroke(4),
    { ty: 'tm', s: stat(0), e: kf(0, 0, 24, 100), o: stat(0), m: 1 } ]),
  layer([ strk([[-6, -6], [6, 6]]), stroke(5.5) ], { o: kf(0, 0, 10, 100), s: kf(0, [70, 70, 100], 14, [100, 100, 100], true) }),
  layer([ strk([[6, -6], [-6, 6]]), stroke(5.5) ], { o: kf(4, 0, 14, 100), s: kf(4, [70, 70, 100], 18, [100, 100, 100], true) }),
], 30, 52);

/* syncing — two counter arcs chase each other (refresh dialect of the family) */
out.syncing = doc([
  layer([ { ty: 'el', p: stat([0, 0]), s: stat([30, 30]), d: 1 }, stroke(4.5),
    { ty: 'tm', s: stat(55), e: stat(100), o: stat(0), m: 1 } ], { r: kf(0, 0, 60, 360) }),
  layer([ { ty: 'el', p: stat([0, 0]), s: stat([30, 30]), d: 1 }, stroke(4.5),
    { ty: 'tm', s: stat(5), e: stat(50), o: stat(0), m: 1 } ], { r: kf(0, 0, 60, 360), o: stat(45) }, 2),
], 30, 60);

/* importing — arrow descends into a tray, loops */
out.importing = doc([
  layer([ strk([[0, -9], [0, 1]]), stroke(5) ], { p: kf(0, [32, 22, 0], 60, [32, 27, 0]), o: kf(0, 0, 10, 100) }),
  layer([ strk([[-4, -3], [0, 1], [4, -3]]), stroke(5) ], { p: kf(0, [32, 27, 0], 60, [32, 32, 0]), o: kf(0, 0, 10, 100) }),
  layer([ strk([[-11, -4], [-11, 2], [11, 2], [11, -4]]), stroke(4.5) ], { p: stat([32, 40, 0]), o: stat(100) }),
], 30, 60);

/* empty — soft floating tray (library is calm, not broken) */
out.empty = doc([
  layer([ strk([[-12, -3], [-8, -9], [8, -9], [12, -3]]), stroke(4.5) ], { p: kf(0, [32, 26, 0], 45, [32, 23, 0]), o: stat(55) }),
  layer([ strk([[-12, -3], [-12, 5], [12, 5], [12, -3], [4, -3], [0, 1], [-4, -3]], false), stroke(4.5) ], { p: kf(0, [32, 36, 0], 45, [32, 33.5, 0]), s: { a: 1, k: [{ t: 0, s: [100, 100, 100], i: { x: [.4], y: [1] }, o: { x: [.6], y: [0] } }, { t: 45, s: [103, 103, 100] }, { t: 90, s: [100, 100, 100] }] } }),
], 30, 90);

for (const [n, json] of Object.entries(out)) {
  const txt = JSON.stringify(json).replaceAll('"#AC#"', '0.48,0.42,0.96,1').replaceAll('&quot;', '"');
  // keep token as rgb triple for the runtime rewriter
  fs.writeFileSync(`src/assets/anim/${n}.json`, txt.replace(/0\.48,0\.42,0\.96,1/g, '@@AC@@'));
  console.log('wrote', `src/assets/anim/${n}.json`, (txt.length / 1024).toFixed(1) + 'KB');
}
