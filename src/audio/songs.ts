import type { Song } from './types';
import {
  PIANO, BASS, PAD, SINE_LEAD, TRIANGLE_LEAD, SQUARE_LEAD,
  SAW_LEAD, STRINGS, ARP, SQUARE_ARP, POWER_BASS,
} from './instruments';
import {
  R,
  C2, D2, E2, F2, G2, A2, B2, Bb2,
  C3, D3, Eb3, E3, F3, G3, A3, Bb3, B3,
  C4, D4, Eb4, E4, F4, G4, A4, Bb4, B4,
  C5, D5, Eb5, E5, F5, G5, A5, Bb5, B5,
  C6,
} from './notes';

// ── Home: Warm village theme (C major, 90 BPM) ──────────────────────

const homeSong: Song = {
  name: 'home',
  bpm: 90,
  tracks: [
    {
      instrument: PIANO,
      volume: 0.35,
      pattern: [
        [E4,4], [G4,4], [C5,4], [E5,4],
        [D5,4], [C5,4], [G4,4], [R,4],
        [F4,4], [A4,4], [C5,4], [F5,4],
        [E5,4], [D5,4], [C5,4], [R,4],
        [G4,4], [B4,4], [D5,4], [G5,4],
        [F5,4], [E5,4], [D5,4], [C5,4],
        [E4,4], [G4,4], [C5,8],
        [R,4], [R,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.3,
      pattern: [
        [C3,8], [G2,8],
        [F2,8], [C3,8],
        [G2,8], [E2,8],
        [F2,8], [G2,8],
      ],
    },
    {
      instrument: PAD,
      volume: 0.15,
      pattern: [
        [C4,16], [F4,16],
        [G4,16], [C4,16],
      ],
    },
    {
      instrument: ARP,
      volume: 0.12,
      pattern: [
        [C5,2], [E5,2], [G5,2], [E5,2],
        [C5,2], [E5,2], [G5,2], [C6,2],
        [R,4], [G5,2], [E5,2],
        [C5,2], [R,2], [E5,2], [R,2],
      ],
    },
  ],
};

// ── Work: Focused, driven (A minor, 100 BPM) ────────────────────────

const workSong: Song = {
  name: 'work',
  bpm: 100,
  tracks: [
    {
      instrument: SINE_LEAD,
      volume: 0.3,
      pattern: [
        [A4,4], [C5,4], [E5,4], [D5,4],
        [C5,4], [B4,4], [A4,4], [R,4],
        [E4,4], [A4,4], [B4,4], [C5,4],
        [D5,4], [C5,4], [B4,2], [A4,2], [G4,4],
        [A4,4], [C5,4], [E5,8],
        [D5,4], [C5,4], [A4,8],
      ],
    },
    {
      instrument: BASS,
      volume: 0.35,
      pattern: [
        [A2,4], [A2,4], [E2,4], [E2,4],
        [F2,4], [F2,4], [G2,4], [G2,4],
        [A2,4], [R,4], [A2,4], [E2,4],
        [F2,4], [G2,4], [A2,8],
      ],
    },
    {
      instrument: PAD,
      volume: 0.12,
      pattern: [
        [A3,16], [F3,16],
        [G3,16], [A3,16],
      ],
    },
  ],
};

// ── Blog: Thoughtful, jazzy (G major, 72 BPM) ───────────────────────

const blogSong: Song = {
  name: 'blog',
  bpm: 72,
  tracks: [
    {
      instrument: SINE_LEAD,
      volume: 0.25,
      pattern: [
        [G4,4], [R,4], [B4,4], [D5,4],
        [E5,6], [D5,2], [B4,4], [R,4],
        [A4,4], [G4,4], [R,4], [B4,4],
        [C5,4], [D5,8], [R,4],
        [E5,4], [R,4], [G5,4], [D5,4],
        [B4,8], [G4,4], [R,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.3,
      pattern: [
        [G2,8], [D3,8],
        [C3,8], [G2,8],
        [E2,8], [B2,8],
        [C3,8], [D3,8],
      ],
    },
    {
      instrument: PAD,
      volume: 0.15,
      pattern: [
        [G3,16], [C4,16],
        [D4,16], [G3,16],
      ],
    },
  ],
};

// ── Books: Peaceful, classical (F major, 60 BPM) ────────────────────

const booksSong: Song = {
  name: 'books',
  bpm: 60,
  tracks: [
    {
      instrument: SINE_LEAD,
      volume: 0.2,
      pattern: [
        [F4,8], [R,4], [A4,4],
        [C5,8], [R,8],
        [Bb4,4], [A4,4], [G4,4], [R,4],
        [F4,8], [R,8],
        [A4,4], [R,4], [C5,4], [R,4],
        [D5,8], [C5,4], [R,4],
        [Bb4,4], [A4,4], [G4,4], [F4,4],
        [R,16],
      ],
    },
    {
      instrument: BASS,
      volume: 0.25,
      pattern: [
        [F2,16], [C3,16],
        [Bb2,16], [F2,16],
      ],
    },
    {
      instrument: PAD,
      volume: 0.12,
      pattern: [
        [F3,16], [Bb3,16],
        [C4,16], [F3,16],
      ],
    },
  ],
};

// ── Music: Groovy, funky (D minor, 110 BPM) ─────────────────────────

const musicSong: Song = {
  name: 'music',
  bpm: 110,
  tracks: [
    {
      instrument: TRIANGLE_LEAD,
      volume: 0.3,
      pattern: [
        [D5,2], [F5,2], [A5,4], [G5,2], [F5,2],
        [E5,4], [D5,2], [R,2], [C5,4],
        [D5,2], [R,2], [F5,4], [E5,2], [D5,2],
        [C5,4], [D5,4], [R,4], [R,4],
        [A4,2], [D5,2], [F5,2], [A5,2], [G5,4],
        [F5,4], [E5,4], [D5,8],
      ],
    },
    {
      instrument: BASS,
      volume: 0.35,
      pattern: [
        [D2,2], [R,2], [D3,2], [R,2], [A2,4], [G2,4],
        [F2,2], [R,2], [F2,2], [R,2], [C3,4], [R,4],
        [D2,2], [R,2], [D3,2], [R,2], [A2,4], [Bb2,4],
        [G2,4], [A2,4], [D2,4], [R,4],
      ],
    },
    {
      instrument: PAD,
      volume: 0.1,
      pattern: [
        [D4,16], [F4,16],
        [Bb3,16], [A3,16],
      ],
    },
  ],
};

// ── Movies: Cinematic, sweeping (D minor, 80 BPM) ───────────────────

const moviesSong: Song = {
  name: 'movies',
  bpm: 80,
  tracks: [
    {
      instrument: STRINGS,
      volume: 0.3,
      pattern: [
        [D4,8], [F4,8],
        [A4,4], [R,4], [Bb4,4], [A4,4],
        [G4,8], [F4,4], [R,4],
        [E4,8], [R,8],
        [D4,4], [F4,4], [A4,4], [D5,4],
        [C5,4], [Bb4,4], [A4,8],
        [R,8], [G4,4], [A4,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.25,
      pattern: [
        [D2,8], [D2,8],
        [Bb2,8], [A2,8],
        [G2,8], [A2,8],
        [D2,16],
      ],
    },
    {
      instrument: PAD,
      volume: 0.18,
      pattern: [
        [D3,16], [Bb3,16],
        [G3,16], [A3,16],
      ],
    },
  ],
};

// ── TV: Pop, catchy (Bb major, 95 BPM) ──────────────────────────────

const tvSong: Song = {
  name: 'tv',
  bpm: 95,
  tracks: [
    {
      instrument: TRIANGLE_LEAD,
      volume: 0.3,
      pattern: [
        [Bb4,4], [D5,4], [F5,4], [D5,4],
        [Eb5,4], [D5,4], [C5,4], [R,4],
        [Bb4,4], [C5,4], [D5,4], [F5,4],
        [Eb5,4], [D5,4], [Bb4,8],
        [F4,4], [Bb4,4], [D5,4], [F5,4],
        [Eb5,8], [D5,4], [C5,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.3,
      pattern: [
        [Bb2,4], [Bb2,4], [F2,4], [F2,4],
        [Eb3,4], [Eb3,4], [Bb2,4], [R,4],
        [Bb2,4], [R,4], [F2,4], [F2,4],
        [Eb3,4], [F2,4], [Bb2,8],
      ],
    },
    {
      instrument: PAD,
      volume: 0.12,
      pattern: [
        [Bb3,16], [Eb4,16],
        [F4,16], [Bb3,16],
      ],
    },
  ],
};

// ── Anime: J-pop energy (E minor, 120 BPM) ──────────────────────────

const animeSong: Song = {
  name: 'anime',
  bpm: 120,
  tracks: [
    {
      instrument: TRIANGLE_LEAD,
      volume: 0.3,
      pattern: [
        [E5,2], [G5,2], [B5,4], [A5,2], [G5,2],
        [E5,4], [D5,2], [E5,2], [G5,4],
        [A5,2], [B5,2], [A5,2], [G5,2], [E5,4],
        [D5,4], [E5,4], [R,4],
        [B4,2], [D5,2], [E5,2], [G5,2], [A5,4],
        [G5,2], [E5,2], [D5,4], [B4,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.35,
      pattern: [
        [E2,2], [E2,2], [E3,2], [R,2], [B2,4], [A2,4],
        [G2,2], [G2,2], [G2,2], [R,2], [D3,4], [R,4],
        [E2,2], [E2,2], [E3,2], [R,2], [B2,2], [A2,2], [G2,4],
        [A2,4], [B2,4], [E2,4], [R,4],
      ],
    },
    {
      instrument: ARP,
      volume: 0.15,
      pattern: [
        [E5,2], [G5,2], [B5,2], [G5,2],
        [E5,2], [B4,2], [E5,2], [G5,2],
        [A5,2], [E5,2], [A5,2], [B5,2],
        [G5,2], [E5,2], [D5,2], [R,2],
      ],
    },
  ],
};

// ── Games: Chiptune/8-bit (C major, 140 BPM) ────────────────────────

const gamesSong: Song = {
  name: 'games',
  bpm: 140,
  tracks: [
    {
      instrument: SQUARE_LEAD,
      volume: 0.25,
      pattern: [
        [C5,2], [E5,2], [G5,4], [E5,2], [C5,2],
        [D5,2], [F5,2], [A5,4], [G5,4],
        [E5,2], [G5,2], [C6,4], [B5,2], [A5,2],
        [G5,4], [E5,4], [C5,4], [R,4],
        [G5,2], [A5,2], [B5,2], [C6,2], [B5,2], [A5,2], [G5,4],
        [E5,4], [D5,4], [C5,8],
      ],
    },
    {
      instrument: BASS,
      volume: 0.3,
      pattern: [
        [C3,2], [R,2], [C3,2], [R,2], [G2,2], [R,2], [G2,2], [R,2],
        [F2,2], [R,2], [F2,2], [R,2], [E2,2], [R,2], [G2,2], [R,2],
        [C3,2], [R,2], [E2,2], [R,2], [F2,2], [R,2], [G2,2], [R,2],
        [A2,2], [R,2], [G2,2], [R,2], [C3,4], [R,4],
      ],
    },
    {
      instrument: SQUARE_ARP,
      volume: 0.15,
      pattern: [
        [C6,1], [E5,1], [G5,1], [C6,1], [E5,1], [G5,1], [C6,1], [R,1],
        [F5,1], [A5,1], [C6,1], [F5,1], [A5,1], [C6,1], [R,1], [R,1],
        [G5,1], [B5,1], [D5,1], [G5,1], [B5,1], [D5,1], [G5,1], [R,1],
        [C5,1], [E5,1], [G5,1], [C6,1], [R,2], [R,2],
      ],
    },
  ],
};

// ── Climbing: Rock, intense (A minor, 130 BPM) ──────────────────────

const climbingSong: Song = {
  name: 'climbing',
  bpm: 130,
  tracks: [
    {
      instrument: SAW_LEAD,
      volume: 0.25,
      pattern: [
        [A4,4], [C5,4], [D5,2], [E5,2], [R,4],
        [E5,4], [D5,4], [C5,4], [A4,4],
        [G4,2], [A4,2], [C5,4], [E5,4], [G5,4],
        [E5,4], [D5,4], [A4,8],
        [R,4], [A4,2], [C5,2], [D5,4], [E5,4],
        [G5,4], [E5,4], [D5,4], [C5,4],
      ],
    },
    {
      instrument: POWER_BASS,
      volume: 0.35,
      pattern: [
        [A2,2], [R,2], [A2,2], [R,2], [A2,2], [R,2], [G2,2], [R,2],
        [F2,2], [R,2], [F2,2], [R,2], [E2,4], [R,4],
        [A2,2], [R,2], [A2,2], [R,2], [C3,2], [R,2], [D3,2], [R,2],
        [E2,4], [R,4], [A2,4], [R,4],
      ],
    },
    {
      instrument: PAD,
      volume: 0.1,
      pattern: [
        [A3,16], [F3,16],
        [E3,16], [A3,16],
      ],
    },
  ],
};

// ── Pets: Playful, bouncy (F major, 105 BPM) ────────────────────────

const petsSong: Song = {
  name: 'pets',
  bpm: 105,
  tracks: [
    {
      instrument: SINE_LEAD,
      volume: 0.3,
      pattern: [
        [F4,2], [A4,2], [C5,4], [A4,2], [F4,2],
        [G4,4], [A4,4], [Bb4,4], [R,4],
        [C5,2], [D5,2], [C5,2], [Bb4,2], [A4,4],
        [G4,4], [F4,4], [R,4], [R,4],
        [A4,2], [Bb4,2], [C5,4], [D5,4],
        [C5,4], [Bb4,4], [A4,4], [F4,4],
      ],
    },
    {
      instrument: BASS,
      volume: 0.3,
      pattern: [
        [F2,4], [F2,4], [C3,4], [C3,4],
        [Bb2,4], [Bb2,4], [F2,4], [R,4],
        [F2,4], [A2,4], [Bb2,4], [C3,4],
        [F2,8], [R,8],
      ],
    },
    {
      instrument: ARP,
      volume: 0.12,
      pattern: [
        [F5,2], [A5,2], [C5,2], [A5,2],
        [F5,2], [R,2], [A5,2], [C5,2],
        [Bb4,2], [D5,2], [F5,2], [R,2],
        [C5,2], [F5,2], [A5,2], [R,2],
      ],
    },
  ],
};

// ── Euler: Mathematical, clean (C Pythagorean, 66 BPM) ──────────────
// Fibonacci-inspired intervals between notes: 1,1,2,3,5,8...semitones

const eulerSong: Song = {
  name: 'euler',
  bpm: 66,
  tracks: [
    {
      instrument: SINE_LEAD,
      volume: 0.2,
      pattern: [
        // Fibonacci intervals from C4: +1, +1, +2, +3, +5, +8 semitones
        [C4,8], [R,4], [D4,8], [R,4],
        [E4,8], [R,8],
        [G4,8], [R,4], [C5,8], [R,4],
        [R,8], [E4,8],
        [G4,8], [R,8],
        [C4,8], [R,8],
      ],
    },
    {
      instrument: BASS,
      volume: 0.2,
      pattern: [
        [C2,16], [G2,16],
        [E2,16], [C2,16],
      ],
    },
    {
      instrument: PAD,
      volume: 0.1,
      pattern: [
        [C3,16], [G3,16],
        [E3,16], [C3,16],
      ],
    },
  ],
};

// ── Path mapping ─────────────────────────────────────────────────────

const songs: Record<string, Song> = {
  home: homeSong,
  work: workSong,
  blog: blogSong,
  books: booksSong,
  music: musicSong,
  movies: moviesSong,
  tv: tvSong,
  anime: animeSong,
  games: gamesSong,
  climbing: climbingSong,
  pets: petsSong,
  euler: eulerSong,
};

const pathSongMap: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/work/, 'work'],
  [/^\/projects/, 'work'],
  [/^\/blog/, 'blog'],
  [/^\/papers/, 'blog'],
  [/^\/books/, 'books'],
  [/^\/music/, 'music'],
  [/^\/movies/, 'movies'],
  [/^\/tv/, 'tv'],
  [/^\/anime/, 'anime'],
  [/^\/games/, 'games'],
  [/^\/climbing/, 'climbing'],
  [/^\/pets/, 'pets'],
  [/^\/euler/, 'euler'],
];

export function getSongKeyForPath(pathname: string): string {
  for (const [pattern, key] of pathSongMap) {
    if (pattern.test(pathname)) {
      return key;
    }
  }
  return 'home';
}

export function getSongForPath(pathname: string): Song {
  return songs[getSongKeyForPath(pathname)];
}
