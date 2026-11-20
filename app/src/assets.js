// Image loading and the skin-tone face finder used by "focus face".

import { CAST_DATA, SCENE_DATA } from '../vendor/cast-data.js';

export const CAST_KEYS = ['captain', 'femme', 'mechanic', 'driver', 'lookout', 'detective', 'singer', 'boss'];

export function castUrl(key) {
  return CAST_DATA[key] || '';
}

export function sceneUrl(key) {
  return SCENE_DATA[key] || '';
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export function createAssets() {
  const images = new Map();
  const loading = new Map();
  const urls = new Map();
  return {
    urls,
    get(key) {
      return images.get(key) || null;
    },
    url(key) {
      return urls.get(key) || (CAST_KEYS.includes(key) ? castUrl(key) : '');
    },
    has(key) {
      return images.has(key);
    },
    async add(key, url) {
      if (loading.has(key)) return loading.get(key);
      const p = loadImage(url)
        .then((img) => {
          images.set(key, img);
          if (!urls.has(key)) urls.set(key, url);
          return img;
        })
        .catch((err) => {
          console.warn(err.message);
          return null;
        })
        .finally(() => loading.delete(key));
      loading.set(key, p);
      return p;
    },
    async loadCast() {
      await Promise.all(CAST_KEYS.map((k) => this.add(k, castUrl(k))));
      return this;
    },
    ready() {
      return Promise.all([...loading.values()]);
    },
    keys() {
      return [...images.keys()];
    },
  };
}

// Skin-tone heuristic: 64px wide sample, score mask, take the densest band.
export function focusFace(img) {
  const w = 64;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Float32Array(w * h);
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const skin =
        r > 70 &&
        g > 32 &&
        b > 16 &&
        r > g + 8 &&
        r > b + 10 &&
        max - min > 14 &&
        max - min < 130 &&
        r < 250;
      if (skin) {
        const weight = 1 - Math.abs(g - r * 0.62) / 120;
        mask[y * w + x] = Math.max(0.2, Math.min(1, weight));
        total += mask[y * w + x];
      }
    }
  }
  if (total < w * h * 0.012) return null;

  // rows with the most skin, weighted to the upper two thirds of the frame
  const rows = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += mask[y * w + x];
    rows[y] = s * (y < h * 0.7 ? 1 : 0.55);
  }
  let bestY = 0;
  let bestScore = -1;
  const span = Math.max(2, Math.round(h * 0.09));
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let dy = -span; dy <= span; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < h) s += rows[yy];
    }
    if (s > bestScore) {
      bestScore = s;
      bestY = y;
    }
  }
  const bandTop = Math.max(0, bestY - span);
  const bandBot = Math.min(h - 1, bestY + span);
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let y = bandTop; y <= bandBot; y++) {
    for (let x = 0; x < w; x++) {
      const v = mask[y * w + x];
      if (!v) continue;
      sx += x * v;
      sy += y * v;
      sw += v;
    }
  }
  if (!sw) return null;
  return {
    fx: Math.min(0.86, Math.max(0.14, sx / sw / w)),
    fy: Math.min(0.8, Math.max(0.14, sy / sw / h)),
    confidence: Math.min(1, total / (w * h * 0.06)),
  };
}
