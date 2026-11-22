// Every sound in SHADOW SHIFT is synthesised with WebAudio: no audio files
// exist. A low ambient hum beds the facility, footsteps tick while the thief
// moves (softer and slower while sneaking), and short stings mark being
// spotted, being caught, a pickup, a switch and a cleared night. The context
// is created lazily on the first user gesture, as browsers require; until then
// every call is a no-op.

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let stepClock = 0;
  let stingClock = 0;

  /** Build the context and start the hum. Safe to call on every gesture. */
  function unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // The hum: two detuned sawtooths through a lowpass, breathing slowly.
    const humGain = ctx.createGain();
    humGain.gain.value = 0.035;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 220;
    const a = ctx.createOscillator();
    a.type = 'sawtooth';
    a.frequency.value = 55;
    const b = ctx.createOscillator();
    b.type = 'sawtooth';
    b.frequency.value = 55.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(humGain.gain);
    a.connect(low);
    b.connect(low);
    low.connect(humGain);
    humGain.connect(master);
    a.start();
    b.start();
    lfo.start();
  }

  /** One short tone with an exponential decay envelope. */
  function tone(freq, secs, type, vol, delay = 0, glideTo = 0) {
    if (ctx === null) return;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, at + secs);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + secs);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + secs + 0.02);
  }

  /** A burst of filtered noise: a footstep, a door, a switch clack. */
  function burst(secs, vol, freq, delay = 0) {
    if (ctx === null) return;
    const at = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * secs));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(at);
  }

  return {
    unlock,

    /** Toggle the master gain; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    get muted() {
      return muted;
    },

    /** Tick footsteps while the thief moves; cadence and volume follow the sneak. */
    footsteps(dt, moving, sneaking) {
      if (ctx === null || !moving) {
        stepClock = 0;
        return;
      }
      stepClock -= dt;
      if (stepClock <= 0) {
        stepClock = sneaking ? 0.46 : 0.31;
        burst(0.05, sneaking ? 0.05 : 0.13, sneaking ? 500 : 750);
      }
    },

    /** A guard's own steps, audible through the floor when one is near. */
    guardStep(distance) {
      if (ctx === null || distance > 320) return;
      burst(0.045, 0.1 * (1 - distance / 320), 300);
    },

    /** Two-note sting when a watcher first lays eyes on the thief. Throttled. */
    spottedSting() {
      if (ctx === null || stingClock > 0) return;
      stingClock = 1.4;
      tone(392, 0.16, 'square', 0.11);
      tone(415, 0.22, 'square', 0.11, 0.09);
    },

    /** Count down the sting throttle; call once a step. */
    cool(dt) {
      if (stingClock > 0) stingClock = Math.max(0, stingClock - dt);
    },

    /** The caught sting: a falling dissonant pair. */
    caughtSting() {
      tone(330, 0.5, 'sawtooth', 0.16, 0, 110);
      tone(349, 0.5, 'sawtooth', 0.12, 0.05, 98);
      burst(0.3, 0.1, 200, 0.02);
    },

    /** Keycard or data core pickup: a bright two-step blip. */
    pickup() {
      tone(880, 0.09, 'sine', 0.16);
      tone(1318, 0.14, 'sine', 0.16, 0.07);
    },

    /** Switch clack and the whirr of cameras dying. */
    switchHit() {
      burst(0.06, 0.2, 1400);
      tone(196, 0.25, 'triangle', 0.12, 0.03, 98);
    },

    /** A heavy door sliding open. */
    door() {
      burst(0.4, 0.14, 240);
      tone(82, 0.4, 'triangle', 0.12, 0, 55);
    },

    /** Night cleared: a short rising arpeggio. */
    clearJingle() {
      tone(523, 0.12, 'triangle', 0.15);
      tone(659, 0.12, 'triangle', 0.15, 0.09);
      tone(784, 0.12, 'triangle', 0.15, 0.18);
      tone(1046, 0.3, 'triangle', 0.16, 0.27);
    },
  };
}
