// SHADOW SHIFT — the five nights. Each level is a tile map plus the patrols
// that walk it. Map legend:
//   # wall        . floor       s shadow floor (halves a watcher's sight range)
//   P player start   E exit     K keycard   W floor switch   C data core
//   + doorway floor (drawn as floor; only marks a gap in a wall)
// Guard paths are tile coordinates; a guard walks the list in order, pauses
// and scans at each post, then moves on. Cameras sit on a tile and sweep a
// cone around a base facing. Every waypoint and camera tile is floor.
import { TILE, FIELD_X, FIELD_Y } from './config.js';

const px = (tx, ty) => ({ x: FIELD_X + tx * TILE + TILE / 2, y: FIELD_Y + ty * TILE + TILE / 2 });

export const LEVELS = [
  {
    name: 'Night 1 — First Night',
    hint: 'Take the keycard, then slip out the exit.',
    objective: 'keycard',
    map: [
      '########################',
      '#P......#......#.......#',
      '#.......#..s...#...K...#',
      '#..s....#......#.......#',
      '#.......#......#...#...#',
      '#.......+......+...#...#',
      '#.......#..s...#...#...#',
      '#..s....#......#.......#',
      '#.......#......#...#...#',
      '#.......+......+...#...#',
      '#.......#......#.......#',
      '#..s.......s.......#..E#',
      '#......................#',
      '########################',
    ],
    guards: [
      { path: [[11, 2], [11, 10]], pause: 1.2 },
      { path: [[17, 2], [17, 9]], pause: 1.4 },
    ],
    cameras: [],
  },
  {
    name: 'Night 2 — Crossed Wires',
    hint: 'Three patrols cross the hall. Time the gaps.',
    objective: 'keycard',
    map: [
      '########################',
      '#P....#.....#.....#..K.#',
      '#.....#..s..#..s..#....#',
      '#.....#.....#.....#....#',
      '#.....+.....+.....+....#',
      '#.....#..s..#..s..#..s.#',
      '#.....#.....#.....#....#',
      '#.......s.......s......#',
      '#.....#.....#.....#....#',
      '#..s..+.....+..s..+....#',
      '#.....#.....#.....#....#',
      '#.....#..s..#..s..#..E.#',
      '#......................#',
      '########################',
    ],
    guards: [
      { path: [[3, 2], [3, 11]], pause: 1.0 },
      { path: [[9, 1], [9, 12]], pause: 1.3 },
      { path: [[15, 2], [15, 11]], pause: 1.1 },
    ],
    cameras: [],
  },
  {
    name: 'Night 3 — Glass Eye',
    hint: 'Flip the floor switch: it kills the cameras and opens the door.',
    objective: 'switch',
    map: [
      '########################',
      '#P......#......#.......#',
      '#...s...#..s...#...s...#',
      '#.......#......#.......#',
      '#.......#......#.......#',
      '#...s...+......+...s...#',
      '#.......#......#.......#',
      '#.......#..W...#.......#',
      '#...s...#......#...s...#',
      '#.......#......#.......#',
      '#.......#......#.......#',
      '#...s.......s......#..E#',
      '#......................#',
      '########################',
    ],
    guards: [
      { path: [[5, 2], [5, 11]], pause: 1.2 },
      { path: [[18, 2], [18, 11]], pause: 1.2 },
    ],
    cameras: [
      { tile: [12, 1], base: Math.PI / 2, sweep: 0.7, speed: 0.45 },
      { tile: [12, 12], base: -Math.PI / 2, sweep: 0.7, speed: 0.55 },
    ],
  },
  {
    name: 'Night 4 — Lockdown',
    hint: 'Four guards, one camera, no easy route.',
    objective: 'keycard',
    map: [
      '########################',
      '#P..#.....#....#....#K.#',
      '#...#..s..#..s.#.s..#..#',
      '#...#.....#....#....#..#',
      '#...+.....+....+....+..#',
      '#...#..s..#..s.#.s..#..#',
      '#...#.....#....#....#..#',
      '#..s....s.....s.....s..#',
      '#...#.....#....#....#..#',
      '#...#..s..#..s.#.s..#..#',
      '#...#.....#....#....#..#',
      '#...#.....#....#....#E.#',
      '#......................#',
      '########################',
    ],
    guards: [
      { path: [[2, 1], [2, 12]], pause: 1.0 },
      { path: [[7, 2], [7, 11]], pause: 1.2 },
      { path: [[13, 2], [13, 11]], pause: 1.1 },
      { path: [[18, 1], [18, 12]], pause: 1.3 },
    ],
    cameras: [
      { tile: [12, 1], base: Math.PI / 2, sweep: 0.8, speed: 0.5 },
    ],
  },
  {
    name: 'Night 5 — The Vault',
    hint: 'Steal the data core from the vault. Then run.',
    objective: 'core',
    map: [
      '########################',
      '#P....#.....#.....#....#',
      '#..s..#..s..#..s..#..C.#',
      '#.....#.....#.....#....#',
      '#.....+.....+.....+....#',
      '#..s..#..s..#..s..#....#',
      '#.....#.....#.....#....#',
      '#.....#.....#.....#..#.#',
      '#..s..#.....#.....#....#',
      '#.....#..s..#..s..#..s.#',
      '#.....#.....#.....#....#',
      '#.....+.....+.....+..E.#',
      '#......................#',
      '########################',
    ],
    guards: [
      { path: [[3, 1], [3, 12]], pause: 1.0 },
      { path: [[9, 2], [9, 11]], pause: 1.2 },
      { path: [[15, 2], [15, 11]], pause: 1.1 },
      { path: [[20, 4], [20, 12]], pause: 1.4 },
    ],
    cameras: [
      { tile: [9, 1], base: Math.PI / 2, sweep: 0.7, speed: 0.5 },
      { tile: [12, 12], base: -Math.PI / 2, sweep: 0.7, speed: 0.6 },
    ],
  },
];

/** Turn a level definition into the lookup tables the simulation walks. */
export function parseLevel(def) {
  const walls = new Set();
  const shadows = new Set();
  const found = { player: null, exit: null, objective: null };
  def.map.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx += 1) {
      const ch = row[tx];
      const key = `${tx},${ty}`;
      if (ch === '#') walls.add(key);
      if (ch === 's') shadows.add(key);
      if (ch === 'P') found.player = px(tx, ty);
      if (ch === 'E') found.exit = px(tx, ty);
      if (ch === 'K' || ch === 'W' || ch === 'C') {
        found.objective = { type: ch === 'K' ? 'keycard' : ch === 'W' ? 'switch' : 'core', ...px(tx, ty) };
      }
    }
  });
  return { walls, shadows, ...found };
}

/** Pixel position of a tile centre. Exported for the screenshot staging. */
export function tileCentre(tx, ty) {
  return px(tx, ty);
}
