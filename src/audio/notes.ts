/**
 * Convert a MIDI note number to frequency in Hz.
 * A4 (MIDI 69) = 440 Hz.
 */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Common MIDI note constants
// Octave 2
export const C2 = 36;
export const D2 = 38;
export const E2 = 40;
export const F2 = 41;
export const G2 = 43;
export const A2 = 45;
export const B2 = 47;
export const Bb2 = 46;

// Octave 3
export const C3 = 48;
export const D3 = 50;
export const Eb3 = 51;
export const E3 = 52;
export const F3 = 53;
export const G3 = 55;
export const A3 = 57;
export const Bb3 = 58;
export const B3 = 59;

// Octave 4
export const C4 = 60;
export const D4 = 62;
export const Eb4 = 63;
export const E4 = 64;
export const F4 = 65;
export const G4 = 67;
export const Ab4 = 68;
export const A4 = 69;
export const Bb4 = 70;
export const B4 = 71;

// Octave 5
export const C5 = 72;
export const D5 = 74;
export const Eb5 = 75;
export const E5 = 76;
export const F5 = 77;
export const G5 = 79;
export const A5 = 81;
export const Bb5 = 82;
export const B5 = 83;

// Octave 6
export const C6 = 84;

// Rest constant
export const R = 0;
