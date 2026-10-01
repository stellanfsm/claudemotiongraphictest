// Phone screens for «Prøv å ringe deg selv»: the outdated desktop site of the
// fictional «Ditt Firma AS» squeezed onto a phone (zoomable, with a cookie
// banner), the modern draft (from site.js), a before/after split, and a call.

import { SANS, MONO, RED, TAU, clamp, E, lerp, prog } from './lib.js';
import { drawSite } from './site.js';

export const SW = 780;
export const SH = 1688;
export const PW = 1300; // the old page's desktop width
export const PHH = 2300;
const CHROME = 150; // status + address bar
const OLD_SERIF = '"Liberation Serif", Georgia, serif';
const OLD_SANS = '"Liberation Sans", Arial, sans-serif';

let page;
export function buildOldPage(mk) {
  page = mk(PW, PHH);
  const c = page.getContext('2d');
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, PW, PHH);
  c.fillStyle = '#E9ECEF';
  c.fillRect(0, 0, PW, 40);
  c.font = `400 16px ${OLD_SANS}`;
  c.fillStyle = '#556';
  c.fillText('Velkommen  |  Logg inn  |  English  |  Nyhetsbrev', 860, 26);
  c.font = `700 56px ${OLD_SERIF}`;
  c.fillStyle = '#1D3B6E';
  c.fillText('Ditt Firma AS', 60, 128);
  c.font = `italic 400 22px ${OLD_SERIF}`;
  c.fillStyle = '#778';
  c.fillText('Kvalitet og service siden 1998', 64, 166);
  c.strokeStyle = '#AAB';
  c.lineWidth = 2;
  c.strokeRect(950, 92, 280, 40);
  c.font = `400 18px ${OLD_SANS}`;
  c.fillStyle = '#99A';
  c.fillText('Søk på siden ...', 962, 118);
  const ng = c.createLinearGradient(0, 200, 0, 262);
  ng.addColorStop(0, '#3E6DB5');
  ng.addColorStop(1, '#1F477F');
  c.fillStyle = ng;
  c.fillRect(0, 200, PW, 62);
  c.font = `700 22px ${OLD_SANS}`;
  c.fillStyle = '#FFFFFF';
  ['Hjem', 'Om oss', 'Tjenester', 'Referanser', 'Prosjekter', 'Aktuelt', 'Galleri', 'Kontakt'].forEach((s, i) => c.fillText(s, 60 + i * 150, 240));
  // hero carousel
  const hg = c.createLinearGradient(0, 262, PW, 760);
  hg.addColorStop(0, '#7FA6C9');
  hg.addColorStop(1, '#3C5F86');
  c.fillStyle = hg;
  c.fillRect(0, 262, PW, 500);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  for (let k = 0; k < 6; k++) c.fillRect(120 + k * 190, 340 + (k % 2) * 60, 120, 260);
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(80, 560, 760, 130);
  c.font = `700 44px ${OLD_SANS}`;
  c.fillStyle = '#FFFFFF';
  c.fillText('Din rørlegger i Oslo og omegn', 110, 618);
  c.font = `400 22px ${OLD_SANS}`;
  c.fillText('Les mer om våre tjenester »', 112, 660);
  c.font = `700 70px ${OLD_SANS}`;
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText('‹', 20, 540);
  c.fillText('›', PW - 50, 540);
  for (let k = 0; k < 5; k++) {
    c.fillStyle = k === 1 ? '#FFFFFF' : 'rgba(255,255,255,0.45)';
    c.beginPath();
    c.arc(PW / 2 - 60 + k * 30, 735, 8, 0, TAU);
    c.fill();
  }
  // three columns of small print
  const lorem = [
    'Ditt Firma AS har lang erfaring innen rør og',
    'sanitær for private og bedrifter. Vi utfører',
    'alle typer oppdrag, store som små, og legger',
    'vekt på kvalitet, service og ryddighet. Ta',
    'gjerne kontakt for en uforpliktende befaring',
    'eller les mer om oss under Om oss i menyen.',
  ];
  ['Om oss', 'Våre tjenester', 'Aktuelt'].forEach((h, i) => {
    const x = 60 + i * 410;
    c.font = `700 30px ${OLD_SERIF}`;
    c.fillStyle = '#1D3B6E';
    c.fillText(h, x, 850);
    c.fillStyle = '#C8CDD4';
    c.fillRect(x, 866, 360, 2);
    c.font = `400 17px ${OLD_SANS}`;
    c.fillStyle = '#555';
    for (let r = 0; r < 14; r++) c.fillText(lorem[(r + i) % lorem.length].slice(0, 44), x, 905 + r * 26);
    c.fillStyle = '#1F477F';
    c.fillText('Les mer »', x, 905 + 14 * 26 + 10);
  });
  // news list
  c.font = `700 30px ${OLD_SERIF}`;
  c.fillStyle = '#1D3B6E';
  c.fillText('Siste nytt', 60, 1400);
  c.font = `400 18px ${OLD_SANS}`;
  ['12.03.2014 – Vi har fått ny hjemmeside!', '02.11.2013 – Julebord for ansatte', '15.06.2013 – Sommerstengt uke 29–31', '20.01.2013 – Nytt servicebil på plass'].forEach((s, i) => {
    c.fillStyle = '#1F477F';
    c.fillText(s, 60, 1450 + i * 40);
  });
  // a side box with a tiny form
  c.fillStyle = '#F2F4F7';
  c.fillRect(860, 1370, 380, 300);
  c.font = `700 22px ${OLD_SANS}`;
  c.fillStyle = '#333';
  c.fillText('Kontaktskjema', 880, 1410);
  for (let k = 0; k < 4; k++) {
    c.strokeStyle = '#BBB';
    c.strokeRect(880, 1430 + k * 52, 340, 36);
  }
  // footer: the phone number, finally — tiny, at the very bottom
  c.fillStyle = '#2B2F36';
  c.fillRect(0, 2060, PW, 240);
  c.font = `400 16px ${OLD_SANS}`;
  c.fillStyle = '#AEB4BD';
  c.fillText('Ditt Firma AS  ·  Industriveien 1, 0000 Oslo  ·  Tlf. 00 00 00 00  ·  post@dittfirma.no  ·  Org.nr. 000 000 000', 60, 2130);
  c.fillText('© 2013 Ditt Firma AS. Alle rettigheter reservert.  Personvern  |  Nettstedskart', 60, 2170);
  return page;
}
// page point (desktop px) → screen point for a view
export function pageToScreen(view, px, py) {
  const s = (SW / PW) * view.zoom;
  return [(px - view.x) * s, CHROME + (py - view.y) * s];
}

function chrome(c, url) {
  c.fillStyle = '#F7F7F8';
  c.fillRect(0, 0, SW, CHROME);
  c.font = `600 26px ${SANS}`;
  c.fillStyle = '#1B1F23';
  c.fillText('09:41', 52, 46);
  c.fillRect(640, 28, 50, 22);
  c.fillStyle = '#E9EAEC';
  c.beginPath();
  c.roundRect(32, 72, 716, 62, 31);
  c.fill();
  c.font = `500 26px ${SANS}`;
  c.fillStyle = '#4A5059';
  c.textAlign = 'center';
  c.fillText(url, SW / 2, 113);
  c.textAlign = 'left';
}
function spinner(c, x, y, t, r = 34) {
  c.save();
  c.translate(x, y);
  c.rotate(t * 7);
  c.lineWidth = 8;
  c.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    c.strokeStyle = `rgba(255,255,255,${0.15 + k * 0.08})`;
    c.rotate(TAU / 10);
    c.beginPath();
    c.moveTo(r * 0.55, 0);
    c.lineTo(r, 0);
    c.stroke();
  }
  c.restore();
}

// view: { zoom, x, y } · o: { cookie 0..1, loading 0..1 (hero spinner), dim 0..1 }
export function drawOld(c, t, view, o = {}) {
  c.save();
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, SW, SH);
  c.save();
  c.beginPath();
  c.rect(0, CHROME, SW, SH - CHROME);
  c.clip();
  const s = (SW / PW) * view.zoom;
  c.translate(0, CHROME);
  c.scale(s, s);
  c.translate(-view.x, -view.y);
  c.drawImage(page, 0, 0);
  if (o.loading > 0) {
    c.fillStyle = `rgba(30,50,80,${0.55 * o.loading})`;
    c.fillRect(0, 262, PW, 500);
    c.globalAlpha = o.loading;
    spinner(c, PW / 2, 470, t, 60);
    c.globalAlpha = 1;
  }
  c.restore();
  if (o.cookie > 0) {
    const p = E.outCubic(clamp(o.cookie));
    c.save();
    c.translate(0, (1 - p) * 900);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, CHROME, SW, SH);
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, SH - 820, SW, 820);
    c.font = `700 40px ${SANS}`;
    c.fillStyle = '#1B1F23';
    c.fillText('Vi bruker informasjonskapsler', 44, SH - 730);
    c.font = `400 28px ${SANS}`;
    c.fillStyle = '#4A5059';
    ['Vi og våre 214 partnere lagrer og/eller', 'henter informasjon på enheten din for', 'å gi deg en bedre opplevelse. Du kan', 'endre innstillingene dine når som helst.'].forEach((l, i) => c.fillText(l, 44, SH - 660 + i * 42));
    c.fillStyle = '#1F477F';
    c.fillRect(44, SH - 440, 692, 96);
    c.fillStyle = '#E9ECEF';
    c.fillRect(44, SH - 324, 692, 96);
    c.font = `700 32px ${SANS}`;
    c.textAlign = 'center';
    c.fillStyle = '#FFFFFF';
    c.fillText('Godta alle', SW / 2, SH - 380);
    c.fillStyle = '#1B1F23';
    c.fillText('Administrer valg', SW / 2, SH - 264);
    c.textAlign = 'left';
    c.font = `400 26px ${SANS}`;
    c.fillStyle = '#9AA0A8';
    c.fillText('×', SW - 46, SH - 770);
    c.restore();
  }
  chrome(c, 'dittfirma.no');
  c.restore();
}

// the modern draft with a browser chrome on top, as it would load
export function drawNewWithChrome(c, t, b) {
  drawSite(c, t, b);
}

// before/after: new site left of the divider at x = split·SW
export function drawSplit(c, t, view, split, oldCv, newCv) {
  c.save();
  c.drawImage(oldCv, 0, 0);
  if (split > 0) {
    c.save();
    c.beginPath();
    c.rect(0, 0, SW * split, SH);
    c.clip();
    c.drawImage(newCv, 0, 0);
    c.restore();
    if (split < 1) {
      const x = SW * split;
      c.fillStyle = '#FFFFFF';
      c.fillRect(x - 4, 0, 8, SH);
      c.fillStyle = RED;
      c.beginPath();
      c.arc(x, SH * 0.52, 44, 0, TAU);
      c.fill();
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x - 12, SH * 0.52 - 14);
      c.lineTo(x - 26, SH * 0.52);
      c.lineTo(x - 12, SH * 0.52 + 14);
      c.moveTo(x + 12, SH * 0.52 - 14);
      c.lineTo(x + 26, SH * 0.52);
      c.lineTo(x + 12, SH * 0.52 + 14);
      c.stroke();
    }
  }
  c.restore();
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
export function drawCall(c, p, name, tt) {
  if (p <= 0) return;
  const q = E.outCubic(clamp(p));
  c.save();
  c.translate(0, (1 - q) * SH);
  const g = c.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, '#20262D');
  g.addColorStop(1, '#0C0F12');
  c.fillStyle = g;
  c.fillRect(0, 0, SW, SH);
  c.fillStyle = '#0E6E8C';
  c.beginPath();
  c.arc(SW / 2, 420, 110, 0, TAU);
  c.fill();
  c.font = `700 80px ${SANS}`;
  c.fillStyle = '#FFFFFF';
  c.textAlign = 'center';
  c.fillText('DF', SW / 2, 448);
  c.font = `600 52px ${SANS}`;
  c.fillText(name, SW / 2, 640);
  c.font = `400 32px ${SANS}`;
  c.fillStyle = '#AEB6BF';
  c.fillText('Ringer' + '.'.repeat(1 + (Math.floor(tt * 3) % 3)), SW / 2, 700);
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
