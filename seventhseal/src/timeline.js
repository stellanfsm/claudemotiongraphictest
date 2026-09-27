// Shared timeline for the Seventh Seal reel — visuals and soundtrack both
// read from here so every cut and impact lands on the same sample.
//
// Pacing: each shot is as long as its text needs to be read comfortably
// (headlines ≥ ~1 s after they land, sentences ~18 chars/s), while motion and
// cuts stay on a 128 BPM grid. Shots without text stay short.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875s
export const BAR = BEAT * 4; // 1.875s

export const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

// [id, length in bars, HUD label]
const PLAN = [
  ['seal', 1, '01 — SEGLET'],
  ['tagline', 2, '02 — VISJON'],
  ['storm', 2, '03 — BYRÅKVALITET'],
  ['pillars', 3, '04 — 7 SØYLER'],
  ['work', 3, '05 — ARBEID'],
  ['price', 2, '06 — PRIS'],
  ['process', 7, '07 — PROSESS'],
  ['contact', 3, '08 — KONTAKT'],
];

let barCursor = 0;
export const SCENES = PLAN.map(([id, bars, label]) => {
  const s = { id, bars, bar: barCursor, start: at(barCursor), end: at(barCursor + bars), label };
  barCursor += bars;
  return s;
});
export const TOTAL_BARS = barCursor;
export const DURATION = at(TOTAL_BARS);
export const S = Object.fromEntries(SCENES.map((s) => [s.id, s]));
const sb = (id, beats) => S[id].start + beats * BEAT; // scene-relative time

// Process montage: beats per cut, sized to the text in each cut.
export const MONTAGE_BEATS = [2, 2, 2, 4, 5, 3, 5, 5];
export const MONTAGE_CUTS = (() => {
  let b = 0;
  return MONTAGE_BEATS.map((n) => {
    const c = { start: sb('process', b), beats: n };
    b += n;
    c.end = sb('process', b);
    return c;
  });
})();
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

// Scene-relative beats of key moments (shared by picture and sound).
export const DIAMOND_BEATS = [1, 1.5, 2, 2.5];
export const TAGLINE_IDAG = 5; // "i dag." lands
export const WORK_QUOTE = 6; // testimonial card
export const PRICE_CHECKS = [1, 1.5, 2, 2.5, 3];
export const PILLAR_CHASE = { start: 1.2, step: BEAT }; // seconds
export const CLICK_T = S.contact.start + 1.75;

export const HITS = [
  ...DIAMOND_BEATS.map((b, i) => ({ t: sb('seal', b), s: i === 3 ? 0.5 : 0.35 })),
  { t: sb('tagline', 0), s: 1.0 },
  { t: sb('tagline', 1), s: 0.45 },
  { t: sb('tagline', 2), s: 0.45 },
  { t: sb('tagline', TAGLINE_IDAG), s: 0.9 },
  { t: sb('storm', 0), s: 0.6 },
  { t: sb('storm', 1), s: 0.8 },
  { t: sb('storm', 2), s: 0.6 },
  { t: sb('storm', 7.5), s: 0.8 },
  { t: sb('pillars', 0), s: 0.5 },
  { t: sb('work', 0), s: 0.5 },
  { t: sb('work', WORK_QUOTE), s: 0.4 },
  { t: sb('price', 0), s: 0.8 },
  ...MONTAGE_CUTS.map((c, i) => ({ t: c.start, s: i === 0 ? 1.0 : 0.35 })),
  { t: sb('contact', 0), s: 0.9 },
];

export const WHOOSHES = [
  { t: S.tagline.start, dur: 0.3, dir: 1 },
  { t: S.storm.start, dur: 0.35, dir: -1 },
  { t: S.pillars.start, dur: 0.3, dir: 1 },
  { t: S.work.start, dur: 0.3, dir: -1 },
  { t: S.price.start, dur: 0.35, dir: 1 },
  { t: S.contact.start, dur: 0.4, dir: -1 },
];

// D minor. One chord per bar, grouped by scene.
const Dm = [50, 53, 57];
const Bb = [46, 50, 53];
const C = [48, 52, 55];
const F = [53, 57, 60];
export const CHORDS = [
  Dm, // seal
  Dm, Dm, // tagline
  Bb, C, // storm
  Dm, Bb, C, // pillars
  Dm, F, C, // work
  Bb, C, // price (riser)
  Dm, Bb, F, C, Dm, Bb, C, // process
  Dm, Dm, Dm, // contact
];
