// PlayStation Network API integration using psn-api
// Documentation: https://github.com/achievements-app/psn-api

import {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getUserTitles,
  type AuthTokensResponse,
} from 'psn-api';
import { withRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const PSN_NPSSO = import.meta.env.PSN_NPSSO;
const PSN_ACCESS_TOKEN = import.meta.env.PSN_ACCESS_TOKEN;

const log = createLogger('PSN');
const cache = new FileCache<PSNData>('psn-data', { ttl: 24 * 60 * 60 * 1000 });

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

/**
 * Get PSN authorization tokens
 * Includes retry logic for transient failures
 */
async function getPSNAuth(): Promise<AuthTokensResponse | null> {
  if (cachedAuth) {
    return cachedAuth;
  }

  // Prefer the access token refreshed by scripts/refresh-tokens.cjs — that path
  // uses the refresh token (~10d) instead of the fragile NPSSO, which can be
  // invalidated whenever the user logs out of PSN anywhere.
  if (PSN_ACCESS_TOKEN) {
    cachedAuth = { accessToken: PSN_ACCESS_TOKEN } as AuthTokensResponse;
    return cachedAuth;
  }

  // Fallback: bootstrap from NPSSO directly. Should only happen if the
  // refresh script didn't run or failed (e.g. first-time local setup).
  if (!PSN_NPSSO) {
    log.error('Neither PSN_ACCESS_TOKEN nor PSN_NPSSO configured');
    return null;
  }

  try {
    const authorization = await withRetry(
      async () => {
        const accessCode = await exchangeNpssoForCode(PSN_NPSSO);
        return await exchangeCodeForAccessToken(accessCode);
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`PSN auth retry ${attempt}: ${error.message}`);
        },
      }
    );

    cachedAuth = authorization;
    return authorization;
  } catch (error) {
    log.error('Error getting PSN authorization:', error);
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
          log.info(`PSN titles retry ${attempt}: ${error.message}`);
        },
      }
    );

    // Transform the response to our format
    const games: PSNGame[] = response.trophyTitles.map((title: any) => ({
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
      playDuration: undefined,
    }));

    return games;
  } catch (error) {
    log.error('Error fetching PSN titles:', error);
    return [];
  }
}

/**
 * Get PSN games and stats together (avoids double-fetching titles)
 */
export async function getPSNData(): Promise<{ games: PSNGame[]; stats: PSNStats } | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return { games: cached.games, stats: cached.stats };
  }

  // Get fresh data from PSN
  log.info('Fetching PSN data...');

  try {
    const titles = await getPSNTitles();

    if (titles.length === 0) {
      log.error('No PSN titles found');
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
    await cache.set(data);

    log.info(`Fetched PSN data: ${stats.totalGames} games, ${totalTrophies.total} trophies`);

    return { games: titles, stats };
  } catch (error) {
    log.error('Error fetching PSN data:', error);
    return null;
  }
}

/**
 * Get PSN gaming stats only
 */
export async function getPSNStats(): Promise<PSNStats | null> {
  const data = await getPSNData();
  return data?.stats ?? null;
}
