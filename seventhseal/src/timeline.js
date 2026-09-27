// Shared timeline for the Seventh Seal reel — visuals and soundtrack both
// read from here so every cut and impact lands on the same sample.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875s
export const BAR = BEAT * 4; // 1.875s
export const DURATION = BAR * 8; // 15.0s

export const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

export const SCENES = [
  { id: 'seal', start: at(0), end: at(1), label: '01 — SEGLET' },
  { id: 'tagline', start: at(1), end: at(2), label: '02 — VISJON' },
  { id: 'storm', start: at(2), end: at(3), label: '03 — BYRÅKVALITET' },
  { id: 'pillars', start: at(3), end: at(4), label: '04 — 7 SØYLER' },
  { id: 'work', start: at(4), end: at(5), label: '05 — ARBEID' },
  { id: 'price', start: at(5), end: at(6), label: '06 — PRIS' },
  { id: 'process', start: at(6), end: at(7), label: '07 — PROSESS' },
  { id: 'contact', start: at(7), end: at(8), label: '08 — KONTAKT' },
];

export const MONTAGE_LABELS = [
  '07.1 — DESIGN I FIGMA',
  '07.2 — UTVIKLING I KODE',
  '07.3 — RESPONSIVT',
  '07.4 — ADMINPANEL',
  '07.5 — YTELSE',
  '07.6 — SIKKERHET',
  '07.7 — UNIVERSELL UTFORMING',
  '07.8 — SYNLIG PÅ GOOGLE',
];

// The four diamonds of the seal land on these beats.
export const DIAMOND_BEATS = [1, 1.5, 2, 2.5];

export const HITS = [
  ...DIAMOND_BEATS.map((b, i) => ({ t: at(0, b), s: i === 3 ? 0.5 : 0.35 })),
  { t: at(1), s: 1.0 }, // Designer
  { t: at(1, 1), s: 0.45 },
  { t: at(1, 2), s: 0.45 },
  { t: at(1, 3), s: 0.9 }, // i dag.
  { t: at(2), s: 0.6 },
  { t: at(2, 1), s: 0.8 }, // Byråkvalitet,
  { t: at(2, 2), s: 0.6 }, // uten byråpris.
  { t: at(2, 3.5), s: 0.8 },
  { t: at(3), s: 0.5 },
  { t: at(4), s: 0.5 },
  { t: at(5), s: 0.8 }, // price
  { t: at(6), s: 1.0 }, // the drop
  ...[1, 2, 3, 4, 5, 6, 7].map((k) => ({ t: at(6, k * 0.5), s: 0.3 })),
  { t: at(7), s: 0.9 },
];

export const WHOOSHES = [
  { t: at(1), dur: 0.3, dir: 1 },
  { t: at(2), dur: 0.35, dir: -1 },
  { t: at(3), dur: 0.3, dir: 1 },
  { t: at(4), dur: 0.3, dir: -1 },
  { t: at(5), dur: 0.35, dir: 1 },
  { t: at(7), dur: 0.4, dir: -1 },
];

// D minor: i–i–VI–VII–i–VI–III–i
export const CHORDS = [
  [50, 53, 57], // Dm
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [48, 52, 55], // C
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [53, 57, 60], // F
  [50, 53, 57], // Dm
];
