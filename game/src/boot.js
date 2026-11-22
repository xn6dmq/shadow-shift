// Boot and the one loop of SHADOW SHIFT: input is read every frame, the sim
// advances in fixed steps (several in a slow frame, none in a fast one), and
// the painter draws what is there. The game moves between six views: title,
// play, paused, caught, night clear and the final clear.
//
// ?shot=start|play|end stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.
import { DT } from './config.js';
import {
  createSim, FLAG_CAUGHT, FLAG_CLEAR, FLAG_OBJECTIVE, FLAG_SPOTTED, FLAG_STEP,
} from './sim.js';
import {
  KEY_CONFIRM, KEY_MUTE, KEY_PAUSE, KEY_RETRY, createKeys,
} from './keys.js';
import { createSound } from './sound.js';
import {
  VIEW_CAUGHT, VIEW_CLEAR, VIEW_DONE, VIEW_PAUSED, VIEW_PLAY, VIEW_TITLE, createPainter,
} from './paint.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sim = createSim();
const painter = createPainter(canvas);
const sound = createSound();
const info = { muted: false };

function runShot(name) {
  const scene = stageShot(name, sim);
  let painted = 0;
  function paint() {
    painter.draw(sim.state, scene.view, info);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const keys = createKeys(canvas);
  let view = VIEW_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    sim.freshRun();
    accumulator = 0;
    view = VIEW_PLAY;
    announce(`Night 1. ${sim.state.brief}`);
  }

  function retryNight() {
    sim.loadNight(sim.state.night);
    accumulator = 0;
    view = VIEW_PLAY;
    announce(`Retrying night ${sim.state.night + 1}.`);
  }

  function nextNight() {
    sim.loadNight(sim.state.night + 1);
    accumulator = 0;
    view = VIEW_PLAY;
    announce(`Night ${sim.state.night + 1}. ${sim.state.brief}`);
  }

  function handleKeys() {
    const pressed = keys.take();
    if (pressed & KEY_MUTE) info.muted = sound.toggleMute();
    if (pressed & KEY_CONFIRM) sound.unlock();
    if (view === VIEW_TITLE && (pressed & KEY_CONFIRM)) startRun();
    else if (view === VIEW_CAUGHT && (pressed & (KEY_RETRY | KEY_CONFIRM))) retryNight();
    else if (view === VIEW_CLEAR && (pressed & KEY_CONFIRM)) nextNight();
    else if (view === VIEW_DONE && (pressed & KEY_CONFIRM)) startRun();
    else if ((pressed & KEY_PAUSE) && view === VIEW_PLAY) {
      view = VIEW_PAUSED;
      announce('Paused.');
    } else if ((pressed & (KEY_PAUSE | KEY_CONFIRM)) && view === VIEW_PAUSED) {
      view = VIEW_PLAY;
      announce('Playing.');
    }
  }

  function handleFlags(flags) {
    if (flags & FLAG_SPOTTED) sound.spottedSting();
    if (flags & FLAG_OBJECTIVE) {
      if (sim.state.goal === 'keycard' || sim.state.goal === 'core') sound.pickup();
      else sound.switchHit();
      sound.door();
      announce('Objective complete. The exit is open.');
    }
    if (flags & FLAG_STEP) sound.guardStep(sim.state.closestGuard);
    if (flags & FLAG_CAUGHT) {
      sound.caughtSting();
      view = VIEW_CAUGHT;
      announce('Spotted. The night is over.');
    } else if (flags & FLAG_CLEAR) {
      sound.clearJingle();
      view = sim.state.night + 1 >= sim.nights ? VIEW_DONE : VIEW_CLEAR;
      announce(view === VIEW_DONE ? 'All nights complete.' : 'Night clear.');
    }
  }

  function step() {
    if (view === VIEW_TITLE) {
      sim.tick(DT, { x: 0, y: 0 }, false, true);
      return;
    }
    const flags = sim.tick(DT, keys.vector(), keys.sneaking(), false);
    sound.cool(DT);
    sound.footsteps(DT, sim.state.thief.moving, sim.state.thief.sneak);
    handleFlags(flags);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleKeys();
    if (view === VIEW_TITLE || view === VIEW_PLAY) {
      while (accumulator >= DT && (view === VIEW_TITLE || view === VIEW_PLAY)) {
        step();
        accumulator -= DT;
      }
    } else {
      accumulator = 0;
    }
    painter.draw(sim.state, view, info);
  }

  // Leaving the tab pauses a running game rather than letting the patrols close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && view === VIEW_PLAY) {
      view = VIEW_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Shift. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
