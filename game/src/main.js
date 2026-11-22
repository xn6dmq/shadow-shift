// SHADOW SHIFT — the shell around the simulation: the screen state machine,
// the animation loop, the screenshot staging and the sound wiring. The game
// itself lives in sim.js; this file only decides which screen is showing and
// when a level starts, ends or restarts.
import { CANVAS_W, CANVAS_H } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './sim.js';
import { render } from './paint.js';
import { Sound } from './sound.js';
import { Keys } from './keys.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const keys = new Keys();
const sound = new Sound();

const game = {
  screen: 'title',
  levelIndex: 0,
  levelDef: LEVELS[0],
  world: new World(0),
  totalTime: 0,
  loadLevel(index) {
    this.levelIndex = index;
    this.levelDef = LEVELS[index];
    this.world = new World(index);
  },
};

const statusEl = document.getElementById('status');
function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function playEvents(events) {
  for (const e of events) {
    if (e === 'step') sound.step(false);
    else if (e === 'step-quiet') sound.step(true);
    else if (e === 'pickup') sound.pickup();
    else if (e === 'switch') { sound.pickup(); sound.door(); }
    else if (e === 'door') sound.door();
    else if (e === 'spotted') sound.spotted();
    else if (e === 'caught') sound.caught();
    else if (e === 'clear') sound.clear();
  }
}

function advance() {
  if (game.levelIndex + 1 < LEVELS.length) {
    game.totalTime += game.world.time;
    game.loadLevel(game.levelIndex + 1);
    game.screen = 'play';
    announce(`${game.levelDef.name}. ${game.levelDef.hint}`);
  } else {
    game.totalTime += game.world.time;
    game.screen = 'win';
    announce(`All nights complete. Total time ${game.totalTime.toFixed(0)} seconds.`);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - frame.last) / 1000 || 0.016);
  frame.last = now;

  if (game.screen === 'play') {
    const events = game.world.step(dt, keys.move());
    playEvents(events);
    if (game.world.caught) {
      game.screen = 'caught';
      announce('Spotted. The night restarts.');
    } else if (game.world.cleared) {
      game.screen = 'clear';
      announce(`${game.levelDef.name} clear.`);
    }
  }

  if (keys.wasPressed('Enter')) {
    if (game.screen === 'title') {
      sound.ensure();
      sound.startHum();
      game.screen = 'play';
      announce(`${game.levelDef.name}. ${game.levelDef.hint}`);
    } else if (game.screen === 'clear') {
      advance();
    }
  }
  if (keys.wasPressed('KeyR')) {
    if (game.screen === 'caught') {
      game.loadLevel(game.levelIndex);
      game.screen = 'play';
    } else if (game.screen === 'win') {
      game.totalTime = 0;
      game.loadLevel(0);
      game.screen = 'title';
    }
  }
  if (keys.wasPressed('KeyP') || keys.wasPressed('Escape')) {
    if (game.screen === 'play') game.screen = 'pause';
    else if (game.screen === 'pause') game.screen = 'play';
  }
  keys.endFrame();

  render(ctx, game);
  requestAnimationFrame(frame);
}
frame.last = 0;

// Screenshot staging: ?shot=start|play|end renders one fixed frame and
// signals the capture script, with no loop and no audio.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.screen = stageShot(shot, game);
  render(ctx, game);
  window.__shotReady = true;
} else {
  announce('SHADOW SHIFT. Press Enter to begin Night 1.');
  requestAnimationFrame(frame);
}
