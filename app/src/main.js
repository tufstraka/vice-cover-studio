// Editor wiring: the cast tray, the stage, caption fields, exports, shortcuts.
// ?shot=cover|editor|vertical|square renders a single clean canvas for screenshots.

import { defaultDoc, createStore, CAST, GRADES, roleOf, TITLES } from './state.js';
import { castUrl, createAssets, focusFace, loadImage, CAST_KEYS } from './assets.js';
import { renderCover, renderToCanvas, layoutOf } from './render.js';
import { buildLayout, LAYOUTS, ASPECTS } from './layouts.js';
import { shotFor } from './shots.js';

const qs = new URLSearchParams(location.search);
const shotMode = shotFor(qs.get('shot'));
const shot = shotMode ? qs.get('shot') : null;
let editorLive = false;

// Stand-in names for a hero panel the visitor picks: kept short so role tabs fit.
const assets = createAssets();
const store = createStore(defaultDoc(), onChange);

const el = (id) => document.getElementById(id);

function getImage(key) {
  return assets.get(key) || null;
}

let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw();
  });
}

function draw() {
  if (!editorLive) return;
  const doc = store.doc;
  renderCover(el('preview'), doc, getImage, { selected: doc.selected, showSelection: true });
  const L = layoutOf(doc);
  el('docMeta').textContent = `${LAYOUTS.find((l) => l.id === doc.layout)?.label.toUpperCase()} · ${doc.grade.toUpperCase()}`;
  const inLayout = L.panels.some((p) => p.slot === doc.selected);
  if (!inLayout && L.panels.length) store.set({ selected: L.panels[0].slot }, { history: false });
  el('panelIndex').textContent = String(doc.selected + 1).padStart(2, '0');
  el('panelRole').textContent = roleOf(doc, doc.selected);
  updateStepChips();
}

function updateStepChips() {
  const steps = document.querySelectorAll('.step');
  if (!steps.length) return;
  const doc = store.doc;
  const castDone = doc.panels.filter((p) => p.key).length > 0;
  const copyDone = Boolean(doc.title && doc.subtitle);
  steps.forEach((s, i) => {
    s.classList.toggle('is-on', i === 0 ? !castDone : i === 1 ? castDone && !copyDone : copyDone);
  });
}

function onChange(doc, reason) {
  syncFields();
  if (editorLive) scheduleRender();
}

// ── fields ───────────────────────────────────────────────────────────────
const FIELDS = [
  ['fTitle', 'title'],
  ['fSubtitle', 'subtitle'],
  ['fTagline', 'tagline'],
  ['fQuote', 'quote'],
  ['fSource', 'source'],
  ['fRelease', 'release'],
  ['fEdition', 'edition'],
  ['fSeal', 'seal'],
];

let syncing = false;
function syncFields() {
  const doc = store.doc;
  syncing = true;
  for (const [id, key] of FIELDS) {
    const input = el(id);
    if (input && document.activeElement !== input) input.value = doc[key] ?? '';
  }
  const billing = Array.isArray(doc.billing) ? doc.billing.join('\n') : doc.billing || '';
  if (document.activeElement !== el('fBilling')) el('fBilling').value = billing;
  el('fTitleFont').value = doc.titleFont;
  el('fScriptFont').value = doc.scriptFont;
  syncing = false;
  markActiveChips();
}

function bindFields() {
  for (const [id, key] of FIELDS) {
    const input = el(id);
    input.addEventListener('input', () => {
      if (syncing) return;
      store.set({ [key]: input.value }, { history: false });
    });
    input.addEventListener('change', () => store.set({ [key]: input.value }));
  }
  el('fBilling').addEventListener('input', (e) => {
    if (syncing) return;
    store.set({ billing: e.target.value.split('\n').slice(0, 3) }, { history: false });
  });
  el('fBilling').addEventListener('change', (e) => store.set({ billing: e.target.value.split('\n').slice(0, 3) }));
  el('fTitleFont').addEventListener('change', (e) => store.set({ titleFont: e.target.value }));
  el('fScriptFont').addEventListener('change', (e) => store.set({ scriptFont: e.target.value }));
}

// ── left column ──────────────────────────────────────────────────────────
function renderCastTray() {
  const tray = el('castTray');
  tray.innerHTML = '';
  const doc = store.doc;
  for (const c of CAST) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cast-cell';
    btn.dataset.key = c.key;
    btn.title = `${c.role} — click to place in panel ${String(doc.selected + 1).padStart(2, '0')}`;
    const used = doc.panels.some((p) => p.key === c.key);
    btn.innerHTML = `<img src="${castUrl(c.key)}" alt="${c.role}" />${used ? '<em>•</em>' : ''}<span>${c.role.replace('THE ', '')}</span>`;
    if (doc.panels[doc.selected]?.key === c.key) btn.classList.add('is-picked');
    btn.addEventListener('click', () => assignPhoto(c.key, 'cast'));
    tray.appendChild(btn);
  }
  for (const key of assets.keys()) {
    if (CAST_KEYS.includes(key)) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cast-cell';
    btn.title = 'Your photo — click to place it';
    btn.innerHTML = `<img src="${assets.url(key)}" alt="your photo" /><span>MINE</span>`;
    if (doc.panels[doc.selected]?.key === key) btn.classList.add('is-picked');
    btn.addEventListener('click', () => assignPhoto(key, 'upload'));
    tray.appendChild(btn);
  }
}

function assignPhoto(key, kind = 'cast') {
  const slot = store.doc.selected;
  const base = kind === 'cast' ? CAST.find((c) => c.key === key) : null;
  store.setPanel(slot, {
    key,
    src: kind,
    zoom: slot === 2 ? 1.35 : base ? base.zoom : 1.12,
    fx: base ? base.fx : 0.5,
    fy: base ? base.fy : 0.36,
    flip: false,
  });
  renderCastTray();
  status(`Placed ${key.replace('upload:', 'your photo ')} in panel ${String(slot + 1).padStart(2, '0')}`);
}

function renderLayoutChips() {
  const row = el('layoutRow');
  row.innerHTML = '';
  for (const l of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (store.doc.layout === l.id ? ' is-on' : '');
    b.dataset.layout = l.id;
    b.textContent = l.label;
    b.addEventListener('click', () => {
      store.set({ layout: l.id });
      markActiveChips();
    });
    row.appendChild(b);
  }
}

const GRADE_LOOK = {
  sunset: 'linear-gradient(135deg,#ffb867,#2b6f78 70%,#0b2a30)',
  neon: 'linear-gradient(135deg,#ff5fa2,#7a4bd8 55%,#2fd0d8)',
  noir: 'linear-gradient(135deg,#cfd6d6,#5c6a6e 55%,#111719)',
  gold: 'linear-gradient(135deg,#ffe19a,#c08937 60%,#3b250d)',
  raw: 'linear-gradient(135deg,#e9d6bd,#8a9a8c 60%,#2a3436)',
};

function renderGrades() {
  const row = el('gradeRow');
  row.innerHTML = '';
  for (const g of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-swatch' + (store.doc.grade === g.id ? ' is-on' : '');
    b.dataset.grade = g.id;
    b.innerHTML = `<i style="background:${GRADE_LOOK[g.id]}"></i>${g.label}`;
    b.addEventListener('click', () => {
      store.set({ grade: g.id });
      el('gradeNote').textContent = g.note;
      markActiveChips();
    });
    row.appendChild(b);
  }
}

function markActiveChips() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('is-on', b.dataset.layout === store.doc.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('is-on', b.dataset.grade === store.doc.grade));
  document.querySelectorAll('[data-aspect]').forEach((b) => b.classList.toggle('is-on', b.dataset.aspect === store.doc.aspect));
  document.querySelectorAll('.cast-cell').forEach((b) => b.classList.toggle('is-picked', store.doc.panels[store.doc.selected]?.key === b.dataset.key));
}

function renderSizeTabs() {
  document.querySelectorAll('[data-aspect]').forEach((b) => {
    b.addEventListener('click', () => {
      store.set({ aspect: b.dataset.aspect });
      markActiveChips();
    });
  });
}

// ── uploads ──────────────────────────────────────────────────────────────
let uploadSeq = 0;

async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return;
  status(`Reading ${list.length} photo${list.length > 1 ? 's' : ''}…`);
  for (const file of list) {
    const url = URL.createObjectURL(file);
    const key = `upload:${++uploadSeq}:${file.name.replace(/\.[^.]+$/, '').slice(0, 18)}`;
    const img = await assets.add(key, url);
    if (!img) continue;
    assets.urls.set(key, url);
    const focus = focusFace(img) || { fx: 0.5, fy: 0.36 };
    if (list.length === 1) {
      const slot = store.doc.selected;
      store.setPanel(slot, { key, src: 'upload', zoom: slot === 2 ? 1.3 : 1.12, fx: focus.fx, fy: focus.fy, flip: false });
    }
  }
  if (list.length > 1) autoFill([...assets.keys()].filter((k) => !CAST_KEYS.includes(k)));
  renderCastTray();
  status(`${list.length} photo${list.length > 1 ? 's' : ''} added — nothing left your machine`);
  scheduleRender();
}

function busyLoop(fn) {
  document.querySelectorAll('button').forEach((b) => (b.disabled = true));
  setTimeout(() => {
    try {
      fn();
    } finally {
      document.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  }, 16);
}

// ── auto fill / surprise ─────────────────────────────────────────────────
function autoFill(preferKeys = null) {
  const doc = store.doc;
  const L = layoutOf(doc);
  const pool = (preferKeys && preferKeys.length ? preferKeys : assets.keys()).filter((k) => assets.has(k));
  if (!pool.length) return;
  const slots = L.panels.map((p) => p.slot);
  slots.forEach((slot, i) => {
    const key = pool[i % pool.length];
    const base = CAST.find((c) => c.key === key);
    const hero = L.panels.find((p) => p.slot === slot)?.hero;
    const t = i * 0.17;
    store.setPanel(
      slot,
      {
        key,
        src: base ? 'cast' : 'upload',
        zoom: (hero ? 1.35 : base ? base.zoom : 1.14) + (pool.length < slots.length ? 0.08 : 0),
        fx: base ? base.fx : 0.5,
        fy: base ? Math.min(0.55, base.fy + 0.04 * Math.sin(t)) : 0.36,
        flip: false,
      },
      { history: false },
    );
  });
  store.commit('autofill');
  status(`Filled ${slots.length} panels from ${pool.length} photo${pool.length > 1 ? 's' : ''}`);
  scheduleRender();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function surprise() {
  const pick = TITLES[Math.floor(Math.random() * TITLES.length)];
  const grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  const layouts = ['ens8', 'ens8', 'ens7', 'hero5', 'quad'];
  const layout = layouts[Math.floor(Math.random() * layouts.length)];
  const order = shuffle(CAST.map((c) => c.key));
  const doc = store.doc;
  store.set({ title: pick[0], subtitle: pick[1], grade, layout }, { history: false });
  const L = buildLayout(layout, doc.aspect);
  L.panels.forEach((p, i) => {
    const key = order[p.slot % order.length];
    const base = CAST.find((c) => c.key === key);
    store.setPanel(
      p.slot,
      { key, src: 'cast', zoom: p.hero ? 1.35 : base.zoom, fx: base.fx, fy: base.fy, flip: Math.random() > 0.72 },
      { history: false },
    );
  });
  store.commit('surprise');
  el('gradeNote').textContent = GRADES.find((g) => g.id === grade).note;
  renderCastTray();
  markActiveChips();
  status('Rolled a new cut — ⌘Z takes it back');
}

// ── panel toolbar ────────────────────────────────────────────────────────
function panelKeys() {
  return [...CAST_KEYS, ...assets.keys().filter((k) => !CAST_KEYS.includes(k))];
}

function panelAction(act) {
  const doc = store.doc;
  const slot = doc.selected;
  const panel = doc.panels[slot];
  if (!panel) return;
  const keys = panelKeys();
  if (act === 'prev' || act === 'next') {
    const i = Math.max(0, keys.indexOf(panel.key));
    const next = keys[(i + (act === 'next' ? 1 : keys.length - 1)) % keys.length];
    assignPhoto(next, CAST_KEYS.includes(next) ? 'cast' : 'upload');
    return;
  }
  if (act === 'flip') {
    store.setPanel(slot, { flip: !panel.flip });
    status('Flipped the plate');
    return;
  }
  if (act === 'reset') {
    const base = CAST.find((c) => c.key === panel.key);
    store.setPanel(slot, { zoom: slot === 2 ? 1.35 : 1.15, fx: base ? base.fx : 0.5, fy: base ? base.fy : 0.36, flip: false });
    status('Crop reset');
    return;
  }
  if (act === 'focus') {
    const img = assets.get(panel.key);
    if (!img) return;
    const f = focusFace(img);
    if (f) {
      store.setPanel(slot, { fx: f.fx, fy: f.fy, zoom: Math.max(panel.zoom, 1.2) });
      status(`Face locked at ${(f.fx * 100) | 0}% / ${(f.fy * 100) | 0}%`);
    } else {
      store.setPanel(slot, { fx: 0.5, fy: 0.34 });
      status('No face found — upper-centre crop');
    }
  }
}

function bindPanelBar() {
  document.querySelectorAll('[data-panel-act]').forEach((b) => {
    b.addEventListener('click', () => panelAction(b.dataset.panelAct));
  });
}

// ── stage gestures ───────────────────────────────────────────────────────
function bindStage() {
  const canvas = el('preview');
  let drag = null;

  const pointToFrac = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { fx: (ev.clientX - r.left) / r.width, fy: (ev.clientY - r.top) / r.height, r };
  };

  const hit = (fx, fy) => {
    const L = layoutOf(store.doc);
    for (let i = L.panels.length - 1; i >= 0; i--) {
      const p = L.panels[i];
      if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) return p;
    }
    return null;
  };

  canvas.addEventListener('pointerdown', (ev) => {
    const { fx, fy, r } = pointToFrac(ev);
    const p = hit(fx, fy);
    if (!p) return;
    store.set({ selected: p.slot }, { history: false });
    store.begin();
    drag = { slot: p.slot, x: ev.clientX, y: ev.clientY, w: r.width, h: r.height };
    canvas.setPointerCapture(ev.pointerId);
    canvas.classList.add('is-dragging');
    draw();
    syncFields();
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const L = layoutOf(store.doc);
    const p = L.panels.find((q) => q.slot === drag.slot);
    const panel = store.doc.panels[drag.slot];
    const img = assets.get(panel.key);
    if (!p || !img) return;
    const w = p.w * L.w;
    const h = p.h * L.h;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * Math.max(1, panel.zoom);
    const dx = ((ev.clientX - drag.x) / drag.w) * L.w;
    const dy = ((ev.clientY - drag.y) / drag.h) * L.h;
    const fx = Math.min(1, Math.max(0, panel.fx - dx / scale / img.naturalWidth));
    const fy = Math.min(1, Math.max(0, panel.fy - dy / scale / img.naturalHeight));
    store.setPanel(drag.slot, { fx, fy }, { history: false });
    status('Drag to frame the face');
  });

  const endDrag = () => {
    if (!drag) return;
    drag = null;
    canvas.classList.remove('is-dragging');
    store.end();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (ev) => {
      const { fx, fy } = pointToFrac(ev);
      const p = hit(fx, fy);
      if (!p) return;
      ev.preventDefault();
      const panel = store.doc.panels[p.slot];
      const zoom = Math.min(3.2, Math.max(1, (panel.zoom || 1) + (ev.deltaY > 0 ? -0.06 : 0.06)));
      store.set({ selected: p.slot }, { history: false });
      store.setPanel(p.slot, { zoom });
    },
    { passive: false },
  );
}

// ── export ───────────────────────────────────────────────────────────────
function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(blob);
    }, 'image/png');
  });
}

function fileBase(doc) {
  return (
    String(doc.title || 'vice-cover')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vice-cover'
  );
}

async function exportAspect(aspect) {
  const doc = { ...store.doc, aspect };
  const canvas = renderToCanvas(doc, getImage, { showSelection: false });
  const name = `${fileBase(doc)}-${ASPECTS[aspect].file}.png`;
  await downloadCanvas(canvas, name);
  el('exportNote').textContent = `Saved ${name} — ${ASPECTS[aspect].w} × ${ASPECTS[aspect].h}`;
  status(`Exported ${name}`);
}

async function exportAll() {
  const order = ['1:1', '4:5', '16:9'];
  for (const a of order) {
    await exportAspect(a);
    await new Promise((r) => setTimeout(r, 220));
  }
  el('exportNote').textContent = 'All three PNGs saved to your downloads.';
}

function bindExport() {
  document.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', () => exportAspect(b.dataset.export));
  });
  el('exportAll').addEventListener('click', exportAll);
}

// ── shortcuts ────────────────────────────────────────────────────────────
function bindKeys() {
  window.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const meta = ev.metaKey || ev.ctrlKey;
    if (meta && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      (ev.shiftKey ? store.redo() : store.undo()) ? status(ev.shiftKey ? 'Redo' : 'Undo') : status('Nothing to undo');
      renderCastTray();
      return;
    }
    if (typing) return;
    const doc = store.doc;
    const panel = doc.panels[doc.selected];
    if (meta && ev.key.toLowerCase() === 'e') {
      ev.preventDefault();
      exportAspect(doc.aspect);
      return;
    }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (!panel) return;
      const step = ev.shiftKey ? 0.06 : 0.02;
      const fx = panel.fx + (ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0);
      const fy = panel.fy + (ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0);
      store.setPanel(doc.selected, { fx: Math.min(1, Math.max(0, fx)), fy: Math.min(1, Math.max(0, fy)) }, { history: false });
      return;
    }
    if (ev.key === '+' || ev.key === '=' || ev.key === '-') {
      const zoom = Math.min(3.2, Math.max(1, panel.zoom + (ev.key === '-' ? -0.08 : 0.08)));
      store.setPanel(doc.selected, { zoom }, { history: false });
      return;
    }
    if (ev.key >= '1' && ev.key <= '3') {
      const a = ['1:1', '4:5', '16:9'][Number(ev.key) - 1];
      store.set({ aspect: a });
      markActiveChips();
      return;
    }
    if (ev.key === 'f') panelAction('focus');
    if (ev.key === 'r') panelAction('reset');
    if (ev.key === 'b') panelAction('flip');
    if (ev.key === 'n') panelAction('next');
    if (ev.key === 'p') panelAction('prev');
  });
}

function status(msg) {
  const s = el('statusMsg');
  if (s) s.textContent = msg;
}

// ── shot pages ───────────────────────────────────────────────────────────
function applyOverrides(doc) {
  const map = [
    ['title', 'title'],
    ['subtitle', 'sub'],
    ['tagline', 'tagline'],
    ['grade', 'grade'],
    ['layout', 'layout'],
  ];
  const patch = {};
  for (const [param, key] of map) {
    const v = qs.get(param);
    if (v) patch[key] = v;
  }
  return { ...doc, ...patch };
}

async function runShot(mode) {
  const spec = shotFor(mode);
  document.getElementById('app').hidden = true;
  const page = el('shotPage');
  page.hidden = false;
  page.classList.toggle('is-cover', mode === 'cover');
  page.classList.toggle('is-plate', mode !== 'cover');
  const canvas = el('shotCanvas');
  const doc = applyOverrides(store.doc);
  const aspect = spec.aspect;
  const sized = spec.stage;
  const cw = ASPECTS[aspect].w;
  const ch = ASPECTS[aspect].h;
  canvas.width = cw;
  canvas.height = ch;
  // full bleed: the cover fills the viewport, scaled to fit without distortion
  const scale = Math.min(window.innerWidth / sized.w, window.innerHeight / sized.h);
  canvas.style.width = `${Math.round(sized.w * scale)}px`;
  canvas.style.height = `${Math.round(sized.h * scale)}px`;
  const cap = el('shotCaption');
  cap.hidden = true;
  renderCover(canvas, { ...doc, aspect }, getImage, { showSelection: false });
  document.title = mode === 'cover' ? 'Vice Cover Studio — Sundown Racket key art' : 'Vice Cover Studio';
}

// ── boot ─────────────────────────────────────────────────────────────────
async function loadFonts() {
  const specs = [
    '400 100px Anton',
    '400 100px Bebas',
    '400 100px Archivo',
    '400 100px MrDafoe',
    '400 100px Kaushan',
  ];
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s)));
  } catch (err) {
    console.warn('font load', err);
  }
  await document.fonts.ready;
}

function mountEditor() {
  editorLive = true;
  renderCastTray();
  renderLayoutChips();
  renderGrades();
  renderSizeTabs();
  bindFields();
  bindPanelBar();
  bindStage();
  bindExport();
  bindKeys();
  syncFields();
  el('gradeNote').textContent = GRADES.find((g) => g.id === store.doc.grade).note;
  document.querySelector('.step').classList.add('is-on');
  el('loadingVeil').hidden = true;

  const input = el('fileInput');
  input.addEventListener('change', (e) => addFiles(e.target.files));

  const dz = el('dropzone');
  ['dragenter', 'dragover'].forEach((t) =>
    dz.addEventListener(t, (e) => {
      e.preventDefault();
      dz.classList.add('is-over');
    }),
  );
  ['dragleave', 'drop'].forEach((t) =>
    dz.addEventListener(t, (e) => {
      e.preventDefault();
      dz.classList.remove('is-over');
    }),
  );
  dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  el('autoFillBtn').addEventListener('click', () => autoFill());
  el('surpriseBtn').addEventListener('click', surprise);

  document.querySelectorAll('.cast-cell').forEach((c) => c.classList.remove('is-picked'));
  markActiveChips();
  draw();
}

async function boot() {
  const doc = store.doc;
  if (shot) document.body.classList.add('is-shot');
  const tasks = [assets.loadCast(), loadFonts()];
  const preload = qs.get('layout');
  if (preload) store.set({ layout: preload }, { history: false });
  await Promise.all(tasks);

  if (!shot || shot === 'editor') {
    mountEditor();
  } else {
    await runShot(shot);
  }
}

boot().catch((err) => {
  console.error(err);
  const veil = el('loadingVeil');
  if (veil) veil.textContent = 'Something went wrong loading the cast.';
});
