// Panel geometry for every layout x aspect. All numbers are fractions of the canvas.
// panels[].slot indexes state.panels; the hero slot is always 2.

export const ASPECTS = {
  '16:9': { w: 1920, h: 1080, k: 1, label: '16:9', file: '1920x1080' },
  '4:5': { w: 1080, h: 1350, k: 0.8, label: '4:5', file: '1080x1350' },
  '1:1': { w: 1080, h: 1080, k: 0.78, label: '1:1', file: '1080x1080' },
};

export const LAYOUTS = [
  { id: 'ens8', label: 'Ensemble 8', count: 8 },
  { id: 'ens7', label: 'Ensemble 7', count: 7 },
  { id: 'hero5', label: 'Hero 5', count: 5 },
  { id: 'quad', label: 'Quad', count: 4 },
  { id: 'solo', label: 'Solo', count: 1 },
];

const P = (slot, x, y, w, h, extra = {}) => ({ slot, x, y, w, h, zoom: 1.15, fx: 0.5, fy: 0.36, hero: false, ...extra });

// Even split of a horizontal band into n boxes with a fractional gap.
function row(slots, x, y, w, h, gap) {
  const n = slots.length;
  const bw = (w - gap * (n - 1)) / n;
  return slots.map((s, i) => P(s, x + i * (bw + gap), y, bw, h));
}

// ── landscape 1920 x 1080 ────────────────────────────────────────────────
// Full ensemble: two stacked plates down each side, the hero in the middle and a
// three-up row beneath it. The title band sits across the middle of the hero.
function wide(layoutId) {
  const gap = 12 / 1920;
  const sideW = 0.234;
  const LEFT = 0.03;
  const RIGHT = 0.97 - sideW;
  const HERO_X = LEFT + sideW + gap;
  const HERO_W = 0.94 - sideW * 2 - gap * 2;
  const TOP_Y = 0.095;
  const SIDE_TOP_H = 0.39;
  const SIDE_BOT_Y = 0.505;
  const SIDE_BOT_H = 0.395;
  const BOTTOM_Y = 0.715;
  const BOTTOM_H = 0.185;
  const base = {
    strip: { y: 0.028, h: 0.044 },
    bottom: { y: 0.912, h: 0.052 },
    title: { cx: 0.5, cy: 0.55, maxW: 0.645, maxSize: 156 },
    sub: { cx: 0.5, cy: 0.64, size: 54 },
    ribbon: { cx: 0.5, cy: 0.695, w: 0.52, h: 0.028 },
    seal: { x: 0.932, y: 0.868, r: 40, rot: -0.16 },
  };
  const hero = (h, y = TOP_Y) => P(2, HERO_X, y, HERO_W, h, { hero: true, ay: 0.28, heroFy: 0.37 });
  const sides = (l0, l1, r0, r1) => [
    P(l0, LEFT, TOP_Y, sideW, SIDE_TOP_H),
    P(l1, LEFT, SIDE_BOT_Y, sideW, SIDE_BOT_H),
    P(r0, RIGHT, TOP_Y, sideW, SIDE_TOP_H),
    P(r1, RIGHT, SIDE_BOT_Y, sideW, SIDE_BOT_H),
  ];
  const three = (slots) => row(slots, HERO_X, BOTTOM_Y, HERO_W, BOTTOM_H, gap);

  if (layoutId === 'ens8') {
    return { ...base, panels: [...sides(0, 1, 5, 7), hero(0.52), ...three([3, 4, 6])] };
  }
  if (layoutId === 'ens7') {
    return { ...base, panels: [...sides(0, 1, 5, 7), hero(0.52), ...three([3, 4])] };
  }
  if (layoutId === 'hero5') {
    return {
      ...base,
      title: { cx: 0.5, cy: 0.55, maxW: 0.62, maxSize: 160 },
      seal: { x: 0.9, y: 0.66, r: 38, rot: -0.16 },
      panels: [
        P(2, HERO_X, TOP_Y, HERO_W, 0.56, { hero: true, ay: 0.28, heroFy: 0.37 }),
        ...row([0, 1, 5, 7], LEFT, 0.675, 0.94, 0.225, gap),
      ],
    };
  }
  if (layoutId === 'quad') {
    return {
      ...base,
      title: { cx: 0.5, cy: 0.52, maxW: 0.78, maxSize: 190 },
      seal: { x: 0.9, y: 0.14, r: 38, rot: -0.16 },
      panels: [...row([0, 5], LEFT, TOP_Y, 0.94, 0.38, gap), ...row([2, 7], LEFT, 0.5, 0.94, 0.42, gap)],
    };
  }
  return {
    ...base,
    title: { cx: 0.5, cy: 0.6, maxW: 0.8, maxSize: 200 },
    sub: { cx: 0.5, cy: 0.7, size: 62 },
    ribbon: { cx: 0.5, cy: 0.755, w: 0.6, h: 0.03 },
    seal: { x: 0.9, y: 0.2, r: 42, rot: -0.16 },
    panels: [P(3, LEFT, TOP_Y, 0.94, 0.83, { hero: true, ay: 0.34, heroFy: 0.37 })],
  };
}

// A secondary, sparser cut: three plates across the top, five below.
export function wideStripes() {
  return null;
}

// ── portrait 1080 x 1350 and square 1080 ────────────────────────────────
function stacked(layoutId, aspect) {
  const sq = aspect === '1:1';
  const gap = 0.012;
  const x = 0.045;
  const w = 0.91;
  const common = {
    strip: { y: 0.028, h: 0.042 },
    bottom: { y: 0.912, h: 0.05 },
    title: { cx: 0.5, cy: sq ? 0.4 : 0.41, maxW: 0.88, maxSize: sq ? 150 : 160 },
    sub: { cx: 0.5, cy: sq ? 0.478 : 0.487, size: 54 },
    ribbon: { cx: 0.5, cy: sq ? 0.523 : 0.532, w: 0.9, h: 0.032 },
    // portrait and square cuts leave the seal out: no cast face should be covered
    seal: { x: 0.9, y: 0.9, r: 0, rot: -0.16 },
  };
  if (layoutId === 'ens8' || layoutId === 'ens7') {
    const heroH = sq ? 0.39 : 0.372;
    const heroY = 0.082;
    const r1y = sq ? 0.568 : 0.578;
    const r1h = sq ? 0.152 : 0.158;
    const r2y = r1y + r1h + 0.012;
    const r2h = sq ? 0.163 : 0.168;
    const seven = layoutId === 'ens7';
    const row1 = seven ? [0, 1, 5] : [0, 1, 5, 7];
    const row2 = seven ? [3, 4, 6] : [3, 4, 6];
    return {
      ...common,
      panels: [
        P(2, x, heroY, w, heroH, { hero: true, ay: 0.34, heroFy: 0.21 }),
        ...row(row1, x, r1y, w, r1h, gap),
        ...row(row2, x, r2y, w, r2h, gap),
      ],
    };
  }
  if (layoutId === 'hero5') {
    return {
      ...common,
      title: { cx: 0.5, cy: sq ? 0.45 : 0.46, maxW: 0.88, maxSize: sq ? 160 : 170 },
      sub: { cx: 0.5, cy: sq ? 0.535 : 0.545, size: 58 },
      ribbon: { cx: 0.5, cy: sq ? 0.575 : 0.585, w: 0.9, h: 0.034 },
      seal: { x: 0.87, y: sq ? 0.51 : 0.52, r: 34, rot: -0.16 },
      panels: [
        P(2, x, 0.082, w, sq ? 0.43 : 0.45, { hero: true, ay: 0.34, heroFy: 0.21 }),
        ...row([0, 1, 5, 7], x, sq ? 0.632 : 0.65, w, sq ? 0.26 : 0.245, gap),
      ],
    };
  }
  if (layoutId === 'quad') {
    const gh = sq ? 0.39 : 0.405;
    return {
      ...common,
      title: { cx: 0.5, cy: 0.5, maxW: 0.88, maxSize: 170 },
      sub: { cx: 0.5, cy: 0.578, size: 58 },
      ribbon: { cx: 0.5, cy: 0.63, w: 0.9, h: 0.034 },
      seal: { x: 0.87, y: 0.115, r: 34, rot: -0.16 },
      panels: [...row([0, 5], x, 0.082, w, gh, gap), ...row([2, 7], x, 0.082 + gh + 0.012, w, gh - 0.004, gap)],
    };
  }
  return {
    ...common,
    title: { cx: 0.5, cy: 0.7, maxW: 0.88, maxSize: 190 },
    sub: { cx: 0.5, cy: 0.788, size: 66 },
    ribbon: { cx: 0.5, cy: 0.85, w: 0.9, h: 0.034 },
    seal: { x: 0.87, y: 0.16, r: 36, rot: -0.16 },
    panels: [P(2, x, 0.082, w, 0.81, { hero: true, ay: 0.4, heroFy: 0.33 })],
  };
}

export function buildLayout(layoutId, aspect) {
  const a = ASPECTS[aspect] || ASPECTS['16:9'];
  const id = LAYOUTS.some((l) => l.id === layoutId) ? layoutId : 'ens8';
  const L = aspect === '16:9' ? wide(id) : stacked(id, aspect);
  return { ...L, ...a, aspect, layoutId: id };
}

export function hitPanel(layout, fx, fy) {
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const p = layout.panels[i];
    if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) return p.slot;
  }
  return -1;
}
