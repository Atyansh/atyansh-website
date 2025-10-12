// Unified game data structure combining Steam, PSN, and Nintendo
import { getSteamStats, type SteamGame } from './steam';
import { getPSNTitles, type PSNGame } from './psn';
import { getNintendoStats, type NintendoGame } from './nintendo';
import { getIGDBCoverUrl } from './igdb';

export type Platform = 'steam' | 'psn' | 'nintendo';

export interface UnifiedGame {
  id: string; // Unique identifier combining platform + game ID
  name: string;
  platform: Platform;
  image: string; // Card/thumbnail image
  headerImage?: string; // Larger header image for modal

  // Platform-specific data
  steamData?: {
    appid: number;
    playtimeMinutes: number;
    playtime2Weeks?: number;
  };

  psnData?: {
    titleId: string;
    category: string;
    playDuration?: string;
    lastPlayed?: string;
    trophies?: {
      bronze: number;
      silver: number;
      gold: number;
      platinum: number;
      total: number;
    };
  };

  nintendoData?: {
    titleId: string;
    playtimeSeconds: number;
    lastPlayed?: number;
  };
}

/**
 * Combine games from all platforms into a unified list with IGDB cover art
 */
export async function getAllGames(): Promise<UnifiedGame[]> {
  const [steamStats, psnGames, nintendoStats] = await Promise.all([
    getSteamStats(),
    getPSNTitles(),
    getNintendoStats(),
  ]);

  const unifiedGames: UnifiedGame[] = [];

  // Add Steam games
  if (steamStats) {
    console.log('Fetching IGDB covers for Steam games...');
    const steamGames = await Promise.all(
      steamStats.topPlayedGames.map(async (game: SteamGame): Promise<UnifiedGame> => {
        const igdbCover = await getIGDBCoverUrl(game.name, 'steam');
        return {
          id: `steam-${game.appid}`,
          name: game.name,
          platform: 'steam',
          image: igdbCover || undefined,
          headerImage: igdbCover || undefined,
          steamData: {
            appid: game.appid,
            playtimeMinutes: game.playtime_forever,
            playtime2Weeks: game.playtime_2weeks,
          },
        };
      })
    );
    unifiedGames.push(...steamGames);
  }

  // Add PSN games
  if (psnGames && psnGames.length > 0) {
    console.log('Fetching IGDB covers for PlayStation games...');
    const psnUnified = await Promise.all(
      psnGames.map(async (game: PSNGame): Promise<UnifiedGame> => {
        const igdbCover = await getIGDBCoverUrl(game.name, 'psn');
        return {
          id: `psn-${game.titleId}`,
          name: game.name,
          platform: 'psn',
          image: igdbCover || undefined,
          headerImage: igdbCover || undefined,
          psnData: {
            titleId: game.titleId,
            category: game.category,
            playDuration: game.playDuration,
            lastPlayed: game.lastPlayedDateTime,
            trophies: game.earnedTrophies ? {
              bronze: game.earnedTrophies.bronze,
              silver: game.earnedTrophies.silver,
              gold: game.earnedTrophies.gold,
              platinum: game.earnedTrophies.platinum,
              total: game.earnedTrophies.bronze + game.earnedTrophies.silver +
                     game.earnedTrophies.gold + game.earnedTrophies.platinum,
            } : undefined,
          },
        };
      })
    );
    unifiedGames.push(...psnUnified);
  }

  // Add Nintendo games
  if (nintendoStats && nintendoStats.recentGames.length > 0) {
    console.log('Fetching IGDB covers for Nintendo games...');
    const nintendoUnified = await Promise.all(
      nintendoStats.recentGames.map(async (game: NintendoGame): Promise<UnifiedGame> => {
        const igdbCover = await getIGDBCoverUrl(game.name, 'nintendo');
        return {
          id: `nintendo-${game.titleId}`,
          name: game.name,
          platform: 'nintendo',
          image: igdbCover || undefined,
          headerImage: igdbCover || undefined,
          nintendoData: {
            titleId: game.titleId,
            playtimeSeconds: game.totalPlayTime,
            lastPlayed: game.lastPlayedAt,
          },
        };
      })
    );
    unifiedGames.push(...nintendoUnified);
  }

  console.log(`Total games with IGDB covers: ${unifiedGames.filter(g => g.image).length}/${unifiedGames.length}`);
  return unifiedGames;
}

/**
 * Format playtime for display
 */
export function formatPlaytime(game: UnifiedGame): string {
  if (game.steamData) {
    const hours = Math.floor(game.steamData.playtimeMinutes / 60);
    if (hours < 1) {
      return `${game.steamData.playtimeMinutes}m`;
    }
    return `${hours}h`;
  }

  if (game.psnData && game.psnData.playDuration) {
    return game.psnData.playDuration;
  }

  if (game.nintendoData) {
    const hours = Math.floor(game.nintendoData.playtimeSeconds / 3600);
    if (hours < 1) {
      const minutes = Math.floor(game.nintendoData.playtimeSeconds / 60);
      return `${minutes}m`;
    }
    return `${hours}h`;
  }

  return 'N/A';
}

/**
 * Get platform display name
 */
export function getPlatformName(platform: Platform): string {
  switch (platform) {
    case 'steam':
      return 'Steam';
    case 'psn':
      return 'PlayStation';
    case 'nintendo':
      return 'Nintendo Switch';
  }
}

/**
 * Get platform color for badges
 */
export function getPlatformColor(platform: Platform): string {
  switch (platform) {
    case 'steam':
      return '#1b2838'; // Steam blue-black
    case 'psn':
      return '#003087'; // PlayStation blue
    case 'nintendo':
      return '#e60012'; // Nintendo red
  }
}
