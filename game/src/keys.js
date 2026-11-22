// SHADOW SHIFT — keyboard input. Two sets: `down` for held keys (movement)
// and `pressed` for fresh keydowns, consumed once per frame so a menu key
// never fires twice.
const MOVES = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Keys {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  /** Movement vector plus sneak, from the keys held this frame. */
  move() {
    let mx = 0;
    let my = 0;
    for (const code of this.down) {
      const dir = MOVES[code];
      if (dir) {
        mx += dir[0];
        my += dir[1];
      }
    }
    return { mx, my, sneak: this.down.has('ShiftLeft') || this.down.has('ShiftRight') };
  }

  /** True once for a key pressed since the last frame. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
