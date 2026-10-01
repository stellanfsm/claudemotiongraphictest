// Procedural soundtrack for «Ditt trekk» — 120 BPM, D minor. Pure JS (no Web
// Audio needed), so the same code renders the WAV for the video in Node and
// plays live in the browser preview. Every hit is placed from the shared
// timeline, so sound and picture land on the same sample.

import { BEAT, BAR, DURATION, WHOOSHES, S, sb, COUNT, GONE, JUDGE, REBUILD, OFFER, CTA } from './timeline.js';

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
      mus(i0 + n, v, pan, 0.15, 0.5);
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

  // ─── the score's own voices ───────────────────────────────────────────────
  // Melodic parts go to a music bus that is filtered as a whole (builds and
  // breaths), and sustained chords to a second bus that also pumps with the kick.
  const musL = new Float32Array(N);
  const musR = new Float32Array(N);
  const mus = (i, v, pan = 0, rev = 0, del = 0) => {
    if (i < 0 || i >= N) return;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    musL[i] += v * gl * 1.414;
    musR[i] += v * gr * 1.414;
    if (rev) send[i] += v * rev;
    if (del) dly[pan < 0 ? 0 : 1][i] += v * del;
  };
  const S16 = BEAT / 4; // a sixteenth
  const SWING = 0.016; // late off-sixteenths

  // music box / celesta: the motif's first voice
  function celesta(note, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(2.6 * sr);
    const f = mtof(note);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const v =
        (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 4.03 * t) * Math.exp(-t * 9) + 0.14 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 4)) *
        Math.exp(-t * 2.4) *
        Math.min(1, t * 2500) *
        0.11 *
        amp;
      mus(i0 + n, v, pan, 0.6, 0.3);
    }
  }
  // the lead: two detuned saws and a square an octave down, with a little vibrato
  function lead(note, t0, dur, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor((dur + 0.3) * sr);
    const f = mtof(note);
    const flt = new SVF(sr);
    let p1 = hash(note * 3) * 0.5;
    let p2 = 0.37;
    let p3 = 0.1;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      const vib = 1 + 0.0045 * Math.sin(TAU * 5.4 * t) * Math.min(1, Math.max(0, (t - 0.12) / 0.2));
      p1 = (p1 + (f * 1.0035 * vib) / sr) % 1;
      p2 = (p2 + (f * 0.9965 * vib) / sr) % 1;
      p3 = (p3 + (f * 0.5 * vib) / sr) % 1;
      const sg = p1 * 2 - 1 + (p2 * 2 - 1) + 0.45 * (p3 < 0.5 ? 1 : -1);
      const env = Math.min(1, t * 350) * (t > dur ? Math.exp(-(t - dur) * 16) : 1) * (0.72 + 0.28 * Math.exp(-t * 6));
      flt.run(sg, 1500 + 3800 * Math.exp(-t * 6), 1.15);
      mus(i0 + n, flt.lp * env * 0.15 * amp, pan, 0.22, 0.28);
    }
  }
  // supersaw chord: stabs, swells and the final chords
  function supersaw(notes, t0, dur, amp = 1, o = {}) {
    const { attack = 0.004, release = 0.22, cut = 7000, cutEnd = null, q = 0.85, duck = false, rev = 0.3 } = o;
    const i0 = idx(t0);
    const len = Math.floor((dur + release * 4) * sr);
    const voices = [];
    for (const m of notes) [-21, -11, -4, 4, 11, 21].forEach((c, k) => voices.push({ f: mtof(m) * Math.pow(2, c / 1200), p: hash(m * 13 + k), side: k % 2 }));
    const fl = new SVF(sr);
    const fr = new SVF(sr);
    const g = (0.26 * amp) / Math.sqrt(voices.length);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      let a = 0;
      let b = 0;
      for (const v of voices) {
        v.p = (v.p + v.f / sr) % 1;
        if (v.side) a += v.p * 2 - 1;
        else b += v.p * 2 - 1;
      }
      const c = cutEnd === null ? cut : cut * Math.pow(cutEnd / cut, Math.min(1, t / dur));
      fl.run(a, c, q);
      fr.run(b, c, q);
      const env = Math.min(1, t / attack) * (t > dur ? Math.exp(-(t - dur) / release) : 1);
      const j = i0 + n;
      if (j >= N) break;
      const vl = fl.lp * env * g;
      const vr = fr.lp * env * g;
      if (duck) {
        padL[j] += vl;
        padR[j] += vr;
      } else {
        musL[j] += vl;
        musR[j] += vr;
      }
      send[j] += (vl + vr) * rev;
    }
  }
  function arpNote(note, t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.32 * sr);
    const f = new SVF(sr);
    const fr = mtof(note);
    let p = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      p = (p + fr / sr) % 1;
      const sq = (p < 0.5 ? 1 : -1) * 0.6 + (p * 2 - 1) * 0.4;
      f.run(sq, 500 + 4800 * Math.exp(-t * 26), 1.3);
      mus(i0 + n, f.lp * Math.exp(-t * 12) * 0.075 * amp, pan, 0.12, 0.35);
    }
  }
  function snare(t0, amp = 1, pan = 0) {
    const i0 = idx(t0);
    const len = Math.floor(0.25 * sr);
    const f = new SVF(sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      ph += (TAU * (185 + 60 * Math.exp(-t * 40))) / sr;
      f.run(noise(), 2600, 0.8);
      const v = Math.sin(ph) * Math.exp(-t * 28) * 0.55 + f.bp * Math.exp(-t * 17) * 0.7;
      put(i0 + n, v * 0.42 * amp, pan, 0.28);
    }
  }
  function shaker(t0, amp = 1, pan = 0.35) {
    const i0 = idx(t0);
    const len = Math.floor(0.06 * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), 9500, 0.7);
      put(i0 + n, f.hp * Math.min(1, t * 300) * Math.exp(-t * 55) * 0.13 * amp, pan, 0.04);
    }
  }
  function rim(t0, amp = 1, pan = -0.3) {
    const i0 = idx(t0);
    const len = Math.floor(0.05 * sr);
    const f = new SVF(sr);
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      f.run(noise(), 1700, 6);
      put(i0 + n, (f.bp * 1.1 + Math.sin(TAU * 820 * t) * 0.3) * Math.exp(-t * 110) * 0.25 * amp, pan, 0.18);
    }
  }
  // reese bass for the price drop: two saws drifting against each other
  function reese(note, t0, dur, amp = 1) {
    const i0 = idx(t0);
    const len = Math.floor((dur + 0.04) * sr);
    const fr = mtof(note);
    const f = new SVF(sr);
    let p1 = 0;
    let p2 = 0.5;
    let ps = 0;
    for (let n = 0; n < len; n++) {
      const t = n / sr;
      p1 = (p1 + (fr * 1.007) / sr) % 1;
      p2 = (p2 + (fr * 0.993) / sr) % 1;
      ps += (TAU * fr) / sr;
      f.run(p1 * 2 - 1 + (p2 * 2 - 1), 420 + 260 * Math.sin((t0 + t) * 3.1), 1.4);
      const env = Math.min(1, t * 300) * (t > dur ? Math.exp(-(t - dur) * 80) : 1);
      const j = i0 + n;
      if (j < N) bassBus[j] += (Math.tanh(f.lp * 1.4) * 0.22 + Math.sin(ps) * 0.3) * env * amp;
    }
  }

  // ─── harmony & motif ─────────────────────────────────────────────────────
  // D minor. The motif leaps up a seventh (D → C) for «Seventh», then falls A, F.
  const Dm9 = [50, 57, 60, 64, 65];
  const Bbmaj9 = [46, 53, 57, 60, 62];
  const Fadd9 = [53, 57, 60, 67];
  const Cadd9 = [48, 55, 62, 64];
  const Gm9 = [55, 58, 62, 65, 69];
  const A7sus = [57, 62, 64, 67];
  const A7 = [57, 61, 64, 67];
  const Dadd9 = [50, 57, 62, 64, 69];
  const Dmaj9 = [50, 57, 61, 64, 66];
  const MOTIF = [74, 84, 81, 77]; // D5 C6 A5 F5
  // phrases: [sixteenth, note, length in sixteenths]
  const PH_A = [[0, 74, 3], [3, 84, 3], [6, 81, 2], [8, 77, 4], [14, 76, 2]];
  const PH_B = [[0, 74, 6], [8, 69, 2], [10, 72, 2], [12, 74, 4]];
  const PH_A2 = [[0, 77, 3], [3, 84, 3], [6, 81, 2], [8, 79, 4], [14, 76, 2]];
  const PH_B2 = [[0, 76, 6], [8, 74, 2], [10, 72, 2], [12, 74, 4]];
  const PH_C = [[0, 74, 3], [3, 82, 3], [6, 81, 2], [8, 76, 2], [10, 74, 2], [12, 73, 4]];
  const st = (t0, k) => t0 + k * S16 + (k % 2 ? SWING : 0);
  const phrase = (t0, ph, amp = 1, oct = 0, pan = 0.1) => ph.forEach(([k, m, l]) => lead(m + oct, t0 + k * S16, l * S16 - 0.02, amp, pan));

  function drumBar(t0, o = {}) {
    const { kickOn = true, clapOn = true, hats = 1, ghost = false, perc = true, fill = false, half = false, kickUntil = Infinity } = o;
    if (kickOn) for (const k of half ? [0, 8] : [0, 4, 8, 12]) if (st(t0, k) < kickUntil - 1e-6) kick(st(t0, k), 1);
    if (kickOn && ghost) kick(st(t0, 14), 0.5);
    if (clapOn) {
      for (const k of half ? [8] : [4, 12]) {
        clap(st(t0, k), 0.9, 0);
        snare(st(t0, k), 0.6, 0);
      }
    }
    for (let k = 0; k < 16; k++) {
      if (hats <= 0) break;
      const acc = [0.32, 0.16, 0.5, 0.2][k % 4] * hats;
      if (k % 4 === 2) hat(st(t0, k), 0.75 * hats, true, 0.25);
      else hat(st(t0, k), acc, false, -0.2 + (k % 3) * 0.15);
    }
    if (perc) {
      rim(st(t0, 3), 0.55);
      rim(st(t0, 11), 0.4);
      for (const k of [1, 5, 9, 13]) shaker(st(t0, k), 0.8);
    }
    if (fill) [12, 13, 14, 15].forEach((k, j) => snare(st(t0, k), 0.45 + j * 0.15, (j % 2 ? 1 : -1) * 0.2));
  }
  function bassBar(t0, root, amp = 1, until = Infinity) {
    for (const [k, off, l] of [[0, 0, 2], [3, 0, 1], [6, 12, 1], [8, 0, 2], [11, 7, 1], [14, 12, 1]]) {
      const t = st(t0, k);
      if (t >= until - 1e-6) continue;
      bass(root + off, t, l * S16 - 0.03, amp);
    }
  }
  function arpBar(t0, chord, amp = 1, dur = BAR) {
    const notes = chord.map((m) => m + 12).filter((m) => m <= 84);
    const order = [0, 1, 2, 3, 2, 1];
    for (let k = 0; k * S16 < dur - 1e-6; k++) {
      const n = notes[order[k % order.length] % notes.length] + (k % 12 >= 6 ? 0 : 0);
      arpNote(n, st(t0, k), k % 4 === 0 ? 1 : 0.6, (k % 2 ? 1 : -1) * 0.4);
    }
  }

  // ─── arrangement ─────────────────────────────────────────────────────────
  const DROP = S.rebuild.start + REBUILD.spin; // 9.0 s — the groove starts

  // 01 COUNT — clock, heartbeat, a braam on every second, the motif on a music box
  braam([26, 38, 45], 0, 0.85, 1.25);
  subDrop(0, 0.9, 1.0);
  impact(0, 0.55);
  braam([26, 38, 44], COUNT.morphs[0], 0.85, 1.1);
  subDrop(COUNT.morphs[0], 0.6, 0.9);
  braam([26, 38, 46], COUNT.morphs[1], 0.85, 1.25);
  subDrop(COUNT.morphs[1], 0.75, 0.9);
  for (let b = 0; b < 6; b++) clockTick(b * BEAT, b % 2 === 0, 1.0);
  for (const t of [2.25, 2.75]) clockTick(t, false, 0.6); // the last second runs faster
  heartbeat(0.25, 0.7);
  heartbeat(1.25, 0.8);
  heartbeat(2.25, 1.0);
  celesta(MOTIF[0], 0.02, 1.0, -0.2);
  celesta(MOTIF[1], 1.02, 0.9, 0.2);
  celesta(MOTIF[2], 2.02, 0.9, -0.1);
  celesta(MOTIF[3], 2.52, 0.7, 0.1);
  riser(0.2, S.gone.start, 0.9);
  reverse(S.gone.start, 0.6, 1.4);
  for (let k = 0; k < 10; k++) tick(0.1 + k * 0.28, 1400 + k * 90, 0.25, k % 2 ? 0.4 : -0.4);

  // 02 GONE — the burst, then air; the motif answers itself, falling
  impact(S.gone.start, 1.3);
  subDrop(S.gone.start, 1.2, 1.8);
  crash(S.gone.start, 1.1);
  whoosh(S.gone.start + 0.18, 0.3, 1, 1.2);
  whoosh(S.gone.start + 0.22, 0.34, -1, 1.1);
  pad([38, 50, 53, 57], S.gone.start + 0.1, 2.3, 0.045);
  bell(77, S.gone.start + GONE.text, 0.8, -0.2);
  bell(76, S.gone.start + GONE.text + 0.75, 0.65, 0.2);
  bell(74, S.gone.start + GONE.text + 1.5, 0.55, -0.1);
  for (let k = 0; k < 30; k++) tick(S.gone.start + GONE.caption + k * 0.027, 3600 - (k % 3) * 400, 0.28, (k % 2 ? 1 : -1) * 0.3);
  whoosh(S.gone.start + GONE.converge + 0.3, 0.32, -1, 0.8);

  // 03 JUDGE — the phone slams in, a modem answers, the old site plays its tune
  thud(S.judge.start, 1.1);
  impact(S.judge.start, 0.6);
  dialup(S.judge.start + 0.02, 0.62, 1.7);
  cheesyLoop(S.judge.start + 0.55, S.judge.start + JUDGE.stop + 0.4, 0.4, 3.4);
  stab([62, 65, 69], S.judge.start + JUDGE.stat, 0.9, 0);
  kick(S.judge.start + JUDGE.stat, 0.6, false);
  glitch(S.judge.start + JUDGE.stop + 0.1, 0.18, 0.6);
  // the diamond falls: a short whistle down
  {
    const t0 = S.rebuild.start - 0.3;
    const i0 = idx(t0);
    const len = Math.floor(0.3 * sr);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const u = n / len;
      ph += (TAU * (2400 - 1500 * u)) / sr;
      put(i0 + n, Math.sin(ph) * u * u * 0.05, 0, 0.3);
    }
  }

  // 04 REBUILD — the move, the flip rain, the drop
  clack(S.rebuild.start, 1.4, 0, 0.85);
  impact(S.rebuild.start, 0.7);
  subDrop(S.rebuild.start, 0.8, 1.0);
  celesta(74, S.rebuild.start + 0.01, 0.9, 0);
  // one click per tile, as each one lands
  {
    const TC = 10;
    const TR = 22;
    const PHW = 0.73;
    const PHH = 1.59;
    for (let r = 0; r < TR; r++) {
      for (let cc = 0; cc < TC; cc++) {
        const u = (cc + 0.5) / TC;
        const v = (r + 0.5) / TR;
        const dist = Math.hypot((u - 0.5) * PHW, (v - 0.3) * PHH) / 1.25;
        const ts = REBUILD.land + 0.04 + dist * REBUILD.flipSpan + hash(r * 31 + cc) * 0.05;
        flipClick(S.rebuild.start + ts + REBUILD.flipDur * 0.55, 0.55 + hash(r * 7 + cc * 3) * 0.5, (u - 0.5) * 1.4);
      }
    }
  }
  riser(S.rebuild.start + 0.1, DROP, 0.9);
  [0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((x, k) => snare(S.rebuild.start + 0.5 + x * 0.5, 0.35 + k * 0.1, (k % 2 ? 1 : -1) * 0.2));
  supersaw(Cadd9, S.rebuild.start, 1.0, 0.8, { attack: 0.6, release: 0.05, cut: 350, cutEnd: 7000 });
  for (let k = 0; k < 8; k++) bass(36, S.rebuild.start + 0.5 + k * S16, S16 - 0.02, 0.45 + k * 0.05);

  // the drop
  crash(DROP, 1.2);
  impact(DROP, 1.1);
  subDrop(DROP, 1.0, 1.2);
  whoosh(DROP + 0.12, 0.5, 1, 0.9);
  supersaw(Dm9.map((m) => m + 12), DROP, 0.42, 1.2, { release: 0.3 });

  // ── drop A (9–17): Dm9 · B♭maj9 · F · Cadd9, the motif on the lead ──
  const dropA = [
    [9, Dm9, 38, PH_A],
    [11, Bbmaj9, 34, PH_B],
    [13, Fadd9, 33, PH_A2],
    [15, Cadd9, 36, PH_B2],
  ];
  dropA.forEach(([t0, ch, root, ph], i) => {
    drumBar(t0, { ghost: i % 2 === 1, fill: i === 1 });
    bassBar(t0, root);
    pad(ch, t0, BAR, 0.032);
    phrase(t0, ph, 1);
    for (let k = 0; k < 16; k += 2) arpNote(ch[(k / 2) % ch.length] + 24 > 86 ? ch[(k / 2) % ch.length] + 12 : ch[(k / 2) % ch.length] + 24, st(t0, k + 1), 0.35, (k % 4 ? 1 : -1) * 0.5);
  });
  // feature cuts: a supersaw stab of the chord under each
  REBUILD.features.forEach((f, k) => {
    const t = S.rebuild.start + f;
    const ch = t < 11 ? Dm9 : t < 13 ? Bbmaj9 : t < 15 ? Fadd9 : Cadd9;
    supersaw(ch.map((m) => m + 12), t, 0.16, k === 0 ? 1.0 : 0.85, { release: 0.12, cut: 5200 });
  });
  {
    const f1 = S.rebuild.start + REBUILD.features[0];
    [0.2, 0.27, 0.34, 0.41].forEach((x, k) => tick(f1 + x, 2200 + k * 300, 0.7, -0.5 + k * 0.1)); // palette chips
    tick(f1 + 0.12, 3200, 0.8, 0.3); // selection box
    const f2 = S.rebuild.start + REBUILD.features[1];
    for (let k = 0; k < 40; k++) keyClick(f2 + 0.18 + k * 0.021 + hash(k) * 0.008, 0.7, -0.3 + hash(k + 9) * 0.3);
    const f3 = S.rebuild.start + REBUILD.features[2];
    riser(f3 + 0.3, f3 + 0.62, 0.7);
    ding(84, f3 + 0.62, 1.1, -0.2);
    ding(91, f3 + 0.66, 0.7, 0.2);
    const f4 = S.rebuild.start + REBUILD.features[3];
    tick(f4 + 0.32, 1500, 1.2, 0.3); // click «Rediger»
    for (let k = 0; k < 26; k++) keyClick(f4 + 0.38 + k * 0.022 + hash(k + 40) * 0.006, 0.75, 0.2);
    tick(f4 + 1.1, 1500, 1.2, 0.3); // click «Lagre»
    ding(79, f4 + 1.1, 0.9, 0);
    ding(86, f4 + 1.16, 0.8, 0.2);
  }

  // 05 PROOF (16–21): the phones land on a breath; drums thin out, a 16th arpeggio carries
  thud(S.proof.start + 0.18, 0.9, -0.3);
  thud(S.proof.start + 0.3, 0.8, 0.3);
  bell(74, S.proof.start + 0.24, 0.7, -0.2);
  bell(81, S.proof.start + 0.5, 0.5, 0.2);
  for (let b = 1; b < 10; b++) tick(sb('proof', b) + 0.01, 2000 + (b % 3) * 300, 0.35, (b % 2 ? 1 : -1) * 0.35);
  [
    [17, Gm9, 31, BAR],
    [19, Bbmaj9, 34, BEAT * 2],
    [20, Cadd9, 36, BEAT * 2],
  ].forEach(([t0, ch, root, d], i) => {
    if (i === 0) drumBar(t0, { clapOn: false, hats: 0.7, perc: true });
    else if (i === 1) drumBar(t0, { clapOn: true, hats: 0.8, perc: true, fill: false });
    bassBar(t0, root, 0.75, t0 + d);
    pad(ch, t0, d, 0.036);
    arpBar(t0, ch, 0.9, d);
  });
  lead(81, 17 + 8 * S16, 6 * S16, 0.55, -0.2); // a high answer over Gm9: A5 … G5
  lead(79, 17 + 14 * S16, 6 * S16, 0.5, -0.2);
  lead(77, 19, 8 * S16, 0.55, -0.2);
  // the build into the offer: snare roll, riser, the bus filter opens (below)
  [8, 10, 12, 13, 14, 15].forEach((k, j) => snare(st(19, k), 0.4 + j * 0.11, (j % 2 ? 1 : -1) * 0.2));
  riser(S.offer.start - 1.0, S.offer.start, 0.9);
  reverse(S.offer.start, 0.5, 1.2);

  // 06 OFFER — the claim (21–23), then the second drop for the price (23–27)
  impact(S.offer.start, 0.8);
  subDrop(S.offer.start, 0.7, 1.0);
  crash(S.offer.start, 0.8);
  supersaw(Bbmaj9.map((m) => m + 12), 21, 0.95, 0.9, { release: 0.2, cut: 3200, cutEnd: 6500, duck: true });
  supersaw(Cadd9.map((m) => m + 12), 22, 0.95, 0.95, { release: 0.15, cut: 3500, cutEnd: 9000, duck: true });
  drumBar(21, { clapOn: true, hats: 0.9, fill: false });
  bassBar(21, 34, 1, 22);
  bassBar(22, 36, 1, 23);
  // a rising run into the price
  [74, 76, 77, 79, 81, 82, 84, 86].forEach((m, k) => lead(m, 22 + k * (BEAT / 4), BEAT / 4 - 0.02, 0.7 + k * 0.04, 0));
  whoosh(S.offer.start + OFFER.strike + 0.12, 0.2, 1, 1.0);
  impact(S.offer.start + OFFER.strike, 0.4);
  riser(S.offer.start + OFFER.drums - 0.9, S.offer.start + OFFER.drums, 0.8);
  [8, 10, 12, 13, 14, 15].forEach((k, j) => snare(st(21, k), 0.4 + j * 0.12, (j % 2 ? 1 : -1) * 0.2));
  const P0 = S.offer.start + OFFER.drums; // 23.0
  impact(P0, 0.8);
  subDrop(P0, 0.9, 1.0);
  crash(P0, 0.9);
  supersaw(Dm9.map((m) => m + 12), P0, 0.4, 1.1, { release: 0.3 });
  // drop B: Dm9 · Gm9 → A7sus → A7, the motif in octaves over a reese bass
  drumBar(P0, { ghost: true });
  drumBar(P0 + BAR, { ghost: false, fill: false, kickOn: true, kickUntil: S.cta.start - BEAT });
  reese(38, P0, BAR - 0.05, 1);
  bassBar(P0, 38, 0.5);
  reese(31, P0 + BAR, BEAT * 2 - 0.05, 1);
  reese(33, P0 + BAR + BEAT * 2, BEAT * 2 - 0.05, 1);
  pad(Dm9, P0, BAR, 0.032);
  pad(Gm9, P0 + BAR, BEAT * 2, 0.032);
  pad(A7sus, P0 + BAR + BEAT * 2, BEAT, 0.032);
  pad(A7, P0 + BAR + BEAT * 3, BEAT, 0.032, 1);
  phrase(P0, PH_A, 0.8);
  phrase(P0, PH_A, 0.45, 12, -0.25);
  phrase(P0 + BAR, PH_C, 0.85);
  phrase(P0 + BAR, PH_C, 0.4, 12, -0.25);
  OFFER.land.forEach((tl, k) => {
    ratchet(P0, S.offer.start + tl, 0.9, -0.45 + k * 0.3);
    clack(S.offer.start + tl, 0.8, -0.45 + k * 0.3, 1.3);
  });
  supersaw([62, 65, 69, 74], S.offer.start + OFFER.land[3] + 0.02, 0.2, 0.9, { release: 0.15, cut: 6000 });
  OFFER.checks.forEach((c, k) => {
    tick(S.offer.start + c + 0.01, 3000, 0.9, 0.35);
    ding([86, 88, 89, 93][k], S.offer.start + c + 0.08, 0.8, 0.2);
  });
  for (let k = 0; k < 24; k++) tick(S.offer.start + OFFER.vat + k * 0.019, 3900 - (k % 3) * 450, 0.25, -0.2);
  // build into the CTA: the kick drops for the last beat, the roll climbs on A
  riser(S.cta.start - BAR / 2, S.cta.start, 1.5);
  [0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((x, k) => snare(S.cta.start - BAR / 2 + x * (BAR / 2), 0.5 + k * 0.12, (k % 2 ? 1 : -1) * 0.2));
  for (let k = 0; k < 8; k++) bass(33 + (k % 2) * 12, S.cta.start - BEAT + k * (BEAT / 8), BEAT / 8 - 0.005, 0.8);
  for (let k = 0; k < 18; k++) flipClick(S.cta.start - 0.28 + k * 0.016, 0.5, -0.8 + k * 0.1);

  // 07 CTA — «Ditt trekk.» Dark and still, a chess clock; then the sonic logo, and D major
  const C0 = S.cta.start;
  impact(C0, 1.0);
  subDrop(C0, 1.1, 1.8);
  crash(C0, 1.0);
  braam([26, 38, 45, 50], C0, 1.6, 0.9);
  supersaw(Dadd9, C0, 2.0, 0.75, { attack: 0.25, release: 0.4, cut: 1400, cutEnd: 3200, duck: true, rev: 0.45 });
  pad([38, 50, 53, 57, 62], C0, 2.2, 0.045);
  clack(C0 + CTA.move + 0.12, 1.5, 0, 0.8);
  thud(C0 + CTA.move + 0.12, 0.8, 0);
  celesta(74, C0 + CTA.move + 0.12, 0.9, -0.2);
  // a chess clock: your move, the seconds are running (a callback to the hook)
  for (let k = 0; k < 4; k++) clockTick(C0 + CTA.move + 0.5 + k * BEAT, k % 2 === 0, 0.9);
  for (let k = 0; k < 4; k++) heartbeat(C0 + CTA.move + 0.62 + k * BEAT * 2, 0.55);
  // the crane: B♭maj9 swelling into C
  supersaw(Bbmaj9, C0 + CTA.crane, 0.65, 0.8, { attack: 0.3, release: 0.1, cut: 900, cutEnd: 5000, duck: true });
  supersaw(Cadd9, C0 + CTA.crane + 0.65, 0.65, 0.9, { attack: 0.05, release: 0.1, cut: 2500, cutEnd: 9000, duck: true });
  whoosh(C0 + CTA.crane + 0.5, 0.7, -1, 0.9);
  riser(C0 + CTA.crane, C0 + CTA.burst, 0.8);
  impact(C0 + CTA.burst, 0.8);
  crash(C0 + CTA.burst, 0.7);
  // the sonic logo: each diamond lands on a note of the motif
  CTA.diamonds.forEach((d, i) => {
    clack(C0 + d, 0.7, [-0.5, 0.5, -0.2, 0.2][i], 1.05);
    celesta(MOTIF[i], C0 + d, 1.1, [-0.5, 0.5, -0.2, 0.2][i]);
    lead(MOTIF[i], C0 + d, 0.13, 0.7, [-0.5, 0.5, -0.2, 0.2][i]);
  });
  const lock = C0 + CTA.lockup;
  kick(lock, 1.0, false);
  subDrop(lock, 0.9, 1.6);
  crash(lock, 0.8);
  supersaw(Dmaj9.map((m) => m + 12), lock, 0.55, 1.15, { release: 0.6, cut: 7000, rev: 0.45 });
  pad(Dmaj9, lock, S.cta.end - lock - 0.4, 0.05);
  bell(78, lock + 0.05, 1, -0.3); // F♯ — the major third, the turn to the light
  bell(81, lock + 0.3, 0.85, 0.3);
  bell(86, lock + 0.55, 0.75, -0.1);
  ding(93, C0 + CTA.button + 0.05, 0.6, 0);
  tick(C0 + CTA.tap, 1500, 1.4, 0.3);
  ding(86, C0 + CTA.tap + 0.02, 0.8, 0.3);
  for (let k = 0; k < 14; k++) tick(C0 + CTA.lines + 0.15 + k * 0.03, 3600 - (k % 3) * 300, 0.25, 0.1);
  // the end card: a light pulse in D major, the motif resolving F♯ → E → D
  for (let t = lock + BEAT; t < S.cta.end - 1.0 - 1e-6; t += BEAT) {
    kick(t, 0.55, false);
    hat(t + BEAT / 2, 0.6, true, 0.25);
    hat(t + BEAT * 0.25, 0.3, false, -0.25);
    hat(t + BEAT * 0.75, 0.3, false, -0.25);
    shaker(t + BEAT * 0.25 + SWING, 0.6);
  }
  for (let x = 0; x < 4; x++) arpNote([62, 66, 69, 74][x % 4] + 12, lock + 0.8 + x * (BEAT / 2), 0.5, (x % 2 ? 1 : -1) * 0.4);
  lead(78, lock + 0.8, 0.42, 0.6, 0.1);
  lead(76, lock + 1.3, 0.2, 0.55, 0.1);
  lead(74, lock + 1.55, 0.6, 0.6, 0.1);
  const END = S.cta.end - 1.0; // 32 s
  kick(END, 0.9, false);
  subDrop(END, 0.7, 1.0);
  crash(END, 0.6);
  supersaw(Dmaj9.map((m) => m + 12), END, 0.5, 1.0, { release: 0.5, cut: 6000, rev: 0.5 });
  bell(74 + 12, END, 0.8, 0);
  bell(69 + 12, END, 0.5, 0.2);
  celesta(86, END + 0.01, 0.8, 0);

  // whooshes from the shared timeline
  for (const w of WHOOSHES) whoosh(w.t, w.dur, w.dir, 0.9);

  // the music bus filter: closed for builds and breaths, open for drops
  const busCut = (t) => {
    const ramp = (a, b, f0, f1) => f0 * Math.pow(f1 / f0, Math.min(1, Math.max(0, (t - a) / (b - a))));
    if (t >= 16.0 && t < 17.0) return t < 16.12 ? ramp(16.0, 16.12, 18000, 1600) : ramp(16.12, 17.0, 1600, 18000);
    if (t >= 20.0 && t < 21.0) return ramp(20.0, 21.0, 1400, 18000);
    if (t >= 26.0 && t < 27.0) return ramp(26.0, 27.0, 900, 18000);
    if (t >= 27.0 && t < 30.3) return ramp(27.0, 30.3, 3800, 9000);
    return 18000;
  };

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
  {
    const fl = new SVF(sr);
    const fr = new SVF(sr);
    for (let i = 0; i < N; i++) {
      const b = bassBus[i] * duck[i];
      const g = 0.45 + 0.55 * duck[i];
      const c = busCut(i / sr);
      const ml = musL[i] + padL[i] * g;
      const mr = musR[i] + padR[i] * g;
      const yl = c >= 17999 ? ml : fl.run(ml, c, 0.9);
      const yr = c >= 17999 ? mr : fr.run(mr, c, 0.9);
      if (c >= 17999) {
        fl.run(ml, 18000, 0.9);
        fr.run(mr, 18000, 0.9);
      }
      L[i] += b + yl;
      R[i] += b + yr;
    }
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
  const g = 0.86 / peak; // ≈ −1.3 dBFS, headroom for the AAC encode
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
