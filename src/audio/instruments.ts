import type { InstrumentConfig } from './types';

/** Warm sine piano — soft attack, moderate sustain */
export const PIANO: InstrumentConfig = {
  oscType: 'triangle',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 },
  filter: { frequency: 2000, Q: 0.5 },
};

/** Deep bass — single sine, fast attack, short release */
export const BASS: InstrumentConfig = {
  oscType: 'sine',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.15 },
  filter: { frequency: 800, Q: 1.0 },
};

/** Soft pad — slow attack, long release, detuned unison */
export const PAD: InstrumentConfig = {
  oscType: 'sine',
  oscCount: 2,
  unisonDetune: 8,
  ampEnv: { attack: 0.4, decay: 0.3, sustain: 0.6, release: 1.0 },
};

/** Clean sine lead */
export const SINE_LEAD: InstrumentConfig = {
  oscType: 'sine',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.02, decay: 0.15, sustain: 0.5, release: 0.3 },
};

/** Triangle lead — slightly brighter than sine */
export const TRIANGLE_LEAD: InstrumentConfig = {
  oscType: 'triangle',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
};

/** Square wave lead — chiptune character */
export const SQUARE_LEAD: InstrumentConfig = {
  oscType: 'square',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.1 },
  filter: { frequency: 3000, Q: 0.5 },
};

/** Sawtooth lead — bright, aggressive */
export const SAW_LEAD: InstrumentConfig = {
  oscType: 'sawtooth',
  oscCount: 2,
  unisonDetune: 12,
  ampEnv: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.2 },
  filter: { frequency: 2500, Q: 1.0 },
};

/** Detuned sine strings — wide, cinematic */
export const STRINGS: InstrumentConfig = {
  oscType: 'sine',
  oscCount: 3,
  unisonDetune: 10,
  ampEnv: { attack: 0.3, decay: 0.2, sustain: 0.7, release: 0.8 },
};

/** Fast arp instrument — short, punchy */
export const ARP: InstrumentConfig = {
  oscType: 'triangle',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.15 },
};

/** Square arp — chiptune style */
export const SQUARE_ARP: InstrumentConfig = {
  oscType: 'square',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.003, decay: 0.08, sustain: 0.2, release: 0.08 },
  filter: { frequency: 4000, Q: 0.3 },
};

/** Power bass — sawtooth, thick */
export const POWER_BASS: InstrumentConfig = {
  oscType: 'sawtooth',
  oscCount: 1,
  unisonDetune: 0,
  ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.15 },
  filter: { frequency: 600, Q: 1.5 },
};
