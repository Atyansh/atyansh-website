// Steam Web API integration
// Documentation: https://steamwebapi.azurewebsites.net/

import { fetchWithRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const log = createLogger('Steam');

const STEAM_API_KEY = import.meta.env.STEAM_API_KEY;
const STEAM_ID = import.meta.env.STEAM_ID;
const BASE_URL = 'https://api.steampowered.com';

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number; // Total playtime in minutes
  rtime_last_played?: number; // Unix timestamp of last played
}

interface PlayerSummary {
  gameextrainfo?: string; // Currently playing game name
}

export interface SteamStats {
  topPlayedGames: SteamGame[];
  totalGames: number;
  totalHoursPlayed: number;
  playerSummary: PlayerSummary;
  gamesPlayedCount: number; // Games with playtime > 0
}

interface SteamData {
  games: SteamGame[];
  stats: SteamStats;
  timestamp: number;
}

const cache = new FileCache<SteamData>('steam-data', {
  ttl: 24 * 60 * 60 * 1000,
});

/**
 * Fetch player summary (profile info, online status, currently playing)
 * Includes retry logic for transient failures
 */
async function getPlayerSummary(): Promise<PlayerSummary | null> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    log.error('Steam API key or Steam ID not configured');
    return null;
  }

  try {
    const response = await fetchWithRetry(
      `${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${STEAM_ID}`,
      undefined,
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`Player summary retry ${attempt}: ${error.message}`);
        },
      }
    );
    const data = await response.json();

    if (data.response?.players?.length > 0) {
      return data.response.players[0];
    }
    return null;
  } catch (error) {
    log.error('Error fetching Steam player summary:', error);
    return null;
  }
}

/**
 * Fetch all owned games with playtime
 * Includes retry logic for transient failures
 */
async function getOwnedGames(): Promise<SteamGame[]> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    log.error('Steam API key or Steam ID not configured');
    return [];
  }

  try {
    const response = await fetchWithRetry(
      `${BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=true&include_played_free_games=true`,
      undefined,
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`Owned games retry ${attempt}: ${error.message}`);
        },
      }
    );
    const data = await response.json();

    return data.response?.games || [];
  } catch (error) {
    log.error('Error fetching owned games:', error);
    return [];
  }
}

/**
 * Get comprehensive Steam stats
 */
export async function getSteamStats(): Promise<SteamStats | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached.stats;
  }

  // Get fresh data from Steam
  log.info('Fetching Steam data...');

  try {
    const [playerSummary, ownedGames] = await Promise.all([
      getPlayerSummary(),
      getOwnedGames(),
    ]);

    if (!playerSummary) {
      log.error('Failed to get Steam player summary');
      return null;
    }

    // Calculate total hours played across all games
    const totalMinutes = ownedGames.reduce((sum, game) => sum + game.playtime_forever, 0);
    const totalHoursPlayed = Math.round(totalMinutes / 60);

    // Get games that have been played (playtime > 0), sorted by last played date
    const playedGames = ownedGames
      .filter(game => game.playtime_forever > 0)
      .sort((a, b) => (b.rtime_last_played || 0) - (a.rtime_last_played || 0));

    const stats: SteamStats = {
      topPlayedGames: playedGames,
      totalGames: ownedGames.length,
      totalHoursPlayed,
      playerSummary,
      gamesPlayedCount: playedGames.length,
    };

    // Save to cache
    const data: SteamData = {
      games: ownedGames,
      stats,
      timestamp: Date.now(),
    };
    await cache.set(data);

    log.info(`Fetched Steam data: ${stats.totalGames} games, ${stats.totalHoursPlayed} hours played`);

    return stats;
  } catch (error) {
    log.error('Error fetching Steam stats:', error);
    return null;
  }
}

/**
 * Get Steam game capsule image fallback URLs
 */
export function getGameCapsuleFallbacks(appid: number): string[] {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://media.steampowered.com/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
  ];
}
