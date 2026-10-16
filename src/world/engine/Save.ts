// localStorage-backed save. Everything is optional + defaulted so old saves
// keep loading as fields are added; storage failures (private mode) degrade
// to an in-memory session.

const KEY = 'the-block-save-v2';

export interface Settings {
  sensitivity: number;
  invertY: boolean;
  fov: number;
  music: number;
  sfx: number;
  ambience: number;
  timeOfDay: 'day' | 'sunset' | 'dusk' | 'night';
  showFps: boolean;
  outfit: string;
}

export interface SaveData {
  version: 2;
  started: boolean;
  /** goal/progress flags, e.g. "visited:cinema", "pet:baobao" */
  flags: Record<string, boolean>;
  /** counters, e.g. "fetch" */
  counters: Record<string, number>;
  collectibles: string[];
  gachaCards: string[];
  arcadeBest: number;
  rewards: string[];
  settings: Settings;
  lastPosition?: { level: string; x: number; y: number; z: number; yaw: number };
  playSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  invertY: false,
  fov: 62,
  music: 0.55,
  sfx: 0.8,
  ambience: 0.6,
  timeOfDay: 'day',
  showFps: false,
  outfit: 'classic',
};

function fresh(): SaveData {
  return {
    version: 2, started: false, flags: {}, counters: {}, collectibles: [], gachaCards: [],
    arcadeBest: 0, rewards: [], settings: { ...DEFAULT_SETTINGS }, playSeconds: 0,
  };
}

export class Save {
  data: SaveData;

  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = { ...fresh(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } };
      }
    } catch { /* corrupt or unavailable — start fresh */ }
  }

  get settings(): Settings { return this.data.settings; }

  flag(k: string): boolean { return !!this.data.flags[k]; }

  /** Returns true if the flag was newly set */
  setFlag(k: string): boolean {
    if (this.data.flags[k]) return false;
    this.data.flags[k] = true;
    this.write();
    return true;
  }

  count(k: string): number { return this.data.counters[k] ?? 0; }

  bump(k: string, by = 1): number {
    this.data.counters[k] = this.count(k) + by;
    this.write();
    return this.data.counters[k];
  }

  write(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  }
}
