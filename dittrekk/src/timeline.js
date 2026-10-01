// Shared timeline for «Ditt trekk» — the picture and the soundtrack both read
// from here, so every cut, flip, click and impact lands on the same sample.
//
// Vertical 9:16 for Reels / TikTok / Shorts. 120 BPM, so one beat is exactly
// half a second and the countdown in the hook runs in real seconds.
// Pacing: every line of text lands and then holds at least ~1 s (sentences get
// roughly one second per 18 characters); motion between them stays fast.

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const BAR = BEAT * 4; // 2 s

// [id, length in beats]
const PLAN = [
  ['count', 6], //   0.0  «Nettsiden din har 3 sekunder» — a swarm of cursors counts down
  ['gone', 7], //    3.0  «53 % er allerede borte»
  ['judge', 7], //   6.5  the old website, «94 % dømmer nettsiden din på designet»
  ['rebuild', 20], // 10.0 «Tid for et nytt trekk» — the screen flips tile by tile into a new site
  ['proof', 10], //  20.0  real client sites on real phones
  ['offer', 16], //  25.0  «Byråkvalitet, uten byråpris» — the price on a 3D odometer
  ['cta', 14], //    33.0  «Ditt trekk» — a red king moves, the board becomes the logo
];

let cursor = 0;
export const SCENES = PLAN.map(([id, beats]) => {
  const s = { id, beats, beat: cursor, start: cursor * BEAT, end: (cursor + beats) * BEAT };
  cursor += beats;
  return s;
});
export const DURATION = cursor * BEAT; // 40 s
export const S = Object.fromEntries(SCENES.map((s) => [s.id, s]));
export const sb = (id, beats = 0) => S[id].start + beats * BEAT; // scene-relative beat → seconds

// ─── key moments (scene-relative seconds unless noted) ─────────────────────
export const COUNT = {
  morphs: [1.0, 2.0], // 3 → 2 → 1, on the second
  quit: 0.07, // share of cursors that give up at each morph
};
export const GONE = {
  share: 0.53, // leave at 3 s — «53 % av brukere forlater en side som tar mer enn 3 sekunder å laste»
  text: 0.3,
  caption: 0.6,
  converge: 3.1, // the survivors rush to where the phone will land
};
export const JUDGE = {
  slam: 0.0,
  stat: 0.25,
  line: 0.5,
  stop: 3.1, // tape stop
};
export const REBUILD = {
  land: 0.0, // the red diamond lands on the old site
  flipSpan: 0.8, // the wave crosses the screen
  flipDur: 0.3, // one tile's flip
  spin: 1.0, // the drop: phone spins, new site revealed
  features: [2.0, 4.0, 6.0, 8.0], // four callouts, 2 s each
};
export const PROOF = {
  rise: 0.0,
  focusB: 2.4,
};
export const OFFER = {
  strike: 1.2, // the red line through «byråpris»
  drums: 2.6, // the odometer rolls in
  land: [2.9, 3.05, 3.2, 3.35], // each drum lands
  plus: 3.6,
  checks: [4.2, 4.75, 5.3, 5.85],
  vat: 6.4,
};
export const CTA = {
  move: 0.7, // the king steps towards you
  crane: 2.4, // camera rises to top-down
  burst: 2.95, // the king bursts into the four diamonds
  diamonds: [3.15, 3.3, 3.45, 3.6],
  lockup: 3.7,
  button: 4.1,
  tap: 4.8,
  lines: 5.0,
};

// ─── impacts: camera shake / chromatic aberration / sound ──────────────────
export const HITS = [
  { t: 0, s: 0.6 },
  { t: S.count.start + COUNT.morphs[0], s: 0.55 },
  { t: S.count.start + COUNT.morphs[1], s: 0.7 },
  { t: S.gone.start, s: 1.3 },
  { t: S.judge.start, s: 0.8 },
  { t: S.rebuild.start + REBUILD.land, s: 0.9 },
  { t: S.rebuild.start + REBUILD.spin, s: 1.2 },
  ...REBUILD.features.map((f) => ({ t: S.rebuild.start + f, s: 0.35 })),
  { t: S.proof.start, s: 0.6 },
  { t: S.offer.start, s: 0.8 },
  { t: S.offer.start + OFFER.strike, s: 0.45 },
  { t: S.offer.start + OFFER.drums, s: 0.7 },
  { t: S.offer.start + OFFER.land[3], s: 0.5 },
  { t: S.cta.start, s: 0.9 },
  { t: S.cta.start + CTA.move, s: 0.6 },
  { t: S.cta.start + CTA.burst, s: 0.7 },
  { t: S.cta.start + CTA.lockup, s: 0.5 },
  { t: S.cta.start + CTA.tap, s: 0.3 },
];

export const WHOOSHES = [
  { t: S.judge.start, dur: 0.3, dir: 1 },
  { t: S.proof.start, dur: 0.4, dir: -1 },
  { t: S.offer.start, dur: 0.35, dir: 1 },
  { t: S.offer.start + OFFER.drums, dur: 0.3, dir: -1 },
  { t: S.cta.start, dur: 0.45, dir: 1 },
  { t: S.cta.start + CTA.crane, dur: 0.5, dir: -1 },
  ...REBUILD.features.slice(1).map((f, i) => ({ t: S.rebuild.start + f, dur: 0.22, dir: i % 2 ? 1 : -1 })),
];

// Cut points (sub-frame motion blur never straddles one).
export const CUTS = [...SCENES.map((s) => s.end)];

// D minor. One chord per bar (2 s); bar k covers [2k, 2k+2).
const Dm = [50, 53, 57];
const Bb = [46, 50, 53];
const C = [48, 52, 55];
const F = [53, 57, 60];
const Gm = [55, 58, 62];
const A = [57, 61, 64];
export const CHORDS = [
  Dm, Dm, Dm, Bb, // 0–8   count · gone · judge
  Dm, Bb, F, C, Dm, // 8–18  rebuild (the drop at 11)
  Bb, Gm, C, // 18–24 proof
  Dm, Bb, Gm, A, // 24–32 offer
  Dm, Bb, Dm, Dm, // 32–40 cta
];
