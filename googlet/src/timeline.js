// Shared timeline for «Kunden googlet deg» — picture and sound both read it.
//
// For businesses with no website. The story is a loss-framed open loop: a
// customer searches, finds you without a website, and calls the competitor.
// It closes when the same search ends with the call coming to you.
// Pacing: at most ~7 words per card at about 3 words a second; every card
// holds ≥ 1.5 s. Copy stays inside y 280–1240 (safe on Reels and TikTok).

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

const PLAN = [
  ['hook', 9], //    0.0  «Kunden googlet deg. Hva fant de?» → «Da ringer de neste.»
  ['stat', 6], //    4.5  «7 av 10 sjekker håndverkeren før de bestemmer seg»
  ['build', 15], //  7.5  «Vi lager et førsteutkast.» «Du ser det først. Så bestemmer du.»
  ['price', 15], // 15.0  anchor → «Fra 7 500 kr + 500 kr/mnd», what's included
  ['reveal', 12], // 22.5 «Liker du ikke utkastet? Da har det kostet deg 0 kr.» → «Nå ringer de deg.»
  ['cta', 11], //   28.5  «Be om gratis førsteutkast» · seventhseal.no
];
let cursor = 0;
export const SCENES = PLAN.map(([id, beats]) => {
  const s = { id, beats, start: cursor * BEAT, end: (cursor + beats) * BEAT };
  cursor += beats;
  return s;
});
export const DURATION = cursor * BEAT; // 34 s
export const S = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export const HOOK = { typed: 0.55, results: 0.45, flag: 1.15, swap: 2.55, tap: 3.0, call: 3.2 };
export const STAT = { num: 0.05, icons: 0.35, line: 0.75, src: 1.0 };
export const BUILD = { sting: 0.0, phone: 1.35, t1: 1.5, wire: 1.7, design: 3.3, t2: 4.5, ring: 5.5 };
export const PRICE = { anchor: 0.1, strike: 1.5, price: 2.0, monthly: 2.45, checks: [3.1, 3.6, 4.1, 4.6], vat: 5.15 };
export const REVEAL = { spin: 0.0, t1: 0.35, t2: 0.75, search: 3.3, t3: 3.45, tap: 4.05, call: 4.25 };
export const CTA = { lockup: 0.1, button: 0.8, tap: 1.6, lines: 1.95 };

const at = (id, t) => S[id].start + t;
export const HITS = [
  { t: 0, s: 0.5 },
  { t: at('hook', HOOK.flag), s: 0.6 },
  { t: at('hook', HOOK.tap), s: 0.35 },
  { t: S.stat.start, s: 0.9 },
  { t: at('build', BUILD.sting + 0.35), s: 0.7 },
  { t: at('build', BUILD.design), s: 0.5 },
  { t: S.price.start, s: 0.8 },
  { t: at('price', PRICE.strike), s: 0.5 },
  { t: at('price', PRICE.price), s: 0.8 },
  { t: S.reveal.start, s: 1.1 },
  { t: at('reveal', REVEAL.tap), s: 0.35 },
  { t: S.cta.start, s: 0.8 },
  { t: at('cta', CTA.tap), s: 0.3 },
];
export const WHOOSHES = [
  { t: S.stat.start, dur: 0.3, dir: 1 },
  { t: at('build', BUILD.phone + 0.2), dur: 0.4, dir: -1 },
  { t: S.price.start, dur: 0.35, dir: 1 },
  { t: S.reveal.start, dur: 0.45, dir: -1 },
  { t: S.cta.start, dur: 0.4, dir: 1 },
];
export const CUTS = SCENES.map((s) => s.end);
export { at };
