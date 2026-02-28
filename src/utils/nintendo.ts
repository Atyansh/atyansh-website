// Nintendo Switch data integration via Exophase scraping
// Nintendo doesn't provide an official API, so we scrape Exophase for gaming stats
// Note: Game cover art is fetched via IGDB API in unified-games.ts

import { createLogger } from './logger';

const log = createLogger('Nintendo');

export interface NintendoGame {
  titleId: string;
  name: string;
  imageUri?: string;
  totalPlayTime: number; // in seconds
  lastPlayedAt?: number; // timestamp
}

export interface NintendoStats {
  recentGames: NintendoGame[];
  totalGames: number;
  totalHoursPlayed: number;
}

/**
 * Get Nintendo Switch gaming stats from Exophase
 * Note: Images are now fetched via IGDB in unified-games.ts
 */
export async function getNintendoStats(): Promise<NintendoStats | null> {
  try {
    // Check cache first
    const { getCachedNintendoStats, cacheNintendoStats, scrapeExophaseNintendoStats } = await import('./exophase-scraper');

    const cachedStats = await getCachedNintendoStats();
    if (cachedStats) {
      return cachedStats;
    }

    // No cache, fetch fresh data from Exophase
    const stats = await scrapeExophaseNintendoStats();

    if (stats) {
      await cacheNintendoStats(stats);
    }

    return stats;
  } catch (error: any) {
    log.error('Error fetching Nintendo stats:', error.message || error);
    return null;
  }
}

/**
 * Format play time from seconds to human-readable format
 */
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

