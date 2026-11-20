// Vice Cover Studio — editor wiring.
//
// Holds the document state (photos, panel crops, lettering, grade), paints the live preview,
// handles drop/browse, panel selection, pan/zoom, photo swaps and PNG export. A `?shot=`
// query hands control to ./shots.js for deterministic screenshot scenes.

import { renderCover, panelRects, PALETTES, LAYOUTS, LAYOUT_LABELS, PANEL_COUNT } from './cover.js';
import { runShot } from './shots.js';

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

const state = {
  photos: [],
  panels: [{ photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 }],
  layout: 'solo',
  caption: 'Sunset Heist',
  location: 'Vice City',
  palette: 'vice',
  grain: true,
  halftone: true,
  sizeName: 'wide',
  selected: 0,
  fullRes: false,
};

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
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

function previewScale(w, h) {
  if (state.fullRes) return 1;
  const longest = Math.max(w, h);
  return longest > 1280 ? 1280 / longest : 1;
}

function renderNow() {
  renderQueued = false;
  const [w, h] = SIZES[state.sizeName] ?? SIZES.wide;
  const scale = previewScale(w, h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  renderCover(canvas, state, pw, ph);
  stageInfo.textContent = `${w} × ${h}`;
  layoutNote.textContent = `${PANEL_COUNT[state.layout]} panel${PANEL_COUNT[state.layout] > 1 ? 's' : ''}`;
}

function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderNow);
}

function syncPanels() {
  const count = PANEL_COUNT[state.layout];
  while (state.panels.length < count) state.panels.push({ photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 });
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
    b.style.background = `linear-gradient(160deg, ${p.skyTop}, ${p.skyBottom} 55%, ${p.glow})`;
    b.addEventListener('click', () => {
      state.palette = id;
      buildPalettes();
      render();
    });
    wrap.append(b);
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

const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (event) => {
  if (document.body.classList.contains('shot-cover')) return;
  const panel = selectedPanel();
  if (!panel) return;
  event.preventDefault();
  panel.zoom = Math.min(2.6, Math.max(1, panel.zoom - event.deltaY * 0.0012));
  refreshPanelUi();
  render();
}, { passive: false });

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

document.querySelectorAll('.aspects button').forEach((b) => {
  b.addEventListener('click', () => setSize(b.dataset.size));
});

document.querySelectorAll('.exports button').forEach((b) => {
  b.addEventListener('click', () => exportPng(b.dataset.export));
});

/* ---------- file input & drop ---------- */

document.getElementById('file').addEventListener('change', async (event) => {
  const files = [...event.target.files ?? []];
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
        .catch(() => { statusEl.textContent = 'One of those files could not be read as an image.'; });
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

const shotApi = {
  async loadSamples(names) {
    const unique = [...new Set(names)];
    const loaded = await Promise.all(unique.map(loadSample));
    return loaded;
  },
  apply(scene) {
    if (scene.photos) {
      state.photos = scene.photos;
      activePhotoId = scene.photos[0]?.id ?? null;
    }
    if (scene.layout) state.layout = scene.layout;
    if (scene.caption != null) state.caption = scene.caption;
    if (scene.location != null) state.location = scene.location;
    if (scene.palette && PALETTES[scene.palette]) state.palette = scene.palette;
    if (scene.grain != null) state.grain = scene.grain;
    if (scene.halftone != null) state.halftone = scene.halftone;
    if (scene.sizeName) state.sizeName = scene.sizeName;
    if (scene.fullRes) state.fullRes = true;
    while (state.panels.length < PANEL_COUNT[state.layout]) state.panels.push({ photo: -1, focusX: 0.5, focusY: 0.5, zoom: 1 });
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
    locationInput.value = state.location;
    document.getElementById('grain').checked = state.grain;
    document.getElementById('halftone').checked = state.halftone;
    buildLayouts();
    buildPalettes();
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

async function boot() {
  buildLayouts();
  buildPalettes();
  buildPanelPicker();
  buildPhotoAssign();
  renderNow();

  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, shotApi);
    return;
  }

  // First visit: gently peak at the sample art so the studio is never an empty frame.
  try {
    const [pier, boulevard] = await Promise.all([loadSample('pier'), loadSample('boulevard')]);
    addPhotos([pier, boulevard]);
    state.layout = 'triptych';
    state.sizeName = 'wide';
    syncPanels();
    buildLayouts();
    buildPanelPicker();
    buildPhotoAssign();
    setSize('wide');
    document.querySelectorAll('.aspects button').forEach((b) => b.classList.toggle('on', b.dataset.size === 'wide'));
    statusEl.textContent = 'Sample photos loaded. Replace them with yours, then export.';
  } catch {
    statusEl.textContent = 'Ready. Load a photo to start.';
  }
}

boot();
