// Procedural soundtrack for «Ditt trekk» — 120 BPM, D minor. Pure JS (no Web
// Audio needed), so the same code renders the WAV for the video in Node and
// plays live in the browser preview. Every hit is placed from the shared
// timeline, so sound and picture land on the same sample.

import { BEAT, BAR, DURATION, HITS, WHOOSHES, CHORDS, S, sb, COUNT, GONE, JUDGE, REBUILD, PROOF, OFFER, CTA } from './timeline.js';

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

  // ─── arrangement ─────────────────────────────────────────────────────────
  const DROP = S.rebuild.start + REBUILD.spin; // 9.0 s — the groove starts

  // 01 COUNT — clock, heartbeat, a braam on every second
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
  riser(0.2, S.gone.start, 0.9);
  reverse(S.gone.start, 0.6, 1.4);
  for (let k = 0; k < 10; k++) tick(0.1 + k * 0.28, 1400 + k * 90, 0.25, k % 2 ? 0.4 : -0.4);

  // 02 GONE — the burst, then air
  impact(S.gone.start, 1.3);
  subDrop(S.gone.start, 1.2, 1.8);
  crash(S.gone.start, 1.1);
  whoosh(S.gone.start + 0.18, 0.3, 1, 1.2);
  whoosh(S.gone.start + 0.22, 0.34, -1, 1.1);
  pad([38, 50, 53, 57], S.gone.start + 0.1, 2.3, 0.045);
  bell(74, S.gone.start + GONE.text, 0.8, -0.2);
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
  [0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((x, k) => clap(S.rebuild.start + 0.5 + x * 0.5, 0.3 + k * 0.1, (k % 2 ? 1 : -1) * 0.2));
  pad([38, 50, 53, 57], S.rebuild.start, 1.0, 0.04, 1);
  crash(DROP, 1.2);
  impact(DROP, 1.1);
  subDrop(DROP, 1.0, 1.2);
  whoosh(DROP + 0.12, 0.5, 1, 0.9);

  // the groove: from the drop to the end card
  const G0 = DROP;
  const G1 = S.cta.start;
  for (let t = G0; t < G1 - 1e-6; t += BEAT) {
    const b = Math.round((t - G0) / BEAT);
    const barIdx = Math.floor(t / BAR + 1e-6);
    const ch = CHORDS[Math.min(CHORDS.length - 1, barIdx)];
    const inProof = t >= S.proof.start && t < S.proof.start + BAR;
    const buildOffer = t >= S.offer.start + OFFER.drums - BAR / 2 && t < S.offer.start + OFFER.drums;
    const buildCta = t >= S.cta.start - BEAT;
    if (!buildOffer && !buildCta) kick(t, 1);
    if (b % 2 === 1 && !buildCta) clap(t, inProof ? 0.8 : 1, 0);
    hat(t + BEAT / 2, 0.9, true, 0.25);
    for (const x of [0.25, 0.75]) hat(t + BEAT * x, 0.5, false, -0.25);
    // bass: eighths with an octave bounce
    if (!buildCta) {
      const pat = [0, 12, 0, 7];
      for (let e = 0; e < 2; e++) bass(ch[0] - 24 + pat[(b * 2 + e) % 4], t + (e * BEAT) / 2, BEAT / 2 - 0.04, inProof ? 0.7 : 1);
    }
  }
  for (let k = Math.floor(G0 / BAR); k * BAR < G1 - 1e-6; k++) {
    const t = Math.max(G0, k * BAR);
    const d = Math.min(G1, (k + 1) * BAR) - t;
    const ch = CHORDS[Math.min(CHORDS.length - 1, k)];
    pad(ch, t, d, 0.05, k * BAR + BAR >= G1 ? 1 : 0);
    // arpeggio
    for (let x = 0; x < d / (BEAT / 2) - 1e-6; x++) {
      const n = ch[x % 3] + 12 * (Math.floor(x / 3) % 2) + 12;
      pluck(n, t + x * (BEAT / 2), x % 4 === 0 ? 1.1 : 0.7, (x % 2 ? 1 : -1) * 0.35);
    }
  }

  // features: a stab on each cut, and foley for each callout
  REBUILD.features.forEach((f, k) => {
    const t = S.rebuild.start + f;
    const ch = CHORDS[Math.floor(t / BAR + 1e-6)].map((m) => m + 12);
    stab(ch, t, k === 0 ? 1.2 : 1, (k % 2 ? 1 : -1) * 0.3);
  });
  {
    const f1 = S.rebuild.start + REBUILD.features[0];
    [0.2, 0.27, 0.34, 0.41].forEach((x, k) => tick(f1 + x, 2200 + k * 300, 0.7, -0.5 + k * 0.1)); // palette chips
    tick(f1 + 0.12, 3200, 0.8, 0.3); // selection box
    const f2 = S.rebuild.start + REBUILD.features[1];
    for (let k = 0; k < 40; k++) keyClick(f2 + 0.18 + k * 0.021 + hash(k) * 0.008, 0.7, -0.3 + hash(k + 9) * 0.3);
    const f3 = S.rebuild.start + REBUILD.features[2];
    riser(f3 + 0.3, f3 + 0.62, 0.7);
    ding(86, f3 + 0.62, 1.1, -0.2);
    ding(93, f3 + 0.66, 0.7, 0.2);
    const f4 = S.rebuild.start + REBUILD.features[3];
    tick(f4 + 0.32, 1500, 1.2, 0.3); // click «Rediger»
    for (let k = 0; k < 26; k++) keyClick(f4 + 0.38 + k * 0.022 + hash(k + 40) * 0.006, 0.75, 0.2);
    tick(f4 + 1.1, 1500, 1.2, 0.3); // click «Lagre»
    ding(81, f4 + 1.1, 0.9, 0);
    ding(88, f4 + 1.16, 0.8, 0.2);
  }

  // 05 PROOF — two phones land
  thud(S.proof.start + 0.18, 0.9, -0.3);
  thud(S.proof.start + 0.3, 0.8, 0.3);
  for (let b = 1; b < 10; b++) tick(sb('proof', b) + 0.01, 2000 + (b % 3) * 300, 0.45, (b % 2 ? 1 : -1) * 0.35);
  bell(74, S.proof.start + 0.24, 0.8, -0.2);
  bell(81, S.proof.start + 0.5, 0.6, 0.2);
  riser(S.offer.start - 1.0, S.offer.start, 0.8);
  reverse(S.offer.start, 0.5, 1.2);

  // 06 OFFER — the claim, the strike, the odometer, the checklist
  impact(S.offer.start, 0.8);
  subDrop(S.offer.start, 0.7, 1.0);
  crash(S.offer.start, 0.8);
  whoosh(S.offer.start + OFFER.strike + 0.12, 0.2, 1, 1.0);
  impact(S.offer.start + OFFER.strike, 0.4);
  riser(S.offer.start + OFFER.drums - 0.9, S.offer.start + OFFER.drums, 0.8);
  impact(S.offer.start + OFFER.drums, 0.8);
  subDrop(S.offer.start + OFFER.drums, 0.9, 1.0);
  crash(S.offer.start + OFFER.drums, 0.9);
  OFFER.land.forEach((tl, k) => {
    ratchet(S.offer.start + OFFER.drums, S.offer.start + tl, 0.9, -0.45 + k * 0.3);
    clack(S.offer.start + tl, 0.8, -0.45 + k * 0.3, 1.3);
  });
  stab([62, 65, 69, 74], S.offer.start + OFFER.land[3] + 0.02, 1.2, 0);
  OFFER.checks.forEach((c, k) => {
    tick(S.offer.start + c + 0.01, 3000, 0.9, 0.35);
    ding([81, 84, 86, 89][k], S.offer.start + c + 0.08, 0.85, 0.2);
  });
  for (let k = 0; k < 24; k++) tick(S.offer.start + OFFER.vat + k * 0.019, 3900 - (k % 3) * 450, 0.25, -0.2);
  riser(S.cta.start - BAR / 2, S.cta.start, 1.5);
  [0, 0.25, 0.5, 0.625, 0.75, 0.8125, 0.875, 0.9375].forEach((x, k) => clap(S.cta.start - BAR / 2 + x * (BAR / 2), 0.6 + k * 0.12, (k % 2 ? 1 : -1) * 0.2));
  for (let k = 0; k < 8; k++) bass(38 - 12 + k, S.cta.start - BEAT + k * (BEAT / 8), BEAT / 8 - 0.005, 0.8);
  for (let k = 0; k < 18; k++) flipClick(S.cta.start - 0.28 + k * 0.016, 0.5, -0.8 + k * 0.1);

  // 07 CTA — «Ditt trekk.»
  impact(S.cta.start, 1.0);
  subDrop(S.cta.start, 1.1, 1.8);
  crash(S.cta.start, 1.0);
  braam([26, 38, 45, 50], S.cta.start, 1.6, 0.9);
  pad([38, 50, 53, 57, 62], S.cta.start, 2.2, 0.05);
  clack(S.cta.start + CTA.move + 0.12, 1.5, 0, 0.8);
  thud(S.cta.start + CTA.move + 0.12, 0.8, 0);
  bell(74, S.cta.start + CTA.move + 0.12, 0.9, -0.2);
  // a chess clock: your move, the seconds are running (a callback to the hook)
  for (let k = 0; k < 4; k++) clockTick(S.cta.start + CTA.move + 0.5 + k * BEAT, k % 2 === 0, 0.9);
  for (let k = 0; k < 4; k++) heartbeat(S.cta.start + CTA.move + 0.62 + k * BEAT * 2, 0.55);
  whoosh(S.cta.start + CTA.crane + 0.5, 0.7, -1, 0.9);
  riser(S.cta.start + CTA.crane, S.cta.start + CTA.burst, 0.8);
  impact(S.cta.start + CTA.burst, 0.8);
  crash(S.cta.start + CTA.burst, 0.7);
  CTA.diamonds.forEach((d, i) => clack(S.cta.start + d, 0.8, [-0.5, 0.5, -0.2, 0.2][i], 1.05));
  const lock = S.cta.start + CTA.lockup;
  kick(lock, 0.9, false);
  subDrop(lock, 0.8, 1.6);
  pad([38, 50, 57, 62, 65, 69], lock, S.cta.end - lock - 0.4, 0.055);
  bell(74, lock + 0.05, 1, -0.3);
  bell(77, lock + 0.3, 0.9, 0.3);
  bell(81, lock + 0.55, 0.8, -0.1);
  bell(86, lock + 0.9, 0.7, 0.2);
  ding(93, S.cta.start + CTA.button + 0.05, 0.6, 0);
  tick(S.cta.start + CTA.tap, 1500, 1.4, 0.3);
  ding(86, S.cta.start + CTA.tap + 0.02, 0.8, 0.3);
  for (let k = 0; k < 14; k++) tick(S.cta.start + CTA.lines + 0.15 + k * 0.03, 3600 - (k % 3) * 300, 0.25, 0.1);
  // a light pulse under the end card, resolving on the last bar
  for (let t = lock + BEAT; t < S.cta.end - 1.0 - 1e-6; t += BEAT) {
    kick(t, 0.5, false);
    hat(t + BEAT / 2, 0.6, true, 0.25);
    hat(t + BEAT * 0.25, 0.35, false, -0.25);
    hat(t + BEAT * 0.75, 0.35, false, -0.25);
  }
  for (let x = 0; x < 8; x++) pluck([62, 65, 69, 74][x % 4] + 12, lock + 0.9 + x * (BEAT / 2), 0.6, (x % 2 ? 1 : -1) * 0.4);
  kick(S.cta.end - 1.0, 0.8, false);
  subDrop(S.cta.end - 1.0, 0.6, 1.0);
  crash(S.cta.end - 1.0, 0.5);
  bell(62 + 12, S.cta.end - 1.0, 0.8, 0);
  bell(69 + 12, S.cta.end - 1.0, 0.5, 0.2);

  // whooshes from the shared timeline
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
