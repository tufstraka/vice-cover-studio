// Vice Cover Studio — the poster renderer.
//
// Everything here is drawn with the 2D canvas API: an asymmetric panel collage, a graded
// sunset/neon palette per panel, halftone dots, film grain, rim-lit panel borders, procedural
// palm silhouettes and oversized display lettering. No external fonts, images or libraries:
// the only bitmap input is whichever photo the user loaded.

const DISPLAY = '"Arial Black", Impact, Haettenschweiler, "Franklin Gothic Heavy", sans-serif';
const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const PALETTES = {
  vice: {
    label: 'Vice Sunset',
    skyTop: '#230f45',
    skyBottom: '#7d1f55',
    sun: '#ffc76b',
    glow: '#ff4d8d',
    accent: '#ffd166',
    ink: '#150a24',
    cream: '#fff2dc',
  },
  night: {
    label: 'Neon Night',
    skyTop: '#050a24',
    skyBottom: '#0d2c6b',
    sun: '#79f7ff',
    glow: '#ff2fa8',
    accent: '#55e6ff',
    ink: '#050815',
    cream: '#eafcff',
  },
  dusk: {
    label: 'Miami Dusk',
    skyTop: '#3a1240',
    skyBottom: '#c94f6d',
    sun: '#ffd9a0',
    glow: '#ff8a5c',
    accent: '#ffcf9e',
    ink: '#1b0a1c',
    cream: '#fff0e2',
  },
  lime: {
    label: 'Toxic Lime',
    skyTop: '#06170f',
    skyBottom: '#1d5a3a',
    sun: '#e2ff6b',
    glow: '#2bff9e',
    accent: '#d4ff4f',
    ink: '#04120b',
    cream: '#f3ffdd',
  },
};

export const LAYOUTS = ['solo', 'duo', 'triptych', 'five'];
export const LAYOUT_LABELS = { solo: 'Solo', duo: 'Duo', triptych: 'Triptych', five: 'Five' };
export const PANEL_COUNT = { solo: 1, duo: 2, triptych: 3, five: 5 };

// Panel geometry in normalized coordinates inside the poster's art area. Gaps are cut from
// each rectangle so the layout reads as separate prints on a dark board.
const GEOMETRY = {
  solo: [{ x: 0, y: 0, w: 1, h: 1 }],
  duo: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.64, y: 0, w: 0.36, h: 1 },
  ],
  triptych: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.64, y: 0, w: 0.36, h: 0.49 },
    { x: 0.64, y: 0.51, w: 0.36, h: 0.49 },
  ],
  five: [
    { x: 0, y: 0, w: 0.6, h: 0.655 },
    { x: 0.62, y: 0, w: 0.38, h: 0.315 },
    { x: 0.62, y: 0.34, w: 0.38, h: 0.315 },
    { x: 0, y: 0.675, w: 0.48, h: 0.325 },
    { x: 0.5, y: 0.675, w: 0.5, h: 0.325 },
  ],
};

/** The poster's shared proportions: outer margin and the bottom title strip. */
function metrics(w, h) {
  const margin = Math.min(w, h) * 0.036;
  const strip = h * 0.082;
  return {
    margin,
    strip,
    art: { x: margin, y: margin, w: w - margin * 2, h: h - strip - margin * 2 },
  };
}

/** Panel rectangles in pixels for a poster of w x h, for hit testing and drawing. */
export function panelRects(w, h, layout) {
  const { art } = metrics(w, h);
  const gap = Math.min(art.w, art.h) * 0.017;
  const defs = GEOMETRY[layout] ?? GEOMETRY.solo;
  return defs.map((d) => ({
    x: art.x + d.x * art.w,
    y: art.y + d.y * art.h,
    w: d.w * art.w - gap,
    h: d.h * art.h - gap,
  }));
}

function hexA(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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
  roundRect(ctx, rx, y, w, height, height * 0.18);
  ctx.fillStyle = opts.bg ?? hexA(palette.ink, 0.66);
  ctx.fill();
  if (opts.border !== false) {
    ctx.lineWidth = Math.max(1, height * 0.045);
    ctx.strokeStyle = opts.borderColor ?? hexA(palette.cream, 0.34);
    ctx.stroke();
  }
  ctx.fillStyle = opts.color ?? palette.cream;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, label, rx + pad, y + height / 2 + font * 0.04, tracking);
  return w;
}

/** Draws one photo into rect, cover-fit, honouring the panel's pan focus and zoom. */
function drawPhoto(ctx, img, rect, focusX, focusY, zoom) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  let scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  // A very wide or tall panel keeps a sane minimum coverage.
  scale = Math.max(scale, Math.max(rect.w / iw, rect.h / ih));
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) * focusX;
  const dy = rect.y + (rect.h - dh) * focusY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawPlaceholder(ctx, rect, palette, h) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.skyTop, 1));
  g.addColorStop(1, hexA(palette.skyBottom, 1));
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = hexA(palette.cream, 0.22);
  ctx.lineWidth = Math.max(1, h * 0.002);
  ctx.setLineDash([h * 0.012, h * 0.01]);
  const inset = Math.min(rect.w, rect.h) * 0.08;
  ctx.strokeRect(rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2);
  ctx.setLineDash([]);
  ctx.fillStyle = hexA(palette.cream, 0.55);
  ctx.font = `800 ${Math.max(11, Math.min(rect.w, rect.h) * 0.055)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  tracked(ctx, 'ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2, h * 0.004, 'center');
}

function gradePanel(ctx, rect, palette, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // Warm the highlights and push the shadows toward the palette's ink.
  let g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.skyTop, 0.34));
  g.addColorStop(0.55, hexA(palette.glow, 0.1));
  g.addColorStop(1, hexA(palette.glow, 0.3));
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.sun, 0.06));
  g.addColorStop(0.55, hexA(palette.sun, 0.14));
  g.addColorStop(1, hexA(palette.glow, 0.34));
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  g.addColorStop(0, hexA(palette.ink, 0.34));
  g.addColorStop(0.5, hexA(palette.ink, 0.02));
  g.addColorStop(1, hexA(palette.ink, 0.18));
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Sun bloom drifting in from above the frame.
  const sun = ctx.createRadialGradient(
    rect.x + rect.w * 0.72,
    rect.y + rect.h * 0.1,
    0,
    rect.x + rect.w * 0.72,
    rect.y + rect.h * 0.1,
    Math.max(rect.w, rect.h) * 0.85,
  );
  sun.addColorStop(0, hexA(palette.sun, 0.55));
  sun.addColorStop(0.35, hexA(palette.sun, 0.16));
  sun.addColorStop(1, hexA(palette.sun, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = sun;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // A diagonal glass glare, subtle enough to read as a print.
  const glare = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  glare.addColorStop(0, 'rgba(255,255,255,0.1)');
  glare.addColorStop(0.35, 'rgba(255,255,255,0.02)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = glare;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Inner vignette.
  const vig = ctx.createRadialGradient(
    rect.x + rect.w / 2,
    rect.y + rect.h * 0.46,
    Math.min(rect.w, rect.h) * 0.2,
    rect.x + rect.w / 2,
    rect.y + rect.h * 0.46,
    Math.max(rect.w, rect.h) * 0.78,
  );
  vig.addColorStop(0, hexA(palette.ink, 0));
  vig.addColorStop(1, hexA(palette.ink, 0.5));
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawPanel(ctx, state, palette, rect, index, h) {
  const panel = state.panels[index] ?? { photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 };
  const photo = state.photos?.[panel.photo];

  ctx.save();
  // Drop shadow under the print.
  ctx.shadowColor = 'rgba(3, 0, 12, 0.62)';
  ctx.shadowBlur = h * 0.026;
  ctx.shadowOffsetY = h * 0.01;
  ctx.fillStyle = hexA(palette.ink, 1);
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, h * 0.004);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, h * 0.004);
  ctx.clip();

  if (photo?.img) {
    ctx.save();
    ctx.filter = 'saturate(1.24) contrast(1.16) brightness(0.94)';
    drawPhoto(ctx, photo.img, rect, panel.focusX ?? 0.5, panel.focusY ?? 0.5, panel.zoom ?? 1);
    ctx.restore();
    gradePanel(ctx, rect, palette, h);
  } else {
    drawPlaceholder(ctx, rect, palette, h);
  }

  // Rim light along the top and left edges.
  const rim = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.7, rect.y + rect.h * 0.7);
  rim.addColorStop(0, hexA(palette.cream, 0.7));
  rim.addColorStop(0.45, hexA(palette.accent, 0.16));
  rim.addColorStop(1, hexA(palette.accent, 0));
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, h * 0.003);
  ctx.beginPath();
  ctx.moveTo(rect.x + 1, rect.y + rect.h);
  ctx.lineTo(rect.x + 1, rect.y + 1);
  ctx.lineTo(rect.x + rect.w, rect.y + 1);
  ctx.stroke();
  ctx.restore();

  // Frame.
  ctx.save();
  roundRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, h * 0.004);
  ctx.strokeStyle = hexA(palette.cream, 0.8);
  ctx.lineWidth = Math.max(1.4, h * 0.0034);
  ctx.stroke();
  ctx.restore();

  // Panel index, small and editorial.
  if (rect.w > h * 0.16 && rect.h > h * 0.14) {
    ctx.save();
    ctx.font = `800 ${Math.max(11, h * 0.019)}px ${SANS}`;
    ctx.fillStyle = hexA(palette.cream, 0.92);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = h * 0.01;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    tracked(ctx, String(index + 1).padStart(2, '0'), rect.x + rect.w - h * 0.014, rect.y + h * 0.014, h * 0.002, 'right');
    ctx.restore();
  }
}

/** Procedural palm silhouette: tapered trunk, arching fronds, leaflets. */
function drawPalm(ctx, baseX, baseY, height, lean, palette, flip = 1) {
  const crownX = baseX + lean * height * 0.15;
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
    ctx.moveTo(baseX - height * 0.048, baseY);
    ctx.quadraticCurveTo(baseX - height * 0.032 + lean * height * 0.06, baseY - height * 0.48, crownX - height * 0.017, crownY);
    ctx.lineTo(crownX + height * 0.017, crownY);
    ctx.quadraticCurveTo(baseX + height * 0.022 + lean * height * 0.06, baseY - height * 0.5, baseX + height * 0.048, baseY);
    ctx.closePath();
    ctx.fill();

    // Coconuts.
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(crownX + (i - 1) * height * 0.021, crownY + height * 0.012, height * 0.014, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fronds: filled, tapered blades arching out of the crown.
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const angle = -Math.PI * 0.95 + t * Math.PI * 0.9;
      const length = height * (0.4 + 0.15 * Math.sin(t * Math.PI)) * (i % 2 === 0 ? 1 : 0.9);
      const tipX = crownX + Math.cos(angle) * length * flip;
      const tipY = crownY + Math.sin(angle) * length * 0.7 + length * 0.3;
      const ctrlX = crownX + Math.cos(angle) * length * 0.55 * flip;
      const ctrlY = crownY + Math.sin(angle) * length * 0.55 - length * 0.1;
      const dx = tipX - ctrlX;
      const dy = tipY - ctrlY;
      const norm = Math.hypot(dx, dy) || 1;
      const px = -dy / norm;
      const py = dx / norm;
      const width = height * 0.05 * (0.55 + 0.45 * Math.sin(t * Math.PI)) * (i % 2 === 0 ? 1 : -1);

      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(ctrlX + px * width, ctrlY + py * width, tipX, tipY);
      ctx.quadraticCurveTo(ctrlX - px * width * 0.8, ctrlY - py * width * 0.8, crownX, crownY);
      ctx.fill();
    }
    ctx.restore();
  };

  // A pale rim on the upper-left, then the ink silhouette on top.
  paint(hexA(palette.accent, 0.4), -height * 0.006, -height * 0.006);
  if (flip < 0) paint(hexA(palette.accent, 0.4), height * 0.006, -height * 0.006);
  paint(palette.ink, 0, 0);
}

function drawBackground(ctx, w, h, palette) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.55, hexA(palette.skyTop, 1));
  g.addColorStop(1, hexA(palette.skyBottom, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const bloom = ctx.createRadialGradient(w * 0.68, h * 0.1, 0, w * 0.68, h * 0.1, Math.max(w, h) * 0.85);
  bloom.addColorStop(0, hexA(palette.glow, 0.5));
  bloom.addColorStop(0.5, hexA(palette.glow, 0.12));
  bloom.addColorStop(1, hexA(palette.glow, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);

  // Faint horizontal scanner lines give the board texture.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = palette.cream;
  for (let y = 0; y < h; y += Math.max(3, h * 0.006)) ctx.fillRect(0, y, w, 1);
  ctx.restore();

  // Corner sun arcs.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = Math.max(1, h * 0.0016);
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(w * 1.02, -h * 0.04, h * 0.12 * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

let noiseTile = null;
function getNoise() {
  if (noiseTile) return noiseTile;
  const size = 220;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const nctx = c.getContext('2d');
  const data = nctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  noiseTile = c;
  return c;
}

function drawHalftone(ctx, w, h, palette) {
  const spacing = Math.max(6, Math.min(w, h) * 0.018);
  ctx.fillStyle = hexA(palette.cream, 0.09);
  for (let y = spacing * 0.5; y < h; y += spacing) {
    for (let x = spacing * 0.5; x < w; x += spacing) {
      const t = 0.35 + 0.65 * (x / w) * (y / h);
      ctx.beginPath();
      ctx.arc(x, y, spacing * (0.09 + 0.16 * t), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGrain(ctx, w, h) {
  const pattern = ctx.createPattern(getNoise(), 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx, w, h, palette) {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.32, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, hexA(palette.ink, 0));
  g.addColorStop(0.75, hexA(palette.ink, 0.1));
  g.addColorStop(1, hexA(palette.ink, 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fitDisplaySize(ctx, text, maxW, start, min) {
  let size = start;
  while (size > min) {
    ctx.font = `900 ${size}px ${DISPLAY}`;
    if (ctx.measureText(text).width * 1.04 <= maxW) break;
    size -= Math.max(1, size * 0.025);
  }
  return size;
}

function drawCaption(ctx, state, palette, w, h, strip) {
  const text = (state.caption ?? '').trim().toUpperCase();
  const margin = metrics(w, h).margin;
  const baseline = h - strip - h * 0.036;
  const maxW = w - margin * 2 - w * 0.01;

  // Scrim behind the lettering so it reads over any photo.
  const scrim = ctx.createLinearGradient(0, h - strip - h * 0.34, 0, h - strip);
  scrim.addColorStop(0, hexA(palette.ink, 0));
  scrim.addColorStop(0.55, hexA(palette.ink, 0.55));
  scrim.addColorStop(1, hexA(palette.ink, 0.82));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h - strip - h * 0.34, w, h * 0.34);

  const size = text ? fitDisplaySize(ctx, text, maxW, h * 0.155, h * 0.042) : 0;

  // Kickoff tag above the title.
  const kickerSize = Math.max(10, h * 0.021);
  ctx.fillStyle = palette.accent;
  ctx.font = `800 ${kickerSize}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const kicker = text ? 'A VICE CITY STORY' : 'MULTI-PANEL PHOTO EDITION';
  const kickerY = text ? baseline - size * 1.02 : baseline - h * 0.012;
  const kickerTrack = kickerSize * 0.32;
  tracked(ctx, kicker, margin, kickerY, kickerTrack);

  // Short accent rule under the kicker.
  ctx.fillStyle = palette.accent;
  const kw = trackedWidth(ctx, kicker, kickerTrack);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(margin, kickerY + kickerSize * 0.55, kw, Math.max(1, h * 0.0022));
  ctx.globalAlpha = 1;

  if (!text) return;

  const grad = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
  grad.addColorStop(0, palette.cream);
  grad.addColorStop(0.62, palette.cream);
  grad.addColorStop(1, palette.accent);

  ctx.save();
  ctx.translate(margin, baseline);
  ctx.transform(1, 0, -0.055, 1, 0, 0);
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Offset shadow + outline, then the gradient fill.
  ctx.fillStyle = hexA(palette.ink, 0.65);
  ctx.fillText(text, size * 0.045, size * 0.055);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.026);
  ctx.strokeStyle = palette.ink;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawHeader(ctx, state, palette, w, h, margin) {
  const height = Math.max(20, h * 0.038);
  const y = margin + h * 0.014;
  const label = 'VICE COVER STUDIO';
  const leftLabel = `★ ${label}`;
  ctx.save();
  ctx.font = `800 ${height * 0.44}px ${SANS}`;
  const lw = trackedWidth(ctx, leftLabel, height * 0.44 * 0.15) + height;
  // Patch the star in a chip-friendly warm colour: draw the chip then the star.
  const border = hexA(palette.cream, 0.3);
  roundRect(ctx, margin + h * 0.012, y, lw, height, height * 0.2);
  ctx.fillStyle = hexA(palette.ink, 0.55);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(1, height * 0.04);
  ctx.stroke();
  const starR = height * 0.2;
  starPath(ctx, margin + h * 0.012 + height * 0.5, y + height / 2, starR, starR * 0.45);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.fillStyle = palette.cream;
  ctx.font = `800 ${height * 0.42}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, label, margin + h * 0.012 + height * 0.86, y + height / 2 + height * 0.02, height * 0.42 * 0.15);

  chip(ctx, `ISSUE 06 · ${(state.location ?? 'VICE CITY').toUpperCase()}`, w - margin - h * 0.012, y, height, palette, {
    align: 'right',
    bg: hexA(palette.ink, 0.55),
    fontSize: height * 0.4,
  });
  ctx.restore();
}

function drawStrip(ctx, state, palette, w, h, strip, margin) {
  const y0 = h - strip;
  ctx.fillStyle = hexA(palette.ink, 0.95);
  ctx.fillRect(0, y0, w, strip);

  const lineG = ctx.createLinearGradient(0, 0, w, 0);
  lineG.addColorStop(0, palette.accent);
  lineG.addColorStop(0.5, palette.glow);
  lineG.addColorStop(1, palette.accent);
  ctx.fillStyle = lineG;
  ctx.fillRect(0, y0, w, Math.max(2, h * 0.0026));

  const location = (state.location ?? 'VICE CITY').trim().toUpperCase() || 'VICE CITY';
  const textH = strip * 0.34;
  const cy = y0 + strip / 2;
  const starR = strip * 0.2;
  starPath(ctx, margin + starR, cy, starR, starR * 0.44);
  ctx.fillStyle = palette.accent;
  ctx.fill();

  ctx.fillStyle = palette.cream;
  ctx.font = `800 ${textH}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  tracked(ctx, location, margin + starR * 2.4, cy + textH * 0.04, textH * 0.2);

  // A small edition note, then the tag badges on the right.
  if (w > h * 1.25) {
    const note = 'MULTI-PANEL PHOTO EDITION · 2026';
    const noteSize = strip * 0.22;
    ctx.fillStyle = hexA(palette.cream, 0.5);
    ctx.font = `700 ${noteSize}px ${SANS}`;
    tracked(ctx, note, w * 0.5, cy + noteSize * 0.04, noteSize * 0.22, 'center');
  }

  const chipH = strip * 0.5;
  let cursor = w - margin;
  const tags = [
    { label: 'DELUXE', color: palette.cream, bg: 'transparent', borderColor: hexA(palette.cream, 0.4) },
    { label: '18+', color: palette.cream, bg: 'transparent', borderColor: hexA(palette.cream, 0.4) },
    { label: '$69.99', color: palette.ink, bg: palette.accent, border: false },
  ];
  for (const tag of tags) {
    ctx.font = `800 ${chipH * 0.46}px ${SANS}`;
    const tw = trackedWidth(ctx, tag.label, chipH * 0.46 * 0.13) + chipH;
    chip(ctx, tag.label, cursor, cy - chipH / 2, chipH, palette, {
      align: 'right',
      bg: tag.bg,
      color: tag.color,
      border: tag.border !== false,
      borderColor: tag.borderColor,
      fontSize: chipH * 0.46,
      pad: chipH * 0.5,
    });
    cursor -= tw + strip * 0.16;
  }
}

/**
 * Paints a complete cover. `w` and `h` are the output pixels; `state` carries the layout,
 * caption, palette id, panels (photo, focus and zoom) and the two texture toggles.
 */
export function renderCover(canvas, state, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const palette = PALETTES[state.palette] ?? PALETTES.vice;
  const { strip, margin } = metrics(w, h);

  drawBackground(ctx, w, h, palette);

  const rects = panelRects(w, h, state.layout ?? 'solo');
  rects.forEach((rect, i) => drawPanel(ctx, state, palette, rect, i, h));

  if (state.halftone !== false) drawHalftone(ctx, w, h, palette);

  // Foreground palms, cropped by the poster edges. Taller and more prominent on landscape
  // covers; on square and portrait prints they stay in the bottom corners so faces stay clear.
  if (w > h * 1.2) {
    drawPalm(ctx, -w * 0.005, h * 1.02, h * 0.68, 1, palette, 1);
    drawPalm(ctx, w * 1.005, h * 1.01, h * 0.52, -1, palette, -1);
  } else {
    drawPalm(ctx, -w * 0.03, h * 1.015, h * 0.4, 1, palette, 1);
    drawPalm(ctx, w * 1.02, h * 1.01, h * 0.34, -1, palette, -1);
  }

  drawCaption(ctx, state, palette, w, h, strip);
  drawStrip(ctx, state, palette, w, h, strip, margin);
  drawHeader(ctx, state, palette, w, h, margin);
  drawVignette(ctx, w, h, palette);
  if (state.grain !== false) drawGrain(ctx, w, h);
}
