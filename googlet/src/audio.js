// Procedural soundtrack for «Kunden googlet deg» — 120 BPM, D minor. Pure JS (no Web
// Audio needed), so the same code renders the WAV for the video in Node and
// plays live in the browser preview. Every hit is placed from the shared
// timeline, so sound and picture land on the same sample.

import { BEAT, BAR, DURATION, WHOOSHES, S, HOOK, STAT, BUILD, PRICE, REVEAL, CTA } from './timeline.js';

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
function hash(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
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
  function kick(t0, amp = 1, duck = true) {
    if (duck) kicks.push([t0, amp]);
    const i0 = idx(t0);
    const len = Math.floor(0.5 * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const f = 46 + 140 * Math.exp(-t * 30);
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
  function crash(t0, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(2.2 * sr);
    const f = new SVF(sr);
    const f2 = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), 6000, 0.6);
      f2.run(noise(), 9000, 0.7);
      const env = Math.exp(-t * 2.2) * Math.min(1, t * 300);
      put(i0 + n, f.hp * env * 0.16 * amp, -0.35, 0.3);
      put(i0 + n, f2.hp * env * 0.16 * amp, 0.35, 0.3);
    }
  }

  // ─── tonal ───────────────────────────────────────────────────────────────
  function bass(note, t0, dur, amp = 1) {
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
      if (j < N) bassBus[j] += f.lp * env * 0.34 * amp;
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
    const len = Math.floor(0.26 * sr);
    const f = new SVF(sr);
    const ph = notes.map(() => 0);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let s = 0;
      notes.forEach((m, k) => {
        ph[k] = (ph[k] + (mtof(m) * (1 + (k - 1) * 0.004)) / sr) % 1;
        s += ph[k] * 2 - 1;
      });
      f.run(s, 600 + 6000 * Math.exp(-t * 16), 1.3);
      put(i0 + n, f.lp * Math.exp(-t * 10) * 0.12 * amp, pan, 0.3);
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
  // trailer «braam»: stacked detuned saws, opening filter, driven
  function braam(notes, t0, dur, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor((dur + 0.9) * sr);
    const voices = [];
    for (const m of notes) for (const d of [-12, -4, 0, 5, 11]) voices.push({ f: mtof(m) * Math.pow(2, d / 1200), p: hash(m * 7 + d) });
    const fl = new SVF(sr);
    const fr = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let sl = 0;
      let srr = 0;
      voices.forEach((v, k) => {
        v.p = (v.p + v.f / sr) % 1;
        const s = v.p * 2 - 1;
        if (k % 2) sl += s;
        else srr += s;
      });
      const cut = 180 + 2600 * Math.exp(-t * 3.2) * Math.min(1, t * 30);
      fl.run(sl, cut, 1.4);
      fr.run(srr, cut, 1.4);
      const env = Math.min(1, t * 90) * (t > dur ? Math.exp(-(t - dur) * 4) : 1) * Math.exp(-t * 0.9);
      const g = 0.11 * amp * env;
      put(i0 + n, Math.tanh(fl.lp * 0.6) * g, -0.5, 0.4 * g);
      put(i0 + n, Math.tanh(fr.lp * 0.6) * g, 0.5, 0.4 * g);
    }
  }
  function subDrop(t0, amp = 1, dur = 1.4) {
    const i0 = idx(t0);
    const len = Math.floor(dur * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (38 + 70 * Math.exp(-t * 5))) / sr;
      put(i0 + n, Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 2.2) * Math.min(1, t * 600) * 0.5 * amp);
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
  function thud(t0, s, pan = -0.2) {
    const i0 = idx(t0);
    const len = Math.floor(0.4 * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (70 + 160 * Math.exp(-t * 22))) / sr;
      put(i0 + n, Math.sin(ph) * Math.exp(-t * 11) * 0.8 * s + noise() * Math.exp(-t * 90) * 0.2 * s, pan, 0.25);
    }
  }
  // a wooden chess piece set down on the board
  function clack(t0, s, pan = 0, pitch = 1) {
    const i0 = idx(t0);
    const len = Math.floor(0.3 * sr);
    const f = new SVF(sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (620 * pitch + 300 * Math.exp(-t * 60))) / sr;
      f.run(noise(), 2400 * pitch, 4);
      const body = Math.sin(ph) * Math.exp(-t * 38) * 0.55 + Math.sin(ph * 2.7) * Math.exp(-t * 60) * 0.25;
      const knock = f.bp * Math.exp(-t * 90) * 0.9;
      let sub = 0;
      if (t < 0.25) sub = Math.sin(TAU * 55 * t) * Math.exp(-t * 14) * 0.6;
      put(i0 + n, (body + knock + sub) * s, pan, 0.45);
    }
  }
  function whoosh(tc, dur, dir, amp = 1) {
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
      put(i0 + n, f.bp * env * 0.5 * amp, dir * (u * 2 - 1) * 0.8, 0.2);
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
  // clock escapement: a woody click with a short metallic ring
  function clockTick(t0, hi, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(0.12 * sr);
    const f = new SVF(sr);
    const fr = hi ? 3100 : 2300;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), fr, 6);
      const v = f.bp * Math.exp(-t * 70) * 0.9 + Math.sin(TAU * fr * 1.5 * t) * Math.exp(-t * 90) * 0.15;
      put(i0 + n, v * 0.5 * amp, hi ? 0.25 : -0.25, 0.25);
    }
  }
  function heartbeat(t0, amp = 1) {
    for (const [o, a] of [
      [0, 1],
      [0.16, 0.7],
    ]) {
      const i0 = idx(t0 + o);
      const len = Math.floor(0.25 * sr);
      let ph = 0;
      for (let n = 0; n < len; n++) {
        const t = n / sr;
        ph += (TAU * (48 + 30 * Math.exp(-t * 30))) / sr;
        put(i0 + n, Math.sin(ph) * Math.exp(-t * 16) * Math.min(1, t * 400) * 0.6 * a * amp);
      }
    }
  }
  function flipClick(t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.05 * sr);
    const f = new SVF(sr);
    const fr = 3200 + hash(i0) * 2600;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), fr, 5);
      put(i0 + n, (f.bp * 0.8 + Math.sin(TAU * 180 * t) * 0.25) * Math.exp(-t * 130) * 0.26 * amp, pan, 0.12);
    }
  }
  function keyClick(t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.04 * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), 1800 + hash(i0 + 3) * 1500, 2.5);
      put(i0 + n, f.bp * Math.exp(-t * 150) * 0.3 * amp, pan, 0.05);
    }
  }
  function ding(note, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.9 * sr);
    const fc = mtof(note);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const v = (Math.sin(TAU * fc * t) + Math.sin(TAU * fc * 2.01 * t) * 0.35 * Math.exp(-t * 8)) * Math.exp(-t * 5) * Math.min(1, t * 900) * 0.085 * amp;
      put(i0 + n, v, pan, 0.4);
      if (i0 + n < N) dly[1][i0 + n] += v * 0.3;
    }
  }
  function ratchet(t0, t1, amp = 1, pan = 0) {
    // ticks that slow down as a drum lands
    let t = t0;
    let k = 0;
    while (t < t1) {
      const u = (t - t0) / (t1 - t0);
      tick(t, 1900 + (k % 3) * 250, 0.55 * amp * (1 - u * 0.4), pan);
      t += 0.022 + u * u * 0.09;
      k++;
    }
  }
  function glitch(t0, dur, amp = 1) {
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
      put(i0 + n, v * 0.06 * amp * (seg % 3 ? 1 : 0.2), seg % 2 ? 0.5 : -0.5, 0.05);
    }
  }
  // the old internet: a dial-up handshake
  function dialup(t0, dur, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(dur * sr);
    const f = new SVF(sr);
    let p1 = 0;
    let p2 = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const u = t / dur;
      let v = 0;
      if (u < 0.22) {
        // answer tone
        p1 += (TAU * 2100) / sr;
        v = Math.sin(p1) * 0.35;
      } else if (u < 0.5) {
        // warbling carrier pair
        p1 += (TAU * (1200 + 600 * (Math.floor(t * 38) % 2))) / sr;
        p2 += (TAU * 2400) / sr;
        v = Math.sin(p1) * 0.3 + Math.sin(p2) * 0.18;
      } else {
        // the screech
        f.run(noise(), 1800 + 1400 * Math.sin(t * 90), 3);
        p1 += (TAU * (980 + 400 * Math.sin(t * 260))) / sr;
        v = f.bp * 0.7 + Math.sin(p1) * 0.2;
      }
      const env = Math.min(1, t * 200) * Math.min(1, (dur - t) * 30);
      // tiny telephone speaker: band-limit
      put(i0 + n, v * env * 0.3 * amp, 0.15, 0.08);
    }
  }
  // a cheesy MIDI-organ loop for the old site, rendered to a buffer so it can tape-stop
  function cheesyLoop(t0, t1, stopDur, amp = 1) {
    const dur = t1 - t0;
    const n = Math.floor(dur * sr);
    const buf = new Float32Array(n + sr);
    const mel = [74, 77, 81, 77, 74, 72, 69, 72, 74, 77, 81, 84, 81, 77, 74, 72];
    const step = BEAT / 2;
    for (let k = 0; k * step < dur + step; k++) {
      const m = mel[k % mel.length];
      const s0 = Math.floor(k * step * sr);
      const L0 = Math.floor(step * 0.9 * sr);
      let p = 0;
      let q = 0;
      for (let j = 0; j < L0 && s0 + j < buf.length; j++) {
        const t = j / sr;
        p = (p + mtof(m) / sr) % 1;
        q = (q + mtof(m - 12) / sr) % 1;
        const sq = (p < 0.5 ? 1 : -1) * 0.5 + (q < 0.5 ? 1 : -1) * 0.25;
        buf[s0 + j] += sq * Math.exp(-t * 5) * 0.08;
      }
      // oom-pah bass on the beat
      if (k % 2 === 0) {
        const bm = [50, 45, 46, 45][Math.floor(k / 4) % 4] - 12;
        let pb = 0;
        for (let j = 0; j < Math.floor(0.18 * sr) && s0 + j < buf.length; j++) {
          pb = (pb + mtof(bm) / sr) % 1;
          buf[s0 + j] += Math.sin(pb * TAU) * Math.exp(-(j / sr) * 12) * 0.12;
        }
      }
    }
    // play it back, then slow it to a stop (tape stop)
    const i0 = idx(t0);
    const stopAt = dur - stopDur;
    let pos = 0;
    for (let j = 0; j < n; j++) {
      const t = j / sr;
      const rate = t < stopAt ? 1 : Math.max(0, 1 - (t - stopAt) / stopDur) ** 1.4;
      pos += rate;
      const k0 = Math.floor(pos);
      const fr = pos - k0;
      const v = (buf[k0] ?? 0) * (1 - fr) + (buf[k0 + 1] ?? 0) * fr;
      const env = Math.min(1, t * 40);
      put(i0 + j, v * env * amp, -0.1, 0.1);
    }
  }

  // ─── extra voices for this reel ──────────────────────────────────────────
  // Norwegian ringback: 425 Hz, 1 s on
  function ringback(t0, dur, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(dur * sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const env = Math.min(1, t * 200) * Math.min(1, (dur - t) * 200);
      put(i0 + n, Math.sin(TAU * 425 * t) * env * 0.09 * amp, 0.1, 0.05);
    }
  }
  function buzz(t0, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor(0.22 * sr);
    const f = new SVF(sr);
    let p = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      p = (p + 110 / sr) % 1;
      f.run(p * 2 - 1, 900, 2);
      put(i0 + n, f.lp * Math.exp(-t * 9) * Math.min(1, t * 500) * 0.35 * amp, 0, 0.2);
    }
  }
  const Dm = [50, 53, 57];
  const Bb = [46, 50, 53];
  const C = [48, 52, 55];
  const F = [53, 57, 60];
  const Gm = [55, 58, 62];
  const A = [57, 61, 64];
  // chord per bar (2 s); bar k covers [2k, 2k + 2)
  const CH = [Dm, Dm, Dm, Bb, Dm, Bb, F, C, Dm, Bb, Gm, A, Dm, Bb, F, C, Dm, Dm];
  const chordAt = (t) => CH[Math.min(CH.length - 1, Math.floor(t / BAR + 1e-6))];

  // ─── arrangement ─────────────────────────────────────────────────────────
  // 01 HOOK — the search: a low pulse, keys, results pop, the flag, a call to the competitor
  pad([38, 50, 53, 57], 0, S.stat.start, 0.04);
  subDrop(0, 0.6, 1.0);
  for (let b = 0; b < 9; b++) clockTick(b * BEAT, b % 2 === 0, 0.55);
  heartbeat(0.25, 0.6);
  heartbeat(1.25, 0.7);
  heartbeat(2.25, 0.8);
  heartbeat(3.25, 0.9);
  for (let k = 0; k < 6; k++) keyClick(0.06 + k * 0.1, 0.9, 0.1);
  [0, 1, 2].forEach((k) => tick(S.hook.start + HOOK.results + k * 0.11 + 0.15, 2600 + k * 300, 0.7, -0.3 + k * 0.3));
  buzz(HOOK.flag, 1.0);
  impact(HOOK.flag, 0.5);
  glitch(HOOK.flag + 0.02, 0.16, 0.5);
  bell(65, HOOK.swap, 0.6, -0.2);
  tick(HOOK.tap, 1500, 1.2, 0.2);
  ringback(HOOK.call + 0.25, 1.0, 1.0);
  riser(S.stat.start - 1.0, S.stat.start, 0.6);
  reverse(S.stat.start, 0.45, 1.1);

  // 02 STAT — seven of ten light up
  impact(S.stat.start, 0.9);
  subDrop(S.stat.start, 0.9, 1.4);
  crash(S.stat.start, 0.6);
  pad([38, 50, 53, 57], S.stat.start, S.build.start - S.stat.start, 0.05);
  for (let i = 0; i < 7; i++) tick(S.stat.start + STAT.icons + 0.5 + i * 0.09, 1800 + i * 200, 0.9, (i / 6) * 1.2 - 0.6);
  bell(74, S.stat.start + STAT.line, 0.8, 0.2);
  for (let k = 0; k < 20; k++) tick(S.stat.start + STAT.src + k * 0.024, 3600 - (k % 3) * 400, 0.22, -0.2);

  // 03 BUILD — the logo sting, then the groove starts as the draft is built
  const B0 = S.build.start;
  [0.05, 0.15, 0.25, 0.35].forEach((x, i) => clack(B0 + x, 0.85, [-0.5, 0.5, -0.2, 0.2][i]));
  thud(B0 + 0.35, 0.7);
  bell(74, B0 + 0.4, 1, -0.3);
  bell(81, B0 + 0.7, 0.8, 0.3);
  whoosh(B0 + BUILD.phone + 0.2, 0.4, -1, 0.9);
  // each wireframe block pops, then each one takes colour
  for (let i = 0; i < 8; i++) tick(B0 + BUILD.wire + (i / 8) * (BUILD.design - 0.1 - BUILD.wire) + 0.05, 2400 + i * 160, 0.8, (i % 2 ? 1 : -1) * 0.3);
  for (let i = 0; i < 8; i++) pluck(74 + [0, 3, 7, 10, 12, 15, 19, 22][i], B0 + BUILD.design + (i / 8) * 1.6 * 0.7, 0.9, (i % 2 ? 1 : -1) * 0.4);
  ding(86, B0 + BUILD.design + 1.6, 0.9, 0);
  impact(B0 + BUILD.design, 0.5);

  // the groove: from the first build line to the end card
  const G0 = B0 + BUILD.t1; // 8.5 s
  const G1 = S.cta.start;
  const DROP = S.reveal.start;
  for (let t = G0; t < G1 - 1e-6; t += BEAT) {
    const b = Math.round((t - G0) / BEAT);
    const ch = chordAt(t);
    const light = t < S.price.start; // the build: kick and hats only
    const preDrop = t >= DROP - BEAT * 2 && t < DROP;
    if (!preDrop) kick(t, light ? 0.85 : 1);
    if (!light && b % 2 === 1 && !preDrop) clap(t, 1, 0);
    hat(t + BEAT / 2, light ? 0.6 : 0.9, true, 0.25);
    if (!light) for (const x of [0.25, 0.75]) hat(t + BEAT * x, 0.5, false, -0.25);
    if (!preDrop) {
      const pat = [0, 12, 0, 7];
      for (let e = 0; e < 2; e++) bass(ch[0] - 24 + pat[(b * 2 + e) % 4], t + (e * BEAT) / 2, BEAT / 2 - 0.04, light ? 0.7 : 1);
    }
  }
  for (let k = Math.floor(G0 / BAR); k * BAR < G1 - 1e-6; k++) {
    const t = Math.max(G0, k * BAR);
    const d = Math.min(G1, (k + 1) * BAR) - t;
    const ch = CH[Math.min(CH.length - 1, k)];
    pad(ch, t, d, 0.05, k * BAR + BAR >= DROP && k * BAR < DROP ? 1 : 0);
    if (t >= S.price.start) {
      for (let x = 0; x < d / (BEAT / 2) - 1e-6; x++) {
        const n = ch[x % 3] + 12 * (Math.floor(x / 3) % 2) + 12;
        pluck(n, t + x * (BEAT / 2), x % 4 === 0 ? 1.1 : 0.7, (x % 2 ? 1 : -1) * 0.35);
      }
    }
  }

  // 04 PRICE — the anchor is struck through, our price lands, the list ticks
  const P0 = S.price.start;
  impact(P0, 0.8);
  subDrop(P0, 0.7, 1.0);
  crash(P0, 0.7);
  whoosh(P0 + PRICE.strike + 0.12, 0.22, 1, 1.0);
  impact(P0 + PRICE.strike, 0.4);
  stab([62, 65, 69, 74], P0 + PRICE.price, 1.3, 0);
  impact(P0 + PRICE.price, 0.6);
  PRICE.checks.forEach((c, k) => {
    tick(P0 + c + 0.01, 3000, 0.9, 0.35);
    ding([81, 84, 86, 89][k], P0 + c + 0.08, 0.85, 0.2);
  });
  for (let k = 0; k < 18; k++) tick(P0 + PRICE.vat + k * 0.018, 3900 - (k % 3) * 450, 0.25, -0.2);
  riser(DROP - BAR / 2, DROP, 1.3);
  [0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((x, k) => clap(DROP - BAR / 2 + x * (BAR / 2), 0.5 + k * 0.12, (k % 2 ? 1 : -1) * 0.2));

  // 05 REVEAL — the drop, the spin, then your phone rings
  impact(DROP, 1.2);
  subDrop(DROP, 1.1, 1.6);
  crash(DROP, 1.2);
  stab([62, 65, 69, 74], DROP, 1.4, 0);
  whoosh(DROP + 0.2, 0.6, 1, 1.0);
  bell(74, DROP + REVEAL.t1, 0.8, -0.2);
  whoosh(DROP + REVEAL.search, 0.3, -1, 0.8);
  tick(DROP + REVEAL.tap, 1500, 1.2, 0.2);
  ringback(DROP + REVEAL.call + 0.25, 1.0, 1.0);
  bell(81, DROP + REVEAL.t3, 0.8, 0.2);
  reverse(S.cta.start, 0.5, 1.2);

  // 06 CTA — the lockup and a light pulse, resolving on the last bar
  const C0 = S.cta.start;
  impact(C0, 0.8);
  subDrop(C0, 0.8, 1.4);
  [0.15, 0.25, 0.35, 0.45].forEach((x, i) => clack(C0 + x, 0.55, [-0.5, 0.5, -0.2, 0.2][i]));
  pad([38, 50, 57, 62, 65, 69], C0, S.cta.end - C0 - 0.4, 0.055);
  bell(74, C0 + 0.5, 1, -0.3);
  bell(77, C0 + 0.75, 0.9, 0.3);
  bell(81, C0 + 1.0, 0.8, -0.1);
  ding(93, C0 + CTA.button + 0.05, 0.6, 0);
  tick(C0 + CTA.tap, 1500, 1.4, 0.3);
  ding(86, C0 + CTA.tap + 0.02, 0.8, 0.3);
  for (let k = 0; k < 14; k++) tick(C0 + CTA.lines + 0.15 + k * 0.03, 3600 - (k % 3) * 300, 0.25, 0.1);
  for (let t = C0 + BEAT * 2; t < S.cta.end - 1.0 - 1e-6; t += BEAT) {
    kick(t, 0.5, false);
    hat(t + BEAT / 2, 0.6, true, 0.25);
    hat(t + BEAT * 0.25, 0.35, false, -0.25);
    hat(t + BEAT * 0.75, 0.35, false, -0.25);
  }
  for (let x = 0; x < 8; x++) pluck([62, 65, 69, 74][x % 4] + 12, C0 + 1.6 + x * (BEAT / 2), 0.6, (x % 2 ? 1 : -1) * 0.4);
  kick(S.cta.end - 1.0, 0.8, false);
  subDrop(S.cta.end - 1.0, 0.6, 1.0);
  crash(S.cta.end - 1.0, 0.5);
  bell(74, S.cta.end - 1.0, 0.8, 0);
  bell(81, S.cta.end - 1.0, 0.5, 0.2);

  for (const w of WHOOSHES) whoosh(w.t, w.dur, w.dir, 0.9);

  // ─── mix ─────────────────────────────────────────────────────────────────
  // sidechain from the groove's kicks
  const duck = new Float32Array(N).fill(1);
  for (const [tk] of kicks) {
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
    dly[1][i] += bb * 0.5;
    dly[0][i] += a * 0.5;
    L[i] += a * 0.45;
    R[i] += bb * 0.45;
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
  const drive = 1.6 / raw;
  let peak = 0;
  for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * drive);
    R[i] = Math.tanh(R[i] * drive);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const g = 0.93 / peak;
  const fadeIn = Math.floor(0.002 * sr);
  const fadeOut = Math.floor(0.8 * sr);
  for (let i = 0; i < N; i++) {
    let e = g;
    if (i < fadeIn) e *= i / fadeIn;
    if (i > N - fadeOut) e *= Math.pow((N - i) / fadeOut, 1.5);
    L[i] *= e;
    R[i] *= e;
  }
  return { left: L, right: R, sampleRate: sr };
}
