/** ADSR envelope parameters (all times in seconds) */
export interface ADSR {
  attack: number;
  decay: number;
  sustain: number; // 0–1 gain level
  release: number;
}

/** Configuration for a single instrument (synth voice preset) */
export interface InstrumentConfig {
  oscType: OscillatorType;
  /** Number of oscillators for unison (1–3) */
  oscCount: number;
  /** Detune spread in cents between unison oscillators */
  unisonDetune: number;
  ampEnv: ADSR;
  /** Optional lowpass filter on the voice */
  filter?: {
    frequency: number;
    Q: number;
    /** Filter envelope: modulates cutoff from `frequency` up by this amount */
    envAmount?: number;
    envDecay?: number;
  };
}

/** A single note in a pattern: [midiNote, durationIn16ths]. 0 = rest. */
export type NoteStep = [number, number];

/** One track within a song (melody, bass, pad, arp, etc.) */
export interface TrackDef {
  instrument: InstrumentConfig;
  pattern: NoteStep[];
  /** Track volume 0–1 */
  volume: number;
  /** Octave offset applied to all notes (default 0) */
  octaveShift?: number;
}

/** A complete song definition for one page */
export interface Song {
  name: string;
  bpm: number;
  tracks: TrackDef[];
}

/** Audio processing effect applied by a visual theme */
export interface ThemeEffect {
  filter: {
    frequency: number;
    Q: number;
  };
  reverbMix: number; // 0–1 wet amount
  /** Global detune in cents applied to all voices */
  detune: number;
  /** Waveshaper distortion amount (0 = off, >0 = curve intensity) */
  distortion: number;
  /** Semitones to transpose all notes */
  transpose: number;
  /** Override oscillator type for all instruments (omit to use instrument default) */
  oscType?: OscillatorType;
  /** Multiplier for ADSR attack time (1.0 = default) */
  attackScale: number;
  /** Multiplier for ADSR release time (1.0 = default) */
  releaseScale: number;
}

export interface EngineState {
  enabled: boolean;
  volume: number;
  theme: string;
  mood: string;
}
