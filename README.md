# Vice Cover Studio

[![make.fun gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![make.fun rank](https://make.fun/badge/gta6-cover-art-01/tufstraka/vice-cover-studio/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![make.fun reward](https://make.fun/badge/gta6-cover-art-01/tufstraka/vice-cover-studio/reward.svg)](https://make.fun/c/gta6-cover-art-01)

A poster-grade cover art studio that runs entirely offline in desktop Chrome. Drop in one or more
photos, pick an asymmetric solo / duo / triptych / quad / five / grid collage, crop each panel by
dragging and zooming, choose a title system and a colour grade, then export a finished magazine
cover. The art is generated in code: synthetic sunset sky, filmic teal-and-orange grade, layered
palms, a distant skyline, halftone screen, film grain, light leaks, art-deco corners, barcodes and
layered display lettering with outlines, gradients and chromatic fringes.

Export real PNGs at 1080 × 1080, 1080 × 1350 and 1920 × 1080. No uploads, no fonts to download,
no third-party libraries and no build step: the app is vanilla ES modules and CSS.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080>. Two sample photos in `app/samples/` are loaded on first visit;
replace them with your own at any time.

## The studio

- **Compositions** — Solo, Duo, Triptych, Quad, Five and Grid, each an asymmetric poster grid with
  bevel-bordered prints, drop shadows and index tags. Shuffle composition re-deals the layout,
  photos and crops in one click; Reset panel restores the selected panel's centre crop.
- **Title system** — Classic, Neon, Heist and Vice lettering, each with outlines, gradient fills,
  shadows and fringes, plus a kicker, subtitle line, issue number, price, age badge and DELUXE tag.
  Caption can sit at the bottom or the top of the poster.
- **Grades** — Vice Sunset, Neon Night, Miami Dusk, Toxic Lime and Golden Hour. Every preset drives
  the sky, split-tone grade and accent colours together.
- **Preview & export** — the live preview is painted at the selected export size; exports are PNG
  at 1080 × 1080, 1080 × 1350 or 1920 × 1080.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory, sanity-checks the page, the
poster layers and every capture, and writes `dossier.json` with `buildDossier` from
`vendor/makefun-app.ts`.

## Screenshot scenes

Every capture is deterministic through URL parameters, for example:

```text
/?shot=cover&size=1920x1080&layout=five&photos=boulevard,pier&caption=VICE%20SUNSET&palette=vice&style=classic
/?shot=editor&layout=quad&photos=pier,boulevard&caption=VICE%20NIGHTS&palette=night&style=neon&size=1920x1080
```

`shots.json` lists the exact scenes used for the four screenshots. All artwork shown is generated
in code; the sample photographs were made for make.fun and are free to use.
