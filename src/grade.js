// Film look: one graded copy of each photo per grade, cached, plus grain.
// The grade is baked once at source size so panel crops stay cheap while dragging.

const GRADE_TABLE = {
  sunset: { contrast: 1.08, sat: 1.06, lift: 0.024, shadow: [-5, 2, 7], high: [12, 5, -7], temp: 0.035, halation: 0.34, grain: 0.06 },
  neon: { contrast: 1.13, sat: 1.18, lift: 0.02, shadow: [-11, -4, 16], high: [18, -9, 10], temp: 0.06, halation: 0.46, grain: 0.08 },
  noir: { contrast: 1.2, sat: 0.26, lift: 0.014, shadow: [-4, 0, 8], high: [7, 3, 0], temp: 0, halation: 0.28, grain: 0.1 },
  gold: { contrast: 1.1, sat: 0.95, lift: 0.026, shadow: [-4, -1, 2], high: [20, 10, -14], temp: 0.12, halation: 0.42, grain: 0.07 },
  raw: { contrast: 1.03, sat: 1.01, lift: 0.012, shadow: [-2, 0, 3], high: [3, 0, -2], temp: 0, halation: 0.2, grain: 0.04 },
};

const cache = new Map();

function scratch(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

function applyGrade(data, w, h, p) {
  const d = data;
  const copy = new Uint8ClampedArray(d);
  const cx = Math.max(1, Math.round(w / 520));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // chromatic aberration: red pulled outward, blue pulled inward
      const ri2 = (y * w + Math.min(w - 1, x + cx)) * 4;
      const bi2 = (y * w + Math.max(0, x - cx)) * 4;
      let r = copy[ri2] / 255;
      let g = copy[i + 1] / 255;
      let b = copy[bi2 + 2] / 255;

      // contrast around mid grey
      r = (r - 0.5) * p.contrast + 0.5;
      g = (g - 0.5) * p.contrast + 0.5;
      b = (b - 0.5) * p.contrast + 0.5;

      // saturation
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * p.sat;
      g = l + (g - l) * p.sat;
      b = l + (b - l) * p.sat;

      // skin keeps its own warmth: the split tone backs off where skin reads
      const rg = r - g;
      const warm = r - b;
      let skin = Math.max(0, Math.min(1, rg * 3.4 - 0.02)) * Math.max(0, Math.min(1, warm * 2.6 - 0.06));
      skin = Math.max(0, Math.min(1, skin)) * (l > 0.16 ? 1 : 0.35);
      const protect = 1 - 0.62 * skin;

      // split tone: teal shadows, warm highlights
      const lm = Math.min(1, Math.max(0, l));
      const sh = Math.pow(1 - lm, 1.8) * protect;
      const hi = Math.pow(lm, 1.5);
      r += (p.shadow[0] * sh + p.high[0] * hi * (1 - 0.45 * skin)) / 255;
      g += (p.shadow[1] * sh + p.high[1] * hi * (1 - 0.3 * skin)) / 255;
      b += (p.shadow[2] * sh + p.high[2] * hi * (1 - 0.5 * skin)) / 255;
      r += p.temp * hi * (1 - skin);
      b -= p.temp * hi * 0.5 * (1 - skin);

      // gentle exposure lift, then lifted blacks
      r = r * 1.045 + 0.006;
      g = g * 1.04 + 0.005;
      b = b * 1.03 + 0.004;
      r = r * (1 - p.lift) + p.lift;
      g = g * (1 - p.lift) + p.lift;
      b = b * (1 - p.lift) + p.lift * 1.05;

      d[i] = r * 255;
      d[i + 1] = g * 255;
      d[i + 2] = b * 255;
      d[i + 3] = 255;
    }
  }
}

function addHalation(ctx, w, h, strength) {
  const sw = Math.max(24, Math.round(w / 5));
  const sh = Math.max(24, Math.round(h / 5));
  const small = scratch(sw, sh);
  const sctx = small.getContext('2d');
  sctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const px = sctx.getImageData(0, 0, sw, sh);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    if (lum < 0.7) {
      d[i + 3] = 0;
      continue;
    }
    const k = Math.min(1, (lum - 0.7) / 0.3);
    d[i] = Math.min(255, d[i] * 1.1 + 30 * k);
    d[i + 1] = Math.min(255, d[i + 1] * 1.02 + 12 * k);
    d[i + 2] = Math.min(255, d[i + 2] * 0.95);
    d[i + 3] = 255 * k;
  }
  sctx.putImageData(px, 0, 0);
  const blur = scratch(sw, sh);
  const bctx = blur.getContext('2d');
  bctx.filter = `blur(${Math.max(2, sw / 40)}px)`;
  bctx.drawImage(small, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = strength;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(blur, 0, 0, w, h);
  ctx.restore();
}

export function gradeImage(key, img, gradeId) {
  const id = key + '|' + gradeId;
  const hit = cache.get(id);
  if (hit) return hit;
  const p = GRADE_TABLE[gradeId] || GRADE_TABLE.sunset;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = scratch(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  applyGrade(image.data, w, h, p);
  ctx.putImageData(image, 0, 0);
  addHalation(ctx, w, h, p.halation);
  cache.set(id, c);
  return c;
}

export function gradeGrain(gradeId) {
  return (GRADE_TABLE[gradeId] || GRADE_TABLE.sunset).grain;
}

// Deterministic grain: the same tile every render, so exports repeat.
let grainTile = null;
export function grainPattern(ctx) {
  if (!grainTile) {
    const size = 192;
    const c = scratch(size, size);
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    let s = 20260117;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 96 + (rnd() - 0.5) * 190;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
  }
  return ctx.createPattern(grainTile, 'repeat');
}
