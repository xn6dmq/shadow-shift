// Drawing only: the sim's state and the current screen in, pixels out. The
// 1280x720 stage is scaled to fit the window and centred. Floors, walls and
// crates are flat tiles; vision cones are translucent fans whose colour warms
// as a watcher's suspicion rises; shadow patches read as dark floor; the HUD
// carries the night, the alarm meter and the clock.

import { ALARM, COLS, FLOOR, FONT, PAINT, ROWS, STAGE, TILE } from './config.js';

export const VIEW_TITLE = 'title';
export const VIEW_PLAY = 'play';
export const VIEW_PAUSED = 'paused';
export const VIEW_CAUGHT = 'caught';
export const VIEW_CLEAR = 'clear';
export const VIEW_DONE = 'done';

export function clockText(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function createPainter(canvas) {
  const ctx = canvas.getContext('2d');
  const fit = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    fit.scale = Math.min(width / STAGE.width, height / STAGE.height);
    fit.x = (width - STAGE.width * fit.scale) / 2;
    fit.y = (height - STAGE.height * fit.scale) / 2;
  }

  const fontCache = new Map();
  function label(value, x, y, size, color, align, weight = '') {
    const key = `${size}${weight}`;
    if (!fontCache.has(key)) fontCache.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fontCache.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function fan(points, fill) {
    if (points.length < 2) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function paintTiles(s) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const x = FLOOR.x + tx * TILE;
        const y = FLOOR.y + ty * TILE;
        const t = s.grid[ty][tx];
        if (t === '#') {
          ctx.fillStyle = PAINT.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PAINT.wallEdge;
          ctx.fillRect(x, y, TILE, 7);
          continue;
        }
        ctx.fillStyle = t === 's' ? PAINT.shadow : ((tx + ty) % 2 === 0 ? PAINT.floorA : PAINT.floorB);
        ctx.fillRect(x, y, TILE, TILE);
        if (t === 'B') {
          ctx.fillStyle = PAINT.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = PAINT.crateEdge;
          ctx.fillRect(x + 3, y + 3, TILE - 6, 6);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 8, y + 8, TILE - 16, TILE - 16);
        } else if (t === 'D') {
          if (s.doorsOpen) {
            ctx.fillStyle = PAINT.doorOpen;
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          } else {
            ctx.fillStyle = PAINT.door;
            ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            for (let bar = 0; bar < 3; bar += 1) ctx.fillRect(x + 8 + bar * 11, y + 5, 4, TILE - 10);
          }
        }
      }
    }
    ctx.strokeStyle = PAINT.gridLine;
    ctx.lineWidth = 1;
    for (let tx = 0; tx <= COLS; tx += 1) {
      ctx.beginPath();
      ctx.moveTo(FLOOR.x + tx * TILE, FLOOR.y);
      ctx.lineTo(FLOOR.x + tx * TILE, FLOOR.y + FLOOR.height);
      ctx.stroke();
    }
    for (let ty = 0; ty <= ROWS; ty += 1) {
      ctx.beginPath();
      ctx.moveTo(FLOOR.x, FLOOR.y + ty * TILE);
      ctx.lineTo(FLOOR.x + FLOOR.width, FLOOR.y + ty * TILE);
      ctx.stroke();
    }
  }

  function paintExit(s) {
    const { x, y } = s.exit;
    const open = s.goalDone;
    ctx.fillStyle = open ? PAINT.exit : PAINT.exitShut;
    ctx.fillRect(x - TILE / 2 + 4, y - TILE / 2 + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = open ? '#7ce8a8' : '#93a1ab';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - TILE / 2 + 7, y - TILE / 2 + 7, TILE - 14, TILE - 14);
    ctx.textBaseline = 'middle';
    label(open ? 'EXIT' : 'LOCK', x, y + 1, 11, '#0a0d13', 'center', '700');
  }

  function paintObjectives(s) {
    if (s.keycard !== null && !s.keycard.taken) {
      const { x, y } = s.keycard;
      const bob = Math.sin(s.clock * 3) * 3;
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(Math.sin(s.clock * 2) * 0.25);
      ctx.fillStyle = PAINT.key;
      ctx.fillRect(-11, -7, 22, 14);
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(-11, -2, 22, 4);
      ctx.beginPath();
      ctx.arc(5, 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (s.pad !== null) {
      const { x, y, pressed } = s.pad;
      ctx.fillStyle = pressed ? PAINT.padOn : PAINT.padOff;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s.core !== null && !s.core.taken) {
      const { x, y } = s.core;
      const pulse = 0.7 + Math.sin(s.clock * 4) * 0.3;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = PAINT.core;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a0d13';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function paintCones(s) {
    for (const cam of s.cams) {
      if (cam.dead) continue;
      const heat = cam.seeing > 0 ? 0.3 : 0.13;
      fan(cam.cone, `${PAINT.coneCam}${heat})`);
    }
    for (const g of s.guards) {
      const heat = 0.13 + g.suspicion * 0.22;
      const ink = g.suspicion > 0.45 ? PAINT.coneHot : PAINT.cone;
      fan(g.cone, `${ink}${heat})`);
    }
  }

  function paintCams(s) {
    for (const cam of s.cams) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.fillStyle = '#12151d';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(cam.angle);
      ctx.fillStyle = cam.dead ? '#565d68' : PAINT.camBody;
      ctx.fillRect(-4, -6, 16, 12);
      ctx.fillStyle = cam.seeing > 0 ? PAINT.alarm : '#39d98a';
      ctx.beginPath();
      ctx.arc(13, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function paintGuards(s) {
    for (const g of s.guards) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(2, 3, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAINT.guard;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(g.angle);
      ctx.fillStyle = '#ffd9d0';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(4, -5.5);
      ctx.lineTo(4, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Suspicion arc over the guard's head: how close they are to raising the alarm.
      if (g.suspicion > 0.02) {
        ctx.strokeStyle = g.suspicion > 0.45 ? PAINT.alarm : PAINT.alarmLow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y - 22, 7, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
        ctx.stroke();
      }
      ctx.textBaseline = 'middle';
      if (g.seeing > 0) label('!', g.x, g.y - 36, 20, PAINT.alarm, 'center', '800');
      else if (g.listening) label('?', g.x, g.y - 36, 17, PAINT.alarmLow, 'center', '800');
    }
  }

  function paintThief(s) {
    const thief = s.thief;
    if (thief.noise > 0) {
      ctx.strokeStyle = 'rgba(87, 230, 217, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, thief.noise, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(thief.x, thief.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(2, 3, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = thief.sneak ? PAINT.thiefSneak : PAINT.thief;
    ctx.beginPath();
    ctx.arc(0, 0, thief.sneak ? 11 : 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0e2a28';
    ctx.beginPath();
    ctx.arc(0, 0, thief.sneak ? 6.5 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(thief.face || 0);
    ctx.fillStyle = '#d8fffa';
    ctx.fillRect(6, -2, 6, 4);
    ctx.restore();
  }

  function paintFloor(s) {
    ctx.fillStyle = PAINT.frame;
    ctx.fillRect(FLOOR.x - 10, FLOOR.y - 10, FLOOR.width + 20, FLOOR.height + 20);
    paintTiles(s);
    paintExit(s);
    paintObjectives(s);
    paintCones(s);
    paintCams(s);
    paintGuards(s);
    paintThief(s);
  }

  function goalLine(s) {
    if (s.goalDone) return 'Objective complete — reach the EXIT';
    if (s.goal === 'keycard') return 'Objective: steal the KEYCARD';
    if (s.goal === 'switch') return 'Objective: hit the floor SWITCH';
    return 'Objective: reach the DATA CORE';
  }

  function paintHud(s, info) {
    ctx.textBaseline = 'middle';
    label(`NIGHT ${s.night + 1}/5 — ${s.nightName.toUpperCase()}`, 28, 20, 19, PAINT.text, 'left', '700');
    label(goalLine(s), 28, 43, 14, PAINT.dim, 'left');

    // The alarm meter: the heart of the HUD, centred and impossible to miss.
    const barWidth = 380;
    const barX = (STAGE.width - barWidth) / 2;
    label('ALARM', barX - 14, 29, 15, s.beingSeen ? PAINT.alarm : PAINT.dim, 'right', '700');
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(barX, 18, barWidth, 22);
    const fill = s.alarm / ALARM.max;
    if (fill > 0) {
      ctx.fillStyle = fill > 0.65 ? PAINT.alarm : PAINT.alarmLow;
      ctx.fillRect(barX, 18, barWidth * fill, 22);
    }
    ctx.strokeStyle = s.beingSeen ? PAINT.alarm : '#4a5878';
    ctx.lineWidth = s.beingSeen ? 2.5 : 1.5;
    ctx.strokeRect(barX, 18, barWidth, 22);

    label(clockText(s.totalClock), STAGE.width - 28, 20, 19, PAINT.text, 'right', '700');
    const tags = [];
    if (s.thief.sneak) tags.push('SNEAKING');
    if (info.muted) tags.push('MUTED');
    if (tags.length > 0) label(tags.join(' · '), STAGE.width - 28, 43, 13, PAINT.dim, 'right');
  }

  function paintPanel(lines, accent) {
    ctx.fillStyle = 'rgba(5, 7, 11, 0.62)';
    ctx.fillRect(0, 0, STAGE.width, STAGE.height);
    ctx.textBaseline = 'middle';
    let y = 208;
    for (const line of lines) {
      label(line.text, STAGE.width / 2, y, line.size, line.color || PAINT.text, 'center', line.weight || '');
      y += line.gap;
    }
    ctx.fillStyle = accent;
    ctx.fillRect(STAGE.width / 2 - 60, 168, 120, 3);
  }

  const TITLE_LINES = [
    { text: 'SHADOW SHIFT', size: 74, weight: '800', gap: 62 },
    { text: 'Slip past the patrols. Take what you came for. Leave unseen.', size: 21, color: PAINT.dim, gap: 58 },
    { text: 'Move  WASD / Arrows        Sneak (quiet, slow)  SHIFT', size: 19, gap: 32 },
    { text: 'Being seen fills the ALARM — full meter, and the night is over.', size: 19, gap: 32 },
    { text: 'Guards hear loud footsteps. Crates, walls and shadows break their sight.', size: 19, gap: 66 },
    { text: 'Press ENTER to start the first night', size: 23, color: PAINT.key, weight: '700', gap: 0 },
  ];

  /** Paint one frame: the floor, the HUD, and a panel for the screen the game is on. */
  function draw(s, view, info) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAINT.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.x, fit.y);
    paintFloor(s);
    if (view === VIEW_TITLE) {
      paintPanel(TITLE_LINES, PAINT.thief);
      return;
    }
    paintHud(s, info);
    if (view === VIEW_PAUSED) {
      paintPanel([
        { text: 'PAUSED', size: 46, weight: '800', gap: 60 },
        { text: 'The patrols wait for no one. Well — just this once.', size: 19, color: PAINT.dim, gap: 70 },
        { text: 'Press P to resume', size: 22, color: PAINT.key, weight: '700', gap: 0 },
      ], PAINT.thief);
    } else if (view === VIEW_CAUGHT) {
      paintPanel([
        { text: 'SPOTTED', size: 58, weight: '800', color: PAINT.alarm, gap: 58 },
        { text: `Caught on night ${s.night + 1} — ${s.nightName} — after ${clockText(s.nightClock)}`, size: 20, color: PAINT.dim, gap: 66 },
        { text: 'Press R to retry this night', size: 23, color: PAINT.key, weight: '700', gap: 0 },
      ], PAINT.alarm);
    } else if (view === VIEW_CLEAR) {
      paintPanel([
        { text: 'NIGHT CLEAR', size: 46, weight: '800', color: PAINT.padOn, gap: 56 },
        { text: `${s.nightName} in ${clockText(s.nightClock)} — total ${clockText(s.totalClock)}`, size: 20, color: PAINT.dim, gap: 70 },
        { text: 'Press ENTER for the next night', size: 22, color: PAINT.key, weight: '700', gap: 0 },
      ], PAINT.padOn);
    } else if (view === VIEW_DONE) {
      paintPanel([
        { text: 'ALL NIGHTS COMPLETE', size: 52, weight: '800', color: PAINT.padOn, gap: 60 },
        { text: `Five facilities, one shadow. Total time ${clockText(s.totalClock)}`, size: 21, color: PAINT.dim, gap: 72 },
        { text: 'Press ENTER to run it again', size: 23, color: PAINT.key, weight: '700', gap: 0 },
      ], PAINT.padOn);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
