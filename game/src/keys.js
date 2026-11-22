// Keyboard input for SHADOW SHIFT. Held keys give a movement vector and the
// sneak state; one-shot presses (confirm, retry, mute, pause) are queued as
// bit flags and taken once by the loop, so a press between two frames is
// never lost or counted twice.

export const KEY_CONFIRM = 1;
export const KEY_RETRY = 2;
export const KEY_MUTE = 4;
export const KEY_PAUSE = 8;

const GO_LEFT = new Set(['ArrowLeft', 'KeyA']);
const GO_RIGHT = new Set(['ArrowRight', 'KeyD']);
const GO_UP = new Set(['ArrowUp', 'KeyW']);
const GO_DOWN = new Set(['ArrowDown', 'KeyS']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'Space']);
const RETRY = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createKeys(target) {
  const held = new Set();
  let queued = 0;

  function isMove(code) {
    return GO_LEFT.has(code) || GO_RIGHT.has(code) || GO_UP.has(code)
      || GO_DOWN.has(code) || SNEAK.has(code);
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) queued |= KEY_CONFIRM;
    } else if (RETRY.has(event.code)) {
      if (!event.repeat) queued |= KEY_RETRY;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) queued |= KEY_MUTE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) queued |= KEY_PAUSE;
    } else if (isMove(event.code)) {
      held.add(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: drop everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    queued |= KEY_CONFIRM;
  });

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement as a unit-ish vector: each axis is -1, 0 or 1. */
    vector() {
      return {
        x: (anyHeld(GO_RIGHT) ? 1 : 0) - (anyHeld(GO_LEFT) ? 1 : 0),
        y: (anyHeld(GO_DOWN) ? 1 : 0) - (anyHeld(GO_UP) ? 1 : 0),
      };
    },
    /** True while either Shift key is held: the thief sneaks, slow and quiet. */
    sneaking() {
      return anyHeld(SNEAK);
    },
    /** The one-shot presses since the last call, as KEY_* flags. */
    take() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
