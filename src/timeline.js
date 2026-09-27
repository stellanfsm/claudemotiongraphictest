// Shared timeline: the visuals (reel.js) and the soundtrack (audio.js) both
// read from here, so every cut, impact and whoosh lands on the same sample.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875s
export const BAR = BEAT * 4; // 1.875s
export const DURATION = BAR * 8; // 15.0s exactly

// bar is zero-indexed, beat may be fractional
export const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

export const SCENES = [
  { id: 'bounce', start: at(0), end: at(1), label: '01 — SQUASH & STRETCH' },
  { id: 'type', start: at(1), end: at(2), label: '02 — KINETIC TYPE' },
  { id: 'particles', start: at(2), end: at(3), label: '03 — PARTICLE SYSTEMS' },
  { id: 'three', start: at(3), end: at(4), label: '04 — 3D & CAMERA' },
  { id: 'easing', start: at(4), end: at(5), label: '05 — TIMING & EASING' },
  { id: 'liquid', start: at(5), end: at(6), label: '06 — LIQUID / GENERATIVE' },
  { id: 'montage', start: at(6), end: at(7), label: '07 — RAPID FIRE' },
  { id: 'end', start: at(7), end: at(8), label: '08 — HELLO' },
];

export const MONTAGE_LABELS = [
  '07.1 — ISOMETRIC',
  '07.2 — RADIAL',
  '07.3 — HALFTONE',
  '07.4 — GLITCH',
  '07.5 — INFINITE ZOOM',
  '07.6 — RHYTHM',
  '07.7 — DATA',
  '07.8 — LOADING',
];

// Impacts drive camera shake, chromatic aberration and the impact SFX.
export const HITS = [
  { t: at(0, 1), s: 0.55 }, // first bounce
  { t: at(0, 2), s: 0.4 }, // second bounce
  { t: at(1), s: 1.0 }, // "I" slam
  { t: at(1, 0.5), s: 0.3 },
  { t: at(1, 2), s: 0.7 }, // THINGS
  { t: at(1, 3), s: 0.8 }, // MOVE
  { t: at(2), s: 0.5 },
  { t: at(2, 2), s: 0.45 }, // particles lock into type
  { t: at(2, 3.5), s: 1.0 }, // particle explosion
  { t: at(3), s: 0.4 },
  { t: at(3, 2), s: 0.55 }, // knot reveal
  { t: at(4), s: 0.5 },
  { t: at(4, 1), s: 0.18 },
  { t: at(4, 2), s: 0.18 },
  { t: at(4, 3), s: 0.18 },
  { t: at(5), s: 0.8 },
  { t: at(6), s: 1.0 }, // the drop
  ...[1, 2, 3, 4, 5, 6, 7].map((k) => ({ t: at(6, k * 0.5), s: 0.32 })),
  { t: at(7), s: 1.0 }, // end card
];

// Transitions that get a whoosh (t = moment of the cut).
export const WHOOSHES = [
  { t: at(1), dur: 0.3, dir: 1 },
  { t: at(1, 2), dur: 0.2, dir: -1 },
  { t: at(2), dur: 0.35, dir: 1 },
  { t: at(3), dur: 0.3, dir: -1 },
  { t: at(4), dur: 0.35, dir: 1 },
  { t: at(5), dur: 0.35, dir: -1 },
  { t: at(7), dur: 0.4, dir: 1 },
];

// Chord per bar (MIDI root + intervals) — A minor, i–i–VI–VII–i–VI–III–i
export const CHORDS = [
  [57, 60, 64], // Am
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 59, 62], // G
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [57, 60, 64], // Am
];
