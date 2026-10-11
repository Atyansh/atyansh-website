// world-data.json — produced at build time by scripts/build-world-data.cjs
// from the site's API caches. Every image is self-hosted under /world/art/.

export interface ArtItem {
  title: string;
  art: string;
  year?: number;
  /** music: artist · books: author */
  artist?: string;
  author?: string;
  /** games: hours played */
  hours?: number;
  /** anime: episodes watched / total, MAL status */
  episodes?: number;
  watched?: number;
  status?: string;
  date?: string;
  blurb?: string;
}

export interface ClimbVideo {
  grade: string;
  date: string;
  gym: string;
  video: string;
  thumb?: string;
}

export interface WorldData {
  movies?: ArtItem[];
  tv?: ArtItem[];
  music?: ArtItem[];
  games?: ArtItem[];
  books?: ArtItem[];
  anime?: ArtItem[];
  topTracks?: Array<{ title: string; artist: string }>;
  topArtists?: string[];
  climbing?: Array<{ grade: string; count: number }>;
  climbStats?: { totalSends: number; totalFlashes: number; flashRate: number; maxGrade: string; totalVideos: number };
  climbVideos?: ClimbVideo[];
  projects?: Array<{ title: string; description?: string; tech: string[]; featured: boolean; start?: string }>;
  posts?: Array<{ title: string; description?: string; date?: string }>;
  euler?: Array<{ n: number; title: string; difficulty?: number }>;
  pets?: Array<{ name: string; species: string; breed: string; birthday?: string; favorites: string[] }>;
  generatedAt?: string;
}

export async function loadWorldData(): Promise<WorldData> {
  try {
    const r = await fetch('/world/world-data.json');
    return r.ok ? ((await r.json()) as WorldData) : {};
  } catch {
    return {};
  }
}
