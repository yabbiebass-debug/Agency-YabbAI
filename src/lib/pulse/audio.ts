// Web Audio synthesis for YABBAI PULSE. No audio files.
import type { SoundEvent, Wave } from "./levels";

export class PulseAudio {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;

  constructor() {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    const len = Math.floor(this.ctx.sampleRate * 1.5);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  private noiseSource() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    return s;
  }

  kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  snare(t: number) {
    const s = this.noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "highpass";
    f.frequency.value = 1400;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.15);
  }

  hat(t: number) {
    const s = this.noiseSource();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    f.type = "highpass";
    f.frequency.value = 7000;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.06);
  }

  bass(t: number, freq: number) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.24);
  }

  lead(t: number, freq: number, wave: Wave) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.18);
  }

  blip() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  play(ev: SoundEvent, at: number, wave: Wave) {
    switch (ev.kind) {
      case "kick": return this.kick(at);
      case "snare": return this.snare(at);
      case "hat": return this.hat(at);
      case "bass": return this.bass(at, ev.freq);
      case "lead": return this.lead(at, ev.freq, wave);
    }
  }

  close() {
    void this.ctx.close();
  }
}
