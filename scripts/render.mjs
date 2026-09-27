// Renders the reel: frames via headless Chromium (parallel workers), the
// soundtrack via the same audio.js the browser preview uses, then muxes both
// into an H.264 MP4 with ffmpeg.
//
//   node scripts/render.mjs                    full render → showreel.mp4
//   node scripts/render.mjs --stills 0.6,3.3   just PNG stills at those times
//   node scripts/render.mjs --subsamples 1     fast draft (no motion blur)
//   node scripts/render.mjs --src seventhseal/src --out seventhseal/seventhseal-reel.mp4

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]);
    return acc;
  }, []),
);
const SRC = path.resolve(ROOT, args.src ?? 'src');
const { renderSoundtrack } = await import(path.join(SRC, 'audio.js'));
const { FPS, DURATION } = await import(path.join(SRC, 'timeline.js'));
const subsamples = Number(args.subsamples ?? 10);
const workers = Number(args.workers ?? Math.max(1, os.cpus().length));
const out = path.resolve(ROOT, args.out ?? 'showreel.mp4');
const work = path.resolve(args.work ?? path.join(os.tmpdir(), 'reel-frames'));
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};
const server = http.createServer((req, res) => {
  const p = path.join(SRC, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(SRC) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html?render`;

async function openWorker() {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('[page error]', e));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__reel?.ready, null, { timeout: 60000 });
  return { browser, page };
}

async function grab(page, f) {
  const data = await page.evaluate(
    ([f, subsamples]) => {
      window.__reel.renderFrame(f, { subsamples });
      return document.getElementById('c').toDataURL('image/png');
    },
    [f, subsamples],
  );
  return Buffer.from(data.split(',')[1], 'base64');
}

fs.mkdirSync(work, { recursive: true });

if (args.stills) {
  const { browser, page } = await openWorker();
  const dir = path.resolve(ROOT, args.dir ?? path.join(work, 'stills'));
  fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.stills).split(',')) {
    const f = Math.round(Number(s) * FPS);
    fs.writeFileSync(path.join(dir, `still_${String(f).padStart(4, '0')}.png`), await grab(page, f));
    console.log('still', s);
  }
  await browser.close();
  server.close();
  process.exit(0);
}

// ─── frames ────────────────────────────────────────────────────────────────
const total = Math.round(DURATION * FPS);
const first = Number(args.from ?? 0);
const last = Number(args.to ?? total);
const framesDir = path.join(work, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const started = Date.now();
let done = 0;
const queue = [];
for (let f = first; f < last; f++) queue.push(f);
await Promise.all(
  Array.from({ length: workers }, async () => {
    const { browser, page } = await openWorker();
    while (queue.length) {
      const f = queue.shift();
      fs.writeFileSync(path.join(framesDir, `f_${String(f - first).padStart(5, '0')}.png`), await grab(page, f));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - started) / 1000;
        console.log(`frames ${done}/${last - first}  ${(done / el).toFixed(1)} fps  eta ${Math.round(((last - first - done) * el) / done)}s`);
      }
    }
    await browser.close();
  }),
);
server.close();

// ─── audio ─────────────────────────────────────────────────────────────────
const { left, right, sampleRate } = renderSoundtrack(48000);
const wavPath = path.join(work, 'soundtrack.wav');
{
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(wavPath, buf);
}
if (args.wav) fs.copyFileSync(wavPath, path.resolve(ROOT, args.wav));

// ─── encode ────────────────────────────────────────────────────────────────
const enc = spawnSync(
  ffmpeg,
  [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(framesDir, 'f_%05d.png'),
    '-ss', String(first / FPS), '-i', wavPath,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf ?? 18), '-tune', 'animation',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '256k',
    '-shortest', '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
if (enc.status !== 0) process.exit(enc.status ?? 1);
console.log(`wrote ${out} in ${Math.round((Date.now() - started) / 1000)}s`);
