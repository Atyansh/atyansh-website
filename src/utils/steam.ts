// Steam Web API integration
// Documentation: https://steamwebapi.azurewebsites.net/

import { fetchWithRetry } from './retry';

const STEAM_API_KEY = import.meta.env.STEAM_API_KEY;
const STEAM_ID = import.meta.env.STEAM_ID;
const BASE_URL = 'https://api.steampowered.com';

// Cache configuration
const CACHE_DIR = '.cache';
const STEAM_CACHE_FILE = '.cache/steam-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

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

// In-memory cache
let memoryCache: SteamData | null = null;

/**
 * Load Steam cache from disk
 */
async function loadCache(): Promise<SteamData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(STEAM_CACHE_FILE, 'utf-8');
    const cached: SteamData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached Steam data');
      return cached;
    }

    console.log('Steam cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Steam cache to disk
 */
async function saveCache(data: SteamData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(STEAM_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved Steam data to cache');
  } catch (error) {
    console.error('Failed to save Steam cache:', error);
  }
}

/**
 * Fetch player summary (profile info, online status, currently playing)
 * Includes retry logic for transient failures
 */
async function getPlayerSummary(): Promise<PlayerSummary | null> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.error('Steam API key or Steam ID not configured');
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
          console.log(`Steam player summary retry ${attempt}: ${error.message}`);
        },
      }
    );
    const data = await response.json();

    if (data.response?.players?.length > 0) {
      return data.response.players[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching Steam player summary:', error);
    return null;
  }
}

/**
 * Fetch all owned games with playtime
 * Includes retry logic for transient failures
 */
async function getOwnedGames(): Promise<SteamGame[]> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.error('Steam API key or Steam ID not configured');
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
          console.log(`Steam owned games retry ${attempt}: ${error.message}`);
        },
      }
    );
    const data = await response.json();

    return data.response?.games || [];
  } catch (error) {
    console.error('Error fetching owned games:', error);
    return [];
  }
}

/**
 * Get comprehensive Steam stats
 */
export async function getSteamStats(): Promise<SteamStats | null> {
  // Check cache first
  const cached = await loadCache();
  if (cached) {
    return cached.stats;
  }

  // Get fresh data from Steam
  console.log('Fetching Steam data...');

  try {
    const [playerSummary, ownedGames] = await Promise.all([
      getPlayerSummary(),
      getOwnedGames(),
    ]);

    if (!playerSummary) {
      console.error('Failed to get Steam player summary');
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
    await saveCache(data);

    console.log(`✓ Fetched Steam data: ${stats.totalGames} games, ${stats.totalHoursPlayed} hours played`);

    return stats;
  } catch (error) {
    console.error('Error fetching Steam stats:', error);
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
