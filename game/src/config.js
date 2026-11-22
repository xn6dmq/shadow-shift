// SHADOW SHIFT — shared tuning numbers. One place for every speed, range and
// rate the simulation uses, so a balance tweak never means hunting through files.
export const TILE = 48;
export const COLS = 24;
export const ROWS = 14;
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const FIELD_X = 64;
export const FIELD_Y = 48;

export const PLAYER_R = 13;
export const SPEEDS = {
  walk: 172,
  sneak: 88,
  guard: 76,
};

export const VIEW = {
  guardRange: 268,
  guardHalf: 0.6,
  cameraRange: 300,
  cameraHalf: 0.42,
  shadowFactor: 0.5,
};

export const ALARM = {
  rise: 42,
  riseClose: 72,
  closeDist: 130,
  drain: 38,
};

export const NOISE = {
  walk: 132,
  sneak: 38,
  hear: 150,
};

export const STEP = 1 / 30;
