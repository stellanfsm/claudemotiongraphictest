// Shared timeline for «Prøv å ringe deg selv» — picture and sound both read it.
//
// For businesses with an outdated website. A challenge hook (try to call
// yourself from your own site, on a phone) leads to the free website check:
// a scan, three findings and two more kept blurred (an open loop), then a
// before/after where one tap calls. Pacing: at most ~7 words per card at
// about 3 words a second; copy inside y 280–1240.

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

const PLAN = [
  ['hook', 10], //   0.0  «Prøv å ringe deg selv fra nettsiden din. På mobil.» → «Fant du nummeret?»
  ['stat', 6], //    5.0  «Over halvparten av trafikken i Norge er mobil»
  ['scan', 18], //   8.0  «Vi sjekker nettsiden din. Gratis.» → findings → «3–5 konkrete punkter» → «Rett på e-post. Ingen møte.»
  ['after', 12], // 17.0  «Etter: ring med ett trykk.» → «Nå når de deg.»
  ['price', 10], // 23.0  «Ny nettside? Fra 7 500 kr + 500 kr/mnd»
  ['cta', 12], //   28.0  «Sjekk nettsiden gratis» · seventhseal.no
];
let cursor = 0;
export const SCENES = PLAN.map(([id, beats]) => {
  const s = { id, beats, start: cursor * BEAT, end: (cursor + beats) * BEAT };
  cursor += beats;
  return s;
});
export const DURATION = cursor * BEAT; // 34 s
export const S = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export const HOOK = { mobil: 0.8, pinch: [0.6, 1.2], scroll: [1.45, 2.05], miss: 2.3, cookie: 2.65, closeMiss: 3.2, swap: 3.6 };
export const STAT = { big: 0.05, bars: 0.5, line: 0.6, src: 1.1 };
export const SCAN = { t1: 0.05, sweep: [0.6, 1.8], pins: [2.0, 2.75, 3.5], blur: 4.25, t2: 4.6, t3: 7.0, mail: 7.1 };
export const AFTER = { t1: 0.15, wipe: [0.35, 1.7], tap: 3.35, call: 3.55, t2: 3.5 };
export const PRICE = { q: 0.1, price: 0.5, monthly: 0.95, checks: [1.6, 2.1, 2.6], vat: 3.1 };
export const CTA = { lockup: 0.1, button: 0.8, tap: 1.6, lines: 1.95 };

const at = (id, t) => S[id].start + t;
export const HITS = [
  { t: 0, s: 0.5 },
  { t: at('hook', HOOK.mobil), s: 0.45 },
  { t: at('hook', HOOK.cookie), s: 0.4 },
  { t: at('hook', HOOK.swap), s: 0.6 },
  { t: S.stat.start, s: 0.9 },
  { t: S.scan.start, s: 0.7 },
  ...SCAN.pins.map((p) => ({ t: at('scan', p), s: 0.4 })),
  { t: at('scan', SCAN.t2), s: 0.5 },
  { t: S.after.start, s: 0.9 },
  { t: at('after', AFTER.tap), s: 0.35 },
  { t: S.price.start, s: 0.8 },
  { t: at('price', PRICE.price), s: 0.6 },
  { t: S.cta.start, s: 0.8 },
  { t: at('cta', CTA.tap), s: 0.3 },
];
export const WHOOSHES = [
  { t: S.stat.start, dur: 0.3, dir: 1 },
  { t: S.scan.start, dur: 0.35, dir: -1 },
  { t: at('scan', SCAN.mail + 0.4), dur: 0.4, dir: 1 },
  { t: S.after.start, dur: 0.4, dir: -1 },
  { t: S.price.start, dur: 0.35, dir: 1 },
  { t: S.cta.start, dur: 0.4, dir: -1 },
];
export const CUTS = SCENES.map((s) => s.end);
export { at };
