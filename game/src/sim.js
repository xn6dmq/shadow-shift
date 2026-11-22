// SHADOW SHIFT — the simulation. A World holds one level's live state: the
// player, the patrols, the cameras, the alarm meter and the objective. It
// knows nothing about drawing or sound; step() returns the events the frame
// produced so the shell can answer them (footsteps, stings, pickups).
import { TILE, FIELD_X, FIELD_Y, COLS, ROWS, PLAYER_R, SPEEDS, VIEW, ALARM, NOISE, STEP } from './config.js';
import { LEVELS, parseLevel } from './levels.js';

const TAU = Math.PI * 2;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function tileOf(x, y) {
  return {
    tx: Math.floor((x - FIELD_X) / TILE),
    ty: Math.floor((y - FIELD_Y) / TILE),
  };
}

export class World {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.def = LEVELS[levelIndex];
    const parsed = parseLevel(this.def);
    this.walls = parsed.walls;
    this.shadows = parsed.shadows;
    this.start = parsed.player;
    this.exit = parsed.exit;
    this.objective = parsed.objective;
    this.reset();
  }

  reset() {
    this.player = { x: this.start.x, y: this.start.y };
    this.guards = this.def.guards.map((g) => {
      const [sx, sy] = g.path[0];
      const [nx, ny] = g.path[1 % g.path.length];
      return {
        path: g.path.map(([tx, ty]) => ({ x: FIELD_X + tx * TILE + TILE / 2, y: FIELD_Y + ty * TILE + TILE / 2 })),
        wp: 1 % g.path.length,
        x: FIELD_X + sx * TILE + TILE / 2,
        y: FIELD_Y + sy * TILE + TILE / 2,
        pause: g.pause,
        pauseT: 0,
        scanT: 0,
        facing: Math.atan2(ny - sy, nx - sx),
        baseFace: Math.atan2(ny - sy, nx - sx),
        alertT: 0,
        speed: SPEEDS.guard,
      };
    });
    this.cameras = this.def.cameras.map((c) => ({
      x: FIELD_X + c.tile[0] * TILE + TILE / 2,
      y: FIELD_Y + c.tile[1] * TILE + TILE / 2,
      base: c.base,
      sweep: c.sweep,
      speed: c.speed,
      t: 0,
      angle: c.base,
    }));
    this.alarm = 0;
    this.seenStreak = 0;
    this.detected = false;
    this.time = 0;
    this.stepT = 0;
    this.objectiveDone = false;
    this.exitOpen = false;
    this.camerasOff = false;
    this.caught = false;
    this.cleared = false;
    this.events = [];
  }

  isWallTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return this.walls.has(`${tx},${ty}`);
  }

  hitsWall(x, y) {
    const r = PLAYER_R;
    const { tx, ty } = tileOf(x, y);
    for (let oy = ty - 1; oy <= ty + 1; oy += 1) {
      for (let ox = tx - 1; ox <= tx + 1; ox += 1) {
        if (!this.isWallTile(ox, oy)) continue;
        const cx = Math.max(FIELD_X + ox * TILE, Math.min(x, FIELD_X + (ox + 1) * TILE));
        const cy = Math.max(FIELD_Y + oy * TILE, Math.min(y, FIELD_Y + (oy + 1) * TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    }
    return false;
  }

  isShadowAt(x, y) {
    const { tx, ty } = tileOf(x, y);
    return this.shadows.has(`${tx},${ty}`);
  }

  /** Straight line from a watcher to a point: true when no wall crosses it. */
  hasLineOfSight(wx, wy, px, py) {
    const dx = px - wx;
    const dy = py - wy;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i += 1) {
      const { tx, ty } = tileOf(wx + (dx * i) / steps, wy + (dy * i) / steps);
      if (this.isWallTile(tx, ty)) return false;
    }
    return true;
  }

  /**
   * How strongly a watcher (guard or camera) sees the player right now:
   * 0 when out of range, outside the cone or behind a wall; 1 when seen,
   * 1.5 when seen up close. Standing on a shadow tile halves the range.
   */
  seesFrom(watcher, px, py) {
    const dx = px - watcher.x;
    const dy = py - watcher.y;
    const dist = Math.hypot(dx, dy);
    let range = watcher.range;
    if (this.isShadowAt(px, py)) range *= VIEW.shadowFactor;
    if (dist > range) return 0;
    if (Math.abs(angDiff(Math.atan2(dy, dx), watcher.facing)) > watcher.half) return 0;
    if (!this.hasLineOfSight(watcher.x, watcher.y, px, py)) return 0;
    return dist < ALARM.closeDist ? 1.5 : 1;
  }

  watchers() {
    const list = this.guards.map((g) => ({
      x: g.x, y: g.y, facing: g.facing, range: VIEW.guardRange, half: VIEW.guardHalf, alerted: g.alertT > 0, kind: 'guard',
    }));
    if (!this.camerasOff) {
      for (const c of this.cameras) {
        list.push({ x: c.x, y: c.y, facing: c.angle, range: VIEW.cameraRange, half: VIEW.cameraHalf, alerted: false, kind: 'camera' });
      }
    }
    return list;
  }

  step(dt, input) {
    this.events = [];
    if (this.caught || this.cleared) return this.events;
    this.time += dt;

    // --- player movement (axis separated, so walls slide instead of stick)
    const len = Math.hypot(input.mx, input.my) || 1;
    const speed = input.sneak ? SPEEDS.sneak : SPEEDS.walk;
    const vx = (input.mx / len) * speed * dt;
    const vy = (input.my / len) * speed * dt;
    const moving = input.mx !== 0 || input.my !== 0;
    if (moving) {
      if (!this.hitsWall(this.player.x + vx, this.player.y)) this.player.x += vx;
      if (!this.hitsWall(this.player.x, this.player.y + vy)) this.player.y += vy;
      this.stepT += dt;
      const interval = input.sneak ? 0.52 : 0.34;
      if (this.stepT >= interval) {
        this.stepT = 0;
        this.events.push(input.sneak ? 'step-quiet' : 'step');
      }
    }

    // --- guards: patrol, pause and scan, or freeze and face a noise.
    // Only loud (walking) footsteps are heard; sneaking is silent.
    const loud = moving && !input.sneak;
    for (const g of this.guards) {
      if (g.alertT > 0) {
        g.alertT -= dt;
        g.facing = Math.atan2(this.player.y - g.y, this.player.x - g.x);
        continue;
      }
      if (loud) {
        const d = Math.hypot(this.player.x - g.x, this.player.y - g.y);
        if (d < NOISE.hear) {
          g.alertT = 1.5;
          this.events.push('heard');
          continue;
        }
      }
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        g.scanT += dt;
        g.facing = g.baseFace + Math.sin(g.scanT * 1.6) * 0.85;
        continue;
      }
      const target = g.path[g.wp];
      const dx = target.x - g.x;
      const dy = target.y - g.y;
      const dist = Math.hypot(dx, dy);
      const move = g.speed * dt;
      if (dist <= Math.max(move, 3)) {
        g.x = target.x;
        g.y = target.y;
        g.wp = (g.wp + 1) % g.path.length;
        const next = g.path[g.wp];
        g.baseFace = Math.atan2(next.y - g.y, next.x - g.x);
        g.facing = g.baseFace;
        g.pauseT = g.pause;
        g.scanT = 0;
      } else {
        g.x += (dx / dist) * move;
        g.y += (dy / dist) * move;
        g.facing = Math.atan2(dy, dx);
      }
    }

    // --- cameras sweep
    for (const c of this.cameras) {
      c.t += dt;
      c.angle = c.base + Math.sin(c.t * c.speed) * c.sweep;
    }

    // --- alarm: seen anywhere fills it, hiding drains it. A glimpse under
    // a third of a second is forgiven — the watcher has to hold the sight.
    let seen = 0;
    for (const w of this.watchers()) {
      seen = Math.max(seen, this.seesFrom(w, this.player.x, this.player.y));
    }
    if (seen > 0) {
      this.seenStreak += dt;
      if (this.seenStreak > 0.35) {
        this.alarm += dt * (seen > 1 ? ALARM.riseClose : ALARM.rise);
        if (!this.detected) {
          this.detected = true;
          this.events.push('spotted');
        }
      }
    } else {
      this.seenStreak = 0;
      this.detected = false;
      this.alarm -= dt * ALARM.drain;
    }
    this.alarm = Math.max(0, Math.min(100, this.alarm));
    if (this.alarm >= 100) {
      this.caught = true;
      this.events.push('caught');
      return this.events;
    }

    // --- objective, then the exit
    if (!this.objectiveDone) {
      const d = Math.hypot(this.objective.x - this.player.x, this.objective.y - this.player.y);
      if (d < 28) {
        this.objectiveDone = true;
        this.exitOpen = true;
        if (this.objective.type === 'switch') {
          this.camerasOff = true;
          this.events.push('switch');
        } else {
          this.events.push('pickup');
        }
        this.events.push('door');
      }
    }
    if (this.exitOpen) {
      const d = Math.hypot(this.exit.x - this.player.x, this.exit.y - this.player.y);
      if (d < 28) {
        this.cleared = true;
        this.events.push('clear');
      }
    }
    return this.events;
  }
}

export { STEP };
