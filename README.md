# Vice Cover Studio

[![make.fun gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![make.fun rank](https://make.fun/badge/gta6-cover-art-01/tufstraka/vice-cover-studio/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![make.fun reward](https://make.fun/badge/gta6-cover-art-01/tufstraka/vice-cover-studio/reward.svg)](https://make.fun/c/gta6-cover-art-01)

A GTA-6-style cover art studio that runs entirely offline in desktop Chrome. Drop in one or more
photos, choose an asymmetric solo / duo / triptych / five-panel collage, crop each panel by dragging
and zooming, then set the oversized display caption, location strip and colour grade. Palms,
halftone dots, film grain, rim-lit borders and price badges are all drawn procedurally on canvas.

Export real PNGs at 1080 × 1080, 1080 × 1350 and 1920 × 1080. No uploads, no fonts to download,
no third-party libraries and no build step: the app is vanilla ES modules and CSS.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080>. Two sample photos in `app/samples/` are loaded on first visit;
replace them with your own at any time.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory, sanity-checks the page and
captures, and writes `dossier.json` with `buildDossier` from `vendor/makefun-app.ts`.

## Screenshot scenes

Every capture is deterministic through URL parameters, for example:

```text
/?shot=cover&size=1920x1080&layout=five&photos=pier,boulevard&caption=SUNSET%20HEIST&palette=vice
/?shot=editor&layout=five&photos=pier,boulevard&caption=VICE%20NIGHTS&size=1920x1080
```

`shots.json` lists the exact scenes used for the four screenshots. All artwork shown is generated
in code; the sample photographs were made for make.fun and are free to use.
