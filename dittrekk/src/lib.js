// Shared helpers: brand tokens, math, easing, deterministic noise, and the
// canvas-2D type tools the scenes are built from.

import { W, H } from './timeline.js';

// ─── brand (seventhseal.no) ────────────────────────────────────────────────
export const RED = '#FF1E3C';
export const DRED = '#D70022';
export const BLACK = '#0A0A0A';
export const WHITE = '#FFFFFF';
export const GRAY = '#F2F2F2';
export const SANS = '"IBM Plex Sans", sans-serif';
export const MONO = '"IBM Plex Mono", monospace';
export const COND = '"Anton", sans-serif';
export const RED_LIN = [1.0, 0.012, 0.045]; // #FF1E3C in (gamma-2) linear

// ─── math ──────────────────────────────────────────────────────────────────
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const E = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
export function spring(t, w = 18, z = 0.35) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
export function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, f * f * (3 - 2 * f));
}
export const halton = (i, b) => {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
};
const rgbCache = new Map();
export function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
export function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${lerp(A[0], B[0], t) | 0},${lerp(A[1], B[1], t) | 0},${lerp(A[2], B[2], t) | 0})`;
}
// sRGB hex → the renderer's gamma-2 linear colour
export const linHex = (hex) => rgb(hex).map((v) => (v / 255) ** 2);

// ─── canvas ────────────────────────────────────────────────────────────────
export function mk(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}
export function fillBg(c, color) {
  c.fillStyle = color;
  c.fillRect(-400, -400, W + 800, H + 800);
}
export function line(c, x0, y0, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}
const layoutCache = new Map();
export function layout(c, str, font, tracking = 0) {
  const key = font + '|' + str + '|' + tracking;
  let L = layoutCache.get(key);
  if (L) return L;
  c.save();
  c.font = font;
  const glyphs = [];
  for (let i = 0; i < str.length; i++) {
    glyphs.push({ ch: str[i], x: c.measureText(str.slice(0, i)).width + i * tracking, w: c.measureText(str[i]).width });
  }
  const width = c.measureText(str).width + (str.length - 1) * tracking;
  c.restore();
  L = { glyphs, width };
  layoutCache.set(key, L);
  return L;
}
export function text(c, str, x, y, font, color, alpha = 1, align = 'left') {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(str, x, y);
  c.restore();
}
export const mono = (c, str, x, y, size, color, alpha = 1, align = 'left', weight = 600) =>
  text(c, str, x, y, `${weight} ${size}px ${MONO}`, color, alpha, align);
export const typed = (s, p) => s.slice(0, Math.floor(clamp(p) * s.length + 1e-4));

// Per-glyph masked rise: each letter slides up out of a clip line.
// Returns the line width. align: 'left' | 'center' | 'right' relative to x.
export function riseText(c, str, x, base, font, color, lt, start, o = {}) {
  const { tracking = 0, stagger = 0.018, dur = 0.42, dist = 1.15, size = 100, align = 'left', out = null, alpha = 1 } = o;
  const L = layout(c, str, font, tracking);
  const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
  c.save();
  c.globalAlpha *= alpha;
  c.beginPath();
  c.rect(x0 - 60, base - size * 1.08, L.width + 140, size * 1.42);
  c.clip();
  c.font = font;
  c.fillStyle = color;
  for (let j = 0; j < L.glyphs.length; j++) {
    const g = L.glyphs[j];
    const q = E.outExpo(prog(lt, start + j * stagger, start + j * stagger + dur));
    if (q <= 0) continue;
    let y = base + (1 - q) * size * dist;
    if (out !== null) {
      const qo = E.inExpo(prog(lt, out + j * stagger * 0.5, out + j * stagger * 0.5 + 0.28));
      y -= qo * size * dist;
    }
    c.fillText(g.ch, x0 + g.x, y);
  }
  c.restore();
  return L.width;
}

// Rich line: segments [[str, color], ...] rising as one line.
export function riseRich(c, segs, x, base, font, lt, start, o = {}) {
  const { tracking = 0, align = 'left' } = o;
  const full = segs.map((s) => s[0]).join('');
  const Lf = layout(c, full, font, tracking);
  let x0 = align === 'center' ? x - Lf.width / 2 : align === 'right' ? x - Lf.width : x;
  let k = 0;
  for (const [str, color] of segs) {
    const pre = layout(c, full.slice(0, k), font, tracking).width + (k > 0 ? tracking : 0);
    riseText(c, str, x0 + pre, base, font, color, lt, start + k * (o.stagger ?? 0.018), { ...o, align: 'left' });
    k += str.length;
  }
  return Lf.width;
}

// The standard arrow pointer, tip at (0,0), 1 unit ≈ 1 px at scale 1.
export function cursorPath(c, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 30);
  c.lineTo(7.2, 23.4);
  c.lineTo(12.2, 34.4);
  c.lineTo(17, 32.2);
  c.lineTo(12.2, 21.6);
  c.lineTo(21.6, 21.6);
  c.closePath();
  c.restore();
}
export function drawCursor(c, x, y, s = 1, fill = WHITE, stroke = BLACK) {
  cursorPath(c, x, y, s);
  c.lineJoin = 'round';
  c.lineWidth = 2.6 * s;
  c.strokeStyle = stroke;
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}
