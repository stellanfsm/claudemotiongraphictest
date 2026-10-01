// The phone screens for «Kunden googlet deg», drawn in code at 780×1688:
// a generic search app (no real search engine's branding) and the first
// draft of a website for a fictional plumber, «Ditt Firma AS».

import { SANS, MONO, RED, TAU, clamp, E, lerp, prog, typed } from './lib.js';

export const SW = 780;
export const SH = 1688;

const INK = '#1B1F23';
const MUTED = '#5F6670';
const LINK = '#1A3FB0';
const LINE = '#E3E5E8';

function pill(c, x, y, w, h, fill, stroke = null) {
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2.5;
    c.stroke();
  }
}
function phoneIcon(c, x, y, s, col) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(-9, -12);
  c.quadraticCurveTo(-13, -8, -11, -2);
  c.quadraticCurveTo(-6, 9, 4, 12);
  c.quadraticCurveTo(10, 14, 13, 9);
  c.lineTo(8, 4);
  c.quadraticCurveTo(5, 6, 2, 4);
  c.quadraticCurveTo(-3, 0, -4, -4);
  c.quadraticCurveTo(-5, -7, -3, -9);
  c.closePath();
  c.fill();
  c.restore();
}
function statusBar(c, dark = false) {
  const col = dark ? '#FFFFFF' : INK;
  c.font = `600 26px ${SANS}`;
  c.fillStyle = col;
  c.fillText('09:41', 52, 46);
  c.fillRect(640, 28, 50, 22);
  c.fillRect(692, 34, 4, 10);
  for (let k = 0; k < 4; k++) c.fillRect(560 + k * 12, 46 - k * 6, 8, 6 + k * 6);
}

// st: { query, results 0..1, flag 0..1, mine 0..1 (your card has a site),
//       call 0..1, callName, callT }
export function drawSearch(c, t, st) {
  c.save();
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, SW, SH);
  statusBar(c);
  // search field
  pill(c, 32, 84, 716, 96, '#F1F3F4');
  c.strokeStyle = MUTED;
  c.lineWidth = 4;
  c.beginPath();
  c.arc(86, 128, 15, 0, TAU);
  c.stroke();
  c.beginPath();
  c.moveTo(97, 139);
  c.lineTo(110, 152);
  c.stroke();
  c.font = `500 36px ${SANS}`;
  c.fillStyle = INK;
  c.fillText(st.query, 132, 142);
  if (st.caret && Math.floor(t * 3) % 2 === 0) c.fillRect(136 + c.measureText(st.query).width, 108, 3, 42);
  // tabs
  c.font = `500 26px ${SANS}`;
  ['Alle', 'Kart', 'Bilder', 'Nyheter'].forEach((s, i) => {
    c.fillStyle = i === 0 ? INK : MUTED;
    c.fillText(s, 48 + i * 140, 236);
  });
  c.fillStyle = INK;
  c.fillRect(44, 252, 64, 5);
  c.fillStyle = LINE;
  c.fillRect(0, 258, SW, 2);

  const R = st.results;
  const card = (k, y, h, draw) => {
    const p = E.outCubic(prog(R, k * 0.18, k * 0.18 + 0.55));
    if (p <= 0) return;
    c.save();
    c.globalAlpha = p;
    c.translate(0, (1 - p) * 40);
    draw(y, h);
    c.restore();
  };
  c.font = `400 22px ${SANS}`;
  c.fillStyle = MUTED;
  if (R > 0) c.fillText('Ca. 2 400 resultater', 48, 306);

  const rich = (y, name, url, desc, thumb) => {
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.roundRect(28, y, 724, 300, 24);
    c.fill();
    c.strokeStyle = LINE;
    c.lineWidth = 2;
    c.stroke();
    thumb(c, 560, y + 28, 164, 120);
    c.font = `400 22px ${SANS}`;
    c.fillStyle = MUTED;
    c.fillText(url, 56, y + 50);
    c.font = `600 38px ${SANS}`;
    c.fillStyle = LINK;
    c.fillText(name, 56, y + 100);
    c.font = `400 24px ${SANS}`;
    c.fillStyle = MUTED;
    desc.forEach((s, i) => c.fillText(s, 56, y + 140 + i * 32));
    pill(c, 56, y + 214, 170, 60, null, '#C9CDD2');
    c.font = `600 24px ${SANS}`;
    c.fillStyle = INK;
    c.fillText('Nettside', 92, y + 252);
    pill(c, 244, y + 214, 150, 60, INK);
    phoneIcon(c, 280, y + 244, 0.9, '#FFFFFF');
    c.fillStyle = '#FFFFFF';
    c.fillText('Ring', 304, y + 252);
  };
  const thumbA = (c2, x, y, w, h) => {
    c2.fillStyle = '#DCE8F2';
    c2.beginPath();
    c2.roundRect(x, y, w, h, 14);
    c2.fill();
    c2.fillStyle = '#2E5E8C';
    c2.fillRect(x + 20, y + 74, w - 40, 12);
    c2.fillRect(x + 40, y + 30, 12, 56);
    c2.fillRect(x + w - 52, y + 30, 12, 56);
  };
  const thumbB = (c2, x, y, w, h) => {
    c2.fillStyle = '#E9E2D6';
    c2.beginPath();
    c2.roundRect(x, y, w, h, 14);
    c2.fill();
    c2.fillStyle = '#7A5A3A';
    c2.beginPath();
    c2.arc(x + w / 2, y + h / 2, 30, 0, TAU);
    c2.fill();
  };
  const thumbMine = (c2, x, y, w, h) => {
    c2.fillStyle = '#0E6E8C';
    c2.beginPath();
    c2.roundRect(x, y, w, h, 14);
    c2.fill();
    c2.fillStyle = '#FFFFFF';
    c2.font = `700 20px ${SANS}`;
    c2.fillText('Rørlegger', x + 16, y + 42);
    c2.fillText('i Oslo.', x + 16, y + 66);
    pill(c2, x + 16, y + 82, 90, 24, '#FFFFFF');
  };

  card(0, 330, 300, (y) => rich(y, 'Konkurrenten AS', 'konkurrenten.no', ['Rørlegger i Oslo. Døgnvakt,', 'bad og varmepumpe.'], thumbA));
  card(1, 650, 300, (y) => {
    const m = st.mine;
    if (m >= 1) {
      rich(y, 'Ditt Firma AS', 'dittfirma.no', ['Rørlegger i Oslo.', 'Rask hjelp, ring direkte.'], thumbMine);
      c.strokeStyle = RED;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(28, y, 724, 300, 24);
      c.stroke();
      return;
    }
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.roundRect(28, y, 724, 300, 24);
    c.fill();
    c.strokeStyle = st.flag > 0 ? RED : LINE;
    c.lineWidth = st.flag > 0 ? 4 : 2;
    c.stroke();
    c.font = `600 38px ${SANS}`;
    c.fillStyle = INK;
    c.fillText('Ditt Firma AS', 56, y + 70);
    c.font = `400 24px ${SANS}`;
    c.fillStyle = MUTED;
    c.fillText('Rørlegger · Oslo', 56, y + 110);
    // the empty thumbnail
    c.strokeStyle = '#D5D8DC';
    c.setLineDash([10, 8]);
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(560, y + 28, 164, 120, 14);
    c.stroke();
    c.setLineDash([]);
    c.font = `600 20px ${SANS}`;
    c.fillStyle = '#B0B5BB';
    c.textAlign = 'center';
    c.fillText('Ingen bilder', 642, y + 95);
    c.textAlign = 'left';
    // «Ingen nettside»
    const f = st.flag;
    const s = f > 0 ? 1 + 0.12 * Math.exp(-f * 6) * Math.sin(f * 30) : 1;
    c.save();
    c.translate(56, y + 150);
    c.scale(s, s);
    pill(c, 0, 0, 250, 56, f > 0 ? RED : '#F1F3F4');
    c.font = `700 26px ${SANS}`;
    c.fillStyle = f > 0 ? '#FFFFFF' : MUTED;
    c.fillText('Ingen nettside', 30, 37);
    c.restore();
    pill(c, 56, y + 220, 150, 56, null, '#D5D8DC');
    phoneIcon(c, 92, y + 248, 0.85, '#B0B5BB');
    c.font = `600 24px ${SANS}`;
    c.fillStyle = '#B0B5BB';
    c.fillText('Ring', 116, y + 256);
  });
  card(2, 970, 300, (y) => rich(y, 'Nabofirmaet AS', 'nabofirmaet.no', ['Rørleggertjenester i Oslo', 'og omegn. Fast pris.'], thumbB));

  // incoming / outgoing call sheet
  if (st.call > 0) {
    const p = E.outCubic(clamp(st.call));
    c.save();
    c.translate(0, (1 - p) * SH);
    const g = c.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#20262D');
    g.addColorStop(1, '#0C0F12');
    c.fillStyle = g;
    c.fillRect(0, 0, SW, SH);
    statusBar(c, true);
    c.fillStyle = st.callMine ? '#0E6E8C' : '#3B4652';
    c.beginPath();
    c.arc(SW / 2, 420, 110, 0, TAU);
    c.fill();
    c.font = `700 80px ${SANS}`;
    c.fillStyle = '#FFFFFF';
    c.textAlign = 'center';
    c.fillText(st.callMine ? 'DF' : 'KA', SW / 2, 448);
    c.font = `600 52px ${SANS}`;
    c.fillText(st.callName, SW / 2, 640);
    const dots = '.'.repeat(1 + (Math.floor((st.callT || 0) * 3) % 3));
    c.font = `400 32px ${SANS}`;
    c.fillStyle = '#AEB6BF';
    c.fillText('Ringer' + dots, SW / 2, 700);
    c.fillStyle = '#E5383B';
    c.beginPath();
    c.arc(SW / 2, 1420, 70, 0, TAU);
    c.fill();
    c.save();
    c.translate(SW / 2, 1420);
    c.rotate(2.3);
    phoneIcon(c, 0, 0, 2.2, '#FFFFFF');
    c.restore();
    c.textAlign = 'left';
    c.restore();
  }
  c.restore();
}

// ─── the draft site for «Ditt Firma AS» ────────────────────────────────────
export const SITE = { bg: '#F6F7F5', ink: '#10151A', accent: '#0E6E8C', soft: '#E3EEF1', muted: '#5C6670' };

// b: { wire 0..1 (blocks appear as wireframe), design 0..1 (blocks get colour), pulse 0..1 }
export function drawSite(c, t, b = { wire: 1, design: 1, pulse: 0 }) {
  const S = SITE;
  c.save();
  c.fillStyle = b.design > 0 ? S.bg : '#FFFFFF';
  c.fillRect(0, 0, SW, SH);
  if (b.design > 0 && b.design < 1) {
    c.fillStyle = '#FFFFFF';
    c.globalAlpha = 1 - b.design;
    c.fillRect(0, 0, SW, SH);
    c.globalAlpha = 1;
  }
  statusBar(c);
  const blocks = [
    [0, 70, SW, 110, navD],
    [40, 220, 700, 190, heroD],
    [40, 430, 700, 50, subD],
    [40, 510, 700, 104, ctaD],
    [40, 650, 700, 470, imgD],
    [40, 1160, 700, 120, svc(0)],
    [40, 1300, 700, 120, svc(1)],
    [40, 1440, 700, 120, svc(2)],
  ];
  blocks.forEach(([x, y, w, h, draw], i) => {
    const n = blocks.length;
    const wa = E.outBack(prog(b.wire, i / n, i / n + 0.35), 1.8);
    const da = E.outCubic(prog(b.design, i / n, i / n + 0.3));
    if (wa <= 0) return;
    if (da < 1) {
      // wireframe: grey placeholder with a selection outline
      c.save();
      c.globalAlpha = clamp(wa) * (1 - da);
      const s = lerp(0.92, 1, clamp(wa));
      c.translate(x + w / 2, y + h / 2);
      c.scale(s, s);
      c.fillStyle = '#E6E8EB';
      c.beginPath();
      c.roundRect(-w / 2, -h / 2, w, h, 16);
      c.fill();
      c.strokeStyle = '#18A0FB';
      c.lineWidth = 2;
      c.setLineDash([8, 6]);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#C9CDD2';
      if (h > 90) {
        c.fillRect(-w / 2 + 26, -h / 2 + 26, w * 0.55, 22);
        c.fillRect(-w / 2 + 26, -h / 2 + 62, w * 0.35, 22);
      }
      c.restore();
    }
    if (da > 0) {
      c.save();
      c.globalAlpha = da;
      draw(x, y, w, h);
      c.restore();
    }
  });
  c.restore();

  function navD(x, y) {
    c.fillStyle = S.accent;
    c.beginPath();
    c.moveTo(70, y + 22);
    c.quadraticCurveTo(48, y + 52, 52, y + 66);
    c.arc(70, y + 64, 18, Math.PI, 0, true);
    c.quadraticCurveTo(92, y + 52, 70, y + 22);
    c.fill();
    c.font = `700 36px ${SANS}`;
    c.fillStyle = S.ink;
    c.fillText('Ditt Firma AS', 108, y + 70);
    c.strokeStyle = S.ink;
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(620, y + 24, 116, 54, 27);
    c.stroke();
    c.font = `600 22px ${MONO}`;
    c.textAlign = 'center';
    c.fillStyle = S.ink;
    c.fillText('MENY', 678, y + 59);
    c.textAlign = 'left';
  }
  function heroD(x, y) {
    c.font = `700 82px ${SANS}`;
    c.fillStyle = S.ink;
    c.fillText('Rørlegger', x, y + 80);
    c.fillText('i Oslo.', x, y + 170);
    c.fillStyle = S.accent;
    c.fillText('Rask hjelp.', x + c.measureText('i Oslo. ').width, y + 170);
  }
  function subD(x, y) {
    c.font = `400 30px ${SANS}`;
    c.fillStyle = S.muted;
    c.fillText('Lekkasje, bad og varme — ring direkte.', x + 2, y + 34);
  }
  function ctaD(x, y, w, h) {
    const p = b.pulse > 0 ? Math.sin(b.pulse * Math.PI * 6) * 0.5 + 0.5 : 0;
    c.fillStyle = S.accent;
    c.beginPath();
    c.roundRect(x, y, w, h, h / 2);
    c.fill();
    if (p > 0) {
      c.strokeStyle = `rgba(14,110,140,${0.6 * (1 - p)})`;
      c.lineWidth = 10;
      c.beginPath();
      c.roundRect(x - p * 14, y - p * 14, w + p * 28, h + p * 28, h / 2 + p * 14);
      c.stroke();
    }
    phoneIcon(c, x + w / 2 - 110, y + h / 2, 1.5, '#FFFFFF');
    c.font = `700 40px ${SANS}`;
    c.fillStyle = '#FFFFFF';
    c.fillText('Ring nå', x + w / 2 - 70, y + h / 2 + 14);
  }
  function imgD(x, y, w, h) {
    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 28);
    c.clip();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#CFE3EA');
    g.addColorStop(1, '#9CC3D1');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
    // tiles
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 3;
    for (let k = 0; k <= 10; k++) {
      c.beginPath();
      c.moveTo(x + k * 70, y);
      c.lineTo(x + k * 70, y + h * 0.62);
      c.stroke();
    }
    for (let k = 0; k <= 5; k++) {
      c.beginPath();
      c.moveTo(x, y + k * 58);
      c.lineTo(x + w, y + k * 58);
      c.stroke();
    }
    // pipes
    c.strokeStyle = '#28566B';
    c.lineWidth = 26;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x - 20, y + h * 0.78);
    c.lineTo(x + w * 0.35, y + h * 0.78);
    c.lineTo(x + w * 0.35, y + h * 0.45);
    c.lineTo(x + w * 0.7, y + h * 0.45);
    c.lineTo(x + w * 0.7, y + h + 20);
    c.stroke();
    c.strokeStyle = '#E6A43A';
    c.lineWidth = 34;
    c.beginPath();
    c.moveTo(x + w * 0.35, y + h * 0.6);
    c.lineTo(x + w * 0.35, y + h * 0.62);
    c.stroke();
    c.lineCap = 'butt';
    c.restore();
  }
  function svc(k) {
    return (x, y, w, h) => {
      c.fillStyle = S.soft;
      c.beginPath();
      c.roundRect(x, y, w, h, 22);
      c.fill();
      c.fillStyle = S.accent;
      c.beginPath();
      c.arc(x + 64, y + h / 2, 30, 0, TAU);
      c.fill();
      c.font = `700 34px ${SANS}`;
      c.fillStyle = S.ink;
      c.fillText(['Lekkasje', 'Bad og våtrom', 'Varmepumpe'][k], x + 120, y + h / 2 + 12);
      c.fillText('→', x + w - 60, y + h / 2 + 12);
    };
  }
}
