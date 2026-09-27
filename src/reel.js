// CLAUDE — MOTION REEL '26
// A deterministic, frame-accurate motion graphics renderer. Every pixel is a
// pure function of time, so frames can be rendered in any order, in parallel,
// with true sub-frame motion blur.

import { W, H, FPS, BEAT, BAR, DURATION, SCENES, HITS, MONTAGE_LABELS, at } from './timeline.js';

export { W, H, FPS, DURATION };

// ─── palette & type ────────────────────────────────────────────────────────
const INK = '#0B0B0F';
const CREAM = '#F2EDE4';
const RED = '#FF4D2E';
const BLUE = '#2F5BFF';
const LIME = '#D7FF3A';
const PINK = '#FF7AD9';
const VIOLET = '#7B5CFF';
const DISPLAY = '"Inter Tight", sans-serif';
const MONO = '"JetBrains Mono", monospace';
const SERIF = '"Instrument Serif", serif';

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
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

// Damped spring 0 → 1, closed form.
function spring(t, w = 18, z = 0.35) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

// Integer hash → [0, 1)
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Smooth 1D value noise → [-1, 1]
function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, u);
}

// Cubic-bézier easing (CSS semantics)
const bez = (a, b, s) => {
  const u = 1 - s;
  return 3 * u * u * s * a + 3 * u * s * s * b + s * s * s;
};
const bezD = (a, b, s) => {
  const u = 1 - s;
  return 3 * u * u * a + 6 * u * s * (b - a) + 3 * s * s * (1 - b);
};
function cubicEase(p, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let s = x;
  for (let i = 0; i < 10; i++) {
    const e = bez(p[0], p[2], s) - x;
    const d = bezD(p[0], p[2], s);
    if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-7) break;
    s = clamp(s - e / d);
  }
  return bez(p[1], p[3], s);
}

// ─── colour ────────────────────────────────────────────────────────────────
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
function ramp(stops, t) {
  t = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const A = rgb(stops[i]);
  const B = rgb(stops[i + 1]);
  const f = t - i;
  return [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)];
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

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
    const x = c.measureText(text.slice(0, i)).width + i * tracking;
    glyphs.push({ ch: text[i], x, w: c.measureText(text[i]).width });
  }
  const width = c.measureText(text).width + (text.length - 1) * tracking;
  c.restore();
  L = { glyphs, width };
  layoutCache.set(key, L);
  return L;
}

function mono(c, text, x, y, size, color, alpha = 1, align = 'left', weight = 500) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${weight} ${size}px ${MONO}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(text, x, y);
  c.restore();
}

const typed = (text, p) => text.slice(0, Math.floor(clamp(p) * text.length + 0.0001));

// visual kick envelope (bars 1–6 are four-on-the-floor)
function kickEnv(t) {
  if (t < BAR || t >= 7 * BAR) return 0;
  return Math.exp(-(t % BEAT) * 10);
}

// ─── shared elements ───────────────────────────────────────────────────────
function dotGrid(c, lt, ripples, alpha, color = CREAM) {
  if (alpha <= 0) return;
  const sp = 64;
  c.fillStyle = color;
  for (let y = sp / 2 + 12; y < H; y += sp) {
    for (let x = sp / 2; x < W; x += sp) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      const a = E.outBack(prog(lt, d / 2600, d / 2600 + 0.35), 2);
      if (a <= 0) continue;
      let boost = 0;
      for (const r of ripples) {
        const dt = lt - r.t;
        if (dt <= 0) continue;
        const dr = Math.hypot(x - r.x, y - r.y) - dt * 1900;
        boost += Math.exp(-(dr * dr) / 5000) * Math.exp(-dt * 2.2);
      }
      const rad = 1.7 * a * (1 + 2.2 * boost);
      c.globalAlpha = alpha * Math.min(1, 0.17 + 0.7 * boost);
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  c.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════════════════════
// 01 — SQUASH & STRETCH
// ════════════════════════════════════════════════════════════════════════════
const S1 = { cx: W / 2, floorY: 800, R: 70 };
S1.restY = S1.floorY - S1.R;
S1.x0 = S1.cx - 900;
S1.x1 = S1.cx - 440;
S1.x2 = S1.cx - 70;

function ballPath(lt) {
  const { restY, x0, x1, x2, cx } = S1;
  const t1 = BEAT;
  const t2 = 2 * BEAT;
  if (lt < t1) {
    const s = lt / t1;
    return [lerp(x0, x1, s), lerp(-170, restY, s * s)];
  }
  if (lt < t2) {
    const s = (lt - t1) / (t2 - t1);
    return [lerp(x1, x2, s), restY - 4 * 360 * s * (1 - s)];
  }
  const e = E.outCubic(prog(lt, t2, t2 + 0.45));
  return [lerp(x2, cx, e), lerp(restY, 520, e)];
}

function sceneBounce(c, lt) {
  const { cx, floorY, R, x1, x2 } = S1;
  const t1 = BEAT;
  const t2 = 2 * BEAT;
  fillBg(c, INK);
  const m = E.inOutCubic(prog(lt, 1.18, 1.42));
  const z = E.inExpo(prog(lt, 3.5 * BEAT, 4 * BEAT));
  dotGrid(c, lt, [{ t: t1, x: x1, y: floorY }, { t: t2, x: x2, y: floorY }], 1);

  // floor
  const fl = E.outExpo(prog(lt, 0.05, 0.5)) * 1560;
  c.strokeStyle = CREAM;
  c.lineWidth = 2;
  c.globalAlpha = 0.45 * (1 - m);
  line(c, cx - fl / 2, floorY, cx + fl / 2, floorY);
  for (let i = -6; i <= 6; i++) {
    const x = cx + i * 120;
    if (Math.abs(x - cx) > fl / 2) continue;
    line(c, x, floorY, x, floorY + (i % 3 === 0 ? 16 : 8));
  }

  // motion path (After Effects style) — dashed, with keyframe diamonds
  const pathA = 1 - m;
  if (pathA > 0 && lt > 0.02) {
    c.globalAlpha = 0.5 * pathA;
    c.setLineDash([4, 9]);
    c.lineWidth = 2;
    c.beginPath();
    const end = Math.min(lt, 2 * BEAT + 0.45);
    for (let i = 0; i <= 80; i++) {
      const [x, y] = ballPath((i / 80) * end);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = LIME;
    for (const kt of [t1, t2]) {
      if (lt < kt) continue;
      const [kx, ky] = ballPath(kt);
      const k = E.outBack(prog(lt, kt, kt + 0.2), 3);
      c.save();
      c.translate(kx, ky + R);
      c.rotate(Math.PI / 4);
      c.scale(k, k);
      c.fillRect(-7, -7, 14, 14);
      c.restore();
    }
  }
  c.globalAlpha = 1;

  // impact rings + sparks
  for (const [ti, ix] of [
    [t1, x1],
    [t2, x2],
  ]) {
    const dt = lt - ti;
    if (dt < 0 || dt > 0.7) continue;
    const p = dt / 0.7;
    const rx = 60 + 560 * E.outExpo(p);
    c.strokeStyle = CREAM;
    c.globalAlpha = (1 - p) * 0.8 * (1 - m);
    c.lineWidth = 4 * (1 - p) + 0.5;
    c.beginPath();
    c.ellipse(ix, floorY, rx, rx * 0.14, 0, 0, TAU);
    c.stroke();
    const sp = clamp(dt / 0.42);
    if (sp < 1) {
      c.strokeStyle = RED;
      c.lineCap = 'round';
      c.lineWidth = 5 * (1 - sp) + 1;
      c.globalAlpha = 1 - m;
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI * (0.08 + (0.84 * k) / 8);
        const r1 = 90 + 250 * E.outExpo(sp);
        const r0 = r1 - 70 * (1 - sp);
        line(c, ix + Math.cos(a) * r0, floorY + Math.sin(a) * r0, ix + Math.cos(a) * r1, floorY + Math.sin(a) * r1);
      }
      c.lineCap = 'butt';
    }
  }
  c.globalAlpha = 1;

  // annotations
  const annA = 1 - prog(lt, 1.1, 1.3);
  if (lt > t1) {
    mono(c, typed('SQUASH ×0.58', prog(lt, t1, t1 + 0.2)), x1, floorY + 58, 17, CREAM, 0.75 * annA, 'center');
  }
  if (lt > t2) {
    mono(c, typed('STRETCH ×1.35', prog(lt, t2, t2 + 0.2)), x2, floorY + 58, 17, CREAM, 0.75 * annA, 'center');
  }

  // ball
  let [x, y] = ballPath(lt);
  const [px, py] = ballPath(lt - 1 / 240);
  const vx = (x - px) * 240;
  const vy = (y - py) * 240;

  // shadow
  const hgt = floorY - R - y;
  const sh = clamp(1 - hgt / 900);
  c.fillStyle = '#000';
  c.globalAlpha = 0.45 * sh * (1 - m);
  c.beginPath();
  c.ellipse(x, floorY + 5, R * 1.1 * sh + 4, 9 * sh + 1, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;

  // zoom-through transition pulls the shape to screen centre
  x = lerp(x, W / 2, E.inOutCubic(prog(lt, 1.3, 1.7)));
  y = lerp(y, H / 2, E.inOutCubic(prog(lt, 1.3, 1.7)));

  const sp = Math.hypot(vx, vy);
  const st = Math.min(sp / 4200, 0.38) * (1 - m);
  const ang = Math.atan2(vy, vx);
  let sq = 0;
  for (const [ti, amt] of [
    [t1, 0.42],
    [t2, 0.3],
  ]) {
    const dt = lt - ti;
    if (dt >= 0 && dt < 0.6) sq += amt * Math.exp(-dt * 10) * Math.cos(dt * 34);
  }
  sq *= 1 - m;
  const pulseT = lt - 3 * BEAT;
  const pulse = pulseT > 0 ? Math.exp(-pulseT * 9) * Math.sin(pulseT * 30) * 0.14 : 0;

  const hs = lerp(R, 112, m);
  const rr = lerp(R, 26, m);
  const rot = E.outBack(prog(lt, 1.24, 1.56), 2) * (Math.PI / 2) + z * Math.PI * 0.6;
  const scale = (1 + pulse) * (1 + 17 * z);

  c.save();
  c.translate(x, y);
  c.translate(0, R);
  c.scale(1 + sq * 0.9, 1 - sq);
  c.translate(0, -R);
  c.rotate(ang);
  c.scale(1 + st, 1 / (1 + st));
  c.rotate(-ang);
  c.rotate(rot);
  c.scale(scale, scale);
  c.fillStyle = mix(CREAM, RED, m);
  c.beginPath();
  c.roundRect(-hs, -hs, hs * 2, hs * 2, rr);
  c.fill();
  // inner detail on the square — a tiny "I" preview of the next shot
  if (m > 0.5 && z < 0.6) {
    c.globalAlpha = smooth(0.5, 1, m) * (1 - z * 1.6);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(-hs + 16, -hs + 16, hs * 2 - 32, hs * 2 - 32, 12);
    c.stroke();
  }
  c.restore();
}

// ════════════════════════════════════════════════════════════════════════════
// 02 — KINETIC TYPE
// ════════════════════════════════════════════════════════════════════════════
function sceneType(c, lt, t, f) {
  if (lt < 2 * BEAT) typeA(c, lt);
  else if (lt < 3 * BEAT) typeB(c, lt);
  else typeC(c, lt);
}

function typeA(c, lt) {
  fillBg(c, RED);
  const font = `900 300px ${DISPLAY}`;
  const L = layout(c, 'I MAKE', font, -8);
  const GAP = 46;
  const gx = (j) => L.glyphs[j].x + (j >= 2 ? GAP : 0);
  const x0 = W / 2 - (L.width + GAP) / 2;
  const base = 650;
  c.font = font;
  c.fillStyle = CREAM;

  const g = L.glyphs[0];
  const p = E.outExpo(prog(lt, 0, 0.26));
  const s = lerp(3.4, 1, p);
  c.save();
  c.translate(x0 + gx(0) + g.w / 2, base - 108);
  c.scale(s, s);
  c.fillText('I', -g.w / 2, 108);
  c.restore();

  c.save();
  c.beginPath();
  c.rect(-300, -300, W + 600, base + 300 + 6);
  c.clip();
  for (let j = 2; j < 6; j++) {
    const gg = L.glyphs[j];
    const st = BEAT / 2 - 0.05 + (j - 2) * 0.035;
    const q = E.outExpo(prog(lt, st, st + 0.42));
    c.save();
    c.translate(x0 + gx(j), base + (1 - q) * 330);
    c.rotate((1 - q) * 0.3);
    c.fillText(gg.ch, 0, 0);
    c.restore();
  }
  c.restore();

  const ul = E.outExpo(prog(lt, 0.5, 0.82));
  c.fillStyle = INK;
  const ux = x0 + gx(2) + 6;
  const uw = x0 + L.width + GAP - ux;
  c.fillRect(ux, base + 42, uw * ul, 18);
  // exit: underline shoots off right
  const ex = E.inExpo(prog(lt, 0.8, 2 * BEAT));
  if (ex > 0) {
    c.fillStyle = RED;
    c.fillRect(ux - 10, base + 36, (uw + 20) * ex, 30);
  }
}

function typeB(c, lt) {
  fillBg(c, INK);
  const font = `900 300px ${DISPLAY}`;
  const L = layout(c, 'THINGS', font, -8);
  const x0 = W / 2 - L.width / 2;
  const base = 690;

  // serif aside, typed
  const aside = 'all kinds of';
  c.save();
  c.translate(x0 + 14, base - 262);
  c.rotate(-0.06);
  c.font = `italic 400 112px ${SERIF}`;
  c.fillStyle = LIME;
  c.fillText(typed(aside, prog(lt, 2 * BEAT + 0.02, 2 * BEAT + 0.22)), 0, 0);
  c.restore();

  c.font = font;
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const st = 2 * BEAT + j * 0.028;
    const sp = spring(lt - st, 22, 0.36);
    c.save();
    c.translate(x0 + g.x + g.w / 2, base);
    c.translate(0, (1 - sp) * -760);
    c.rotate((1 - sp) * 0.55 * (j % 2 ? 1 : -1));
    if (j === 3) {
      c.strokeStyle = LIME;
      c.lineWidth = 6;
      c.strokeText(g.ch, -g.w / 2, 0);
    } else {
      c.fillStyle = CREAM;
      c.fillText(g.ch, -g.w / 2, 0);
    }
    c.restore();
  }
}

function drawMove(c, lt) {
  const font = `900 440px ${DISPLAY}`;
  const L = layout(c, 'MOVE', font, -14);
  const x0 = W / 2 - L.width / 2;
  const base = 700;
  c.font = font;

  const ep = E.outExpo(prog(lt, 3 * BEAT + 0.06, 3 * BEAT + 0.42));
  if (ep > 0) {
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    for (let k = 6; k >= 1; k--) {
      for (const sgn of [-1, 1]) {
        c.globalAlpha = 0.5 * (1 - k / 7) * ep;
        for (const g of L.glyphs) c.strokeText(g.ch, x0 + g.x, base + sgn * k * 118 * ep);
      }
    }
    c.globalAlpha = 1;
  }

  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const st = 3 * BEAT + j * 0.03;
    const pop = E.outBack(prog(lt, st, st + 0.22), 2.2);
    const d = lt - st;
    const wob = d > 0 ? 0.3 * Math.exp(-d * 5) * Math.sin(d * 26 + j) : 0;
    const sy = 1 + wob;
    c.save();
    c.translate(x0 + g.x + g.w / 2, base);
    c.scale(pop / Math.sqrt(sy), pop * sy);
    c.fillStyle = j === 1 ? RED : INK;
    c.fillText(g.ch, -g.w / 2, 0);
    c.restore();
  }
}

function typeC(c, lt) {
  const sp = prog(lt, 3.5 * BEAT, 4 * BEAT);
  if (sp <= 0) {
    fillBg(c, CREAM);
    drawMove(c, lt);
    return;
  }
  fillBg(c, INK);
  const n = 12;
  const sh = H / n;
  const e = E.inExpo(sp);
  for (let i = 0; i < n; i++) {
    c.save();
    c.beginPath();
    c.rect(-300, i * sh, W + 600, sh + 0.5);
    c.clip();
    c.translate((i % 2 ? 1 : -1) * e * W * (1.05 + (i % 3) * 0.12), 0);
    c.fillStyle = CREAM;
    c.fillRect(-300, i * sh, W + 600, sh + 0.5);
    drawMove(c, lt);
    c.restore();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 03 — PARTICLE SYSTEMS
// ════════════════════════════════════════════════════════════════════════════
const PT = { n: 0 };
const PT_COLORS = [BLUE, '#4B52FF', VIOLET, '#B15CFF', PINK, '#FF6A7A', RED];

function initParticles() {
  const cv = mk(W, H);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff';
  c.font = `900 430px ${DISPLAY}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('FLOW', W / 2, H / 2 + 10);
  const d = c.getImageData(0, 0, W, H).data;
  const pts = [];
  const step = 6;
  for (let y = 0; y < H; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step) {
      if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
    }
  }
  const N = 4200;
  PT.n = N;
  PT.tx = new Float32Array(N);
  PT.ty = new Float32Array(N);
  PT.h = new Float32Array(N * 4);
  PT.x = new Float32Array(N);
  PT.y = new Float32Array(N);
  PT.qx = new Float32Array(N);
  PT.qy = new Float32Array(N);
  PT.big = new Uint8Array(N);
  PT.buckets = PT_COLORS.map(() => []);
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
  }
  for (let i = 0; i < N; i++) {
    const src = pts[Math.floor(hash(i * 7 + 1) * pts.length)];
    PT.tx[i] = src[0] + (hash(i * 7 + 2) - 0.5) * 3;
    PT.ty[i] = src[1] + (hash(i * 7 + 3) - 0.5) * 3;
    for (let k = 0; k < 4; k++) PT.h[i * 4 + k] = hash(i * 13 + k * 101 + 5);
    PT.big[i] = hash(i * 17 + 9) > 0.965 ? 1 : 0;
    const b = Math.min(PT_COLORS.length - 1, Math.floor(clamp((PT.tx[i] - minX) / (maxX - minX)) * PT_COLORS.length));
    PT.buckets[b].push(i);
  }
}

function fillParticles(lt, PX, PY, ringX, ringY, ringOn, xe) {
  const cx = W / 2;
  const cy = H / 2;
  const ee = E.outExpo(xe);
  const burst = E.outExpo(clamp(lt / 0.75));
  const { n, tx, ty, h } = PT;
  for (let i = 0; i < n; i++) {
    const h1 = h[i * 4];
    const h2 = h[i * 4 + 1];
    const h3 = h[i * 4 + 2];
    const h4 = h[i * 4 + 3];
    const r0 = 60 + Math.pow(h1, 0.75) * 1080;
    const ang = h2 * TAU + lt * (0.5 + 240 / (r0 + 80)) * 2.0 + (1 - burst) * 2.4;
    const rr = (r0 + 50 * Math.sin(lt * 2.1 + h3 * TAU)) * burst;
    let x = cx + Math.cos(ang) * rr;
    let y = cy + Math.sin(ang) * rr * 0.5 + (h4 - 0.5) * 90 * burst;
    const cs = 0.48 + h4 * 0.32;
    const ce = E.inOutCubic(prog(lt, cs, cs + 0.42));
    x = lerp(x, tx[i], ce) + Math.sin(lt * 7 + h1 * 50) * 1.3 * ce;
    y = lerp(y, ty[i], ce) + Math.cos(lt * 6 + h2 * 50) * 1.3 * ce;
    if (ringOn) {
      const dx = x - ringX;
      const dy = y - ringY;
      const d2 = dx * dx + dy * dy;
      if (d2 < 120000) {
        const d = Math.sqrt(d2) + 1e-3;
        const push = 120 * Math.exp(-d2 / 26000);
        x += (dx / d) * push;
        y += (dy / d) * push;
      }
    }
    if (xe > 0) {
      const dx = x - cx + (h3 - 0.5) * 240;
      const dy = y - cy + (h4 - 0.5) * 240;
      const d = Math.hypot(dx, dy) + 1e-3;
      const dist = ee * (380 + h1 * 1600);
      x += (dx / d) * dist;
      y += (dy / d) * dist;
    }
    PX[i] = x;
    PY[i] = y;
  }
}

function sceneParticles(c, lt, t) {
  fillBg(c, '#07070C');
  const cx = W / 2;
  const cy = H / 2;
  const kick = kickEnv(t);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, 900);
  g.addColorStop(0, `rgba(123,92,255,${0.2 + 0.12 * kick})`);
  g.addColorStop(1, 'rgba(123,92,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  const rp = prog(lt, 1.0, 1.6);
  const ringX = lerp(-260, W + 260, E.inOutSine(rp));
  const ringY = cy + Math.sin(rp * TAU) * 70;
  const ringOn = rp > 0 && rp < 1;
  const xe = prog(lt, 3.5 * BEAT, 4 * BEAT);
  const ee = E.outExpo(xe);

  fillParticles(lt, PT.x, PT.y, ringX, ringY, ringOn, xe);
  fillParticles(lt - 0.03, PT.qx, PT.qy, ringX, ringY, ringOn, prog(lt - 0.03, 3.5 * BEAT, 4 * BEAT));
  const { x: PX, y: PY, qx: QX, qy: QY } = PT;

  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 1 - xe * 0.4;
  c.lineCap = 'round';
  for (const big of [0, 1]) {
    c.lineWidth = big ? 5 : 2.6;
    for (let b = 0; b < PT.buckets.length; b++) {
      c.strokeStyle = PT_COLORS[b];
      c.beginPath();
      for (const i of PT.buckets[b]) {
        if (PT.big[i] !== big) continue;
        c.moveTo(QX[i], QY[i]);
        c.lineTo(PX[i] + 0.2, PY[i]);
      }
      c.stroke();
    }
  }
  c.lineCap = 'butt';
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;

  if (ringOn) {
    c.strokeStyle = CREAM;
    c.globalAlpha = 0.7 * Math.sin(rp * Math.PI);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(ringX, ringY, 110, 0, TAU);
    c.stroke();
    line(c, ringX - 14, ringY, ringX + 14, ringY);
    line(c, ringX, ringY - 14, ringX, ringY + 14);
    mono(c, 'REPULSOR  F = 120·e^(−d²/σ²)', ringX + 130, ringY - 100, 15, CREAM, 1, 'left');
    c.globalAlpha = 1;
  }

  if (xe > 0) {
    c.strokeStyle = CREAM;
    c.globalAlpha = 1 - xe;
    c.lineWidth = 12 * (1 - xe) + 1;
    c.beginPath();
    c.arc(cx, cy, 40 + ee * 1300, 0, TAU);
    c.stroke();
    c.globalAlpha = 0.9 * (1 - E.outCubic(prog(xe, 0, 0.55)));
    c.fillStyle = CREAM;
    c.fillRect(-300, -300, W + 600, H + 600);
    c.globalAlpha = 1;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 04 — 3D & CAMERA
// ════════════════════════════════════════════════════════════════════════════
const KNOT = {};
const KNOT_COLORS = [RED, PINK, VIOLET, BLUE, LIME, RED];

function initKnot() {
  const M = 170;
  const V = 9;
  const S = 168;
  const tube = 40;
  const C = (u) => [S * (2 + Math.cos(3 * u)) * Math.cos(2 * u), S * (2 + Math.cos(3 * u)) * Math.sin(2 * u), S * 1.25 * Math.sin(3 * u)];
  const pts = new Float32Array(M * V * 3);
  const eps = 1e-3;
  for (let i = 0; i < M; i++) {
    const u = (i / M) * TAU;
    const p = C(u);
    const a = C(u - eps);
    const b = C(u + eps);
    let T = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const tl = Math.hypot(...T);
    T = T.map((v) => v / tl);
    let A = [b[0] - 2 * p[0] + a[0], b[1] - 2 * p[1] + a[1], b[2] - 2 * p[2] + a[2]];
    const ad = A[0] * T[0] + A[1] * T[1] + A[2] * T[2];
    A = [A[0] - ad * T[0], A[1] - ad * T[1], A[2] - ad * T[2]];
    const al = Math.hypot(...A);
    const N = A.map((v) => v / al);
    const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
    for (let j = 0; j < V; j++) {
      const v = (j / V) * TAU;
      const cs = Math.cos(v) * tube;
      const sn = Math.sin(v) * tube;
      const o = (i * V + j) * 3;
      pts[o] = p[0] + cs * N[0] + sn * B[0];
      pts[o + 1] = p[1] + cs * N[1] + sn * B[1];
      pts[o + 2] = p[2] + cs * N[2] + sn * B[2];
    }
  }
  const segs = [];
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < V; j++) {
      segs.push([i * V + j, ((i + 1) % M) * V + j, i]);
      if (i % 4 === 0) segs.push([i * V + j, i * V + ((j + 1) % V), i]);
    }
  }
  KNOT.M = M;
  KNOT.V = V;
  KNOT.pts = pts;
  KNOT.segs = segs;
  KNOT.proj = new Float32Array(M * V * 4);
  KNOT.order = new Uint32Array(segs.length);
  KNOT.depth = new Float32Array(segs.length);
  KNOT.cols = [];
  for (let i = 0; i < M; i++) KNOT.cols.push(ramp(KNOT_COLORS, i / M));
}

function scene3D(c, lt, t) {
  fillBg(c, '#06060A');
  const F = 1000;
  const knotZ = 6200;
  const camZ = 4700 * E.inOutCubic(prog(lt, -0.12, 1.05)) + Math.max(0, lt - 1.05) * 160;
  const camX = Math.sin(lt * 1.7) * 90;
  const camY = Math.cos(lt * 1.3) * 60;
  const roll = Math.sin(lt * 1.2) * 0.1 + (1 - E.outCubic(prog(lt, 0, 1.0))) * 0.6;
  const kick = kickEnv(t);

  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(roll);
  c.translate(-W / 2, -H / 2);

  const P = (x, y, z) => {
    const dz = z - camZ;
    if (dz < 30) return null;
    const s = F / dz;
    return [W / 2 + (x - camX) * s, H / 2 + (y - camY) * s, s, dz];
  };

  // parallax dust
  c.fillStyle = CREAM;
  for (let i = 0; i < 320; i++) {
    const p = P((hash(i * 3 + 1) - 0.5) * 3800, (hash(i * 3 + 2) - 0.5) * 2400, hash(i * 3 + 3) * 8200);
    if (!p || p[3] > 7500) continue;
    c.globalAlpha = clamp(1 - p[3] / 7500) * 0.85;
    const s = Math.max(1.2, 5 * p[2]);
    c.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
  }

  // tunnel
  const ringCols = [RED, CREAM, BLUE];
  const rings = [];
  for (let k = 0; k < 18; k++) {
    const z = 300 + k * 250;
    const half = 560;
    const a = k * 0.25 + lt * 0.9;
    const corners = [];
    for (let q = 0; q < 4; q++) {
      const aa = a + (q * Math.PI) / 2 + Math.PI / 4;
      corners.push(P(Math.cos(aa) * half * 1.414, Math.sin(aa) * half * 1.414, z));
    }
    rings.push(corners);
  }
  for (let k = rings.length - 1; k >= 0; k--) {
    const cr = rings[k];
    if (cr.some((p) => !p)) continue;
    const dz = cr[0][3];
    const fog = clamp((dz - 30) / 260) * clamp(1 - dz / 5600);
    if (fog <= 0) continue;
    // struts to next ring
    const nx = rings[k + 1];
    if (nx && !nx.some((p) => !p)) {
      c.strokeStyle = CREAM;
      c.globalAlpha = fog * 0.18;
      c.lineWidth = 1;
      for (let q = 0; q < 4; q++) line(c, cr[q][0], cr[q][1], nx[q][0], nx[q][1]);
    }
    c.strokeStyle = ringCols[k % 3];
    c.globalAlpha = fog;
    c.lineWidth = clamp(7 * cr[0][2] * (1 + kick * 1.4), 0.6, 40);
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(cr[0][0], cr[0][1]);
    for (let q = 1; q < 4; q++) c.lineTo(cr[q][0], cr[q][1]);
    c.closePath();
    c.stroke();
  }
  c.globalAlpha = 1;

  // torus knot
  const { M, V, pts, segs, proj, order, depth, cols } = KNOT;
  const spin = E.inExpo(prog(lt, 1.45, 1.8)) * 7;
  const ry = lt * 1.1 + 0.3 + spin;
  const rx = 0.9 + lt * 0.6;
  const rz = lt * 0.3;
  const shrink = 1 - E.inExpo(prog(lt, 1.58, 1.8));
  const cyR = Math.cos(ry);
  const syR = Math.sin(ry);
  const cxR = Math.cos(rx);
  const sxR = Math.sin(rx);
  const czR = Math.cos(rz);
  const szR = Math.sin(rz);
  let dmin = Infinity;
  let dmax = -Infinity;
  for (let i = 0; i < M * V; i++) {
    let x = pts[i * 3] * shrink;
    let y = pts[i * 3 + 1] * shrink;
    let z = pts[i * 3 + 2] * shrink;
    let x1 = x * cyR + z * syR;
    let z1 = -x * syR + z * cyR;
    let y1 = y * cxR - z1 * sxR;
    z = y * sxR + z1 * cxR;
    x = x1 * czR - y1 * szR;
    y = x1 * szR + y1 * czR;
    const dz = knotZ + z - camZ;
    const s = F / Math.max(dz, 1);
    proj[i * 4] = W / 2 + (x - camX) * s;
    proj[i * 4 + 1] = H / 2 + (y - camY) * s;
    proj[i * 4 + 2] = s;
    proj[i * 4 + 3] = dz;
    if (dz < dmin) dmin = dz;
    if (dz > dmax) dmax = dz;
  }
  const build = M * E.inOutCubic(prog(lt, 0.2, 1.05));
  let cnt = 0;
  for (let k = 0; k < segs.length; k++) {
    const sg = segs[k];
    if (sg[2] > build) continue;
    depth[k] = proj[sg[0] * 4 + 3] + proj[sg[1] * 4 + 3];
    order[cnt++] = k;
  }
  const ord = order.subarray(0, cnt).sort((a, b) => depth[b] - depth[a]);
  c.lineCap = 'round';
  for (let q = 0; q < ord.length; q++) {
    const k = ord[q];
    const sg = segs[k];
    const a = sg[0] * 4;
    const b = sg[1] * 4;
    const dn = clamp((depth[k] / 2 - dmin) / (dmax - dmin + 1e-3));
    const head = Math.exp(-Math.abs(build - sg[2]) * 0.25) * (build < M - 0.5 ? 1 : 0);
    const col = cols[sg[2]];
    c.strokeStyle = head > 0.05 ? mix(LIME, CREAM, 1 - head) : css(col);
    c.globalAlpha = lerp(1, 0.18, dn);
    c.lineWidth = Math.max(0.6, 3.2 * proj[a + 2] * (1 + head * 1.5));
    c.beginPath();
    c.moveTo(proj[a], proj[a + 1]);
    c.lineTo(proj[b], proj[b + 1]);
    c.stroke();
  }
  c.lineCap = 'butt';
  c.globalAlpha = 1;
  c.restore();

  // telemetry
  const ta = prog(lt, 0.1, 0.3) * (1 - prog(lt, 1.6, 1.7));
  const ltq = frameLt(lt, t);
  const camZq = 4700 * E.inOutCubic(prog(ltq, -0.12, 1.05)) + Math.max(0, ltq - 1.05) * 160;
  const rollq = Math.sin(ltq * 1.2) * 0.1 + (1 - E.outCubic(prog(ltq, 0, 1.0))) * 0.6;
  mono(c, `CAM.Z ${Math.round(camZq).toString().padStart(4, '0')}   FOV 57°   ROLL ${((rollq * 180) / Math.PI).toFixed(1)}°`, W / 2, H - 170, 16, CREAM, 0.6 * ta, 'center');

  // iris out to cream
  const ir = E.inOutCubic(prog(lt, 1.64, 1.875));
  if (ir > 0) {
    c.fillStyle = CREAM;
    c.beginPath();
    c.arc(W / 2, H / 2, ir * 1160, 0, TAU);
    c.fill();
    c.strokeStyle = RED;
    c.lineWidth = 10;
    c.beginPath();
    c.arc(W / 2, H / 2, ir * 1160 + 8, 0, TAU);
    c.stroke();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 05 — TIMING & EASING
// ════════════════════════════════════════════════════════════════════════════
const PRESETS = [
  { name: 'LINEAR', css: 'cubic-bezier(0.25, 0.25, 0.75, 0.75)', p: [0.25, 0.25, 0.75, 0.75] },
  { name: 'EASE IN-OUT', css: 'cubic-bezier(0.65, 0, 0.35, 1)', p: [0.65, 0, 0.35, 1] },
  { name: 'OVERSHOOT', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)', p: [0.34, 1.56, 0.64, 1] },
  { name: 'EXPO OUT', css: 'cubic-bezier(0.16, 1, 0.3, 1)', p: [0.16, 1, 0.3, 1] },
];

function sceneEasing(c, lt, t) {
  fillBg(c, CREAM);
  const k = Math.min(3, Math.floor(lt / BEAT));
  const prev = PRESETS[Math.max(0, k - 1)];
  const cur = PRESETS[k];
  const mt = E.outBack(prog(lt, k * BEAT, k * BEAT + 0.24), 2.6);
  const cp = [0, 1, 2, 3].map((i) => lerp(prev.p[i], cur.p[i], mt));
  const intro = E.outExpo(prog(lt, 0, 0.4));
  const out = E.inExpo(prog(lt, 3.5 * BEAT, 4 * BEAT));

  // title
  {
    const base = 215;
    c.save();
    c.beginPath();
    c.rect(0, 0, W, base + 34);
    c.clip();
    const f1 = `400 128px ${SERIF}`;
    const f2 = `italic 400 128px ${SERIF}`;
    c.font = f1;
    const w1 = c.measureText('Timing is ').width;
    const q1 = E.outExpo(prog(lt, 0.02, 0.4));
    const q2 = E.outExpo(prog(lt, 0.1, 0.5));
    c.fillStyle = INK;
    c.fillText('Timing is ', 126, base + (1 - q1) * 160);
    c.font = f2;
    c.fillStyle = RED;
    c.fillText('everything.', 126 + w1, base + (1 - q2) * 160);
    c.restore();
  }

  // graph editor
  const X0 = 130;
  const Y0 = 330;
  const S = 560;
  const gx = (x) => X0 + x * S;
  const gy = (v) => Y0 + (S * (1.25 - v)) / 1.5;
  c.save();
  c.globalAlpha = intro;
  c.translate(X0 + S / 2, Y0 + S / 2);
  c.scale(lerp(0.94, 1, intro), lerp(0.94, 1, intro));
  c.translate(-X0 - S / 2, -Y0 - S / 2);
  c.strokeStyle = INK;
  c.lineWidth = 1;
  c.globalAlpha = 0.08 * intro;
  for (let i = 1; i < 6; i++) {
    line(c, X0 + (i * S) / 6, Y0, X0 + (i * S) / 6, Y0 + S);
    line(c, X0, Y0 + (i * S) / 6, X0 + S, Y0 + (i * S) / 6);
  }
  c.globalAlpha = 0.3 * intro;
  c.lineWidth = 2;
  c.strokeRect(X0, Y0, S, S);
  c.setLineDash([5, 7]);
  line(c, X0, gy(0), X0 + S, gy(0));
  line(c, X0, gy(1), X0 + S, gy(1));
  c.setLineDash([]);
  c.globalAlpha = intro;
  mono(c, '0', X0 - 14, gy(0) + 6, 15, INK, 0.5, 'right');
  mono(c, '1', X0 - 14, gy(1) + 6, 15, INK, 0.5, 'right');
  mono(c, 'TIME →', X0 + S, Y0 + S + 34, 15, INK, 0.55, 'right');
  mono(c, 'GRAPH EDITOR', X0, Y0 + S + 34, 15, INK, 0.55, 'left', 700);

  // handles
  c.strokeStyle = INK;
  c.lineWidth = 2;
  line(c, gx(0), gy(0), gx(cp[0]), gy(cp[1]));
  line(c, gx(1), gy(1), gx(cp[2]), gy(cp[3]));

  // curve (draws on)
  const dp = E.outCubic(prog(lt, 0.05, 0.45));
  c.strokeStyle = RED;
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i <= 90; i++) {
    const s = (i / 90) * dp;
    const x = gx(bez(cp[0], cp[2], s));
    const y = gy(bez(cp[1], cp[3], s));
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.lineCap = 'butt';
  for (const [hx, hy] of [
    [cp[0], cp[1]],
    [cp[2], cp[3]],
  ]) {
    c.fillStyle = CREAM;
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.fillRect(gx(hx) - 8, gy(hy) - 8, 16, 16);
    c.strokeRect(gx(hx) - 8, gy(hy) - 8, 16, 16);
  }
  c.fillStyle = INK;
  for (const [hx, hy] of [
    [0, 0],
    [1, 1],
  ]) {
    c.beginPath();
    c.arc(gx(hx), gy(hy), 7, 0, TAU);
    c.fill();
  }

  // playhead
  const lb = lt - k * BEAT;
  const p = prog(lb, 0.03, BEAT - 0.03);
  const v = cubicEase(cp, p);
  const pq = prog(frameLt(lt, t) - k * BEAT, 0.03, BEAT - 0.03);
  c.strokeStyle = INK;
  c.globalAlpha = 0.35 * intro;
  c.lineWidth = 1.5;
  line(c, gx(p), Y0, gx(p), Y0 + S);
  c.setLineDash([3, 5]);
  line(c, X0, gy(v), gx(p), gy(v));
  c.setLineDash([]);
  c.globalAlpha = intro;
  c.fillStyle = RED;
  c.strokeStyle = CREAM;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(gx(p), gy(v), 12, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();

  // preset name — slot-machine roll
  const RX = 860;
  {
    const roll = k === 0 ? 1 : E.outExpo(prog(lt, k * BEAT, k * BEAT + 0.28));
    c.save();
    c.beginPath();
    c.rect(RX - 10, 340, 1000, 150);
    c.clip();
    c.font = `900 124px ${DISPLAY}`;
    c.fillStyle = INK;
    const intoY = k === 0 ? (1 - E.outExpo(prog(lt, 0.06, 0.4))) * 150 : (1 - roll) * 150;
    c.fillText(cur.name, RX, 470 + intoY);
    if (k > 0) c.fillText(prev.name, RX, 470 - roll * 150);
    c.restore();
    const tp = prog(lt, k * BEAT + 0.03, k * BEAT + 0.24);
    const cursor = Math.floor(lt * 8) % 2 ? '▍' : ' ';
    mono(c, typed(cur.css, tp) + cursor, RX + 4, 524, 25, RED, intro, 'left', 500);
  }

  // track + onion skin
  const TX0 = 900;
  const TX1 = 1740;
  const TY = 700;
  const dirv = (x) => (k % 2 === 0 ? x : 1 - x);
  c.save();
  c.globalAlpha = intro;
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.globalAlpha = 0.25 * intro;
  line(c, TX0, TY, TX1, TY);
  line(c, TX0, TY - 16, TX0, TY + 16);
  line(c, TX1, TY - 16, TX1, TY + 16);
  for (let i = 0; i < 12; i++) {
    const vi = cubicEase(cp, i / 11);
    const xi = lerp(TX0, TX1, dirv(vi));
    c.globalAlpha = 0.16 * intro;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(xi, TY, 42, 0, TAU);
    c.stroke();
    c.globalAlpha = 0.6 * intro;
    line(c, xi, TY + 78, xi, TY + (i % 11 === 0 ? 102 : 94));
  }
  c.restore();
  mono(c, 'SPACING', TX0, TY + 132, 14, INK, 0.55 * intro, 'left', 700);
  mono(c, 'ONION SKIN ×12', TX1, TY + 132, 14, INK, 0.55 * intro, 'right', 700);

  // ball
  const vPrev = cubicEase(cp, prog(lb - 1 / 120, 0.03, BEAT - 0.03));
  const vel = Math.abs(v - vPrev) * 120 * (TX1 - TX0);
  let bx = lerp(TX0, TX1, dirv(v));
  let by = TY;
  const st = Math.min(vel / 5500, 0.45) * (1 - out);
  const mv = E.inOutCubic(prog(lt, 3.5 * BEAT, 3.5 * BEAT + 0.16));
  bx = lerp(bx, W / 2, mv);
  by = lerp(by, H / 2, mv);
  const br = 44 + out * 1300;
  c.fillStyle = RED;
  c.beginPath();
  c.ellipse(bx, by, br * (1 + st) * intro, (br / (1 + st)) * intro, 0, 0, TAU);
  c.fill();

  mono(c, `t ${pq.toFixed(3)}   ƒ(t) ${cubicEase(cp, pq).toFixed(3)}`, TX0, 900, 22, INK, 0.7 * intro * (1 - out));
}

// ════════════════════════════════════════════════════════════════════════════
// 06 — LIQUID / GENERATIVE
// ════════════════════════════════════════════════════════════════════════════
const FS = 2;
const FW = W / FS;
const FH = H / FS;
const LQ = {};

function initLiquid() {
  LQ.cv = mk(FW, FH);
  LQ.c = LQ.cv.getContext('2d');
  LQ.img = LQ.c.createImageData(FW, FH);
  LQ.F = new Float32Array(FW * FH);
  LQ.Hh = new Float32Array(FW * FH);
  LQ.blob = mk(W, H);
  LQ.bc = LQ.blob.getContext('2d');
  // colour lookup across x
  LQ.pal = [];
  for (let x = 0; x < FW; x++) LQ.pal.push(ramp([RED, '#FF5E8A', PINK, VIOLET, BLUE], x / FW));
}

function liquidBalls(lt, t) {
  const kick = kickEnv(t);
  const spread = E.outExpo(prog(lt, 0.02, 0.75));
  const merge = E.inCubic(prog(lt, 1.12, 1.62));
  const pop = E.outCubic(prog(lt, 3.5 * BEAT, 3.5 * BEAT + 0.06));
  const T = lt + 2.0;
  const balls = [];
  for (let i = 0; i < 7; i++) {
    const h = (k) => hash(i * 31 + k * 7 + 3);
    let x = W / 2 + (360 + 330 * h(1)) * Math.sin((0.8 + 0.9 * h(2)) * T + h(3) * TAU);
    let y = H / 2 + (170 + 150 * h(4)) * Math.sin((1.0 + 1.1 * h(5)) * T + h(6) * TAU);
    x = lerp(W / 2, x, spread * (1 - merge));
    y = lerp(H / 2, y, spread * (1 - merge));
    balls.push([x, y, (78 + 62 * h(7)) * (1 + 0.1 * kick) * (1 - pop)]);
  }
  const big = lerp(1700, 150, E.outExpo(prog(lt, 0, 0.62))) * (1 + 0.1 * kick) * (1 - pop);
  balls.push([W / 2 + Math.sin(lt * 1.3) * 60 * (1 - merge), H / 2 + Math.cos(lt * 1.1) * 40 * (1 - merge), big]);
  return balls;
}

function computeField(balls) {
  const { F, Hh, img } = LQ;
  const n = balls.length;
  const bx = new Float32Array(n);
  const by = new Float32Array(n);
  const br = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    bx[b] = balls[b][0] / FS;
    by[b] = balls[b][1] / FS;
    br[b] = (balls[b][2] / FS) ** 2;
  }
  let idx = 0;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      let s = 0;
      for (let b = 0; b < n; b++) {
        const dx = x + 0.5 - bx[b];
        const dy = y + 0.5 - by[b];
        s += br[b] / (dx * dx + dy * dy + 0.01);
      }
      F[idx] = s;
      Hh[idx] = Math.sqrt(clamp(s - 1, 0, 1.5));
      idx++;
    }
  }
  const d = img.data;
  // light
  let Lx = -0.45;
  let Ly = -0.65;
  let Lz = 0.62;
  const ll = Math.hypot(Lx, Ly, Lz);
  Lx /= ll;
  Ly /= ll;
  Lz /= ll;
  let Hx = Lx;
  let Hy = Ly;
  let Hz = Lz + 1;
  const hl = Math.hypot(Hx, Hy, Hz);
  Hx /= hl;
  Hy /= hl;
  Hz /= hl;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      const f = F[i];
      const o = i * 4;
      if (f < 0.85) {
        d[o + 3] = 0;
        continue;
      }
      const hL = Hh[x > 0 ? i - 1 : i];
      const hR = Hh[x < FW - 1 ? i + 1 : i];
      const hU = Hh[y > 0 ? i - FW : i];
      const hD = Hh[y < FH - 1 ? i + FW : i];
      let nx = (hL - hR) * 2.6;
      let ny = (hU - hD) * 2.6;
      let nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      const sp = Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), 42);
      const rim = Math.pow(1 - nz, 2);
      const col = LQ.pal[x];
      const shade = 0.28 + 0.85 * diff;
      d[o] = Math.min(255, col[0] * shade + 255 * sp * 0.9 + 120 * rim);
      d[o + 1] = Math.min(255, col[1] * shade + 255 * sp * 0.9 + 60 * rim);
      d[o + 2] = Math.min(255, col[2] * shade + 255 * sp * 0.9 + 160 * rim);
      d[o + 3] = 255 * smooth(0.94, 1.04, f);
    }
  }
  LQ.c.putImageData(img, 0, 0);
}

function marquee(c, lt, mode) {
  const font = `900 190px ${DISPLAY}`;
  const txt = 'LIQUID • ORGANIC • GENERATIVE • ';
  const tw = layout(c, txt, font).width;
  c.font = font;
  for (let r = 0; r < 4; r++) {
    const y = 250 + r * 235;
    const dir = r % 2 ? 1 : -1;
    const off = (lt * 300 + r * 430) % tw;
    let x = dir > 0 ? -tw + off : -off;
    for (; x < W; x += tw) {
      if (mode === 'stroke') c.strokeText(txt, x, y);
      else c.fillText(txt, x, y);
    }
  }
}

function sceneLiquid(c, lt, t) {
  fillBg(c, '#0E0B1A');
  c.strokeStyle = CREAM;
  c.lineWidth = 1.6;
  c.globalAlpha = 0.2 * prog(lt, 0.1, 0.4);
  marquee(c, lt, 'stroke');
  c.globalAlpha = 1;

  computeField(liquidBalls(lt, t));
  const bc = LQ.bc;
  bc.globalCompositeOperation = 'source-over';
  bc.clearRect(0, 0, W, H);
  bc.imageSmoothingEnabled = true;
  bc.imageSmoothingQuality = 'high';
  bc.drawImage(LQ.cv, 0, 0, W, H);
  bc.globalCompositeOperation = 'source-atop';
  bc.fillStyle = INK;
  bc.globalAlpha = 0.9;
  marquee(bc, lt, 'fill');
  bc.globalAlpha = 1;
  bc.globalCompositeOperation = 'source-over';
  c.drawImage(LQ.blob, 0, 0);

  // pop → droplets
  const dt = lt - 3.5 * BEAT;
  if (dt > 0) {
    const cx = W / 2;
    const cy = H / 2;
    const rp = clamp(dt / 0.23);
    c.strokeStyle = CREAM;
    c.globalAlpha = 1 - rp;
    c.lineWidth = 10 * (1 - rp) + 1;
    c.beginPath();
    c.arc(cx, cy, 80 + E.outExpo(rp) * 950, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
    const cols = [PINK, CREAM, RED, VIOLET];
    for (let i = 0; i < 70; i++) {
      const a = hash(i * 5 + 1) * TAU;
      const v = 700 + hash(i * 5 + 2) * 1700;
      const x = cx + Math.cos(a) * v * dt;
      const y = cy + Math.sin(a) * v * dt + 1800 * dt * dt;
      const r = (4 + hash(i * 5 + 3) * 14) * (1 - rp * 0.7);
      c.fillStyle = cols[i % 4];
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 07 — RAPID FIRE
// ════════════════════════════════════════════════════════════════════════════
const HB = BEAT / 2;
let glitchCv;
let glitchCtx;

function sceneMontage(c, lt, t, f) {
  const k = Math.min(7, Math.floor(lt / HB));
  const u = lt - k * HB;
  const punch = 1 + 0.09 * (1 - E.outExpo(prog(u, 0, 0.16)));
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(punch, punch);
  c.translate(-W / 2, -H / 2);
  const uq = frameLt(lt, t) - k * HB;
  [cutIso, cutRadial, cutHalftone, cutGlitch, cutZoom, cutRhythm, cutData, cutLoading][k](c, u, lt, t, f, uq);
  c.restore();
}

function cutIso(c, u, lt) {
  fillBg(c, CREAM);
  const tw = 124;
  const th = 62;
  const N = 9;
  const cx = W / 2;
  const cy = 330;
  for (let s = 0; s <= 2 * (N - 1); s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N) continue;
      const d = Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2);
      const h = 30 + 120 * (0.5 + 0.5 * Math.sin(d * 0.95 - lt * 16));
      const x = cx + ((i - j) * tw) / 2;
      const y = cy + ((i + j) * th) / 2;
      c.fillStyle = mix(RED, LIME, smooth(120, 150, h));
      c.beginPath();
      c.moveTo(x, y - h - th / 2);
      c.lineTo(x + tw / 2, y - h);
      c.lineTo(x, y - h + th / 2);
      c.lineTo(x - tw / 2, y - h);
      c.fill();
      c.fillStyle = '#B8321C';
      c.beginPath();
      c.moveTo(x - tw / 2, y - h);
      c.lineTo(x, y - h + th / 2);
      c.lineTo(x, y + th / 2);
      c.lineTo(x - tw / 2, y);
      c.fill();
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(x, y - h + th / 2);
      c.lineTo(x + tw / 2, y - h);
      c.lineTo(x + tw / 2, y);
      c.lineTo(x, y + th / 2);
      c.fill();
    }
  }
}

function cutRadial(c, u, lt, t) {
  fillBg(c, RED);
  const n = 18;
  c.fillStyle = INK;
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(lt * 2.4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, 1500, a, a + TAU / n / 2);
    c.fill();
  }
  c.restore();
  const r = 240 * E.outBack(prog(u, 0, 0.12), 3);
  c.fillStyle = CREAM;
  c.beginPath();
  c.arc(W / 2, H / 2, r, 0, TAU);
  c.fill();
  c.fillStyle = INK;
  c.font = `900 180px ${DISPLAY}`;
  c.textAlign = 'center';
  c.fillText('128', W / 2, H / 2 + 50);
  c.textAlign = 'left';
  mono(c, 'BPM', W / 2, H / 2 + 110, 30, INK, 1, 'center', 700);
}

function cutHalftone(c, u, lt) {
  fillBg(c, BLUE);
  const st = 34;
  const sx = W * 0.3 + Math.sin(lt * 3) * 300;
  const sy = H * 0.5;
  c.fillStyle = CREAM;
  c.beginPath();
  for (let y = st / 2; y < H + st; y += st) {
    for (let x = st / 2; x < W + st; x += st) {
      const d = Math.hypot(x - sx, y - sy);
      const r = 15 * (0.5 + 0.5 * Math.sin(d / 60 - lt * 20));
      if (r < 0.6) continue;
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, TAU);
    }
  }
  c.fill();
  const s = E.outBack(prog(u, 0, 0.14), 2.5);
  c.save();
  c.translate(W / 2, H / 2 + 110);
  c.rotate(-0.08);
  c.scale(s, s);
  c.font = `italic 900 380px ${DISPLAY}`;
  c.textAlign = 'center';
  c.fillStyle = INK;
  for (let e = 16; e >= 1; e--) c.fillText('POP!', e * 2.4, e * 2.4);
  c.fillStyle = LIME;
  c.fillText('POP!', 0, 0);
  c.restore();
}

function cutGlitch(c, u, lt, t, f) {
  if (!glitchCv) {
    glitchCv = mk(W, H);
    glitchCtx = glitchCv.getContext('2d');
  }
  const g = glitchCtx;
  const gf = Math.floor(t * 30);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  g.font = `900 330px ${DISPLAY}`;
  g.textAlign = 'center';
  g.globalCompositeOperation = 'lighter';
  const sep = 10 + hash(gf) * 18;
  g.fillStyle = '#FF1F4F';
  g.fillText('GLITCH', W / 2 - sep, H / 2 + 115);
  g.fillStyle = '#00E1FF';
  g.fillText('GLITCH', W / 2 + sep, H / 2 + 115);
  g.fillStyle = '#6a6a2a';
  g.fillText('GLITCH', W / 2, H / 2 + 115);
  g.globalCompositeOperation = 'source-over';

  fillBg(c, INK);
  let y = 0;
  let i = 0;
  while (y < H) {
    const bh = 12 + hash(gf * 131 + i) * 90;
    const big = hash(gf * 17 + i * 3) > 0.62;
    const off = (hash(gf * 97 + i) - 0.5) * (big ? 220 : 16);
    c.drawImage(glitchCv, 0, y, W, bh, off, y, W, bh);
    y += bh;
    i++;
  }
  for (let b = 0; b < 7; b++) {
    c.fillStyle = b % 2 ? LIME : PINK;
    c.globalAlpha = 0.85;
    c.fillRect(hash(gf * 7 + b) * W, hash(gf * 11 + b) * H, 20 + hash(gf * 13 + b) * 260, 4 + hash(gf * 19 + b) * 22);
  }
  c.globalAlpha = 0.28;
  c.fillStyle = '#000';
  for (let yy = 0; yy < H; yy += 4) c.fillRect(-300, yy, W + 600, 2);
  c.globalAlpha = 1;
}

function cutZoom(c, u, lt) {
  fillBg(c, INK);
  const z = lt * 3.4;
  const base = Math.floor(z);
  const fr = z - base;
  const cols = [LIME, INK, CREAM, INK, PINK, INK];
  c.save();
  c.translate(W / 2, H / 2);
  for (let k = 18; k >= 0; k--) {
    const size = 34 * Math.pow(1.36, k + fr);
    if (size > 3200) continue;
    const id = k - base;
    c.save();
    c.rotate(id * 0.16 + lt * 0.7);
    c.fillStyle = cols[((id % 6) + 6) % 6];
    c.fillRect(-size / 2, -size / 2, size, size);
    c.restore();
  }
  c.restore();
}

function cutRhythm(c, u, lt) {
  fillBg(c, CREAM);
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-Math.PI / 4);
  c.fillStyle = RED;
  const off = (lt * 900) % 160;
  for (let x = -1760; x < 1760; x += 160) c.fillRect(x + off, -1600, 80, 3200);
  c.restore();
  const font = `900 300px ${DISPLAY}`;
  const L = layout(c, 'RHYTHM', font, -8);
  const x0 = W / 2 - L.width / 2;
  c.font = font;
  c.lineJoin = 'round';
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const y = 650 - Math.abs(Math.sin(lt * Math.PI * (BPM4) + j * 0.7)) * 70;
    c.strokeStyle = CREAM;
    c.lineWidth = 22;
    c.strokeText(g.ch, x0 + g.x, y);
    c.fillStyle = INK;
    c.fillText(g.ch, x0 + g.x, y);
  }
}
const BPM4 = 4 / BEAT / 2; // bounce twice per beat

function cutData(c, u, lt, t, f, uq) {
  fillBg(c, INK);
  const n = 16;
  const X0 = 240;
  const X1 = 1680;
  const base = 880;
  const bw = (X1 - X0) / n - 18;
  for (let i = 0; i < n; i++) {
    const h = 110 + 520 * Math.pow(i / (n - 1), 1.5) + (hash(i * 7 + 3) - 0.5) * 90;
    const g = E.outBack(prog(u, 0.005 + i * 0.006, 0.11 + i * 0.006), 1.8);
    const x = X0 + i * (bw + 18);
    c.fillStyle = css(ramp([BLUE, VIOLET, PINK, RED, LIME], i / (n - 1)));
    c.fillRect(x, base - h * g, bw, h * g);
  }
  c.fillStyle = CREAM;
  c.globalAlpha = 0.35;
  c.fillRect(X0, base + 6, X1 - X0 - 18, 2);
  c.globalAlpha = 1;
  c.font = `900 170px ${DISPLAY}`;
  c.fillStyle = CREAM;
  c.fillText(`+${Math.round(248 * E.outExpo(prog(uq, 0, 0.2)))}%`, X0, 300);
  mono(c, 'MOTION IN THE WILD · Y/Y', X0 + 6, 350, 20, CREAM, 0.6, 'left', 700);
}

function cutLoading(c, u, lt, t, f, uq) {
  fillBg(c, LIME);
  const fr = E.outCubic(prog(u, 0, HB - 0.02));
  const val = Math.round(100 * E.outCubic(prog(uq, 0, HB - 1 / FPS)));
  c.font = `900 320px ${DISPLAY}`;
  c.fillStyle = INK;
  c.textAlign = 'right';
  const w100 = c.measureText('100%').width;
  c.fillText(`${val}%`, W / 2 + w100 / 2, 610);
  c.textAlign = 'left';
  const bx = 460;
  const bw = 1000;
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.strokeRect(bx, 690, bw, 26);
  c.fillStyle = INK;
  c.fillRect(bx + 6, 696, (bw - 12) * fr, 14);
  mono(c, 'RENDERING  CLAUDE_REEL_2026.MOV', W / 2, 790, 22, INK, 0.8, 'center', 700);
}

// ════════════════════════════════════════════════════════════════════════════
// 08 — END CARD
// ════════════════════════════════════════════════════════════════════════════
function drawMark(c, x, y, lt, rot) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.strokeStyle = RED;
  c.lineCap = 'round';
  c.lineWidth = 26;
  for (let k = 0; k < 12; k++) {
    const st = 0.02 + ((k * 5) % 12) * 0.018;
    const g = E.outBack(prog(lt, st, st + 0.3), 2.2);
    if (g <= 0) continue;
    const a = (k / 12) * TAU;
    const len = (k % 2 ? 0.6 : 1) * 138 * g;
    c.beginPath();
    c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
    c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    c.stroke();
  }
  c.restore();
}

function sceneEnd(c, lt, t, f) {
  fillBg(c, INK);
  c.save();
  const push = 1 + lt * 0.018;
  c.translate(W / 2, H / 2);
  c.scale(push, push);
  c.translate(-W / 2, -H / 2);

  dotGrid(c, lt + 0.15, [{ t: 0.05, x: W / 2, y: 470 }], 0.9);

  // ambient motes
  c.fillStyle = CREAM;
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 3 + 1) * W + Math.sin(lt + i) * 20;
    const y = ((hash(i * 3 + 2) * H - lt * (20 + 40 * hash(i * 3 + 3))) % H + H) % H;
    c.globalAlpha = 0.25 * hash(i * 3 + 4) * prog(lt, 0.2, 0.6);
    c.fillRect(x, y, 2, 2);
  }
  c.globalAlpha = 1;

  const font = `800 250px ${DISPLAY}`;
  const L = layout(c, 'Claude', font, -12);
  const groupW = 290 + 70 + L.width;
  const left = W / 2 - groupW / 2;
  const mv = E.inOutCubic(prog(lt, 0.28, 0.72));
  const mx = lerp(W / 2, left + 145, mv);
  const my = 480;
  const base = 568;
  const wx = left + 360;

  const rot = lerp(-Math.PI * 0.8, 0, E.outExpo(prog(lt, 0, 0.7))) + lt * 0.16;
  drawMark(c, mx, my, lt, rot);

  // sparkle burst when the mark lands
  const sb = prog(lt, 0.22, 0.62);
  if (sb > 0 && sb < 1) {
    c.strokeStyle = LIME;
    c.lineCap = 'round';
    c.lineWidth = 4 * (1 - sb) + 0.5;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU + 0.1;
      const r1 = 180 + 170 * E.outExpo(sb);
      const r0 = r1 - 50 * (1 - sb);
      line(c, mx + Math.cos(a) * r0, my + Math.sin(a) * r0, mx + Math.cos(a) * r1, my + Math.sin(a) * r1);
    }
    c.lineCap = 'butt';
  }

  // wordmark
  c.save();
  c.beginPath();
  c.rect(wx - 20, 0, W, base + 70);
  c.clip();
  c.font = font;
  c.fillStyle = CREAM;
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const st = 0.4 + j * 0.045;
    const p = E.outExpo(prog(lt, st, st + 0.5));
    c.fillText(g.ch, wx + g.x, base + (1 - p) * 300);
  }
  c.restore();

  // underline
  const ul = E.inOutCubic(prog(lt, 0.72, 1.1));
  c.fillStyle = CREAM;
  c.globalAlpha = 0.35;
  c.fillRect(wx + 6, base + 44, (L.width - 6) * ul, 3);
  c.globalAlpha = 1;
  c.fillStyle = RED;
  c.fillRect(wx + 6 + (L.width - 6) * ul - 40 * ul, base + 42, 40 * ul, 7);

  // decoded subtitle
  const sub = 'MOTION DESIGNER';
  c.font = `700 36px ${MONO}`;
  const cw = c.measureText('M').width + 12;
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/+=<>';
  const gf = Math.floor(t * 30);
  c.fillStyle = CREAM;
  for (let j = 0; j < sub.length; j++) {
    const st = 0.8 + j * 0.022;
    if (lt < st) continue;
    let ch = sub[j];
    if (lt < st + 0.14 && ch !== ' ') ch = glyphs[Math.floor(hash(gf * 31 + j) * glyphs.length)];
    c.fillStyle = lt < st + 0.14 ? LIME : CREAM;
    c.fillText(ch, wx + 8 + j * cw, base + 118);
  }
  mono(c, 'SHOWREEL 2026  —  AVAILABLE FOR NEW WORK', wx + 8, base + 164, 21, CREAM, 0.55 * prog(lt, 1.15, 1.4), 'left', 500);
  c.restore();

  const fa = prog(lt, 1.3, 1.6);
  mono(c, typed('900 FRAMES  ·  0 KEYFRAMES  ·  100% CODE', fa), W / 2, H - 84, 17, CREAM, 0.45 * fa, 'center', 500);
}

// ════════════════════════════════════════════════════════════════════════════
// pipeline
// ════════════════════════════════════════════════════════════════════════════
const SCENE_FNS = {
  bounce: sceneBounce,
  type: sceneType,
  particles: sceneParticles,
  three: scene3D,
  easing: sceneEasing,
  liquid: sceneLiquid,
  montage: sceneMontage,
  end: sceneEnd,
};

const CAPTIONS = {
  bounce: 'PHYSICS · ARCS · SQUASH & STRETCH',
  type: 'PER-GLYPH SPRINGS · MASKS · SLICES',
  particles: '4,200 PARTICLES · VORTEX → TYPE → BURST',
  three: 'HAND-ROLLED 3D · TORUS KNOT (2,3) · FLY-THROUGH',
  easing: 'CUBIC-BÉZIER · ONION SKIN · SPACING',
  liquid: 'METABALLS · Σ r²/d² · PHONG-SHADED FIELD',
  montage: '8 CUTS · 8 STYLES · 1.875 SECONDS',
};

// the liquid field is expensive and slow-moving; cap its motion-blur samples
const MAX_SUBSAMPLES = { liquid: 5 };

// Every hard cut: motion-blur subsamples never straddle one of these.
const CUTS = [
  ...SCENES.map((s) => s.end),
  at(1, 2),
  at(1, 3),
  ...[1, 2, 3, 4, 5, 6, 7].map((k) => at(6, k * 0.5)),
].sort((a, b) => a - b);
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
    const e = h.s * Math.exp(-d * 9);
    sx += e * 20 * noise1(d * 36 + i * 10);
    sy += e * 20 * noise1(d * 36 + i * 10 + 50);
    rot += e * 0.014 * noise1(d * 28 + i * 7 + 90);
    zoom += h.s * 0.04 * Math.exp(-d * 14);
  });
  return { sx, sy, rot, zoom };
}

let frameT = 0; // shutter-open time of the current frame
const frameLt = (lt, t) => lt - (t - frameT);

let cv;
let ctx;
let sceneCv;
let sctx;
let accCv;
let actx;
let chan;
let grain = [];
let vignette;

function drawWorld(c, t, f, si) {
  const sc = SCENES[si];
  const st = Math.min(t, sc.end - 1e-4);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.setLineDash([]);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = INK;
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
    if (d >= 0 && d < 0.5) a += h.s * Math.exp(-d * 14);
  }
  return a;
}

function applyChromatic(amount) {
  const k = Math.min(amount, 1.6) * 0.0125;
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
  switch (sc.id) {
    case 'type':
      return lt < 2 * BEAT ? INK : lt < 3 * BEAT ? CREAM : lt < 3.5 * BEAT ? INK : CREAM;
    case 'three':
      return lt > 1.78 ? INK : CREAM;
    case 'easing':
      return INK;
    case 'montage':
      return [INK, CREAM, CREAM, CREAM, 'difference', INK, CREAM, INK][Math.min(7, Math.floor(lt / HB))];
    default:
      return CREAM;
  }
}

function drawHUD(c, t, f) {
  const a = E.outCubic(prog(t, 0.15, 0.45)) * (1 - prog(t, at(7), at(7) + 0.12));
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
  // crop marks
  const m = 48;
  const L = 28;
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
  // scene label with slot roll
  let label = sc.label;
  let prevLabel = si > 0 ? SCENES[si - 1].label : '';
  let since = sc.start;
  if (sc.id === 'montage') {
    const k = Math.min(7, Math.floor((t - sc.start) / HB));
    label = MONTAGE_LABELS[k];
    prevLabel = k > 0 ? MONTAGE_LABELS[k - 1] : SCENES[si - 1].label;
    since = sc.start + k * HB;
  }
  const roll = si === 0 ? 1 : E.outExpo(prog(t, since, since + 0.2));
  c.save();
  c.beginPath();
  c.rect(84, 68, 900, 32);
  c.clip();
  c.font = `700 20px ${MONO}`;
  c.fillText(label, 88, 92 + (1 - roll) * 32);
  if (roll < 1) c.fillText(prevLabel, 88, 92 - roll * 32);
  c.restore();
  // top right
  c.font = `700 20px ${MONO}`;
  c.textAlign = 'right';
  c.fillText('CLAUDE — MOTION REEL ’26', W - 88, 92);
  if (Math.floor(t * 2) % 2 === 0) {
    c.beginPath();
    c.arc(W - 88 - c.measureText('CLAUDE — MOTION REEL ’26').width - 22, 85, 6, 0, TAU);
    c.fill();
  }
  // bottom row
  const by = H - 84;
  c.textAlign = 'left';
  const ss = Math.floor(f / FPS);
  const ff = f % FPS;
  c.fillText(`TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, 88, by);
  const cap = CAPTIONS[sc.id];
  if (cap) {
    c.textAlign = 'center';
    c.font = `500 17px ${MONO}`;
    c.fillText(typed(cap, prog(t, sc.start + 0.05, sc.start + 0.4)), W / 2, by);
  }
  // beat boxes
  const beatInBar = Math.floor((t % BAR) / BEAT);
  c.textAlign = 'right';
  c.font = `700 20px ${MONO}`;
  const bx = W - 88 - 4 * 22 + 8;
  c.fillText('128 BPM', bx - 20, by);
  for (let i = 0; i < 4; i++) {
    const x = bx + i * 22;
    if (i === beatInBar) c.fillRect(x, by - 15, 14, 14);
    else c.strokeRect(x + 1, by - 14, 12, 12);
  }
  // progress
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
    [
      `900 100px ${DISPLAY}`,
      `italic 900 100px ${DISPLAY}`,
      `800 100px ${DISPLAY}`,
      `500 20px ${MONO}`,
      `700 20px ${MONO}`,
      `400 100px ${SERIF}`,
      `italic 400 100px ${SERIF}`,
    ].map((f) => document.fonts.load(f)),
  );
  await document.fonts.ready;

  initParticles();
  initKnot();
  initLiquid();

  // film grain tiles
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
  const vg = vc.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1240);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
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
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = grain[f % grain.length];
  const ox = Math.floor(hash(f * 2 + 1) * 256);
  const oy = Math.floor(hash(f * 2 + 2) * 256);
  ctx.translate(-ox, -oy);
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

export const totalFrames = Math.round(DURATION * FPS);
