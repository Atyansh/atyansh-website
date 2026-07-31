// TMDB TV integration
// Reads the "TV Shows I've Watched" list and show ratings from the user's TMDB
// account. Uses a v4 user access token, which is long-lived — no refresh flow needed.

import { fetchWithRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const TMDB_ACCESS_TOKEN = import.meta.env.TMDB_ACCESS_TOKEN;
const TMDB_ACCOUNT_OBJECT_ID = import.meta.env.TMDB_ACCOUNT_OBJECT_ID;
const TMDB_TV_LIST_ID = import.meta.env.TMDB_TV_LIST_ID;

const log = createLogger('TMDB');
const cache = new FileCache<TmdbTVData>('tmdb-tv-data', { ttl: 24 * 60 * 60 * 1000 });

// TV summary object as returned in v4 list/rated results
interface TmdbTVResult {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string;
  media_type?: string;
  account_rating?: {
    value: number;
  };
}

export interface TVShow {
  title: string;
  year: number;
  tmdbId: number;
  posterImage: string;
  firstAiredAt?: Date;
  rating?: number;
  link: string;
}

export interface TmdbTVData {
  shows: TVShow[];
  stats: {
    totalShows: number;
    rated: number;
    averageRating: number;
  };
  timestamp: number;
}

/**
 * Fetch all pages of a v4 endpoint that returns { results, total_pages }
 * Includes retry logic for transient failures
 */
async function fetchAllPages(endpoint: string): Promise<TmdbTVResult[]> {
  const results: TmdbTVResult[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await fetchWithRetry(
      `https://api.themoviedb.org/4${endpoint}${separator}page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        },
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`TMDB retry ${attempt} for ${endpoint} page ${page}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} for ${endpoint} page ${page}`);
    }

    const data = await response.json();
    results.push(...(data.results || []));
    totalPages = data.total_pages || 1;
    page++;
  }

  return results;
}

/**
 * Get all TV data for display: the watched list joined with account ratings
 */
export async function getTmdbTVData(): Promise<TmdbTVData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!TMDB_ACCESS_TOKEN || !TMDB_ACCOUNT_OBJECT_ID || !TMDB_TV_LIST_ID) {
    log.info('TMDB credentials not configured, skipping...');
    return null;
  }

  log.info('Fetching TV shows from TMDB...');

  try {
    // Fetch the watched list and the account's show ratings in parallel
    const [listItems, ratedShows] = await Promise.all([
      fetchAllPages(`/list/${TMDB_TV_LIST_ID}`),
      fetchAllPages(`/account/${TMDB_ACCOUNT_OBJECT_ID}/tv/rated`),
    ]);

    if (!listItems.length) {
      log.error('No shows found in TMDB list');
      return null;
    }

    const ratingsMap = new Map<number, number>();
    for (const rated of ratedShows) {
      if (rated.account_rating?.value) {
        ratingsMap.set(rated.id, rated.account_rating.value);
      }
    }

    const shows: TVShow[] = listItems
      .filter(item => item.media_type !== 'movie')
      .map(item => ({
        title: item.name,
        year: item.first_air_date ? parseInt(item.first_air_date.slice(0, 4), 10) : 0,
        tmdbId: item.id,
        posterImage: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : '',
        firstAiredAt: item.first_air_date ? new Date(item.first_air_date) : undefined,
        rating: ratingsMap.get(item.id),
        link: `https://www.themoviedb.org/tv/${item.id}`,
      }));

    // Sort by first air date (newest first) — the site's default sort order
    shows.sort((a, b) => (b.firstAiredAt?.getTime() || 0) - (a.firstAiredAt?.getTime() || 0));

    // Calculate stats
    const ratedList = shows.filter(s => s.rating && s.rating > 0);
    const averageRating = ratedList.length > 0
      ? ratedList.reduce((sum, s) => sum + (s.rating || 0), 0) / ratedList.length
      : 0;

    const data: TmdbTVData = {
      shows,
      stats: {
        totalShows: shows.length,
        rated: ratedList.length,
        averageRating: Math.round(averageRating * 10) / 10,
      },
      timestamp: Date.now(),
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched ${shows.length} shows from TMDB (${ratedList.length} rated)`);

    return data;
  } catch (error) {
    log.error('Error fetching TMDB TV data:', error);
    return null;
  }
}
