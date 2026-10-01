// «KUNDEN GOOGLET DEG» — a vertical ad for Seventh Seal (seventhseal.no),
// aimed at businesses with no website. A customer searches, finds you without
// a website and calls the competitor; Seventh Seal makes a free first draft;
// the same search ends with the call coming to you.

import { W, H, FPS, BEAT, DURATION, SCENES, S, HITS, CUTS, HOOK, STAT, BUILD, PRICE, REVEAL, CTA } from './timeline.js';
import * as G from './gl3d.js';
import { RED, DRED, BLACK, WHITE, SANS, MONO, COND, TAU, clamp, lerp, prog, smooth, E, spring, hash, noise1, mk, text, mono, typed, riseText, layout } from './lib.js';
import { K, PH, screenMat, phoneItems, screenPx, gl3, RIG_LIGHT, phoneShot, drawLockup, markSmall, touch, ripple, redGlow, checkbox, makeReel, fxFrom, brandBug } from './kit.js';
import { SW, SH, drawSearch, drawSite } from './screens.js';

export { W, H, FPS, DURATION };

const TEX = {};
let searchCv, searchCtx, siteCv, siteCtx;
let searchKey = '';
let siteKey = '';
const QUERY = 'rørlegger oslo';

function updateSearch(t, st) {
  const key = JSON.stringify([st.query, st.caret ? Math.floor(t * 3) % 2 : 0, st.results.toFixed(3), st.flag.toFixed(3), st.mine, st.call.toFixed(3), st.callName, Math.floor((st.callT || 0) * 3)]);
  if (key === searchKey) return;
  searchKey = key;
  drawSearch(searchCtx, t, st);
  K.R.updateTexture(TEX.search, searchCv);
}
function updateSite(t, b) {
  const key = `${b.wire.toFixed(3)}|${b.design.toFixed(3)}|${b.pulse.toFixed(3)}`;
  if (key === siteKey) return;
  siteKey = key;
  drawSite(siteCtx, t, b);
  K.R.updateTexture(TEX.site, siteCv);
}

// two-line headline at the top of the safe area
function headline(c, l1, l2, lt, t0, out, o = {}) {
  const size = o.size ?? 84;
  const font = `700 ${size}px ${SANS}`;
  riseText(c, l1, 72, 340, font, o.c1 ?? WHITE, lt, t0, { size, tracking: -2, out });
  if (l2) riseText(c, l2, 72, 340 + size * 1.1, font, o.c2 ?? RED, lt, t0 + 0.12, { size, tracking: -2, out: out === null ? null : out + 0.04 });
}

// ════════════════════════════════════════════════════════════════════════════
// 01 — HOOK: «Kunden googlet deg. Hva fant de?» → «Da ringer de neste.»
// ════════════════════════════════════════════════════════════════════════════
function sceneHook(c, lt, t) {
  fillBg(c);
  redGlow(c, 540, 1300, 900, 0.18 + 0.12 * smooth(HOOK.flag, HOOK.flag + 0.3, lt));
  const q = typed(QUERY, lerp(9 / QUERY.length, 1, prog(lt, 0.05, HOOK.typed)));
  const st = {
    query: q,
    caret: lt < HOOK.results,
    results: prog(lt, HOOK.results, HOOK.results + 0.6),
    flag: lt >= HOOK.flag ? lt - HOOK.flag : 0,
    mine: 0,
    call: prog(lt, HOOK.call, HOOK.call + 0.35),
    callName: 'Konkurrenten AS',
    callT: lt - HOOK.call,
  };
  updateSearch(t, st);
  const push = E.inOutCubic(prog(lt, HOOK.flag - 0.1, HOOK.flag + 0.5));
  const { model, cam } = phoneShot(540, lerp(1045, 1075, push), lerp(1150, 1260, push), {
    yaw: -0.1 + 0.05 * Math.sin(t * 0.8) + push * 0.06,
    pitch: -0.04,
    roll: 0.01 * Math.sin(t * 0.6),
  });
  const { vp } = gl3(c, phoneItems(model, screenMat(TEX.search)), cam, { light: RIG_LIGHT });
  // red highlight around your card when the flag lands
  if (lt > HOOK.flag && lt < HOOK.swap + 0.3) {
    const a = smooth(HOOK.flag, HOOK.flag + 0.15, lt) * (1 - smooth(HOOK.swap, HOOK.swap + 0.3, lt));
    const pts = [
      [28 / SW, 650 / SH],
      [752 / SW, 650 / SH],
      [752 / SW, 950 / SH],
      [28 / SW, 950 / SH],
    ].map(([u, v]) => screenPx(vp, model, u, v));
    const grow = 1 + 0.04 * Math.exp(-(lt - HOOK.flag) * 6);
    const cx = (pts[0][0] + pts[2][0]) / 2;
    const cy = (pts[0][1] + pts[2][1]) / 2;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = RED;
    c.lineWidth = 6;
    c.shadowColor = 'rgba(255,30,60,0.8)';
    c.shadowBlur = 30;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(cx + (x - cx) * grow, cy + (y - cy) * grow) : c.moveTo(cx + (x - cx) * grow, cy + (y - cy) * grow)));
    c.closePath();
    c.stroke();
    c.restore();
  }
  // the customer's thumb goes to the competitor's «Ring»
  const ring = screenPx(vp, model, 319 / SW, (330 + 244) / SH);
  const ta = smooth(HOOK.swap + 0.05, HOOK.swap + 0.2, lt) * (1 - smooth(HOOK.call + 0.05, HOOK.call + 0.2, lt));
  const mv = E.inOutCubic(prog(lt, HOOK.swap + 0.05, HOOK.tap - 0.05));
  const press = lt > HOOK.tap && lt < HOOK.tap + 0.14 ? 1 : 0;
  touch(c, lerp(820, ring[0], mv), lerp(1500, ring[1], mv), press, ta);
  ripple(c, ring[0], ring[1], prog(lt, HOOK.tap, HOOK.tap + 0.45));

  // line 1 is fully set at frame 0 (the thumbnail must read); line 2 lands after
  riseText(c, 'Kunden googlet deg.', 72, 340, `700 84px ${SANS}`, WHITE, lt, -0.9, { size: 84, tracking: -2, out: HOOK.swap });
  riseText(c, 'Hva fant de?', 72, 432, `700 84px ${SANS}`, RED, lt, 0.6, { size: 84, tracking: -2, out: HOOK.swap + 0.04 });
  headline(c, 'Da ringer de', 'neste.', lt, HOOK.swap + 0.12, null);
}

// ════════════════════════════════════════════════════════════════════════════
// 02 — STAT: «7 av 10 sjekker håndverkeren før de bestemmer seg»
// ════════════════════════════════════════════════════════════════════════════
function person(c, x, y, s, col) {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y - 30 * s, 22 * s, 0, TAU);
  c.fill();
  c.beginPath();
  c.roundRect(x - 34 * s, y, 68 * s, 56 * s, [30 * s, 30 * s, 8 * s, 8 * s]);
  c.fill();
}
function sceneStat(c, lt) {
  fillBg(c);
  redGlow(c, 540, 560, 700, 0.22 * Math.exp(-lt * 1.5) + 0.08);
  const pop = lerp(1.35, 1, E.outExpo(prog(lt, STAT.num, STAT.num + 0.3)));
  c.save();
  c.translate(540, 650);
  c.scale(pop, pop);
  c.globalAlpha = E.outCubic(prog(lt, STAT.num, STAT.num + 0.15));
  text(c, '7 av 10', 0, 0, `400 300px ${COND}`, RED, 1, 'center');
  c.restore();
  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const x = 540 + (col - 2) * 150;
    const y = 780 + row * 150;
    const a = E.outBack(prog(lt, STAT.icons + i * 0.04, STAT.icons + i * 0.04 + 0.3), 2);
    if (a <= 0) continue;
    const lit = i < 7 ? smooth(STAT.icons + 0.5 + i * 0.09, STAT.icons + 0.6 + i * 0.09, lt) : 0;
    c.save();
    c.translate(x, y);
    c.scale(a, a);
    person(c, 0, 0, 1, lit > 0.5 ? RED : 'rgba(255,255,255,0.22)');
    c.restore();
  }
  riseText(c, 'sjekker håndverkeren', 540, 1110, `700 62px ${SANS}`, WHITE, lt, STAT.line, { align: 'center', size: 62, tracking: -1 });
  riseText(c, 'før de bestemmer seg.', 540, 1182, `700 62px ${SANS}`, WHITE, lt, STAT.line + 0.12, { align: 'center', size: 62, tracking: -1 });
  mono(c, typed('KILDE: FORBRUKERRÅDET, HÅNDVERKERRAPPORT 2024', prog(lt, STAT.src, STAT.src + 0.5)), 540, 1238, 19, WHITE, 0.55, 'center', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 03 — BUILD: «Det fikser vi.» «Vi lager et førsteutkast.» «Du ser det først. Så bestemmer du.»
// ════════════════════════════════════════════════════════════════════════════
function sceneBuild(c, lt, t) {
  fillBg(c);
  // the brand sting
  if (lt < BUILD.phone + 0.3) {
    const out = E.inExpo(prog(lt, BUILD.phone - 0.15, BUILD.phone + 0.2));
    c.save();
    c.globalAlpha = 1 - out;
    const k = 3.4;
    drawLockup(c, 540 - 113 * k, 820 - 41 * k - out * 200, k, lt + 0.05);
    riseText(c, 'Det fikser vi.', 540, 1150, `700 92px ${SANS}`, WHITE, lt, 0.25, { align: 'center', size: 92, tracking: -2 });
    c.restore();
  }
  const fly = E.outExpo(prog(lt, BUILD.phone, BUILD.phone + 0.7));
  if (fly <= 0) return;
  redGlow(c, 540, 1150, 850, 0.22);
  const wire = prog(lt, BUILD.wire, BUILD.design - 0.1);
  const design = prog(lt, BUILD.design, BUILD.design + 1.6);
  const pulse = lt > BUILD.ring ? ((lt - BUILD.ring) % 1.5) / 1.5 : 0;
  updateSite(t, { wire, design, pulse });
  const swing = Math.sin((lt - BUILD.phone) * 0.9) * 0.16;
  const { model, cam } = phoneShot(540, lerp(2400, 1080, fly), 1150, { yaw: swing - (1 - fly) * 0.8, pitch: -0.04, roll: (1 - fly) * 0.2 });
  const { vp } = gl3(c, phoneItems(model, screenMat(TEX.site)), cam, { light: RIG_LIGHT });
  // the draft's progress chip
  const pct = Math.round(100 * clamp(wire * 0.55 + design * 0.45));
  const ca = smooth(BUILD.wire, BUILD.wire + 0.2, lt) * (1 - smooth(BUILD.design + 2.0, BUILD.design + 2.4, lt));
  if (ca > 0) {
    const tl = screenPx(vp, model, 0.62, 0.03);
    c.save();
    c.globalAlpha = ca;
    c.fillStyle = 'rgba(10,10,10,0.92)';
    c.beginPath();
    c.roundRect(tl[0] - 20, tl[1] - 66, 300, 58, 29);
    c.fill();
    c.strokeStyle = RED;
    c.lineWidth = 2;
    c.stroke();
    mono(c, pct >= 100 ? 'UTKAST · KLART' : `UTKAST · ${pct} %`, tl[0] + 6, tl[1] - 27, 22, WHITE, 1, 'left', 600);
    c.fillStyle = RED;
    c.fillRect(tl[0] + 6, tl[1] - 18, 248 * clamp(pct / 100), 4);
    c.restore();
  }
  // a ripple on «Ring nå» as it starts to pulse
  if (pulse > 0) {
    const r = screenPx(vp, model, 0.5, 562 / SH);
    ripple(c, r[0], r[1], pulse * 1.5, RED, 60, 260);
  }
  headline(c, 'Vi lager et', 'førsteutkast.', lt, BUILD.t1, BUILD.t2 - 0.3);
  headline(c, 'Du ser det først.', 'Så bestemmer du.', lt, BUILD.t2, null);
}

// ════════════════════════════════════════════════════════════════════════════
// 04 — PRICE: anchor → «Fra 7 500 kr + 500 kr/mnd» and what's included
// ════════════════════════════════════════════════════════════════════════════
const CHECKS = ['Adminpanel inkludert', 'Hosting og drift', '3 revisjonsrunder', 'Normalt ferdig på 2–4 uker'];
function scenePrice(c, lt) {
  fillBg(c, RED);
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-Math.PI / 4);
  c.fillStyle = DRED;
  c.globalAlpha = 0.3;
  const sp = lt * 150;
  for (let x = -2000; x < 2000; x += 130) c.fillRect(x + (sp % 130), -2000, 44, 4000);
  c.restore();
  // the anchor
  mono(c, typed('TYPISK PRIS FOR EN', prog(lt, PRICE.anchor, PRICE.anchor + 0.3)), 76, 330, 26, WHITE, 0.9, 'left', 600);
  mono(c, typed('SKREDDERSYDD NETTSIDE:', prog(lt, PRICE.anchor + 0.2, PRICE.anchor + 0.5)), 76, 366, 26, WHITE, 0.9, 'left', 600);
  const af = `400 128px ${COND}`;
  riseText(c, '17 000–50 000 kr', 72, 508, af, 'rgba(10,10,10,0.82)', lt, PRICE.anchor + 0.35, { size: 128, stagger: 0.02 });
  const sk = E.outExpo(prog(lt, PRICE.strike, PRICE.strike + 0.25));
  if (sk > 0) {
    const Lw = layout(c, '17 000–50 000 kr', af).width;
    c.strokeStyle = WHITE;
    c.lineWidth = 12;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(66, 470);
    c.lineTo(66 + (Lw + 12) * sk, 452);
    c.stroke();
    c.lineCap = 'butt';
  }
  // ours
  mono(c, 'HOS OSS: FRA', 76, 600, 30, WHITE, E.outCubic(prog(lt, PRICE.price - 0.15, PRICE.price + 0.1)), 'left', 600);
  const pp = E.outExpo(prog(lt, PRICE.price, PRICE.price + 0.4));
  if (pp > 0) {
    c.save();
    c.translate(72, 830);
    const s = lerp(1.25, 1, pp);
    c.scale(s, s);
    c.globalAlpha = clamp(pp * 2);
    text(c, '7 500 kr', 0, 0, `400 250px ${COND}`, WHITE);
    c.restore();
  }
  riseText(c, '+ 500 kr/mnd', 76, 912, `700 66px ${SANS}`, BLACK, lt, PRICE.monthly, { size: 66, tracking: -1 });
  CHECKS.forEach((s, i) => {
    const st = PRICE.checks[i];
    const p = E.outExpo(prog(lt, st, st + 0.3));
    if (p <= 0) return;
    const y = 978 + i * 66;
    checkbox(c, 78, y, prog(lt, st, st + 0.2), prog(lt, st + 0.06, st + 0.2));
    c.save();
    c.beginPath();
    c.rect(140, y - 20, 900, 80);
    c.clip();
    text(c, s, 150 - (1 - p) * 50, y + 39, `500 44px ${SANS}`, WHITE, p);
    c.restore();
  });
  mono(c, typed('INGEN MVA I TILLEGG', prog(lt, PRICE.vat, PRICE.vat + 0.3)), 80, 1250, 20, WHITE, 0.8, 'left', 600);
}

// ════════════════════════════════════════════════════════════════════════════
// 05 — REVEAL: «Liker du ikke utkastet? Da koster det 0 kr.» → «Nå ringer de deg.»
// ════════════════════════════════════════════════════════════════════════════
const SPARKS = Array.from({ length: 90 }, (_, i) => ({ a: hash(i * 3) * TAU, v: 500 + hash(i * 7) * 1300, s: 3 + hash(i * 11) * 6, red: hash(i * 13) < 0.6 }));
function sceneReveal(c, lt, t) {
  fillBg(c);
  redGlow(c, 540, 1080, 950, 0.3 + 0.4 * Math.exp(-lt * 2));
  const onSearch = lt >= REVEAL.search;
  if (onSearch) {
    updateSearch(t, {
      query: QUERY,
      caret: false,
      results: 1,
      flag: 0,
      mine: 1,
      call: prog(lt, REVEAL.call, REVEAL.call + 0.35),
      callName: 'Ditt Firma AS',
      callMine: true,
      callT: lt - REVEAL.call,
    });
  } else updateSite(t, { wire: 1, design: 1, pulse: ((lt % 1.5) / 1.5) * smooth(0.8, 1.2, lt) });
  const spin = E.outExpo(prog(lt, REVEAL.spin, REVEAL.spin + 1.1));
  const sw = E.inOutCubic(prog(lt, REVEAL.search - 0.25, REVEAL.search + 0.25));
  const yaw = (1 - spin) * TAU * 1.0 + 0.12 * Math.sin(t * 0.7) + Math.sin(Math.PI * sw) * 0.9 * (lt < REVEAL.search ? 1 : -1);
  const { model, cam } = phoneShot(540, 1080, lerp(700, 1150, spin), { yaw, pitch: -0.04 });
  const tex = onSearch ? TEX.search : TEX.site;
  const { vp } = gl3(c, phoneItems(model, screenMat(tex)), cam, { light: { ...RIG_LIGHT, envKick: [2.2 + 3 * Math.exp(-lt * 2), 0.04, 0.1] } });
  // sparks on the reveal
  if (lt < 1.2) {
    for (const s of SPARKS) {
      const d = s.v * lt * (1 - lt * 0.35);
      const x = 540 + Math.cos(s.a) * d;
      const y = 1080 + Math.sin(s.a) * d * 0.9;
      c.globalAlpha = clamp(1 - lt / 1.2);
      c.fillStyle = s.red ? RED : WHITE;
      c.beginPath();
      c.arc(x, y, s.s * (1 - lt / 1.4), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // you get the call
  if (onSearch) {
    const ring = screenPx(vp, model, 319 / SW, (650 + 244) / SH);
    const ta = smooth(REVEAL.search + 0.3, REVEAL.search + 0.45, lt) * (1 - smooth(REVEAL.call + 0.05, REVEAL.call + 0.2, lt));
    const mv = E.inOutCubic(prog(lt, REVEAL.search + 0.3, REVEAL.tap - 0.05));
    touch(c, lerp(840, ring[0], mv), lerp(1500, ring[1], mv), lt > REVEAL.tap && lt < REVEAL.tap + 0.14 ? 1 : 0, ta);
    ripple(c, ring[0], ring[1], prog(lt, REVEAL.tap, REVEAL.tap + 0.45));
  }
  headline(c, 'Liker du ikke utkastet?', 'Da koster det 0 kr.', lt, REVEAL.t1, REVEAL.search - 0.35, { size: 76 });
  headline(c, 'Nå ringer de', 'deg.', lt, REVEAL.t3, null);
}

// ════════════════════════════════════════════════════════════════════════════
// 06 — CTA
// ════════════════════════════════════════════════════════════════════════════
function sceneCta(c, lt) {
  fillBg(c);
  redGlow(c, 540, 820, 900, 0.16);
  const k = 3.4;
  drawLockup(c, 540 - 113 * k, 330, k, lt - CTA.lockup);
  const bp = E.outBack(prog(lt, CTA.button, CTA.button + 0.3), 2.2);
  const tap = lt - CTA.tap;
  const press = tap > 0 ? 1 - 0.06 * Math.exp(-tap * 12) * Math.cos(tap * 18) : 1;
  const by = 800;
  const bw = 880;
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
    text(c, 'Be om gratis førsteutkast  →', 0, 17, `700 50px ${SANS}`, WHITE, 1, 'center');
    c.restore();
    const ta = smooth(CTA.tap - 0.5, CTA.tap - 0.35, lt) * (1 - smooth(CTA.tap + 0.3, CTA.tap + 0.5, lt));
    const mv = E.inOutCubic(prog(lt, CTA.tap - 0.5, CTA.tap - 0.05));
    touch(c, lerp(900, 700, mv), lerp(1300, by + 10, mv), tap > 0 && tap < 0.14 ? 1 : 0, ta);
    ripple(c, 700, by + 10, prog(lt, CTA.tap, CTA.tap + 0.45));
  }
  riseText(c, 'Helt uforpliktende.', 540, 950, `500 48px ${SANS}`, WHITE, lt, CTA.lines, { align: 'center', size: 48, alpha: 0.85 });
  riseText(c, 'seventhseal.no', 540, 1060, `600 54px ${MONO}`, WHITE, lt, CTA.lines + 0.15, { align: 'center', size: 54 });
  const ul = E.outExpo(prog(lt, CTA.lines + 0.35, CTA.lines + 0.8));
  if (ul > 0) {
    const Lw = layout(c, 'seventhseal.no', `600 54px ${MONO}`).width;
    c.fillStyle = RED;
    c.fillRect(540 - Lw / 2, 1084, Lw * ul, 6);
  }
}

function fillBg(c, col = BLACK) {
  c.fillStyle = col;
  c.fillRect(-400, -400, W + 800, H + 800);
}

const reel = makeReel({
  W,
  H,
  FPS,
  DURATION,
  SCENES,
  CUTS,
  HITS,
  fns: { hook: sceneHook, stat: sceneStat, build: sceneBuild, price: scenePrice, reveal: sceneReveal, cta: sceneCta },
  maxSub: { hook: 5, build: 5, reveal: 5 },
  hud: (c, t, sc) => {
    if (sc.id === 'cta') return;
    const red = sc.id === 'price';
    brandBug(c, sc.id === 'build' && t - sc.start < BUILD.phone ? 0 : 1, red ? BLACK : WHITE, red ? BLACK : RED);
  },
  fx: (t, f, sc) => fxFrom(HITS, t, f, { bloom: sc.id === 'stat' || sc.id === 'reveal' ? 0.2 : 0.15, flash: t >= S.reveal.start ? 0.3 * Math.exp(-(t - S.reveal.start) * 16) : 0 }),
  setup: async () => {
    searchCv = mk(SW, SH);
    searchCtx = searchCv.getContext('2d');
    drawSearch(searchCtx, 0, { query: '', results: 0, flag: 0, mine: 0, call: 0 });
    TEX.search = K.R.texture(searchCv);
    siteCv = mk(SW, SH);
    siteCtx = siteCv.getContext('2d');
    drawSite(siteCtx, 0, { wire: 0, design: 0, pulse: 0 });
    TEX.site = K.R.texture(siteCv);
  },
});
export const init = reel.init;
export const renderFrame = reel.renderFrame;
export const totalFrames = reel.totalFrames;
