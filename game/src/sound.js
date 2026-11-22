// SHADOW SHIFT — every sound is synthesised live with WebAudio. No audio
// files, no network: short oscillators and filtered noise, nothing else.
export class Sound {
  constructor() {
    this.ctx = null;
    this.hum = null;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    return true;
  }

  tone(freq, dur, type, gain, when = 0) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, gain, freq) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const amp = this.ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.ctx.destination);
    src.start(t0);
  }

  step(quiet) {
    this.noise(0.05, quiet ? 0.015 : 0.05, quiet ? 500 : 900);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.12);
    this.tone(990, 0.14, 'sine', 0.12, 0.08);
  }

  door() {
    this.tone(220, 0.08, 'square', 0.06);
    this.tone(330, 0.12, 'square', 0.06, 0.07);
  }

  spotted() {
    this.tone(520, 0.12, 'sawtooth', 0.08);
    this.tone(780, 0.16, 'sawtooth', 0.08, 0.1);
  }

  caught() {
    this.tone(180, 0.5, 'sawtooth', 0.14);
    this.tone(120, 0.6, 'square', 0.1, 0.1);
  }

  clear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.1, i * 0.09));
  }

  startHum() {
    if (!this.ensure() || this.hum) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    amp.gain.value = 0.015;
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start();
    this.hum = { osc, amp };
  }
}
