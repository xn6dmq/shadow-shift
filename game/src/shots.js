// The screenshot scenes behind ?shot=start|play|end. Each stages the real
// sim — real nights, real patrols, real cones — and steps the simulation
// itself, so the frame is a moment the game can genuinely reach, and the same
// staging always produces the same frame.

import { DT } from './config.js';
import { VIEW_CAUGHT, VIEW_DONE, VIEW_PLAY, VIEW_TITLE } from './paint.js';
import { tileCentre } from './sim.js';

function stepGhost(sim, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) sim.tick(DT, { x: 0, y: 0 }, false, true);
}

/** Title: the first facility alive behind the panel, patrols mid-route. */
function stageStart(sim) {
  sim.loadNight(0);
  stepGhost(sim, 2.6);
  return { view: VIEW_TITLE };
}

/**
 * Play: Crossed Wires, mid-run. The corridor guard has just stopped at the
 * middle of his route and is scanning east; the thief is caught at the very
 * edge of his cone, close enough that the alarm has climbed to just under half.
 */
function stagePlay(sim) {
  sim.loadNight(1);
  const guard = sim.state.guards[1];
  const post = tileCentre(14, 9);
  guard.x = post.x;
  guard.y = post.y;
  guard.walking = false;
  guard.pause = 10;
  guard.pauseLeft = 10;
  guard.scanBase = 0;
  guard.angle = 0;
  guard.suspicion = 0.55;

  const angle = 0.55;
  const distance = 128;
  sim.state.thief.x = guard.x + Math.cos(angle) * distance;
  sim.state.thief.y = guard.y + Math.sin(angle) * distance;
  sim.state.thief.face = angle;
  sim.state.thief.moving = true;
  sim.state.thief.noise = 100;

  sim.tick(DT, { x: 0, y: 0 }, false, false);
  sim.state.alarm = 46;
  sim.state.nightClock = 38;
  sim.state.totalClock = 74;
  return { view: VIEW_PLAY };
}

/** End: The Vault cleared — the win screen over the last facility. */
function stageEnd(sim) {
  sim.loadNight(4);
  const spot = tileCentre(20, 11);
  sim.state.thief.x = spot.x;
  sim.state.thief.y = spot.y;
  sim.state.thief.face = Math.PI;
  stepGhost(sim, 1.2);
  sim.state.goalDone = true;
  sim.state.doorsOpen = true;
  sim.state.alarm = 0;
  sim.state.nightClock = 52;
  sim.state.totalClock = 187;
  return { view: VIEW_DONE };
}

/** Set `sim` to the named scene (start, play or end; any other name is start). */
export function stageShot(name, sim) {
  if (name === 'play') return stagePlay(sim);
  if (name === 'end') return stageEnd(sim);
  return stageStart(sim);
}

// Keep the caught view name referenced so a future scene can stage it.
export const CAUGHT_VIEW = VIEW_CAUGHT;
