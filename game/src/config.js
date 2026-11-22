// SHADOW SHIFT tuning: one place for every number the simulation and the
// painter share. Distances are pixels, times are seconds, the world advances in
// fixed DT steps so a played run and a staged screenshot run the same code.

/** The stage is a fixed 1280x720 canvas; the strip at the top is the HUD. */
export const STAGE = { width: 1280, height: 720, hud: 58 };

/** Levels are tile maps of COLS by ROWS; each tile is a TILE-pixel square. */
export const TILE = 42;
export const COLS = 28;
export const ROWS = 15;
export const FLOOR = {
  x: (STAGE.width - COLS * TILE) / 2,
  y: STAGE.hud + (STAGE.height - STAGE.hud - ROWS * TILE) / 2,
  width: COLS * TILE,
  height: ROWS * TILE,
};

/** Fixed simulation step. */
export const DT = 1 / 120;

/** The infiltrator: fast on foot, slow and quiet while crouched. */
export const THIEF = {
  radius: 13,
  walk: 162,
  sneak: 76,
  loud: 100,
  quiet: 32,
};

/** A patrolling guard: walks a waypoint route, pauses at each post and scans. */
export const GUARD = {
  radius: 14,
  patrol: 78,
  turn: 4.6,
  scanSwing: 1.0,
  scanRate: 0.95,
  sight: 205,
  halfCone: 0.6,
  hearFor: 1.2,
};

/** A wall-mounted camera: fixed in place, sweeping its cone back and forth. */
export const CAM = {
  sight: 185,
  halfCone: 0.48,
};

/** The alarm meter, 0 to 100: seen fills it, hidden drains it, full is caught. */
export const ALARM = {
  max: 100,
  guardRate: 64,
  camRate: 54,
  heardRate: 8,
  drain: 16,
};

/** Standing in a shadow tile shrinks every watcher's sight by this factor. */
export const SHADOW_FACTOR = 0.55;

/** Palette, named for what each colour paints. */
export const PAINT = {
  backdrop: '#0a0d13',
  frame: '#10141d',
  floorA: '#232a3c',
  floorB: '#272f45',
  gridLine: '#181e2c',
  shadow: '#141a29',
  wall: '#495878',
  wallEdge: '#6b7ca3',
  crate: '#8a6b3f',
  crateEdge: '#ab8851',
  door: '#c47b2d',
  doorOpen: '#2f4d3a',
  exit: '#2fae5f',
  exitShut: '#5c6a72',
  key: '#ffd94d',
  padOn: '#39d98a',
  padOff: '#e05252',
  core: '#b78cff',
  thief: '#57e6d9',
  thiefSneak: '#2f8f86',
  guard: '#e05252',
  camBody: '#d9d9e0',
  cone: 'rgba(255, 190, 60, ',
  coneHot: 'rgba(255, 70, 50, ',
  coneCam: 'rgba(120, 200, 255, ',
  text: '#e8ecf4',
  dim: '#9aa5bb',
  alarm: '#ff5147',
  alarmLow: '#ffb03a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
