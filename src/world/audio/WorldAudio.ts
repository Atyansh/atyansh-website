// World audio: music + synthesized SFX + ambience, no audio files.
//
//   music:    the site's own AudioEngine (per-section songs) → musicBus
//   sfx:      one-shot procedural voices (footsteps by surface, UI, pets,
//             arcade blips, gacha, collectibles…) → sfxBus
//   ambience: looping noise beds per space (city traffic + wind, park
//             birds, interior room tone, café chatter murmur) → ambBus
//
// Everything starts on the title-screen click (user gesture). Volumes come
// from the save's settings and update live.

import { AudioEngine } from '../../audio/AudioEngine';
import type { Game } from '../game/Game';
import type { Surface } from '../engine/Events';

const SONG_PATH: Record<string, string> = {
  home: '/', movies: '/movies', music: '/music', games: '/games', books: '/books', anime: '/anime',
  tv: '/tv', climbing: '/climbing', work: '/work', pets: '/pets', blog: '/blog',
};

export class WorldAudio {
  private engine = new AudioEngine();
  private ctx!: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private ambience: { stop: () => void } | null = null;
  private ambienceKind = '';
  started = false;
  muted = false;

  constructor(private game: Game) {
    game.events.on('footstep', ({ surface, intensity }) => this.footstep(surface, intensity));
    game.events.on('land', ({ surface, impact }) => this.footstep(surface, 0.8 + impact, true));
    game.events.on('jump', () => this.sfx('jump'));
    game.events.on('sfx', ({ name, volume }) => this.sfx(name, volume));
    game.events.on('levelEnter', ({ id }) => this.onLevel(id));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' && this.started) this.toggleMute();
    });
  }

  /** Must be called from a user gesture */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.engine.persist = false;
    this.ctx = this.engine.context;
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.ambBus = this.ctx.createGain();
    for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.master);
    this.engine.setOutput(this.musicBus);
    this.engine.setVolume(0.9);
    // shared white-noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    // route the engine's song by path, without touching location
    const song = this.game.level?.music ?? 'home';
    await this.engine.enable();
    this.engine.setMood(SONG_PATH[song] ?? '/');
    this.onLevel(this.game.level?.id ?? 'street');
  }

  applyVolumes(): void {
    if (!this.started) return;
    const s = this.game.save.settings;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(s.music, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(s.ambience, t, 0.1);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.1);
    this.game.ui.toast(this.muted ? 'Sound off' : 'Sound on', 'N to toggle', this.muted ? '🔇' : '🔊');
  }

  private onLevel(id: string): void {
    if (!this.started) return;
    const level = this.game.levels.get(id);
    if (!level) return;
    this.engine.setMood(SONG_PATH[level.music] ?? '/');
    const kind = level.ambience;
    if (kind !== this.ambienceKind) {
      this.ambience?.stop();
      this.ambience = this.startAmbience(kind);
      this.ambienceKind = kind;
    }
  }

  // ---------------- ambience ----------------

  private loopNoise(gain: number, filter: BiquadFilterType, freq: number, q = 0.7): { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(gain, this.ctx.currentTime, 1.2);
    src.connect(f).connect(g).connect(this.ambBus);
    src.start();
    return { src, g, f };
  }

  private startAmbience(kind: string): { stop: () => void } {
    const nodes: Array<{ src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode }> = [];
    const timers: number[] = [];
    if (kind === 'street' || kind === 'park') {
      const traffic = this.loopNoise(0.09, 'lowpass', 380, 0.4);
      const wind = this.loopNoise(0.025, 'bandpass', 900, 0.3);
      nodes.push(traffic, wind);
      // slow traffic swells
      timers.push(window.setInterval(() => {
        const t = this.ctx.currentTime;
        traffic.g.gain.setTargetAtTime(0.06 + Math.random() * 0.08, t, 1.5);
        wind.f.frequency.setTargetAtTime(600 + Math.random() * 800, t, 2);
      }, 2500));
      // birds near the park, distant car horns
      timers.push(window.setInterval(() => {
        const p = this.game.player?.position;
        const nearPark = p && p.x > 10 && p.z < 0;
        if (Math.random() < (nearPark ? 0.7 : 0.25)) this.bird(nearPark ? 0.5 : 0.18);
        if (Math.random() < 0.05) this.horn();
      }, 1400));
    } else if (kind === 'interior' || kind === 'gym' || kind === 'arcade' || kind === 'cafe') {
      nodes.push(this.loopNoise(0.035, 'lowpass', 220, 0.5)); // room tone / HVAC
      if (kind === 'cafe' || kind === 'gym') {
        const murmur = this.loopNoise(0.03, 'bandpass', 520, 1.2);
        nodes.push(murmur);
        timers.push(window.setInterval(() => murmur.f.frequency.setTargetAtTime(380 + Math.random() * 320, this.ctx.currentTime, 0.4), 700));
      }
      if (kind === 'arcade') {
        timers.push(window.setInterval(() => { if (Math.random() < 0.6) this.sfx('arcade:ambient', 0.25); }, 900));
      }
      if (kind === 'cafe') timers.push(window.setInterval(() => { if (Math.random() < 0.2) this.sfx('cup', 0.4); }, 2600));
    }
    return {
      stop: () => {
        const t = this.ctx.currentTime;
        for (const n of nodes) {
          n.g.gain.setTargetAtTime(0, t, 0.4);
          n.src.stop(t + 2);
        }
        timers.forEach((id) => clearInterval(id));
      },
    };
  }

  // ---------------- one-shots ----------------

  private env(g: GainNode, t: number, peak: number, a: number, d: number): void {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus = this.sfxBus): void {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.005, dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(filter: BiquadFilterType, freq: number, q: number, dur: number, vol: number, delay = 0): void {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.003, dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  footstep(surface: Surface, intensity: number, land = false): void {
    if (!this.started) return;
    const v = Math.min(1, intensity) * (land ? 1.3 : 1);
    const jitter = 0.85 + Math.random() * 0.3;
    switch (surface) {
      case 'grass': this.burst('highpass', 2400 * jitter, 0.6, 0.09, 0.12 * v); break;
      case 'gravel': this.burst('bandpass', 2800 * jitter, 0.8, 0.12, 0.22 * v); this.burst('bandpass', 4200, 1.2, 0.06, 0.1 * v, 0.02); break;
      case 'wood': this.tone('sine', 140 * jitter, 70, 0.08, 0.22 * v); this.burst('bandpass', 900, 1.5, 0.05, 0.1 * v); break;
      case 'carpet': this.burst('lowpass', 500 * jitter, 0.7, 0.07, 0.12 * v); break;
      case 'pad': this.tone('sine', 90, 50, 0.12, 0.25 * v); this.burst('lowpass', 300, 0.6, 0.1, 0.1 * v); break;
      case 'metal': this.tone('triangle', 420 * jitter, 300, 0.09, 0.08 * v); this.burst('bandpass', 2600, 4, 0.06, 0.12 * v); break;
      case 'tile': this.burst('bandpass', 1800 * jitter, 2.2, 0.05, 0.18 * v); this.tone('sine', 220, 160, 0.04, 0.06 * v); break;
      default: this.burst('bandpass', 1300 * jitter, 1.4, 0.06, 0.18 * v); this.tone('sine', 110, 70, 0.05, 0.1 * v);
    }
  }

  private bird(vol: number): void {
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = i * (0.09 + Math.random() * 0.05);
      this.tone('sine', base * (1 + Math.random() * 0.2), base * (0.7 + Math.random() * 0.6), 0.07, 0.05 * vol, t, this.ambBus);
    }
  }

  private horn(): void {
    this.tone('sawtooth', 330, 320, 0.45, 0.012, 0, this.ambBus);
    this.tone('sawtooth', 415, 405, 0.45, 0.01, 0, this.ambBus);
  }

  sfx(name: string, volume = 1): void {
    if (!this.started) return;
    const v = volume;
    switch (name) {
      case 'jump': this.burst('bandpass', 700, 1, 0.08, 0.08 * v); break;
      case 'mantle': this.burst('lowpass', 600, 0.6, 0.25, 0.14 * v); this.tone('sine', 120, 80, 0.15, 0.1 * v, 0.2); break;
      case 'tick': this.tone('square', 1800, 1700, 0.02, 0.03 * v); break;
      case 'tap': case 'open': this.tone('sine', 900, 1300, 0.06, 0.08 * v); break;
      case 'phone': this.tone('sine', 880, 880, 0.08, 0.06 * v); this.tone('sine', 1320, 1320, 0.1, 0.06 * v, 0.08); break;
      case 'settings': this.tone('sine', 660, 660, 0.06, 0.05 * v); break;
      case 'sit': this.burst('lowpass', 400, 0.5, 0.2, 0.15 * v); break;
      case 'grab': case 'hold': this.burst('bandpass', 1200, 2, 0.05, 0.12 * v); this.burst('highpass', 5000, 0.5, 0.12, 0.04 * v, 0.02); break;
      case 'release': this.burst('lowpass', 900, 0.5, 0.1, 0.1 * v); break;
      case 'collect': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.08 * v, i * 0.07)); break;
      case 'goal': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.22, 0.045 * v, i * 0.09)); break;
      case 'gacha': this.burst('bandpass', 1500, 3, 0.6, 0.1 * v); [880, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, 0.3, 0.07 * v, 1.2 + i * 0.1)); break;
      case 'static': this.burst('highpass', 3000, 0.4, 0.3, 0.07 * v); break;
      case 'shutter': this.burst('highpass', 3000, 1, 0.04, 0.2 * v); this.burst('bandpass', 1200, 2, 0.06, 0.15 * v, 0.06); break;
      case 'pickup': this.tone('sine', 500, 800, 0.08, 0.08 * v); break;
      case 'throw': this.burst('bandpass', 1200, 0.8, 0.18, 0.1 * v); break;
      case 'cup': this.tone('sine', 2400, 2300, 0.15, 0.03 * v); break;
      case 'flutter': for (let i = 0; i < 8; i++) this.burst('bandpass', 1400 + Math.random() * 800, 1.5, 0.05, 0.06 * v, i * 0.045); break;
      case 'meow': this.tone('sawtooth', 600, 900, 0.18, 0.03 * v); this.tone('sawtooth', 900, 450, 0.3, 0.03 * v, 0.17); break;
      case 'hiss': this.burst('highpass', 3500, 0.5, 0.45, 0.08 * v); break;
      case 'purr': for (let i = 0; i < 18; i++) this.tone('sawtooth', 26, 24, 0.08, 0.05 * v, i * 0.09); break;
      case 'happy': case 'bark': [0, 0.2].forEach((d) => { this.tone('sawtooth', 520, 340, 0.09, 0.05 * v, d); this.burst('bandpass', 900, 2, 0.08, 0.06 * v, d); }); break;
      case 'arcade:paddle': this.tone('square', 440, 440, 0.04, 0.05 * v); break;
      case 'arcade:hit': this.tone('square', 660, 660, 0.04, 0.05 * v); break;
      case 'arcade:break': this.tone('square', 880, 1320, 0.07, 0.05 * v); break;
      case 'arcade:launch': this.tone('square', 330, 990, 0.12, 0.05 * v); break;
      case 'arcade:lose': this.tone('square', 440, 110, 0.5, 0.06 * v); break;
      case 'arcade:level': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.1, 0.05 * v, i * 0.06)); break;
      case 'arcade:coin': this.tone('square', 988, 988, 0.08, 0.05 * v); this.tone('square', 1319, 1319, 0.3, 0.05 * v, 0.08); break;
      case 'arcade:ambient': this.tone('square', 200 + Math.random() * 1200, 200 + Math.random() * 1200, 0.08, 0.012 * v); break;
      default: break;
    }
  }
}
