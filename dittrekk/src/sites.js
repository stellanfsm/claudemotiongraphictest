// The two phone screens for the rebuild, drawn in code at 780×1688 (a 390×844
// phone at 2×): the dated «before» site of a fictional «Din Bedrift AS», and
// the modern «after» site Seventh Seal would build for it.

import { SANS, MONO, RED, TAU, clamp, E, prog, lerp, typed } from './lib.js';

export const SW = 780;
export const SH = 1688;

const SERIF_OLD = '"Liberation Serif", "Times New Roman", Times, serif';
const SANS_OLD = '"Liberation Sans", Arial, Helvetica, sans-serif';

function bevel(c, x, y, w, h, face = '#D4D0C8', pressed = false) {
  c.fillStyle = face;
  c.fillRect(x, y, w, h);
  c.fillStyle = pressed ? '#808080' : '#FFFFFF';
  c.fillRect(x, y, w, 3);
  c.fillRect(x, y, 3, h);
  c.fillStyle = pressed ? '#FFFFFF' : '#404040';
  c.fillRect(x, y + h - 3, w, 3);
  c.fillRect(x + w - 3, y, 3, h);
}

function star(c, cx, cy, r0, r1, n, rot) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const r = i % 2 ? r0 : r1;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
}

// ─── before ────────────────────────────────────────────────────────────────
export function drawOldSite(c, t) {
  c.save();
  // page background: the tiled beige of 2006
  c.fillStyle = '#F7F1C6';
  c.fillRect(0, 0, SW, SH);
  c.globalAlpha = 0.18;
  c.fillStyle = '#B8A866';
  for (let y = 0; y < SH; y += 28) for (let x = (y / 28) % 2 ? 14 : 0; x < SW; x += 28) c.fillRect(x, y, 4, 4);
  c.globalAlpha = 1;

  // header: bevelled blue gradient
  const hg = c.createLinearGradient(0, 0, 0, 210);
  hg.addColorStop(0, '#5B8BEF');
  hg.addColorStop(0.5, '#1D3F9E');
  hg.addColorStop(1, '#0B1F5C');
  c.fillStyle = hg;
  c.fillRect(0, 0, SW, 210);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(0, 0, SW, 6);
  // spinning globe clip-art
  const gx = 660;
  const gy = 104;
  const gr = 70;
  const gg = c.createRadialGradient(gx - 25, gy - 25, 8, gx, gy, gr);
  gg.addColorStop(0, '#BFF3FF');
  gg.addColorStop(0.5, '#2B8FE0');
  gg.addColorStop(1, '#0B3C8C');
  c.fillStyle = gg;
  c.beginPath();
  c.arc(gx, gy, gr, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(160,255,120,0.9)';
  c.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    const ph = ((t * 0.9 + k / 4) % 1) * Math.PI;
    const w = Math.abs(Math.cos(ph)) * gr;
    c.beginPath();
    c.ellipse(gx, gy, Math.max(1, w), gr, 0, 0, TAU);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(gx, gy, gr, gr * 0.3, 0, 0, TAU);
  c.stroke();
  // title with the obligatory drop shadow
  c.font = `italic 700 72px ${SERIF_OLD}`;
  c.fillStyle = '#000';
  c.fillText('Din Bedrift AS', 34, 112);
  c.fillStyle = '#FFE03A';
  c.fillText('Din Bedrift AS', 28, 106);
  c.font = `italic 400 28px ${SERIF_OLD}`;
  c.fillStyle = '#FFFFFF';
  c.fillText('~ Kvalitet siden 1998 ~', 90, 160);

  // marquee
  c.fillStyle = '#C80000';
  c.fillRect(0, 210, SW, 58);
  c.save();
  c.beginPath();
  c.rect(0, 210, SW, 58);
  c.clip();
  c.font = `700 32px ${SANS_OLD}`;
  c.fillStyle = '#FFFF66';
  const msg = '*** VELKOMMEN TIL VÅR HJEMMESIDE!!! ***   NYHET: VI HAR FÅTT FAKS!   ';
  const mw = c.measureText(msg).width;
  const off = -((t * 190) % mw);
  c.fillText(msg + msg + msg, off, 251);
  c.restore();

  // left sidebar: grey bevelled nav
  c.fillStyle = '#C0C0C0';
  c.fillRect(0, 268, 232, 1260);
  const nav = ['Hjem', 'Om oss', 'Tjenester', 'Bilder', 'Gjestebok', 'Kontakt'];
  nav.forEach((s, i) => {
    const y = 296 + i * 78;
    bevel(c, 14, y, 204, 60);
    c.font = `400 28px ${SANS_OLD}`;
    c.fillStyle = '#0000EE';
    c.fillText(s, 34, y + 40);
    c.fillRect(34, y + 44, c.measureText(s).width, 2);
  });
  // hit counter
  c.font = `700 24px ${SANS_OLD}`;
  c.fillStyle = '#000';
  c.fillText('Besøkende:', 22, 820);
  c.fillStyle = '#000';
  c.fillRect(18, 836, 196, 58);
  c.font = `700 40px ${MONO}`;
  c.fillStyle = '#3BFF3B';
  c.fillText(String(482 + Math.floor(t * 1.5)).padStart(6, '0'), 28, 878);
  // "best viewed in"
  bevel(c, 18, 930, 196, 110, '#E8E8E8');
  c.font = `700 20px ${SANS_OLD}`;
  c.fillStyle = '#0033AA';
  c.fillText('Best vist i', 36, 968);
  c.fillText('Internet', 36, 994);
  c.fillText('Explorer 6.0', 36, 1020);
  // a guestbook "button" gif
  const bl = Math.floor(t * 3) % 2;
  c.fillStyle = bl ? '#FF00FF' : '#00FFFF';
  c.fillRect(18, 1070, 196, 64);
  c.font = `700 26px ${SANS_OLD}`;
  c.fillStyle = '#000';
  c.fillText('Signer', 64, 1100);
  c.fillText('gjesteboka!', 40, 1126);

  // content
  const cx = 250;
  c.fillStyle = '#FFFFFF';
  c.fillRect(cx, 268, SW - cx, 1260);
  c.font = `700 60px ${SERIF_OLD}`;
  c.fillStyle = '#800080';
  c.fillText('Velkommen!', cx + 40, 356);
  c.fillRect(cx + 40, 366, c.measureText('Velkommen!').width, 4);
  // "NY!" starburst, blinking and spinning
  c.save();
  c.translate(cx + 440, 330);
  c.rotate(t * 1.5);
  c.fillStyle = bl ? '#FF2200' : '#FFCC00';
  star(c, 0, 0, 34, 58, 12, 0);
  c.fill();
  c.restore();
  c.font = `700 34px ${SANS_OLD}`;
  c.fillStyle = bl ? '#FFFF00' : '#FF0000';
  c.textAlign = 'center';
  c.fillText('NY!', cx + 440, 342);
  c.textAlign = 'left';
  // centred body copy
  c.font = `400 28px ${SERIF_OLD}`;
  c.fillStyle = '#222';
  c.textAlign = 'center';
  const body = [
    'Velkommen til Din Bedrift AS',
    'sin hjemmeside på Internett.',
    'Her finner du informasjon om',
    'oss og våre tjenester.',
    'Klikk på lenkene til venstre.',
  ];
  body.forEach((s, i) => c.fillText(s, cx + 265, 440 + i * 38));
  c.textAlign = 'left';
  // broken image
  c.strokeStyle = '#888';
  c.lineWidth = 2;
  c.strokeRect(cx + 70, 660, 390, 250);
  c.fillStyle = '#F0F0F0';
  c.fillRect(cx + 72, 662, 386, 246);
  c.fillStyle = '#FFF';
  c.fillRect(cx + 86, 676, 34, 34);
  c.strokeRect(cx + 86, 676, 34, 34);
  c.strokeStyle = '#E00000';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(cx + 92, 682);
  c.lineTo(cx + 114, 704);
  c.moveTo(cx + 114, 682);
  c.lineTo(cx + 92, 704);
  c.stroke();
  c.font = `400 24px ${SANS_OLD}`;
  c.fillStyle = '#555';
  c.fillText('bilde1.jpg', cx + 132, 702);
  // under construction
  const uy = 950;
  c.save();
  c.beginPath();
  c.rect(cx + 20, uy, 490, 96);
  c.clip();
  c.fillStyle = '#FFD400';
  c.fillRect(cx + 20, uy, 490, 96);
  c.fillStyle = '#111';
  const so = (t * 60) % 60;
  for (let x = -120; x < 600; x += 60) {
    c.beginPath();
    c.moveTo(cx + 20 + x + so, uy);
    c.lineTo(cx + 50 + x + so, uy);
    c.lineTo(cx + 20 + x + so - 66, uy + 96);
    c.lineTo(cx - 10 + x + so - 66, uy + 96);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#FFD400';
  c.fillRect(cx + 44, uy + 22, 442, 52);
  c.font = `700 36px ${SANS_OLD}`;
  c.fillStyle = '#111';
  c.textAlign = 'center';
  c.fillText('UNDER KONSTRUKSJON', cx + 265, uy + 61);
  c.restore();
  c.textAlign = 'left';
  // "KLIKK HER!!"
  const bg = c.createLinearGradient(0, 1090, 0, 1170);
  bg.addColorStop(0, '#9CFF6A');
  bg.addColorStop(1, '#1E9A00');
  c.fillStyle = bg;
  c.fillRect(cx + 120, 1090, 290, 80);
  c.strokeStyle = '#0B4F00';
  c.lineWidth = 4;
  c.strokeRect(cx + 120, 1090, 290, 80);
  c.font = `700 38px ${SERIF_OLD}`;
  c.fillStyle = '#FFF';
  c.textAlign = 'center';
  c.fillText('KLIKK HER!!', cx + 265, 1144);
  c.textAlign = 'left';
  // tiny, cramped small print (the desktop layout squeezed onto a phone)
  c.font = `400 19px ${SERIF_OLD}`;
  c.fillStyle = '#444';
  [
    'Vi er en bedrift som tilbyr tjenester til våre',
    'kunder. Ta kontakt på telefon eller telefaks for',
    'mer informasjon. Siden oppdateres jevnlig.',
    'Alle priser er eks. mva. Med forbehold om feil.',
  ].forEach((s, i) => c.fillText(s, cx + 22, 1222 + i * 26));
  c.font = `italic 400 24px ${SERIF_OLD}`;
  c.fillStyle = '#AA0000';
  c.fillText('Sist oppdatert: 14.03.2009', cx + 90, 1370);
  c.font = `400 22px ${SANS_OLD}`;
  c.fillStyle = '#0000EE';
  c.fillText('Legg til i favoritter', cx + 130, 1420);
  c.fillRect(cx + 130, 1424, c.measureText('Legg til i favoritter').width, 2);

  // footer
  c.fillStyle = '#1D3F9E';
  c.fillRect(0, 1528, SW, SH - 1528);
  c.font = `400 24px ${SANS_OLD}`;
  c.fillStyle = '#CFE0FF';
  c.textAlign = 'center';
  c.fillText('© 2009 Din Bedrift AS  |  Webmaster: Kjell', SW / 2, 1590);
  c.fillText('Denne siden er best vist i 800×600', SW / 2, 1630);
  c.textAlign = 'left';
  c.restore();
}

// ─── after ─────────────────────────────────────────────────────────────────
export const NEW = {
  bg: '#F4F0E8',
  ink: '#141414',
  accent: '#C8502D',
  forest: '#1F3A2C',
  muted: '#6B665E',
  card: '#EAE4D8',
};

function landscape(c, x, y, w, h, t) {
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, 30);
  c.clip();
  const sky = c.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#F3D2AE');
  sky.addColorStop(0.55, '#EBAE84');
  sky.addColorStop(1, '#D9876A');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);
  // sun
  c.fillStyle = 'rgba(255,240,214,0.95)';
  c.beginPath();
  c.arc(x + w * 0.7, y + h * 0.4, 70, 0, TAU);
  c.fill();
  // ridges
  const ridge = (base, amp, col, seed, drift) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y + h);
    for (let i = 0; i <= 24; i++) {
      const px = x + (i / 24) * w;
      const n = Math.sin(i * 0.9 + seed) * 0.5 + Math.sin(i * 2.3 + seed * 2) * 0.25 + Math.sin(i * 0.37 + seed * 3) * 0.6;
      c.lineTo(px, y + base + n * amp + drift);
    }
    c.lineTo(x + w, y + h);
    c.closePath();
    c.fill();
  };
  ridge(h * 0.52, 46, '#A8715E', 1.2, 0);
  ridge(h * 0.62, 40, '#5E6B52', 2.7, 0);
  ridge(h * 0.72, 30, '#3A5140', 4.1, 0);
  ridge(h * 0.84, 18, NEW.forest, 5.3, 0);
  // a timber house frame (the craft)
  const hx = x + w * 0.18;
  const hy = y + h * 0.86;
  c.strokeStyle = '#F4E3C8';
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(hx, hy - 120);
  c.lineTo(hx + 110, hy - 200);
  c.lineTo(hx + 220, hy - 120);
  c.lineTo(hx + 220, hy);
  c.moveTo(hx, hy - 120);
  c.lineTo(hx + 220, hy - 120);
  c.moveTo(hx + 110, hy - 200);
  c.lineTo(hx + 110, hy);
  c.moveTo(hx, hy - 60);
  c.lineTo(hx + 220, hy - 60);
  c.moveTo(hx, hy - 120);
  c.lineTo(hx + 110, hy);
  c.moveTo(hx + 220, hy - 120);
  c.lineTo(hx + 110, hy);
  c.stroke();
  c.restore();
}

function icon(c, kind, x, y, s, col) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = 3.2;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'hammer') {
    c.moveTo(-14, 16);
    c.lineTo(8, -6);
    c.moveTo(0, -18);
    c.lineTo(16, -2);
    c.lineTo(20, -6);
    c.lineTo(4, -22);
    c.closePath();
  } else if (kind === 'window') {
    c.rect(-16, -18, 32, 36);
    c.moveTo(0, -18);
    c.lineTo(0, 18);
    c.moveTo(-16, 0);
    c.lineTo(16, 0);
  } else {
    c.moveTo(-20, 4);
    c.lineTo(0, -16);
    c.lineTo(20, 4);
    c.moveTo(-14, -2);
    c.lineTo(-14, 18);
    c.lineTo(14, 18);
    c.lineTo(14, -2);
  }
  c.stroke();
  c.restore();
}

// edit: { frame 0..1 (dashed frame + pill), typed 0..1, saved 0..1 }
export function drawNewSite(c, t, edit = null) {
  const N = NEW;
  c.save();
  c.fillStyle = N.bg;
  c.fillRect(0, 0, SW, SH);
  // nav
  c.fillStyle = N.accent;
  c.beginPath();
  c.moveTo(44, 88);
  c.lineTo(70, 56);
  c.lineTo(96, 88);
  c.closePath();
  c.fill();
  c.fillRect(50, 94, 40, 10);
  c.font = `700 36px ${SANS}`;
  c.fillStyle = N.ink;
  c.fillText('Din Bedrift', 116, 96);
  c.strokeStyle = N.ink;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(620, 52, 116, 54, 27);
  c.stroke();
  c.font = `600 22px ${MONO}`;
  c.textAlign = 'center';
  c.fillText('MENY', 678, 87);
  c.textAlign = 'left';

  // announcement bar — the text a customer edits in the admin panel
  const ann = 'Ledig kapasitet i desember!';
  let annY = 150;
  if (edit) {
    const shown = typed(ann, edit.typed);
    if (shown.length || edit.frame > 0) {
      c.fillStyle = N.forest;
      c.beginPath();
      c.roundRect(40, annY, 700, 64, 14);
      c.fill();
      c.font = `600 26px ${SANS}`;
      c.fillStyle = '#F4E3C8';
      c.fillText(shown, 70, annY + 42);
      if (edit.typed < 1 && Math.floor(t * 4) % 2 === 0) c.fillRect(72 + c.measureText(shown).width, annY + 16, 3, 34);
    }
  }
  const off = edit && (edit.frame > 0 || edit.typed > 0) ? 90 * E.outCubic(clamp(edit.frame * 2)) : 0;

  // hero copy
  c.font = `700 88px ${SANS}`;
  c.fillStyle = N.ink;
  c.fillText('Solid håndverk,', 40, 270 + off);
  c.fillText('levert til', 40, 364 + off);
  c.fillStyle = N.accent;
  c.fillText('avtalt tid.', 40 + c.measureText('levert til ').width, 364 + off);
  c.font = `400 30px ${SANS}`;
  c.fillStyle = N.muted;
  c.fillText('Tømrer og snekker for hjem og bedrift.', 42, 430 + off);
  // CTA
  c.fillStyle = N.ink;
  c.beginPath();
  c.roundRect(40, 476 + off, 350, 86, 43);
  c.fill();
  c.font = `600 30px ${SANS}`;
  c.fillStyle = '#FFFFFF';
  c.fillText('Be om befaring  →', 76, 530 + off);
  c.font = `600 28px ${SANS}`;
  c.fillStyle = N.ink;
  c.fillText('Se prosjekter', 430, 530 + off);
  c.fillRect(430, 540 + off, c.measureText('Se prosjekter').width, 3);

  landscape(c, 40, 610 + off, 700, 560, t);

  // services
  const sy = 1230 + off;
  c.font = `600 22px ${MONO}`;
  c.fillStyle = N.accent;
  c.fillText('TJENESTER', 42, sy);
  const cards = [
    ['hammer', 'Rehabilitering'],
    ['window', 'Vinduer og dører'],
    ['roof', 'Tilbygg'],
  ];
  cards.forEach(([k, s], i) => {
    const y = sy + 30 + i * 132;
    c.fillStyle = N.card;
    c.beginPath();
    c.roundRect(40, y, 700, 112, 22);
    c.fill();
    c.fillStyle = N.bg;
    c.beginPath();
    c.arc(104, y + 56, 34, 0, TAU);
    c.fill();
    icon(c, k, 104, y + 56, 1, N.accent);
    c.font = `700 34px ${SANS}`;
    c.fillStyle = N.ink;
    c.fillText(s, 162, y + 68);
    c.font = `400 34px ${SANS}`;
    c.fillText('→', 680, y + 68);
  });

  // admin-panel editing overlay: dashed frame + «Rediger» pill + saved toast
  if (edit && edit.frame > 0) {
    const a = clamp(edit.frame * 3);
    c.globalAlpha = a;
    c.setLineDash([12, 9]);
    c.strokeStyle = RED;
    c.lineWidth = 4;
    c.strokeRect(30, annY - 10, 720, 84);
    c.setLineDash([]);
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(30, annY - 48, 160, 38, 19);
    c.fill();
    c.font = `600 20px ${MONO}`;
    c.fillStyle = '#FFFFFF';
    c.fillText('✎ Rediger', 50, annY - 22);
    c.globalAlpha = 1;
  }
  if (edit && edit.typed >= 1 && edit.saved < 0.35) {
    c.globalAlpha = 1 - clamp((edit.saved - 0.1) * 4);
    c.fillStyle = RED;
    c.beginPath();
    c.roundRect(560, 1488, 180, 70, 35);
    c.fill();
    c.font = `600 28px ${SANS}`;
    c.fillStyle = '#FFFFFF';
    c.textAlign = 'center';
    c.fillText('Lagre', 650, 1533);
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }
  if (edit && edit.saved > 0) {
    const p = E.outBack(clamp(edit.saved * 2.5), 2);
    c.save();
    c.translate(SW / 2, SH - 120);
    c.scale(p, p);
    c.fillStyle = N.ink;
    c.beginPath();
    c.roundRect(-230, -44, 460, 88, 44);
    c.fill();
    c.font = `600 30px ${SANS}`;
    c.fillStyle = '#FFFFFF';
    c.textAlign = 'center';
    c.fillText('✓  Publisert', 0, 11);
    c.restore();
  }
  c.restore();
}
