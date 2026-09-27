// SEVENTH SEAL — brand reel
// Deterministic, frame-accurate motion graphics renderer: every pixel is a pure
// function of time, so frames render in any order, in parallel, with true
// sub-frame motion blur. Brand material (logo geometry, palette, type, copy and
// case studies) comes from seventhseal.no.

import {
  W,
  H,
  FPS,
  BEAT,
  BAR,
  DURATION,
  SCENES,
  S,
  HITS,
  MONTAGE_CUTS,
  MONTAGE_LABELS,
  DIAMOND_BEATS,
  TAGLINE_IDAG,
  WORK_QUOTE,
  PRICE_CHECKS,
  PILLAR_CHASE,
  CLICK_T,
} from './timeline.js';

export { W, H, FPS, DURATION };

// ─── brand ─────────────────────────────────────────────────────────────────
const RED = '#FF1E3C';
const DRED = '#D70022';
const BLACK = '#0A0A0A';
const WHITE = '#FFFFFF';
const GRAY = '#F2F2F2';
const SANS = '"IBM Plex Sans", sans-serif';
const MONO = '"IBM Plex Mono", monospace';
const COND = '"Anton", sans-serif';

// ─── math ──────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const E = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
function spring(t, w = 18, z = 0.35) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, f * f * (3 - 2 * f));
}
const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${lerp(A[0], B[0], t) | 0},${lerp(A[1], B[1], t) | 0},${lerp(A[2], B[2], t) | 0})`;
}

// ─── canvas helpers ────────────────────────────────────────────────────────
function mk(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}
function fillBg(c, color) {
  c.fillStyle = color;
  c.fillRect(-300, -300, W + 600, H + 600);
}
function line(c, x0, y0, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}
const layoutCache = new Map();
function layout(c, text, font, tracking = 0) {
  const key = font + '|' + text + '|' + tracking;
  let L = layoutCache.get(key);
  if (L) return L;
  c.save();
  c.font = font;
  const glyphs = [];
  for (let i = 0; i < text.length; i++) {
    glyphs.push({ ch: text[i], x: c.measureText(text.slice(0, i)).width + i * tracking, w: c.measureText(text[i]).width });
  }
  const width = c.measureText(text).width + (text.length - 1) * tracking;
  c.restore();
  L = { glyphs, width };
  layoutCache.set(key, L);
  return L;
}
function text(c, str, x, y, font, color, alpha = 1, align = 'left') {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(str, x, y);
  c.restore();
}
const mono = (c, str, x, y, size, color, alpha = 1, align = 'left', weight = 500) =>
  text(c, str, x, y, `${weight} ${size}px ${MONO}`, color, alpha, align);
const typed = (s, p) => s.slice(0, Math.floor(clamp(p) * s.length + 1e-4));

// Per-glyph masked rise — the reel's signature type move.
function riseText(c, str, x, base, font, color, lt, start, { tracking = 0, stagger = 0.022, dur = 0.45, dist = 1.25, clip = true, size = 200 } = {}) {
  const L = layout(c, str, font, tracking);
  c.save();
  if (clip) {
    c.beginPath();
    c.rect(x - 40, base - size * 1.05, L.width + 120, size * 1.35);
    c.clip();
  }
  c.font = font;
  c.fillStyle = color;
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const q = E.outExpo(prog(lt, start + j * stagger, start + j * stagger + dur));
    if (q <= 0) continue;
    c.fillText(g.ch, x + g.x, base + (1 - q) * size * dist);
  }
  c.restore();
  return L.width;
}

let SD = BAR; // duration of the scene being drawn

function kickEnv(t) {
  if (t < S.tagline.start || t >= S.contact.start) return 0;
  return Math.exp(-(t % BEAT) * 10);
}

// ─── the logo, parsed from the real SVG ───────────────────────────────────
const LOGO = { rects: [], parity: 0 };
// Diamond centres in logo units, clockwise from the top.
const DIA = [
  [13.24, 10.47],
  [21.24, 18.47],
  [13.24, 26.47],
  [5.24, 18.47],
];

async function initLogo() {
  const svg = await (await fetch('assets/logo-7S.svg')).text();
  LOGO.rects = [...svg.matchAll(/matrix\(-1 0 0 1 ([\d.]+) ([\d.]+)\)/g)].map((m) => [parseFloat(m[1]) - 8, parseFloat(m[2])]);
  const paths = [...svg.matchAll(/<path[^>]*? d="([^"]+)"[^>]*?fill="([^"]+)"/g)];
  LOGO.seventh = new Path2D(paths[1][1]);
  LOGO.seal = new Path2D(paths[2][1]);
  const [x0, y0] = LOGO.rects[0];
  LOGO.parity = (Math.round((x0 - 3.93) / 8) + Math.round((y0 - 9.5) / 8)) % 2;
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

// ─── concrete texture ──────────────────────────────────────────────────────
let concrete;
function initConcrete() {
  const S = 512;
  const cv = mk(S, S);
  const c = cv.getContext('2d');
  const img = c.createImageData(S, S);
  const vn = (x, y, s, seed) => {
    const xi = Math.floor(x / s);
    const yi = Math.floor(y / s);
    const fx = x / s - xi;
    const fy = y / s - yi;
    const h = (a, b) => hash(((a % 4096) + 4096) * 7919 + ((b % 4096) + 4096) * 104729 + seed);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = vn(x, y, 64, 1) * 0.5 + vn(x, y, 16, 2) * 0.3 + vn(x, y, 4, 3) * 0.2;
      const g = 200 + n * 55 + (hash(y * S + x) - 0.5) * 22;
      const o = (y * S + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  c.fillStyle = 'rgba(40,40,40,0.55)';
  for (let i = 0; i < 90; i++) {
    c.beginPath();
    c.ellipse(hash(i * 3 + 1) * S, hash(i * 3 + 2) * S, 1 + hash(i * 3 + 3) * 3.5, 1 + hash(i * 3 + 4) * 3, 0, 0, TAU);
    c.fill();
  }
  concrete = cv;
}

// ════════════════════════════════════════════════════════════════════════════
// 01 — SEGLET: the board fills in, four diamonds land on the beat
// ════════════════════════════════════════════════════════════════════════════
function sceneSeal(c, lt, t) {
  fillBg(c, BLACK);
  const k = 10.5;
  const ox = W / 2 - 34 * k;
  const oy = H / 2 - 39.3 * k;
  const z = E.inExpo(prog(lt, 3.5 * BEAT, 4 * BEAT));
  const pulseT = lt - 3 * BEAT;
  const pulse = pulseT > 0 ? Math.exp(-pulseT * 8) * Math.sin(pulseT * 28) * 0.05 : 0;

  // camera: slow push, then dive into the top diamond
  const [fdx, fdy] = DIA[0];
  const Fx = ox + fdx * k;
  const Fy = oy + fdy * k;
  const m = E.inOutCubic(prog(lt, 3.3 * BEAT, 4 * BEAT));
  const zs = (1 + lt * 0.03 + pulse) * (1 + z * 80);
  c.save();
  c.translate(lerp(Fx, W / 2, m), lerp(Fy, H / 2, m));
  c.scale(zs, zs);
  c.translate(-Fx, -Fy);

  // faint full-field board
  c.fillStyle = WHITE;
  for (let gy = -6; gy < 14; gy++) {
    for (let gx = -12; gx < 20; gx++) {
      if ((((gx + gy) % 2) + 2) % 2 !== LOGO.parity) continue;
      const cx = ox + (3.93 + gx * 8 + 4) * k;
      const cy = oy + (9.5 + gy * 8 + 4) * k;
      const d = Math.hypot(cx - W / 2, cy - H / 2);
      const a = E.outCubic(prog(lt, 0.1 + d / 3000, 0.45 + d / 3000));
      if (a <= 0) continue;
      c.globalAlpha = 0.07 * a;
      c.beginPath();
      c.roundRect(cx - 4 * k * a, cy - 4 * k * a, 8 * k * a, 8 * k * a, k);
      c.fill();
    }
  }
  c.globalAlpha = 1;

  c.save();
  c.translate(ox, oy);
  c.scale(k, k);
  // the logo's own board
  c.fillStyle = WHITE;
  for (const [x, y] of LOGO.rects) {
    const cx = x + 4;
    const cy = y + 4;
    const d = cx + cy;
    let s = E.outBack(prog(lt, 0.02 + (d / 140) * 0.42, 0.3 + (d / 140) * 0.42), 2.2);
    // ripple from each diamond landing
    DIAMOND_BEATS.forEach((b, i) => {
      const dt = lt - b * BEAT;
      if (dt <= 0 || dt > 0.8) return;
      const dist = Math.hypot(cx - DIA[i][0], cy - DIA[i][1]);
      const front = dt * 160;
      s += 0.28 * Math.exp(-((dist - front) ** 2) / 90) * Math.exp(-dt * 4);
    });
    if (s > 0) drawSquare(c, cx, cy, s);
  }
  // diamonds
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  c.fillStyle = RED;
  DIAMOND_BEATS.forEach((b, i) => {
    const T = b * BEAT;
    const [dx, dy] = DIA[i];
    const fly = prog(lt, T - 0.32, T);
    if (fly <= 0) return;
    const e = E.inQuart(fly);
    const [vx, vy] = dirs[i];
    const x = lerp(dx + vx * 70 - vy * 30, dx, e);
    const y = lerp(dy + vy * 70 + vx * 30, dy, e);
    const land = lt - T;
    const squash = land > 0 ? 0.3 * Math.exp(-land * 9) * Math.sin(land * 32) : 0;
    const s = lerp(3.2, 1, e) * (1 + squash);
    const rot = (1 - e) * (i % 2 ? -2.4 : 2.4);
    c.save();
    c.shadowColor = 'rgba(255,30,60,0.55)';
    c.shadowBlur = 50;
    drawDiamond(c, x, y, s, rot);
    c.restore();
    if (land > 0 && land < 0.5) {
      const p = land / 0.5;
      c.strokeStyle = RED;
      c.globalAlpha = 1 - p;
      c.lineWidth = 0.6 * (1 - p) + 0.08;
      c.beginPath();
      c.arc(dx, dy, 4 + E.outExpo(p) * 30, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    }
  });
  c.restore();
  c.restore();

}

// ════════════════════════════════════════════════════════════════════════════
// 02 — VISJON: "Designer morgendagens nettsider, i dag."
// ════════════════════════════════════════════════════════════════════════════
function sceneTagline(c, lt) {
  if (lt < TAGLINE_IDAG * BEAT) {
    fillBg(c, RED);
    const push = 1 + lt * 0.025;
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(push, push);
    c.translate(-W / 2, -H / 2);
    const font = `700 232px ${SANS}`;
    const lines = [
      ['Designer', WHITE, 0],
      ['morgendagens', BLACK, BEAT],
      ['nettsider,', WHITE, 2 * BEAT],
    ];
    lines.forEach(([str, col, st], i) => {
      riseText(c, str, 150, 400 + i * 230, font, col, lt, st, { tracking: -9, size: 232 });
    });
    // small red-on-red index marks
    mono(c, '( 01 )', 1770, 250, 22, BLACK, prog(lt, 0.1, 0.3), 'right', 600);
    c.restore();
    return;
  }
  // "i dag." — then the board wipes in
  fillBg(c, BLACK);
  const font = `700 520px ${SANS}`;
  const L = layout(c, 'i dag.', font, -20);
  const x0 = W / 2 - L.width / 2;
  const base = 720;
  c.font = font;
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const st = TAGLINE_IDAG * BEAT + j * 0.03;
    const s = E.outBack(prog(lt, st, st + 0.24), 2.4);
    if (s <= 0) continue;
    c.save();
    c.translate(x0 + g.x + g.w / 2, base);
    c.scale(s, s);
    c.fillStyle = RED;
    c.fillText(g.ch, -g.w / 2, 0);
    c.restore();
  }
  checkerWipe(c, prog(lt, SD - 0.5 * BEAT, SD), WHITE, 'in');
}

// Board-square wipe: 'in' covers the frame column by column, 'out' uncovers.
function checkerWipe(c, p, color, mode) {
  if (p <= 0 && mode === 'in') return;
  const S = 160;
  const cols = Math.ceil(W / S) + 1;
  const rows = Math.ceil(H / S) + 1;
  c.fillStyle = color;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d = (i + j * 0.5) / (cols + rows * 0.5);
      let s = E.outCubic(prog(p, d * 0.7, d * 0.7 + 0.3));
      if (mode === 'out') s = 1 - s;
      if (s <= 0) continue;
      const cx = i * S + S / 2 - 40;
      const cy = j * S + S / 2 - 40;
      const hs = (S / 2 + 1) * s;
      c.beginPath();
      c.roundRect(cx - hs, cy - hs, hs * 2, hs * 2, 14 * (1 - s) + 1);
      c.fill();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 03 — BYRÅKVALITET: the 7S glyph storm from the site's hero
// ════════════════════════════════════════════════════════════════════════════
const STORM = [];
function initStorm() {
  for (let i = 0; i < 150; i++) {
    const h = (k) => hash(i * 17 + k * 131 + 7);
    STORM.push({
      x: (h(1) - 0.5) * 3400,
      y: (h(2) - 0.5) * 2000,
      z: h(3) * 4200,
      ch: h(4) < 0.5 ? '7' : 'S',
      spin: (h(5) - 0.5) * 2.5,
      yaw: (h(6) - 0.5) * 7,
      ph: h(7) * TAU,
      size: 150 + h(8) * 120,
    });
  }
}

function sceneStorm(c, lt, t) {
  fillBg(c, BLACK);
  const F = 900;
  const D = 4200;
  const camZ = lt * 2400 + E.inExpo(prog(lt, SD - 0.525, SD)) * 5200;
  const items = [];
  for (const g of STORM) {
    let z = ((((g.z - camZ) % D) + D) % D) + 40;
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
    const a = clamp((D - z) / 900) * clamp((z - 40) / 120);
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

  // headline on a black band
  const out = E.inExpo(prog(lt, SD - 0.5 * BEAT, SD));
  const band = E.outExpo(prog(lt, BEAT - 0.05, BEAT + 0.3));
  if (band > 0) {
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(1 + out * 2.5, 1 + out * 2.5);
    c.translate(-W / 2, -H / 2);
    c.globalAlpha = 1 - out;
    c.fillStyle = BLACK;
    const bw = 1500 * band;
    c.fillRect(W / 2 - bw / 2, 330, bw, 440);
    c.fillStyle = RED;
    c.fillRect(W / 2 - bw / 2, 330, 10, 440 * band);
    const font = `700 150px ${SANS}`;
    const w1 = layout(c, 'Byråkvalitet,', font, -5).width;
    const w2 = layout(c, 'uten byråpris.', font, -5).width;
    riseText(c, 'Byråkvalitet,', W / 2 - w1 / 2, 500, font, WHITE, lt, BEAT, { tracking: -5, size: 150, stagger: 0.016 });
    const L = layout(c, 'uten ', font, -5);
    riseText(c, 'uten ', W / 2 - w2 / 2, 670, font, WHITE, lt, 2 * BEAT, { tracking: -5, size: 150, stagger: 0.016 });
    riseText(c, 'byråpris.', W / 2 - w2 / 2 + L.width + 5, 670, font, RED, lt, 2 * BEAT + 0.08, { tracking: -5, size: 150, stagger: 0.016 });
    mono(c, typed('HØY KVALITET TIL EN BRØKDEL AV PRISEN HOS TRADISJONELLE BYRÅER', prog(lt, 2.5 * BEAT, 4 * BEAT)), W / 2, 735, 19, WHITE, 0.75, 'center', 500);
    c.restore();
  }

  // opening: board squares clear away
  checkerWipe(c, prog(lt, 0, 0.32), WHITE, 'out');
  if (out > 0.6) {
    c.fillStyle = WHITE;
    c.globalAlpha = smooth(0.6, 1, out) * 0.8;
    c.fillRect(-300, -300, W + 600, H + 600);
    c.globalAlpha = 1;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 04 — 7 SØYLER: seven concrete pillars
// ════════════════════════════════════════════════════════════════════════════
const PILLARS = ['PROFESJONELT DESIGN', 'STRUKTUR OG NAVIGASJON', 'TYDELIG KOMMUNIKASJON', 'YTELSE OG HASTIGHET', 'TILGJENGELIGHET', 'KONVERTERING I FOKUS', 'BYGGET FOR VEKST'];

function scenePillars(c, lt) {
  fillBg(c, BLACK);
  const F = 1000;
  const camX = lerp(-90, 90, E.inOutSine(prog(lt, 0, SD)));
  const camY = -60;
  const camZ = lerp(-1750, -1380, E.outCubic(prog(lt, 0, SD)));
  const floor = 520;
  const P = (x, y, z) => {
    const s = F / (z - camZ);
    return [W / 2 + (x - camX) * s, H / 2 + (y - camY) * s, s];
  };

  // floor glow
  const [, fy] = P(0, floor, 0);
  const fg = c.createLinearGradient(0, fy, 0, H);
  fg.addColorStop(0, '#2a2a2a');
  fg.addColorStop(1, '#050505');
  c.fillStyle = fg;
  c.fillRect(-300, fy, W + 600, H - fy + 300);

  const pw = 150;
  const pd = 150;
  const Hmax = 1160;
  const drop = (i) => E.inExpo(prog(lt, SD - 0.275 + (6 - i) * 0.02, SD - 0.035 + (6 - i) * 0.02));
  const caps = [];
  const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => Math.abs((b - 3) * 300 - camX) - Math.abs((a - 3) * 300 - camX));
  for (const i of order) {
    const x = (i - 3) * 300;
    const h = Hmax * E.outExpo(prog(lt, 0.04 + i * 0.058, 0.5 + i * 0.058)) * (1 - drop(i));
    if (h <= 1) continue;
    const top = floor - h;
    const [ax, ay, s] = P(x - pw / 2, top, 0);
    const [bx, by] = P(x + pw / 2, floor, 0);
    // side face
    const sideX = camX < x - pw / 2 ? x - pw / 2 : camX > x + pw / 2 ? x + pw / 2 : null;
    if (sideX !== null) {
      const [s0x, s0y] = P(sideX, top, 0);
      const [s1x, s1y] = P(sideX, top, pd);
      const [s2x, s2y] = P(sideX, floor, pd);
      const [s3x, s3y] = P(sideX, floor, 0);
      const sg = c.createLinearGradient(0, s0y, 0, s3y);
      sg.addColorStop(0, '#5d5d5a');
      sg.addColorStop(1, '#222221');
      c.fillStyle = sg;
      c.beginPath();
      c.moveTo(s0x, s0y);
      c.lineTo(s1x, s1y);
      c.lineTo(s2x, s2y);
      c.lineTo(s3x, s3y);
      c.fill();
    }
    // front face: concrete
    c.save();
    c.beginPath();
    c.rect(ax, ay, bx - ax, by - ay);
    c.clip();
    const g = c.createLinearGradient(0, ay, 0, by);
    g.addColorStop(0, '#f4f4f1');
    g.addColorStop(1, '#a9a9a4');
    c.fillStyle = g;
    c.fillRect(ax, ay, bx - ax, by - ay);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(concrete, ax - (i * 97) % 300, ay, (bx - ax) * 4, (bx - ax) * 4 * 4);
    c.globalCompositeOperation = 'source-over';
    // red capital chases across the pillars on 16ths
    // guided reading: each pillar lights up for one beat, in order
    const { start: c0, step } = PILLAR_CHASE;
    const cs = c0 + i * step;
    const hi = smooth(cs, cs + 0.06, lt) * (1 - smooth(cs + step, cs + step + 0.12, lt));
    const allOn = c0 + 7 * step;
    const lit = smooth(allOn, allOn + 0.1, lt); // then all seven together
    const capH = 170 * s;
    c.fillStyle = mix('#1a1a1a', RED, clamp(lit + hi));
    c.globalAlpha = 0.25 + 0.75 * clamp(lit + hi);
    c.fillRect(ax, ay, bx - ax, capH);
    c.globalAlpha = 1;
    if (lit + hi > 0.02) caps.push([ax, ay, bx - ax, capH]);
    c.font = `600 ${40 * s}px ${MONO}`;
    c.fillStyle = WHITE;
    c.textAlign = 'center';
    c.fillText(String(i + 1).padStart(2, '0'), (ax + bx) / 2, ay + capH * 0.66);
    // vertical pillar name
    c.save();
    c.translate((ax + bx) / 2 + 12 * s, by - 50 * s);
    c.rotate(-Math.PI / 2);
    c.font = `700 ${34 * s}px ${SANS}`;
    c.fillStyle = mix(BLACK, RED, hi);
    c.globalAlpha = 0.82 + 0.18 * hi;
    c.textAlign = 'left';
    c.fillText(PILLARS[i], 0, 0);
    c.restore();
    c.textAlign = 'left';
    c.restore();
  }

  // headline — difference-blended so it inverts over concrete; plain white
  // over the red capitals so red never inverts to cyan
  const ha = prog(lt, 0.45, 0.5) * (1 - drop(3));
  if (ha > 0) {
    const headline = (col) => {
      const font = `400 250px ${COND}`;
      const L = layout(c, '7 SØYLER', font, 4);
      riseText(c, '7 SØYLER', W / 2 - L.width / 2, 520, font, col, lt, 0.45, { tracking: 4, size: 250, stagger: 0.03 });
      const f2 = `700 54px ${SANS}`;
      const L2 = layout(c, 'for webdesign', f2, -1);
      riseText(c, 'for webdesign', W / 2 - L2.width / 2, 600, f2, col, lt, 0.7, { tracking: -1, size: 54, stagger: 0.012 });
    };
    c.save();
    c.beginPath();
    c.rect(-300, -300, W + 600, H + 600);
    for (const r of caps) c.rect(...r);
    c.clip('evenodd');
    c.globalCompositeOperation = 'difference';
    headline(WHITE);
    c.restore();
    if (caps.length) {
      c.save();
      c.beginPath();
      for (const r of caps) c.rect(...r);
      c.clip();
      headline(WHITE);
      c.restore();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 05 — ARBEID: three live case studies, scrolling
// ════════════════════════════════════════════════════════════════════════════
const WORK = [
  { key: 'skogli', url: 'skogligaard.no', name: 'Skogli Gard', cat: 'REISE / OPPLEVELSE' },
  { key: 'okonomiledelse', url: 'okonomiledelse.com', name: 'Økonomiledelse AS', cat: 'ØKONOMI / RÅDGIVNING' },
  { key: 'amir', url: 'lilleamirfrisør.no', name: 'Lille Amir Frisør', cat: 'TJENESTER' },
];

function browserWindow(c, x, y, w, h, img, scroll, url) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.18)';
  c.shadowBlur = 50;
  c.shadowOffsetY = 20;
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(x, y, w, h, 14);
  c.fill();
  c.restore();
  c.fillStyle = '#E6E6E6';
  c.beginPath();
  c.roundRect(x, y, w, 42, [14, 14, 0, 0]);
  c.fill();
  for (let d = 0; d < 3; d++) {
    c.fillStyle = ['#C9C9C9', '#C9C9C9', '#C9C9C9'][d];
    c.beginPath();
    c.arc(x + 22 + d * 18, y + 21, 5.5, 0, TAU);
    c.fill();
  }
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(x + 90, y + 10, w - 180, 22, 11);
  c.fill();
  mono(c, url, x + w / 2, y + 26, 13, '#555', 1, 'center', 500);
  c.save();
  c.beginPath();
  c.roundRect(x, y + 42, w, h - 42, [0, 0, 14, 14]);
  c.clip();
  const sc = w / img.width;
  c.drawImage(img, 0, scroll, img.width, (h - 42) / sc, x, y + 42, w, h - 42);
  c.restore();
}

function sceneWork(c, lt) {
  fillBg(c, GRAY);
  const out = (i) => E.inExpo(prog(lt, SD - 0.55 * BEAT + i * 0.04, SD - 0.1 * BEAT + i * 0.04));
  riseText(c, 'Arbeid', 150, 205, `700 118px ${SANS}`, BLACK, lt, 0.02, { tracking: -4, size: 118 });
  c.fillStyle = RED;
  drawDiamond(c, 128, 170, 3.2 * E.outBack(prog(lt, 0.05, 0.3), 3));
  mono(c, typed('UTVALGTE PROSJEKTER — 2026', prog(lt, 0.15, 0.5)), 1770, 200, 20, BLACK, 0.7, 'right', 600);

  const w = 500;
  const hgt = 560;
  WORK.forEach((wk, i) => {
    const st = i * 0.12;
    const p = E.outExpo(prog(lt, st, st + 0.55));
    if (p <= 0) return;
    const x = 150 + i * (w + 60);
    const y = 280 + (1 - p) * 760 - out(i) * 1300;
    const img = IMAGES[wk.key];
    const q = (lt - 0.3 - i * 0.08) / BEAT;
    const n = Math.floor(q);
    const eased = q < 0 ? 0 : n + E.outExpo(clamp((q - n) / 0.45));
    const maxScroll = img.height - (hgt - 42) / (w / img.width);
    const steps = (SD - 0.3) / BEAT - 1.5; // reach the bottom just before the exit
    const scroll = clamp((eased * maxScroll) / steps, 0, maxScroll);
    c.save();
    c.translate(x + w / 2, y + hgt / 2);
    c.rotate((1 - p) * (i - 1) * 0.12);
    c.translate(-x - w / 2, -y - hgt / 2);
    browserWindow(c, x, y, w, hgt, img, scroll, wk.url);
    text(c, wk.name, x + 2, y + hgt + 52, `700 30px ${SANS}`, BLACK);
    mono(c, wk.cat, x + 2, y + hgt + 82, 15, '#666', 1, 'left', 500);
    mono(c, 'Skroll ↕', x + w - 2, y + hgt + 52, 15, RED, 1, 'right', 600);
    c.restore();
  });

  // testimonial card → grows into the next scene's red
  const qa = E.outBack(prog(lt, WORK_QUOTE * BEAT, WORK_QUOTE * BEAT + 0.25), 2);
  if (qa > 0) {
    const grow = E.inExpo(prog(lt, SD - 0.5 * BEAT, SD));
    const cw = 600;
    const ch = 170;
    const cx = lerp(1300, W / 2, grow);
    const cy = lerp(700, H / 2, grow);
    c.save();
    c.translate(cx, cy);
    c.scale(qa * (1 + grow * 3.4), qa * (1 + grow * 6.8));
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(-cw / 2, -ch / 2, cw, ch, 10 * (1 - grow));
    c.fill();
    c.globalAlpha = 1 - grow * 3;
    text(c, '«Akkurat det vi var ute etter.»', -cw / 2 + 34, -8, `700 36px ${SANS}`, WHITE);
    mono(c, '— LILLE AMIR FRISØR', -cw / 2 + 36, 42, 16, WHITE, 0.85, 'left', 600);
    c.restore();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 06 — PRIS: slot-machine price, checklist
// ════════════════════════════════════════════════════════════════════════════
const CHECKS = ['Adminpanel inkludert', 'Hosting og drift', '3 revisjonsrunder', 'Normalt ferdig på 2–4 uker', 'Gratis førsteutkast'];

function scenePrice(c, lt) {
  fillBg(c, RED);
  // moving diagonal stripes, accelerating into the drop
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-Math.PI / 4);
  c.fillStyle = DRED;
  c.globalAlpha = 0.35;
  const speed = lt * 180 + E.inExpo(prog(lt, SD - BAR / 2, SD)) * 1400;
  for (let x = -1800; x < 1800; x += 120) c.fillRect(x + (speed % 120), -1600, 40, 3200);
  c.restore();

  mono(c, 'FRA', 156, 318, 26, WHITE, prog(lt, 0.02, 0.15) * 0.85, 'left', 600);
  // price — rolling digits
  const font = `400 330px ${COND}`;
  c.font = font;
  const dw = c.measureText('0').width;
  const digits = ['7', ' ', '5', '0', '0'];
  let x = 150;
  const base = 640;
  digits.forEach((d, j) => {
    if (d === ' ') {
      x += dw * 0.32;
      return;
    }
    const v = Number(d);
    const p = E.outExpo(prog(lt, 0.02 + j * 0.05, 0.62 + j * 0.05));
    const pos = v + 10 * (2 + j) * (1 - p);
    c.save();
    c.beginPath();
    c.rect(x - 4, base - 300, dw + 8, 330);
    c.clip();
    c.fillStyle = WHITE;
    const fl = Math.floor(pos);
    const fr = pos - fl;
    for (const [n, off] of [
      [fl, fr],
      [fl + 1, fr - 1],
    ]) {
      c.fillText(String(((n % 10) + 10) % 10), x, base + off * 330);
    }
    c.restore();
    x += dw;
  });
  const kr = E.outExpo(prog(lt, 0.35, 0.7));
  text(c, 'kr', x + 24, base, `400 150px ${COND}`, WHITE, kr);
  riseText(c, '+ 500 kr/mnd', 156, 750, `700 66px ${SANS}`, BLACK, lt, BEAT * 0.5, { tracking: -1, size: 66, stagger: 0.015 });
  mono(c, typed('PRISENE ER DE DERE BETALER — INGEN MVA I TILLEGG', prog(lt, BEAT, 1.7 * BEAT)), 158, 812, 18, WHITE, 0.85, 'left', 600);

  // checklist
  CHECKS.forEach((str, i) => {
    const st = PRICE_CHECKS[i] * BEAT;
    const p = E.outExpo(prog(lt, st, st + 0.3));
    if (p <= 0) return;
    const y = 330 + i * 100;
    const bx = 1080;
    c.save();
    c.translate(bx + 23, y - 15);
    c.scale(E.outBack(prog(lt, st, st + 0.2), 3), E.outBack(prog(lt, st, st + 0.2), 3));
    c.fillStyle = WHITE;
    c.beginPath();
    c.roundRect(-23, -23, 46, 46, 6);
    c.fill();
    c.restore();
    const ck = E.outCubic(prog(lt, st + 0.06, st + 0.2));
    if (ck > 0) {
      c.strokeStyle = RED;
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      const pts = [
        [bx + 11, y - 15],
        [bx + 20, y - 5],
        [bx + 36, y - 26],
      ];
      const l1 = Math.hypot(9, 10);
      const l2 = Math.hypot(16, 21);
      const L = (l1 + l2) * ck;
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
    c.save();
    c.beginPath();
    c.rect(bx + 70, y - 60, 800, 80);
    c.clip();
    text(c, str, bx + 78 - (1 - p) * 60, y, `500 46px ${SANS}`, WHITE, p);
    c.restore();
  });

  // black board wipe into the montage
  checkerWipe(c, prog(lt, SD - 0.5 * BEAT, SD), BLACK, 'in');
}

// ════════════════════════════════════════════════════════════════════════════
// 07 — PROSESS: eight half-beat cuts
// ════════════════════════════════════════════════════════════════════════════
const HB = BEAT / 2;

const cutIndex = (t) => {
  let k = 0;
  while (k < MONTAGE_CUTS.length - 1 && t >= MONTAGE_CUTS[k + 1].start - 1e-9) k++;
  return k;
};

function sceneProcess(c, lt, t) {
  const k = cutIndex(t);
  const rel = MONTAGE_CUTS[k].start - S.process.start;
  const u = lt - rel;
  const uq = frameLt(lt, t) - rel;
  const punch = 1 + 0.08 * (1 - E.outExpo(prog(u, 0, 0.16)));
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(punch, punch);
  c.translate(-W / 2, -H / 2);
  [cutFigma, cutCode, cutResponsive, cutAdmin, cutSpeed, cutSecure, cutAccess, cutGoogle][k](c, u, uq, lt);
  c.restore();
}

function bigLabel(c, str, x, y, color, u, align = 'left') {
  const font = `700 76px ${SANS}`;
  const L = layout(c, str, font, -2);
  riseText(c, str, align === 'left' ? x : x - L.width, y, font, color, u, 0.0, { tracking: -2, size: 76, stagger: 0.008, dur: 0.18 });
}

function cutFigma(c, u) {
  fillBg(c, '#2C2C2C');
  c.fillStyle = '#1E1E1E';
  c.fillRect(0, 0, 300, H);
  c.fillRect(0, 0, W, 56);
  ['Hjem', '  Navigasjon', '  Hero', '    Overskrift', '    Knapp', '  Tjenester', '  Kontakt'].forEach((s, i) => {
    c.fillStyle = i === 4 ? 'rgba(255,30,60,0.25)' : 'transparent';
    c.fillRect(0, 90 + i * 40, 300, 36);
    mono(c, s, 24, 114 + i * 40, 17, '#DADADA', 0.9, 'left', 500);
  });
  mono(c, 'Desktop — 1440', 480, 170, 16, '#9A9A9A', 1, 'left', 500);
  c.fillStyle = WHITE;
  c.fillRect(480, 184, 1260, 700);
  c.fillStyle = '#E9E9E9';
  c.fillRect(480, 184, 1260, 64);
  c.fillStyle = BLACK;
  c.fillRect(540, 330, 760, 60);
  c.fillRect(540, 410, 560, 60);
  c.fillStyle = '#CFCFCF';
  c.fillRect(540, 505, 640, 16);
  c.fillRect(540, 535, 520, 16);
  // the CTA being drawn
  const p = E.outCubic(prog(u, 0.02, 0.17));
  const x0 = 540;
  const y0 = 600;
  const bw = 300 * p;
  const bh = 70 * p;
  c.fillStyle = RED;
  c.fillRect(x0, y0, bw, bh);
  c.strokeStyle = '#18A0FB';
  c.lineWidth = 2;
  c.strokeRect(x0, y0, bw, bh);
  c.fillStyle = WHITE;
  for (const [hx, hy] of [
    [x0, y0],
    [x0 + bw, y0],
    [x0, y0 + bh],
    [x0 + bw, y0 + bh],
  ]) {
    c.fillRect(hx - 5, hy - 5, 10, 10);
    c.strokeRect(hx - 5, hy - 5, 10, 10);
  }
  c.fillStyle = '#18A0FB';
  c.beginPath();
  c.roundRect(x0 + bw / 2 - 60, y0 + bh + 12, 120, 26, 4);
  c.fill();
  mono(c, `${Math.round(bw * 1.2)} × ${Math.round(bh * 1.2)}`, x0 + bw / 2, y0 + bh + 31, 14, WHITE, 1, 'center', 600);
  cursor(c, x0 + bw, y0 + bh);
  bigLabel(c, 'Design i Figma', 1680, 820, BLACK, u, 'right');
}

function cursor(c, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = BLACK;
  c.strokeStyle = WHITE;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 36);
  c.lineTo(9, 27);
  c.lineTo(16, 42);
  c.lineTo(22, 39);
  c.lineTo(15, 25);
  c.lineTo(27, 25);
  c.closePath();
  c.stroke();
  c.fill();
  c.restore();
}

const CODE = [
  '<section class="hero">',
  '  <h1>Designer morgendagens nettsider, i dag</h1>',
  '  <p>Byråkvalitet, uten byråpris.</p>',
  '  <a class="btn" href="/kontakt">',
  '    Få gratis utkast',
  '  </a>',
  '</section>',
];
function cutCode(c, u) {
  fillBg(c, BLACK);
  const total = CODE.reduce((a, l) => a + l.length, 0);
  let n = Math.floor(clamp((u - 0.05) / 0.62) * total);
  c.font = `500 34px ${MONO}`;
  CODE.forEach((l, i) => {
    const y = 290 + i * 62;
    mono(c, String(i + 1).padStart(2, ' '), 190, y, 34, '#555', 1, 'right');
    if (n <= 0) return;
    const shown = l.slice(0, n);
    n -= l.length;
    let x = 240;
    for (const tok of shown.split(/(<\/?[a-z0-9]+|>|"[^"]*"?)/)) {
      if (!tok) continue;
      const col = tok.startsWith('<') || tok === '>' ? RED : tok.startsWith('"') ? '#9A9A9A' : WHITE;
      c.fillStyle = col;
      c.fillText(tok, x, y);
      x += c.measureText(tok).width;
    }
    if (n <= 0 && n > -l.length) {
      c.fillStyle = RED;
      c.fillRect(x + 4, y - 28, 16, 34);
    }
  });
  bigLabel(c, 'Utvikling i kode', 1740, 900, WHITE, u, 'right');
}

function cutResponsive(c, u) {
  fillBg(c, GRAY);
  const p = E.inOutCubic(prog(u, 0.08, 0.5));
  const fw = lerp(1240, 380, p);
  const fh = lerp(700, 740, p);
  const fx = W / 2 - fw / 2 + 180;
  const fy = H / 2 - fh / 2;
  c.fillStyle = BLACK;
  c.beginPath();
  c.roundRect(fx - 14, fy - 14, fw + 28, fh + 28, lerp(18, 44, p));
  c.fill();
  c.save();
  c.beginPath();
  c.roundRect(fx, fy, fw, fh, lerp(8, 32, p));
  c.clip();
  c.fillStyle = WHITE;
  c.fillRect(fx, fy, fw, fh);
  c.fillStyle = BLACK;
  c.fillRect(fx, fy, fw, 56);
  c.fillStyle = RED;
  drawDiamond(c, fx + 34, fy + 28, 1.8);
  c.fillStyle = BLACK;
  const pad = lerp(60, 26, p);
  c.fillRect(fx + pad, fy + 100, lerp(640, 300, p), lerp(50, 34, p));
  c.fillRect(fx + pad, fy + lerp(165, 145, p), lerp(460, 220, p), lerp(50, 34, p));
  c.fillStyle = RED;
  c.beginPath();
  c.roundRect(fx + pad, fy + lerp(250, 200, p), lerp(220, 180, p), lerp(56, 46, p), 30);
  c.fill();
  // cards: 3 columns → stacked
  for (let i = 0; i < 3; i++) {
    const cw3 = (fw - pad * 2 - 40) / 3;
    const ax = fx + pad + i * (cw3 + 20);
    const ay = fy + 360;
    const sx = fx + pad;
    const sy = fy + 280 + i * 150;
    const cw = lerp(cw3, fw - pad * 2, p);
    c.fillStyle = '#EDEDED';
    c.beginPath();
    c.roundRect(lerp(ax, sx, p), lerp(ay, sy, p), cw, lerp(260, 130, p), 10);
    c.fill();
  }
  c.restore();
  bigLabel(c, 'Responsivt', 150, 560, BLACK, u);
  mono(c, `${Math.round(lerp(1440, 390, p))} px`, 154, 620, 22, RED, 1, 'left', 600);
}

function cutAdmin(c, u, uq) {
  fillBg(c, WHITE);
  c.fillStyle = BLACK;
  c.fillRect(0, 0, 360, H);
  const iconA = (s) => text(c, s[0], 60, s[1], `600 26px ${SANS}`, WHITE, s[2]);
  mono(c, 'ADMINPANEL', 60, 130, 18, '#888', 1, 'left', 600);
  c.fillStyle = RED;
  c.fillRect(0, 175, 360, 64);
  [
    ['Tekst', 217, 1],
    ['Bilder', 297, 0.6],
    ['Logo', 377, 0.6],
    ['Nyheter', 457, 0.6],
  ].forEach(iconA);
  // page being edited
  c.fillStyle = GRAY;
  c.fillRect(480, 150, 1300, 780);
  const msg = 'Nye åpningstider fra mandag!';
  const n = Math.floor(clamp((uq - 0.1) / 1.0) * msg.length);
  const f = `700 64px ${SANS}`;
  c.font = f;
  const tw = c.measureText(msg.slice(0, n)).width;
  c.setLineDash([10, 8]);
  c.strokeStyle = RED;
  c.lineWidth = 3;
  c.strokeRect(540, 330, 1180, 110);
  c.setLineDash([]);
  c.fillStyle = RED;
  c.beginPath();
  c.roundRect(540, 282, 190, 38, 19);
  c.fill();
  mono(c, 'Rediger tekst', 635, 308, 17, WHITE, 1, 'center', 600);
  text(c, msg.slice(0, n), 570, 410, f, BLACK);
  c.fillStyle = BLACK;
  if (Math.floor(uq * 16) % 2 === 0) c.fillRect(574 + tw, 356, 5, 66);
  c.fillStyle = '#D5D5D5';
  c.fillRect(570, 500, 900, 20);
  c.fillRect(570, 540, 740, 20);
  bigLabel(c, 'Oppdater nettsiden selv', 570, 780, BLACK, u);
  mono(c, 'INGEN KODE · INKLUDERT I MÅNEDSPRISEN', 574, 836, 20, RED, 1, 'left', 600);
}

function statCut(c, u, uq, bg, fg, sub, num, subCol) {
  fillBg(c, bg);
  const v = Math.round(num * E.outExpo(prog(uq, 0, 0.35)));
  c.font = `400 400px ${COND}`;
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.fillText(`${v} %`, W / 2, 610);
  c.textAlign = 'left';
  const f = `500 40px ${SANS}`;
  const L = layout(c, sub, f, 0);
  riseText(c, sub, W / 2 - L.width / 2, 720, f, subCol, u, 0.12, { size: 40, stagger: 0.005, dur: 0.25 });
}

function cutSpeed(c, u, uq) {
  statCut(c, u, uq, BLACK, RED, 'forlater en side som bruker over 3 sekunder å laste', 53, WHITE);
  mono(c, 'YTELSE OG HASTIGHET — VI OPTIMALISERER FOR RASK LASTETID', W / 2, 800, 18, WHITE, 0.6, 'center', 600);
}

function cutSecure(c, u) {
  fillBg(c, RED);
  const cx = W / 2;
  const cy = 470;
  const drop = E.outBack(prog(u, 0.04, 0.14), 3);
  c.strokeStyle = WHITE;
  c.lineWidth = 30;
  c.beginPath();
  c.arc(cx, cy - 70 - (1 - drop) * 60, 78, Math.PI, 0);
  c.lineTo(cx + 78, cy - 10 - (1 - drop) * 60);
  c.moveTo(cx - 78, cy - 70 - (1 - drop) * 60);
  c.lineTo(cx - 78, cy - 10 - (1 - drop) * 60);
  c.stroke();
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(cx - 130, cy - 30, 260, 200, 22);
  c.fill();
  c.fillStyle = RED;
  drawDiamond(c, cx, cy + 70, 5);
  const f = `700 56px ${SANS}`;
  const s = 'SSL · Hosting · Oppetidsovervåkning';
  const L = layout(c, s, f, -1);
  riseText(c, s, W / 2 - L.width / 2, 780, f, WHITE, u, 0.03, { size: 56, tracking: -1, stagger: 0.004, dur: 0.15 });
}

function cutAccess(c, u, uq) {
  statCut(c, u, uq, WHITE, BLACK, 'av verdens befolkning lever med en funksjonsnedsettelse', 15, BLACK);
  c.fillStyle = RED;
  c.beginPath();
  c.roundRect(W / 2 - 230, 770, 460, 52, 26);
  c.fill();
  mono(c, 'EAA · UNIVERSELL UTFORMING', W / 2, 804, 20, WHITE, 1, 'center', 600);
}

function cutGoogle(c, u, uq) {
  fillBg(c, GRAY);
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.12)';
  c.shadowBlur = 30;
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(410, 250, 1100, 90, 45);
  c.fill();
  c.restore();
  c.strokeStyle = '#777';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(470, 290, 14, 0, TAU);
  c.stroke();
  line(c, 480, 300, 492, 312);
  const q = 'nettside for bedrift';
  text(c, typed(q, prog(uq, 0.04, 0.38)), 515, 310, `400 38px ${SANS}`, BLACK);
  const r = E.outExpo(prog(u, 0.45, 0.65));
  if (r > 0) {
    c.save();
    c.globalAlpha = r;
    c.translate(0, (1 - r) * 60);
    c.fillStyle = WHITE;
    c.beginPath();
    c.roundRect(410, 400, 1100, 250, 18);
    c.fill();
    c.fillStyle = RED;
    drawDiamond(c, 465, 460, 2.6);
    mono(c, 'seventhseal.no', 500, 468, 22, '#555', 1, 'left', 500);
    text(c, 'Nettsider for bedrifter | Webdesign i Norge', 450, 540, `500 40px ${SANS}`, RED);
    text(c, 'Seventh Seal bygger moderne nettsider for små og mellomstore bedrifter.', 450, 596, `400 26px ${SANS}`, '#555');
    c.restore();
  }
  bigLabel(c, 'Synlig på Google', 410, 820, BLACK, u);
}

// ════════════════════════════════════════════════════════════════════════════
// 08 — KONTAKT: the full lockup assembles, CTA gets clicked
// ════════════════════════════════════════════════════════════════════════════
function sceneContact(c, lt, t) {
  fillBg(c, BLACK);
  c.save();
  const push = 1 + lt * 0.008;
  c.translate(W / 2, H / 2);
  c.scale(push, push);
  c.translate(-W / 2, -H / 2);

  const k = 5.2;
  const ox = W / 2 - 113 * k;
  const oy = 420 - 41 * k;
  c.save();
  c.translate(ox, oy);
  c.scale(k, k);
  c.fillStyle = WHITE;
  for (const [x, y] of LOGO.rects) {
    const d = x + y;
    const s = E.outBack(prog(lt, (d / 140) * 0.32, (d / 140) * 0.32 + 0.25), 2.4);
    if (s > 0) drawSquare(c, x + 4, y + 4, s);
  }
  c.fillStyle = RED;
  DIA.forEach(([dx, dy], i) => {
    const T = (0.1 + 0.2 * i) * BEAT;
    const e = E.inQuart(prog(lt, T - 0.16, T));
    if (e <= 0) return;
    const land = lt - T;
    const sq = land > 0 ? 0.25 * Math.exp(-land * 10) * Math.sin(land * 34) : 0;
    drawDiamond(c, dx, lerp(dy - 30, dy, e), lerp(2.2, 1, e) * (1 + sq), (1 - e) * 1.6);
  });
  // wordmark wipes
  for (const [path, col, st] of [
    [LOGO.seventh, RED, 0.34],
    [LOGO.seal, WHITE, 0.44],
  ]) {
    const p = E.outExpo(prog(lt, st, st + 0.45));
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

  // CTA button + cursor click
  const bp = E.outBack(prog(lt, 0.8, 1.05), 2.2);
  const click = lt - (CLICK_T - S.contact.start);
  const press = click > 0 ? 1 - 0.07 * Math.exp(-click * 12) * Math.cos(click * 20) : 1;
  if (bp > 0) {
    const bw = 620;
    const bh = 104;
    const by = 770;
    c.save();
    c.translate(W / 2, by);
    c.scale(bp * press, bp * press);
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    c.fill();
    text(c, 'Få gratis førsteutkast  →', 0, 14, `700 40px ${SANS}`, WHITE, 1, 'center');
    c.restore();
    if (click > 0) {
      const rp = clamp(click / 0.45);
      c.strokeStyle = RED;
      c.globalAlpha = 1 - rp;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(W / 2 - bw / 2 - rp * 40, by - bh / 2 - rp * 40, bw + rp * 80, bh + rp * 80, bh / 2 + rp * 40);
      c.stroke();
      c.globalAlpha = 1;
    }
    const cm = E.outCubic(prog(lt, 1.3, 1.73));
    if (cm > 0) cursor(c, lerp(1560, 1110, cm), lerp(1060, 790, cm), 1.4 * (click > 0 && click < 0.1 ? 0.9 : 1));
  }
  const fa = prog(lt, 1.9, 2.6);
  mono(c, typed('seventhseal.no   ·   team@seventhseal.no   ·   48 38 31 97   ·   Oslo / Norge', fa), W / 2, 930, 22, WHITE, 0.6, 'center', 500);
  c.restore();
}

// ════════════════════════════════════════════════════════════════════════════
// pipeline
// ════════════════════════════════════════════════════════════════════════════
const SCENE_FNS = {
  seal: sceneSeal,
  tagline: sceneTagline,
  storm: sceneStorm,
  pillars: scenePillars,
  work: sceneWork,
  price: scenePrice,
  process: sceneProcess,
  contact: sceneContact,
};

const CAPTIONS = {
  seal: 'NETTSIDER FOR SMÅ OG MELLOMSTORE BEDRIFTER',
  tagline: 'WEBDESIGN · OSLO / NORGE',
  storm: 'SEVENTH SEAL',
  pillars: 'ET TYDELIG RAMMEVERK — IKKE TILFELDIGE DESIGNBESLUTNINGER',
  work: 'SKOGLI GARD · ØKONOMILEDELSE AS · LILLE AMIR FRISØR',
  price: 'ADMINPANEL · HOSTING · GRATIS FØRSTEUTKAST',
  process: 'FRA FØRSTE IDÉ TIL FERDIG LØSNING',
};

const CUTS = [...SCENES.map((s) => s.end), S.tagline.start + TAGLINE_IDAG * BEAT, ...MONTAGE_CUTS.map((c) => c.start)].sort((a, b) => a - b);
const nextCut = (t) => CUTS.find((c) => c > t + 1e-9) ?? DURATION;
const MAX_SUBSAMPLES = {};
const sceneAt = (t) => {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
};

let frameT = 0;
const frameLt = (lt, t) => lt - (t - frameT);

function camera(t) {
  let sx = 0;
  let sy = 0;
  let rot = 0;
  let zoom = 0;
  HITS.forEach((h, i) => {
    const d = t - h.t;
    if (d < 0 || d > 0.7) return;
    const e = h.s * Math.exp(-d * 10);
    sx += e * 16 * noise1(d * 36 + i * 10);
    sy += e * 16 * noise1(d * 36 + i * 10 + 50);
    rot += e * 0.01 * noise1(d * 28 + i * 7 + 90);
    zoom += h.s * 0.03 * Math.exp(-d * 14);
  });
  return { sx, sy, rot, zoom };
}

let cv;
let ctx;
let sceneCv;
let sctx;
let accCv;
let actx;
let chan;
let grain = [];
let vignette;
const IMAGES = {};

function drawWorld(c, t, f, si) {
  const sc = SCENES[si];
  const st = Math.min(t, sc.end - 1e-4);
  SD = sc.end - sc.start;
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
  SCENE_FNS[sc.id](c, st - sc.start, st, f);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

function chromatic(t) {
  let a = 0;
  for (const h of HITS) {
    const d = t - h.t;
    if (d >= 0 && d < 0.5) a += h.s * Math.exp(-d * 16);
  }
  return a;
}

function applyChromatic(amount) {
  const k = Math.min(amount, 1.5) * 0.009;
  const cols = ['#ff0000', '#00ff00', '#0000ff'];
  const scales = [1 + 2 * k, 1 + k, 1];
  for (let i = 0; i < 3; i++) {
    const c = chan[i].getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = cols[i];
    c.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scales[i], scales[i]);
    ctx.drawImage(chan[i], -W / 2, -H / 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function hudStyle(t) {
  const sc = SCENES[sceneAt(t)];
  const lt = t - sc.start;
  const sd = sc.end - sc.start;
  switch (sc.id) {
    case 'tagline':
      return lt > sd - 0.25 * BEAT ? BLACK : WHITE;
    case 'pillars':
      return 'difference';
    case 'work':
      return lt > sd - 0.4 * BEAT ? WHITE : BLACK;
    case 'process':
      return [WHITE, WHITE, BLACK, BLACK, WHITE, WHITE, BLACK, BLACK][cutIndex(t)];
    default:
      return WHITE;
  }
}

function drawHUD(c, t, f) {
  const a = E.outCubic(prog(t, 0.2, 0.5)) * (1 - prog(t, S.contact.start, S.contact.start + 0.12));
  if (a <= 0) return;
  const si = sceneAt(t);
  const sc = SCENES[si];
  const style = hudStyle(t);
  c.save();
  c.globalCompositeOperation = style === 'difference' ? 'difference' : 'source-over';
  c.globalAlpha = a;
  c.fillStyle = style === 'difference' ? '#fff' : style;
  c.strokeStyle = c.fillStyle;
  c.lineWidth = 2;
  const m = 48;
  const L = 26;
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]) {
    c.beginPath();
    c.moveTo(x + dx * L, y);
    c.lineTo(x, y);
    c.lineTo(x, y + dy * L);
    c.stroke();
  }
  let label = sc.label;
  let prevLabel = si > 0 ? SCENES[si - 1].label : '';
  let since = sc.start;
  if (sc.id === 'process') {
    const k = cutIndex(t);
    label = MONTAGE_LABELS[k];
    prevLabel = k > 0 ? MONTAGE_LABELS[k - 1] : SCENES[si - 1].label;
    since = MONTAGE_CUTS[k].start;
  }
  const roll = si === 0 ? 1 : E.outExpo(prog(t, since, since + 0.2));
  c.save();
  c.beginPath();
  c.rect(84, 68, 900, 32);
  c.clip();
  c.font = `600 19px ${MONO}`;
  c.fillText(label, 88, 92 + (1 - roll) * 32);
  if (roll < 1) c.fillText(prevLabel, 88, 92 - roll * 32);
  c.restore();
  // top right: the mark + name
  c.font = `600 19px ${MONO}`;
  c.textAlign = 'right';
  c.fillText('SEVENTH SEAL', W - 88, 92);
  const mw = c.measureText('SEVENTH SEAL').width;
  c.save();
  c.translate(W - 88 - mw - 30, 86);
  c.scale(0.95, 0.95);
  if (style !== 'difference') c.fillStyle = style === WHITE && sc.id !== 'price' && sc.id !== 'tagline' ? RED : style;
  for (const [dx, dy] of DIA) drawDiamond(c, dx - 13.24, dy - 18.47, 1);
  c.restore();
  // bottom row
  const by = H - 84;
  c.textAlign = 'left';
  c.fillText(`${String(si + 1).padStart(2, '0')} / 08`, 88, by);
  const cap = CAPTIONS[sc.id];
  if (cap) {
    c.textAlign = 'center';
    c.font = `500 16px ${MONO}`;
    c.fillText(typed(cap, prog(t, sc.start + 0.05, sc.start + 0.4)), W / 2, by);
  }
  c.textAlign = 'right';
  c.font = `600 19px ${MONO}`;
  c.fillText('seventhseal.no', W - 88, by);
  c.globalAlpha = a * 0.3;
  c.fillRect(88, H - 58, W - 176, 2);
  c.globalAlpha = a;
  c.fillRect(88, H - 59, (W - 176) * (t / DURATION), 4);
  c.restore();
}

export async function init(canvas) {
  cv = canvas;
  cv.width = W;
  cv.height = H;
  ctx = cv.getContext('2d');
  sceneCv = mk(W, H);
  sctx = sceneCv.getContext('2d');
  accCv = mk(W, H);
  actx = accCv.getContext('2d');
  chan = [mk(W, H), mk(W, H), mk(W, H)];

  await Promise.all(
    [`400 100px ${SANS}`, `500 100px ${SANS}`, `700 100px ${SANS}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 100px ${COND}`].map((f) => document.fonts.load(f, 'ÆØÅæøå7S')),
  );
  await document.fonts.ready;
  await initLogo();
  await Promise.all(
    WORK.map(async (w) => {
      const img = new Image();
      img.src = `assets/work-${w.key}.jpg`;
      await img.decode();
      IMAGES[w.key] = img;
    }),
  );
  initConcrete();
  initStorm();

  grain = [];
  for (let g = 0; g < 6; g++) {
    const tile = mk(256, 256);
    const tc = tile.getContext('2d');
    const img = tc.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = hash(g * 70001 + i) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    grain.push(ctx.createPattern(tile, 'repeat'));
  }
  vignette = mk(W, H);
  const vc = vignette.getContext('2d');
  const vg = vc.createRadialGradient(W / 2, H / 2, 480, W / 2, H / 2, 1260);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  vc.fillStyle = vg;
  vc.fillRect(0, 0, W, H);
}

export function renderFrame(f, { subsamples = 4, shutter = 0.5 } = {}) {
  const t0 = f / FPS;
  frameT = t0;
  const si = sceneAt(t0);
  const n = Math.min(subsamples, MAX_SUBSAMPLES[SCENES[si].id] ?? subsamples);
  for (let k = 0; k < n; k++) {
    const ts = Math.min(t0 + ((k / n) * shutter) / FPS, nextCut(t0) - 1e-4);
    drawWorld(sctx, ts, f, si);
    actx.globalCompositeOperation = 'source-over';
    actx.globalAlpha = 1 / (k + 1);
    actx.drawImage(sceneCv, 0, 0);
  }
  actx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(accCv, 0, 0);

  const ca = chromatic(t0);
  if (ca > 0.04) applyChromatic(ca);

  drawHUD(ctx, t0, f);

  ctx.drawImage(vignette, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = grain[f % grain.length];
  const ox = Math.floor(hash(f * 2 + 1) * 256);
  const oy = Math.floor(hash(f * 2 + 2) * 256);
  ctx.translate(-ox, -oy);
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

export const totalFrames = Math.round(DURATION * FPS);
