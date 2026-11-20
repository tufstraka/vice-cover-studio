// The cover renderer. Pure canvas drawing: panels, film treatment, chrome lettering,
// ribbon, seal, barcode and the studio's framing marks. Deterministic: same doc, same pixels.

import { buildLayout } from './layouts.js';
import { roleOf, CAST } from './state.js';
import { gradeImage, gradeGrain, grainPattern } from './grade.js';

const INK = '#081113';
const CREAM = '#f4ead4';
const GOLD = '#e8c079';
const GOLD_HOT = '#ffdf9f';
const GOLD_DEEP = '#9a6f2c';

const FONTS = { anton: 'Anton', bebas: 'Bebas', archivo: 'Archivo' };
const SCRIPTS = { mrdafoe: 'MrDafoe', kaushan: 'Kaushan' };

const scratchPool = new Map();
function scratch(w, h) {
  const key = Math.max(1, Math.ceil(w)) + 'x' + Math.max(1, Math.ceil(h));
  let c = scratchPool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    scratchPool.set(key, c);
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, c.width, c.height);
  return c;
}

function font(ctx, size, family, weight = '400', spacing = 0) {
  ctx.font = `${weight} ${size.toFixed(2)}px ${family}`;
  ctx.letterSpacing = spacing ? `${spacing.toFixed(2)}px` : '0px';
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A five point star, gold filled.
function star(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.44 : r;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ── photo panels ─────────────────────────────────────────────────────────
function drawPanelPhoto(ctx, p, W, H, panel, img, gradeId) {
  const x = p.x * W;
  const y = p.y * H;
  const w = p.w * W;
  const h = p.h * H;
  const graded = gradeImage(panel.key, img, gradeId);
  const iw = graded.width;
  const ih = graded.height;
  const zoom = Math.max(1, panel.zoom || 1);
  const scale = Math.max(w / iw, h / ih) * zoom;
  const cw = Math.min(iw, w / scale);
  const ch = Math.min(ih, h / scale);
  const fx = Math.min(1, Math.max(0, panel.fx ?? 0.5));
  const wantedFy = panel.hero && p.heroFy != null ? p.heroFy : panel.fy ?? 0.36;
  const fy = Math.min(1, Math.max(0, wantedFy));
  let sx = fx * iw - cw / 2;
  let sy = fy * ih - ch / 2;
  sx = Math.min(Math.max(0, sx), iw - cw);
  sy = Math.min(Math.max(0, sy), ih - ch);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (panel.flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(graded, sx, sy, cw, ch, 0, 0, w, h);
  } else {
    ctx.drawImage(graded, sx, sy, cw, ch, x, y, w, h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(0, 0);

  // colour wash: warm top, teal foot
  const wash = ctx.createLinearGradient(x, y, x + w * 0.15, y + h);
  wash.addColorStop(0, 'rgba(255,196,110,0.16)');
  wash.addColorStop(0.45, 'rgba(255,150,90,0.05)');
  wash.addColorStop(1, 'rgba(18,72,86,0.34)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // halation bloom on the lit edge
  const bloom = ctx.createRadialGradient(x + w * 0.3, y - h * 0.15, 0, x + w * 0.35, y + h * 0.1, h * 0.95);
  bloom.addColorStop(0, 'rgba(255,206,138,0.20)');
  bloom.addColorStop(1, 'rgba(255,206,138,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bloom;
  ctx.fillRect(x, y, w, h);

  // vignette
  ctx.globalCompositeOperation = 'source-over';
  const vig = ctx.createRadialGradient(x + w / 2, y + h * 0.46, Math.min(w, h) * 0.24, x + w / 2, y + h * 0.5, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(2,10,12,0)');
  vig.addColorStop(0.7, 'rgba(2,10,12,0.18)');
  vig.addColorStop(1, 'rgba(2,8,10,0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);

  // grain
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = gradeGrain(gradeId);
  ctx.fillStyle = grainPattern(ctx);
  ctx.save();
  ctx.translate(x % 192, y % 192);
  ctx.fillRect(-192, -192, w + 384, h + 384);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // bottom shade so the role tab reads
  if (h < H * 0.24) {
    ctx.globalCompositeOperation = 'screen';
    const lift = ctx.createLinearGradient(x, y, x, y + h);
    lift.addColorStop(0, 'rgba(255,198,150,0.14)');
    lift.addColorStop(1, 'rgba(126,176,186,0.07)');
    ctx.fillStyle = lift;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  const footH = Math.min(h * 0.34, 84);
  const foot = ctx.createLinearGradient(x, y + h - footH, x, y + h);
  foot.addColorStop(0, 'rgba(4,10,12,0)');
  foot.addColorStop(1, 'rgba(4,10,12,0.5)');
  ctx.fillStyle = foot;
  ctx.fillRect(x, y + h - footH, w, footH);
  ctx.restore();
}

function drawPanelFrame(ctx, p, W, H, k, doc, panel, index, opts) {
  const x = p.x * W;
  const y = p.y * H;
  const w = p.w * W;
  const h = p.h * H;
  const line = Math.max(1.6, 3 * k);

  // outer shadow + bevel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.62)';
  ctx.shadowBlur = 16 * k;
  ctx.shadowOffsetY = 4 * k;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = line + 2 * k;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  // cream / gold keyline
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, '#fdf3d9');
  g.addColorStop(0.45, '#f0e0bb');
  g.addColorStop(1, '#c9a463');
  ctx.strokeStyle = g;
  ctx.lineWidth = line;
  ctx.strokeRect(x + line / 2, y + line / 2, w - line, h - line);
  ctx.restore();

  // dark inner line
  ctx.strokeStyle = 'rgba(6,12,14,0.72)';
  ctx.lineWidth = Math.max(1, 1 * k);
  const inset = line + 1.5 * k;
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);

  // top-left bevel highlight, bottom-right shade
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,248,226,0.22)';
  ctx.lineWidth = Math.max(1, 1.4 * k);
  ctx.beginPath();
  ctx.moveTo(x + inset, y + inset + 1);
  ctx.lineTo(x + w - inset, y + inset + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + inset, y + h - inset - 1);
  ctx.lineTo(x + w - inset, y + h - inset - 1);
  ctx.stroke();
  ctx.restore();

  if (opts.selected === index && opts.showSelection) {
    ctx.save();
    ctx.strokeStyle = GOLD_HOT;
    ctx.lineWidth = Math.max(2, 3 * k);
    ctx.shadowColor = 'rgba(255,214,140,0.85)';
    ctx.shadowBlur = 14 * k;
    ctx.strokeRect(x - 3 * k, y - 3 * k, w + 6 * k, h + 6 * k);
    ctx.restore();
  }
}

// Role tabs and index numbers go on last, so the title never buries them.
function drawPanelTab(ctx, p, W, H, k, doc, index, atTop) {
  const x = p.x * W;
  const y = p.y * H;
  const w = p.w * W;
  const h = p.h * H;
  const role = roleOf(doc, index);
  const tabH = 23 * k;
  const padX = 7 * k;
  font(ctx, 10.5 * k, 'Bebas', '400', 1.5 * k);
  const tw = ctx.measureText(role).width + padX * 2 + 6 * k;
  const tabY = atTop ? y + 6 * k : y + h - tabH - 7 * k;
  const tabX = x + 6 * k;
  ctx.save();
  ctx.fillStyle = 'rgba(5,11,13,0.85)';
  ctx.fillRect(tabX, tabY, tw, tabH);
  ctx.fillStyle = GOLD;
  ctx.fillRect(tabX, tabY, 2.5 * k, tabH);
  ctx.fillStyle = '#f7e9c6';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(role, tabX + padX + 4 * k, tabY + tabH / 2 + 0.5 * k);

  const num = String(index + 1).padStart(2, '0');
  font(ctx, 9.5 * k, 'Bebas', '400', 1 * k);
  const nw = ctx.measureText(num).width + 8 * k;
  ctx.fillStyle = 'rgba(5,11,13,0.72)';
  ctx.fillRect(x + w - nw - 6 * k, y + 6 * k, nw, 14 * k);
  ctx.fillStyle = 'rgba(247,233,198,0.88)';
  ctx.textAlign = 'center';
  ctx.fillText(num, x + w - nw / 2 - 6 * k, y + 6 * k + 7.2 * k);
  ctx.restore();
}

// ── chrome title ─────────────────────────────────────────────────────────
// Simple and robust: dark extrusion copies, ink outline, then each line filled
// directly with a cream-to-gold chrome ramp, then a thin bright rim.
const CHROME_RAMP = [
  [0.0, '#fffdf7'],
  [0.12, '#fff3d6'],
  [0.24, '#f2d09a'],
  [0.34, '#d3a45e'],
  [0.44, '#b3813c'],
  [0.5, '#8e5f24'],
  [0.56, '#c08c46'],
  [0.64, '#f3d49b'],
  [0.74, '#fff0c8'],
  [0.84, '#f0c98c'],
  [1.0, '#b3803a'],
];

function chromeRamp(ctx, yTop, yBot) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  for (const [pos, color] of CHROME_RAMP) g.addColorStop(pos, color);
  return g;
}

function wrapTitle(ctx, family, text, maxW, maxSize) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size: 0 };
  font(ctx, 100, family, '400', 1);
  const at100 = (s) => ctx.measureText(s).width;
  const whole = words.join(' ');
  const single = Math.min(maxSize, (maxW / at100(whole)) * 100);
  let best = null;
  for (let split = 1; split < words.length; split++) {
    const a = words.slice(0, split).join(' ');
    const b = words.slice(split).join(' ');
    const widest = Math.max(at100(a), at100(b));
    const size = Math.min(maxSize, (maxW / widest) * 100);
    if (!best || size > best.size) best = { lines: [a, b], size };
  }
  if (best && best.size > single * 1.16 && best.lines.join(' ').length > 9) return best;
  return { lines: [whole], size: single };
}

function chromeTitle(ctx, opt) {
  const { text, cx, cy, maxW, maxSize, family } = opt;
  const { lines, size } = wrapTitle(ctx, family, text, maxW, maxSize);
  if (!lines.length || size < 4) return size;

  const spacing = size * 0.012;
  font(ctx, size, family, '400', spacing);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const scales = widths.map((w) => Math.min(1.35, Math.max(0.9, maxW / w)));
  const cap = size * 0.73;
  const lh = size * 0.86;
  const blockH = lh * (lines.length - 1) + cap;
  const top = cy - blockH / 2;
  const firstBase = top + cap;
  const lineX = (i) => cx - (widths[i] * scales[i]) / 2;
  const lineY = (i) => firstBase + i * lh;

  const withLine = (i, dx, dy, fn) => {
    ctx.save();
    ctx.translate(lineX(i) + dx, lineY(i) + dy);
    ctx.scale(scales[i], 1);
    fn();
    ctx.restore();
  };

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 1. dark extrusion, stacked down and to the right
  const steps = 4;
  for (let s = steps; s >= 1; s--) {
    const ex = size * 0.009 * s;
    const ey = size * 0.014 * s;
    ctx.save();
    if (s === steps) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = size * 0.08;
      ctx.shadowOffsetY = size * 0.02;
    }
    const deep = ctx.createLinearGradient(0, top, 0, top + blockH);
    deep.addColorStop(0, '#131b1c');
    deep.addColorStop(1, '#05090a');
    ctx.fillStyle = deep;
    lines.forEach((line, i) => withLine(i, ex, ey, () => ctx.fillText(line, 0, 0)));
    ctx.restore();
  }

  // 2. ink outline around every letter
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2.2;
  ctx.strokeStyle = '#080e0f';
  ctx.lineWidth = Math.max(2, size * 0.038);
  lines.forEach((line, i) => withLine(i, 0, 0, () => ctx.strokeText(line, 0, 0)));
  ctx.restore();

  // 3. chrome face, filled directly per line
  lines.forEach((line, i) => {
    const yTop = lineY(i) - size * 0.76;
    const yBot = lineY(i) + size * 0.06;
    withLine(i, 0, 0, () => {
      ctx.fillStyle = chromeRamp(ctx, yTop - lineY(i), yBot - lineY(i));
      ctx.fillText(line, 0, 0);
    });
  });

  // 3b. top bevel and dark bottom inner edge
  lines.forEach((line, i) => {
    const yTop = lineY(i) - size * 0.76;
    const yBot = lineY(i) + size * 0.06;
    withLine(i, 0, 0, () => {
      const bev = ctx.createLinearGradient(0, yTop - lineY(i), 0, yBot - lineY(i));
      bev.addColorStop(0, 'rgba(255,255,255,0.62)');
      bev.addColorStop(0.18, 'rgba(255,255,255,0.12)');
      bev.addColorStop(0.62, 'rgba(255,255,255,0)');
      bev.addColorStop(0.9, 'rgba(46,24,2,0.16)');
      bev.addColorStop(1, 'rgba(38,20,2,0.5)');
      ctx.fillStyle = bev;
      ctx.fillText(line, 0, 0);
    });
  });

  // 3c. two soft shine bands
  lines.forEach((line, i) => {
    const yTop = lineY(i) - size * 0.76;
    const yBot = lineY(i) + size * 0.06;
    withLine(i, 0, 0, () => {
      const shine = ctx.createLinearGradient(0, yTop - lineY(i), 0, yBot - lineY(i));
      shine.addColorStop(0, 'rgba(255,255,255,0)');
      shine.addColorStop(0.28, 'rgba(255,255,255,0)');
      shine.addColorStop(0.34, 'rgba(255,255,255,0.24)');
      shine.addColorStop(0.4, 'rgba(255,255,255,0)');
      shine.addColorStop(0.66, 'rgba(255,255,255,0)');
      shine.addColorStop(0.71, 'rgba(255,255,255,0.16)');
      shine.addColorStop(0.77, 'rgba(255,255,255,0)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillText(line, 0, 0);
    });
  });

  // 4. a tight dark outline around the chrome face so it separates from the art
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2.2;
  ctx.strokeStyle = 'rgba(9,14,15,0.92)';
  ctx.lineWidth = Math.max(2.2, size * 0.023);
  lines.forEach((line, i) => withLine(i, 0, 0, () => ctx.strokeText(line, 0, 0)));
  ctx.restore();

  // 5. thin bright rim along the top of the letters
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,253,240,0.42)';
  ctx.lineWidth = Math.max(0.9, size * 0.009);
  lines.forEach((line, i) => withLine(i, 0, -ctx.lineWidth * 0.7, () => ctx.strokeText(line, 0, 0)));
  ctx.restore();

  // 5. a warm cast shadow under the whole block
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  ctx.restore();

  // 6. sparkle at the first letter
  const firstW = widths[0] * scales[0];
  sparkle(ctx, cx - firstW / 2 + size * 0.04, top + size * 0.12, size * 0.17);
  return size;
}

function sparkle(ctx, x, y, r) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  glow.addColorStop(0, 'rgba(255,246,214,0.9)');
  glow.addColorStop(0.35, 'rgba(255,214,140,0.45)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffdf2';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}

// ── script subtitle with a gold swoosh ───────────────────────────────────
function scriptSubtitle(ctx, doc, L) {
  const k = L.k;
  const text = String(doc.subtitle || '').trim();
  const cx = L.sub.cx * L.w;
  const cy = L.sub.cy * L.h;
  const family = SCRIPTS[doc.scriptFont] || SCRIPTS.mrdafoe;
  const base = L.sub.size * k;
  let size = base;
  font(ctx, size, family, '400', 0);
  const maxW = L.w * 0.44;
  if (ctx.measureText(text).width > maxW) size = base * (maxW / ctx.measureText(text).width);
  font(ctx, size, family, '400', 0);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,178,86,0.75)';
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = 'rgba(255,182,96,0.55)';
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = '#fff6e2';
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(text, 0, -size * 0.015);

  // thin gold underline swoosh
  const tw = ctx.measureText(text).width;
  ctx.beginPath();
  ctx.moveTo(-tw * 0.56, size * 0.42);
  ctx.quadraticCurveTo(0, size * 0.62, tw * 0.56, size * 0.34);
  ctx.strokeStyle = 'rgba(232,192,121,0.85)';
  ctx.lineWidth = Math.max(1, 2.2 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-tw * 0.42, size * 0.56);
  ctx.quadraticCurveTo(0, size * 0.74, tw * 0.42, size * 0.48);
  ctx.strokeStyle = 'rgba(255,229,180,0.32)';
  ctx.lineWidth = Math.max(0.8, 1.2 * k);
  ctx.stroke();
  ctx.restore();
}

// ── tagline ribbon ───────────────────────────────────────────────────────
function taglineRibbon(ctx, doc, L) {
  const k = L.k;
  const text = String(doc.tagline || '').trim().toUpperCase();
  if (!text) return;
  const cx = L.ribbon.cx * L.w;
  const cy = L.ribbon.cy * L.h;
  const w = L.ribbon.w * L.w;
  const h = L.ribbon.h * L.h;
  const notch = h * 0.85;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  ctx.lineTo(x0 + notch, y0);
  ctx.lineTo(x1 - notch, y0);
  ctx.lineTo(x1, cy);
  ctx.lineTo(x1 - notch, y1);
  ctx.lineTo(x0 + notch, y1);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 10 * k;
  ctx.shadowOffsetY = 3 * k;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#ffe9b9');
  g.addColorStop(0.4, '#eec97f');
  g.addColorStop(0.75, '#c9994a');
  g.addColorStop(1, '#e2b467');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(58,38,10,0.85)';
  ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.stroke();
  ctx.clip();
  const sheen = ctx.createLinearGradient(x0, 0, x1, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.14)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();

  // text
  let size = 15.5 * k;
  font(ctx, size, 'Bebas', '400', 2.4 * k);
  const avail = w - notch * 2 - 26 * k;
  let tw = ctx.measureText(text).width;
  if (tw > avail) {
    size *= avail / tw;
    font(ctx, size, 'Bebas', '400', 2.4 * k);
    tw = ctx.measureText(text).width;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1b1206';
  ctx.fillText(text, cx, cy + 0.5 * k);
  ctx.restore();
}

// ── gold starburst seal ──────────────────────────────────────────────────
function starburstSeal(ctx, doc, L) {
  if (!L.seal || !(L.seal.r > 0)) return;
  const k = L.k;
  const cx = L.seal.x * L.w;
  const cy = L.seal.y * L.h;
  const r = L.seal.r * k * 1.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(L.seal.rot || -0.14);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12 * k;
  ctx.shadowOffsetY = 4 * k;

  const points = 24;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 ? r * 0.86 : r;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffeec2');
  g.addColorStop(0.5, '#e9c47c');
  g.addColorStop(1, '#b07e33');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(50,32,8,0.8)';
  ctx.lineWidth = Math.max(1, 1.2 * k);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(46,30,8,0.6)';
  ctx.lineWidth = Math.max(0.8, 1 * k);
  ctx.stroke();

  const words = String(doc.seal || 'ORIGINAL · COVER ART').split(/[·|/]/).map((s) => s.trim()).filter(Boolean);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1c07';
  font(ctx, 9.6 * k, 'Bebas', '400', 1.2 * k);
  const l1 = (words[0] || 'ORIGINAL').toUpperCase();
  const l2 = (words[1] || 'COVER ART').toUpperCase();
  ctx.fillText(l1, 0, -r * 0.2);
  ctx.fillText(l2, 0, r * 0.06);
  star(ctx, 0, r * 0.34, r * 0.1, 'rgba(42,28,7,0.85)');
  star(ctx, -r * 0.26, r * 0.3, r * 0.055, 'rgba(42,28,7,0.7)');
  star(ctx, r * 0.26, r * 0.3, r * 0.055, 'rgba(42,28,7,0.7)');
  ctx.restore();
}

// ── barcode ──────────────────────────────────────────────────────────────
function barcode(ctx, x, y, w, h, text, k) {
  ctx.save();
  ctx.fillStyle = 'rgba(244,234,212,0.9)';
  ctx.fillRect(x - 3 * k, y - 3 * k, w + 6 * k, h + 6 * k);
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) & 0xffff;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let px = x;
  ctx.fillStyle = '#0a1113';
  while (px < x + w - 2) {
    const bw = (1 + Math.floor(rnd() * 3)) * k;
    if (rnd() > 0.32) ctx.fillRect(px, y, Math.max(1, bw), h);
    px += bw + (1 + Math.floor(rnd() * 2)) * k;
  }
  font(ctx, 7.4 * k, 'Bebas', '400', 0.9 * k);
  ctx.fillStyle = 'rgba(244,234,212,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x + w / 2, y + h + 4 * k);
  ctx.restore();
}

// ── strips ───────────────────────────────────────────────────────────────
function topStrip(ctx, doc, L) {
  const k = L.k;
  const W = L.w;
  const midY = (L.strip.y + L.strip.h / 2) * L.h;
  const quote = String(doc.quote || '').toUpperCase();
  const source = String(doc.source || '').toUpperCase();
  const starR = 8.2 * k;
  const starGap = 6.5 * k;
  const starsW = starR * 2 * 5 + starGap * 4;

  font(ctx, 17 * k, 'Bebas', '400', 3 * k);
  const quoteW = ctx.measureText(`“${quote}”`).width;
  font(ctx, 14 * k, 'Bebas', '400', 2 * k);
  const sourceW = ctx.measureText(`— ${source}`).width;

  const groupW = starsW + 16 * k + quoteW + 12 * k + sourceW;
  let x = (W - groupW) / 2;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const g = ctx.createLinearGradient(0, midY - starR, 0, midY + starR);
    g.addColorStop(0, '#ffeec4');
    g.addColorStop(1, '#c99646');
    star(ctx, x + starR + i * (starR * 2 + starGap), midY, starR, g);
  }
  x += starsW + 16 * k;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  font(ctx, 17 * k, 'Bebas', '400', 3 * k);
  ctx.fillStyle = '#f6efdd';
  ctx.fillText(`“${quote}”`, x, midY + 0.5 * k);
  x += quoteW + 12 * k;
  font(ctx, 14 * k, 'Bebas', '400', 2 * k);
  ctx.fillStyle = GOLD;
  ctx.fillText(`— ${source}`, x, midY + 1 * k);
  ctx.restore();

  // edition tag at right
  const tag = String(doc.edition || '').toUpperCase();
  if (tag) {
    const bw = 62 * k;
    const bh = 26 * k;
    const bx = W - 0.03 * W - bw;
    const by = midY - bh / 2;
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, 1.2 * k);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(232,192,121,0.08)';
    ctx.fillRect(bx, by, bw, bh);
    font(ctx, 14 * k, 'Bebas', '400', 2.4 * k);
    ctx.fillStyle = GOLD_HOT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, bx + bw / 2, by + bh / 2 + 0.5 * k);
    ctx.restore();
  }

  // hairline under the strip
  ctx.strokeStyle = 'rgba(232,192,121,0.22)';
  ctx.lineWidth = Math.max(0.8, 1 * k);
  ctx.beginPath();
  ctx.moveTo(0.03 * W, (L.strip.y + L.strip.h) * L.h + 2 * k);
  ctx.lineTo(0.97 * W, (L.strip.y + L.strip.h) * L.h + 2 * k);
  ctx.stroke();
}

function bottomStrip(ctx, doc, L) {
  const k = L.k;
  const W = L.w;
  const H = L.h;
  const y = L.bottom.y * H;
  const h = L.bottom.h * H;
  const midY = y + h / 2;

  // release line, left
  const release = String(doc.release || 'COMING SOON').toUpperCase();
  font(ctx, 21 * k, 'Anton', '400', 2.6 * k);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD_HOT;
  ctx.fillText(release, 0.03 * W, midY + 1 * k);

  // billing block, centre
  const lines = (Array.isArray(doc.billing) ? doc.billing : String(doc.billing || '').split('\n')).slice(0, 3);
  font(ctx, 11 * k, 'Bebas', '400', 1.7 * k);
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    const ly = midY - (lines.length - 1) * 6.1 * k + i * 12.2 * k;
    ctx.fillStyle = i === 0 ? 'rgba(246,238,218,0.86)' : 'rgba(238,228,204,0.6)';
    ctx.fillText(String(line).toUpperCase(), W * 0.5, ly);
  });

  // barcode, right
  barcode(ctx, W - 0.03 * W - 104 * k, midY - 13 * k, 104 * k, 26 * k, doc.barcode || 'GM 06 0417', k);

  // hairline over the strip
  ctx.strokeStyle = 'rgba(232,192,121,0.22)';
  ctx.lineWidth = Math.max(0.8, 1 * k);
  ctx.beginPath();
  ctx.moveTo(0.03 * W, y - 6 * k);
  ctx.lineTo(0.97 * W, y - 6 * k);
  ctx.stroke();
}

// ── page furniture ───────────────────────────────────────────────────────
function backdrop(ctx, L) {
  const W = L.w;
  const H = L.h;
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, '#0a1719');
  g.addColorStop(0.55, INK);
  g.addColorStop(1, '#050a0b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.26, 0, W * 0.5, H * 0.32, W * 0.66);
  glow.addColorStop(0, 'rgba(38,94,100,0.3)');
  glow.addColorStop(1, 'rgba(8,17,19,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // a low sun behind the title band, so the lettering sits in warm air
  const sun = ctx.createRadialGradient(W * 0.5, L.h * 0.56, 0, W * 0.5, L.h * 0.56, W * 0.46);
  sun.addColorStop(0, 'rgba(255,150,62,0.20)');
  sun.addColorStop(0.45, 'rgba(214,104,44,0.10)');
  sun.addColorStop(1, 'rgba(9,17,19,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

function frameAndTicks(ctx, L) {
  const k = L.k;
  const W = L.w;
  const H = L.h;
  const inset = 24 * k;

  ctx.strokeStyle = 'rgba(232,192,121,0.55)';
  ctx.lineWidth = Math.max(0.8, 1.1 * k);
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.strokeStyle = 'rgba(232,192,121,0.16)';
  ctx.strokeRect(inset + 5 * k, inset + 5 * k, W - (inset + 5 * k) * 2, H - (inset + 5 * k) * 2);

  // corner ticks
  const t = 26 * k;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, 2.2 * k);
  const corners = [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 6 * k, cy + sy * t);
    ctx.lineTo(cx + sx * 6 * k, cy + sy * 6 * k);
    ctx.lineTo(cx + sx * t, cy + sy * 6 * k);
    ctx.stroke();
  }
}

function paperGrain(ctx, L) {
  const k = L.k;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, L.w, L.h);
  ctx.restore();

  // faint scanline / print texture
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#0a1214';
  const step = Math.max(2, 3 * k);
  for (let y = 0; y < L.h; y += step) ctx.fillRect(0, y, L.w, 1);
  ctx.restore();
}

// ── public ───────────────────────────────────────────────────────────────
export function renderCover(canvas, doc, getImage, opts = {}) {
  const L = buildLayout(doc.layout, doc.aspect);
  if (canvas.width !== L.w) canvas.width = L.w;
  if (canvas.height !== L.h) canvas.height = L.h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.clearRect(0, 0, L.w, L.h);

  const k = L.k;
  backdrop(ctx, L);

  for (const p of L.panels) {
    const panel = doc.panels[p.slot];
    if (!panel) continue;
    const img = getImage(panel.key);
    if (img) drawPanelPhoto(ctx, p, L.w, L.h, panel, img, doc.grade);
    else {
      const x = p.x * L.w;
      const y = p.y * L.h;
      ctx.fillStyle = '#0e1a1c';
      ctx.fillRect(x, y, p.w * L.w, p.h * L.h);
    }
    drawPanelFrame(ctx, p, L.w, L.h, k, doc, panel, p.slot, opts);
  }

  // title + script
  const family = FONTS[doc.titleFont] || FONTS.anton;
  chromeTitle(ctx, {
    text: doc.title,
    cx: L.title.cx * L.w,
    cy: L.title.cy * L.h,
    maxW: L.title.maxW * L.w,
    maxSize: L.title.maxSize,
    family,
    k,
  });
  scriptSubtitle(ctx, doc, L);
  taglineRibbon(ctx, doc, L);

  for (const p of L.panels) {
    drawPanelTab(ctx, p, L.w, L.h, k, doc, p.slot, Boolean(p.hero));
  }

  topStrip(ctx, doc, L);
  bottomStrip(ctx, doc, L);
  starburstSeal(ctx, doc, L);
  frameAndTicks(ctx, L);
  paperGrain(ctx, L);
  return L;
}

// Draw a cover to a fresh canvas (used by the shots page and export).
export function renderToCanvas(doc, getImage, opts = {}) {
  const c = document.createElement('canvas');
  renderCover(c, doc, getImage, opts);
  return c;
}

export function layoutOf(doc) {
  return buildLayout(doc.layout, doc.aspect);
}

export function castRole(slot) {
  const c = CAST[slot];
  return c ? c.role : '';
}
