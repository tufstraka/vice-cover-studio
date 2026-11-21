// Shot pages: the queries this app is captured with, and the canvas each one shows.
// ?shot=cover    1920x1080 cover only, drawn at 1536x864 on a neutral page (1600x900 window)
// ?shot=editor   the full editor with the cast loaded (1280x720 window)
// ?shot=vertical 1080x1350 cover only, drawn at 960x1200 (960x1200 window)
// ?shot=square   1080x1080 cover only, drawn at 960x960 (960x960 window)

export const SHOT_MODES = {
  cover: { aspect: '16:9', stage: { w: 1536, h: 864 }, window: { w: 1600, h: 900 }, file: '1-cover.png', note: 'the exported 16:9 key art' },
  editor: { aspect: '16:9', stage: null, window: { w: 1280, h: 720 }, file: '2-editor.png', note: 'the studio with all eight plates loaded' },
  vertical: { aspect: '4:5', stage: { w: 960, h: 1200 }, window: { w: 960, h: 1200 }, file: '3-cover-vertical.png', note: '1080 x 1350 export' },
  square: { aspect: '1:1', stage: { w: 960, h: 960 }, window: { w: 960, h: 960 }, file: '4-cover-square.png', note: '1080 x 1080 export' },
};

export function shotFor(name) {
  return SHOT_MODES[name] || null;
}
