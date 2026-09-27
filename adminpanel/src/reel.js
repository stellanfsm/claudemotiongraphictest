// SEVENTH SEAL — «Adminpanelet» announcement video.
// Customer-facing product film: the admin panel is recreated faithfully
// (labels, colours, layout and flow taken from the real app) and driven by a
// scripted cursor. Deterministic, frame-accurate, rendered with sub-frame
// motion blur like the other reels in this repo.

import { W, H, FPS, BEAT, BAR, DURATION, SCENES, S, EV, CLICKS } from './timeline.js';

export { W, H, FPS, DURATION };

// ─── brand (frame) ─────────────────────────────────────────────────────────
const RED = '#FF1E3C';
const BLACK = '#0A0A0A';
const WHITE = '#FFFFFF';
const GRAY = '#F2F2F2';
const INKMUTED = '#6B6B6B';
const SANS = '"IBM Plex Sans", sans-serif';
const MONO = '"IBM Plex Mono", monospace';

// ─── panel design tokens (from adminsystem/src/styles/tokens.css) ─────────
const UI = '"InterVariable", sans-serif';
const P = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  surface2: '#eceef1',
  text: '#1c232c',
  muted: '#5c6672',
  border: '#dde1e6',
  accent: '#35506b',
  accentSoft: '#e9eef4',
  disabled: '#a9b4c0',
  danger: '#a33a3a',
  ok: '#2e6b4f',
  okSoft: '#e8f2ed',
  select: '#b9d4f6',
};

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
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// keyframes: [[t, a, b, c…], …] → interpolated values (inOutCubic between keys)
function keys(list, t) {
  if (t <= list[0][0]) return list[0].slice(1);
  for (let i = 0; i < list.length - 1; i++) {
    const [t0, ...a] = list[i];
    const [t1, ...b] = list[i + 1];
    if (t <= t1) {
      const e = E.inOutCubic(prog(t, t0, t1));
      return a.map((v, k) => lerp(v, b[k], e));
    }
  }
  return list[list.length - 1].slice(1);
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
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
const layoutCache = new Map();
function layout(c, str, font, tracking = 0) {
  const key = font + '|' + str + '|' + tracking;
  let L = layoutCache.get(key);
  if (L) return L;
  c.save();
  c.font = font;
  const glyphs = [];
  for (let i = 0; i < str.length; i++) glyphs.push({ ch: str[i], x: c.measureText(str.slice(0, i)).width + i * tracking });
  L = { glyphs, width: c.measureText(str).width + (str.length - 1) * tracking };
  c.restore();
  layoutCache.set(key, L);
  return L;
}
const wrapCache = new Map();
function wrap(c, str, font, maxW) {
  const key = font + '|' + str + '|' + maxW;
  let out = wrapCache.get(key);
  if (out) return out;
  c.save();
  c.font = font;
  out = [];
  let lineStr = '';
  for (const word of str.split(' ')) {
    const test = lineStr ? lineStr + ' ' + word : word;
    if (c.measureText(test).width > maxW && lineStr) {
      out.push(lineStr);
      lineStr = word;
    } else lineStr = test;
  }
  if (lineStr) out.push(lineStr);
  c.restore();
  wrapCache.set(key, out);
  return out;
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
function measure(c, str, font) {
  c.save();
  c.font = font;
  const w = c.measureText(str).width;
  c.restore();
  return w;
}
const typed = (s, p) => s.slice(0, Math.floor(clamp(p) * s.length + 1e-4));

// Per-glyph masked rise (the house type move), with optional clip.
function riseText(c, str, x, base, font, color, lt, start, { tracking = 0, stagger = 0.018, dur = 0.5, size = 100, align = 'left' } = {}) {
  const L = layout(c, str, font, tracking);
  const x0 = align === 'center' ? x - L.width / 2 : x;
  c.save();
  c.beginPath();
  c.rect(x0 - 40, base - size * 1.05, L.width + 120, size * 1.4);
  c.clip();
  c.font = font;
  c.fillStyle = color;
  for (let j = 0; j < L.glyphs.length; j++) {
    const q = E.outExpo(prog(lt, start + j * stagger, start + j * stagger + dur));
    if (q <= 0) continue;
    c.fillText(L.glyphs[j].ch, x0 + L.glyphs[j].x, base + (1 - q) * size * 1.25);
  }
  c.restore();
  return L.width;
}

// Wrapped paragraph that rises line by line.
function riseParagraph(c, str, x, y, font, lh, maxW, color, lt, start, { size = 32, align = 'left' } = {}) {
  const lines = wrap(c, str, font, maxW);
  lines.forEach((ln, i) => {
    const q = E.outExpo(prog(lt, start + i * 0.08, start + i * 0.08 + 0.6));
    if (q <= 0) return;
    c.save();
    c.beginPath();
    c.rect(x - (align === 'center' ? maxW : 20), y + i * lh - size * 1.1, maxW * 2 + 40, size * 1.5);
    c.clip();
    text(c, ln, x, y + i * lh + (1 - q) * size * 1.2, font, color, 1, align);
    c.restore();
  });
  return lines.length;
}

// ─── the Seventh Seal logo, parsed from the real SVG ──────────────────────
const LOGO = { rects: [] };
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
function drawSquare(c, cx, cy, s) {
  c.beginPath();
  c.roundRect(cx - 4 * s, cy - 4 * s, 8 * s, 8 * s, s);
  c.fill();
}
function brandMark(c, x, y, color, alpha) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.fillStyle = RED;
  for (const [dx, dy] of DIA) drawDiamond(c, dx - 13.24, dy - 18.47, 1.05);
  c.restore();
  text(c, 'SEVENTH SEAL', x + 22, y + 6, `600 17px ${MONO}`, color, alpha);
}

function checkerWipe(c, p, color, mode) {
  if (p <= 0 && mode === 'in') return;
  const Sz = 160;
  const cols = Math.ceil(W / Sz) + 1;
  const rows = Math.ceil(H / Sz) + 1;
  c.fillStyle = color;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d = (i + j * 0.5) / (cols + rows * 0.5);
      let s = E.outCubic(prog(p, d * 0.7, d * 0.7 + 0.3));
      if (mode === 'out') s = 1 - s;
      if (s <= 0) continue;
      const hs = (Sz / 2 + 1) * s;
      rrect(c, i * Sz + Sz / 2 - 40 - hs, j * Sz + Sz / 2 - 40 - hs, hs * 2, hs * 2, 14 * (1 - s) + 1);
      c.fill();
    }
  }
}

function pointer(c, x, y, s = 1, alpha = 1) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = BLACK;
  c.strokeStyle = WHITE;
  c.lineWidth = 2.5;
  c.lineJoin = 'round';
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

// ════════════════════════════════════════════════════════════════════════════
// The admin panel, recreated in its own design language (1600×1000 virtual)
// ════════════════════════════════════════════════════════════════════════════
const PW = 1600;
const PH = 1000;
const TOPBAR = 52;
const NAVBOT = 117;
const H1_OLD = 'Velkommen til Salong Saks';
const H1_NEW = 'Nye åpningstider fra mandag!';
const NEWS_NEW = 'Sommerkampanje: 20 % på farge!';
const H1F = `680 46px ${UI}`;
const IMG = { x: 464, y: 560, w: 672, h: 504 };
const BYTT = { x: IMG.x + IMG.w - 112, y: IMG.y + 12, w: 100, h: 30 };
const NEWS_Y = 1290;
const CARD = { x: 464, w: 672, gap: 14 };
const NEWS = [
  { date: '10.07.2026', dateLong: '10. juli 2026', title: 'Sommertider i juli', body: ['I hele juli holder vi åpent 10–16 på hverdager. Lørdager som vanlig. God sommer!'] },
  { date: '02.06.2026', dateLong: '2. juni 2026', title: 'Velkommen til Mia!', body: ['Vi har fått ny frisør på laget. Mia har ti års erfaring med farge og striper –', 'bestill time hos henne allerede i dag.'] },
];
const NEWCARD = { date: '27.09.2026', dateLong: '27. september 2026', body: ['Skriv nyhetsteksten her.'] };
const cardH = (n) => 88 + 22 * n.body.length;
const RED_BTN = { x: 1476, y: 66, w: 112, h: 34 };
const PUB_BTN = { x: 234, y: 9, w: 92, h: 34 };

function h1Box(c, str) {
  const w = measure(c, str, H1F);
  return { x: 800 - w / 2 - 12, y: 228 - 44, w: w + 24, h: 62 };
}
function toolbarRect(box) {
  return { x: box.x + box.w - 262, y: box.y - 40, w: 262, h: 32 };
}
const lagreCenter = (tb) => [tb.x + 170, tb.y + 16];

function newsLayout(st) {
  // y positions of the news cards (the new one is inserted at the top)
  const cards = [];
  let y = NEWS_Y + 26;
  const ins = st.newCard;
  if (ins > 0) {
    cards.push({ ...NEWCARD, title: st.newTitle, y, isNew: true, appear: ins });
    y += (cardH(NEWCARD) + CARD.gap) * clamp(st.newShift);
  }
  for (const n of NEWS) {
    cards.push({ ...n, y, isNew: false, appear: 1 });
    y += cardH(n) + CARD.gap;
  }
  return { cards, btnY: y + 2 };
}

function panelState(t) {
  const st = {
    edit: false,
    flash: 0,
    hover: null,
    editing: null,
    toolbar: 0,
    h1: H1_OLD,
    h1Sel: 0,
    popover: 0,
    crop: 0,
    cropOff: [0, 0],
    newImg: 0,
    newCard: 0,
    newShift: 0,
    newTitle: 'Ny nyhet',
    newSel: 0,
    changes: 0,
    publishing: 0,
    published: 0,
    scroll: 0,
    ringCounter: 0,
    ringPublish: 0,
  };
  const ts = t - S.text.start;
  const is = t - S.image.start;
  const ns = t - S.news.start;
  const ps = t - S.publish.start;
  const T = EV.text;
  const I = EV.image;
  const N = EV.news;
  const Pb = EV.publish;

  st.edit = ts >= T.rediger && ps < Pb.visSiden;
  st.flash = smooth(T.rediger + 0.05, T.rediger + 0.2, ts) * (1 - smooth(T.rediger + 0.7, T.rediger + 1.2, ts));
  if (ts > T.h1 - 0.25 && ts < T.h1) st.hover = 'h1';
  if (ts >= T.h1 && ts < T.lagre) {
    st.editing = 'h1';
    st.toolbar = E.outBack(prog(ts, T.h1, T.h1 + 0.2), 2);
  }
  st.h1Sel = ts > T.h1 + 0.15 && ts < T.typeFrom ? 1 : 0;
  if (ts >= T.typeFrom) st.h1 = ts >= T.typeTo ? H1_NEW : typed(H1_NEW, prog(ts, T.typeFrom, T.typeTo));
  if (ts >= T.typeFrom && ts < T.typeTo && typed(H1_NEW, prog(ts, T.typeFrom, T.typeTo)) === '') st.h1 = '';
  if (ts >= T.lagre) st.changes = 1;
  st.ringCounter = Math.max(st.ringCounter, smooth(T.lagre, T.lagre + 0.15, ts) * (1 - smooth(T.lagre + 1.6, T.lagre + 2.1, ts)));

  // image
  st.scroll = lerp(0, 380, E.inOutCubic(prog(is, 0.1, 0.9)));
  st.popover = E.outCubic(prog(is, I.bytt + 0.05, I.bytt + 0.2)) * (1 - prog(is, I.velgFil + 0.05, I.velgFil + 0.15));
  st.crop = E.outCubic(prog(is, I.cropOpen, I.cropOpen + 0.25)) * (1 - E.inCubic(prog(is, I.velgUtsnitt + 0.05, I.velgUtsnitt + 0.25)));
  const d = E.inOutCubic(prog(is, I.dragFrom, I.dragTo));
  st.cropOff = [lerp(0, -70, d), lerp(0, 34, d)];
  st.newImg = E.outCubic(prog(is, I.velgUtsnitt + 0.2, I.velgUtsnitt + 0.6));
  if (is >= I.velgUtsnitt + 0.2) st.changes = 2;
  st.ringCounter = Math.max(st.ringCounter, smooth(I.velgUtsnitt + 0.2, I.velgUtsnitt + 0.35, is) * (1 - smooth(I.velgUtsnitt + 1.4, I.velgUtsnitt + 1.9, is)));

  // news
  if (ns > 0) st.scroll = lerp(380, 1060, E.inOutCubic(prog(ns, 0.05, 0.85)));
  st.newCard = E.outBack(prog(ns, N.ny + 0.02, N.ny + 0.35), 1.6);
  st.newShift = E.outCubic(prog(ns, N.ny, N.ny + 0.3));
  if (ns >= N.ny) st.changes = 3;
  if (ns > N.title - 0.2 && ns < N.title) st.hover = 'news';
  if (ns >= N.title && ns < N.lagre) {
    st.editing = 'news';
    st.toolbar = E.outBack(prog(ns, N.title, N.title + 0.2), 2);
  }
  st.newSel = ns > N.title + 0.1 && ns < N.typeFrom ? 1 : 0;
  if (ns >= N.typeFrom) st.newTitle = ns >= N.typeTo ? NEWS_NEW : typed(NEWS_NEW, prog(ns, N.typeFrom, N.typeTo));

  // publish
  if (ps > 0) st.scroll = lerp(1060, 0, E.inOutCubic(prog(ps, 0.05, 0.9)));
  st.publishing = ps >= Pb.publiser && ps < Pb.done ? 1 : 0;
  st.published = ps >= Pb.done ? 1 : 0;
  st.ringPublish = smooth(Pb.done, Pb.done + 0.15, ps) * (1 - smooth(Pb.done + 1.3, Pb.done + 1.8, ps));
  if (st.published) st.changes = 0;
  return st;
}

// The photo spans 1100×825 units; a 4:3 frame shows the middle 800×600, so
// there is room to drag the crop. `pad` widens the clip (for the dimmed
// surround in the crop dialog) without changing the scale.
function drawNewImage(c, x, y, w, h, off = [0, 0], pad = 0) {
  c.save();
  rrect(c, x - pad, y - pad * 0.75, w + pad * 2, h + pad * 1.5, 6);
  c.clip();
  const s = w / 800;
  c.translate(x + w / 2 + off[0], y + h / 2 + off[1]);
  c.scale(s, s);
  c.drawImage(SALON, -550, -412, 1100, 825);
  c.restore();
}

function drawOldImage(c, x, y, w, h) {
  c.fillStyle = '#d5c8b8';
  rrect(c, x, y, w, h, 6);
  c.fill();
  text(c, 'Salong Saks', x + w / 2, y + h / 2 + 14, `300 ${Math.round(w / 17)}px ${UI}`, '#7a6f63', 1, 'center');
}

function dashed(c, x, y, w, h, alpha) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.setLineDash([7, 5]);
  c.strokeStyle = P.text;
  c.lineWidth = 2;
  rrect(c, x, y, w, h, 6);
  c.stroke();
  c.restore();
}

function toolbar(c, tb, a, cur) {
  if (a <= 0) return;
  c.save();
  c.translate(tb.x + tb.w, tb.y + tb.h);
  c.scale(a, a);
  c.translate(-tb.x - tb.w, -tb.y - tb.h);
  c.fillStyle = P.surface;
  c.strokeStyle = P.border;
  c.lineWidth = 1;
  rrect(c, tb.x, tb.y, tb.w, tb.h, 6);
  c.fill();
  c.stroke();
  const y = tb.y + 21;
  text(c, 'F', tb.x + 16, y, `700 14px ${UI}`, P.text);
  text(c, 'K', tb.x + 38, y, `italic 500 14px ${UI}`, P.text);
  text(c, 'Lenke', tb.x + 60, y, `500 14px ${UI}`, P.text);
  c.fillStyle = P.border;
  c.fillRect(tb.x + 112, tb.y + 7, 1, 18);
  const [lx, ly] = lagreCenter(tb);
  const hov = cur && Math.abs(cur[0] - lx) < 26 && Math.abs(cur[1] - ly) < 13;
  c.fillStyle = hov ? '#2a4157' : P.accent;
  rrect(c, lx - 25, tb.y + 5, 50, 22, 6);
  c.fill();
  text(c, 'Lagre', lx, y, `560 13px ${UI}`, WHITE, 1, 'center');
  text(c, 'Avbryt', tb.x + 224, y, `500 13px ${UI}`, P.text, 1, 'center');
  c.restore();
}

function drawPanel(c, st, t, cur) {
  // page
  c.fillStyle = P.bg;
  c.fillRect(0, 0, PW, PH);

  // ── site (scrolls under the bars) ──
  c.save();
  c.beginPath();
  c.rect(0, NAVBOT, PW, PH - NAVBOT);
  c.clip();
  c.translate(0, -st.scroll);

  // hero
  const box = h1Box(c, st.h1 || ' ');
  if (st.h1Sel) {
    const w = measure(c, H1_OLD, H1F);
    c.fillStyle = P.select;
    c.fillRect(800 - w / 2 - 2, 228 - 38, w + 4, 52);
  }
  text(c, st.h1, 800, 228, H1F, P.text, 1, 'center');
  if (st.editing === 'h1' && Math.floor(t * 2.4) % 2 === 0) {
    const w = measure(c, st.h1, H1F);
    c.fillStyle = P.text;
    c.fillRect(800 + w / 2 + 3, 228 - 36, 2.5, 46);
  }
  text(c, 'Din lokale frisør i hjertet av byen. Vi tilbyr klipp, farge og styling for hele', 800, 279, `420 20px ${UI}`, P.muted, 1, 'center');
  text(c, 'familien – alltid med et smil.', 800, 311, `420 20px ${UI}`, P.muted, 1, 'center');
  c.fillStyle = P.accentSoft;
  rrect(c, 591, 344, 418, 49, 6);
  c.fill();
  {
    const a = 'Bestill time på telefon ';
    const b = '22 33 44 55';
    const d = ' eller stikk innom!';
    const fa = `440 17px ${UI}`;
    const fb = `700 17px ${UI}`;
    const wa = measure(c, a, fa);
    const wb = measure(c, b, fb);
    const wd = measure(c, d, fa);
    let x = 800 - (wa + wb + wd) / 2;
    text(c, a, x, 374, fa, P.text);
    x += wa;
    text(c, b, x, 374, fb, P.text);
    x += wb;
    text(c, d, x, 374, fa, P.text);
  }
  // om oss
  text(c, 'Om oss', 464, 536, `680 32px ${UI}`, P.text);
  drawOldImage(c, IMG.x, IMG.y, IMG.w, IMG.h);
  if (st.newImg > 0) {
    c.save();
    c.globalAlpha = st.newImg;
    drawNewImage(c, IMG.x, IMG.y, IMG.w, IMG.h, [st.cropOff[0] * (IMG.w / 480), st.cropOff[1] * (IMG.w / 480)]);
    c.restore();
  }
  ['Vi bruker kun miljøvennlige produkter og tar oss god tid til hver eneste kunde.', 'Enten du vil ha en klassisk klipp eller en helt ny stil, hjelper vi deg med å', 'finne looken som passer deg.'].forEach((ln, i) =>
    text(c, ln, 464, 1112 + i * 28, `420 17px ${UI}`, P.text, 0.85),
  );
  // nyheter
  text(c, 'Nyheter', 464, NEWS_Y, `680 32px ${UI}`, P.text);
  const NL = newsLayout(st);
  for (const cd of NL.cards) {
    const h = cardH(cd);
    c.save();
    if (cd.isNew) {
      c.globalAlpha = clamp(cd.appear * 1.5);
      c.translate(CARD.x + CARD.w / 2, cd.y + h / 2);
      c.scale(lerp(0.96, 1, clamp(cd.appear)), lerp(0.96, 1, clamp(cd.appear)));
      c.translate(-CARD.x - CARD.w / 2, -cd.y - h / 2);
    }
    c.fillStyle = P.surface;
    c.strokeStyle = P.border;
    c.lineWidth = 1;
    rrect(c, CARD.x, cd.y, CARD.w, h, 6);
    c.fill();
    c.stroke();
    if (st.edit) {
      c.strokeStyle = P.border;
      rrect(c, CARD.x + 14, cd.y + 12, 132, 26, 6);
      c.stroke();
      text(c, cd.date, CARD.x + 24, cd.y + 30, `460 13px ${UI}`, P.text);
      c.strokeStyle = P.text;
      c.lineWidth = 1.4;
      c.strokeRect(CARD.x + 124, cd.y + 19, 12, 12);
      text(c, 'Slett', CARD.x + CARD.w - 14, cd.y + 28, `560 13px ${UI}`, P.danger, 1, 'right');
    } else {
      text(c, cd.dateLong, CARD.x + 16, cd.y + 30, `460 13px ${UI}`, P.muted);
    }
    const ty = cd.y + 62;
    if (cd.isNew && st.newSel) {
      c.fillStyle = P.select;
      c.fillRect(CARD.x + 14, ty - 17, measure(c, 'Ny nyhet', `680 18px ${UI}`) + 4, 24);
    }
    text(c, cd.title, CARD.x + 16, ty, `680 18px ${UI}`, P.text);
    if (cd.isNew && st.editing === 'news' && Math.floor(t * 2.4) % 2 === 0) {
      c.fillStyle = P.text;
      c.fillRect(CARD.x + 18 + measure(c, cd.title, `680 18px ${UI}`), ty - 17, 2, 22);
    }
    cd.body.forEach((ln, i) => text(c, ln, CARD.x + 16, ty + 26 + i * 22, `420 15px ${UI}`, P.text, 0.85));
    if (cd.isNew && (st.hover === 'news' || st.editing === 'news')) {
      const tw = measure(c, cd.title, `680 18px ${UI}`);
      const r = { x: CARD.x + 8, y: ty - 24, w: Math.max(tw, 60) + 18, h: 34 };
      if (st.editing === 'news') {
        c.strokeStyle = P.text;
        c.lineWidth = 2;
        rrect(c, r.x, r.y, r.w, r.h, 6);
        c.stroke();
      } else dashed(c, r.x, r.y, r.w, r.h, 1);
    }
    c.restore();
  }
  if (st.edit) {
    c.fillStyle = P.accent;
    rrect(c, CARD.x, NL.btnY, 104, 30, 6);
    c.fill();
    text(c, '+ Ny nyhet', CARD.x + 52, NL.btnY + 20, `560 14px ${UI}`, WHITE, 1, 'center');
  }
  // åpningstider
  const oy = NL.btnY + 90;
  c.fillStyle = P.surface;
  c.fillRect(0, oy, PW, 280);
  text(c, 'Åpningstider', 464, oy + 70, `680 32px ${UI}`, P.text);
  ['Mandag–fredag: 09:00–18:00', 'Lørdag: 10:00–15:00', 'Søndag: Stengt'].forEach((ln, i) => text(c, ln, 464, oy + 116 + i * 30, `440 17px ${UI}`, P.text));
  text(c, 'Drop-in ved ledig kapasitet – ring oss gjerne på forhånd.', 464, oy + 222, `420 15px ${UI}`, P.accent);
  text(c, 'Salong Saks · Storgata 12, 0155 Oslo · post@salongsaks.no', 800, oy + 330, `420 14px ${UI}`, P.muted, 1, 'center');

  // edit affordances (on top of the site)
  if (st.edit) {
    // one sweep of dashed frames when editing turns on: "this is what you can edit"
    if (st.flash > 0) {
      const b0 = h1Box(c, st.h1);
      dashed(c, b0.x, b0.y, b0.w, b0.h, st.flash);
      dashed(c, 800 - 420, 250, 840, 76, st.flash);
      dashed(c, 585, 338, 430, 61, st.flash);
      dashed(c, 456, 500, 142, 48, st.flash);
      dashed(c, IMG.x - 6, IMG.y - 6, IMG.w + 12, IMG.h + 12, st.flash);
    }
    if (st.hover === 'h1') dashed(c, box.x, box.y, box.w, box.h, 1);
    if (st.editing === 'h1') {
      c.strokeStyle = P.text;
      c.lineWidth = 2;
      rrect(c, box.x, box.y, box.w, box.h, 6);
      c.stroke();
    }
    // Bytt bilde
    const hov = cur && cur[0] > BYTT.x && cur[0] < BYTT.x + BYTT.w && cur[1] + st.scroll > BYTT.y && cur[1] + st.scroll < BYTT.y + BYTT.h;
    c.fillStyle = hov ? '#2a4157' : P.accent;
    rrect(c, BYTT.x, BYTT.y, BYTT.w, BYTT.h, 6);
    c.fill();
    text(c, 'Bytt bilde', BYTT.x + BYTT.w / 2, BYTT.y + 20, `560 14px ${UI}`, WHITE, 1, 'center');
    // popover
    if (st.popover > 0) {
      const px = BYTT.x - 150;
      const py = BYTT.y + 40;
      c.save();
      c.globalAlpha = st.popover;
      c.translate(0, (1 - st.popover) * -8);
      c.fillStyle = P.surface;
      c.strokeStyle = P.border;
      rrect(c, px, py, 260, 218, 6);
      c.fill();
      c.stroke();
      c.fillStyle = P.accent;
      rrect(c, px + 12, py + 12, 236, 34, 6);
      c.fill();
      text(c, 'Velg ny fil …', px + 130, py + 34, `600 15px ${UI}`, WHITE, 1, 'center');
      text(c, 'Beskrivelse av bildet', px + 12, py + 70, `600 14px ${UI}`, P.text);
      c.strokeStyle = P.border;
      rrect(c, px + 12, py + 80, 236, 38, 6);
      c.stroke();
      text(c, 'Salongen vår', px + 22, py + 104, `420 15px ${UI}`, P.text);
      text(c, 'Leses opp for dem som ikke ser', px + 12, py + 140, `420 13px ${UI}`, P.muted);
      text(c, 'bildet, og teller for søkemotorer.', px + 12, py + 158, `420 13px ${UI}`, P.muted);
      rrect(c, px + 12, py + 172, 236, 32, 6);
      c.stroke();
      text(c, 'Lagre beskrivelse', px + 130, py + 193, `500 14px ${UI}`, P.text, 1, 'center');
      c.restore();
    }
    if (st.editing === 'h1') toolbar(c, toolbarRect(box), st.toolbar, cur && [cur[0], cur[1] + st.scroll]);
    if (st.editing === 'news') {
      const cd = NL.cards[0];
      const r = { x: CARD.x + 8, y: cd.y + 38 };
      toolbar(c, { x: r.x + 340, y: r.y - 38, w: 262, h: 32 }, st.toolbar, cur && [cur[0], cur[1] + st.scroll]);
    }
  }
  c.restore();

  // ── site nav bar ──
  c.fillStyle = P.surface;
  c.fillRect(0, TOPBAR, PW, NAVBOT - TOPBAR);
  c.fillStyle = P.border;
  c.fillRect(0, NAVBOT - 1, PW, 1);
  text(c, 'Salong Saks', 32, 92, `680 21px ${UI}`, P.text);
  text(c, 'Om oss', 1458, 90, `440 16px ${UI}`, P.muted, 1, 'right');
  {
    const b = RED_BTN;
    const hov = cur && cur[0] > b.x && cur[0] < b.x + b.w && cur[1] > b.y && cur[1] < b.y + b.h;
    c.fillStyle = hov ? P.surface2 : P.surface;
    c.strokeStyle = P.border;
    c.lineWidth = 1;
    rrect(c, b.x, b.y, b.w, b.h, 17);
    c.fill();
    c.stroke();
    c.strokeStyle = P.text;
    c.lineWidth = 1.6;
    const ix = b.x + 22;
    const iy = b.y + 17;
    if (st.edit) {
      // eye
      c.beginPath();
      c.ellipse(ix, iy, 8, 5, 0, 0, TAU);
      c.stroke();
      c.beginPath();
      c.arc(ix, iy, 2.2, 0, TAU);
      c.fillStyle = P.text;
      c.fill();
      text(c, 'Vis siden', b.x + 38, b.y + 23, `560 15px ${UI}`, P.text);
    } else {
      // pencil
      c.beginPath();
      c.moveTo(ix - 6, iy + 6);
      c.lineTo(ix + 5, iy - 5);
      c.moveTo(ix - 6, iy + 6);
      c.lineTo(ix - 7, iy + 7);
      c.stroke();
      text(c, 'Rediger', b.x + 40, b.y + 23, `560 15px ${UI}`, P.text);
    }
  }

  // ── panel top bar ──
  c.fillStyle = P.surface;
  c.fillRect(0, 0, PW, TOPBAR);
  c.fillStyle = P.border;
  c.fillRect(0, TOPBAR - 1, PW, 1);
  {
    const L = layout(c, 'ADMINPANEL', `700 15px ${UI}`, 0.6);
    c.font = `700 15px ${UI}`;
    c.fillStyle = P.text;
    for (const g of L.glyphs) c.fillText(g.ch, 16 + g.x, 32);
  }
  c.strokeStyle = P.border;
  c.lineWidth = 1;
  c.fillStyle = P.surface;
  rrect(c, 129, 9, 96, 34, 6);
  c.fill();
  c.stroke();
  c.fillStyle = P.text;
  for (let i = 0; i < 3; i++) c.fillRect(148, 20 + i * 5, 12, 1.8);
  text(c, 'Meny', 170, 32, `560 16px ${UI}`, P.text);
  {
    const b = PUB_BTN;
    const enabled = st.changes > 0 && !st.publishing;
    const hov = enabled && cur && cur[0] > b.x && cur[0] < b.x + b.w && cur[1] > b.y && cur[1] < b.y + b.h;
    c.fillStyle = st.publishing ? P.accent : enabled ? (hov ? '#2a4157' : P.accent) : P.disabled;
    rrect(c, b.x, b.y, b.w + (st.publishing ? 38 : 0), b.h, 6);
    c.fill();
    text(c, st.publishing ? 'Publiserer …' : 'Publiser', b.x + (b.w + (st.publishing ? 38 : 0)) / 2, 32, `600 15px ${UI}`, WHITE, 1, 'center');
  }
  // right side: change counter / status
  {
    let label = st.changes === 1 ? '1 endring' : `${st.changes} endringer`;
    let bg = P.surface2;
    let fg = P.muted;
    if (st.published) {
      label = '3 endringer publisert';
      bg = P.okSoft;
      fg = P.ok;
    } else if (st.changes > 0) {
      bg = P.accentSoft;
      fg = P.accent;
    }
    const f = `560 12px ${UI}`;
    const w = measure(c, label, f) + 22;
    const x = 1495 - w;
    c.fillStyle = bg;
    rrect(c, x, 14, w, 24, 12);
    c.fill();
    text(c, label, x + w / 2, 30, f, fg, 1, 'center');
    if (st.changes > 0 && !st.published) text(c, 'Forkast endringer', x - 16, 31, `540 13px ${UI}`, P.text, 1, 'right');
    // attention rings (drawn in panel space, so they zoom with the camera)
    for (const [a, rx, ry, rw, rh] of [
      [st.ringCounter, x, 14, w, 24],
      [st.ringPublish, x, 14, w, 24],
    ]) {
      if (a <= 0) continue;
      c.strokeStyle = RED;
      c.lineWidth = 3;
      c.globalAlpha = a;
      const g = 6 + (1 - a) * 10;
      rrect(c, rx - g, ry - g, rw + g * 2, rh + g * 2, 12 + g);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
  // undo + settings icons
  c.strokeStyle = st.changes > 0 && !st.published ? P.text : P.disabled;
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(1524, 28, 7, Math.PI * 1.1, Math.PI * 0.35, false);
  c.stroke();
  c.beginPath();
  c.moveTo(1514, 22);
  c.lineTo(1517, 27);
  c.lineTo(1522, 24);
  c.stroke();
  c.strokeStyle = P.muted;
  c.beginPath();
  c.arc(1566, 26, 7, 0, TAU);
  c.stroke();
  c.beginPath();
  c.arc(1566, 26, 2.5, 0, TAU);
  c.stroke();

  // crop dialog (modal over everything)
  if (st.crop > 0) {
    c.save();
    c.globalAlpha = st.crop;
    c.fillStyle = 'rgba(28,35,44,0.5)';
    c.fillRect(0, 0, PW, PH);
    const dw = 560;
    const dh = 548;
    const dx = PW / 2 - dw / 2;
    const dy = PH / 2 - dh / 2;
    c.translate(PW / 2, PH / 2);
    c.scale(lerp(0.96, 1, st.crop), lerp(0.96, 1, st.crop));
    c.translate(-PW / 2, -PH / 2);
    c.fillStyle = P.surface;
    c.strokeStyle = P.border;
    rrect(c, dx, dy, dw, dh, 6);
    c.fill();
    c.stroke();
    text(c, 'Velg utsnitt', dx + 40, dy + 48, `680 20px ${UI}`, P.text);
    const vx = dx + 40;
    const vy = dy + 70;
    const vw = 480;
    const vh = 360;
    // the whole image, dimmed outside the locked frame
    c.save();
    rrect(c, vx - 30, vy - 10, vw + 60, vh + 20, 6);
    c.clip();
    c.fillStyle = '#20262e';
    c.fillRect(vx - 30, vy - 10, vw + 60, vh + 20);
    c.globalAlpha *= 0.4;
    drawNewImage(c, vx, vy, vw, vh, st.cropOff, 40);
    c.restore();
    drawNewImage(c, vx, vy, vw, vh, st.cropOff);
    c.strokeStyle = WHITE;
    c.lineWidth = 2;
    rrect(c, vx, vy, vw, vh, 6);
    c.stroke();
    // zoom slider
    c.fillStyle = P.border;
    rrect(c, vx, vy + vh + 34, vw, 4, 2);
    c.fill();
    c.fillStyle = P.accent;
    c.beginPath();
    c.arc(vx + 6, vy + vh + 36, 8, 0, TAU);
    c.fill();
    // buttons
    c.strokeStyle = P.border;
    c.fillStyle = P.surface;
    rrect(c, dx + dw - 290, dy + dh - 60, 104, 36, 6);
    c.fill();
    c.stroke();
    text(c, 'Avbryt', dx + dw - 238, dy + dh - 36, `540 15px ${UI}`, P.text, 1, 'center');
    c.fillStyle = P.accent;
    rrect(c, dx + dw - 176, dy + dh - 60, 136, 36, 6);
    c.fill();
    text(c, 'Bruk utsnitt', dx + dw - 108, dy + dh - 36, `600 15px ${UI}`, WHITE, 1, 'center');
    c.restore();
  }
}
const CROP_APPLY = [PW / 2 + 280 - 108, PH / 2 + 274 - 42];
const CROP_IMG = [PW / 2, PH / 2 - 274 + 70 + 180];

// ─── the new photo: a procedural salon illustration ───────────────────────
let SALON;
function initSalon() {
  SALON = mk(880, 660);
  const c = SALON.getContext('2d');
  const wall = c.createLinearGradient(0, 0, 0, 660);
  wall.addColorStop(0, '#f1e6d8');
  wall.addColorStop(1, '#e2cdb5');
  c.fillStyle = wall;
  c.fillRect(0, 0, 880, 660);
  // floor
  const fl = c.createLinearGradient(0, 500, 0, 660);
  fl.addColorStop(0, '#c9a988');
  fl.addColorStop(1, '#b8946f');
  c.fillStyle = fl;
  c.fillRect(0, 500, 880, 160);
  // window light
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(260, 0);
  c.lineTo(120, 500);
  c.lineTo(0, 500);
  c.fill();
  // arched mirror
  const mx = 440;
  c.fillStyle = '#b08d5f';
  c.beginPath();
  c.moveTo(mx - 130, 470);
  c.lineTo(mx - 130, 200);
  c.arc(mx, 200, 130, Math.PI, 0);
  c.lineTo(mx + 130, 470);
  c.closePath();
  c.fill();
  const gl = c.createLinearGradient(mx - 120, 80, mx + 120, 460);
  gl.addColorStop(0, '#f8f6f2');
  gl.addColorStop(1, '#d4dfe3');
  c.fillStyle = gl;
  c.beginPath();
  c.moveTo(mx - 116, 462);
  c.lineTo(mx - 116, 200);
  c.arc(mx, 200, 116, Math.PI, 0);
  c.lineTo(mx + 116, 462);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.75)';
  c.lineWidth = 10;
  c.beginPath();
  c.moveTo(mx - 70, 170);
  c.lineTo(mx - 10, 110);
  c.moveTo(mx - 76, 230);
  c.lineTo(mx + 10, 144);
  c.stroke();
  // pendant lamp + glow
  const glow = c.createRadialGradient(700, 150, 10, 700, 150, 220);
  glow.addColorStop(0, 'rgba(255,214,150,0.65)');
  glow.addColorStop(1, 'rgba(255,214,150,0)');
  c.fillStyle = glow;
  c.fillRect(480, 0, 400, 400);
  c.strokeStyle = '#2f2a28';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(700, 0);
  c.lineTo(700, 110);
  c.stroke();
  c.fillStyle = '#2f2a28';
  c.beginPath();
  c.arc(700, 140, 36, Math.PI, 0);
  c.fill();
  c.fillStyle = '#ffe2b0';
  c.beginPath();
  c.ellipse(700, 140, 30, 7, 0, 0, TAU);
  c.fill();
  // shelf with bottles
  c.fillStyle = '#8f6b47';
  c.fillRect(640, 300, 190, 12);
  [['#2f2a28', 660, 46], ['#d9b38c', 690, 58], ['#6f8f77', 724, 40], ['#f5efe7', 756, 52], ['#b56a4d', 790, 44]].forEach(([col, x, h]) => {
    c.fillStyle = col;
    rrect(c, x, 300 - h, 22, h, 5);
    c.fill();
  });
  // chair
  c.fillStyle = '#8c8c8c';
  c.fillRect(432, 520, 16, 70);
  c.beginPath();
  c.ellipse(440, 596, 80, 14, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#3a3431';
  rrect(c, 350, 340, 180, 150, 40);
  c.fill();
  c.fillStyle = '#2b2624';
  rrect(c, 320, 470, 240, 60, 26);
  c.fill();
  rrect(c, 300, 440, 40, 70, 16);
  c.fill();
  rrect(c, 540, 440, 40, 70, 16);
  c.fill();
  // plant
  c.fillStyle = '#c46b4b';
  c.beginPath();
  c.moveTo(90, 470);
  c.lineTo(190, 470);
  c.lineTo(176, 580);
  c.lineTo(104, 580);
  c.closePath();
  c.fill();
  const leaves = [
    [140, 360, -0.4],
    [110, 400, -0.9],
    [170, 390, 0.6],
    [135, 320, 0.1],
    [185, 430, 1.0],
    [95, 440, -1.2],
    [150, 420, 0.3],
  ];
  leaves.forEach(([x, y, r], i) => {
    c.save();
    c.translate(x, y);
    c.rotate(r);
    c.fillStyle = i % 2 ? '#5d7f5a' : '#739b6c';
    c.beginPath();
    c.ellipse(0, 0, 20, 56, 0, 0, TAU);
    c.fill();
    c.restore();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Scenes
// ════════════════════════════════════════════════════════════════════════════
let SD = BAR;

// 01 — intro
function sceneIntro(c, lt) {
  fillBg(c, BLACK);
  const k = 7;
  c.save();
  c.translate(W / 2 - 13.24 * k, 250 - 18.47 * k);
  c.scale(k, k);
  c.fillStyle = RED;
  DIA.forEach(([dx, dy], i) => {
    const T = EV.intro.diamonds[i];
    const e = E.inQuart(prog(lt, T - 0.2, T));
    if (e <= 0) return;
    const land = lt - T;
    const sq = land > 0 ? 0.25 * Math.exp(-land * 10) * Math.sin(land * 34) : 0;
    const dir = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][i];
    drawDiamond(c, lerp(dx + dir[0] * 40, dx, e), lerp(dy + dir[1] * 40, dy, e), lerp(2.4, 1, e) * (1 + sq), (1 - e) * 1.8);
  });
  c.restore();
  // NYHET pill
  const pa = E.outBack(prog(lt, 1.0, 1.25), 2.5);
  if (pa > 0) {
    c.save();
    c.translate(W / 2, 400);
    c.scale(pa, pa);
    c.fillStyle = RED;
    rrect(c, -78, -24, 156, 48, 24);
    c.fill();
    text(c, 'NYHET', 0, 9, `600 22px ${MONO}`, WHITE, 1, 'center');
    c.restore();
  }
  riseText(c, 'Adminpanelet', W / 2, 590, `700 170px ${SANS}`, WHITE, lt, 1.1, { tracking: -5, size: 170, align: 'center', stagger: 0.025 });
  riseParagraph(c, 'Oppdater nettsiden selv – uten kode.', W / 2, 690, `400 46px ${SANS}`, 56, 1400, '#BDBDBD', lt, 1.6, { size: 46, align: 'center' });
  checkerWipe(c, prog(lt, SD - 0.5, SD), GRAY, 'in');
}

// 02 — hook
function sceneHook(c, lt) {
  fillBg(c, GRAY);
  const qs = [
    ['Nye åpningstider?', 0.25, 'clock'],
    ['Nytt bilde?', 1.1, 'image'],
    ['Noe nytt å fortelle?', 1.95, 'megaphone'],
  ];
  const out = E.inExpo(prog(lt, 3.1, 3.45));
  const f = `700 104px ${SANS}`;
  qs.forEach(([q, st, icon], i) => {
    const y = 380 + i * 170;
    c.save();
    c.translate(0, -out * 900);
    c.globalAlpha = 1 - out;
    const x = 420;
    const ia = E.outBack(prog(lt, st, st + 0.3), 2.5);
    if (ia > 0) {
      c.save();
      c.translate(x - 90, y - 36);
      c.scale(ia, ia);
      c.fillStyle = RED;
      c.beginPath();
      c.arc(0, 0, 44, 0, TAU);
      c.fill();
      drawIcon(c, icon, 0, 0, WHITE);
      c.restore();
    }
    riseText(c, q, x, y, f, BLACK, lt, st, { tracking: -3, size: 104, stagger: 0.015 });
    c.restore();
  });
  const f2 = `700 112px ${SANS}`;
  riseText(c, 'Nå fikser dere det selv', W / 2, 500, f2, BLACK, lt, 3.4, { tracking: -3, size: 112, align: 'center', stagger: 0.016 });
  riseText(c, '– på sekunder.', W / 2, 640, f2, RED, lt, 3.7, { tracking: -3, size: 112, align: 'center', stagger: 0.02 });
  brandMark(c, 110, 90, BLACK, prog(lt, 0.3, 0.8) * 0.8);
}

function drawIcon(c, name, x, y, color) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (name === 'clock') {
    c.beginPath();
    c.arc(0, 0, 22, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(0, 0);
    c.lineTo(9, 7);
    c.stroke();
  } else if (name === 'image') {
    rrect(c, -22, -17, 44, 34, 5);
    c.stroke();
    c.beginPath();
    c.moveTo(-16, 11);
    c.lineTo(-4, -2);
    c.lineTo(4, 6);
    c.lineTo(10, 0);
    c.lineTo(16, 11);
    c.stroke();
    c.beginPath();
    c.arc(9, -8, 3.5, 0, TAU);
    c.fill();
  } else if (name === 'megaphone') {
    c.beginPath();
    c.moveTo(-18, -7);
    c.lineTo(10, -20);
    c.lineTo(10, 20);
    c.lineTo(-18, 7);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(-10, 8);
    c.lineTo(-6, 20);
    c.stroke();
    c.beginPath();
    c.arc(14, 0, 9, -0.9, 0.9);
    c.stroke();
  } else if (name === 'pencil') {
    c.beginPath();
    c.moveTo(-14, 14);
    c.lineTo(10, -10);
    c.lineTo(15, -5);
    c.lineTo(-9, 19);
    c.lineTo(-16, 21);
    c.closePath();
    c.stroke();
  } else if (name === 'shield') {
    c.beginPath();
    c.moveTo(0, -20);
    c.lineTo(17, -13);
    c.lineTo(15, 6);
    c.quadraticCurveTo(10, 16, 0, 21);
    c.quadraticCurveTo(-10, 16, -15, 6);
    c.lineTo(-17, -13);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(-7, 0);
    c.lineTo(-1, 6);
    c.lineTo(8, -5);
    c.stroke();
  } else if (name === 'tag') {
    c.beginPath();
    c.arc(0, 0, 20, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(-8, 1);
    c.lineTo(-2, 7);
    c.lineTo(9, -6);
    c.stroke();
  } else if (name === 'people') {
    c.beginPath();
    c.arc(-7, -8, 7, 0, TAU);
    c.stroke();
    c.beginPath();
    c.arc(-7, 18, 14, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.beginPath();
    c.arc(11, -5, 5.5, 0, TAU);
    c.stroke();
    c.beginPath();
    c.arc(12, 17, 11, Math.PI * 1.2, Math.PI * 1.8);
    c.stroke();
  }
  c.restore();
}

// 03–06 — the guided demo inside a browser window
const WIN = { x: 660, y: 150, w: 1180, h: 780, bar: 44 };
const K = WIN.w / PW; // panel → window scale (0.7375)

const CAPTIONS = {
  text: ['01', 'Endre tekst', 'Trykk «Rediger», klikk på teksten dere vil endre, og skriv. Trykk «Lagre» – ferdig.'],
  image: ['02', 'Bytt bilder', 'Last opp et nytt bilde og velg utsnittet. Bildet tilpasses plassen på siden.'],
  news: ['03', 'Legg ut nyheter', 'Ett klikk på «Ny nyhet», så skriver dere. Datoen fylles inn automatisk.'],
  publish: ['04', 'Se over og publiser', 'Ingenting blir synlig før dere trykker «Publiser». Til da kan alt angres.'],
};

// camera [t, cx, cy, zoom] and cursor [t, x, y] per demo scene (panel coords)
function demoScript() {
  const cx = document.createElement('canvas').getContext('2d');
  const tbNew = toolbarRect(h1Box(cx, H1_NEW));
  const [lgx, lgy] = lagreCenter(tbNew);
  const byttC = [BYTT.x + BYTT.w / 2, BYTT.y + 15 - 380];
  const velgFil = [BYTT.x - 150 + 130, BYTT.y + 40 + 29 - 380];
  // news button & new card (scroll 1060)
  let y = NEWS_Y + 26;
  for (const n of NEWS) y += cardH(n) + CARD.gap;
  const nyBtn = [CARD.x + 52, y + 2 + 15 - 1060];
  const newTitle = [CARD.x + 60, NEWS_Y + 26 + 56 - 1060];
  const newsLagre = [CARD.x + 8 + 340 + 170, NEWS_Y + 26 + 38 - 38 + 16 - 1060];
  return {
    text: {
      cam: [
        [0, 800, 500, 1],
        [0.95, 800, 500, 1],
        [1.75, 860, 250, 1.55],
        [5.35, 860, 250, 1.55],
        [6.2, 800, 500, 1],
      ],
      cur: [
        [0, 1250, 720],
        [0.7, RED_BTN.x + 60, RED_BTN.y + 18],
        [0.95, RED_BTN.x + 60, RED_BTN.y + 18],
        [2.05, 700, 214],
        [2.45, 700, 214],
        [2.75, 960, 320],
        [4.5, 980, 330],
        [5.05, lgx, lgy],
        [5.35, lgx, lgy],
        [6.4, 1250, 700],
      ],
    },
    image: {
      cam: [
        [0, 800, 500, 1],
        [0.2, 800, 500, 1],
        [1.0, 960, 330, 1.45],
        [2.15, 960, 330, 1.45],
        [2.6, 800, 500, 1.18],
        [5.25, 800, 500, 1.18],
        [5.7, 800, 420, 1.3],
        [6.8, 800, 420, 1.3],
        [7.4, 800, 500, 1],
      ],
      cur: [
        [0, 1250, 700],
        [1.05, ...byttC],
        [1.3, ...byttC],
        [1.85, ...velgFil],
        [2.1, ...velgFil],
        [2.7, ...CROP_IMG],
        [2.8, ...CROP_IMG],
        [4.2, CROP_IMG[0] - 70, CROP_IMG[1] + 34],
        [4.35, CROP_IMG[0] - 70, CROP_IMG[1] + 34],
        [4.95, ...CROP_APPLY],
        [5.25, ...CROP_APPLY],
        [6.3, 1250, 720],
      ],
    },
    news: {
      cam: [
        [0, 800, 500, 1],
        [0.9, 820, 420, 1.45],
        [4.3, 820, 420, 1.45],
        [5.1, 800, 500, 1],
      ],
      cur: [
        [0, 1250, 720],
        [0.85, ...nyBtn],
        [1.1, ...nyBtn],
        [1.6, ...newTitle],
        [1.8, ...newTitle],
        [2.1, newTitle[0] + 200, newTitle[1] + 90],
        [3.4, newTitle[0] + 220, newTitle[1] + 96],
        [3.8, ...newsLagre],
        [4.05, ...newsLagre],
        [5.0, 1250, 720],
      ],
    },
    publish: {
      cam: [[0, 800, 500, 1]],
      cur: [
        [0, 1250, 720],
        [0.85, RED_BTN.x + 60, RED_BTN.y + 18],
        [1.1, RED_BTN.x + 60, RED_BTN.y + 18],
        [2.35, PUB_BTN.x + 46, PUB_BTN.y + 18],
        [2.65, PUB_BTN.x + 46, PUB_BTN.y + 18],
        [3.4, 460, 230],
      ],
    },
  };
}
let SCRIPT;

function sceneDemo(c, lt, t, id) {
  fillBg(c, GRAY);
  // faint board motif, bottom-left
  c.fillStyle = 'rgba(10,10,10,0.035)';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if ((i + j) % 2 === 0) {
    rrect(c, 40 + i * 44, H - 220 + j * 44, 36, 36, 4);
    c.fill();
  }
  brandMark(c, 110, 90, BLACK, 0.8);

  // caption (left column)
  const [num, title, body] = CAPTIONS[id];
  const outA = E.inCubic(prog(lt, SD - 0.3, SD - 0.02));
  c.save();
  c.globalAlpha = 1 - outA;
  c.translate(0, -outA * 30);
  text(c, `${num}`, 112, 330, `600 26px ${MONO}`, RED, E.outCubic(prog(lt, 0.05, 0.3)));
  text(c, '/ 04', 150, 330, `600 26px ${MONO}`, INKMUTED, E.outCubic(prog(lt, 0.05, 0.3)));
  const tf = `700 76px ${SANS}`;
  const tl = wrap(c, title, tf, 500);
  tl.forEach((ln, i) => riseText(c, ln, 108, 430 + i * 82, tf, BLACK, lt, 0.1 + i * 0.08, { tracking: -2, size: 76, stagger: 0.014 }));
  riseParagraph(c, body, 112, 430 + tl.length * 82 + 40, `400 31px ${SANS}`, 45, 480, '#333', lt, 0.4, { size: 31 });
  c.restore();

  // browser window
  const enter = id === 'text' ? E.outExpo(prog(lt, 0, 0.8)) : 1;
  const phone = id === 'publish' ? E.outExpo(prog(lt, EV.publish.phone, EV.publish.phone + 0.8)) : 0;
  c.save();
  c.translate(0, (1 - enter) * 900);
  c.translate(-phone * 60, 0);
  c.fillStyle = 'rgba(0,0,0,0.08)';
  rrect(c, WIN.x + 6, WIN.y + 18, WIN.w, WIN.h, 16);
  c.fill();
  c.fillStyle = WHITE;
  c.strokeStyle = '#D6D6D6';
  c.lineWidth = 1;
  rrect(c, WIN.x, WIN.y, WIN.w, WIN.h, 14);
  c.fill();
  c.stroke();
  for (let d = 0; d < 3; d++) {
    c.fillStyle = '#D9D9D9';
    c.beginPath();
    c.arc(WIN.x + 24 + d * 20, WIN.y + 22, 6, 0, TAU);
    c.fill();
  }
  c.fillStyle = GRAY;
  rrect(c, WIN.x + WIN.w / 2 - 200, WIN.y + 9, 400, 26, 13);
  c.fill();
  text(c, 'salongsaks.no/admin', WIN.x + WIN.w / 2, WIN.y + 27, `500 15px ${MONO}`, '#555', 1, 'center');

  const sc = SCRIPT[id];
  const [cx, cy, z] = keys(sc.cam, lt);
  const hw = PW / (2 * z);
  const hh = PH / (2 * z);
  const ccx = clamp(cx, hw, PW - hw);
  const ccy = clamp(cy, hh, PH - hh);
  const [mx, my] = keys(sc.cur, lt);
  const st = panelState(t);

  c.save();
  c.beginPath();
  c.roundRect(WIN.x, WIN.y + WIN.bar, WIN.w, WIN.h - WIN.bar, [0, 0, 14, 14]);
  c.clip();
  c.translate(WIN.x, WIN.y + WIN.bar);
  c.scale(K, K);
  c.translate(PW / 2, PH / 2);
  c.scale(z, z);
  c.translate(-ccx, -ccy);
  drawPanel(c, st, t, [mx, my]);
  c.restore();

  // click ripples + cursor, in screen space
  const toScreen = (x, y) => [WIN.x + (PW / 2 + (x - ccx) * z) * K, WIN.y + WIN.bar + (PH / 2 + (y - ccy) * z) * K];
  const [sx, sy] = toScreen(mx, my);
  let press = 1;
  for (const ct of CLICKS) {
    const d = t - ct;
    if (d > -0.08 && d < 0.5) {
      if (d < 0.12) press = Math.min(press, 1 - 0.15 * Math.sin(clamp((d + 0.08) / 0.2) * Math.PI));
      if (d > 0) {
        const p = d / 0.5;
        c.strokeStyle = RED;
        c.globalAlpha = (1 - p) * 0.9;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(sx, sy, 8 + E.outCubic(p) * 34, 0, TAU);
        c.stroke();
        c.globalAlpha = 1;
      }
    }
  }
  const curA = 1 - prog(lt, id === 'publish' ? EV.publish.phone - 0.3 : 99, id === 'publish' ? EV.publish.phone : 100);
  pointer(c, sx, sy, press, curA);
  c.restore();

  if (id === 'publish' && phone > 0) drawPhone(c, lt, phone);
}

function drawPhone(c, lt, a) {
  const pw = 360;
  const ph = 740;
  const px = 1440 + (1 - a) * 700;
  const py = 180;
  // soft white veil over the window
  c.fillStyle = `rgba(242,242,242,${0.45 * a})`;
  c.fillRect(WIN.x - 80, WIN.y - 20, WIN.w + 100, WIN.h + 60);
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.12)';
  rrect(c, px + 8, py + 22, pw, ph, 52);
  c.fill();
  c.fillStyle = BLACK;
  rrect(c, px, py, pw, ph, 52);
  c.fill();
  const sx = px + 14;
  const sy = py + 14;
  const sw = pw - 28;
  const sh = ph - 28;
  rrect(c, sx, sy, sw, sh, 40);
  c.clip();
  c.fillStyle = P.bg;
  c.fillRect(sx, sy, sw, sh);
  const scroll = E.inOutCubic(prog(lt, EV.publish.phone + 1.2, SD - 0.6)) * 430;
  c.save();
  c.translate(0, -scroll);
  // mobile site
  let y = sy + 90;
  text(c, 'Salong Saks', sx + 20, sy + 70, `680 18px ${UI}`, P.text);
  for (let i = 0; i < 3; i++) c.fillRect(sx + sw - 38, sy + 58 + i * 6, 18, 2);
  c.fillStyle = P.border;
  c.fillRect(sx, sy + 88, sw, 1);
  y += 60;
  const hl = wrap(c, H1_NEW, `680 30px ${UI}`, sw - 40);
  hl.forEach((ln, i) => text(c, ln, sx + sw / 2, y + i * 36, `680 30px ${UI}`, P.text, 1, 'center'));
  y += hl.length * 36 + 14;
  wrap(c, 'Din lokale frisør i hjertet av byen. Vi tilbyr klipp, farge og styling for hele familien – alltid med et smil.', `420 15px ${UI}`, sw - 40).forEach((ln, i) =>
    text(c, ln, sx + sw / 2, y + i * 22, `420 15px ${UI}`, P.muted, 1, 'center'),
  );
  y += 80;
  c.fillStyle = P.accentSoft;
  rrect(c, sx + 20, y, sw - 40, 44, 6);
  c.fill();
  text(c, 'Ring 22 33 44 55 for time', sx + sw / 2, y + 28, `500 14px ${UI}`, P.text, 1, 'center');
  y += 90;
  text(c, 'Om oss', sx + 20, y, `680 24px ${UI}`, P.text);
  y += 16;
  const iw = sw - 40;
  drawNewImage(c, sx + 20, y, iw, iw * 0.75, [-70 * (iw / 480), 34 * (iw / 480)]);
  y += iw * 0.75 + 50;
  text(c, 'Nyheter', sx + 20, y, `680 24px ${UI}`, P.text);
  y += 18;
  c.fillStyle = P.surface;
  c.strokeStyle = P.border;
  rrect(c, sx + 20, y, sw - 40, 104, 6);
  c.fill();
  c.stroke();
  text(c, NEWCARD.dateLong, sx + 34, y + 26, `460 12px ${UI}`, P.muted);
  wrap(c, NEWS_NEW, `680 16px ${UI}`, sw - 70).forEach((ln, i) => text(c, ln, sx + 34, y + 52 + i * 20, `680 16px ${UI}`, P.text));
  c.restore();
  c.restore();
  // "live" badge
  const ba = E.outBack(prog(lt, EV.publish.phone + 0.5, EV.publish.phone + 0.8), 2.4);
  if (ba > 0) {
    c.save();
    c.translate(px + pw / 2, py - 36);
    c.scale(ba, ba);
    c.fillStyle = P.ok;
    rrect(c, -150, -26, 300, 52, 26);
    c.fill();
    c.fillStyle = WHITE;
    c.beginPath();
    c.arc(-118, 0, 7, 0, TAU);
    c.fill();
    text(c, 'Ute på nettsiden nå', 12, 8, `600 22px ${SANS}`, WHITE, 1, 'center');
    c.restore();
  }
}

// 07 — benefits
const BENEFITS = [
  ['pencil', 'Rediger rett på siden', 'Dere ser nøyaktig hvordan det blir.'],
  ['shield', 'Trygt å prøve seg fram', 'Alt lagres som utkast til dere publiserer.'],
  ['tag', 'Inkludert, ikke et tillegg', 'Drift av panelet ligger i månedsprisen.'],
  ['people', '30 minutters opplæring', 'Vi går gjennom panelet sammen med dere.'],
];
function sceneBenefits(c, lt) {
  fillBg(c, GRAY);
  brandMark(c, 110, 90, BLACK, 0.8);
  riseText(c, 'Enkelt. Trygt. Inkludert.', 160, 250, `700 84px ${SANS}`, BLACK, lt, 0.05, { tracking: -2, size: 84, stagger: 0.014 });
  BENEFITS.forEach(([icon, title, body], i) => {
    const st = 0.6 + i * BEAT;
    const p = E.outExpo(prog(lt, st, st + 0.6));
    if (p <= 0) return;
    const x = 160 + (i % 2) * 820;
    const y = 330 + Math.floor(i / 2) * 290;
    c.save();
    c.globalAlpha = clamp(p * 1.4);
    c.translate(0, (1 - p) * 60);
    c.fillStyle = WHITE;
    c.strokeStyle = '#DADADA';
    c.lineWidth = 1;
    rrect(c, x, y, 780, 250, 10);
    c.fill();
    c.stroke();
    c.fillStyle = RED;
    rrect(c, x + 40, y + 42, 72, 72, 10);
    c.fill();
    drawIcon(c, icon, x + 76, y + 78, WHITE);
    text(c, title, x + 40, y + 170, `700 40px ${SANS}`, BLACK);
    text(c, body, x + 40, y + 214, `400 28px ${SANS}`, '#555');
    c.restore();
  });
  checkerWipe(c, prog(lt, SD - 0.5, SD), BLACK, 'in');
}

// 08 — outro
function sceneOutro(c, lt) {
  fillBg(c, BLACK);
  const k = 4.2;
  const ox = W / 2 - 113 * k;
  const oy = 330 - 41 * k;
  c.save();
  c.translate(ox, oy);
  c.scale(k, k);
  c.fillStyle = WHITE;
  for (const [x, y] of LOGO.rects) {
    const d = x + y;
    const s = E.outBack(prog(lt, (d / 140) * 0.35, (d / 140) * 0.35 + 0.28), 2.4);
    if (s > 0) drawSquare(c, x + 4, y + 4, s);
  }
  c.fillStyle = RED;
  DIA.forEach(([dx, dy], i) => {
    const T = [0.1, 0.2, 0.3, 0.4][i] * 1.2;
    const e = E.inQuart(prog(lt, T - 0.16, T));
    if (e <= 0) return;
    drawDiamond(c, dx, lerp(dy - 30, dy, e), lerp(2.2, 1, e), (1 - e) * 1.6);
  });
  for (const [path, col, st] of [
    [LOGO.seventh, RED, 0.35],
    [LOGO.seal, WHITE, 0.45],
  ]) {
    const p = E.outExpo(prog(lt, st, st + 0.5));
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
  riseParagraph(c, 'Adminpanelet følger med hver nettside fra Seventh Seal.', W / 2, 620, `500 44px ${SANS}`, 54, 1600, WHITE, lt, 1.0, { size: 44, align: 'center' });
  riseParagraph(c, 'Prøv panelet selv før dere bestemmer dere.', W / 2, 686, `400 32px ${SANS}`, 40, 1600, '#BDBDBD', lt, 1.3, { size: 32, align: 'center' });
  const bp = E.outBack(prog(lt, 1.6, 1.9), 2.2);
  if (bp > 0) {
    c.save();
    c.translate(W / 2, 800);
    c.scale(bp, bp);
    c.fillStyle = RED;
    rrect(c, -170, -44, 340, 88, 44);
    c.fill();
    text(c, 'Ta kontakt  →', 0, 12, `700 34px ${SANS}`, WHITE, 1, 'center');
    c.restore();
  }
  text(c, typed('seventhseal.no   ·   team@seventhseal.no', prog(lt, 2.0, 2.6)), W / 2, 940, `500 24px ${MONO}`, WHITE, 0.65, 'center');
}

// ════════════════════════════════════════════════════════════════════════════
// pipeline
// ════════════════════════════════════════════════════════════════════════════
const SCENE_FNS = {
  intro: sceneIntro,
  hook: sceneHook,
  text: (c, lt, t) => sceneDemo(c, lt, t, 'text'),
  image: (c, lt, t) => sceneDemo(c, lt, t, 'image'),
  news: (c, lt, t) => sceneDemo(c, lt, t, 'news'),
  publish: (c, lt, t) => sceneDemo(c, lt, t, 'publish'),
  benefits: sceneBenefits,
  outro: sceneOutro,
};
const CUTS = SCENES.map((s) => s.end);
const nextCut = (t) => CUTS.find((c) => c > t + 1e-9) ?? DURATION;
const sceneAt = (t) => {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
};

let cv;
let ctx;
let sceneCv;
let sctx;
let accCv;
let actx;
let grain = [];
let vignette;

function drawWorld(c, t, si) {
  const sc = SCENES[si];
  const st = Math.min(t, sc.end - 1e-4);
  SD = sc.end - sc.start;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.setLineDash([]);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = BLACK;
  c.fillRect(0, 0, W, H);
  SCENE_FNS[sc.id](c, st - sc.start, st);
  c.setTransform(1, 0, 0, 1, 0, 0);
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
  await Promise.all(
    [`400 100px ${SANS}`, `500 100px ${SANS}`, `700 100px ${SANS}`, `500 20px ${MONO}`, `600 20px ${MONO}`, `400 20px ${UI}`, `700 20px ${UI}`, `italic 500 20px ${UI}`].map((f) =>
      document.fonts.load(f, 'ÆØÅæøå«»–'),
    ),
  );
  await document.fonts.ready;
  await initLogo();
  initSalon();
  SCRIPT = demoScript();
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
  const vg = vc.createRadialGradient(W / 2, H / 2, 600, W / 2, H / 2, 1300);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.14)');
  vc.fillStyle = vg;
  vc.fillRect(0, 0, W, H);
}

export function renderFrame(f, { subsamples = 4, shutter = 0.5 } = {}) {
  const t0 = f / FPS;
  const si = sceneAt(t0);
  for (let k = 0; k < subsamples; k++) {
    const ts = Math.min(t0 + ((k / subsamples) * shutter) / FPS, nextCut(t0) - 1e-4);
    drawWorld(sctx, ts, si);
    actx.globalCompositeOperation = 'source-over';
    actx.globalAlpha = 1 / (k + 1);
    actx.drawImage(sceneCv, 0, 0);
  }
  actx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(accCv, 0, 0);
  ctx.drawImage(vignette, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = grain[f % grain.length];
  ctx.translate(-Math.floor(hash(f * 2 + 1) * 256), -Math.floor(hash(f * 2 + 2) * 256));
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

export const totalFrames = Math.round(DURATION * FPS);
