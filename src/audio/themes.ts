import type { ThemeEffect } from './types';

const themeEffects: Record<string, ThemeEffect> = {
  // Clean, faithful to the original composition
  'minimal-technical': {
    filter: { frequency: 4000, Q: 0.5 },
    reverbMix: 0.15,
    detune: 0,
    distortion: 0,
    transpose: 0,
    attackScale: 1.0,
    releaseScale: 1.0,
  },

  // Ethereal, high, shimmery — sine waves, slow attack, lots of reverb
  'modern-glass': {
    filter: { frequency: 6000, Q: 1.2 },
    reverbMix: 0.75,
    detune: 15,
    distortion: 0,
    transpose: 4,
    oscType: 'sine',
    attackScale: 2.5,
    releaseScale: 2.0,
  },

  // Dark, aggressive, raw — sawtooth, tight filter, moderate distortion
  brutalist: {
    filter: { frequency: 1000, Q: 1.5 },
    reverbMix: 0.05,
    detune: 0,
    distortion: 18,
    transpose: -5,
    oscType: 'sawtooth',
    attackScale: 0.3,
    releaseScale: 0.4,
  },

  // Digital, lo-fi, retro — square waves, resonant filter, slight grit
  'dark-terminal': {
    filter: { frequency: 1200, Q: 3.0 },
    reverbMix: 0.2,
    detune: 5,
    distortion: 8,
    transpose: -2,
    oscType: 'square',
    attackScale: 0.5,
    releaseScale: 0.6,
  },

  // Warm, classical, mellow — triangle waves, soft filter, lush reverb
  'academic-minimal': {
    filter: { frequency: 2200, Q: 0.3 },
    reverbMix: 0.6,
    detune: 3,
    distortion: 0,
    transpose: 2,
    oscType: 'triangle',
    attackScale: 1.8,
    releaseScale: 1.5,
  },
};

export function getThemeEffect(theme: string): ThemeEffect {
  return themeEffects[theme] || themeEffects['minimal-technical'];
}
