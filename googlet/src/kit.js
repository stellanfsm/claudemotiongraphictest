// kit.js — what the Seventh Seal reels share: the 3D phone, the parsed logo,
// a touch indicator, and the frame pipeline (sub-frame motion blur with
// sub-pixel jitter for the 3D layer, a hit-driven camera shake, then the GPU
// post chain). A reel supplies its scenes, timeline and look.

import * as G from './gl3d.js';
import { RED, BLACK, WHITE, MONO, SANS, COND, TAU, clamp, lerp, prog, E, noise1, halton, mk, mono } from './lib.js';

export const K = { R: null, J: [0, 0], MESH: {}, W: 1080, H: 1920 };

// ─── the phone ─────────────────────────────────────────────────────────────
export const PH = { w: 0.78, h: 1.64, d: 0.085, r: 0.13, b: 0.03, sw: 0.73, sh: 1.59, sr: 0.105 };
export const PHONE_MAT = { color: [0.018, 0.018, 0.02], metal: 0.9, rough: 0.28, coat: 0.5 };
const GLASS_MAT = { color: [0.004, 0.004, 0.005], rough: 0.06, coat: 1, metal: 0, shadow: false };
export const screenMat = (tex, rect = [0, 0, 1, 1], emit = 1) => ({ mode: 1, texA: tex, rectA: rect, emit, shadow: false, glass: 1 });
export function phoneItems(model, smat) {
  return [
    { mesh: K.MESH.body, model, mat: PHONE_MAT },
    { mesh: K.MESH.glass, model: G.chain(model, G.T(0, 0, PH.d / 2 + 0.0006)), mat: GLASS_MAT },
    { mesh: K.MESH.screen, model: G.chain(model, G.T(0, 0, PH.d / 2 + 0.0012)), mat: smat },
  ];
}
// screen uv (0..1, v down) → pixel
export function screenPx(vp, model, u, v) {
  const p = G.transformPoint(model, [(u - 0.5) * PH.sw, (0.5 - v) * PH.sh, PH.d / 2 + 0.0012]);
  return G.project(vp, p, K.W, K.H);
}
// 3D layer composited under the current 2D transform
export function gl3(c, items, cam, opts) {
  const r = K.R.render(items, { ...cam, jitter: K.J }, opts);
  c.drawImage(K.R.canvas, 0, 0);
  return r;
}
export const RIG_LIGHT = {
  keyDir: [0.55, 0.8, 0.9],
  keyCol: [1.6, 1.55, 1.5],
  envKick: [2.2, 0.03, 0.08],
  rimCol: [0.9, 0.02, 0.06],
  rimDir: [-0.7, 0.2, -0.6],
  shadow: false,
};
// A phone standing in for a hand-held one: centre (px), on-screen height (px).
// Returns { model, cam } for a camera looking down −z.
export function phoneShot(cx, cy, hpx, { yaw = 0, pitch = 0, roll = 0, z = 0, fov = 0.6 } = {}) {
  const dist = (PH.h * K.H) / hpx / (2 * Math.tan(fov / 2));
  const upx = (2 * dist * Math.tan(fov / 2)) / K.H; // world units per pixel at z = 0
  const model = G.chain(G.T(0, 0, z), G.Ry(yaw), G.Rx(pitch), G.Rz(roll));
  const tx = -(cx - K.W / 2) * upx;
  const ty = (cy - K.H / 2) * upx;
  return { model, cam: { eye: [tx, ty, dist], target: [tx, ty, 0], fov } };
}

// ─── the logo, parsed from the real SVG ────────────────────────────────────
export const LOGO = { rects: [], seventh: null, seal: null };
export const DIA = [
  [13.24, 10.47],
  [21.24, 18.47],
  [13.24, 26.47],
  [5.24, 18.47],
];
export async function initLogo() {
  const svg = await (await fetch('assets/logo-7S.svg')).text();
  LOGO.rects = [...svg.matchAll(/matrix\(-1 0 0 1 ([\d.]+) ([\d.]+)\)/g)].map((m) => [parseFloat(m[1]) - 8, parseFloat(m[2])]);
  const paths = [...svg.matchAll(/<path[^>]*? d="([^"]+)"[^>]*?fill="([^"]+)"/g)];
  LOGO.seventh = new Path2D(paths[1][1]);
  LOGO.seal = new Path2D(paths[2][1]);
}
export function drawSquare(c, cx, cy, s) {
  c.beginPath();
  c.roundRect(cx - 4 * s, cy - 4 * s, 8 * s, 8 * s, s);
  c.fill();
}
export function drawDiamond(c, cx, cy, s = 1, rot = 0) {
  c.save();
  c.translate(cx, cy);
  c.rotate(Math.PI / 4 + rot);
  c.scale(s, s);
  c.beginPath();
  c.roundRect(-3.66, -3.66, 7.32, 7.32, 0.9);
  c.fill();
  c.restore();
}
export function markSmall(c, x, y, s, col) {
  c.fillStyle = col;
  for (const [dx, dy] of DIA) drawDiamond(c, x + (dx - 13.24) * s, y + (dy - 18.47) * s, s);
}
// The full lockup (226 × 82 logo units) at (x, y) with scale k, assembling over
// local time lt (0 = start). Squares pop by diagonal, diamonds drop, wordmark wipes.
export function drawLockup(c, x, y, k, lt, { speed = 1, seal = WHITE } = {}) {
  const u = lt * speed;
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.fillStyle = WHITE;
  for (const [rx, ry] of LOGO.rects) {
    const d = rx + ry;
    const s = E.outBack(prog(u, (d / 140) * 0.32, (d / 140) * 0.32 + 0.25), 2.4);
    if (s > 0) drawSquare(c, rx + 4, ry + 4, s);
  }
  c.fillStyle = RED;
  DIA.forEach(([dx, dy], i) => {
    const T = 0.05 + 0.1 * i;
    const e = E.inQuart(prog(u, T - 0.16, T));
    if (e <= 0) return;
    const land = u - T;
    const sq = land > 0 ? 0.25 * Math.exp(-land * 10) * Math.sin(land * 34) : 0;
    drawDiamond(c, dx, lerp(dy - 30, dy, e), lerp(2.2, 1, e) * (1 + sq), (1 - e) * 1.6);
  });
  for (const [path, col, st] of [
    [LOGO.seventh, RED, 0.34],
    [LOGO.seal, seal, 0.44],
  ]) {
    const p = E.outExpo(prog(u, st, st + 0.45));
    if (p <= 0) continue;
    c.save();
    c.beginPath();
    c.rect(72, 0, 156 * p, 82);
    c.clip();
    c.translate(-(1 - p) * 14, 0);
    c.fillStyle = col;
    c.fill(path);
    c.restore();
  }
  c.restore();
}

// iOS-style touch indicator: a soft disc, pressed = smaller and brighter
export function touch(c, x, y, press = 0, alpha = 1) {
  if (alpha <= 0) return;
  const r = 38 * (1 - 0.18 * press);
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = `rgba(255,255,255,${0.3 + 0.25 * press})`;
  c.strokeStyle = 'rgba(0,0,0,0.25)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
}
export function ripple(c, x, y, p, col = WHITE, r0 = 30, r1 = 120) {
  if (p <= 0 || p >= 1) return;
  c.save();
  c.globalAlpha = 1 - p;
  c.strokeStyle = col;
  c.lineWidth = 6 * (1 - p) + 1;
  c.beginPath();
  c.arc(x, y, lerp(r0, r1, E.outExpo(p)), 0, TAU);
  c.stroke();
  c.restore();
}
export function redGlow(c, x, y, r, a) {
  const g = c.createRadialGradient(x, y, 10, x, y, r);
  g.addColorStop(0, `rgba(255,30,60,${a})`);
  g.addColorStop(0.5, `rgba(255,30,60,${a * 0.35})`);
  g.addColorStop(1, 'rgba(255,30,60,0)');
  c.fillStyle = g;
  c.fillRect(-200, -200, K.W + 400, K.H + 400);
}
export function checkbox(c, x, y, p, pc) {
  // white box at (x, y) top-left 50×50, red tick drawn by pc
  const bs = E.outBack(clamp(p), 3);
  c.save();
  c.translate(x + 25, y + 25);
  c.scale(bs, bs);
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(-25, -25, 50, 50, 8);
  c.fill();
  c.restore();
  if (pc <= 0) return;
  c.strokeStyle = RED;
  c.lineWidth = 8;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const pts = [
    [x + 12, y + 26],
    [x + 22, y + 37],
    [x + 40, y + 14],
  ];
  const l1 = Math.hypot(10, 11);
  const l2 = Math.hypot(18, 23);
  const L = (l1 + l2) * clamp(pc);
  c.beginPath();
  c.moveTo(...pts[0]);
  if (L <= l1) c.lineTo(lerp(pts[0][0], pts[1][0], L / l1), lerp(pts[0][1], pts[1][1], L / l1));
  else {
    c.lineTo(...pts[1]);
    const f = (L - l1) / l2;
    c.lineTo(lerp(pts[1][0], pts[2][0], f), lerp(pts[1][1], pts[2][1], f));
  }
  c.stroke();
  c.lineCap = 'butt';
}

// ─── pipeline ──────────────────────────────────────────────────────────────
export function makeReel({ W, H, FPS, DURATION, SCENES, CUTS, HITS, fns, maxSub = {}, hud, fx, setup }) {
  K.W = W;
  K.H = H;
  let post;
  let sceneCv;
  let sctx;
  let accCv;
  let actx;
  const nextCut = (t) => CUTS.find((c) => c > t + 1e-9) ?? DURATION;
  const sceneAt = (t) => {
    for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
    return 0;
  };
  function camera(t) {
    let sx = 0;
    let sy = 0;
    let rot = 0;
    let zoom = 0;
    HITS.forEach((h, i) => {
      const d = t - h.t;
      if (d < 0 || d > 0.7) return;
      const e = h.s * Math.exp(-d * 10);
      sx += e * 12 * noise1(d * 36 + i * 10);
      sy += e * 12 * noise1(d * 36 + i * 10 + 50);
      rot += e * 0.007 * noise1(d * 28 + i * 7 + 90);
      zoom += h.s * 0.025 * Math.exp(-d * 14);
    });
    return { sx, sy, rot, zoom };
  }
  function drawWorld(c, t, si) {
    const sc = SCENES[si];
    const st = Math.min(t, sc.end - 1e-4);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.setLineDash([]);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.shadowBlur = 0;
    c.shadowColor = 'transparent';
    c.filter = 'none';
    c.fillStyle = BLACK;
    c.fillRect(0, 0, W, H);
    const cam = camera(st);
    c.translate(W / 2 + cam.sx, H / 2 + cam.sy);
    c.rotate(cam.rot);
    c.scale(1 + cam.zoom, 1 + cam.zoom);
    c.translate(-W / 2, -H / 2);
    fns[sc.id](c, st - sc.start, st);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  async function init(canvas) {
    canvas.width = W;
    canvas.height = H;
    post = G.createPost(canvas);
    const g3 = mk(W, H);
    K.R = G.createRenderer(g3);
    sceneCv = mk(W, H);
    sctx = sceneCv.getContext('2d');
    accCv = mk(W, H);
    actx = accCv.getContext('2d');
    await Promise.all(
      [`400 100px ${SANS}`, `500 100px ${SANS}`, `700 100px ${SANS}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 100px ${COND}`].map((f) => document.fonts.load(f, 'ÆØÅæøå7S%')),
    );
    await document.fonts.ready;
    await initLogo();
    const R = K.R;
    K.MESH.body = R.mesh(G.slabGeo(PH.w, PH.h, PH.d, PH.r, PH.b, 12, 6));
    K.MESH.glass = R.mesh(G.panelGeo(PH.w - 0.028, PH.h - 0.028, PH.r - 0.014, 12));
    K.MESH.screen = R.mesh(G.panelGeo(PH.sw, PH.sh, PH.sr, 12));
    K.MESH.box = R.mesh(G.boxGeo(1, 1, 1));
    K.MESH.diamond = R.mesh(G.slabGeo(1, 1, 1, 0.12, 0.08, 4, 3));
    if (setup) await setup();
  }
  function renderFrame(f, { subsamples = 4, shutter = 0.5 } = {}) {
    const t0 = f / FPS;
    const si = sceneAt(t0);
    const n = Math.max(1, Math.min(subsamples, maxSub[SCENES[si].id] ?? subsamples));
    for (let k = 0; k < n; k++) {
      const ts = Math.min(t0 + ((k / n) * shutter) / FPS, nextCut(t0) - 1e-4);
      K.J = n > 1 ? [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5] : [0, 0];
      drawWorld(sctx, ts, si);
      actx.globalCompositeOperation = 'source-over';
      actx.globalAlpha = 1 / (k + 1);
      actx.drawImage(sceneCv, 0, 0);
    }
    actx.globalAlpha = 1;
    if (hud) hud(actx, t0, SCENES[si]);
    post.run(accCv, fx(t0, f, SCENES[si]));
  }
  return { init, renderFrame, totalFrames: Math.round(DURATION * FPS), sceneAt };
}

// the standard post settings with hit-driven aberration and lens breathing
export function fxFrom(HITS, t, f, extra = {}) {
  let ca = 0;
  let lens = 0;
  for (const h of HITS) {
    const d = t - h.t;
    if (d >= 0 && d < 0.6) {
      ca += h.s * Math.exp(-d * 15);
      lens += h.s * Math.exp(-d * 9);
    }
  }
  return { bloom: 0.15, thresh: 0.9, ca: Math.min(ca, 1.6) * 0.006, lens: Math.min(lens, 1.6) * 0.028, grain: 0.032, vignette: 0.32, seed: (f % 97) * 1.37, flash: 0, ...extra };
}

// small brand bug (mere exposure from the first second)
export function brandBug(c, a, col = WHITE, markCol = RED) {
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a * 0.9;
  markSmall(c, 92, 236, 0.95, markCol);
  mono(c, 'SEVENTH SEAL', 122, 244, 22, col, 1, 'left', 600);
  mono(c, 'seventhseal.no', 1008, 244, 22, col, 0.8, 'right', 500);
  c.restore();
}
