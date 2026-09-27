// Timeline for the admin panel announcement. Picture and sound both read
// from here. Customer-facing: calm tempo, every caption held long enough to
// read comfortably.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5s
export const BAR = BEAT * 4; // 2s

export const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

// [id, bars]
const PLAN = [
  ['intro', 2],
  ['hook', 3],
  ['text', 4],
  ['image', 4],
  ['news', 3],
  ['publish', 4],
  ['benefits', 4],
  ['outro', 3],
];

let cursor = 0;
export const SCENES = PLAN.map(([id, bars]) => {
  const s = { id, bars, bar: cursor, start: at(cursor), end: at(cursor + bars) };
  cursor += bars;
  return s;
});
export const TOTAL_BARS = cursor;
export const DURATION = at(TOTAL_BARS);
export const S = Object.fromEntries(SCENES.map((s) => [s.id, s]));

// Key moments, in seconds relative to their scene. The picture animates to
// them and the soundtrack puts a click / typing / chime on them.
export const EV = {
  intro: { diamonds: [0.25, 0.45, 0.65, 0.85] },
  text: { rediger: 0.8, h1: 2.2, typeFrom: 2.6, typeTo: 4.4, lagre: 5.2 },
  image: { bytt: 1.2, velgFil: 2.0, cropOpen: 2.3, dragFrom: 2.8, dragTo: 4.2, velgUtsnitt: 5.1 },
  news: { ny: 1.0, title: 1.7, typeFrom: 1.9, typeTo: 3.3, lagre: 3.9 },
  publish: { visSiden: 1.0, publiser: 2.5, done: 3.0, phone: 3.9 },
};

export const CLICKS = [
  S.text.start + EV.text.rediger,
  S.text.start + EV.text.h1,
  S.text.start + EV.text.lagre,
  S.image.start + EV.image.bytt,
  S.image.start + EV.image.velgFil,
  S.image.start + EV.image.velgUtsnitt,
  S.news.start + EV.news.ny,
  S.news.start + EV.news.title,
  S.news.start + EV.news.lagre,
  S.publish.start + EV.publish.visSiden,
  S.publish.start + EV.publish.publiser,
];

export const TYPING = [
  [S.text.start + EV.text.typeFrom, S.text.start + EV.text.typeTo],
  [S.news.start + EV.news.typeFrom, S.news.start + EV.news.typeTo],
];

export const WHOOSHES = [S.hook.start, S.text.start, S.benefits.start, S.outro.start];

// F major, warm and optimistic. One chord per bar.
const F = [53, 57, 60];
const Am = [57, 60, 64];
const Dm = [50, 53, 57];
const Bb = [46, 50, 53];
const C = [48, 52, 55];
export const CHORDS = [
  F, F, // intro
  Dm, Bb, C, // hook
  F, Am, Dm, C, // text
  F, Am, Bb, C, // image
  Dm, Bb, C, // news
  F, Am, Bb, C, // publish
  F, Am, Dm, C, // benefits
  F, F, F, // outro
];
