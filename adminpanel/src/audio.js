// Procedural soundtrack for the admin panel announcement — 120 BPM, F major. Pure JS (no Web Audio needed), so
// the same code renders the WAV for the video in Node and plays live in the
// browser preview. Every hit is placed from the shared timeline.

import { BEAT, BAR, DURATION, CHORDS, S, EV, CLICKS, TYPING, WHOOSHES, at } from './timeline.js';

const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// Zavalishin TPT state-variable filter
class SVF {
  constructor(sr) {
    this.sr = sr;
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = 0;
    this.bp = 0;
    this.hp = 0;
  }
  run(x, fc, q = 0.707) {
    const g = Math.tan((Math.PI * Math.min(Math.max(fc, 20), this.sr * 0.45)) / this.sr);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - k * v1 - v2;
    return v2;
  }
}

const hashNoise = (k) => {
  let x = Math.imul((k + 1) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  return ((x >>> 0) % 1000) / 1000;
};

export function renderSoundtrack(sr = 48000) {
  const N = Math.ceil(DURATION * sr);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const send = new Float32Array(N); // reverb send (mono)
  const dly = [new Float32Array(N), new Float32Array(N)]; // ping-pong send
  const bassBus = new Float32Array(N);
  const padL = new Float32Array(N);
  const padR = new Float32Array(N);
  const noise = makeNoise(1234567);

  const idx = (t) => Math.round(t * sr);
  const put = (i, v, pan = 0, rev = 0) => {
    if (i < 0 || i >= N) return;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    L[i] += v * gl * 1.414;
    R[i] += v * gr * 1.414;
    if (rev) send[i] += v * rev;
  };

  // ─── drums ───────────────────────────────────────────────────────────────
  const kicks = [];
  function kick(t0, amp = 1) {
    kicks.push(t0);
    const i0 = idx(t0);
    const len = Math.floor(0.5 * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const f = 46 + 130 * Math.exp(-t * 30);
      ph += (TAU * f) / sr;
      const env = Math.exp(-t * 6.5) * Math.min(1, t * 800);
      let v = Math.sin(ph) * env + noise() * Math.exp(-t * 400) * 0.25;
      v = Math.tanh(v * 1.8) * 0.72 * amp;
      put(i0 + n, v);
    }
  }

  function clap(t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.35 * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let env = Math.exp(-t * 16);
      for (const o of [0, 0.011, 0.022]) if (t >= o && t < o + 0.01) env = Math.max(env, Math.exp(-(t - o) * 250));
      f.run(noise(), 1300, 1.2);
      put(i0 + n, f.bp * env * 0.55 * amp, pan, 0.45);
    }
  }

  function hat(t0, amp = 1, open = false, pan = 0.2) {
    const i0 = idx(t0);
    const len = Math.floor((open ? 0.22 : 0.06) * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), 7500, 0.9);
      put(i0 + n, f.hp * Math.exp(-t * (open ? 16 : 75)) * 0.2 * amp, pan, 0.05);
    }
  }

  // ─── tonal ───────────────────────────────────────────────────────────────
  function bass(note, t0, dur) {
    const i0 = idx(t0);
    const len = Math.floor((dur + 0.03) * sr);
    const f = new SVF(sr);
    const fr = mtof(note);
    let p1 = 0;
    let p2 = 0.3;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      p1 = (p1 + fr / sr) % 1;
      p2 = (p2 + (fr * 1.006) / sr) % 1;
      const saw = p1 * 2 - 1 + (p2 * 2 - 1) + Math.sin(p1 * TAU) * 1.2;
      const cut = 180 + 1700 * Math.exp(-t * 14);
      f.run(saw, cut, 1.1);
      const env = Math.min(1, t * 400) * (t > dur ? Math.exp(-(t - dur) * 120) : 1);
      const j = i0 + n;
      if (j < N) bassBus[j] += f.lp * env * 0.34;
    }
  }

  function pad(notes, t0, dur, amp = 0.06, open = 0) {
    const i0 = idx(t0);
    const len = Math.floor((dur + 0.6) * sr);
    const filters = [new SVF(sr), new SVF(sr)];
    const voices = [];
    for (const m of notes) for (const [d, side] of [[-8, 0], [0, -1], [8, 1]]) voices.push({ f: mtof(m) * Math.pow(2, d / 1200), p: noise() * 0.5 + 0.5, side });
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let sl = 0;
      let srr = 0;
      for (const v of voices) {
        v.p = (v.p + v.f / sr) % 1;
        const s = v.p * 2 - 1;
        if (v.side <= 0) sl += s;
        if (v.side >= 0) srr += s;
      }
      const tt = t0 + t;
      const cut = 900 + 500 * Math.sin(tt * 1.3) + open * 4500 * Math.pow(t / (dur + 0.6), 2);
      filters[0].run(sl, cut, 0.8);
      filters[1].run(srr, cut, 0.8);
      const env = Math.min(1, t / 0.25) * (t > dur ? Math.exp(-(t - dur) * 5) : 1);
      const j = i0 + n;
      if (j < N) {
        padL[j] += filters[0].lp * env * amp;
        padR[j] += filters[1].lp * env * amp;
        send[j] += (filters[0].lp + filters[1].lp) * env * amp * 0.25;
      }
    }
  }

  function pluck(note, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.4 * sr);
    const f = new SVF(sr);
    const fr = mtof(note);
    let p = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      p = (p + fr / sr) % 1;
      const sq = (p < 0.5 ? 1 : -1) * 0.6 + (p * 2 - 1) * 0.4;
      f.run(sq, 400 + 5200 * Math.exp(-t * 22), 1.4);
      const v = f.lp * Math.exp(-t * 10) * 0.1 * amp;
      put(i0 + n, v, pan, 0.15);
      if (i0 + n < N) dly[0][i0 + n] += v * 0.5;
    }
  }

  function stab(notes, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.22 * sr);
    const f = new SVF(sr);
    const ph = notes.map(() => 0);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let s = 0;
      notes.forEach((m, k) => {
        ph[k] = (ph[k] + (mtof(m) * (1 + (k - 1) * 0.004)) / sr) % 1;
        s += ph[k] * 2 - 1;
      });
      f.run(s, 600 + 6000 * Math.exp(-t * 18), 1.3);
      put(i0 + n, f.lp * Math.exp(-t * 11) * 0.12 * amp, pan, 0.3);
    }
  }

  function bell(note, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(2.2 * sr);
    const fc = mtof(note);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const mod = Math.sin(TAU * fc * 3.5 * t) * 2.2 * Math.exp(-t * 3);
      const v = Math.sin(TAU * fc * t + mod) * Math.exp(-t * 2.2) * Math.min(1, t * 500) * 0.09 * amp;
      put(i0 + n, v, pan, 0.6);
    }
  }

  // ─── sound design ────────────────────────────────────────────────────────
  function impact(t0, s) {
    const i0 = idx(t0);
    const len = Math.floor(1.6 * sr);
    const f = new SVF(sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (36 + 40 * Math.exp(-t * 8))) / sr;
      const sub = Math.sin(ph) * Math.exp(-t * 2.6) * 0.75;
      f.run(noise(), 200 + 2500 * Math.exp(-t * 10), 0.8);
      const crack = f.lp * Math.exp(-t * 7) * 0.9;
      put(i0 + n, Math.tanh((sub + crack) * 1.3) * 0.62 * s, 0, 0.5 * s);
    }
  }

  function thud(t0, s) {
    const i0 = idx(t0);
    const len = Math.floor(0.4 * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (70 + 160 * Math.exp(-t * 22))) / sr;
      put(i0 + n, Math.sin(ph) * Math.exp(-t * 11) * 0.8 * s + noise() * Math.exp(-t * 90) * 0.2 * s, -0.2, 0.25);
    }
  }

  // a wooden chess piece set down on the board
  function clack(t0, s, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.25 * sr);
    const f = new SVF(sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (620 + 300 * Math.exp(-t * 60))) / sr;
      f.run(noise(), 2400, 4);
      const body = Math.sin(ph) * Math.exp(-t * 38) * 0.55 + Math.sin(ph * 2.7) * Math.exp(-t * 60) * 0.25;
      const knock = f.bp * Math.exp(-t * 90) * 0.9;
      let sub = 0;
      if (t < 0.2) sub = Math.sin(TAU * 55 * t) * Math.exp(-t * 16) * 0.5;
      put(i0 + n, (body + knock + sub) * s, pan, 0.35);
    }
  }

  function whoosh(tc, dur, dir) {
    const t0 = tc - dur * 0.85;
    const i0 = idx(t0);
    const len = Math.floor(dur * 1.25 * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const u = n / len;
      const peak = 0.68;
      const env = u < peak ? Math.pow(u / peak, 2.2) : Math.exp(-(u - peak) * 14);
      const fc = 300 * Math.pow(18, u < peak ? u / peak : 1 - (u - peak));
      f.run(noise(), fc, 2.2);
      put(i0 + n, f.bp * env * 0.5, dir * (u * 2 - 1) * 0.8, 0.2);
    }
  }

  function riser(t0, t1, amp = 1) {
    const i0 = idx(t0);
    const len = idx(t1) - i0;
    const f = new SVF(sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const u = n / len;
      f.run(noise(), 400 * Math.pow(22, u), 3);
      ph += (TAU * (180 * Math.pow(7, u))) / sr;
      const env = Math.pow(u, 2.2) * amp;
      put(i0 + n, (f.bp * 0.55 + Math.sin(ph) * 0.05) * env, Math.sin(u * 30) * 0.3 * u, 0.2);
    }
  }

  function reverse(t1, dur, amp = 1) {
    const i0 = idx(t1 - dur);
    const len = Math.floor(dur * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const u = n / len;
      f.run(noise(), 2000 + 8000 * u, 0.7);
      put(i0 + n, (f.hp * 0.5 + f.bp * 0.3) * Math.pow(u, 4) * 0.45 * amp, 0, 0.1);
    }
  }

  function tick(t0, freq = 2600, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.03 * sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      put(i0 + n, Math.sin(TAU * freq * t) * Math.exp(-t * 160) * 0.12 * amp, pan, 0.1);
    }
  }

  function glitch(t0, dur) {
    const i0 = idx(t0);
    const len = Math.floor(dur * sr);
    let p = 0;
    let f = 200;
    let seg = 0;
    for (let n = 0; n < len; n++) {
      if (n % Math.floor(sr * 0.024) === 0) {
        f = 80 + ((noise() + 1) / 2) * 1400;
        seg++;
      }
      p = (p + f / sr) % 1;
      const v = Math.round((p < 0.5 ? 1 : -1) * 4) / 4;
      put(i0 + n, v * 0.07 * (seg % 3 ? 1 : 0.2), seg % 2 ? 0.5 : -0.5, 0.05);
    }
  }

  // UI click: a soft, tactile "tock"
  function uiClick(t0, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(0.06 * sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const v = Math.sin(TAU * 1900 * t) * Math.exp(-t * 260) * 0.16 + Math.sin(TAU * 190 * t) * Math.exp(-t * 70) * 0.22;
      put(i0 + n, v * amp, 0.15, 0.08);
    }
  }

  // ─── arrangement ─────────────────────────────────────────────────────────
  const sb = (id, sec) => S[id].start + sec;

  // intro — the seal lands, the title arrives
  pad(CHORDS[0], 0, 2 * BAR - 0.2, 0.04);
  EV.intro.diamonds.forEach((t, i) => clack(t, 0.6, [-0.5, 0.5, -0.2, 0.2][i]));
  bell(77, sb('intro', 1.1), 0.8, -0.2);
  bell(81, sb('intro', 1.6), 0.6, 0.2);
  reverse(S.hook.start, 0.5, 0.8);

  // groove: gentle from the hook, full from the first demo, out before the end card
  for (let bar = S.hook.bar; bar < S.outro.bar; bar++) {
    const ch = CHORDS[bar];
    const full = bar >= S.text.bar;
    for (let b = 0; b < 4; b++) {
      const tb = at(bar, b);
      if (full || b % 2 === 0) kick(tb, 0.62);
      if (full && (b === 1 || b === 3)) clap(tb, 0.42, 0);
      hat(tb + BEAT / 2, 0.55, true, 0.25);
      if (bar >= S.image.bar) for (const x of [0.25, 0.75]) hat(tb + BEAT * x, 0.3, false, -0.25);
    }
    const pat = [0, 0, 7, 0, 0, 12, 0, 7];
    for (let e = 0; e < 8; e++) bass(ch[0] - 24 + pat[e], at(bar, e / 2), BEAT / 2 - 0.05);
    pad(ch, at(bar), BAR, 0.045);
    if (full) {
      for (let x = 0; x < 8; x++) {
        const n = ch[x % 3] + 12 * (Math.floor(x / 3) % 2) + 12;
        pluck(n, at(bar, x / 2), x % 2 ? 0.45 : 0.65, (x % 2 ? 1 : -1) * 0.3);
      }
    }
  }

  // the product's own sounds
  CLICKS.forEach((t) => uiClick(t));
  for (const [a0, a1] of TYPING) {
    let t = a0;
    let k = 0;
    while (t < a1) {
      tick(t, 3600 + (k % 4) * 250, 0.28, 0.15);
      t += 0.055 + hashNoise(k++) * 0.035;
    }
  }
  pluck(84, sb('news', EV.news.ny + 0.05), 1.0, 0.2); // the new card pops in
  pluck(88, sb('news', EV.news.ny + 0.12), 0.7, 0.3);
  whoosh(sb('image', EV.image.cropOpen + 0.05), 0.3, 1); // the crop dialog
  pluck(81, sb('image', EV.image.velgUtsnitt + 0.2), 0.9, -0.2); // new picture lands
  // published!
  [77, 81, 84, 89].forEach((m, i) => bell(m, sb('publish', EV.publish.done + i * 0.09), 0.75, (i - 1.5) * 0.3));
  whoosh(sb('publish', EV.publish.phone + 0.25), 0.4, -1);
  // benefit tiles
  for (let i = 0; i < 4; i++) tick(sb('benefits', 0.6 + i * BEAT), 2400 + i * 300, 0.7, (i - 1.5) * 0.3);

  // outro — lockup, bells, resolve
  reverse(S.outro.start, 0.5, 1.0);
  pad([41, 53, 57, 60, 64], S.outro.start, S.outro.end - S.outro.start - 0.8, 0.05);
  [0.1, 0.2, 0.3, 0.4].forEach((b, i) => clack(sb('outro', b * 1.2), 0.45, [-0.5, 0.5, -0.2, 0.2][i]));
  bell(72, sb('outro', 1.0), 0.9, -0.3);
  bell(77, sb('outro', 1.5), 0.8, 0.3);
  bell(81, sb('outro', 2.0), 0.7, -0.1);
  bell(84, sb('outro', 2.75), 0.6, 0.2);
  kick(S.outro.start, 0.6);

  for (const t of WHOOSHES) whoosh(t, 0.35, 1);

  // ─── mix ─────────────────────────────────────────────────────────────────
  // sidechain envelope from kicks
  const duck = new Float32Array(N).fill(1);
  for (const tk of kicks) {
    const i0 = idx(tk);
    for (let n = 0; n < sr * 0.4 && i0 + n < N; n++) {
      const g = 1 - 0.8 * Math.exp(-(n / sr) * 9) * Math.min(1, n / (sr * 0.004) + 0.6);
      duck[i0 + n] = Math.min(duck[i0 + n], g);
    }
  }
  for (let i = 0; i < N; i++) {
    const b = bassBus[i] * duck[i];
    L[i] += b + padL[i] * (0.5 + 0.5 * duck[i]);
    R[i] += b + padR[i] * (0.5 + 0.5 * duck[i]);
  }

  // ping-pong delay (dotted eighth)
  const dt = Math.round(BEAT * 0.75 * sr);
  for (let i = 0; i < N; i++) {
    const a = i >= dt ? dly[1][i - dt] : 0;
    const bb = i >= dt ? dly[0][i - dt] : 0;
    dly[1][i] += bb * 0.55; // L→R
    dly[0][i] += a * 0.55; // R→L
    L[i] += a * 0.5;
    R[i] += bb * 0.5;
  }

  // Freeverb-style reverb
  const scale = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491];
  const aps = [556, 441, 341];
  for (const [out, spread] of [
    [L, 0],
    [R, 23],
  ]) {
    const wet = new Float32Array(N);
    for (const cd of combs) {
      const D = Math.round((cd + spread) * scale);
      const buf = new Float32Array(D);
      let p = 0;
      let lp = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[p];
        lp = y * 0.75 + lp * 0.25;
        buf[p] = send[i] + lp * 0.86;
        p = (p + 1) % D;
        wet[i] += y;
      }
    }
    for (const ad of aps) {
      const D = Math.round((ad + spread) * scale);
      const buf = new Float32Array(D);
      let p = 0;
      for (let i = 0; i < N; i++) {
        const b = buf[p];
        const y = -wet[i] + b;
        buf[p] = wet[i] + b * 0.5;
        p = (p + 1) % D;
        wet[i] = y;
      }
    }
    for (let i = 0; i < N; i++) out[i] += wet[i] * 0.1;
  }

  // master: soft clip, normalise, edge fades
  let raw = 0;
  for (let i = 0; i < N; i++) raw = Math.max(raw, Math.abs(L[i]), Math.abs(R[i]));
  const drive = 1.5 / raw; // peaks kiss the knee; the body of the mix stays clean
  let peak = 0;
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * drive);
    R[i] = Math.tanh(R[i] * drive);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = 0.93 / peak;
  const fadeIn = Math.floor(0.004 * sr);
  const fadeOut = Math.floor(0.9 * sr);
  for (let i = 0; i < N; i++) {
    let e = g;
    if (i < fadeIn) e *= i / fadeIn;
    if (i > N - fadeOut) e *= Math.pow((N - i) / fadeOut, 1.5);
    L[i] *= e;
    R[i] *= e;
  }
  return { left: L, right: R, sampleRate: sr };
}
