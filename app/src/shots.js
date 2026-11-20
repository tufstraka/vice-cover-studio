// Deterministic scenes for the submission screenshots.
//
//   ?shot=cover&size=1920x1080&layout=five&photos=pier,boulevard
//   &caption=SUNSET%20HEIST&location=VICE%20CITY&palette=vice&grain=1&halftone=1
//   ?shot=editor&layout=three&photos=pier,boulevard&size=square
//
// The scene loads the starter sample photos, paints, then sets window.__shotReady exactly once.

const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

function parseSize(value) {
  if (value && SIZES[value]) return value;
  if (value && /^\d+x\d+$/.test(value)) {
    const [w, h] = value.split('x').map(Number);
    const known = Object.entries(SIZES).find(([, dims]) => dims[0] === w && dims[1] === h);
    if (known) return known[0];
  }
  return 'wide';
}

export async function runShot(shot, query, api) {
  const photoNames = (query.get('photos') || query.get('photo') || 'pier')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const photos = await api.loadSamples(photoNames);
  const sizeName = parseSize(query.get('size'));
  const caption = query.get('caption') || (shot === 'editor' ? 'Vice Nights' : 'Sunset Heist');
  const layout = query.get('layout') || (shot === 'editor' ? 'five' : 'five');

  api.apply({
    photos,
    layout,
    caption,
    location: query.get('location') || 'Vice City',
    palette: query.get('palette') || 'vice',
    grain: query.get('grain') !== '0',
    halftone: query.get('halftone') !== '0',
    sizeName,
    fullRes: shot === 'cover',
  });

  if (shot === 'editor') {
    document.body.classList.add('shot-editor');
    api.selectPanel(Number(query.get('panel') ?? 0));
  } else {
    document.body.classList.add('shot-cover');
  }

  api.render();

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // One more frame after the DOM class change settles the flex layout before capture.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  window.__shotReady = true;
}
