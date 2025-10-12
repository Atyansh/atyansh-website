// Nintendo Switch data integration via Exophase scraping
// Nintendo doesn't provide an official API, so we scrape Exophase for gaming stats
// Note: Game cover art is fetched via IGDB API in unified-games.ts

export interface NintendoGame {
  titleId: string;
  name: string;
  imageUri?: string;
  totalPlayTime: number; // in seconds
  firstPlayedAt?: number; // timestamp
  lastPlayedAt?: number; // timestamp
}

export interface NintendoStats {
  recentGames: NintendoGame[];
  totalGames: number;
  totalHoursPlayed: number;
  mostPlayedGame?: NintendoGame;
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
    console.error('Error fetching Nintendo stats:', error.message || error);
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

/**
 * Format play time to hours
 */
export function formatPlayTimeHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${hours.toFixed(1)}h`;
}
