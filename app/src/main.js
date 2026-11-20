// Vice Cover Studio — editor wiring.
//
// Holds the document state (photos, panel crops, lettering, grade, title system), paints the
// live preview at the selected export size, handles drop/browse, panel selection, pan/zoom,
// photo swaps, composition shuffling and PNG export. A `?shot=` query drives deterministic
// screenshot scenes and sets window.__shotReady once the poster has painted.

import {
  renderCover,
  panelRects,
  PALETTES,
  TITLE_STYLES,
  TITLE_STYLE_LABELS,
  LAYOUTS,
  LAYOUT_LABELS,
  PANEL_COUNT,
} from './cover.js';

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

const state = {
  photos: [],
  panels: [{ photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 }],
  layout: 'five',
  caption: 'Sunset Heist',
  subtitle: 'The coast is never clean',
  location: 'Vice City',
  palette: 'vice',
  titleStyle: 'classic',
  captionPosition: 'bottom',
  grain: true,
  halftone: true,
  sizeName: 'wide',
  selected: 0,
};

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const locationInput = document.getElementById('location');
const statusEl = document.getElementById('status');
const stageInfo = document.getElementById('stageInfo');
const photoList = document.getElementById('photoList');
const photoCount = document.getElementById('photoCount');
const panelPicker = document.getElementById('panelPicker');
const photoAssign = document.getElementById('photoAssign');
const panelIndexEl = document.getElementById('panelIndex');
const zoomInput = document.getElementById('zoom');
const zoomOut = document.getElementById('zoomOut');
const layoutNote = document.getElementById('layoutNote');
const drop = document.getElementById('drop');
const titleStyles = document.getElementById('titleStyles');
const captionPos = document.getElementById('captionPos');

let uid = 1;
let renderQueued = false;
let activePhotoId = null;

/** Loads an <img> from a local URL and waits until it can be painted. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

function renderNow() {
  renderQueued = false;
  const [w, h] = SIZES[state.sizeName] ?? SIZES.wide;
  // Live preview is painted at the export resolution, then fitted by CSS.
  renderCover(canvas, state, w, h);
  stageInfo.textContent = `${w} × ${h}`;
  layoutNote.textContent = `${PANEL_COUNT[state.layout]} panel${PANEL_COUNT[state.layout] > 1 ? 's' : ''}`;
}

function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderNow);
}

function defaultPanel(index) {
  return { photo: state.photos.length ? index % state.photos.length : -1, focusX: 0.5, focusY: 0.5, zoom: 1 };
}

function syncPanels() {
  const count = PANEL_COUNT[state.layout];
  while (state.panels.length < count) state.panels.push(defaultPanel(state.panels.length));
  state.panels.length = count;
  state.panels.forEach((panel, i) => {
    if (panel.photo >= state.photos.length || panel.photo < 0) {
      panel.photo = state.photos.length ? i % state.photos.length : -1;
    }
  });
  if (state.selected >= count) state.selected = count - 1;
}

/* ---------- panels & photos ---------- */

function selectedPanel() {
  return state.panels[state.selected];
}

function buildPanelPicker() {
  panelPicker.replaceChildren();
  const count = PANEL_COUNT[state.layout];
  for (let i = 0; i < count; i += 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1).padStart(2, '0');
    b.className = i === state.selected ? 'on' : '';
    b.addEventListener('click', () => {
      state.selected = i;
      refreshPanelUi();
      render();
    });
    panelPicker.append(b);
  }
  panelIndexEl.textContent = String(state.selected + 1).padStart(2, '0');
}

function photoName(photo) {
  return (photo?.name ?? 'photo').replace(/\.[^.]+$/, '').slice(0, 16);
}

function buildPhotoAssign() {
  photoAssign.replaceChildren();
  if (!state.photos.length) {
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = 'Load photos, then tap one to place it in this panel.';
    photoAssign.append(span);
    return;
  }
  state.photos.forEach((photo, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = selectedPanel()?.photo === i ? 'on' : '';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = '';
    b.append(img, document.createTextNode(photoName(photo)));
    b.addEventListener('click', () => {
      selectedPanel().photo = i;
      activePhotoId = photo.id;
      buildPhotoAssign();
      buildPhotoList();
      render();
    });
    photoAssign.append(b);
  });
}

function buildPhotoList() {
  photoList.replaceChildren();
  state.photos.forEach((photo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `thumb${photo.id === activePhotoId ? ' on' : ''}`;
    b.title = `Place ${photoName(photo)} in the selected panel`;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photoName(photo);
    const label = document.createElement('span');
    label.textContent = photoName(photo);
    b.append(img, label);
    b.addEventListener('click', () => {
      const panel = selectedPanel();
      if (!panel) return;
      panel.photo = state.photos.indexOf(photo);
      activePhotoId = photo.id;
      buildPhotoList();
      buildPhotoAssign();
      render();
    });
    photoList.append(b);
    if (activePhotoId == null) activePhotoId = photo.id;
  });
  photoCount.textContent = String(state.photos.length);
}

function addPhotos(incoming) {
  if (!incoming.length) return;
  state.photos.push(...incoming);
  activePhotoId = incoming[0].id;
  syncPanels();
  buildPhotoList();
  buildPhotoAssign();
  statusEl.textContent = `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded. Pick a panel and drag to crop.`;
  render();
}

async function photoFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  return { id: uid++, name: file.name || 'photo', img, url, sample: false };
}

const samples = new Map();
async function loadSample(name) {
  if (samples.has(name)) return samples.get(name);
  const img = await loadImage(`./samples/${name}.jpg`);
  const photo = { id: uid++, name, img, url: `./samples/${name}.jpg`, sample: true };
  samples.set(name, photo);
  return photo;
}

/* ---------- UI state ---------- */

function buildLayouts() {
  const wrap = document.getElementById('layouts');
  wrap.replaceChildren();
  LAYOUTS.forEach((layout) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = LAYOUT_LABELS[layout];
    b.className = state.layout === layout ? 'on' : '';
    b.addEventListener('click', () => {
      state.layout = layout;
      syncPanels();
      buildLayouts();
      buildPanelPicker();
      buildPhotoAssign();
      refreshPanelUi();
      render();
    });
    wrap.append(b);
  });
}

function buildPalettes() {
  const wrap = document.getElementById('palettes');
  wrap.replaceChildren();
  Object.entries(PALETTES).forEach(([id, p]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch${state.palette === id ? ' on' : ''}`;
    b.dataset.label = p.label.split(' ')[0];
    b.title = p.label;
    b.style.background = `linear-gradient(160deg, ${p.skyTop}, ${p.skyMid} 48%, ${p.skyBottom} 78%, ${p.glow})`;
    b.addEventListener('click', () => {
      state.palette = id;
      buildPalettes();
      render();
    });
    wrap.append(b);
  });
}

function buildTitleStyles() {
  titleStyles.replaceChildren();
  TITLE_STYLES.forEach((style) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = TITLE_STYLE_LABELS[style];
    b.className = state.titleStyle === style ? 'on' : '';
    b.addEventListener('click', () => {
      state.titleStyle = style;
      buildTitleStyles();
      render();
    });
    titleStyles.append(b);
  });
}

function buildCaptionPos() {
  captionPos.replaceChildren();
  [
    ['bottom', 'Bottom'],
    ['top', 'Top'],
  ].forEach(([value, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = state.captionPosition === value ? 'on' : '';
    b.addEventListener('click', () => {
      state.captionPosition = value;
      buildCaptionPos();
      render();
    });
    captionPos.append(b);
  });
}

function refreshPanelUi() {
  buildPanelPicker();
  buildPhotoAssign();
  const panel = selectedPanel();
  zoomInput.value = String(Math.round((panel?.zoom ?? 1) * 100));
  zoomOut.textContent = `${(panel?.zoom ?? 1).toFixed(1)}×`;
}

function setSize(name) {
  if (!SIZES[name]) return;
  state.sizeName = name;
  document.querySelectorAll('.aspects button').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === name);
  });
  render();
}

/* ---------- interactions ---------- */

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  if (document.body.classList.contains('shot-cover')) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  const rects = panelRects(canvas.width, canvas.height, state.layout);
  const hit = rects.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  if (hit === -1) return;
  state.selected = hit;
  const panel = state.panels[hit];
  drag = { panel, rect: rects[hit], x: event.clientX, y: event.clientY, fx: panel.focusX, fy: panel.focusY };
  refreshPanelUi();
  render();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const panel = drag.panel;
  const bounds = canvas.getBoundingClientRect();
  const dx = ((event.clientX - drag.x) * (canvas.width / bounds.width)) / drag.rect.w;
  const dy = ((event.clientY - drag.y) * (canvas.height / bounds.height)) / drag.rect.h;
  const sensitivity = 1 / Math.max(1, panel.zoom);
  panel.focusX = Math.min(1, Math.max(0, drag.fx - dx * sensitivity));
  panel.focusY = Math.min(1, Math.max(0, drag.fy - dy * sensitivity));
  render();
});

const endDrag = () => {
  drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener(
  'wheel',
  (event) => {
    if (document.body.classList.contains('shot-cover')) return;
    const panel = selectedPanel();
    if (!panel) return;
    event.preventDefault();
    panel.zoom = Math.min(2.6, Math.max(1, panel.zoom - event.deltaY * 0.0012));
    refreshPanelUi();
    render();
  },
  { passive: false },
);

zoomInput.addEventListener('input', () => {
  const panel = selectedPanel();
  if (!panel) return;
  panel.zoom = Number(zoomInput.value) / 100;
  zoomOut.textContent = `${panel.zoom.toFixed(1)}×`;
  render();
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  render();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  render();
});
locationInput.addEventListener('input', () => {
  state.location = locationInput.value;
  render();
});

document.getElementById('grain').addEventListener('change', (event) => {
  state.grain = event.target.checked;
  render();
});
document.getElementById('halftone').addEventListener('change', (event) => {
  state.halftone = event.target.checked;
  render();
});

document.getElementById('swap').addEventListener('click', () => {
  const count = state.panels.length;
  if (count < 2) return;
  const first = state.panels[0].photo;
  for (let i = 0; i < count - 1; i += 1) state.panels[i].photo = state.panels[i + 1].photo;
  state.panels[count - 1].photo = first;
  buildPhotoAssign();
  render();
  statusEl.textContent = 'Rotated the photos across the panels.';
});

document.getElementById('shuffle').addEventListener('click', () => {
  const options = LAYOUTS.filter((layout) => PANEL_COUNT[layout] <= Math.max(1, state.photos.length) || layout === state.layout);
  state.layout = options[Math.floor(Math.random() * options.length)] ?? 'five';
  syncPanels();
  state.panels.forEach((panel, i) => {
    if (state.photos.length) panel.photo = Math.floor(Math.random() * state.photos.length);
    panel.focusX = 0.25 + Math.random() * 0.5;
    panel.focusY = 0.3 + Math.random() * 0.4;
    panel.zoom = 1 + Math.random() * 0.35;
    if (panel.focusX < 0.05) panel.focusX = 0.5;
    if (!state.photos.length) panel.photo = -1;
    panel.index = i;
  });
  state.selected = 0;
  buildLayouts();
  refreshPanelUi();
  render();
  statusEl.textContent = `Shuffled to a ${LAYOUT_LABELS[state.layout].toLowerCase()} composition.`;
});

document.getElementById('resetPanel').addEventListener('click', () => {
  const panel = selectedPanel();
  if (!panel) return;
  panel.focusX = 0.5;
  panel.focusY = 0.5;
  panel.zoom = 1;
  refreshPanelUi();
  render();
  statusEl.textContent = `Panel ${String(state.selected + 1).padStart(2, '0')} reset to its centre crop.`;
});

document.querySelectorAll('.aspects button').forEach((b) => {
  b.addEventListener('click', () => setSize(b.dataset.size));
});

document.querySelectorAll('.exports button').forEach((b) => {
  b.addEventListener('click', () => exportPng(b.dataset.export));
});

/* ---------- file input & drop ---------- */

document.getElementById('file').addEventListener('change', async (event) => {
  const files = [...(event.target.files ?? [])];
  event.target.value = '';
  try {
    const photos = await Promise.all(files.map(photoFromFile));
    addPhotos(photos);
  } catch {
    statusEl.textContent = 'That file could not be read as an image.';
  }
});

['dragenter', 'dragover'].forEach((type) => {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.add('over');
  });
});
['dragleave', 'drop'].forEach((type) => {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.remove('over');
    if (type === 'drop' && event.dataTransfer?.files?.length) {
      Promise.all([...event.dataTransfer.files].filter((f) => f.type.startsWith('image/')).map(photoFromFile))
        .then(addPhotos)
        .catch(() => {
          statusEl.textContent = 'One of those files could not be read as an image.';
        });
    }
  });
});

// Dropping anywhere on the stage also works.
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => {
  if (event.target.closest?.('#drop')) return;
  event.preventDefault();
  if (!event.dataTransfer?.files?.length) return;
  Promise.all([...event.dataTransfer.files].filter((f) => f.type.startsWith('image/')).map(photoFromFile))
    .then(addPhotos)
    .catch(() => {});
});

/* ---------- export ---------- */

function exportPng(sizeName) {
  const [w, h] = SIZES[sizeName] ?? SIZES.wide;
  const off = document.createElement('canvas');
  renderCover(off, state, w, h);
  off.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'PNG export failed in this browser.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    statusEl.textContent = `Exported vice-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KB).`;
  }, 'image/png');
}

/* ---------- deterministic screenshot scenes ---------- */

function parseSize(value) {
  if (value && SIZES[value]) return value;
  if (value && /^\d+x\d+$/.test(value)) {
    const [w, h] = value.split('x').map(Number);
    const known = Object.entries(SIZES).find(([, dims]) => dims[0] === w && dims[1] === h);
    if (known) return known[0];
  }
  return 'wide';
}

const shotApi = {
  async loadSamples(names) {
    return Promise.all([...new Set(names)].map(loadSample));
  },
  apply(scene) {
    if (scene.photos) {
      state.photos = scene.photos;
      activePhotoId = scene.photos[0]?.id ?? null;
    }
    if (scene.layout) state.layout = scene.layout;
    if (scene.caption != null) state.caption = scene.caption;
    if (scene.subtitle != null) state.subtitle = scene.subtitle;
    if (scene.location != null) state.location = scene.location;
    if (scene.palette && PALETTES[scene.palette]) state.palette = scene.palette;
    if (TITLE_STYLES.includes(scene.titleStyle)) state.titleStyle = scene.titleStyle;
    if (scene.captionPosition === 'top' || scene.captionPosition === 'bottom') {
      state.captionPosition = scene.captionPosition;
    }
    if (scene.grain != null) state.grain = scene.grain;
    if (scene.halftone != null) state.halftone = scene.halftone;
    if (scene.sizeName) state.sizeName = scene.sizeName;
    while (state.panels.length < PANEL_COUNT[state.layout]) state.panels.push(defaultPanel(state.panels.length));
    state.panels.length = PANEL_COUNT[state.layout];
    state.panels.forEach((panel, i) => {
      panel.photo = state.photos.length ? i % state.photos.length : -1;
      if (scene.zooms?.[i]) panel.zoom = scene.zooms[i];
      if (scene.focuses?.[i]) {
        panel.focusX = scene.focuses[i][0];
        panel.focusY = scene.focuses[i][1];
      }
    });
    captionInput.value = state.caption;
    subtitleInput.value = state.subtitle;
    locationInput.value = state.location;
    document.getElementById('grain').checked = state.grain;
    document.getElementById('halftone').checked = state.halftone;
    buildLayouts();
    buildPalettes();
    buildTitleStyles();
    buildCaptionPos();
    buildPhotoList();
    refreshPanelUi();
    setSize(state.sizeName);
    statusEl.textContent = `${state.photos.length} photos · ${PANEL_COUNT[state.layout]}-panel collage · drag to crop, scroll to zoom.`;
  },
  render: renderNow,
  selectPanel(i) {
    state.selected = Math.min(i, state.panels.length - 1);
    refreshPanelUi();
  },
};

async function runShot(shot, query) {
  const photoNames = (query.get('photos') || query.get('photo') || 'pier,boulevard')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const photos = await shotApi.loadSamples(photoNames);
  const isEditor = shot === 'editor';
  const caption = query.get('caption') || (isEditor ? 'Vice Nights' : 'Sunset Heist');
  shotApi.apply({
    photos,
    layout: query.get('layout') || 'five',
    caption,
    subtitle: query.get('subtitle') || 'The coast is never clean',
    location: query.get('location') || 'Vice City',
    palette: query.get('palette') || 'vice',
    titleStyle: query.get('style') || 'classic',
    captionPosition: query.get('position') || 'bottom',
    grain: query.get('grain') !== '0',
    halftone: query.get('halftone') !== '0',
    sizeName: parseSize(query.get('size')),
    zooms: (query.get('zoom') || '').split(',').map(Number),
    focuses: (query.get('focus') || '')
      .split(',')
      .filter(Boolean)
      .map((pair) => pair.split(':').map(Number)),
  });

  document.body.classList.add(isEditor ? 'shot-editor' : 'shot-cover');
  if (isEditor) shotApi.selectPanel(Number(query.get('panel') ?? 0));
  shotApi.render();

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  window.__shotReady = true;
}

async function boot() {
  buildLayouts();
  buildPalettes();
  buildTitleStyles();
  buildCaptionPos();
  buildPanelPicker();
  buildPhotoAssign();
  renderNow();

  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query);
    return;
  }

  // First visit: load the sample art so the studio is never an empty frame.
  try {
    const [pier, boulevard] = await Promise.all([loadSample('pier'), loadSample('boulevard')]);
    addPhotos([pier, boulevard]);
    state.layout = 'five';
    state.sizeName = 'wide';
    syncPanels();
    buildLayouts();
    buildPanelPicker();
    buildPhotoAssign();
    setSize('wide');
    statusEl.textContent = 'Sample photos loaded. Replace them with yours, then export.';
  } catch {
    statusEl.textContent = 'Ready. Load a photo to start.';
  }
}

boot();
