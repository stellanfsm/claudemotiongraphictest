// «DITT TREKK» — a vertical 9:16 ad reel for Seventh Seal (seventhseal.no).
//
// Every pixel is a pure function of time, so frames render in any order, in
// parallel, with true sub-frame motion blur. 2D type and UI are drawn on
// canvas; the 3D shots (phones, the flipping tiles, the odometer, the chess
// board) come from a small WebGL2 renderer; a post pass adds bloom, chromatic
// aberration, lens breathing, vignette and grain.

import { W, H, FPS, BEAT, DURATION, SCENES, S, HITS, CUTS, COUNT, GONE, JUDGE, REBUILD, PROOF, OFFER, CTA } from './timeline.js';
import * as G from './gl3d.js';
import {
  RED, DRED, BLACK, WHITE, SANS, MONO, COND, RED_LIN, TAU,
  clamp, lerp, prog, smooth, E, spring, hash, noise1, halton, mix, linHex,
  mk, fillBg, line, layout, text, mono, typed, riseText, riseRich, drawCursor,
} from './lib.js';
import { SW, SH, drawOldSite, drawNewSite, NEW } from './sites.js';

export { W, H, FPS, DURATION };

// ─── state ─────────────────────────────────────────────────────────────────
let R; // 3D renderer
let post; // post chain (draws into the visible canvas)
let sceneCv, sctx, accCv, actx;
let J = [0, 0]; // sub-pixel jitter of the current motion-blur sample
let frameT = 0;
const IMG = {};
const TEX = {};
const MESH = {};
const LOGO = { rects: [], parity: 0 };
// diamond centres in logo units, clockwise from the top
const DIA = [
  [13.24, 10.47],
  [21.24, 18.47],
  [13.24, 26.47],
  [5.24, 18.47],
];

// ─── the logo, parsed from the real SVG ────────────────────────────────────
async function initLogo() {
  const svg = await (await fetch('assets/logo-7S.svg')).text();
  LOGO.rects = [...svg.matchAll(/matrix\(-1 0 0 1 ([\d.]+) ([\d.]+)\)/g)].map((m) => [parseFloat(m[1]) - 8, parseFloat(m[2])]);
  const paths = [...svg.matchAll(/<path[^>]*? d="([^"]+)"[^>]*?fill="([^"]+)"/g)];
  LOGO.seventh = new Path2D(paths[1][1]);
  LOGO.seal = new Path2D(paths[2][1]);
  LOGO.cells = new Set(LOGO.rects.map(([x, y]) => `${Math.round((x - 3.93) / 8)},${Math.round((y - 9.5) / 8)}`));
}
function drawSquare(c, cx, cy, s) {
  c.beginPath();
  c.roundRect(cx - 4 * s, cy - 4 * s, 8 * s, 8 * s, s);
  c.fill();
}
function drawDiamond(c, cx, cy, s = 1, rot = 0) {
  c.save();
  c.translate(cx, cy);
  c.rotate(Math.PI / 4 + rot);
  c.scale(s, s);
  c.beginPath();
  c.roundRect(-3.66, -3.66, 7.32, 7.32, 0.9);
  c.fill();
  c.restore();
}
function markSmall(c, x, y, s, col) {
  c.fillStyle = col;
  for (const [dx, dy] of DIA) drawDiamond(c, x + (dx - 13.24) * s, y + (dy - 18.47) * s, s);
}

// ─── shared 3D bits ────────────────────────────────────────────────────────
const PH = { w: 0.78, h: 1.64, d: 0.085, r: 0.13, b: 0.03, sw: 0.73, sh: 1.59, sr: 0.105 };
const PHONE_MAT = { color: [0.018, 0.018, 0.02], metal: 0.9, rough: 0.28, coat: 0.5 };
const GLASS_MAT = { color: [0.004, 0.004, 0.005], rough: 0.06, coat: 1, metal: 0 };
const screenMat = (tex, rect = [0, 0, 1, 1], emit = 1) => ({ mode: 1, texA: tex, rectA: rect, emit, shadow: false, glass: 1 });

function phoneItems(model, smat) {
  return [
    { mesh: MESH.body, model, mat: PHONE_MAT },
    { mesh: MESH.glass, model: G.chain(model, G.T(0, 0, PH.d / 2 + 0.0006)), mat: { ...GLASS_MAT, shadow: false } },
    { mesh: MESH.screen, model: G.chain(model, G.T(0, 0, PH.d / 2 + 0.0012)), mat: smat },
  ];
}
// screen uv → pixel, for UI that tracks a phone
function screenPx(vp, model, u, v) {
  const p = G.transformPoint(model, [(u - 0.5) * PH.sw, (0.5 - v) * PH.sh, PH.d / 2 + 0.0012]);
  return G.project(vp, p, W, H);
}
function gl3(c, items, cam, opts) {
  const r = R.render(items, { ...cam, jitter: J }, opts);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(R.canvas, 0, 0);
  c.restore();
  return r;
}
// Like gl3, but composites under the current 2D camera transform (shake).
function gl3cam(c, items, cam, opts) {
  const r = R.render(items, { ...cam, jitter: J }, opts);
  c.drawImage(R.canvas, 0, 0);
  return r;
}
function quadPath(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}

// ════════════════════════════════════════════════════════════════════════════
// 01 — COUNT: «Nettsiden din har 3 sekunder.» A thousand visitors (cursors)
// form the digits; the ring runs down in real seconds.
// ════════════════════════════════════════════════════════════════════════════
const SW_N = 1000;
const CX = 540;
const CY = 905;
const SWARM = { cur: [], digits: [] };
let SPRITE;

function sampleGlyph(ch, n, seed) {
  const cv = mk(W, H);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.font = `400 880px ${COND}`;
  const m = c.measureText(ch);
  const x = CX - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const y = CY - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  c.fillStyle = '#fff';
  c.fillText(ch, x, y);
  const img = c.getImageData(0, 0, W, H).data;
  const inside = (px, py) => px >= 0 && py >= 0 && px < W && py < H && img[((py | 0) * W + (px | 0)) * 4 + 3] > 140;
  let step = 14;
  let pts = [];
  for (let tries = 0; tries < 12; tries++) {
    pts = [];
    for (let gy = 0; gy < H; gy += step) {
      for (let gx = 0; gx < W; gx += step) {
        const k = (gx * 31 + gy * 17) | 0;
        const px = gx + (hash(k + seed) - 0.5) * step * 0.9;
        const py = gy + (hash(k + seed + 999) - 0.5) * step * 0.9;
        if (inside(px, py)) pts.push([px, py]);
      }
    }
    if (pts.length >= n * 1.05) break;
    step *= 0.85;
  }
  // deterministic shuffle, keep n, then order by angle so morphs flow
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(hash(i * 7 + seed) * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  pts = pts.slice(0, n);
  pts.sort((a, b) => Math.atan2(a[1] - CY, a[0] - CX) - Math.atan2(b[1] - CY, b[0] - CX));
  return pts;
}

// hover spots on the old site's phone in scene 03
const HOVER = Array.from({ length: 26 }, (_, j) => [330 + hash(j * 11 + 5) * 430, 760 + hash(j * 13 + 7) * 760]);

function initSwarm() {
  SWARM.digits = ['3', '2', '1'].map((d, k) => sampleGlyph(d, SW_N, 101 + k * 57));
  let hov = 0;
  for (let i = 0; i < SW_N; i++) {
    const q = hash(i * 7 + 3);
    const leave = q < 0.03 ? COUNT.morphs[0] : q < 0.06 ? COUNT.morphs[1] : q < GONE.share ? S.gone.start : Infinity;
    const cu = {
      s: 0.78 + 0.5 * hash(i * 13 + 1),
      d: hash(i * 3 + 11) * 0.13,
      sw: (hash(i * 5 + 2) - 0.5) * 2,
      leave,
      hover: -1,
    };
    if (leave === Infinity && hov < HOVER.length && hash(i * 5 + 9) < 0.07) cu.hover = hov++;
    // scatter target after the burst (survivors drift across the frame)
    const a = hash(i * 17 + 4) * TAU;
    const rr = 280 + hash(i * 19 + 8) * 560;
    cu.sc = [clamp(CX + Math.cos(a) * rr * 0.75, 60, W - 60), clamp(CY + Math.sin(a) * rr, 200, H - 160)];
    SWARM.cur.push(cu);
  }
  SPRITE = mk(70, 90);
  drawCursor(SPRITE.getContext('2d'), 7, 7, 2);
}

function digitPos(i, t) {
  const cu = SWARM.cur[i];
  const [A, B, C] = SWARM.digits;
  let p = A[i];
  const morph = (a, b, t0) => {
    const e = E.outCubic(prog(t, t0 + cu.d, t0 + cu.d + 0.34));
    const bulge = Math.sin(Math.PI * e);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return [
      lerp(a[0], b[0], e) - dy * 0.35 * bulge * cu.sw + (a[0] - CX) * 0.22 * bulge,
      lerp(a[1], b[1], e) + dx * 0.35 * bulge * cu.sw + (a[1] - CY) * 0.22 * bulge,
    ];
  };
  if (t >= COUNT.morphs[0]) p = morph(A[i], B[i], COUNT.morphs[0]);
  if (t >= COUNT.morphs[1]) p = morph(B[i], C[i], COUNT.morphs[1]);
  const tension = 1 + smooth(2.3, 3.0, t) * 2.6;
  const f = 1.1 * (1 + smooth(2.3, 3.0, t));
  return [p[0] + noise1(t * f + i * 3.1) * 3.5 * tension, p[1] + noise1(t * f + i * 5.7 + 100) * 3.5 * tension];
}

// { x, y, a, s, rot } of cursor i at global time t, or null when gone
function swarmState(i, t) {
  const cu = SWARM.cur[i];
  if (t >= cu.leave) {
    const p0 = digitPos(i, cu.leave);
    const burst = cu.leave >= S.gone.start - 1e-6;
    let dx = p0[0] - CX + (hash(i * 23) - 0.5) * 160;
    let dy = p0[1] - CY + (hash(i * 29) - 0.5) * 160;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const dt = t - cu.leave;
    const v0 = burst ? 2400 + hash(i * 31) * 1600 : 600;
    const acc = burst ? 14000 : 7000;
    const d = v0 * dt + 0.5 * acc * dt * dt;
    const x = p0[0] + dx * d;
    const y = p0[1] + dy * d;
    if (x < -80 || x > W + 80 || y < -80 || y > H + 80) return null;
    return { x, y, a: 1, s: cu.s, rot: dx * 0.7 * clamp(dt * 8) };
  }
  if (t < S.gone.start) {
    const [x, y] = digitPos(i, t);
    return { x, y, a: 1, s: cu.s * (1 + 0.04 * Math.exp(-((t % 1) * 7))), rot: 0 };
  }
  // survivors
  const p0 = digitPos(i, S.gone.start);
  const dt = t - S.gone.start;
  const k = E.outExpo(clamp(dt / 0.8));
  let x = lerp(p0[0], cu.sc[0], k) + noise1(t * 0.6 + i) * 18;
  let y = lerp(p0[1], cu.sc[1], k) + noise1(t * 0.6 + i + 50) * 18;
  let a = lerp(1, 0.26, smooth(0, 0.45, dt));
  let s = cu.s * 0.92;
  const tc = S.gone.start + GONE.converge;
  if (t >= tc) {
    if (cu.hover >= 0) {
      const e = E.inOutCubic(prog(t, tc + cu.hover * 0.008, tc + 0.34 + cu.hover * 0.008));
      const [hx, hy] = HOVER[cu.hover];
      x = lerp(x, hx, e);
      y = lerp(y, hy, e);
      a = lerp(a, 1, e);
      s = lerp(s, 1.15, e);
    } else {
      const e = E.inCubic(prog(t, tc, tc + 0.32));
      x = lerp(x, CX, e * 0.6);
      y = lerp(y, 1180, e * 0.6);
      a *= 1 - e;
      if (a <= 0.01) return null;
    }
  }
  return { x, y, a, s, rot: 0 };
}

function drawSprite(c, x, y, s, rot = 0, alpha = 1) {
  const w = 35 * s;
  const h = 45 * s;
  if (alpha < 1) c.globalAlpha = alpha;
  if (rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.drawImage(SPRITE, -10 * s, -16 * s, w, h);
    c.restore();
  } else c.drawImage(SPRITE, x - 10 * s, y - 16 * s, w, h);
  if (alpha < 1) c.globalAlpha = 1;
}

function drawSwarm(c, t) {
  for (let i = 0; i < SW_N; i++) {
    const st = swarmState(i, t);
    if (st) drawSprite(c, st.x, st.y, st.s, st.rot, st.a);
  }
}

function sceneCount(c, lt, t) {
  fillBg(c, BLACK);
  const sec = Math.floor(lt);
  const pulse = Math.exp(-(lt - sec) * 4);
  const g = c.createRadialGradient(CX, CY, 40, CX, CY, 760);
  g.addColorStop(0, `rgba(255,30,60,${0.16 + 0.12 * pulse})`);
  g.addColorStop(1, 'rgba(255,30,60,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // the countdown ring, running down in real seconds
  const R0 = 405;
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(CX, CY, R0, 0, TAU);
  c.stroke();
  const rem = clamp(1 - lt / 3);
  if (rem > 0.001) {
    c.strokeStyle = RED;
    c.lineWidth = 14;
    c.beginPath();
    c.arc(CX, CY, R0, -Math.PI / 2, -Math.PI / 2 + rem * TAU);
    c.stroke();
    const ha = -Math.PI / 2 + rem * TAU;
    c.fillStyle = WHITE;
    c.beginPath();
    c.arc(CX + Math.cos(ha) * R0, CY + Math.sin(ha) * R0, 11, 0, TAU);
    c.fill();
  }
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k / 3) * TAU;
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 4;
    line(c, CX + Math.cos(a) * (R0 - 30), CY + Math.sin(a) * (R0 - 30), CX + Math.cos(a) * (R0 - 12), CY + Math.sin(a) * (R0 - 12));
  }
  c.lineCap = 'butt';

  drawSwarm(c, t);

  // headline, fully legible from frame 0
  const settle = 1 + 0.06 * (1 - spring(lt, 16, 0.5));
  c.save();
  c.translate(CX, 400);
  c.scale(settle, settle);
  text(c, 'Nettsiden din har', 0, 0, `700 92px ${SANS}`, WHITE, 1, 'center');
  c.restore();
  c.save();
  c.translate(CX, 1455);
  c.scale(settle, settle);
  text(c, 'sekunder.', 0, 0, `700 118px ${SANS}`, RED, 1, 'center');
  c.restore();
  mono(c, typed('LASTER INN …', prog(lt, 0.25, 0.7)), CX, 1535, 26, WHITE, 0.55, 'center', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 02 — GONE: «53 % er allerede borte.»
// ════════════════════════════════════════════════════════════════════════════
function sceneGone(c, lt, t) {
  fillBg(c, BLACK);
  const burst = Math.exp(-lt * 3);
  const g = c.createRadialGradient(CX, 900, 20, CX, 900, 900);
  g.addColorStop(0, `rgba(255,30,60,${0.1 + 0.35 * burst})`);
  g.addColorStop(1, 'rgba(255,30,60,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // shock ring
  if (lt < 0.6) {
    const p = lt / 0.6;
    c.strokeStyle = RED;
    c.globalAlpha = 1 - p;
    c.lineWidth = 30 * (1 - p) + 2;
    c.beginPath();
    c.arc(CX, CY, 405 + E.outExpo(p) * 900, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
  }
  drawSwarm(c, t);

  const out = E.inExpo(prog(lt, GONE.converge + 0.02, GONE.converge + 0.36));
  // «53 %» — slot-rolled digits
  const pop = lerp(1.45, 1, E.outExpo(prog(lt, 0, 0.32)));
  c.save();
  c.translate(CX, 1000);
  const font = `400 560px ${COND}`;
  c.font = font;
  const dw = c.measureText('0').width;
  const pw = c.measureText('%').width;
  const gap = 36;
  const total = dw * 2 + gap + pw;
  const fit = Math.min(1, 900 / total);
  c.scale(fit * pop * (1 - out * 0.25), fit * pop * (1 - out * 0.25));
  c.globalAlpha = 1 - out;
  let x = -total / 2;
  [5, 3].forEach((v, j) => {
    const p = E.outExpo(prog(lt, 0.0 + j * 0.06, 0.55 + j * 0.06));
    const pos = v + 10 * (2 + j) * (1 - p);
    c.save();
    c.beginPath();
    c.rect(x - 6, -520, dw + 12, 560);
    c.clip();
    c.fillStyle = RED;
    const fl = Math.floor(pos);
    const fr = pos - fl;
    for (const [n, off] of [
      [fl, fr],
      [fl + 1, fr - 1],
    ]) c.fillText(String(((n % 10) + 10) % 10), x, off * 560);
    c.restore();
    x += dw;
  });
  x += gap;
  c.fillStyle = RED;
  c.globalAlpha = (1 - out) * E.outCubic(prog(lt, 0.12, 0.35));
  c.fillText('%', x, 0);
  c.restore();

  riseText(c, 'er allerede borte.', CX, 1175, `700 92px ${SANS}`, WHITE, lt, GONE.text, { align: 'center', size: 92, tracking: -2, out: GONE.converge });
  const cap1 = 'AV BRUKERE FORLATER EN SIDE SOM';
  const cap2 = 'TAR MER ENN 3 SEKUNDER Å LASTE';
  const ca = 0.75 * (1 - out);
  mono(c, typed(cap1, prog(lt, GONE.caption, GONE.caption + 0.45)), CX, 1270, 27, WHITE, ca, 'center', 600);
  mono(c, typed(cap2, prog(lt, GONE.caption + 0.35, GONE.caption + 0.8)), CX, 1314, 27, WHITE, ca, 'center', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 03 — JUDGE: the old site on a phone, «94 % dømmer nettsiden din på designet»
// 04 — REBUILD: a red diamond lands, the screen flips tile by tile
// ════════════════════════════════════════════════════════════════════════════
const TILE_C = 10;
const TILE_R = 22;
let oldCv, oldCtx, newCv, newCtx;
let oldStamp = -1;
let newStamp = '';

function updateOld(t) {
  const f = Math.floor(t * FPS);
  if (f === oldStamp) return;
  oldStamp = f;
  drawOldSite(oldCtx, t);
  R.updateTexture(TEX.old, oldCv);
}
function updateNew(t, edit) {
  const key = edit ? `${edit.frame.toFixed(3)}|${edit.typed.toFixed(3)}|${edit.saved.toFixed(3)}|${Math.floor(t * 4) % 2}` : 'plain';
  if (key === newStamp) return;
  newStamp = key;
  drawNewSite(newCtx, t, edit);
  R.updateTexture(TEX.newS, newCv);
}

// Phone pose + camera from 5.5 s to 16 s (judge and rebuild share one rig).
function rig(t) {
  const lj = t - S.judge.start;
  const lr = t - S.rebuild.start;
  let x = 0;
  let y = 0;
  let yaw = 0.16 * Math.sin(t * 0.9) - 0.08;
  let pitch = -0.05 + 0.02 * Math.sin(t * 0.7);
  let roll = 0;
  // slam in (judge)
  const sl = spring(lj, 13, 0.55);
  y += (1 - sl) * -2.4;
  yaw += (1 - sl) * 1.3;
  roll += (1 - sl) * 0.25;
  // tape stop wobble
  if (lj > JUDGE.stop && lr < 0) roll += Math.sin((lj - JUDGE.stop) * 38) * 0.012 * prog(lj, JUDGE.stop, JUDGE.stop + 0.3);
  // the drop: one full spin
  const sp = E.outExpo(prog(lr, REBUILD.spin, REBUILD.spin + 0.75));
  yaw += sp * TAU;
  // features: phone shifts right, each cut swings it
  const fe = E.inOutCubic(prog(lr, REBUILD.features[0] - 0.35, REBUILD.features[0] + 0.1));
  x += fe * 0.3;
  REBUILD.features.forEach((f, k) => {
    const d = lr - f;
    if (d >= 0) yaw += (k % 2 ? -1 : 1) * 0.55 * Math.exp(-d * 5) * Math.cos(d * 9) * (k === 0 ? 0 : 1);
  });
  const f4 = E.inOutCubic(prog(lr, REBUILD.features[3] - 0.2, REBUILD.features[3] + 0.3));
  yaw = lerp(yaw, sp * TAU - 0.12, f4 * 0.7);
  // exit: fly off to the right
  const ex = E.inExpo(prog(lr, 7.62, 8.0));
  x += ex * 3.2;
  yaw -= ex * 0.9;
  const model = G.chain(G.T(x, y, 0), G.Ry(yaw), G.Rx(pitch), G.Rz(roll));
  // camera
  const dist = 4.35 - 0.25 * E.inOutSine(prog(lr, -1.5, 1.0)) + 0.45 * E.outExpo(prog(lr, REBUILD.spin, REBUILD.spin + 0.6)) - 0.45 * E.outCubic(prog(lr, REBUILD.features[0] - 0.4, REBUILD.features[0] + 0.3));
  let camX = 0.02 + 0.06 * Math.sin(t * 0.5);
  let camY = 0.08;
  let tgtY = 0.36;
  let tgtX = fe * 0.14;
  // F4 close-up on the top of the screen
  const cu = f4 * (1 - ex);
  const d2 = lerp(dist, 2.6, cu);
  tgtY = lerp(tgtY, 0.42, cu);
  camY = lerp(camY, 0.55, cu);
  tgtX = lerp(tgtX, 0.3, cu);
  camX = lerp(camX, 0.5, cu);
  const cam = { eye: [camX, camY, d2], target: [tgtX, tgtY, 0], fov: 0.62 };
  return { model, cam };
}

const RIG_LIGHT = {
  keyDir: [0.55, 0.8, 0.9],
  keyCol: [1.6, 1.55, 1.5],
  envKick: [2.2, 0.03, 0.08],
  rimCol: [0.9, 0.02, 0.06],
  rimDir: [-0.7, 0.2, -0.6],
  shadow: false,
};

function redGlow(c, x, y, r, a) {
  const g = c.createRadialGradient(x, y, 10, x, y, r);
  g.addColorStop(0, `rgba(255,30,60,${a})`);
  g.addColorStop(0.5, `rgba(255,30,60,${a * 0.35})`);
  g.addColorStop(1, 'rgba(255,30,60,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

// the red diamond that makes the move (3D prism, lying on the screen)
function diamondModel(phoneModel, lt) {
  // lt relative to the landing
  const u = 0.5;
  const v = 0.3;
  const px = (u - 0.5) * PH.sw;
  const py = (0.5 - v) * PH.sh;
  const fall = E.inQuart(prog(lt, -0.26, 0));
  const zUp = (1 - fall) * 2.2;
  const land = lt > 0 ? spring(lt, 26, 0.3) : 0;
  const squash = lt > 0 ? 1 - 0.35 * Math.exp(-lt * 12) * Math.cos(lt * 30) : 1;
  const sink = E.inCubic(prog(lt, 0.18, 0.45));
  const s = (1 - sink) * lerp(2.2, 1, fall) * (lt > 0 ? lerp(1, 1, land) : 1);
  if (s <= 0.001 || lt < -0.26) return null;
  const spin = (1 - fall) * 3.4;
  return G.chain(phoneModel, G.T(px, py, PH.d / 2 + 0.02 + zUp), G.Rz(Math.PI / 4 + spin), G.S(0.11 * s, 0.11 * s, 0.03 * s * squash));
}

function sceneJudge(c, lt, t) {
  fillBg(c, BLACK);
  redGlow(c, 540, 1180, 800, 0.28);
  updateOld(t);
  const { model, cam } = rig(t);
  const items = phoneItems(model, screenMat(TEX.old));
  const dm = diamondModel(model, t - S.rebuild.start);
  if (dm) items.push({ mesh: MESH.diamond, model: dm, mat: { color: RED_LIN, rough: 0.18, coat: 1, emit: 0.25 } });
  const { vp } = gl3cam(c, items, cam, { light: RIG_LIGHT });

  // the last visitors hover, hesitate, and leave
  const phoneNow = screenPx(vp, model, 0.5, 0.5);
  for (let i = 0; i < SW_N; i++) {
    const cu = SWARM.cur[i];
    if (cu.hover < 0) continue;
    const [hx, hy] = HOVER[cu.hover];
    const wob = 1 + smooth(0.8, 2, lt);
    let x = hx + noise1(t * 0.9 + i) * 10 * wob + (phoneNow[0] - 540) * 0.6;
    let y = hy + noise1(t * 0.9 + i + 40) * 10 * wob + (phoneNow[1] - 1180) * 0.6;
    const Lv = 0.95 + hash(i * 3) * 1.25;
    let rot = 0;
    if (lt > Lv) {
      const dt = lt - Lv;
      const dir = hx < 540 ? -1 : 1;
      x += dir * (500 * dt + 5000 * dt * dt);
      y -= 140 * dt;
      rot = dir * 0.5 * clamp(dt * 8);
      if (x < -80 || x > W + 80) continue;
    }
    drawSprite(c, x, y, cu.s * 1.15, rot);
  }

  // copy
  const out = JUDGE.stop + 0.12;
  const sa = E.outExpo(prog(lt, JUDGE.stat, JUDGE.stat + 0.3));
  c.save();
  c.translate(CX, 425);
  const pop = lerp(1.3, 1, sa);
  c.scale(pop, pop);
  c.globalAlpha = sa * (1 - E.inExpo(prog(lt, out, out + 0.25)));
  text(c, '94 %', 0, 0, `400 225px ${COND}`, RED, 1, 'center');
  c.restore();
  riseText(c, 'dømmer nettsiden din', CX, 506, `700 60px ${SANS}`, WHITE, lt, JUDGE.line, { align: 'center', size: 60, tracking: -1, out });
  riseText(c, 'på designet.', CX, 574, `700 60px ${SANS}`, WHITE, lt, JUDGE.line + 0.12, { align: 'center', size: 60, tracking: -1, out });
}

function tileItems(model, lr) {
  const items = [];
  const tw = PH.sw / TILE_C;
  const th = PH.sh / TILE_R;
  const iu = 0.5;
  const iv = 0.3;
  for (let r = 0; r < TILE_R; r++) {
    for (let cc = 0; cc < TILE_C; cc++) {
      const u = (cc + 0.5) / TILE_C;
      const v = (r + 0.5) / TILE_R;
      const dist = Math.hypot((u - iu) * PH.sw, (v - iv) * PH.sh) / 1.25;
      const ts = REBUILD.land + 0.04 + dist * REBUILD.flipSpan + hash(r * 31 + cc) * 0.05;
      const p = prog(lr, ts, ts + REBUILD.flipDur);
      const ang = Math.PI * E.outBack(p, 1.6);
      const lift = Math.sin(Math.PI * clamp(p)) * 0.06;
      const x = (u - 0.5) * PH.sw;
      const y = (0.5 - v) * PH.sh;
      const m = G.chain(model, G.T(x, y, PH.d / 2 + 0.006 + lift), G.Rx(ang), G.Ry(Math.sin(Math.PI * clamp(p)) * 0.25 * (cc % 2 ? 1 : -1)), G.S(tw * 0.996, th * 0.996, 0.01));
      items.push({
        mesh: MESH.tile,
        model: m,
        mat: { mode: 2, texA: TEX.old, texB: TEX.newS, rectA: [cc / TILE_C, r / TILE_R, 1 / TILE_C, 1 / TILE_R], rectB: [cc / TILE_C, r / TILE_R, 1 / TILE_C, 1 / TILE_R], emit: 1, glass: 0.35, shadow: false, sideCol: [0.01, 0.01, 0.012] },
      });
    }
  }
  return items;
}

const FEATURES = [
  { label: 'Skreddersydd design', sub: 'DESIGNET I FIGMA — FRA BUNNEN AV' },
  { label: 'Bygget i kode', sub: 'RESPONSIVT PÅ MOBIL OG DESKTOP' },
  { label: 'Rask lastetid', sub: 'OPTIMALISERT FOR HASTIGHET' },
  { label: 'Oppdater selv', sub: 'ADMINPANEL INKLUDERT — INGEN KODE' },
];

function editState(lr) {
  const f = REBUILD.features[3];
  return {
    frame: prog(lr, f + 0.05, f + 0.4),
    typed: prog(lr, f + 0.38, f + 0.95),
    saved: prog(lr, f + 1.08, f + 1.4),
  };
}

function sceneRebuild(c, lt, t) {
  const lr = lt;
  fillBg(c, BLACK);
  const spinGlow = Math.exp(-Math.max(0, lr - REBUILD.spin) * 2.5) * (lr > REBUILD.spin ? 1 : 0);
  redGlow(c, lerp(540, 700, prog(lr, 1.65, 2.1)), 1180, 900, 0.26 + 0.35 * spinGlow);
  const { model, cam } = rig(t);
  const edit = lr >= REBUILD.features[3] - 0.1 ? editState(lr) : null;
  const flipping = lr < REBUILD.land + 0.04 + REBUILD.flipSpan + REBUILD.flipDur + 0.12;
  if (flipping) updateOld(t);
  updateNew(t, edit);
  let items;
  if (flipping) {
    items = [
      { mesh: MESH.body, model, mat: PHONE_MAT },
      { mesh: MESH.glass, model: G.chain(model, G.T(0, 0, PH.d / 2 + 0.0006)), mat: { ...GLASS_MAT, shadow: false } },
      ...tileItems(model, lr),
    ];
  } else items = phoneItems(model, screenMat(TEX.newS));
  const dm = diamondModel(model, lr);
  if (dm) items.push({ mesh: MESH.diamond, model: dm, mat: { color: RED_LIN, rough: 0.18, coat: 1, emit: 0.25 } });
  const { vp } = gl3cam(c, items, cam, { light: { ...RIG_LIGHT, envKick: [2.2 + spinGlow * 4, 0.03, 0.08] } });

  // impact ripple where the diamond lands
  if (lr > 0 && lr < 0.7) {
    const [ix, iy] = screenPx(vp, model, 0.5, 0.3);
    const p = lr / 0.7;
    c.strokeStyle = RED;
    c.globalAlpha = 1 - p;
    c.lineWidth = 8 * (1 - p) + 1;
    c.beginPath();
    c.ellipse(ix, iy, 40 + E.outExpo(p) * 420, (40 + E.outExpo(p) * 420) * 0.92, 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
  }

  // «Tid for et nytt trekk.»
  const tOut = REBUILD.features[0] - 0.3;
  riseText(c, 'Tid for et', 72, 330, `700 104px ${SANS}`, WHITE, lr, 0.05, { size: 104, tracking: -3, out: tOut });
  riseText(c, 'nytt trekk.', 72, 438, `700 104px ${SANS}`, RED, lr, 0.14, { size: 104, tracking: -3, out: tOut + 0.04 });

  // features
  REBUILD.features.forEach((f, k) => {
    const d = lr - f;
    if (d < -0.05 || d > 1.62) return;
    const F = FEATURES[k];
    const outAt = k === 3 ? 1.52 : 1.38;
    mono(c, `0${k + 1} / 04`, 76, 262, 24, RED, E.outCubic(prog(d, 0, 0.15)) * (1 - prog(d, outAt, outAt + 0.1)), 'left', 600);
    riseText(c, F.label, 72, 352, `700 78px ${SANS}`, WHITE, d, 0.02, { size: 78, tracking: -2, out: outAt });
    mono(c, typed(F.sub, prog(d, 0.12, 0.45)), 76, 410, 22, WHITE, 0.7 * (1 - prog(d, outAt, outAt + 0.12)), 'left', 600);
    [featDesign, featCode, featSpeed, featAdmin][k](c, d, vp, model, t);
  });
}

function featDesign(c, d, vp, model) {
  const a = E.outCubic(prog(d, 0.1, 0.3)) * (1 - prog(d, 1.35, 1.5));
  if (a <= 0) return;
  // Figma selection around the headline, tracking the phone in 3D
  const box = [
    [0.035, 0.1],
    [0.965, 0.1],
    [0.965, 0.235],
    [0.035, 0.235],
  ].map(([u, v]) => screenPx(vp, model, u, v));
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = '#18A0FB';
  c.lineWidth = 3;
  quadPath(c, box);
  c.stroke();
  for (const [x, y] of box) {
    c.fillStyle = WHITE;
    c.fillRect(x - 7, y - 7, 14, 14);
    c.strokeRect(x - 7, y - 7, 14, 14);
  }
  const mx = (box[2][0] + box[3][0]) / 2;
  const my = Math.max(box[2][1], box[3][1]) + 22;
  c.fillStyle = '#18A0FB';
  c.beginPath();
  c.roundRect(mx - 72, my, 144, 34, 6);
  c.fill();
  mono(c, '700 × 190', mx, my + 24, 18, WHITE, 1, 'center', 600);
  c.restore();
  // palette
  const chips = [
    [NEW.ink, '#141414'],
    [NEW.accent, '#C8502D'],
    [NEW.bg, '#F4F0E8'],
    [NEW.forest, '#1F3A2C'],
  ];
  chips.forEach(([col, hex], i) => {
    const p = E.outBack(prog(d, 0.2 + i * 0.07, 0.45 + i * 0.07), 2.4) * (1 - E.inCubic(prog(d, 1.3, 1.45)));
    if (p <= 0) return;
    const y = 820 + i * 118;
    c.save();
    c.translate(118, y);
    c.scale(p, p);
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, 0, 42, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    mono(c, hex, 178, y + 8, 22, WHITE, 0.85 * clamp(p), 'left', 600);
  });
  // type specimen
  const tp = E.outExpo(prog(d, 0.45, 0.75)) * (1 - prog(d, 1.3, 1.45));
  if (tp > 0) {
    c.save();
    c.globalAlpha = tp;
    text(c, 'Aa', 76, 1390 + (1 - tp) * 40, `700 150px ${SANS}`, WHITE);
    mono(c, 'IBM PLEX SANS · 700', 82, 1440 + (1 - tp) * 40, 20, WHITE, 0.6, 'left', 600);
    c.restore();
  }
}

const CODE = [
  ['<section ', 'class', '="hero">'],
  ['  <h1>', 'Solid håndverk,', ''],
  ['    levert til avtalt tid.', '', '</h1>'],
  ['  <a ', 'class', '="btn" href="/befaring">'],
  ['    Be om befaring →', '', '</a>'],
  ['</section>', '', ''],
];
function featCode(c, d) {
  const a = E.outExpo(prog(d, 0.06, 0.3)) * (1 - E.inCubic(prog(d, 1.3, 1.46)));
  if (a <= 0) return;
  c.save();
  c.translate(60 - (1 - a) * 120, 700);
  c.rotate(-0.035);
  c.globalAlpha = clamp(a * 1.4);
  c.fillStyle = 'rgba(14,14,16,0.94)';
  c.beginPath();
  c.roundRect(0, 0, 560, 470, 22);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 2;
  c.stroke();
  for (let k = 0; k < 3; k++) {
    c.fillStyle = ['#FF5F57', '#FEBC2E', '#28C840'][k];
    c.beginPath();
    c.arc(34 + k * 26, 32, 8, 0, TAU);
    c.fill();
  }
  mono(c, 'index.html', 290, 39, 18, WHITE, 0.5, 'center', 500);
  const total = CODE.reduce((s, l) => s + l.join('').length, 0);
  let n = Math.floor(prog(d, 0.18, 1.0) * total);
  c.font = `500 23px ${MONO}`;
  CODE.forEach((parts, i) => {
    const y = 104 + i * 58;
    mono(c, String(i + 1), 40, y, 20, WHITE, 0.3, 'right', 500);
    let x = 58;
    const cols = i === 1 || i === 2 || i === 4 ? [RED, WHITE, RED] : [RED, '#9CDCFE', '#CE9178'];
    parts.forEach((p, j) => {
      if (n <= 0 || !p) return;
      const shown = p.slice(0, n);
      n -= p.length;
      c.fillStyle = j === 0 && (i === 2 || i === 4) ? WHITE : cols[j];
      c.fillText(shown, x, y);
      x += c.measureText(shown).width;
    });
    if (n <= 0 && n > -parts.join('').length) {
      c.fillStyle = RED;
      c.fillRect(x + 3, y - 20, 11, 26);
    }
  });
  c.restore();
}

function featSpeed(c, d, vp, model) {
  const a = E.outExpo(prog(d, 0.05, 0.25)) * (1 - E.inCubic(prog(d, 1.3, 1.45)));
  if (a <= 0) return;
  const cx = 250;
  const cy = 1010;
  const r = 150;
  c.save();
  c.globalAlpha = a;
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 20;
  c.beginPath();
  c.arc(cx, cy, r, 0, TAU);
  c.stroke();
  const fill = E.inOutQuart(prog(d, 0.3, 0.62));
  c.strokeStyle = RED;
  c.shadowColor = 'rgba(255,30,60,0.8)';
  c.shadowBlur = 30;
  c.beginPath();
  c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, fill) * TAU);
  c.stroke();
  c.shadowBlur = 0;
  c.lineCap = 'butt';
  const done = prog(d, 0.62, 0.72);
  if (done > 0) {
    const s = E.outBack(done, 3);
    c.save();
    c.translate(cx, cy);
    c.scale(s, s);
    c.strokeStyle = WHITE;
    c.lineWidth = 18;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-50, 4);
    c.lineTo(-14, 40);
    c.lineTo(56, -38);
    c.stroke();
    c.restore();
  } else mono(c, `${Math.round(fill * 100)} %`, cx, cy + 18, 52, WHITE, 1, 'center', 600);
  mono(c, done > 0 ? 'LASTET' : 'LASTER …', cx, cy + r + 70, 26, WHITE, 0.75, 'center', 600);
  c.restore();
  // the browser progress bar zipping across the top of the phone screen
  const bar = E.inOutQuart(prog(d, 0.3, 0.62));
  const fade = 1 - prog(d, 0.72, 0.9);
  if (bar > 0 && fade > 0) {
    const p0 = screenPx(vp, model, 0.02, 0.012);
    const p1 = screenPx(vp, model, lerp(0.02, 0.98, bar), 0.012);
    c.strokeStyle = RED;
    c.globalAlpha = fade;
    c.lineWidth = 7;
    line(c, p0[0], p0[1], p1[0], p1[1]);
    c.globalAlpha = 1;
  }
}

function featAdmin(c, d, vp, model) {
  // the pointer: moves in, clicks «Rediger», later clicks away to save
  const a = E.outCubic(prog(d, 0.0, 0.2)) * (1 - prog(d, 1.45, 1.6));
  if (a <= 0) return;
  const pill = screenPx(vp, model, 0.14, 0.078);
  const save = screenPx(vp, model, 0.833, 0.902);
  const m1 = E.inOutCubic(prog(d, 0.02, 0.3));
  const m2 = E.inOutCubic(prog(d, 0.9, 1.1));
  let x = lerp(lerp(900, pill[0] + 10, m1), save[0], m2);
  let y = lerp(lerp(1500, pill[1] + 6, m1), save[1], m2);
  const click = (tc) => (d > tc && d < tc + 0.12 ? 0.88 : 1);
  const s = 1.6 * click(0.32) * click(1.1);
  c.globalAlpha = a;
  drawCursor(c, x, y, s, WHITE, BLACK);
  c.globalAlpha = 1;
  for (const tc of [0.32, 1.1]) {
    if (d > tc && d < tc + 0.4) {
      const p = (d - tc) / 0.4;
      c.strokeStyle = RED;
      c.globalAlpha = 1 - p;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(tc < 1 ? pill[0] : save[0], tc < 1 ? pill[1] : save[1], 12 + p * 50, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 05 — PROOF: two real client sites on phones on a glossy board
// ════════════════════════════════════════════════════════════════════════════
const CLIENTS = [
  { key: 'skogli', name: 'Skogli Gard', cat: 'REISE / OPPLEVELSE' },
  { key: 'okonomiledelse', name: 'Økonomiledelse AS', cat: 'ØKONOMI / RÅDGIVNING' },
];

function sceneProof(c, lt, t) {
  fillBg(c, BLACK);
  const vis = 1688 / 4300;
  const ex = E.inExpo(prog(lt, 4.62, 5.0));
  const orbit = lerp(-0.2, 0.22, E.inOutSine(prog(lt, 0, 5))) + ex * 0.4;
  const dist = 6.5 - 0.5 * E.outCubic(prog(lt, 0, 4)) - ex * 3.4;
  const target = [lerp(-0.06, 0.06, E.inOutSine(prog(lt, 0.5, 4.5))), 0.8, -0.2];
  const cam = {
    eye: [target[0] + Math.sin(orbit) * dist, 1.35 + 0.1 * Math.cos(lt * 0.8), target[2] + Math.cos(orbit) * dist],
    target,
    fov: 0.6,
  };
  const phones = [
    { pos: [-0.46, 0, 0.05], yaw: 0.3, drop: 0.0 },
    { pos: [0.47, 0, -0.38], yaw: -0.3, drop: 0.12 },
  ];
  const items = [];
  const models = [];
  phones.forEach((p, k) => {
    const s = spring(lt - p.drop, 12, 0.5);
    const y = PH.h / 2 + 0.002 + (1 - s) * 2.6;
    const focus = k === 0 ? 1 - smooth(PROOF.focusB - 0.3, PROOF.focusB + 0.3, lt) : smooth(PROOF.focusB - 0.3, PROOF.focusB + 0.3, lt);
    const yaw = p.yaw * (1 - focus * 0.55) + (1 - s) * (k ? -1.2 : 1.2);
    const model = G.chain(G.T(p.pos[0], y, p.pos[2]), G.Ry(yaw), G.Rx(-0.04 * focus));
    models.push(model);
    // the page scrolls on the beat while it is in focus
    const beats = lt / BEAT;
    const n = Math.floor(beats);
    const stepE = n + E.outExpo(clamp((beats - n) / 0.6));
    const sc = clamp((stepE - 1 - k * 2) * 0.055, 0, 1 - vis);
    items.push(...phoneItems(model, screenMat(TEX[CLIENTS[k].key], [0, sc, 1, vis])));
  });
  const { vp } = gl3cam(c, items, cam, {
    floor: { sq: 0.5, colA: [0.05, 0.05, 0.055], colB: [0.008, 0.008, 0.009], reflA: 0.32, reflB: 0.42, radius: 7, fade: 1.6 },
    light: { keyDir: [-0.4, 0.9, 0.55], keyCol: [1.5, 1.45, 1.4], envKick: [2.6, 0.03, 0.08], rimCol: [0.7, 0.02, 0.05], rimDir: [0.2, 0.3, -1], shadowCenter: [0, 0.8, -0.2], shadowSize: 2.6 },
  });

  // labels on the floor under each phone
  models.forEach((m, k) => {
    const base = G.project(vp, G.transformPoint(m, [0, -PH.h / 2, PH.d]), W, H);
    const a = E.outCubic(prog(lt, 0.55 + k * 0.15, 0.9 + k * 0.15)) * (1 - ex);
    const L = CLIENTS[k];
    const x = clamp(base[0], 180, 900);
    c.save();
    c.globalAlpha = a;
    text(c, L.name, x, base[1] + 66, `700 38px ${SANS}`, WHITE, 1, 'center');
    mono(c, L.cat, x, base[1] + 102, 21, RED, 1, 'center', 600);
    c.restore();
  });

  riseText(c, 'Ekte bedrifter.', 72, 300, `700 96px ${SANS}`, WHITE, lt, 0.1, { size: 96, tracking: -3, out: 4.55 });
  riseText(c, 'Ekte nettsider.', 72, 404, `700 96px ${SANS}`, RED, lt, 0.24, { size: 96, tracking: -3, out: 4.6 });
  mono(c, typed('LEVERT AV SEVENTH SEAL — 2026', prog(lt, 0.6, 1.1)), 76, 466, 22, WHITE, 0.6 * (1 - ex), 'left', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 06 — OFFER: «Byråkvalitet, uten byråpris.» → the price on a 3D odometer
// ════════════════════════════════════════════════════════════════════════════
const STORM = [];
function initStorm() {
  for (let i = 0; i < 170; i++) {
    const h = (k) => hash(i * 17 + k * 131 + 7);
    STORM.push({
      x: (h(1) - 0.5) * 2600,
      y: (h(2) - 0.5) * 4200,
      z: h(3) * 4200,
      ch: h(4) < 0.5 ? '7' : 'S',
      spin: (h(5) - 0.5) * 2.5,
      yaw: (h(6) - 0.5) * 7,
      ph: h(7) * TAU,
      size: 160 + h(8) * 140,
    });
  }
}
function storm(c, lt, speed, warp) {
  const F = 900;
  const D = 4200;
  const camZ = lt * speed + warp * 5200;
  const items = [];
  for (const g of STORM) {
    const z = ((((g.z - camZ) % D) + D) % D) + 40;
    const s = F / z;
    const sx = W / 2 + g.x * s;
    const sy = H / 2 + g.y * s;
    if (sx < -600 || sx > W + 600 || sy < -600 || sy > H + 600) continue;
    items.push([z, s, sx, sy, g]);
  }
  items.sort((a, b) => b[0] - a[0]);
  c.font = `400 200px ${COND}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const [z, s, sx, sy, g] of items) {
    const a = clamp((D - z) / 900) * clamp((z - 40) / 140);
    if (a <= 0) continue;
    const yaw = Math.cos(g.yaw * lt + g.ph);
    c.save();
    c.globalAlpha = a;
    c.translate(sx, sy);
    c.rotate(g.spin * lt + g.ph);
    c.scale(((s * g.size) / 200) * (0.25 + 0.75 * Math.abs(yaw)), (s * g.size) / 200);
    c.transform(1, 0, -0.3, 1, 0, 0);
    c.fillStyle = yaw > 0 ? RED : DRED;
    c.fillText(g.ch, 0, 0);
    c.restore();
  }
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}

const DRUM = { r: 2.0, w: 0.78, xs: [-1.62, -0.62, 0.2, 1.02] };
const DIGITS = [7, 5, 0, 0];
const CHECKS = ['Adminpanel inkludert', 'Hosting og drift', '3 revisjonsrunder', 'Normalt ferdig på 2–4 uker'];

// texture offset (in turns) of drum k: several turns, landing on its digit
function drumRoll(k, lt) {
  const tl = OFFER.land[k];
  const final = (DIGITS[k] + 0.5) / 10;
  const p = prog(lt, OFFER.drums - 0.05, tl);
  const e = p < 1 ? E.outCubic(p) : 1;
  const settle = lt > tl ? 0.012 * Math.exp(-(lt - tl) * 9) * Math.sin((lt - tl) * 32) : 0;
  return final - (1 - e) * (3 + k) + settle;
}

function sceneOffer(c, lt, t) {
  const B = OFFER.drums;
  if (lt < B) {
    // ── «Byråkvalitet, uten byråpris.» over the 7S storm ──
    fillBg(c, BLACK);
    const warp = E.inExpo(prog(lt, B - 0.45, B));
    storm(c, lt, 2200, warp);
    const sg = c.createRadialGradient(CX, 940, 60, CX, 940, 640);
    sg.addColorStop(0, 'rgba(10,10,10,0.92)');
    sg.addColorStop(1, 'rgba(10,10,10,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, W, H);
    const z = 1 + warp * 1.8;
    c.save();
    c.translate(CX, 940);
    c.scale(z, z);
    c.translate(-CX, -940);
    c.globalAlpha = 1 - warp;
    const font = `700 124px ${SANS}`;
    riseText(c, 'Byråkvalitet,', CX, 890, font, WHITE, lt, 0.05, { align: 'center', size: 124, tracking: -4 });
    const w2 = riseRich(c, [['uten ', WHITE], ['byråpris.', RED]], CX, 1030, font, lt, 0.3, { align: 'center', size: 124, tracking: -4 });
    // the strike through «byråpris»
    const sp = E.outExpo(prog(lt, OFFER.strike, OFFER.strike + 0.22));
    if (sp > 0) {
      const L = layout(c, 'uten byråpris.', font, -4);
      const x0 = CX - L.width / 2 + layout(c, 'uten ', font, -4).width;
      const x1 = x0 + layout(c, 'byråpris', font, -4).width;
      c.strokeStyle = WHITE;
      c.lineWidth = 13;
      c.lineCap = 'round';
      line(c, x0 - 8, 1000, lerp(x0 - 8, x1 + 8, sp), lerp(1000, 986, sp));
      c.lineCap = 'butt';
    }
    mono(c, typed('HØY KVALITET — TIL EN BRØKDEL AV PRISEN', prog(lt, 0.8, 1.35)), CX, 1110, 24, WHITE, 0.7, 'center', 600);
    c.restore();
    // brand diamond wipe into red
    const wp = E.inExpo(prog(lt, B - 0.3, B));
    if (wp > 0) {
      c.save();
      c.translate(CX, 940);
      c.rotate(Math.PI / 4);
      c.fillStyle = RED;
      const s = wp * 1600;
      c.fillRect(-s, -s, s * 2, s * 2);
      c.restore();
    }
    return;
  }
  // ── the price ──
  const lp = lt - B;
  fillBg(c, RED);
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-Math.PI / 4);
  c.fillStyle = DRED;
  c.globalAlpha = 0.3;
  const speed = lp * 150;
  for (let x = -2000; x < 2000; x += 130) c.fillRect(x + (speed % 130), -2000, 44, 4000);
  c.restore();
  c.globalAlpha = 1;

  // odometer (3D)
  const enter = E.outExpo(prog(lt, B - 0.02, B + 0.45));
  const items = [];
  const housing = G.chain(G.T(0, (1 - enter) * -6, 0), G.Rx(-0.1 * (1 - enter)));
  const plate = { color: [0.012, 0.012, 0.013], rough: 0.2, coat: 0.8, metal: 0.2, shadow: false };
  // a slim frame around a window just tall enough for one digit
  const WY = 0.74;
  const FB = 0.2;
  const bars = [
    [-0.3, WY + FB / 2, 3.9, FB],
    [-0.3, -WY - FB / 2, 3.9, FB],
    [-2.155, 0, 0.19, WY * 2],
    [1.555, 0, 0.19, WY * 2],
    [-1.12, 0, 0.22, WY * 2],
    [-0.21, 0, 0.04, WY * 2],
    [0.61, 0, 0.04, WY * 2],
  ];
  for (const [bx, by, bw, bh] of bars) items.push({ mesh: MESH.box, model: G.chain(housing, G.T(bx, by, 0.12), G.S(bw, bh, 0.3)), mat: plate });
  items.push({ mesh: MESH.box, model: G.chain(housing, G.T(-0.3, 0, -0.35), G.S(3.9, WY * 2 + FB * 2, 0.1)), mat: plate });
  DRUM.xs.forEach((x, k) => {
    items.push({ mesh: MESH.drum, model: G.chain(housing, G.T(x, 0, -DRUM.r + 0.02)), mat: { mode: 4, texA: TEX.digits, rectA: [0, drumRoll(k, lt), 1, 1], color: [1, 1, 1], rough: 0.14, coat: 1, shadow: false } });
  });
  const cam = { eye: [0.45, 0.6, 17.5], target: [0.2, 1.72, 0], fov: 0.55 };
  const { vp } = gl3(c, items, cam, {
    light: { keyDir: [0.2, 1, 0.8], keyCol: [1.6, 1.6, 1.6], envKey: [2.2, 2.2, 2.2], envStrip: [2.6, 2.6, 2.6], shadow: false, amb: [0.03, 0.03, 0.03] },
  });
  // «Fra» … «kr»
  const tr = G.project(vp, G.transformPoint(housing, [1.65, -WY, 0.4]), W, H);
  const tl = G.project(vp, G.transformPoint(housing, [-2.25, WY, 0.4]), W, H);
  const la = E.outCubic(prog(lt, B + 0.2, B + 0.45));
  mono(c, 'FRA', tl[0] + 4, tl[1] - 28, 38, WHITE, la, 'left', 600);
  text(c, 'kr', tr[0] + 22, tr[1], `400 150px ${COND}`, WHITE, E.outCubic(prog(lt, OFFER.land[3] - 0.05, OFFER.land[3] + 0.25)));
  const y0 = tr[1] + 150;
  riseText(c, '+ 500 kr/mnd', 84, y0, `700 76px ${SANS}`, BLACK, lt, OFFER.plus, { size: 76, tracking: -2 });

  // checklist
  CHECKS.forEach((str, i) => {
    const st = OFFER.checks[i];
    const p = E.outExpo(prog(lt, st, st + 0.3));
    if (p <= 0) return;
    const y = y0 + 128 + i * 92;
    const bx = 84;
    const bs = E.outBack(prog(lt, st, st + 0.2), 3);
    c.save();
    c.translate(bx + 25, y - 17);
    c.scale(bs, bs);
    c.fillStyle = WHITE;
    c.beginPath();
    c.roundRect(-25, -25, 50, 50, 7);
    c.fill();
    c.restore();
    const ck = E.outCubic(prog(lt, st + 0.06, st + 0.2));
    if (ck > 0) {
      c.strokeStyle = RED;
      c.lineWidth = 8;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      const pts = [
        [bx + 12, y - 17],
        [bx + 22, y - 6],
        [bx + 40, y - 29],
      ];
      const l1 = Math.hypot(10, 11);
      const l2 = Math.hypot(18, 23);
      const Lh = (l1 + l2) * ck;
      c.beginPath();
      c.moveTo(...pts[0]);
      if (Lh <= l1) c.lineTo(lerp(pts[0][0], pts[1][0], Lh / l1), lerp(pts[0][1], pts[1][1], Lh / l1));
      else {
        c.lineTo(...pts[1]);
        const f = (Lh - l1) / l2;
        c.lineTo(lerp(pts[1][0], pts[2][0], f), lerp(pts[1][1], pts[2][1], f));
      }
      c.stroke();
      c.lineCap = 'butt';
    }
    c.save();
    c.beginPath();
    c.rect(bx + 70, y - 64, 900, 88);
    c.clip();
    text(c, str, bx + 80 - (1 - p) * 60, y, `500 50px ${SANS}`, WHITE, p);
    c.restore();
  });
  mono(c, typed('PRISENE ER DE DERE BETALER — INGEN MVA I TILLEGG', prog(lt, OFFER.vat, OFFER.vat + 0.45)), 86, y0 + 128 + 4 * 92 + 10, 21, WHITE, 0.85, 'left', 600);

  // black board wipe into the chess shot
  checkerWipe(c, prog(lt, S.offer.end - S.offer.start - 0.28, S.offer.end - S.offer.start), BLACK);
}

function checkerWipe(c, p, color) {
  if (p <= 0) return;
  const Q = 135;
  const cols = Math.ceil(W / Q) + 1;
  const rows = Math.ceil(H / Q) + 1;
  c.fillStyle = color;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d = (i * 0.5 + j) / (cols * 0.5 + rows);
      const s = E.outCubic(prog(p, d * 0.7, d * 0.7 + 0.3));
      if (s <= 0) continue;
      const cx = i * Q + Q / 2;
      const cy = j * Q + Q / 2;
      const hs = (Q / 2 + 1) * s;
      c.beginPath();
      c.roundRect(cx - hs, cy - hs, hs * 2, hs * 2, 12 * (1 - s) + 1);
      c.fill();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 07 — CTA: «Ditt trekk.» A red king moves; the board becomes the logo.
// ════════════════════════════════════════════════════════════════════════════
const SQ = 0.5;
// logo units → world (the logo is an 8×8 board: 8 units per square)
const L2W = (lx, ly) => [((lx - 35.93) / 8) * SQ, ((ly - 41.5) / 8) * SQ];
const KING_FROM = [-1.25, -0.75];
const KING_TO = [-1.25, -1.25];
const PAWNS = [
  [0.25, -0.25],
  [0.75, -1.25],
  [-0.25, -1.75],
  [-1.75, 0.25],
];
let maskCv, maskCtx;
let maskStamp = -1;

function ctaCamera(lt) {
  const up = E.inOutCubic(prog(lt, CTA.crane, CTA.lockup));
  // low hero angle on the king → top-down over the board
  const k = lt < CTA.move ? KING_FROM : KING_TO;
  const orbit = lerp(0.62, 0.28, E.outCubic(prog(lt, 0, 2)));
  const d0 = lerp(4.1, 3.5, E.outCubic(prog(lt, 0, 2)));
  const tgt0 = [-1.1, 0.78, lerp(-0.95, -1.12, E.inOutCubic(prog(lt, CTA.move + 0.25, CTA.move + 1.2)))];
  const eye0 = [tgt0[0] + Math.sin(orbit) * d0, 0.95 + 0.12 * prog(lt, 0, 2), tgt0[2] + Math.cos(orbit) * d0];
  const topH = 26;
  const tgt1 = [0, 0, 0.95];
  const eye1 = [0, topH, 0.95 + 0.0001];
  // arc the eye upward rather than straight through the board
  const e = up;
  const eye = [lerp(eye0[0], eye1[0], e), lerp(eye0[1], eye1[1], e * e * 0.6 + e * 0.4) + Math.sin(Math.PI * e) * 2.5, lerp(eye0[2], eye1[2], e) + Math.sin(Math.PI * e) * 3];
  const target = [lerp(tgt0[0], tgt1[0], e), lerp(tgt0[1], tgt1[1], e), lerp(tgt0[2], tgt1[2], e)];
  const fov = lerp(0.62, 0.42, e);
  return { eye, target, fov, up: e > 0.985 ? [0, 0, -1] : [0, 1 - e * 0.999, -e], k };
}

function updateMask(p) {
  const key = Math.round(p * 200);
  if (key === maskStamp) return;
  maskStamp = key;
  for (let r = 0; r < 8; r++) {
    for (let cc = 0; cc < 8; cc++) {
      const light = (cc + r) % 2 === 1;
      const keep = !light || LOGO.cells.has(`${cc},${r}`);
      const v = keep ? 1 : 1 - p;
      const g = Math.round(v * 255);
      maskCtx.fillStyle = `rgb(${g},${g},${g})`;
      maskCtx.fillRect(cc, r, 1, 1);
    }
  }
  R.updateTexture(TEX.mask, maskCv);
}

function lockupPlacement(p) {
  // p 0: the logo board where the 3D camera leaves it; 1: final lockup
  const k0 = LOGO.k0;
  const k1 = 3.25;
  const x0 = LOGO.bx0;
  const y0 = LOGO.by0;
  const x1 = CX - (226 * k1) / 2;
  const y1 = 548;
  const e = E.inOutCubic(p);
  return { k: lerp(k0, k1, e), x: lerp(x0, x1, e), y: lerp(y0, y1, e) };
}

function sceneCta(c, lt, t) {
  fillBg(c, BLACK);
  const cam = ctaCamera(lt);
  const layerA = 1 - smooth(CTA.lockup, CTA.lockup + 0.18, lt);
  if (layerA > 0.001) {
    const items = [];
    // the king: hops one square forward, later bursts into the four diamonds
    const mv = E.inOutCubic(prog(lt, CTA.move - 0.12, CTA.move + 0.12));
    const hop = Math.sin(Math.PI * clamp((lt - (CTA.move - 0.12)) / 0.24)) * 0.24;
    const kx = lerp(KING_FROM[0], KING_TO[0], mv);
    const kz = lerp(KING_FROM[1], KING_TO[1], mv);
    const land = lt > CTA.move + 0.12 ? Math.exp(-(lt - CTA.move - 0.12) * 14) * Math.sin((lt - CTA.move - 0.12) * 40) * 0.06 : 0;
    const bs = lt < CTA.burst ? 1 + E.inCubic(prog(lt, CTA.burst - 0.25, CTA.burst)) * 0.12 : 1 - E.outExpo(prog(lt, CTA.burst, CTA.burst + 0.12));
    if (bs > 0.01) items.push({ mesh: MESH.king, model: G.chain(G.T(kx, hop, kz), G.S(bs * 0.95, bs * 0.95 * (1 - land), bs * 0.95), G.Ry(0.5)), mat: { color: RED_LIN, rough: 0.2, coat: 1, emit: 0.04 } });
    const sink = E.inCubic(prog(lt, CTA.crane, CTA.crane + 0.5));
    PAWNS.forEach(([px, pz], i) => {
      const y = -sink * 1.2 - i * 0.02 * sink;
      if (y > -1) items.push({ mesh: MESH.pawn, model: G.chain(G.T(px, y, pz), G.S(0.82)), mat: { color: [0.012, 0.012, 0.014], rough: 0.22, coat: 1 } });
    });
    // the four diamonds fly from the king to their places in the logo
    DIA.forEach(([lx, ly], i) => {
      const t0 = CTA.burst;
      const t1 = CTA.diamonds[i];
      if (lt < t0) return;
      const e = E.inOutCubic(prog(lt, t0, t1));
      const [tx, tz] = L2W(lx, ly);
      const arc = Math.sin(Math.PI * e) * 1.4;
      const x = lerp(KING_TO[0], tx, e);
      const z = lerp(KING_TO[1], tz, e);
      const y = lerp(0.5, 0.035, e) + arc;
      const squash = lt > t1 ? 1 - 0.3 * Math.exp(-(lt - t1) * 12) * Math.cos((lt - t1) * 30) : 1;
      const spin = (1 - e) * 5 * (i % 2 ? 1 : -1);
      items.push({ mesh: MESH.diamond, model: G.chain(G.T(x, y, z), G.Ry(Math.PI / 4 + spin), G.Rx(Math.PI / 2), G.S(0.4575, 0.4575, 0.06 * squash)), mat: { color: RED_LIN, rough: 0.18, coat: 1, emit: 0.3 } });
    });
    updateMask(E.inOutCubic(prog(lt, CTA.crane + 0.2, CTA.burst + 0.3)));
    const edge = 1 - smooth(CTA.crane, CTA.burst, lt);
    c.save();
    c.globalAlpha = layerA;
    gl3(c, items, cam, {
      floor: { sq: SQ, colA: [0.74, 0.73, 0.71], colB: [0.006, 0.006, 0.007], reflA: 0.14, reflB: 0.5, board: 4, radius: 9, edge: 0.9 * edge, rim: [1.0, 0.02, 0.06], mask: TEX.mask, maskRect: [-2, -2, 4, 4], fade: 1.3, envI: edge },
      light: { keyDir: [0.5, 1, 0.35], keyCol: [1.7, 1.65, 1.6], envKick: [2.4, 0.02, 0.07], rimCol: [0.9, 0.02, 0.06], rimDir: [-0.4, 0.4, -0.8], shadowCenter: [-0.6, 0, -0.6], shadowSize: 3.2, amb: [0.03, 0.03, 0.03] },
    });
    c.restore();
  }
  // flat logo lockup (appears exactly over the 3D board, then settles)
  if (lt >= CTA.lockup) {
    const p = prog(lt, CTA.lockup + 0.05, CTA.lockup + 0.6);
    const { k, x, y } = lockupPlacement(p);
    c.save();
    c.globalAlpha = smooth(CTA.lockup, CTA.lockup + 0.12, lt);
    c.translate(x, y);
    c.scale(k, k);
    c.fillStyle = WHITE;
    for (const [rx, ry] of LOGO.rects) drawSquare(c, rx + 4, ry + 4, 1);
    c.fillStyle = RED;
    for (const [dx, dy] of DIA) drawDiamond(c, dx, dy, 1);
    for (const [path, col, st] of [
      [LOGO.seventh, RED, 0.3],
      [LOGO.seal, WHITE, 0.4],
    ]) {
      const q = E.outExpo(prog(lt, CTA.lockup + st, CTA.lockup + st + 0.5));
      if (q <= 0) continue;
      c.save();
      c.beginPath();
      c.rect(72, 0, 156 * q, 82);
      c.clip();
      c.translate(-(1 - q) * 14, 0);
      c.fillStyle = col;
      c.fill(path);
      c.restore();
    }
    c.restore();
  }

  // «Ditt trekk.»
  const ty = lerp(430, 380, E.inOutCubic(prog(lt, CTA.crane, CTA.lockup)));
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)';
  c.shadowBlur = 40;
  riseText(c, 'Ditt trekk.', CX, ty, `700 150px ${SANS}`, WHITE, lt, 0.1, { align: 'center', size: 150, tracking: -5, stagger: 0.03 });
  c.restore();

  // CTA button + tap
  const bp = E.outBack(prog(lt, CTA.button, CTA.button + 0.28), 2.2);
  const tap = lt - CTA.tap;
  const press = tap > 0 ? 1 - 0.06 * Math.exp(-tap * 12) * Math.cos(tap * 18) : 1;
  const by = 1010;
  const bw = 800;
  const bh = 132;
  if (bp > 0) {
    c.save();
    c.translate(CX, by);
    c.scale(bp * press, bp * press);
    c.shadowColor = 'rgba(255,30,60,0.55)';
    c.shadowBlur = 60;
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    c.fill();
    c.shadowBlur = 0;
    text(c, 'Få et gratis utkast  →', 0, 18, `700 52px ${SANS}`, WHITE, 1, 'center');
    c.restore();
    if (tap > 0 && tap < 0.5) {
      const rp = tap / 0.5;
      c.strokeStyle = RED;
      c.globalAlpha = 1 - rp;
      c.lineWidth = 5;
      c.beginPath();
      c.roundRect(CX - bw / 2 - rp * 44, by - bh / 2 - rp * 44, bw + rp * 88, bh + rp * 88, bh / 2 + rp * 44);
      c.stroke();
      c.globalAlpha = 1;
    }
    const cm = E.outCubic(prog(lt, CTA.tap - 0.45, CTA.tap - 0.05));
    if (cm > 0) drawCursor(c, lerp(1000, 700, cm), lerp(1500, 1040, cm), 1.9 * (tap > 0 && tap < 0.1 ? 0.9 : 1), WHITE, BLACK);
  }
  const la = prog(lt, CTA.lines, CTA.lines + 0.3);
  riseText(c, 'Helt uforpliktende.', CX, 1160, `500 46px ${SANS}`, WHITE, lt, CTA.lines, { align: 'center', size: 46, alpha: 0.85 });
  riseText(c, 'seventhseal.no', CX, 1262, `600 50px ${MONO}`, WHITE, lt, CTA.lines + 0.15, { align: 'center', size: 50 });
  const ul = E.outExpo(prog(lt, CTA.lines + 0.35, CTA.lines + 0.8));
  if (ul > 0) {
    const Lw = layout(c, 'seventhseal.no', `600 50px ${MONO}`).width;
    c.fillStyle = RED;
    c.fillRect(CX - Lw / 2, 1284, Lw * ul, 6);
  }
}

function computeBoardPx() {
  const cam = ctaCamera(CTA.lockup);
  const proj = G.perspective(cam.fov, W / H, 0.05, 200);
  const view = G.lookAt(cam.eye, cam.target, cam.up);
  const vp = G.mul(proj, view);
  const a = G.project(vp, [-2, 0, -2], W, H);
  const b = G.project(vp, [2, 0, 2], W, H);
  LOGO.k0 = (b[0] - a[0]) / 64;
  // board spans logo units 3.93 … 67.93 horizontally, 9.5 … 73.5 vertically
  LOGO.bx0 = a[0] - 3.93 * LOGO.k0;
  LOGO.by0 = a[1] - 9.5 * LOGO.k0;
}

// ════════════════════════════════════════════════════════════════════════════
// pipeline
// ════════════════════════════════════════════════════════════════════════════
const SCENE_FNS = { count: sceneCount, gone: sceneGone, judge: sceneJudge, rebuild: sceneRebuild, proof: sceneProof, offer: sceneOffer, cta: sceneCta };
const MAX_SUBSAMPLES = { judge: 5, rebuild: 5, proof: 4, offer: 6, cta: 4 };
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
    sx += e * 14 * noise1(d * 36 + i * 10);
    sy += e * 14 * noise1(d * 36 + i * 10 + 50);
    rot += e * 0.008 * noise1(d * 28 + i * 7 + 90);
    zoom += h.s * 0.028 * Math.exp(-d * 14);
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
  c.fillStyle = BLACK;
  c.fillRect(0, 0, W, H);
  const cam = camera(st);
  c.translate(W / 2 + cam.sx, H / 2 + cam.sy);
  c.rotate(cam.rot);
  c.scale(1 + cam.zoom, 1 + cam.zoom);
  c.translate(-W / 2, -H / 2);
  SCENE_FNS[sc.id](c, st - sc.start, st);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

function drawHUD(c, t) {
  const a = E.outCubic(prog(t, 0.35, 0.8)) * (1 - prog(t, S.cta.start + CTA.crane, S.cta.start + CTA.crane + 0.3));
  if (a <= 0) return;
  const sc = SCENES[sceneAt(t)];
  let col = WHITE;
  if (sc.id === 'offer' && t - sc.start >= OFFER.drums - 0.02) col = BLACK;
  c.save();
  c.globalAlpha = a * 0.9;
  markSmall(c, 92, 186, 0.95, sc.id === 'offer' && col === BLACK ? BLACK : RED);
  mono(c, 'SEVENTH SEAL', 122, 194, 22, col, 1, 'left', 600);
  mono(c, 'seventhseal.no', W - 72, 194, 22, col, 0.8, 'right', 500);
  c.restore();
}

function postFx(t, f) {
  let ca = 0;
  let lens = 0;
  for (const h of HITS) {
    const d = t - h.t;
    if (d >= 0 && d < 0.6) {
      ca += h.s * Math.exp(-d * 15);
      lens += h.s * Math.exp(-d * 9);
    }
  }
  const flashAt = (t0, amt, k = 14) => (t >= t0 ? amt * Math.exp(-(t - t0) * k) : 0);
  const flash = Math.min(0.7, flashAt(S.gone.start, 0.55, 16) + flashAt(S.rebuild.start + REBUILD.spin, 0.28, 16) + flashAt(S.cta.start + CTA.burst, 0.3, 18));
  const sc = SCENES[sceneAt(t)].id;
  return {
    bloom: sc === 'gone' || sc === 'count' ? 0.2 : 0.15,
    thresh: 0.9,
    ca: Math.min(ca, 1.6) * 0.0065,
    lens: Math.min(lens, 1.6) * 0.03,
    grain: 0.032,
    vignette: 0.34,
    seed: (f % 97) * 1.37,
    flash,
    flashCol: sc === 'gone' ? [1, 0.12, 0.2] : [1, 1, 1],
  };
}

export async function init(canvas) {
  canvas.width = W;
  canvas.height = H;
  post = G.createPost(canvas);
  const g3 = mk(W, H);
  R = G.createRenderer(g3);
  sceneCv = mk(W, H);
  sctx = sceneCv.getContext('2d');
  accCv = mk(W, H);
  actx = accCv.getContext('2d');

  await Promise.all(
    [`400 100px ${SANS}`, `500 100px ${SANS}`, `700 100px ${SANS}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 100px ${COND}`].map((f) => document.fonts.load(f, 'ÆØÅæøå7S%')),
  );
  await document.fonts.ready;
  await initLogo();
  await Promise.all(
    CLIENTS.map(async (cl) => {
      const img = new Image();
      img.src = `assets/site-${cl.key}.jpg`;
      await img.decode();
      IMG[cl.key] = img;
    }),
  );
  initSwarm();
  initStorm();

  // textures
  for (const cl of CLIENTS) TEX[cl.key] = R.texture(IMG[cl.key]);
  oldCv = mk(SW, SH);
  oldCtx = oldCv.getContext('2d');
  drawOldSite(oldCtx, 0);
  TEX.old = R.texture(oldCv);
  newCv = mk(SW, SH);
  newCtx = newCv.getContext('2d');
  drawNewSite(newCtx, 0, null);
  TEX.newS = R.texture(newCv);
  // odometer digits: 10 cells around the drum, drawn with the arc/width aspect
  const cellH = 256;
  const texW = Math.round((cellH * DRUM.w) / ((TAU * DRUM.r) / 10));
  const dc = mk(texW, cellH * 10);
  const dx = dc.getContext('2d');
  dx.fillStyle = '#0B0B0B';
  dx.fillRect(0, 0, dc.width, dc.height);
  dx.fillStyle = '#FFFFFF';
  dx.textAlign = 'center';
  dx.textBaseline = 'middle';
  for (let d = 0; d < 10; d++) {
    dx.save();
    dx.translate(texW / 2, d * cellH + cellH / 2 + 6);
    dx.scale(texW / (cellH * 0.62), 1);
    dx.font = `400 214px ${COND}`;
    dx.fillText(String(d), 0, 0);
    dx.restore();
  }
  TEX.digits = R.texture(dc, { repeat: true });
  maskCv = mk(8, 8);
  maskCtx = maskCv.getContext('2d');
  maskCtx.fillStyle = '#fff';
  maskCtx.fillRect(0, 0, 8, 8);
  TEX.mask = R.texture(maskCv, { nearest: true });

  // meshes
  MESH.body = R.mesh(G.slabGeo(PH.w, PH.h, PH.d, PH.r, PH.b, 12, 6));
  MESH.glass = R.mesh(G.panelGeo(PH.w - 0.028, PH.h - 0.028, PH.r - 0.014, 12));
  MESH.screen = R.mesh(G.panelGeo(PH.sw, PH.sh, PH.sr, 12));
  MESH.tile = R.mesh(G.boxGeo(1, 1, 1));
  MESH.box = R.mesh(G.boxGeo(1, 1, 1));
  MESH.diamond = R.mesh(G.slabGeo(1, 1, 1, 0.12, 0.08, 4, 3));
  MESH.drum = R.mesh(G.drumArcGeo(DRUM.r, DRUM.w, Math.PI / 2 - 0.44, Math.PI / 2 + 0.44, 48));
  MESH.king = R.mesh(
    G.mergeGeo(
      [
        G.latheGeo(
          [
            [0, 0],
            [0.3, 0, 1],
            [0.3, 0.035],
            [0.285, 0.055],
            [0.295, 0.075, 1],
            [0.25, 0.1],
            [0.205, 0.125],
            [0.2, 0.15, 1],
            [0.155, 0.19],
            [0.13, 0.32],
            [0.112, 0.5],
            [0.105, 0.6, 1],
            [0.165, 0.625],
            [0.175, 0.645],
            [0.16, 0.665],
            [0.12, 0.68, 1],
            [0.112, 0.705],
            [0.15, 0.8],
            [0.175, 0.86],
            [0.18, 0.875, 1],
            [0.13, 0.9],
            [0.07, 0.92],
            [0, 0.93],
          ],
          72,
        ),
      ],
      [G.boxGeo(0.055, 0.19, 0.055), G.T(0, 1.01, 0)],
      [G.boxGeo(0.15, 0.052, 0.055), G.T(0, 1.035, 0)],
    ),
  );
  MESH.pawn = R.mesh(
    G.latheGeo(
      [
        [0, 0],
        [0.26, 0, 1],
        [0.26, 0.035],
        [0.245, 0.055],
        [0.25, 0.075, 1],
        [0.2, 0.1],
        [0.16, 0.13, 1],
        [0.12, 0.2],
        [0.095, 0.33],
        [0.09, 0.38, 1],
        [0.14, 0.4],
        [0.145, 0.415],
        [0.1, 0.43, 1],
        [0.13, 0.47],
        [0.148, 0.52],
        [0.14, 0.58],
        [0.11, 0.625],
        [0.06, 0.65],
        [0, 0.655],
      ],
      64,
    ),
  );
  computeBoardPx();
}

export function renderFrame(f, { subsamples = 4, shutter = 0.5 } = {}) {
  const t0 = f / FPS;
  frameT = t0;
  const si = sceneAt(t0);
  const n = Math.max(1, Math.min(subsamples, MAX_SUBSAMPLES[SCENES[si].id] ?? subsamples));
  for (let k = 0; k < n; k++) {
    const ts = Math.min(t0 + ((k / n) * shutter) / FPS, nextCut(t0) - 1e-4);
    J = n > 1 ? [halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5] : [0, 0];
    drawWorld(sctx, ts, si);
    actx.globalCompositeOperation = 'source-over';
    actx.globalAlpha = 1 / (k + 1);
    actx.drawImage(sceneCv, 0, 0);
  }
  actx.globalAlpha = 1;
  drawHUD(actx, t0);
  post.run(accCv, postFx(t0, f));
}

export const totalFrames = Math.round(DURATION * FPS);
