// «PRØV Å RINGE DEG SELV» — a vertical ad for Seventh Seal (seventhseal.no),
// aimed at businesses with an outdated website. Try to find your own phone
// number on your site, on a phone; then the free website check finds what's
// wrong (and keeps two findings for the e-mail), and a before/after shows the
// fix: one tap, and the customer is calling.

import { W, H, FPS, DURATION, SCENES, S, HITS, CUTS, HOOK, STAT, SCAN, AFTER, PRICE, CTA } from './timeline.js';
import { RED, BLACK, WHITE, SANS, MONO, COND, TAU, clamp, lerp, prog, smooth, E, mk, text, mono, typed, riseText, layout } from './lib.js';
import { K, screenMat, phoneItems, screenPx, gl3, RIG_LIGHT, phoneShot, drawLockup, touch, ripple, redGlow, checkbox, makeReel, fxFrom, brandBug } from './kit.js';
import { SW, SH, PW, buildOldPage, pageToScreen, drawOld, drawSplit, drawCall } from './screens.js';
import { drawSite } from './site.js';

export { W, H, FPS, DURATION };

const TEX = {};
let oldCv, oldCtx, newCv, newCtx, scrCv, scrCtx;
let scrKey = '';
const SCREEN_Y0 = 150; // CHROME in screens.js

// one texture for the phone screen, recomposed when its state changes
function updateScreen(t, st) {
  const key = JSON.stringify(st) + (st.anim ? Math.floor(t * 30) : '');
  if (key === scrKey) return;
  scrKey = key;
  drawOld(oldCtx, t, st.view, { cookie: st.cookie ?? 0, loading: st.loading ?? 0 });
  if (st.split > 0 || st.call > 0) {
    drawSite(newCtx, t, { wire: 1, design: 1, pulse: st.pulse ?? 0 });
    drawSplit(scrCtx, t, st.view, st.split, oldCv, newCv);
    drawCall(scrCtx, st.call ?? 0, 'Ditt Firma AS', st.callT ?? 0);
  } else scrCtx.drawImage(oldCv, 0, 0);
  K.R.updateTexture(TEX.screen, scrCv);
}
// a view centred on page point (cx, cy) at a zoom
function viewAt(zoom, cx, cy) {
  const s = (SW / PW) * zoom;
  const vw = SW / s;
  const vh = (SH - SCREEN_Y0) / s;
  return { zoom, x: clamp(cx - vw / 2, 0, PW - vw), y: Math.max(0, cy - vh / 2) };
}
const VIEW_FIT = { zoom: 1, x: 0, y: 0 };
const mixView = (a, b, e) => ({ zoom: lerp(a.zoom, b.zoom, e), x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) });
// page point → pixel on the frame for the current phone pose
function pagePx(vp, model, view, px, py) {
  const [sx, sy] = pageToScreen(view, px, py);
  return screenPx(vp, model, sx / SW, sy / SH);
}

function fillBg(c, col = BLACK) {
  c.fillStyle = col;
  c.fillRect(-400, -400, W + 800, H + 800);
}
function grid(c, a) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    c.beginPath();
    c.moveTo(x + 0.5, 0);
    c.lineTo(x + 0.5, H);
    c.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    c.beginPath();
    c.moveTo(0, y + 0.5);
    c.lineTo(W, y + 0.5);
    c.stroke();
  }
  c.restore();
}
const LINE = (n) => 340 + n * 86;
const F76 = `700 76px ${SANS}`;
const rise = (c, s, n, col, lt, t0, out = null) => riseText(c, s, 72, LINE(n), F76, col, lt, t0, { size: 76, tracking: -2, out });

// ════════════════════════════════════════════════════════════════════════════
// 01 — HOOK: «Prøv å ringe deg selv fra nettsiden din. På mobil.»
// ════════════════════════════════════════════════════════════════════════════
const V_TEXT = viewAt(2.6, 300, 1000);
const V_NEWS = viewAt(2.6, 360, 1480);
const V_FOOT = viewAt(3.4, 520, 2060);
function hookView(lt) {
  let v = VIEW_FIT;
  v = mixView(v, V_TEXT, E.inOutCubic(prog(lt, HOOK.pinch[0], HOOK.pinch[1])));
  v = mixView(v, V_NEWS, E.inOutCubic(prog(lt, HOOK.scroll[0], HOOK.scroll[1])));
  v = mixView(v, V_FOOT, E.inOutCubic(prog(lt, HOOK.swap + 0.45, HOOK.swap + 0.95)));
  return v;
}
function sceneHook(c, lt, t) {
  fillBg(c);
  grid(c, 1);
  redGlow(c, 540, 1300, 900, 0.16);
  const view = hookView(lt);
  const cookie = prog(lt, HOOK.cookie, HOOK.cookie + 0.35) * (1 - prog(lt, HOOK.swap + 0.15, HOOK.swap + 0.45));
  updateScreen(t, { view, cookie });
  const { model, cam } = phoneShot(540, 1120, 1120, { yaw: -0.08 + 0.04 * Math.sin(t * 0.8), pitch: -0.04 });
  const { vp } = gl3(c, phoneItems(model, screenMat(TEX.screen)), cam, { light: RIG_LIGHT });
  // the hunt: pinch, scroll, a miss, the cookie wall, a miss on its ×
  const mid = screenPx(vp, model, 0.5, 0.55);
  const pin = E.inOutCubic(prog(lt, HOOK.pinch[0], HOOK.pinch[1]));
  const pa = smooth(HOOK.pinch[0] - 0.15, HOOK.pinch[0], lt) * (1 - smooth(HOOK.pinch[1], HOOK.pinch[1] + 0.12, lt));
  touch(c, mid[0] - lerp(30, 170, pin), mid[1] + lerp(30, 170, pin), 0.6, pa);
  touch(c, mid[0] + lerp(30, 170, pin), mid[1] - lerp(30, 170, pin), 0.6, pa);
  const sc = E.inOutCubic(prog(lt, HOOK.scroll[0], HOOK.scroll[1]));
  const sa = smooth(HOOK.scroll[0] - 0.12, HOOK.scroll[0], lt) * (1 - smooth(HOOK.scroll[1], HOOK.scroll[1] + 0.1, lt));
  touch(c, mid[0] + 60, mid[1] + lerp(260, -260, sc), 0.6, sa);
  const miss = screenPx(vp, model, 0.68, 0.42);
  const ma = smooth(HOOK.miss - 0.2, HOOK.miss - 0.08, lt) * (1 - smooth(HOOK.miss + 0.15, HOOK.miss + 0.3, lt));
  touch(c, miss[0], miss[1], lt > HOOK.miss && lt < HOOK.miss + 0.14 ? 1 : 0, ma);
  ripple(c, miss[0], miss[1], prog(lt, HOOK.miss, HOOK.miss + 0.4));
  const x = screenPx(vp, model, 0.9, (1688 - 770) / 1688);
  const xa = smooth(HOOK.closeMiss - 0.25, HOOK.closeMiss - 0.1, lt) * (1 - smooth(HOOK.closeMiss + 0.15, HOOK.closeMiss + 0.3, lt));
  touch(c, x[0] - 40, x[1] + 34, lt > HOOK.closeMiss && lt < HOOK.closeMiss + 0.14 ? 1 : 0, xa);
  ripple(c, x[0] - 40, x[1] + 34, prog(lt, HOOK.closeMiss, HOOK.closeMiss + 0.4));
  // a stopwatch chip: the search is taking forever
  const secs = Math.floor(lt * 4);
  const tl = screenPx(vp, model, 0.98, 0.0);
  const chipA = smooth(0.3, 0.5, lt) * (1 - smooth(HOOK.swap + 0.3, HOOK.swap + 0.5, lt));
  if (chipA > 0) {
    c.save();
    c.globalAlpha = chipA;
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(tl[0] - 196, tl[1] - 70, 196, 56, 28);
    c.fill();
    mono(c, `⏱ 0:${String(secs).padStart(2, '0')}`, tl[0] - 98, tl[1] - 32, 26, WHITE, 1, 'center', 600);
    c.restore();
  }
  // payoff: there it was — tiny, at the very bottom
  const ha = smooth(HOOK.swap + 0.95, HOOK.swap + 1.1, lt);
  if (ha > 0) {
    const a = pagePx(vp, model, view, 420, 2112);
    const b = pagePx(vp, model, view, 548, 2136);
    c.save();
    c.globalAlpha = ha;
    c.strokeStyle = RED;
    c.lineWidth = 6;
    c.shadowColor = 'rgba(255,30,60,0.8)';
    c.shadowBlur = 24;
    c.beginPath();
    c.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (b[0] - a[0]) / 2 + 26, (b[1] - a[1]) / 2 + 22, -0.04, 0, TAU);
    c.stroke();
    c.restore();
  }
  // copy: line 1–2 are set at frame 0 (the thumbnail must read)
  rise(c, 'Prøv å ringe deg selv', 0, WHITE, lt, -0.9, HOOK.swap);
  rise(c, 'fra nettsiden din.', 1, WHITE, lt, -0.85, HOOK.swap + 0.03);
  rise(c, 'På mobil.', 2, RED, lt, HOOK.mobil, HOOK.swap + 0.06);
  rise(c, 'Fant du', 0, WHITE, lt, HOOK.swap + 0.12);
  rise(c, 'nummeret?', 1, RED, lt, HOOK.swap + 0.22);
}

// ════════════════════════════════════════════════════════════════════════════
// 02 — STAT: «Over halvparten av trafikken i Norge er mobil.»
// ════════════════════════════════════════════════════════════════════════════
function sceneStat(c, lt) {
  fillBg(c);
  grid(c, 1);
  redGlow(c, 540, 700, 800, 0.2 * Math.exp(-lt * 1.5) + 0.07);
  const pop = lerp(1.3, 1, E.outExpo(prog(lt, STAT.big, STAT.big + 0.3)));
  c.save();
  c.translate(540, 470);
  c.scale(pop, pop);
  c.globalAlpha = E.outCubic(prog(lt, STAT.big, STAT.big + 0.15));
  text(c, 'Over halvparten', 0, 0, `400 150px ${COND}`, RED, 1, 'center');
  c.restore();
  riseText(c, 'av trafikken i Norge', 540, 580, `700 64px ${SANS}`, WHITE, lt, STAT.line, { align: 'center', size: 64, tracking: -1 });
  riseText(c, 'er mobil.', 540, 656, `700 64px ${SANS}`, WHITE, lt, STAT.line + 0.12, { align: 'center', size: 64, tracking: -1 });
  const bars = [
    ['MOBIL', 51.5, RED],
    ['DESKTOP', 46.5, 'rgba(255,255,255,0.35)'],
  ];
  bars.forEach(([lab, v, col], i) => {
    const y = 790 + i * 130;
    const p = E.outExpo(prog(lt, STAT.bars + i * 0.12, STAT.bars + i * 0.12 + 0.8));
    mono(c, lab, 80, y - 14, 24, WHITE, 0.8 * clamp(p * 3), 'left', 600);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(80, y, 920, 56);
    c.fillStyle = col;
    c.fillRect(80, y, 920 * (v / 60) * p, 56);
    mono(c, `${(v * p).toFixed(1).replace('.', ',')} %`, 80 + 920 * (v / 60) * p - 14, y + 40, 28, i ? BLACK : WHITE, clamp(p * 3), 'right', 600);
  });
  mono(c, typed('KILDE: STATCOUNTER, NORGE, SEPT. 2026', prog(lt, STAT.src, STAT.src + 0.5)), 540, 1100, 20, WHITE, 0.55, 'center', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 03 — SCAN: the free website check
// ════════════════════════════════════════════════════════════════════════════
const FINDINGS = [
  { px: 300, py: 1000, label: 'Tekst for liten', side: -1 },
  { px: 1150, py: 128, label: 'Ingen ring-knapp', side: 1 },
  { px: 650, py: 470, label: 'Treg å laste', side: -1 },
];
const BLURRED = [
  { px: 1050, py: 1500, side: 1 },
  { px: 250, py: 1450, side: -1 },
];
function pinAt(c, x, y, p, n, col = RED) {
  if (p <= 0) return;
  const drop = E.outBack(clamp(p), 2.2);
  const yy = y - (1 - Math.min(1, p * 1.3)) * 120;
  c.save();
  c.translate(x, yy);
  c.scale(drop, drop);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(0, 4, 18, 6, 0, 0, TAU);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-30, -40, -30, -80, 0, -80);
  c.bezierCurveTo(30, -80, 30, -40, 0, 0);
  c.fill();
  c.fillStyle = WHITE;
  c.beginPath();
  c.arc(0, -55, 16, 0, TAU);
  c.fill();
  c.font = `700 22px ${SANS}`;
  c.fillStyle = col;
  c.textAlign = 'center';
  c.fillText(String(n), 0, -47);
  c.textAlign = 'left';
  c.restore();
}
function card(c, x, y, side, label, a, blur = false) {
  if (a <= 0) return;
  const font = `700 40px ${SANS}`;
  const w = blur ? 300 : layout(c, label, font).width + 64;
  const cx = clamp(side < 0 ? x - w - 40 : x + 40, 50, W - 50 - w);
  const cy = y - 112;
  c.save();
  c.globalAlpha *= clamp(a);
  c.translate(0, (1 - E.outCubic(clamp(a))) * 24);
  c.shadowColor = 'rgba(0,0,0,0.5)';
  c.shadowBlur = 30;
  c.fillStyle = WHITE;
  c.beginPath();
  c.roundRect(cx, cy, w, 80, 18);
  c.fill();
  c.shadowBlur = 0;
  if (blur) {
    c.filter = 'blur(7px)';
    c.fillStyle = '#222';
    c.fillRect(cx + 28, cy + 26, w - 60, 28);
    c.filter = 'none';
  } else text(c, label, cx + 32, cy + 54, font, BLACK);
  c.restore();
}
function scanView() {
  return VIEW_FIT;
}
function sceneScan(c, lt, t) {
  fillBg(c);
  grid(c, 1);
  redGlow(c, 540, 1250, 900, 0.18);
  const view = scanView();
  const mail = SCAN.mail;
  const loading = smooth(SCAN.pins[2] - 0.2, SCAN.pins[2], lt) * (1 - smooth(mail, mail + 0.3, lt));
  updateScreen(t, { view, loading, anim: loading > 0 });
  const enter = E.outExpo(prog(lt, 0, 0.6));
  const { model, cam } = phoneShot(540, lerp(1700, 1150, enter), 1080, { yaw: -0.06 + 0.04 * Math.sin(t * 0.7) - (1 - enter) * 0.5, pitch: -0.04 });
  const { vp } = gl3(c, phoneItems(model, screenMat(TEX.screen)), cam, { light: RIG_LIGHT });
  // «EKSEMPEL» — this is a made-up site, not the viewer's
  const tag = screenPx(vp, model, 0.03, 0.0);
  c.save();
  c.globalAlpha = smooth(0.3, 0.5, lt) * (1 - smooth(mail + 1.2, mail + 1.5, lt));
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.beginPath();
  c.roundRect(tag[0], tag[1] - 64, 196, 50, 25);
  c.fill();
  mono(c, 'EKSEMPEL', tag[0] + 98, tag[1] - 30, 22, BLACK, 1, 'center', 600);
  c.restore();
  // the scan line
  const sw = prog(lt, SCAN.sweep[0], SCAN.sweep[1]);
  if (sw > 0 && sw < 1) {
    const v = E.inOutSine(sw);
    const a = screenPx(vp, model, 0, v);
    const b = screenPx(vp, model, 1, v);
    c.save();
    c.strokeStyle = RED;
    c.lineWidth = 6;
    c.shadowColor = 'rgba(255,30,60,1)';
    c.shadowBlur = 40;
    c.beginPath();
    c.moveTo(a[0] - 30, a[1]);
    c.lineTo(b[0] + 30, b[1]);
    c.stroke();
    c.restore();
  }
  // findings
  const gather = E.inCubic(prog(lt, mail + 0.05, mail + 0.45));
  const env = [540, 1050];
  FINDINGS.forEach((f, i) => {
    const p = prog(lt, SCAN.pins[i], SCAN.pins[i] + 0.35);
    let [x, y] = pagePx(vp, model, view, f.px, f.py);
    x = lerp(x, env[0], gather);
    y = lerp(y, env[1], gather);
    const a = 1 - gather;
    c.save();
    c.globalAlpha = a;
    pinAt(c, x, y, p, i + 1);
    card(c, x, y, f.side, f.label, prog(lt, SCAN.pins[i] + 0.12, SCAN.pins[i] + 0.4));
    c.restore();
  });
  BLURRED.forEach((f, i) => {
    const p = prog(lt, SCAN.blur + i * 0.12, SCAN.blur + i * 0.12 + 0.35);
    let [x, y] = pagePx(vp, model, view, f.px, f.py);
    x = lerp(x, env[0], gather);
    y = lerp(y, env[1], gather);
    c.save();
    c.globalAlpha = 1 - gather;
    pinAt(c, x, y, p, 4 + i, '#888');
    card(c, x, y, f.side, '', prog(lt, SCAN.blur + i * 0.12 + 0.1, SCAN.blur + i * 0.12 + 0.4), true);
    c.restore();
  });
  const plus = E.outBack(prog(lt, SCAN.blur + 0.35, SCAN.blur + 0.6), 2) * (1 - gather);
  if (plus > 0) {
    c.save();
    c.translate(540, 1255);
    c.scale(plus, plus);
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(-150, -42, 300, 84, 42);
    c.fill();
    text(c, '+2 til …', 0, 15, `700 40px ${SANS}`, WHITE, 1, 'center');
    c.restore();
  }
  // the envelope: the findings go by e-mail
  const ep = E.outBack(prog(lt, mail, mail + 0.3), 2);
  const fly = E.inExpo(prog(lt, mail + 1.0, mail + 1.5));
  if (ep > 0 && fly < 1) {
    const flap = E.inOutCubic(prog(lt, mail + 0.5, mail + 0.75));
    c.save();
    c.translate(lerp(env[0], 1300, fly), lerp(env[1], 300, fly));
    c.rotate(fly * 0.4);
    c.scale(ep * (1 - fly * 0.5), ep * (1 - fly * 0.5));
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 40;
    c.fillStyle = WHITE;
    c.beginPath();
    c.roundRect(-190, -120, 380, 240, 18);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#D0D4DA';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-190, 120);
    c.lineTo(0, 10);
    c.lineTo(190, 120);
    c.stroke();
    c.fillStyle = flap > 0.5 ? '#F1F3F5' : WHITE;
    c.beginPath();
    c.moveTo(-190, -120);
    c.lineTo(0, lerp(-300, 20, flap));
    c.lineTo(190, -120);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = RED;
    c.beginPath();
    c.arc(0, 10, 34, 0, TAU);
    c.fill();
    text(c, '5', 0, 26, `700 44px ${SANS}`, WHITE, 1, 'center');
    c.restore();
  }
  rise(c, 'Vi sjekker nettsiden din.', 0, WHITE, lt, SCAN.t1, SCAN.t2 - 0.3);
  rise(c, 'Gratis.', 1, RED, lt, SCAN.t1 + 0.15, SCAN.t2 - 0.27);
  rise(c, '3–5 konkrete', 0, WHITE, lt, SCAN.t2, SCAN.t3 - 0.3);
  rise(c, 'forbedringspunkter.', 1, RED, lt, SCAN.t2 + 0.12, SCAN.t3 - 0.27);
  rise(c, 'Rett på e-post.', 0, WHITE, lt, SCAN.t3);
  rise(c, 'Ingen møte.', 1, RED, lt, SCAN.t3 + 0.12);
}

// ════════════════════════════════════════════════════════════════════════════
// 04 — AFTER: before/after, then one tap calls
// ════════════════════════════════════════════════════════════════════════════
function sceneAfter(c, lt, t) {
  fillBg(c);
  grid(c, 1);
  redGlow(c, 540, 1150, 950, 0.24 + 0.3 * Math.exp(-lt * 2));
  const split = E.inOutCubic(prog(lt, AFTER.wipe[0], AFTER.wipe[1]));
  const pulse = lt > AFTER.wipe[1] ? ((lt - AFTER.wipe[1]) % 1.2) / 1.2 : 0;
  updateScreen(t, { view: VIEW_FIT, split: Math.max(0.0001, split), pulse: +pulse.toFixed(3), call: +prog(lt, AFTER.call, AFTER.call + 0.35).toFixed(3), callT: +Math.max(0, lt - AFTER.call).toFixed(2) });
  const { model, cam } = phoneShot(540, 1150, 1080, { yaw: 0.05 * Math.sin(t * 0.7) - 0.04, pitch: -0.04 });
  const { vp } = gl3(c, phoneItems(model, screenMat(TEX.screen)), cam, { light: { ...RIG_LIGHT, envKick: [2.2 + 2.5 * Math.exp(-lt * 2), 0.04, 0.1] } });
  // the thumb drags the divider, then taps «Ring nå»
  const hx = screenPx(vp, model, split, 0.52);
  const da = smooth(AFTER.wipe[0] - 0.15, AFTER.wipe[0], lt) * (1 - smooth(AFTER.wipe[1], AFTER.wipe[1] + 0.15, lt));
  touch(c, hx[0], hx[1], 0.6, da);
  const ring = screenPx(vp, model, 0.5, 562 / SH);
  const ta = smooth(AFTER.tap - 0.6, AFTER.tap - 0.45, lt) * (1 - smooth(AFTER.call + 0.05, AFTER.call + 0.2, lt));
  const mv = E.inOutCubic(prog(lt, AFTER.tap - 0.6, AFTER.tap - 0.05));
  touch(c, lerp(860, ring[0], mv), lerp(1500, ring[1], mv), lt > AFTER.tap && lt < AFTER.tap + 0.14 ? 1 : 0, ta);
  ripple(c, ring[0], ring[1], prog(lt, AFTER.tap, AFTER.tap + 0.45));
  rise(c, 'Etter: ring med', 0, WHITE, lt, AFTER.t1, AFTER.t2 - 0.3);
  rise(c, 'ett trykk.', 1, RED, lt, AFTER.t1 + 0.12, AFTER.t2 - 0.27);
  rise(c, 'Nå når kundene', 0, WHITE, lt, AFTER.t2);
  rise(c, 'deg.', 1, RED, lt, AFTER.t2 + 0.12);
}

// ════════════════════════════════════════════════════════════════════════════
// 05 — PRICE
// ════════════════════════════════════════════════════════════════════════════
const CHECKS = ['Adminpanel inkludert', 'Hosting og drift', 'Normalt ferdig på 2–4 uker'];
function scenePrice(c, lt, t) {
  fillBg(c);
  grid(c, 1);
  redGlow(c, 820, 1300, 700, 0.25);
  const enter = E.outExpo(prog(lt, 0.1, 0.8));
  const { model, cam } = phoneShot(830, lerp(2100, 1340, enter), 640, { yaw: -0.45 + 0.12 * Math.sin(t * 0.8), pitch: -0.05, roll: 0.06 });
  gl3(c, phoneItems(model, screenMat(TEX.newSite)), cam, { light: RIG_LIGHT });
  mono(c, typed('NY NETTSIDE ETTERPÅ?', prog(lt, PRICE.q, PRICE.q + 0.35)), 76, 330, 30, WHITE, 0.9, 'left', 600);
  const pp = E.outExpo(prog(lt, PRICE.price, PRICE.price + 0.4));
  if (pp > 0) {
    c.save();
    c.translate(72, 590);
    const s = lerp(1.25, 1, pp);
    c.scale(s, s);
    c.globalAlpha = clamp(pp * 2);
    mono(c, 'FRA', 6, -212, 30, WHITE, 0.85, 'left', 600);
    text(c, '7 500 kr', 0, 0, `400 240px ${COND}`, WHITE);
    c.restore();
  }
  riseText(c, '+ 500 kr/mnd', 76, 680, `700 66px ${SANS}`, RED, lt, PRICE.monthly, { size: 66, tracking: -1 });
  CHECKS.forEach((s, i) => {
    const st = PRICE.checks[i];
    const p = E.outExpo(prog(lt, st, st + 0.3));
    if (p <= 0) return;
    const y = 750 + i * 72;
    checkbox(c, 78, y, prog(lt, st, st + 0.2), prog(lt, st + 0.06, st + 0.2));
    c.save();
    c.beginPath();
    c.rect(140, y - 20, 900, 80);
    c.clip();
    text(c, s, 150 - (1 - p) * 50, y + 39, `500 44px ${SANS}`, WHITE, p);
    c.restore();
  });
  mono(c, typed('INGEN MVA I TILLEGG', prog(lt, PRICE.vat, PRICE.vat + 0.3)), 80, 1000, 20, WHITE, 0.75, 'left', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 06 — CTA
// ════════════════════════════════════════════════════════════════════════════
function sceneCta(c, lt) {
  fillBg(c);
  grid(c, 0.6);
  redGlow(c, 540, 820, 900, 0.16);
  const k = 3.4;
  drawLockup(c, 540 - 113 * k, 330, k, lt - CTA.lockup);
  const bp = E.outBack(prog(lt, CTA.button, CTA.button + 0.3), 2.2);
  const tap = lt - CTA.tap;
  const press = tap > 0 ? 1 - 0.06 * Math.exp(-tap * 12) * Math.cos(tap * 18) : 1;
  const by = 800;
  const bw = 860;
  const bh = 132;
  if (bp > 0) {
    c.save();
    c.translate(540, by);
    c.scale(bp * press, bp * press);
    c.shadowColor = 'rgba(255,30,60,0.55)';
    c.shadowBlur = 60;
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    c.fill();
    c.shadowBlur = 0;
    text(c, 'Sjekk nettsiden gratis  →', 0, 17, `700 52px ${SANS}`, WHITE, 1, 'center');
    c.restore();
    const ta = smooth(CTA.tap - 0.5, CTA.tap - 0.35, lt) * (1 - smooth(CTA.tap + 0.3, CTA.tap + 0.5, lt));
    const mv = E.inOutCubic(prog(lt, CTA.tap - 0.5, CTA.tap - 0.05));
    touch(c, lerp(900, 700, mv), lerp(1300, by + 10, mv), tap > 0 && tap < 0.14 ? 1 : 0, ta);
    ripple(c, 700, by + 10, prog(lt, CTA.tap, CTA.tap + 0.45));
  }
  riseText(c, 'Send adressen. Få svar på e-post.', 540, 950, `500 44px ${SANS}`, WHITE, lt, CTA.lines, { align: 'center', size: 44, alpha: 0.85, stagger: 0.01 });
  riseText(c, 'seventhseal.no', 540, 1060, `600 54px ${MONO}`, WHITE, lt, CTA.lines + 0.2, { align: 'center', size: 54 });
  const ul = E.outExpo(prog(lt, CTA.lines + 0.4, CTA.lines + 0.85));
  if (ul > 0) {
    const Lw = layout(c, 'seventhseal.no', `600 54px ${MONO}`).width;
    c.fillStyle = RED;
    c.fillRect(540 - Lw / 2, 1084, Lw * ul, 6);
  }
}

const reel = makeReel({
  W,
  H,
  FPS,
  DURATION,
  SCENES,
  CUTS,
  HITS,
  fns: { hook: sceneHook, stat: sceneStat, scan: sceneScan, after: sceneAfter, price: scenePrice, cta: sceneCta },
  maxSub: { hook: 5, scan: 5, after: 5, price: 5 },
  hud: (c, t, sc) => {
    if (sc.id !== 'cta') brandBug(c, 1);
  },
  fx: (t, f, sc) => fxFrom(HITS, t, f, { bloom: sc.id === 'stat' ? 0.2 : 0.15, flash: t >= S.after.start ? 0.25 * Math.exp(-(t - S.after.start) * 16) : 0 }),
  setup: async () => {
    buildOldPage(mk);
    oldCv = mk(SW, SH);
    oldCtx = oldCv.getContext('2d');
    newCv = mk(SW, SH);
    newCtx = newCv.getContext('2d');
    scrCv = mk(SW, SH);
    scrCtx = scrCv.getContext('2d');
    drawOld(oldCtx, 0, VIEW_FIT, {});
    scrCtx.drawImage(oldCv, 0, 0);
    TEX.screen = K.R.texture(scrCv);
    drawSite(newCtx, 0, { wire: 1, design: 1, pulse: 0 });
    TEX.newSite = K.R.texture(newCv);
  },
});
export const init = reel.init;
export const renderFrame = reel.renderFrame;
export const totalFrames = reel.totalFrames;
