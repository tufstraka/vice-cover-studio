// Vice Cover Studio — the poster renderer.
//
// Every mark here is painted with the 2D canvas API: an asymmetric panel collage, a synthetic
// sunset sky, a filmic teal-and-orange grade, layered palm silhouettes, a code-drawn skyline,
// halftone screen, film grain, light leaks, art-deco ornaments and layered display lettering.
// No external fonts, images or libraries: the only bitmap input is whichever photo the user
// loads, and the same photo renders well in any panel shape.

const DISPLAY = '"Arial Black", Impact, Haettenschweiler, "Franklin Gothic Heavy", sans-serif';
const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

export const PALETTES = {
  vice: {
    label: 'Vice Sunset',
    skyTop: '#071b2e',
    skyMid: '#3c1450',
    skyBottom: '#ff7b4a',
    sun: '#ffcf7a',
    glow: '#ff3f86',
    accent: '#ffd166',
    ink: '#04161f',
    cream: '#fff1d9',
    teal: '#0b3a4c',
    warm: '#ff9a4d',
  },
  night: {
    label: 'Neon Night',
    skyTop: '#03061c',
    skyMid: '#0a1a4a',
    skyBottom: '#155a86',
    sun: '#9ff8ff',
    glow: '#ff2fa8',
    accent: '#61e8ff',
    ink: '#03060f',
    cream: '#eafcff',
    teal: '#062a3a',
    warm: '#ff6fae',
  },
  dusk: {
    label: 'Miami Dusk',
    skyTop: '#2a0f3d',
    skyMid: '#9c2f5c',
    skyBottom: '#ff9a6b',
    sun: '#ffe2b4',
    glow: '#ff7a8a',
    accent: '#ffcf9e',
    ink: '#160a1c',
    cream: '#fff0e2',
    teal: '#123a44',
    warm: '#ffa36b',
  },
  lime: {
    label: 'Toxic Lime',
    skyTop: '#04150f',
    skyMid: '#0e3f30',
    skyBottom: '#2f7a4e',
    sun: '#e6ff7a',
    glow: '#2bff9e',
    accent: '#d4ff4f',
    ink: '#03110b',
    cream: '#f3ffdd',
    teal: '#07281e',
    warm: '#b6ff5e',
  },
  golden: {
    label: 'Golden Hour',
    skyTop: '#24123a',
    skyMid: '#a8493a',
    skyBottom: '#ffc46b',
    sun: '#fff0b8',
    glow: '#ff9a3d',
    accent: '#ffd98a',
    ink: '#180e16',
    cream: '#fff6e6',
    teal: '#16403c',
    warm: '#ffb35c',
  },
};

export const TITLE_STYLES = ['classic', 'neon', 'heist', 'vice'];
export const TITLE_STYLE_LABELS = { classic: 'Classic', neon: 'Neon', heist: 'Heist', vice: 'Vice' };

export const LAYOUTS = ['solo', 'duo', 'triptych', 'quad', 'five', 'grid'];
export const LAYOUT_LABELS = {
  solo: 'Solo',
  duo: 'Duo',
  triptych: 'Triptych',
  quad: 'Quad',
  five: 'Five',
  grid: 'Grid',
};
export const PANEL_COUNT = { solo: 1, duo: 2, triptych: 3, quad: 4, five: 5, grid: 6 };

// Panel geometry in normalized coordinates inside the poster's art area. The layouts are
// deliberately asymmetric: a tall hero, a stack of smaller prints and a wide footer strip.
const GEOMETRY = {
  solo: [{ x: 0, y: 0, w: 1, h: 1 }],
  duo: [
    { x: 0, y: 0, w: 0.6, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 1 },
  ],
  triptych: [
    { x: 0, y: 0, w: 0.63, h: 1 },
    { x: 0.65, y: 0, w: 0.35, h: 0.4 },
    { x: 0.65, y: 0.42, w: 0.35, h: 0.58 },
  ],
  quad: [
    { x: 0, y: 0, w: 0.56, h: 0.58 },
    { x: 0.58, y: 0, w: 0.42, h: 0.58 },
    { x: 0, y: 0.6, w: 0.34, h: 0.4 },
    { x: 0.36, y: 0.6, w: 0.64, h: 0.4 },
  ],
  five: [
    { x: 0, y: 0, w: 0.55, h: 0.65 },
    { x: 0.57, y: 0, w: 0.43, h: 0.315 },
    { x: 0.57, y: 0.335, w: 0.43, h: 0.315 },
    { x: 0, y: 0.67, w: 0.32, h: 0.33 },
    { x: 0.34, y: 0.67, w: 0.66, h: 0.33 },
  ],
  grid: [
    { x: 0, y: 0, w: 0.42, h: 0.55 },
    { x: 0.44, y: 0, w: 0.28, h: 0.55 },
    { x: 0.74, y: 0, w: 0.26, h: 0.55 },
    { x: 0, y: 0.57, w: 0.3, h: 0.43 },
    { x: 0.32, y: 0.57, w: 0.4, h: 0.43 },
    { x: 0.74, y: 0.57, w: 0.26, h: 0.43 },
  ],
};

/** The poster's shared proportions: outer margin and the bottom title strip. */
function metrics(w, h) {
  const margin = Math.min(w, h) * 0.034;
  const strip = h * 0.086;
  return {
    margin,
    strip,
    art: { x: margin, y: margin, w: w - margin * 2, h: h - strip - margin * 2 },
  };
}

/** Panel rectangles in pixels for a poster of w x h, for hit testing and drawing. */
export function panelRects(w, h, layout) {
  const { art } = metrics(w, h);
  const gap = Math.min(art.w, art.h) * 0.014;
  const defs = GEOMETRY[layout] ?? GEOMETRY.solo;
  return defs.map((d) => ({
    x: art.x + d.x * art.w,
    y: art.y + d.y * art.h,
    w: d.w * art.w - gap,
    h: d.h * art.h - gap,
  }));
}

/* ---------- small utilities ---------- */

function hexA(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function trackedWidth(ctx, text, tracking) {
  if (!text) return 0;
  return [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + tracking, 0) - tracking;
}

/** Draws text with manual letter spacing; align is left, center or right. */
function tracked(ctx, text, x, y, tracking, align = 'left') {
  const total = trackedWidth(ctx, text, tracking);
  const start = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  let cx = start;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/** A small outlined label, warm on dark, used for the header tags and strip badges. */
function chip(ctx, label, x, y, height, palette, opts = {}) {
  const font = opts.fontSize ?? height * 0.46;
  const pad = opts.pad ?? height * 0.5;
  ctx.font = `${opts.weight ?? 800} ${font}px ${SANS}`;
  const tracking = font * (opts.tracking ?? 0.13);
  const textW = trackedWidth(ctx, label, tracking);
  const w = textW + pad * 2;
  const rx = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
  roundRect(ctx, rx, y, w, height, height * 0.16);
  ctx.fillStyle = opts.bg ?? hexA(palette.ink, 0.62);
  ctx.fill();
  if (opts.border !== false) {
    ctx.lineWidth = Math.max(1, height * 0.045);
    ctx.strokeStyle = opts.borderColor ?? hexA(palette.cream, 0.32);
    ctx.stroke();
  }
  ctx.fillStyle = opts.color ?? palette.cream;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, label, rx + pad, y + height / 2 + font * 0.04, tracking);
  return w;
}

/* ---------- photo panel ---------- */

/** Draws one photo into rect, cover-fit, honouring the panel's pan focus and zoom. */
function drawPhoto(ctx, img, rect, focusX, focusY, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  let scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  // Keep full coverage when a pan is at its limit.
  scale = Math.max(scale, Math.max(rect.w / iw, rect.h / ih));
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) * focusX;
  const dy = rect.y + (rect.h - dh) * focusY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPlaceholder(ctx, rect, palette, h, rand) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.2, rect.y + rect.h);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.55, palette.skyMid);
  g.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // A tiny sunset and skyline so an empty panel still reads as poster art.
  const sx = rect.x + rect.w * 0.68;
  const sy = rect.y + rect.h * 0.38;
  const sr = Math.min(rect.w, rect.h) * 0.2;
  ctx.fillStyle = hexA(palette.sun, 0.9);
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexA(palette.ink, 0.9);
  for (let x = rect.x; x < rect.x + rect.w; x += rect.w * 0.06) {
    const bh = rect.h * (0.04 + rand() * 0.12);
    ctx.fillRect(x, rect.y + rect.h - bh, rect.w * 0.05, bh);
  }

  ctx.strokeStyle = hexA(palette.cream, 0.2);
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.setLineDash([h * 0.012, h * 0.01]);
  const inset = Math.min(rect.w, rect.h) * 0.08;
  ctx.strokeRect(rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = hexA(palette.cream, 0.6);
  ctx.font = `800 ${Math.max(11, Math.min(rect.w, rect.h) * 0.055)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  tracked(ctx, 'ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2, h * 0.004, 'center');
}

/**
 * The filmic grade: multiply toward deep teal in the shadows, screen a warm bloom into the
 * highlights, then a soft-light pass for saturation and a strong inner vignette.
 */
function gradePanel(ctx, rect, palette, h, sun, panelIndex) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // Deep teal shadows: the lower half of every print cools down.
  let g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.15, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.warm, 0.18));
  g.addColorStop(0.38, hexA(palette.teal, 0.36));
  g.addColorStop(1, hexA(palette.teal, 0.82));
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Shared warm sun bloom: every panel is lit from the same point of the poster.
  const bloom = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(rect.w, rect.h) * 1.05);
  bloom.addColorStop(0, hexA(palette.sun, 0.32));
  bloom.addColorStop(0.42, hexA(palette.warm, 0.1));
  bloom.addColorStop(1, hexA(palette.warm, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bloom;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Split-tone: warm the top edge, cool the bottom edge.
  g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.warm, 0.1));
  g.addColorStop(0.5, hexA(palette.teal, 0.26));
  g.addColorStop(1, hexA(palette.teal, 0.58));
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Contrast lift + saturation, kept per-panel so neighbouring prints vary slightly.
  const lift = 0.05 + (panelIndex % 3) * 0.025;
  g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.4, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.cream, lift));
  g.addColorStop(0.5, hexA(palette.cream, 0));
  g.addColorStop(1, hexA(palette.ink, 0.3));
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // A thin diagonal glass glare sells the print.
  const glare = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  glare.addColorStop(0, 'rgba(255,255,255,0.11)');
  glare.addColorStop(0.32, 'rgba(255,255,255,0.02)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = glare;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const vig = ctx.createRadialGradient(
    rect.x + rect.w / 2,
    rect.y + rect.h * 0.45,
    Math.min(rect.w, rect.h) * 0.22,
    rect.x + rect.w / 2,
    rect.y + rect.h * 0.46,
    Math.max(rect.w, rect.h) * 0.8,
  );
  vig.addColorStop(0, hexA(palette.ink, 0));
  vig.addColorStop(0.68, hexA(palette.ink, 0.1));
  vig.addColorStop(1, hexA(palette.ink, 0.62));
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawPanelContent(ctx, state, palette, rect, index, h, sun, rand) {
  const panel = state.panels[index] ?? { photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 };
  const photo = state.photos?.[panel.photo];

  ctx.save();
  ctx.shadowColor = 'rgba(2, 4, 10, 0.68)';
  ctx.shadowBlur = h * 0.03;
  ctx.shadowOffsetY = h * 0.012;
  ctx.fillStyle = palette.ink;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, h * 0.004);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, h * 0.004);
  ctx.clip();

  if (photo?.img) {
    ctx.save();
    ctx.filter = 'saturate(1.8) contrast(1.65) brightness(0.78)';
    drawPhoto(ctx, photo.img, rect, clamp01(panel.focusX ?? 0.5), clamp01(panel.focusY ?? 0.5), panel.zoom ?? 1);
    ctx.restore();
    gradePanel(ctx, rect, palette, h, sun, index);
  } else {
    drawPlaceholder(ctx, rect, palette, h, rand);
  }

  // Synthetic sky haze: the same sunset washes into the top of every print.
  const haze = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h * 0.7);
  haze.addColorStop(0, hexA(palette.sun, 0.1));
  haze.addColorStop(0.3, hexA(palette.warm, 0.04));
  haze.addColorStop(1, hexA(palette.glow, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = haze;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // A soft light leak in one corner of alternating panels.
  const leakX = index % 2 === 0 ? rect.x : rect.x + rect.w;
  const leak = ctx.createRadialGradient(leakX, rect.y + rect.h * 0.1, 0, leakX, rect.y + rect.h * 0.1, rect.w * 0.6);
  leak.addColorStop(0, hexA(index % 2 === 0 ? palette.sun : palette.warm, 0.1));
  leak.addColorStop(1, hexA(palette.glow, 0));
  ctx.fillStyle = leak;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Thin light frame with a bevel, a chromatic fringe and a small index tag. */
function drawPanelFrame(ctx, palette, rect, index, h) {
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, h * 0.004);
  ctx.lineWidth = Math.max(1, h * 0.0034);
  ctx.strokeStyle = hexA(palette.cream, 0.86);
  ctx.stroke();

  // Bevel: bright top-left, dark bottom-right.
  ctx.beginPath();
  ctx.moveTo(rect.x + 1, rect.y + rect.h * 0.7);
  ctx.lineTo(rect.x + 1, rect.y + 1);
  ctx.lineTo(rect.x + rect.w, rect.y + 1);
  ctx.lineWidth = Math.max(1, h * 0.0028);
  ctx.strokeStyle = hexA(palette.cream, 0.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w - 1, rect.y + rect.h * 0.3);
  ctx.lineTo(rect.x + rect.w - 1, rect.y + rect.h - 1);
  ctx.lineTo(rect.x, rect.y + rect.h - 1);
  ctx.strokeStyle = hexA(palette.ink, 0.6);
  ctx.stroke();

  // Chromatic fringe: a hair of red on the left, cyan on the right.
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = Math.max(1, h * 0.0016);
  ctx.strokeStyle = '#ff2f5e';
  ctx.beginPath();
  ctx.moveTo(rect.x - 1, rect.y + rect.h * 0.2);
  ctx.lineTo(rect.x - 1, rect.y + rect.h * 0.8);
  ctx.stroke();
  ctx.strokeStyle = '#25e0ff';
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w + 1, rect.y + rect.h * 0.2);
  ctx.lineTo(rect.x + rect.w + 1, rect.y + rect.h * 0.8);
  ctx.stroke();
  ctx.restore();

  // Small index tag, cream on ink, top-right.
  if (rect.w > h * 0.12 && rect.h > h * 0.1) {
    const tagH = Math.max(15, h * 0.032);
    const tagW = tagH * 1.5;
    const tx = rect.x + rect.w - tagW - h * 0.012;
    const ty = rect.y + h * 0.013;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = h * 0.012;
    ctx.fillStyle = hexA(palette.ink, 0.78);
    ctx.fillRect(tx, ty, tagW, tagH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(tx, ty + tagH - Math.max(1, h * 0.0028), tagW, Math.max(1, h * 0.0028));
    ctx.fillStyle = palette.cream;
    ctx.font = `800 ${tagH * 0.58}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), tx + tagW / 2, ty + tagH * 0.44);
    ctx.restore();
  }
}

/* ---------- sky, city and palms ---------- */

function drawSky(ctx, w, h, palette, sun, rand) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.42, palette.skyMid);
  g.addColorStop(0.8, palette.skyBottom);
  g.addColorStop(1, hexA(palette.ink, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Haze bands across the sky.
  ctx.save();
  for (let i = 0; i < 7; i += 1) {
    const y = h * (0.14 + rand() * 0.6);
    const bh = h * (0.006 + rand() * 0.02);
    ctx.fillStyle = hexA(i % 2 ? palette.glow : palette.sun, 0.05 + rand() * 0.05);
    ctx.fillRect(0, y, w, bh);
  }
  ctx.restore();

  // Sun: glow first, disc second, retro bands cut out of the lower half.
  const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r * 3.2);
  glow.addColorStop(0, hexA(palette.sun, 0.85));
  glow.addColorStop(0.25, hexA(palette.glow, 0.34));
  glow.addColorStop(1, hexA(palette.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const disc = ctx.createLinearGradient(sun.x, sun.y - sun.r, sun.x, sun.y + sun.r);
  disc.addColorStop(0, palette.sun);
  disc.addColorStop(0.55, hexA(palette.sun, 1));
  disc.addColorStop(1, palette.glow);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = disc;
  ctx.fillRect(sun.x - sun.r, sun.y - sun.r, sun.r * 2, sun.r * 2);
  // Horizontal slats through the lower half of the sun.
  for (let i = 0; i < 9; i += 1) {
    const t = i / 9;
    const y = sun.y + sun.r * (0.05 + t * 0.98);
    ctx.fillStyle = hexA(palette.skyMid, 0.55);
    ctx.fillRect(sun.x - sun.r, y, sun.r * 2, sun.r * (0.012 + t * 0.05));
  }
  ctx.restore();

  // The board behind the prints is a deep ink so the photos carry the light.
  const board = ctx.createLinearGradient(0, 0, 0, h);
  board.addColorStop(0, hexA(palette.ink, 0.62));
  board.addColorStop(0.5, hexA(palette.ink, 0.48));
  board.addColorStop(1, hexA(palette.ink, 0.36));
  ctx.fillStyle = board;
  ctx.fillRect(0, 0, w, h);
}

/** Distant city skyline, drawn twice for depth, silhouetted over the lower poster. */
function drawSkyline(ctx, w, h, palette, rand, margin, strip) {
  const base = h - strip + h * 0.004;
  const layers = [
    { color: palette.teal, alpha: 0.55, maxH: 0.11, windows: 0 },
    { color: palette.ink, alpha: 0.82, maxH: 0.17, windows: 1 },
  ];
  for (const layer of layers) {
    let x = margin * 0.3;
    while (x < w) {
      const bw = w * (0.018 + rand() * 0.05);
      const bh = h * (0.035 + rand() * layer.maxH);
      const bx = x;
      ctx.fillStyle = hexA(layer.color, layer.alpha);
      ctx.fillRect(bx, base - bh, bw, bh);
      // A stepped crown or an antenna on some towers.
      if (rand() > 0.55) {
        const cw = bw * (0.3 + rand() * 0.4);
        ctx.fillRect(bx + bw * 0.2, base - bh - h * 0.012, cw, h * 0.012);
      }
      if (rand() > 0.72) {
        ctx.fillRect(bx + bw * 0.48, base - bh - h * 0.03, Math.max(1, w * 0.0012), h * 0.03);
      }
      if (layer.windows) {
        ctx.fillStyle = hexA(palette.accent, 0.3);
        const cols = Math.max(1, Math.floor(bw / (w * 0.012)));
        const rows = Math.max(1, Math.floor(bh / (h * 0.018)));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if (rand() > 0.66) {
              ctx.fillRect(
                bx + w * 0.004 + c * (bw / cols),
                base - bh + h * 0.006 + r * (bh / rows),
                Math.max(1, w * 0.0026),
                Math.max(1, h * 0.0036),
              );
            }
          }
        }
      }
      x += bw + w * 0.0035;
    }
  }

  // Warm haze sitting on the skyline.
  const haze = ctx.createLinearGradient(0, base - h * 0.16, 0, base);
  haze.addColorStop(0, hexA(palette.glow, 0));
  haze.addColorStop(1, hexA(palette.glow, 0.16));
  ctx.fillStyle = haze;
  ctx.fillRect(0, base - h * 0.16, w, h * 0.16);
}

/**
 * Procedural palm: curved tapered trunk, coconut cluster and arching fronds with leaflets.
 * `tone` is 'ink' for a foreground silhouette or a palette teal for the mid-ground.
 */
function drawPalm(ctx, baseX, baseY, height, lean, palette, flip = 1, tone = 'ink') {
  const crownX = baseX + lean * height * 0.18;
  const crownY = baseY - height;

  const paint = (color, ox, oy) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Trunk.
    ctx.beginPath();
    ctx.moveTo(baseX - height * 0.055, baseY);
    ctx.quadraticCurveTo(
      baseX - height * 0.032 + lean * height * 0.09,
      baseY - height * 0.52,
      crownX - height * 0.017,
      crownY,
    );
    ctx.lineTo(crownX + height * 0.017, crownY);
    ctx.quadraticCurveTo(
      baseX + height * 0.024 + lean * height * 0.09,
      baseY - height * 0.52,
      baseX + height * 0.055,
      baseY,
    );
    ctx.closePath();
    ctx.fill();

    // Trunk rings.
    ctx.lineWidth = Math.max(1, height * 0.004);
    for (let i = 1; i < 7; i += 1) {
      const t = i / 7;
      const y = baseY - height * t;
      const cx = baseX + lean * height * 0.09 * (1 - (1 - t) * (1 - t)) * 0.9;
      const half = height * (0.052 - t * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.quadraticCurveTo(cx, y + height * 0.012, cx + half, y);
      ctx.stroke();
    }

    // Coconuts.
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(crownX + (i - 1) * height * 0.022, crownY + height * 0.014, height * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fronds: broad tapered blades arching out of the crown and drooping at the tips.
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const angle = -Math.PI * 1.0 + t * Math.PI * 0.96;
      const dirX = Math.cos(angle) * flip;
      const dirY = Math.sin(angle);
      const len = height * (0.3 + 0.16 * Math.sin(t * Math.PI)) * (i % 2 === 0 ? 1 : 0.88);
      const p0 = { x: crownX, y: crownY };
      const p1 = { x: crownX + dirX * len * 0.48, y: crownY + dirY * len * 0.64 - len * 0.22 };
      const p2 = { x: crownX + dirX * len * 0.94, y: crownY + dirY * len * 0.3 + len * 0.36 };

      const edge = [];
      const segs = 14;
      const widthAt = (tt) => len * 0.075 * Math.sin(Math.PI * Math.min(1, tt * 1.02)) * (1 - tt * 0.05);
      for (let k = 0; k <= segs; k += 1) {
        const tt = k / segs;
        const px = (1 - tt) * (1 - tt) * p0.x + 2 * (1 - tt) * tt * p1.x + tt * tt * p2.x;
        const py = (1 - tt) * (1 - tt) * p0.y + 2 * (1 - tt) * tt * p1.y + tt * tt * p2.y;
        const dx = 2 * (1 - tt) * (p1.x - p0.x) + 2 * tt * (p2.x - p1.x);
        const dy = 2 * (1 - tt) * (p1.y - p0.y) + 2 * tt * (p2.y - p1.y);
        const norm = Math.hypot(dx, dy) || 1;
        const nx = -dy / norm;
        const ny = dx / norm;
        // A smooth blade with a soft taper reads as a palm at poster scale.
        const tooth = 1 - 0.06 * Math.sin(tt * Math.PI * 7);
        const width = widthAt(tt) * tooth;
        edge.push({
          ax: px + nx * width,
          ay: py + ny * width,
          bx: px - nx * width,
          by: py - ny * width,
        });
      }
      ctx.beginPath();
      ctx.moveTo(edge[0].ax, edge[0].ay);
      for (const point of edge.slice(1)) ctx.lineTo(point.ax, point.ay);
      for (let k = edge.length - 1; k >= 0; k -= 1) ctx.lineTo(edge[k].bx, edge[k].by);
      ctx.closePath();
      ctx.fill();

      // A darker midrib keeps the frond from reading as a solid blob.
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = Math.max(1, height * 0.0038);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  if (tone === 'ink') {
    paint(hexA(palette.accent, 0.32), -height * 0.005, -height * 0.005);
    if (flip < 0) paint(hexA(palette.accent, 0.32), height * 0.005, -height * 0.005);
    paint(palette.ink, 0, 0);
  } else {
    paint(tone, 0, 0);
  }
}

function drawSceneryPalms(ctx, w, h, palette) {
  const landscape = w > h * 1.2;
  if (landscape) {
    drawPalm(ctx, w * 0.025, h * 1.02, h * 0.52, 0.5, palette, 1);
    drawPalm(ctx, w * 0.975, h * 1.015, h * 0.44, -0.45, palette, -1);
  } else {
    drawPalm(ctx, w * 0.035, h * 1.005, h * 0.17, 0.45, palette, 1);
    drawPalm(ctx, w * 0.965, h * 1.0, h * 0.15, -0.4, palette, -1);
  }
}

/* ---------- texture layers ---------- */

let noiseFine = null;
let noiseCoarse = null;

function noiseTile(size, min, spread) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const nctx = c.getContext('2d');
  const data = nctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = min + Math.random() * spread;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return c;
}

function drawHalftone(ctx, w, h, palette) {
  const spacing = Math.max(7, Math.min(w, h) * 0.019);
  ctx.save();
  for (let y = spacing * 0.5; y < h; y += spacing) {
    for (let x = spacing * 0.5; x < w; x += spacing) {
      const t = 0.3 + 0.7 * (x / w) * (y / h);
      ctx.fillStyle = hexA(palette.cream, 0.055 + t * 0.05);
      ctx.beginPath();
      ctx.arc(x, y, spacing * (0.07 + 0.15 * t), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawGrain(ctx, w, h) {
  if (!noiseFine) noiseFine = noiseTile(180, 96, 128);
  if (!noiseCoarse) noiseCoarse = noiseTile(340, 88, 120);
  const fine = ctx.createPattern(noiseFine, 'repeat');
  const coarse = ctx.createPattern(noiseCoarse, 'repeat');
  ctx.save();
  if (fine) {
    ctx.globalAlpha = 0.14;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = fine;
    ctx.fillRect(0, 0, w, h);
  }
  if (coarse) {
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = coarse;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function drawLightLeaks(ctx, w, h, palette) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  let g = ctx.createRadialGradient(w * 0.98, h * 0.04, 0, w * 0.98, h * 0.04, Math.max(w, h) * 0.7);
  g.addColorStop(0, hexA(palette.sun, 0.18));
  g.addColorStop(0.4, hexA(palette.warm, 0.07));
  g.addColorStop(1, hexA(palette.warm, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  g = ctx.createRadialGradient(w * 0.02, h * 0.96, 0, w * 0.02, h * 0.96, Math.max(w, h) * 0.55);
  g.addColorStop(0, hexA(palette.glow, 0.08));
  g.addColorStop(1, hexA(palette.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx, w, h, palette) {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.34, w / 2, h * 0.5, Math.max(w, h) * 0.8);
  g.addColorStop(0, hexA(palette.ink, 0));
  g.addColorStop(0.72, hexA(palette.ink, 0.08));
  g.addColorStop(1, hexA(palette.ink, 0.54));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const edge = ctx.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, hexA(palette.ink, 0.42));
  edge.addColorStop(0.18, hexA(palette.ink, 0));
  edge.addColorStop(0.86, hexA(palette.ink, 0));
  edge.addColorStop(1, hexA(palette.ink, 0.3));
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

/** Nested corner lines and a fan — the art-deco furniture of the poster frame. */
function drawDeco(ctx, w, h, palette, margin) {
  const inset = margin * 0.42;
  const len = Math.min(w, h) * 0.075;
  ctx.save();
  ctx.strokeStyle = hexA(palette.cream, 0.4);
  ctx.lineWidth = Math.max(1, h * 0.0018);
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.strokeStyle = hexA(palette.accent, 0.2);
  ctx.strokeRect(inset + h * 0.008, inset + h * 0.008, w - inset * 2 - h * 0.016, h - inset * 2 - h * 0.016);

  ctx.strokeStyle = hexA(palette.accent, 0.55);
  ctx.lineWidth = Math.max(1, h * 0.0024);
  const corners = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * h * 0.006, cy + sy * len);
    ctx.lineTo(cx + sx * h * 0.006, cy + sy * h * 0.006);
    ctx.lineTo(cx + sx * len, cy + sy * h * 0.006);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sx * h * 0.022, cy + sy * len * 0.72);
    ctx.lineTo(cx + sx * h * 0.022, cy + sy * h * 0.022);
    ctx.lineTo(cx + sx * len * 0.72, cy + sy * h * 0.022);
    ctx.stroke();
    // A fan of arcs in the corner.
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const r = h * (0.018 + i * 0.012);
      ctx.moveTo(cx + sx * r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI / 2, sx * sy < 0);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- lettering ---------- */

let stripePattern = null;
function getStripes() {
  if (stripePattern) return stripePattern;
  const c = document.createElement('canvas');
  c.width = 6;
  c.height = 6;
  const sctx = c.getContext('2d');
  sctx.clearRect(0, 0, 6, 6);
  sctx.fillStyle = 'rgba(255,255,255,0.9)';
  sctx.fillRect(0, 0, 6, 2);
  stripePattern = c;
  return c;
}

function fitDisplaySize(ctx, text, maxW, start, min, style) {
  let size = start;
  while (size > min) {
    ctx.font = `900 ${size}px ${DISPLAY}`;
    const skewPad = style === 'heist' ? 1 : 1.045;
    if (ctx.measureText(text).width * skewPad <= maxW) break;
    size -= Math.max(1, size * 0.02);
  }
  return size;
}

function paintTitle(ctx, text, x, baseline, size, style, palette) {
  const grad = ctx.createLinearGradient(0, baseline - size * 0.95, 0, baseline + size * 0.1);
  if (style === 'neon') {
    grad.addColorStop(0, '#b6f4ff');
    grad.addColorStop(0.3, palette.accent);
    grad.addColorStop(0.66, palette.glow);
    grad.addColorStop(1, '#6a10a0');
  } else if (style === 'heist') {
    grad.addColorStop(0, '#fff8e8');
    grad.addColorStop(0.52, '#f2e0c0');
    grad.addColorStop(1, '#d2b184');
  } else if (style === 'vice') {
    grad.addColorStop(0, '#fff6e8');
    grad.addColorStop(0.42, palette.cream);
    grad.addColorStop(0.76, palette.glow);
    grad.addColorStop(1, palette.accent);
  } else {
    grad.addColorStop(0, '#fffdf6');
    grad.addColorStop(0.45, palette.cream);
    grad.addColorStop(1, palette.warm);
  }

  const skew = style === 'heist' ? -0.015 : -0.05;
  ctx.save();
  ctx.translate(x, baseline);
  ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Offset shadow, with a magenta print misregistration under the classic face.
  if (style === 'classic') {
    ctx.fillStyle = hexA(palette.glow, 0.5);
    ctx.fillText(text, -size * 0.014, size * 0.02);
  }
  ctx.fillStyle = hexA(palette.ink, style === 'neon' ? 0.85 : 0.62);
  ctx.fillText(text, size * 0.028, size * 0.055);
  if (style === 'heist') {
    ctx.fillStyle = hexA(palette.accent, 0.9);
    ctx.fillText(text, size * 0.05, size * 0.078);
  }

  // Chromatic aberration fringes.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = style === 'neon' ? 0.4 : 0.26;
  ctx.fillStyle = '#ff3b6b';
  ctx.fillText(text, -size * 0.012, 0);
  ctx.fillStyle = '#39e9ff';
  ctx.fillText(text, size * 0.012, 0);
  ctx.restore();

  // Neon tube glow under the glyphs.
  if (style === 'neon') {
    ctx.save();
    ctx.shadowColor = palette.accent;
    ctx.shadowBlur = size * 0.32;
    ctx.fillStyle = hexA(palette.accent, 0.7);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Heavy outline, then the gradient fill and a top sheen.
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * (style === 'heist' ? 0.058 : style === 'neon' ? 0.024 : 0.034);
  ctx.strokeStyle = style === 'neon' ? hexA(palette.ink, 0.85) : palette.ink;
  ctx.strokeText(text, 0, 0);
  if (style === 'vice') {
    ctx.lineWidth = size * 0.015;
    ctx.strokeStyle = hexA(palette.glow, 0.95);
    ctx.strokeText(text, 0, 0);
  }
  if (style === 'classic') {
    ctx.lineWidth = size * 0.012;
    ctx.strokeStyle = hexA(palette.accent, 0.55);
    ctx.strokeText(text, 0, 0);
  }

  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  const sheen = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillText(text, 0, 0);

  if (style === 'vice') {
    const pattern = ctx.createPattern(getStripes(), 'repeat');
    if (pattern) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = pattern;
      ctx.fillRect(-size * 0.2, baseline - size * 1.1, size * (text.length + 2), size * 1.4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  ctx.restore();
}

function drawCaption(ctx, state, palette, w, h, strip, margin) {
  const text = (state.caption ?? '').trim().toUpperCase();
  const location = (state.location ?? 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const top = state.captionPosition === 'top';
  const style = TITLE_STYLES.includes(state.titleStyle) ? state.titleStyle : 'classic';

  const scrimH = h * 0.34;
  const scrim = ctx.createLinearGradient(0, top ? 0 : h - strip - scrimH, 0, top ? scrimH : h - strip);
  if (top) {
    scrim.addColorStop(0, hexA(palette.ink, 0.82));
    scrim.addColorStop(0.55, hexA(palette.ink, 0.34));
    scrim.addColorStop(1, hexA(palette.ink, 0));
  } else {
    scrim.addColorStop(0, hexA(palette.ink, 0));
    scrim.addColorStop(0.55, hexA(palette.ink, 0.36));
    scrim.addColorStop(1, hexA(palette.ink, 0.76));
  }
  ctx.fillStyle = scrim;
  if (top) ctx.fillRect(0, 0, w, scrimH);
  else ctx.fillRect(0, h - strip - scrimH, w, scrimH);

  const maxW = w - margin * 2 - w * 0.015;
  const start = Math.min(h * 0.17, w * 0.15);
  const size = text ? fitDisplaySize(ctx, text, maxW, start, h * 0.045, style) : 0;

  const kickerSize = Math.max(10, h * 0.02);
  const kicker = `A ${location} STORY`;
  const baseline = top ? margin + h * 0.075 + size : h - strip - h * 0.04;
  const kickerY = top ? margin + h * 0.05 : baseline - size * 1.02;

  // Kicker with rules either side.
  ctx.save();
  ctx.font = `800 ${kickerSize}px ${SANS}`;
  ctx.fillStyle = palette.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const kickTrack = kickerSize * 0.3;
  tracked(ctx, kicker, margin, kickerY, kickTrack);
  const kw = trackedWidth(ctx, kicker, kickTrack);
  ctx.fillStyle = hexA(palette.accent, 0.55);
  ctx.fillRect(margin, kickerY + kickerSize * 0.6, Math.max(kw * 0.45, w * 0.05), Math.max(1, h * 0.0022));
  ctx.restore();

  if (!text) return;

  paintTitle(ctx, text, margin, baseline, size, style, palette);

}

function drawBarcode(ctx, x, y, w, h, palette, rand) {
  ctx.save();
  ctx.fillStyle = palette.cream;
  ctx.fillRect(x, y, w, h);
  const pad = w * 0.06;
  let bx = x + pad;
  const barTop = y + h * 0.12;
  const barH = h * 0.62;
  ctx.fillStyle = palette.ink;
  while (bx < x + w - pad) {
    const bw = Math.max(1, w * (0.008 + rand() * 0.022));
    if (rand() > 0.32) ctx.fillRect(bx, barTop, bw, barH);
    bx += bw + Math.max(1, w * 0.008);
  }
  ctx.font = `700 ${Math.max(6, h * 0.13)}px ${SANS}`;
  ctx.fillStyle = hexA(palette.ink, 0.8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0 6 0 2 2 6', x + w / 2, y + h * 0.76);
  ctx.restore();
}

function drawStrip(ctx, state, palette, w, h, strip, margin) {
  const y0 = h - strip;
  ctx.fillStyle = hexA(palette.ink, 0.97);
  ctx.fillRect(0, y0, w, strip);

  const lineG = ctx.createLinearGradient(0, 0, w, 0);
  lineG.addColorStop(0, palette.accent);
  lineG.addColorStop(0.5, palette.glow);
  lineG.addColorStop(1, palette.accent);
  ctx.fillStyle = lineG;
  ctx.fillRect(0, y0, w, Math.max(2, h * 0.0026));

  const location = (state.location ?? 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  const cy = y0 + strip / 2;
  const starR = strip * 0.17;
  const starX = margin + starR;

  starPath(ctx, starX, cy, starR, starR * 0.44);
  ctx.fillStyle = palette.accent;
  ctx.fill();

  const chipH = strip * 0.48;
  const hasBarcode = w >= h * 0.88;
  const barcodeW = strip * 1.5;
  const barcodeH = strip * 0.5;
  const badgeGap = strip * 0.16;

  // Measure the fixed right-hand block first, so the location lane can be fitted to what is left.
  const tags = [
    { label: 'DELUXE', color: palette.cream, bg: 'transparent', borderColor: hexA(palette.cream, 0.4) },
    { label: '18+', color: palette.cream, bg: 'transparent', borderColor: hexA(palette.cream, 0.4) },
    { label: '$69.99', color: palette.ink, bg: palette.accent, border: false },
  ];
  const tagWidths = tags.map((tag) => {
    ctx.font = `800 ${chipH * 0.46}px ${SANS}`;
    return trackedWidth(ctx, tag.label, chipH * 0.46 * 0.12) + chipH;
  });
  if (hasBarcode) {
    drawBarcode(ctx, w - margin - barcodeW, cy - barcodeH / 2, barcodeW, barcodeH, palette, mulberry32(hashSeed(location) + 7));
  }

  let cursor = w - margin - (hasBarcode ? barcodeW + badgeGap : 0);
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    chip(ctx, tag.label, cursor, cy - chipH / 2, chipH, palette, {
      align: 'right',
      bg: tag.bg,
      color: tag.color,
      border: tag.border !== false,
      borderColor: tag.borderColor,
      fontSize: chipH * 0.46,
      pad: chipH * 0.5,
    });
    cursor -= tagWidths[i] + (i < tags.length - 1 ? badgeGap : 0);
  }

  // Location lane: shrink the tracking and then the type until it clears the badges.
  const locX = starX + starR * 2.2;
  const locMax = Math.max(w * 0.12, cursor - locX - strip * 0.4);
  let locSize = strip * 0.3;
  let locTrack = locSize * 0.18;
  ctx.font = `800 ${locSize}px ${SANS}`;
  while (locSize > strip * 0.19 && trackedWidth(ctx, location, locTrack) > locMax) {
    locSize *= 0.92;
    locTrack = locSize * 0.18;
    ctx.font = `800 ${locSize}px ${SANS}`;
  }
  ctx.fillStyle = palette.cream;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, location, locX, cy + locSize * 0.04, locTrack);
  const locW = trackedWidth(ctx, location, locTrack);

  // Edition / subtitle note, only when the strip has room for it.
  if (w > h * 1.22) {
    const note = subtitle || 'MULTI-PANEL PICTURE · 2026';
    const noteSize = strip * 0.2;
    const noteX = locX + locW + strip * 0.55;
    const noteMax = cursor - noteX - strip * 0.3;
    if (noteMax > w * 0.1) {
      ctx.save();
      ctx.font = `700 ${noteSize}px ${SANS}`;
      ctx.fillStyle = hexA(palette.cream, 0.48);
      ctx.textBaseline = 'middle';
      let label = note;
      while (label.length > 4 && trackedWidth(ctx, label, noteSize * 0.22) > noteMax) label = label.slice(0, -2);
      tracked(ctx, label, noteX, cy + noteSize * 0.04, noteSize * 0.22);
      ctx.restore();
    }
  }
}

function drawHeader(ctx, state, palette, w, h, margin) {
  const height = Math.max(20, h * 0.036);
  const y = margin + h * 0.012;
  const label = 'VICE COVER STUDIO';
  const location = (state.location ?? 'VICE CITY').trim().toUpperCase() || 'VICE CITY';

  ctx.save();
  ctx.font = `800 ${height * 0.42}px ${SANS}`;
  const lw = trackedWidth(ctx, label, height * 0.42 * 0.15) + height * 1.05;
  roundRect(ctx, margin + h * 0.01, y, lw, height, height * 0.18);
  ctx.fillStyle = hexA(palette.ink, 0.58);
  ctx.fill();
  ctx.strokeStyle = hexA(palette.cream, 0.28);
  ctx.lineWidth = Math.max(1, height * 0.04);
  ctx.stroke();

  const starR = height * 0.19;
  starPath(ctx, margin + h * 0.01 + height * 0.42, y + height / 2, starR, starR * 0.44);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.fillStyle = palette.cream;
  ctx.font = `800 ${height * 0.41}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, label, margin + h * 0.01 + height * 0.74, y + height / 2 + height * 0.02, height * 0.42 * 0.15);

  chip(ctx, `ISSUE 07 · ${location}`, w - margin - h * 0.01, y, height, palette, {
    align: 'right',
    bg: hexA(palette.ink, 0.58),
    fontSize: height * 0.38,
  });
  ctx.restore();
}


/** A final teal-and-orange split-tone across the whole poster, warm centre, cool corners. */
function drawSplitTone(ctx, w, h, palette) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createRadialGradient(w * 0.72, h * 0.24, 0, w * 0.72, h * 0.24, Math.max(w, h) * 0.8);
  g.addColorStop(0, hexA(palette.warm, 0.18));
  g.addColorStop(1, hexA(palette.warm, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hexA(palette.teal, 0.22));
  g.addColorStop(0.45, hexA(palette.teal, 0));
  g.addColorStop(1, hexA(palette.teal, 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Paints a complete cover. `w` and `h` are the output pixels; `state` carries the layout,
 * caption, subtitle, title style, palette id, panels (photo, focus and zoom) and texture toggles.
 */
export function renderCover(canvas, state, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const palette = PALETTES[state.palette] ?? PALETTES.vice;
  const { strip, margin } = metrics(w, h);
  const seed = hashSeed(
    `${state.layout}|${state.palette}|${state.caption}|${state.subtitle}|${state.titleStyle}|${Math.round(w)}x${Math.round(h)}`,
  );
  const rand = mulberry32(seed);
  const sun = { x: w * 0.72, y: h * 0.17, r: Math.min(w, h) * 0.15 };

  drawSky(ctx, w, h, palette, sun, rand);

  const rects = panelRects(w, h, state.layout ?? 'solo');
  rects.forEach((rect, i) => drawPanelContent(ctx, state, palette, rect, i, h, sun, rand));

  if (state.halftone !== false) drawHalftone(ctx, w, h, palette);

  drawLightLeaks(ctx, w, h, palette);
  drawSkyline(ctx, w, h, palette, rand, margin, strip);
  drawSceneryPalms(ctx, w, h, palette);
  rects.forEach((rect, i) => drawPanelFrame(ctx, palette, rect, i, h));

  drawCaption(ctx, state, palette, w, h, strip, margin);
  drawStrip(ctx, state, palette, w, h, strip, margin);
  drawHeader(ctx, state, palette, w, h, margin);
  drawDeco(ctx, w, h, palette, margin);
  drawVignette(ctx, w, h, palette);
  drawSplitTone(ctx, w, h, palette);
  if (state.grain !== false) drawGrain(ctx, w, h);
}
