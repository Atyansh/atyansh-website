// PlayStation Network API integration using psn-api
// Documentation: https://github.com/achievements-app/psn-api

import {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getUserTitles,
  type AuthTokensResponse,
} from 'psn-api';
import { withRetry } from './retry';

const PSN_NPSSO = import.meta.env.PSN_NPSSO;

// Cache configuration
const CACHE_DIR = '.cache';
const PSN_CACHE_FILE = '.cache/psn-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

let cachedAuth: AuthTokensResponse | null = null;

export interface PSNGame {
  titleId: string;
  name: string;
  category: string;
  playDuration?: string;
  lastPlayedDateTime?: string;
  earnedTrophies?: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

export interface PSNStats {
  totalGames: number;
  totalTrophies: {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
  trophyLevel?: number;
}

interface PSNData {
  games: PSNGame[];
  stats: PSNStats;
  timestamp: number;
}

// In-memory cache
let memoryCache: PSNData | null = null;

/**
 * Load PSN cache from disk
 */
async function loadCache(): Promise<PSNData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(PSN_CACHE_FILE, 'utf-8');
    const cached: PSNData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached PSN data');
      return cached;
    }

    console.log('PSN cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save PSN cache to disk
 */
async function saveCache(data: PSNData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(PSN_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved PSN data to cache');
  } catch (error) {
    console.error('Failed to save PSN cache:', error);
  }
}

/**
 * Get PSN authorization tokens
 * Includes retry logic for transient failures
 */
async function getPSNAuth(): Promise<AuthTokensResponse | null> {
  if (!PSN_NPSSO) {
    console.error('PSN NPSSO token not configured');
    return null;
  }

  // Return cached auth if still valid (tokens last 1 hour)
  if (cachedAuth) {
    return cachedAuth;
  }

  try {
    const authorization = await withRetry(
      async () => {
        // Exchange NPSSO for authorization code
        const accessCode = await exchangeNpssoForCode(PSN_NPSSO);
        // Exchange code for access token
        return await exchangeCodeForAccessToken(accessCode);
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          console.log(`PSN auth retry ${attempt}: ${error.message}`);
        },
      }
    );

    cachedAuth = authorization;
    return authorization;
  } catch (error) {
    console.error('Error getting PSN authorization:', error);
    return null;
  }
}

/**
 * Get user's played titles
 * Includes retry logic for transient failures
 */
export async function getPSNTitles(): Promise<PSNGame[]> {
  try {
    const auth = await getPSNAuth();
    if (!auth) {
      return [];
    }

    // Get titles for the authenticated user with retry logic
    const response = await withRetry(
      () => getUserTitles(
        { accessToken: auth.accessToken },
        'me',
        {
          limit: 50, // Get last 50 games
        }
      ),
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          console.log(`PSN titles retry ${attempt}: ${error.message}`);
        },
      }
    );

    // Transform the response to our format
    const games: PSNGame[] = response.trophyTitles.map((title: any) => {
      // PSN API doesn't provide playtime in trophy data
      // We'll leave it undefined for now
      let playDuration: string | undefined = undefined;

      return {
        titleId: title.npCommunicationId,
        name: title.trophyTitleName,
        category: title.trophyTitlePlatform || 'Unknown',
        lastPlayedDateTime: title.lastUpdatedDateTime,
        earnedTrophies: title.earnedTrophies ? {
          bronze: title.earnedTrophies.bronze || 0,
          silver: title.earnedTrophies.silver || 0,
          gold: title.earnedTrophies.gold || 0,
          platinum: title.earnedTrophies.platinum || 0,
        } : undefined,
        playDuration,
      };
    });

    return games;
  } catch (error) {
    console.error('Error fetching PSN titles:', error);
    return [];
  }
}

/**
 * Get PSN gaming stats
 */
export async function getPSNStats(): Promise<PSNStats | null> {
  // Check cache first
  const cached = await loadCache();
  if (cached) {
    return cached.stats;
  }

  // Get fresh data from PSN
  console.log('Fetching PSN data...');

  try {
    const auth = await getPSNAuth();
    if (!auth) {
      console.error('Failed to get PSN authorization');
      return null;
    }

    const titles = await getPSNTitles();

    if (titles.length === 0) {
      console.error('No PSN titles found');
      return null;
    }

    // Calculate total trophies across all games
    const totalTrophies = titles.reduce((acc, game) => {
      if (game.earnedTrophies) {
        acc.platinum += game.earnedTrophies.platinum;
        acc.gold += game.earnedTrophies.gold;
        acc.silver += game.earnedTrophies.silver;
        acc.bronze += game.earnedTrophies.bronze;
      }
      return acc;
    }, { platinum: 0, gold: 0, silver: 0, bronze: 0, total: 0 });

    totalTrophies.total = totalTrophies.platinum + totalTrophies.gold +
                          totalTrophies.silver + totalTrophies.bronze;

    const stats: PSNStats = {
      totalGames: titles.length,
      totalTrophies,
    };

    // Save to cache
    const data: PSNData = {
      games: titles,
      stats,
      timestamp: Date.now(),
    };
    await saveCache(data);

    console.log(`✓ Fetched PSN data: ${stats.totalGames} games, ${totalTrophies.total} trophies`);

    return stats;
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return null;
  }
}

