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

// getUserTitles returns at most 800 per call; page so the totals cover the
// whole trophy list rather than the 50 most recent titles
const TITLES_PAGE_SIZE = 200;
const TITLES_MAX_PAGES = 20; // runaway guard: 4000 titles

/**
 * Get every title on the user's trophy list
 * Includes retry logic for transient failures. Throws on failure so an
 * unreachable list isn't mistaken for an empty one.
 */
async function getPSNTitles(): Promise<PSNGame[]> {
  const auth = await getPSNAuth();
  if (!auth) {
    throw new Error('No PSN authorization');
  }

  const titles: any[] = [];
  let offset = 0;
  for (let page = 0; page < TITLES_MAX_PAGES; page++) {
    const response = await withRetry(
      () => getUserTitles(
        { accessToken: auth.accessToken },
        'me',
        { limit: TITLES_PAGE_SIZE, offset }
      ),
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`PSN titles retry ${attempt} (offset ${offset}): ${error.message}`);
        },
      }
    );

    // psn-api resolves (rather than throws) with { error } on an API error
    if (!Array.isArray(response?.trophyTitles)) {
      const detail = (response as any)?.error?.message;
      throw new Error(`PSN titles at offset ${offset} returned no trophyTitles${detail ? `: ${detail}` : ''}`);
    }

    titles.push(...response.trophyTitles);
    const next = response.nextOffset;
    if (!next || next <= offset || titles.length >= response.totalItemCount || response.trophyTitles.length === 0) {
      break;
    }
    if (page === TITLES_MAX_PAGES - 1) {
      log.error(`PSN trophy list still had more titles after ${TITLES_MAX_PAGES} pages; using the first ${titles.length}`);
    }
    offset = next;
  }

  // Transform the response to our format
  return titles.map((title: any) => ({
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
}

async function psnFallback(): Promise<{ games: PSNGame[]; stats: PSNStats } | null> {
  const stale = await cache.fallback('PSN');
  return stale ? { games: stale.games, stats: stale.stats } : null;
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
      return psnFallback();
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

    // Save to cache, unless the list sharply shrank
    const data: PSNData = {
      games: titles,
      stats,
      timestamp: Date.now(),
    };
    await cache.setIfPlausible('PSN', data, d => d.games.length);

    log.info(`Fetched PSN data: ${stats.totalGames} games, ${totalTrophies.total} trophies`);

    return { games: titles, stats };
  } catch (error) {
    log.error('Error fetching PSN data:', error);
    return psnFallback();
  }
}

