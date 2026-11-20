// The document the studio edits, plus a small undo/redo store.
// Everything the renderer reads lives in this object; nothing else is mutated.

export const CAST = [
  { key: 'captain', role: 'THE CAPTAIN', fx: 0.33, fy: 0.27, zoom: 1.06 },
  { key: 'femme', role: 'THE FEMME', fx: 0.5, fy: 0.3, zoom: 1.06 },
  { key: 'mechanic', role: 'THE MECHANIC', fx: 0.5, fy: 0.37, zoom: 1.0 },
  { key: 'driver', role: 'THE DRIVER', fx: 0.5, fy: 0.32, zoom: 1.06 },
  { key: 'lookout', role: 'THE LOOKOUT', fx: 0.5, fy: 0.34, zoom: 1.06 },
  { key: 'detective', role: 'THE DETECTIVE', fx: 0.5, fy: 0.29, zoom: 1.06 },
  { key: 'singer', role: 'THE SINGER', fx: 0.52, fy: 0.32, zoom: 1.08 },
  { key: 'boss', role: 'THE BOSS', fx: 0.5, fy: 0.27, zoom: 1.06 },
];

export const GRADES = [
  { id: 'sunset', label: 'Sunset', note: 'Teal shadows, warm highlights, halation and grain.' },
  { id: 'neon', label: 'Neon', note: 'Magenta and cyan split tone, hot magenta rims.' },
  { id: 'noir', label: 'Noir', note: 'Near-monochrome, hard contrast, cold steel blue.' },
  { id: 'gold', label: 'Gold', note: 'Amber highlights, deep brown shadows, sepia bloom.' },
  { id: 'raw', label: 'Raw', note: 'Almost untouched sensor colour, light film curve.' },
];

export const TITLES = [
  ['SUNDOWN RACKET', 'Paid in Sunsets'],
  ['GOLDEN MILE', 'A Debt in Daylight'],
  ['PALM & PISTOL', 'Nobody Leaves Clean'],
  ['LAST RUN SOUTH', 'Love Is a Getaway'],
  ['VELVET HARBOUR', 'All Tide, No Mercy'],
  ['NIGHT SHIFT', 'Overtime Is Forever'],
];

const PANEL_BASE = (i) => {
  const c = CAST[i] || CAST[0];
  return { key: c.key, src: 'cast', zoom: c.zoom, fx: c.fx, fy: c.fy, flip: false, focus: null };
};

export function defaultDoc() {
  return {
    layout: 'ens8',
    aspect: '16:9',
    grade: 'sunset',
    title: 'SUNDOWN RACKET',
    subtitle: 'Paid in Sunsets',
    tagline: 'EVERYONE WANTS A CUT OF THE SUNSET',
    quote: 'THE MOST DANGEROUS CAST IN AMERICA',
    source: 'GOLDEN MILE GAZETTE',
    billing: ['A GOLDEN MILE PICTURES PRODUCTION', 'IN ASSOCIATION WITH PALM & PISTOL', 'MUSIC BY THE NIGHT SHIFT ORCHESTRA'],
    release: 'COMING SOON',
    edition: 'VOL. 1',
    seal: 'ORIGINAL · COVER ART',
    barcode: 'GM 06 0417',
    titleFont: 'anton',
    scriptFont: 'mrdafoe',
    selected: 2,
    panels: Array.from({ length: 8 }, (_, i) => PANEL_BASE(i)),
  };
}

export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function roleOf(doc, slot) {
  const key = doc.panels[slot]?.key;
  const found = CAST.find((c) => c.key === key);
  if (found) return found.role;
  const up = String(key || 'guest').replace(/[-_]+/g, ' ').replace(/\.\w+$/, '');
  return 'THE ' + (up.replace(/\d+$/, '').trim().toUpperCase() || 'GUEST');
}

// Tiny store: set() records history unless told otherwise, begin()/end() wrap a gesture.
export function createStore(initial, onChange) {
  let doc = clone(initial);
  const past = [];
  const future = [];
  let gesture = null;
  let quietDepth = 0;

  const snapshot = () => ({ doc: clone(doc), selected: doc.selected });

  function notify(reason) {
    onChange(doc, reason);
  }

  function push(before) {
    past.push(before);
    if (past.length > 60) past.shift();
    future.length = 0;
  }

  return {
    get doc() {
      return doc;
    },
    set(patch, opts = {}) {
      const before = opts.history === false ? null : snapshot();
      doc = { ...doc, ...patch };
      if (before) push(before);
      if (!quietDepth) notify(opts.reason || 'set');
    },
    setPanel(slot, patch, opts = {}) {
      const before = opts.history === false ? null : snapshot();
      doc = { ...doc, panels: doc.panels.map((p, i) => (i === slot ? { ...p, ...patch } : p)) };
      if (before) push(before);
      if (!quietDepth) notify(opts.reason || 'panel');
    },
    commit(reason) {
      notify(reason || 'commit');
    },
    begin() {
      gesture = snapshot();
    },
    end() {
      if (!gesture) return;
      const live = JSON.stringify(doc);
      if (live !== JSON.stringify(gesture.doc)) {
        past.push(gesture);
        if (past.length > 60) past.shift();
        future.length = 0;
      }
      gesture = null;
      notify('gesture');
    },
    quiet(fn) {
      quietDepth++;
      try {
        fn();
      } finally {
        quietDepth--;
      }
    },
    undo() {
      if (!past.length) return false;
      const prev = past.pop();
      future.push(snapshot());
      doc = prev.doc;
      notify('undo');
      return true;
    },
    redo() {
      if (!future.length) return false;
      const next = future.pop();
      past.push(snapshot());
      doc = next.doc;
      notify('redo');
      return true;
    },
    replace(next, opts = {}) {
      const before = opts.history === false ? null : snapshot();
      doc = clone(next);
      if (before) push(before);
      notify(opts.reason || 'replace');
    },
  };
}
