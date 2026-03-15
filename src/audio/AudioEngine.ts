import type { Song, TrackDef, EngineState, ThemeEffect } from './types';
import { createImpulseResponse } from './impulse';
import { getThemeEffect } from './themes';
import { getSongForPath, getSongKeyForPath } from './songs';
import { SynthVoice } from './synth';

const MAX_VOLUME = 0.12;
const CROSSFADE_TIME = 2.0;
const THEME_RAMP_TIME = 0.8;
const STORAGE_KEY = 'audio-engine-state';
const SCHEDULE_INTERVAL = 100; // ms
const LOOKAHEAD = 0.25; // seconds

/** Per-track runtime state */
interface TrackState {
  def: TrackDef;
  gain: GainNode;
  stepIndex: number;
  nextStepTime: number;
}

/** All nodes for one playing song */
interface SongGraph {
  song: Song;
  trackStates: TrackState[];
  songGain: GainNode;
  sixteenthDuration: number;
}

/** Theme processing chain — built once, parameters updated live */
interface ThemeGraph {
  filter: BiquadFilterNode;
  convolver: ConvolverNode;
  reverbWet: GainNode;
  reverbDry: GainNode;
  waveshaper: WaveShaperNode;
  themeGain: GainNode;
}

function makeDistortionCurve(amount: number): Float32Array {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** Linear (bypass) curve for waveshaper */
function makeLinearCurve(): Float32Array {
  const curve = new Float32Array(2);
  curve[0] = -1;
  curve[1] = 1;
  return curve;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private songGraph: SongGraph | null = null;
  private themeGraph: ThemeGraph | null = null;

  private currentTheme = 'minimal-technical';
  private currentSongKey = 'home';
  private currentThemeEffect: ThemeEffect | null = null;

  private _enabled = false;
  private _volume = 0.5;

  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private crossfadeTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private disableTimeout: ReturnType<typeof setTimeout> | null = null;

  get enabled(): boolean {
    return this._enabled;
  }

  get volume(): number {
    return this._volume;
  }

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state: EngineState = JSON.parse(raw);
        this._volume = state.volume ?? 0.5;
        this.currentTheme = state.theme ?? 'minimal-technical';
        this.currentSongKey = state.mood ?? 'home';
      }
    } catch {
      // ignore
    }
  }

  private saveState(): void {
    try {
      const state: EngineState = {
        enabled: false,
        volume: this._volume,
        theme: this.currentTheme,
        mood: this.currentSongKey,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  /** Smoothly ramp an AudioParam to a target value */
  private rampParam(param: AudioParam, target: number, duration: number, exponential = false): void {
    const t = this.ctx!.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    if (exponential) {
      param.exponentialRampToValueAtTime(target, t + duration);
    } else {
      param.linearRampToValueAtTime(target, t + duration);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.3;
      this.compressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.compressor);
    }
    return this.ctx;
  }

  // ── Public API ──────────────────────────────────────────────────────

  async enable(): Promise<void> {
    // Cancel any pending disable teardown
    if (this.disableTimeout) {
      clearTimeout(this.disableTimeout);
      this.disableTimeout = null;
    }

    const ctx = this.ensureContext();

    // Always attempt resume — iOS Safari may report wrong state
    await ctx.resume();

    // iOS requires playing a short silent buffer to fully unlock audio
    if (ctx.state === 'running') {
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silentBuffer;
      src.connect(ctx.destination);
      src.start();
    }

    this._enabled = true;

    this.rampParam(this.masterGain!.gain, this._volume * MAX_VOLUME, 1.0);

    if (!this.themeGraph) {
      this.buildThemeGraph(this.currentTheme);
    }
    this.setMood(window.location.pathname);
    this.startScheduler();
    this.saveState();
  }

  async disable(): Promise<void> {
    this._enabled = false;
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    this.rampParam(this.masterGain.gain, 0, 1.0);
    this.stopScheduler();
    this.cancelPendingCrossfades();

    this.disableTimeout = setTimeout(() => {
      this.disableTimeout = null;
      if (!this._enabled && this.ctx && this.ctx.state === 'running') {
        this.teardownSongGraph(this.songGraph);
        this.songGraph = null;
        this.teardownThemeGraph();
        this.ctx.suspend();
      }
    }, 1200);

    this.saveState();
  }

  setVolume(value: number): void {
    this._volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && this.ctx && this._enabled) {
      this.rampParam(this.masterGain.gain, this._volume * MAX_VOLUME, 0.15);
    }
    this.saveState();
  }

  setTheme(theme: string): void {
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;
    this.currentThemeEffect = getThemeEffect(theme);
    if (this._enabled && this.ctx && this.themeGraph) {
      this.applyThemeEffect(this.currentThemeEffect);
    }
    this.saveState();
  }

  /** Called setMood for API compatibility with AudioToggle */
  setMood(pathname: string): void {
    const newKey = getSongKeyForPath(pathname);
    if (newKey === this.currentSongKey && this.songGraph) return;
    this.currentSongKey = newKey;
    if (this._enabled && this.ctx) {
      this.crossfadeSong(pathname);
    }
    this.saveState();
  }

  // ── Theme graph — built once, updated via parameter ramps ──────────

  private buildThemeGraph(theme: string): ThemeGraph {
    const ctx = this.ensureContext();
    const effect = getThemeEffect(theme);
    this.currentThemeEffect = effect;

    const themeGain = ctx.createGain();
    themeGain.gain.value = 1;
    themeGain.connect(this.masterGain!);

    // Reverb
    const convolver = ctx.createConvolver();
    const impulse = createImpulseResponse(ctx, 3, 2.5);
    convolver.buffer = impulse;

    const reverbWet = ctx.createGain();
    reverbWet.gain.value = effect.reverbMix;
    convolver.connect(reverbWet);
    reverbWet.connect(themeGain);

    const reverbDry = ctx.createGain();
    reverbDry.gain.value = 1 - effect.reverbMix;
    reverbDry.connect(themeGain);

    // Waveshaper — always present, use linear curve when no distortion
    const waveshaper = ctx.createWaveShaper();
    if (effect.distortion > 0) {
      waveshaper.curve = makeDistortionCurve(effect.distortion) as Float32Array<ArrayBuffer>;
    } else {
      waveshaper.curve = makeLinearCurve() as Float32Array<ArrayBuffer>;
    }
    waveshaper.oversample = '4x';
    waveshaper.connect(convolver);
    waveshaper.connect(reverbDry);

    // Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = effect.filter.frequency;
    filter.Q.value = effect.filter.Q;
    filter.connect(waveshaper);

    const graph: ThemeGraph = {
      filter,
      convolver,
      reverbWet,
      reverbDry,
      waveshaper,
      themeGain,
    };

    this.themeGraph = graph;
    return graph;
  }

  /** Smoothly ramp theme parameters on existing nodes — no graph rebuild */
  private applyThemeEffect(effect: ThemeEffect): void {
    if (!this.themeGraph || !this.ctx) return;
    const g = this.themeGraph;

    this.rampParam(g.filter.frequency, effect.filter.frequency, THEME_RAMP_TIME, true);
    this.rampParam(g.filter.Q, effect.filter.Q, THEME_RAMP_TIME);
    this.rampParam(g.reverbWet.gain, effect.reverbMix, THEME_RAMP_TIME);
    this.rampParam(g.reverbDry.gain, 1 - effect.reverbMix, THEME_RAMP_TIME);

    // Update distortion curve (instant — no ramp available for curve)
    if (effect.distortion > 0) {
      g.waveshaper.curve = makeDistortionCurve(effect.distortion) as Float32Array<ArrayBuffer>;
    } else {
      g.waveshaper.curve = makeLinearCurve() as Float32Array<ArrayBuffer>;
    }
  }

  private teardownThemeGraph(): void {
    if (!this.themeGraph) return;
    const g = this.themeGraph;
    try {
      g.filter.disconnect();
      g.convolver.disconnect();
      g.reverbWet.disconnect();
      g.reverbDry.disconnect();
      g.waveshaper.disconnect();
      g.themeGain.disconnect();
    } catch {}
    this.themeGraph = null;
  }

  // ── Song graph (sequenced music) ───────────────────────────────────

  private buildSongGraph(song: Song): SongGraph {
    const ctx = this.ensureContext();
    const sixteenthDuration = 60 / song.bpm / 4;

    const songGain = ctx.createGain();
    songGain.gain.value = 1;

    // Connect song output to theme processing
    if (this.themeGraph) {
      songGain.connect(this.themeGraph.filter);
    } else {
      songGain.connect(this.masterGain!);
    }

    const trackStates: TrackState[] = song.tracks.map((def) => {
      const gain = ctx.createGain();
      gain.gain.value = def.volume;
      gain.connect(songGain);

      return {
        def,
        gain,
        stepIndex: 0,
        nextStepTime: ctx.currentTime,
      };
    });

    return { song, trackStates, songGain, sixteenthDuration };
  }

  private teardownSongGraph(graph: SongGraph | null): void {
    if (!graph) return;
    for (const ts of graph.trackStates) {
      try { ts.gain.disconnect(); } catch {}
    }
    try { graph.songGain.disconnect(); } catch {}
  }

  private crossfadeSong(pathname: string): void {
    const ctx = this.ctx!;
    const song = getSongForPath(pathname);
    const oldGraph = this.songGraph;

    const newGraph = this.buildSongGraph(song);
    this.songGraph = newGraph;

    if (oldGraph) {
      // Crossfade: fade new in, old out
      newGraph.songGain.gain.setValueAtTime(0, ctx.currentTime);
      newGraph.songGain.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE_TIME);

      oldGraph.songGain.gain.setValueAtTime(oldGraph.songGain.gain.value, ctx.currentTime);
      oldGraph.songGain.gain.linearRampToValueAtTime(0, ctx.currentTime + CROSSFADE_TIME);

      const timeout = setTimeout(() => {
        this.teardownSongGraph(oldGraph);
        this.crossfadeTimeouts.delete(timeout);
      }, CROSSFADE_TIME * 1000 + 100);

      this.crossfadeTimeouts.add(timeout);
    }
    // No old graph = first play, songGain starts at 1 (set in buildSongGraph)
  }

  // ── Scheduler ──────────────────────────────────────────────────────

  private startScheduler(): void {
    this.stopScheduler();
    this.schedulerInterval = setInterval(() => this.schedule(), SCHEDULE_INTERVAL);
  }

  private stopScheduler(): void {
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  private schedule(): void {
    if (!this.ctx || !this.songGraph || !this.themeGraph || !this.currentThemeEffect) return;

    const ctx = this.ctx;
    const { trackStates, sixteenthDuration } = this.songGraph;
    const themeEffect = this.currentThemeEffect;

    for (const track of trackStates) {
      while (track.nextStepTime < ctx.currentTime + LOOKAHEAD) {
        const pattern = track.def.pattern;
        const step = pattern[track.stepIndex % pattern.length];
        const [midiNote, durIn16ths] = step;
        const durationSecs = durIn16ths * sixteenthDuration;

        if (midiNote > 0) {
          // Apply octave shift + theme transpose
          const shiftedNote = midiNote + (track.def.octaveShift || 0) * 12 + themeEffect.transpose;

          // Build themed instrument: apply oscType override and ADSR scaling
          const baseInst = track.def.instrument;
          const themedInst = {
            ...baseInst,
            oscType: themeEffect.oscType || baseInst.oscType,
            ampEnv: {
              attack: baseInst.ampEnv.attack * themeEffect.attackScale,
              decay: baseInst.ampEnv.decay,
              sustain: baseInst.ampEnv.sustain,
              release: baseInst.ampEnv.release * themeEffect.releaseScale,
            },
          };

          SynthVoice.play(
            ctx,
            track.gain,
            themedInst,
            shiftedNote,
            track.nextStepTime,
            durationSecs * 0.9, // slight gap between notes
            1.0, // track GainNode already handles volume
            themeEffect.detune,
          );
        }

        track.nextStepTime += durationSecs;
        track.stepIndex++;
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  private cancelPendingCrossfades(): void {
    for (const t of this.crossfadeTimeouts) {
      clearTimeout(t);
    }
    this.crossfadeTimeouts.clear();
  }
}
