// The rules of SHADOW SHIFT, with no drawing and no browser in it: the tile
// grid, the infiltrator, patrolling guards with vision cones, sweeping
// cameras, noise, shadow patches, and the alarm meter that decides whether a
// night ends at the exit or in handcuffs. tick() advances one fixed step and
// returns what happened as bit flags, so the caller can react (screens, sound)
// without the sim knowing about either. Patrols and sweeps run on elapsed
// time, never on chance, so the simulation is deterministic.

import { ALARM, CAM, DT, FLOOR, GUARD, SHADOW_FACTOR, THIEF, TILE } from './config.js';
import { LEVELS } from './levels.js';

export const FLAG_SPOTTED = 1;
export const FLAG_CAUGHT = 2;
export const FLAG_OBJECTIVE = 4;
export const FLAG_CLEAR = 8;
export const FLAG_STEP = 16;

const RAY_STEP = 0.055;
const SIGHT_SAMPLE = 6;

/** Centre of a tile, in stage pixels. */
export function tileCentre(tx, ty) {
  return { x: FLOOR.x + tx * TILE + TILE / 2, y: FLOOR.y + ty * TILE + TILE / 2 };
}

function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function turnToward(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

export function createSim() {
  const s = {
    night: 0,
    nightName: '',
    brief: '',
    goal: 'keycard',
    grid: [],
    thief: { x: 0, y: 0, sneak: false, moving: false, noise: 0, face: 0 },
    guards: [],
    cams: [],
    alarm: 0,
    goalDone: false,
    doorsOpen: false,
    exit: { x: 0, y: 0 },
    keycard: null,
    pad: null,
    core: null,
    clock: 0,
    nightClock: 0,
    totalClock: 0,
    closestGuard: Infinity,
    beingSeen: false,
  };

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || ty >= s.grid.length || tx >= s.grid[0].length) return '#';
    return s.grid[ty][tx];
  }

  function blocksSight(tx, ty) {
    const t = tileAt(tx, ty);
    if (t === '#' || t === 'B') return true;
    if (t === 'D' && !s.doorsOpen) return true;
    return false;
  }

  function solidPixel(x, y) {
    return blocksSight(Math.floor((x - FLOOR.x) / TILE), Math.floor((y - FLOOR.y) / TILE));
  }

  function inShadow(x, y) {
    return tileAt(Math.floor((x - FLOOR.x) / TILE), Math.floor((y - FLOOR.y) / TILE)) === 's';
  }

  /** True when the straight line between two points crosses no solid tile. */
  function hasLine(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / SIGHT_SAMPLE));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (solidPixel(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  /**
   * How strongly a watcher at (x, y) facing `angle` sees the thief: 0 out of
   * range, outside the cone or behind cover; otherwise stronger the closer
   * the thief is. A thief in shadow counts as much farther away.
   */
  function sightStrength(x, y, angle, range, halfAngle) {
    const dx = s.thief.x - x;
    const dy = s.thief.y - y;
    const dist = Math.hypot(dx, dy);
    const reach = inShadow(s.thief.x, s.thief.y) ? range * SHADOW_FACTOR : range;
    if (dist > reach) return 0;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - angle)) > halfAngle) return 0;
    if (!hasLine(x, y, s.thief.x, s.thief.y)) return 0;
    return 1 - (dist / reach) * 0.55;
  }

  /** The visible cone as a polygon: a fan of rays, each marched to cover. */
  function coneShape(x, y, angle, range, halfAngle) {
    const pts = [{ x, y }];
    for (let a = -halfAngle; a <= halfAngle + 0.001; a += RAY_STEP) {
      const ra = angle + a;
      const cx = Math.cos(ra);
      const sy = Math.sin(ra);
      let dist = range;
      for (let d = SIGHT_SAMPLE; d < range; d += SIGHT_SAMPLE) {
        if (solidPixel(x + cx * d, y + sy * d)) {
          dist = d;
          break;
        }
      }
      pts.push({ x: x + cx * dist, y: y + sy * dist });
    }
    return pts;
  }

  /** Move a circle by (dx, dy), sliding along solid tiles axis by axis. */
  function slide(body, radius, dx, dy) {
    body.x += dx;
    let x0 = Math.floor((body.x - radius - FLOOR.x) / TILE);
    let x1 = Math.floor((body.x + radius - FLOOR.x) / TILE);
    let y0 = Math.floor((body.y - radius - FLOOR.y) / TILE);
    let y1 = Math.floor((body.y + radius - FLOOR.y) / TILE);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (!blocksSight(tx, ty)) continue;
        const left = FLOOR.x + tx * TILE;
        if (dx > 0) body.x = Math.min(body.x, left - radius - 0.01);
        else if (dx < 0) body.x = Math.max(body.x, left + TILE + radius + 0.01);
      }
    }
    body.y += dy;
    x0 = Math.floor((body.x - radius - FLOOR.x) / TILE);
    x1 = Math.floor((body.x + radius - FLOOR.x) / TILE);
    y0 = Math.floor((body.y - radius - FLOOR.y) / TILE);
    y1 = Math.floor((body.y + radius - FLOOR.y) / TILE);
    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (!blocksSight(tx, ty)) continue;
        const top = FLOOR.y + ty * TILE;
        if (dy > 0) body.y = Math.min(body.y, top - radius - 0.01);
        else if (dy < 0) body.y = Math.max(body.y, top + TILE + radius + 0.01);
      }
    }
  }

  function loadNight(index) {
    const level = LEVELS[index];
    s.night = index;
    s.nightName = level.name;
    s.brief = level.brief;
    s.goal = level.objective;
    s.grid = level.map.map((row) => row.split(''));
    s.alarm = 0;
    s.goalDone = false;
    s.doorsOpen = false;
    s.clock = 0;
    s.nightClock = 0;
    s.beingSeen = false;
    s.keycard = null;
    s.pad = null;
    s.core = null;

    for (let ty = 0; ty < s.grid.length; ty += 1) {
      for (let tx = 0; tx < s.grid[ty].length; tx += 1) {
        const c = tileCentre(tx, ty);
        const t = s.grid[ty][tx];
        if (t === 'P') {
          s.thief.x = c.x;
          s.thief.y = c.y;
        } else if (t === 'E') s.exit = c;
        else if (t === 'K') s.keycard = { x: c.x, y: c.y, taken: false };
        else if (t === 'S') s.pad = { x: c.x, y: c.y, pressed: false };
        else if (t === 'C') s.core = { x: c.x, y: c.y, taken: false };
      }
    }
    s.thief.sneak = false;
    s.thief.moving = false;
    s.thief.noise = 0;

    s.guards = level.guards.map((def) => {
      const start = tileCentre(def.path[0][0], def.path[0][1]);
      const next = tileCentre(def.path[1][0], def.path[1][1]);
      const heading = Math.atan2(next.y - start.y, next.x - start.x);
      return {
        x: start.x,
        y: start.y,
        angle: heading,
        scanBase: heading,
        route: def.path.map(([tx, ty]) => tileCentre(tx, ty)),
        leg: 1,
        pause: def.wait,
        pauseLeft: 0,
        walking: true,
        suspicion: 0,
        seeing: 0,
        listening: false,
        listenLeft: 0,
        stepPhase: 0,
        cone: [],
      };
    });

    s.cams = level.cameras.map((def) => {
      const c = tileCentre(def.at[0], def.at[1]);
      return {
        x: c.x, y: c.y,
        base: def.base, sweep: def.sweep, speed: def.speed, phase: def.phase,
        angle: def.base, seeing: 0, dead: false, cone: [],
      };
    });
  }

  function freshRun() {
    s.totalClock = 0;
    loadNight(0);
  }

  function updateGuard(g, dt) {
    let flags = 0;
    const thief = s.thief;

    // Hearing: a walking thief is loud; a sneaking one barely whispers.
    const distToThief = Math.hypot(thief.x - g.x, thief.y - g.y);
    if (thief.noise > 0 && distToThief < thief.noise + GUARD.radius) {
      g.listening = true;
      g.listenLeft = GUARD.hearFor;
    } else if (g.listenLeft > 0) {
      g.listenLeft -= dt;
      if (g.listenLeft <= 0) g.listening = false;
    }

    if (g.listening) {
      g.angle = turnToward(g.angle, Math.atan2(thief.y - g.y, thief.x - g.x), GUARD.turn * dt);
    } else if (!g.walking) {
      g.pauseLeft -= dt;
      const waited = g.pause - g.pauseLeft;
      g.angle = g.scanBase + Math.sin(waited * GUARD.scanRate * 2.2) * GUARD.scanSwing;
      if (g.pauseLeft <= 0) g.walking = true;
    } else {
      const target = g.route[g.leg];
      const dx = target.x - g.x;
      const dy = target.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        g.leg = (g.leg + 1) % g.route.length;
        const next = g.route[g.leg];
        g.scanBase = Math.atan2(next.y - g.y, next.x - g.x);
        g.walking = false;
        g.pauseLeft = g.pause;
      } else {
        const heading = Math.atan2(dy, dx);
        g.angle = turnToward(g.angle, heading, GUARD.turn * dt);
        const facing = Math.cos(wrapAngle(heading - g.angle));
        if (facing > 0.25) {
          const len = GUARD.patrol * facing * dt;
          slide(g, GUARD.radius, (dx / dist) * len, (dy / dist) * len);
          g.stepPhase += dt * 3.4;
          if (g.stepPhase >= 1) {
            g.stepPhase = 0;
            if (distToThief < 330) flags |= FLAG_STEP;
          }
        }
      }
    }

    g.seeing = sightStrength(g.x, g.y, g.angle, GUARD.sight, GUARD.halfCone);
    if (g.seeing > 0) g.suspicion = Math.min(1, g.suspicion + g.seeing * dt * 1.7);
    else g.suspicion = Math.max(0, g.suspicion - dt * 0.55);
    g.cone = coneShape(g.x, g.y, g.angle, GUARD.sight, GUARD.halfCone);
    return flags;
  }

  function updateCam(cam) {
    cam.angle = cam.base + Math.sin(s.clock * cam.speed + cam.phase) * cam.sweep;
    cam.dead = s.goal === 'switch' && s.goalDone;
    cam.seeing = cam.dead
      ? 0
      : sightStrength(cam.x, cam.y, cam.angle, CAM.sight, CAM.halfCone);
    cam.cone = cam.dead ? [] : coneShape(cam.x, cam.y, cam.angle, CAM.sight, CAM.halfCone);
  }

  /**
   * One fixed step. `move` is the input vector (axes -1..1), `sneak` the Shift
   * state. With `ghost` set (the title screen's backdrop) patrols walk and
   * cones sweep, but nobody is seen, heard or caught and no objective can
   * complete.
   */
  function tick(dt, move, sneak, ghost) {
    let flags = 0;
    s.clock += dt;
    const thief = s.thief;

    if (!ghost) {
      s.nightClock += dt;
      s.totalClock += dt;
      const len = Math.hypot(move.x, move.y);
      thief.moving = len > 0;
      thief.sneak = sneak;
      if (thief.moving) {
        const speed = sneak ? THIEF.sneak : THIEF.walk;
        const nx = (move.x / (len || 1)) * speed * dt;
        const ny = (move.y / (len || 1)) * speed * dt;
        slide(thief, THIEF.radius, nx, ny);
        thief.face = Math.atan2(move.y, move.x);
      }
      thief.noise = thief.moving ? (sneak ? THIEF.quiet : THIEF.loud) : 0;
    }

    s.closestGuard = Infinity;
    for (const g of s.guards) {
      flags |= updateGuard(g, dt);
      const d = Math.hypot(thief.x - g.x, thief.y - g.y);
      if (d < s.closestGuard) s.closestGuard = d;
    }
    for (const cam of s.cams) updateCam(cam);

    if (ghost) return flags;

    // Detection: the strongest watcher drives the alarm; a heard noise adds a trickle.
    let guardSeen = 0;
    let camSeen = 0;
    let heard = false;
    for (const g of s.guards) {
      if (g.seeing > guardSeen) guardSeen = g.seeing;
      if (g.listening) heard = true;
    }
    for (const cam of s.cams) if (cam.seeing > camSeen) camSeen = cam.seeing;
    const seen = guardSeen > 0 || camSeen > 0;
    if (seen && !s.beingSeen) flags |= FLAG_SPOTTED;
    s.beingSeen = seen;

    if (seen) {
      s.alarm += Math.max(ALARM.guardRate * guardSeen, ALARM.camRate * camSeen) * dt;
    } else if (heard) {
      s.alarm += ALARM.heardRate * dt;
    } else {
      s.alarm -= ALARM.drain * dt;
    }
    s.alarm = Math.min(ALARM.max, Math.max(0, s.alarm));
    if (s.alarm >= ALARM.max) {
      flags |= FLAG_CAUGHT;
      return flags;
    }

    // Objectives: keycard and core are taken by touch; the switch by standing on it.
    if (!s.goalDone && s.keycard !== null && !s.keycard.taken) {
      if (Math.hypot(thief.x - s.keycard.x, thief.y - s.keycard.y) < 26) {
        s.keycard.taken = true;
        s.goalDone = true;
        s.doorsOpen = true;
        flags |= FLAG_OBJECTIVE;
      }
    }
    if (!s.goalDone && s.pad !== null && !s.pad.pressed) {
      if (Math.hypot(thief.x - s.pad.x, thief.y - s.pad.y) < 20) {
        s.pad.pressed = true;
        s.goalDone = true;
        s.doorsOpen = true;
        flags |= FLAG_OBJECTIVE;
      }
    }
    if (!s.goalDone && s.core !== null && !s.core.taken) {
      if (Math.hypot(thief.x - s.core.x, thief.y - s.core.y) < 26) {
        s.core.taken = true;
        s.goalDone = true;
        s.doorsOpen = true;
        flags |= FLAG_OBJECTIVE;
      }
    }

    // The exit only counts once the objective is done.
    if (s.goalDone && Math.hypot(thief.x - s.exit.x, thief.y - s.exit.y) < 22) {
      flags |= FLAG_CLEAR;
    }
    return flags;
  }

  loadNight(0);
  return { state: s, loadNight, freshRun, tick, nights: LEVELS.length, step: DT };
}
