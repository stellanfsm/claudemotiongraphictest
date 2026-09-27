# SEVENTH SEAL — Brand Reel

A 15-second, 1080p60 brand reel for [Seventh Seal](https://seventhseal.no) with a synced soundtrack. Like the reel in the repo root, it's all code: no keyframes, no stock assets.

**▶ [`seventhseal-reel.mp4`](seventhseal-reel.mp4)**

![contact sheet](media/contact-sheet.jpg)

## Built from the brand

All of the material comes from seventhseal.no:

- **Logo.** The real `logo-7S.svg` is parsed at runtime. Its 28 board squares, four diamonds and "Seventh / Seal" wordmark paths are animated individually.
- **Palette.** `#FF1E3C` red, `#D70022`, `#0A0A0A` and white, taken from the site CSS.
- **Type.** IBM Plex Sans (the site's typeface), IBM Plex Mono for UI details, and Anton for the heavy condensed display type in the OG image.
- **Motifs.** The chessboard (a nod to Bergman's *The Seventh Seal*), the flying italic "7S" glyphs from the hero video, and brutalist concrete with red accents.
- **Copy.** All in Norwegian and taken from the site: the tagline, *Byråkvalitet, uten byråpris.*, the 7 søyler, prices, process steps and the three case studies.

## The cut

The reel runs at 128 BPM in D minor, and every cut lands on a beat.

| # | Time | Shot | What happens |
|---|---|---|---|
| 01 | 0.00 | **Seglet** | The board fills in and the four red diamonds land on the beat, each with a chess-piece "clack" in the audio. The camera then dives into a diamond |
| 02 | 1.88 | **Visjon** | *Designer / morgendagens / nettsider, / i dag.* rises from masks, then a board-square wipe |
| 03 | 3.75 | **Byråkvalitet** | A 3D storm of italic 7 and S glyphs (after the site's hero) behind *Byråkvalitet, uten byråpris.* |
| 04 | 5.63 | **7 søyler** | Seven concrete pillars rise and a red capital chases across them on 16ths. The headline is difference-blended over the concrete |
| 05 | 7.50 | **Arbeid** | Skogli Gard, Økonomiledelse AS and Lille Amir Frisør shown as real site screenshots scrolling on the beat, plus the testimonial card |
| 06 | 9.38 | **Pris** | A slot-machine *7 500 kr*, *+ 500 kr/mnd*, and a checklist that ticks on the half beats |
| 07 | 11.25 | **Prosess** | 8 cuts in 1.9 s: Figma, kode, responsivt, adminpanel, ytelse (53 %), SSL, universell utforming (15 %) and a Google search result |
| 08 | 13.13 | **Kontakt** | The full lockup assembles, then the cursor clicks *Få gratis førsteutkast* |

## Build it

From the repo root:

```bash
npm install
pip install imageio-ffmpeg   # or have ffmpeg with libx264 on PATH
node scripts/render.mjs --src seventhseal/src --out seventhseal/seventhseal-reel.mp4
node scripts/render.mjs --src seventhseal/src --stills 6.9,14.9   # PNG stills
```

For a live preview with sound, serve `seventhseal/src/` (for example `npx serve seventhseal/src`) and open it.
