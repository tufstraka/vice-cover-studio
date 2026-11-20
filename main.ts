// Vice Cover Studio — entrypoint (Node 22, standard library only).
//
// The deliverable is app/: a static, offline multi-panel cover studio. This program copies app/
// and screenshots/ beside the output directory, runs a few sanity checks a broken hand-in should
// fail loudly on, and writes dossier.json with the vendored make.fun library. The checks are
// deliberately cheap: the scorer re-runs buildDossier on its own, and a missing cover scene should
// be caught here rather than after submission.
//
//   node main.ts                      # writes /output (or $MAKEFUN_OUTPUT_DIR)
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const app = join(here, 'app');
const shotsDir = join(here, 'screenshots');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function fail(message: string): never {
  console.error(`vice-cover-studio: ${message}`);
  process.exit(1);
}

/** Pixel dimensions of a PNG (IHDR) or JPEG (SOF marker); null for anything else. */
function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }
  return null;
}

// --- sanity checks -------------------------------------------------------------------------

if (!existsSync(join(app, 'index.html'))) fail('app/index.html is missing');
const page = readFileSync(join(app, 'index.html'), 'utf8');
if (!page.includes('./src/main.js')) fail('app/index.html does not load ./src/main.js');
if (/\b(?:https?:)?\/\//i.test(page)) fail('app/index.html references a remote URL');

const coverSource = readFileSync(join(app, 'src', 'cover.js'), 'utf8');
for (const marker of ['panelRects', 'renderCover', 'drawGrain', 'drawPalm']) {
  if (!coverSource.includes(marker)) fail(`app/src/cover.js is missing ${marker}`);
}

const images = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
  : [];
if (images.length < 3 || images.length > 4) fail(`screenshots/ holds ${images.length} images; want 3 or 4`);

const covers = images.filter((name) => statSync(join(shotsDir, name)).isFile());
let landscape = 0;
for (const name of covers) {
  const stats = statSync(join(shotsDir, name));
  if (stats.size > 262144) fail(`screenshots/${name} is ${stats.size} bytes, over the 256 KiB cap`);
  const dims = imageSize(readFileSync(join(shotsDir, name)));
  if (dims && dims.width > dims.height) landscape += 1;
}
if (landscape === 0) fail('no landscape cover in screenshots/ (the first screenshot should be 16:9)');

// --- hand in --------------------------------------------------------------------------------

mkdirSync(out, { recursive: true });
cpSync(app, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

const appFiles = readdirSync(app, { recursive: true }).filter((name) => statSync(join(app, name)).isFile()).length;
console.log(
  `vice-cover-studio: ${appFiles} app files, ${images.length} screenshots, ` +
    `${(statSync(join(out, 'dossier.json')).size / 1024).toFixed(1)} KiB dossier -> ${out}`,
);
