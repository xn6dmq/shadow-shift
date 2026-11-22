// SHADOW SHIFT — the screenshot scenes behind ?shot=start|play|end. Each one
// plays the real rules forward from a fresh level for a fixed number of
// steps, steered by an autopilot that pathfinds to the objective on the tile
// grid (a greedy walk gets stuck behind the first wall) and charges extra
// for tiles a watcher can see, so it slips around cones instead of through
// them. No randomness anywhere in the sim, so the same scene always gives
// the same frame.
import { STEP, TILE, FIELD_X, FIELD_Y, COLS, ROWS } from './config.js';
import { World } from './sim.js';

function tileOf(x, y) {
  return {
    tx: Math.floor((x - FIELD_X) / TILE),
    ty: Math.floor((y - FIELD_Y) / TILE),
  };
}

function tileCentre(tx, ty) {
  return { x: FIELD_X + tx * TILE + TILE / 2, y: FIELD_Y + ty * TILE + TILE / 2 };
}

/**
 * Cheapest route over the tile grid from the player to (tx, ty). A step
 * costs 1; a tile a watcher can see right now costs 11, and one a guard
 * stands close to costs 7, so the route bends around cones when it can and
 * only crosses one when it must. Returns pixel centres, start excluded.
 */
function planPath(world, tx, ty) {
  const start = tileOf(world.player.x, world.player.y);
  const key = (x, y) => `${x},${y}`;
  const cost = new Map([[key(start.tx, start.ty), 0]]);
  const prev = new Map();
  const open = [[0, start.tx, start.ty]];
  const watchers = world.watchers();
  const seenCache = new Map();
  const seenAt = (x, y) => {
    const k = key(x, y);
    if (!seenCache.has(k)) {
      const c = tileCentre(x, y);
      let seen = false;
      for (const w of watchers) {
        if (world.seesFrom(w, c.x, c.y)) { seen = true; break; }
      }
      seenCache.set(k, seen);
    }
    return seenCache.get(k);
  };
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [c, x, y] = open.shift();
    if (c !== cost.get(key(x, y))) continue;
    if (x === tx && y === ty) {
      const path = [];
      let cur = key(x, y);
      while (cur !== key(start.tx, start.ty)) {
        const [px, py] = cur.split(',').map(Number);
        path.unshift(tileCentre(px, py));
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (world.isWallTile(nx, ny)) continue;
      let step = 1;
      if (seenAt(nx, ny)) step += 10;
      for (const g of world.guards) {
        const gt = tileOf(g.x, g.y);
        if (Math.abs(gt.tx - nx) + Math.abs(gt.ty - ny) <= 1) step += 6;
      }
      const nc = c + step;
      if (nc < (cost.get(key(nx, ny)) ?? Infinity)) {
        cost.set(key(nx, ny), nc);
        prev.set(key(nx, ny), key(x, y));
        open.push([nc, nx, ny]);
      }
    }
  }
  return [];
}

/** One autopilot step: follow the planned route, sneaking all the way. */
export function autopilot(world) {
  const seenAtPoint = (x, y) => {
    for (const w of world.watchers()) {
      if (world.seesFrom(w, x, y)) return true;
    }
    return false;
  };
  // Spotted right now: break for the nearest tile no watcher can see,
  // found by flood fill so the escape is a real route, not a 10px guess.
  if (seenAtPoint(world.player.x, world.player.y)) {
    const start = tileOf(world.player.x, world.player.y);
    const seenTile = new Set();
    const queue = [[start.tx, start.ty]];
    seenTile.add(`${start.tx},${start.ty}`);
    let escape = null;
    while (queue.length > 0 && !escape) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const k = `${nx},${ny}`;
        if (seenTile.has(k) || world.isWallTile(nx, ny)) continue;
        seenTile.add(k);
        const c = tileCentre(nx, ny);
        if (!seenAtPoint(c.x, c.y)) {
          escape = c;
          break;
        }
        queue.push([nx, ny]);
      }
    }
    if (escape) {
      const dx = escape.x - world.player.x;
      const dy = escape.y - world.player.y;
      const len = Math.hypot(dx, dy);
      if (len < 6) return { mx: 0, my: 0, sneak: true };
      return { mx: dx / len, my: dy / len, sneak: true };
    }
    return { mx: 0, my: 0, sneak: true };
  }
  const target = world.objectiveDone ? world.exit : world.objective;
  const t = tileOf(target.x, target.y);
  const path = planPath(world, t.tx, t.ty);
  const next = path.length > 0 ? path[0] : target;
  // The next tile is covered: wait for the patrol to pass, like a player would.
  if (path.length > 0 && seenAtPoint(next.x, next.y)) {
    return { mx: 0, my: 0, sneak: true };
  }
  const dx = next.x - world.player.x;
  const dy = next.y - world.player.y;
  const len = Math.hypot(dx, dy);
  if (len < 6) return { mx: 0, my: 0, sneak: true };
  return { mx: dx / len, my: dy / len, sneak: true };
}

function runSteps(world, seconds, steer) {
  const count = Math.floor(seconds / STEP);
  for (let i = 0; i < count; i += 1) {
    if (world.caught || world.cleared) break;
    world.step(STEP, steer(world));
  }
}

/**
 * Stage `name` on a fresh game: start shows the title over a live Night 1,
 * play shows a mid-level Night 3 with the alarm part-filled, end shows the
 * win screen. Returns the screen to draw.
 */
export function stageShot(name, game) {
  if (name === 'play') {
    game.loadLevel(2);
    runSteps(game.world, 12, autopilot);
    // Lean into the nearest cone until the alarm reads clearly on the meter.
    let nearest = game.world.guards[0];
    for (const g of game.world.guards) {
      if (Math.hypot(g.x - game.world.player.x, g.y - game.world.player.y)
        < Math.hypot(nearest.x - game.world.player.x, nearest.y - game.world.player.y)) nearest = g;
    }
    for (let i = 0; i < Math.floor(4 / STEP) && game.world.alarm < 34; i += 1) {
      const dx = nearest.x - game.world.player.x;
      const dy = nearest.y - game.world.player.y;
      const len = Math.hypot(dx, dy) || 1;
      game.world.step(STEP, { mx: dx / len, my: dy / len, sneak: false });
      if (game.world.caught) break;
    }
    return 'play';
  }
  if (name === 'end') {
    game.loadLevel(4);
    runSteps(game.world, 10, autopilot);
    game.totalTime = 247;
    return 'win';
  }
  game.loadLevel(0);
  runSteps(game.world, 4, autopilot);
  return 'title';
}
