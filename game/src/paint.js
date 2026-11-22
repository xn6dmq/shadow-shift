// SHADOW SHIFT — everything the eye sees. One function per layer so a frame
// is floor, then cones, then things, then the HUD, then the screen overlay.
import { TILE, COLS, ROWS, FIELD_X, FIELD_Y, CANVAS_W, CANVAS_H, PLAYER_R, VIEW } from './config.js';

const FLOOR = '#1b2334';
const SHADOW = '#0e1420';
const WALL = '#2d3a52';
const WALL_TOP = '#42547a';
const CONE = 'rgba(255, 196, 66, 0.20)';
const CONE_HOT = 'rgba(255, 64, 64, 0.30)';
const CONE_EDGE = 'rgba(255, 196, 66, 0.45)';

function fmtTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(1, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function drawCone(ctx, w) {
  const grad = ctx.createRadialGradient(w.x, w.y, 10, w.x, w.y, w.range);
  const hot = w.alerted;
  grad.addColorStop(0, hot ? CONE_HOT : CONE);
  grad.addColorStop(1, 'rgba(255, 196, 66, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w.x, w.y);
  ctx.arc(w.x, w.y, w.range, w.facing - w.half, w.facing + w.half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hot ? 'rgba(255, 90, 90, 0.55)' : CONE_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w.x, w.y);
  ctx.arc(w.x, w.y, w.range, w.facing - w.half, w.facing + w.half);
  ctx.closePath();
  ctx.stroke();
}

function drawWorld(ctx, world) {
  // floor and shadow patches
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      if (world.isWallTile(tx, ty)) continue;
      const x = FIELD_X + tx * TILE;
      const y = FIELD_Y + ty * TILE;
      ctx.fillStyle = world.shadows.has(`${tx},${ty}`) ? SHADOW : FLOOR;
      ctx.fillRect(x, y, TILE, TILE);
      if (world.shadows.has(`${tx},${ty}`)) {
        ctx.fillStyle = 'rgba(120, 160, 255, 0.10)';
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    }
  }
  // walls, with a lit top edge so the rooms read as rooms
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      if (!world.isWallTile(tx, ty)) continue;
      const x = FIELD_X + tx * TILE;
      const y = FIELD_Y + ty * TILE;
      ctx.fillStyle = WALL;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = WALL_TOP;
      ctx.fillRect(x, y, TILE, 5);
    }
  }

  // objective
  const o = world.objective;
  if (!world.objectiveDone) {
    if (o.type === 'keycard') {
      ctx.fillStyle = '#f5c542';
      ctx.fillRect(o.x - 11, o.y - 7, 22, 14);
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(o.x - 11, o.y - 7, 22, 4);
      ctx.fillStyle = '#1b2334';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KEY', o.x, o.y + 4);
    } else if (o.type === 'switch') {
      ctx.fillStyle = '#3d5a3d';
      ctx.fillRect(o.x - 12, o.y - 12, 24, 24);
      ctx.fillStyle = '#7ee787';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulse = 6 + Math.sin(world.time * 3) * 2;
      ctx.fillStyle = 'rgba(64, 224, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(o.x, o.y, pulse + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#40e0ff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0e14';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    const label = o.type === 'keycard' ? 'KEYCARD' : o.type === 'switch' ? 'SWITCH' : 'DATA CORE';
    ctx.fillText(label, o.x, o.y - 20);
  }

  // exit door
  const e = world.exit;
  ctx.fillStyle = world.exitOpen ? '#2ea043' : '#8b2f2f';
  ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
  ctx.fillStyle = world.exitOpen ? '#7ee787' : '#ff7b72';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(world.exitOpen ? 'EXIT' : 'LOCKED', e.x, e.y + 4);
  if (world.exitOpen) {
    ctx.strokeStyle = 'rgba(126, 231, 135, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x - 19, e.y - 19, 38, 38);
  }

  // vision cones, under the things that cast them
  for (const w of world.watchers()) drawCone(ctx, w);

  // cameras
  for (const c of world.cameras) {
    if (world.camerasOff) {
      ctx.fillStyle = '#555';
    } else {
      ctx.fillStyle = '#c9d1d9';
    }
    ctx.fillRect(c.x - 7, c.y - 7, 14, 14);
    ctx.fillStyle = world.camerasOff ? '#333' : '#ff4444';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // guards
  for (const g of world.guards) {
    ctx.fillStyle = '#232d42';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b98b8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * 16, g.y + Math.sin(g.facing) * 16);
    ctx.stroke();
    if (g.alertT > 0) {
      ctx.fillStyle = '#ffdf5a';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    }
  }

  // the player: a hooded thief, teal against the dark floor
  const p = world.player;
  ctx.fillStyle = '#2dd4bf';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, world, levelName, totalTime, screen) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, FIELD_Y);
  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(levelName, 16, 24);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#8b98b8';
  const objLabel = world.objectiveDone ? 'Objective done — reach the EXIT' : `Find the ${world.objective.type.toUpperCase()}`;
  ctx.fillText(objLabel, 16, 42);
  // alarm meter
  const mx = 620;
  const mw = 300;
  ctx.fillStyle = '#30363d';
  ctx.fillRect(mx, 14, mw, 14);
  ctx.fillStyle = world.alarm > 66 ? '#ff4444' : world.alarm > 33 ? '#ffaa33' : '#f5c542';
  ctx.fillRect(mx, 14, (mw * world.alarm) / 100, 14);
  ctx.strokeStyle = '#8b98b8';
  ctx.strokeRect(mx + 0.5, 14.5, mw, 14);
  ctx.fillStyle = '#e6edf3';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', mx - 58, 26);
  ctx.textAlign = 'right';
  // On the win screen the run is over: the clock shows the final total, not
  // the staged level's extra seconds.
  const shown = screen === 'win' ? totalTime : totalTime + world.time;
  ctx.fillText(`TIME ${fmtTime(shown)}`, CANVAS_W - 16, 26);
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 8, 14, 0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_W / 2, 250);
  ctx.fillStyle = '#e6edf3';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, 310 + i * 30);
  });
  ctx.textAlign = 'left';
}

export function render(ctx, game) {
  const { world } = game;
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawWorld(ctx, world);
  drawHud(ctx, world, game.levelDef.name, game.totalTime, game.screen);
  if (game.screen === 'title') {
    overlay(ctx, 'SHADOW SHIFT', [
      'A top-down stealth game — stay out of the cones.',
      'WASD / arrows to move · Shift to sneak · P to pause',
      'Take the objective, then reach the EXIT unseen.',
      '',
      'Press ENTER to begin Night 1',
    ], '#2dd4bf');
  } else if (game.screen === 'pause') {
    overlay(ctx, 'PAUSED', ['Press P to keep sneaking.'], '#e6edf3');
  } else if (game.screen === 'caught') {
    overlay(ctx, 'SPOTTED!', ['The alarm hit full and the night restarts.', 'Press R to try the night again.'], '#ff5a5a');
  } else if (game.screen === 'clear') {
    overlay(ctx, 'NIGHT CLEAR', [
      `${game.levelDef.name} — ${fmtTime(world.time)}`,
      'Press ENTER for the next night.',
    ], '#7ee787');
  } else if (game.screen === 'win') {
    overlay(ctx, 'ALL NIGHTS COMPLETE', [
      `Total time ${fmtTime(game.totalTime)} — the vault is empty and nobody saw a thing.`,
      'Press R to run it all again.',
    ], '#2dd4bf');
  }
}

export { fmtTime };
