// Trakt API integration for TV shows
// Uses OAuth 2.0 (tokens refreshed in pre-build script)

import { fetchWithRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const log = createLogger('Trakt');

const TRAKT_CLIENT_ID = import.meta.env.TRAKT_CLIENT_ID;
const TRAKT_USERNAME = import.meta.env.TRAKT_USERNAME;
const TRAKT_ACCESS_TOKEN = import.meta.env.TRAKT_ACCESS_TOKEN;

const TMDB_API_KEY = import.meta.env.TMDB_API_KEY;

// Trakt API types
export interface TraktShow {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    imdb?: string;
    tmdb?: number;
  };
}

export interface TraktWatchedShow {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  show: TraktShow;
}

export interface TraktRating {
  rated_at: string;
  rating: number;
  show: TraktShow;
}

export interface TVShow {
  title: string;
  year: number;
  traktId: number;
  tmdbId?: number;
  imdbId?: string;
  slug: string;
  posterImage: string;
  firstAiredAt?: Date;
  rating?: number;
  plays: number;
  lastWatchedAt: Date;
  link: string;
}

export interface TraktData {
  shows: TVShow[];
  stats: {
    totalShows: number;
    totalPlays: number;
    rated: number;
    averageRating: number;
  };
  timestamp: number;
}

const cache = new FileCache<TraktData>('trakt-data', { ttl: 24 * 60 * 60 * 1000 });

/**
 * Make authenticated request to Trakt API
 * Includes retry logic for transient failures
 * Note: Token refresh is handled by pre-build script, not here
 */
async function traktRequest<T>(endpoint: string): Promise<T | null> {
  if (!TRAKT_ACCESS_TOKEN) {
    log.error('Trakt access token not configured');
    return null;
  }

  try {
    const response = await fetchWithRetry(
      `https://api.trakt.tv${endpoint}`,
      {
        headers: {
          'Authorization': `Bearer ${TRAKT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': TRAKT_CLIENT_ID || '',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`Trakt API retry ${attempt} for ${endpoint}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      log.error(`Trakt API error: ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    log.error('Error fetching from Trakt:', error);
    return null;
  }
}

/**
 * Fetch show details from TMDB (poster and first air date)
 * Includes retry logic for transient failures
 */
async function fetchTMDBDetails(tmdbId: number): Promise<{ posterImage: string; firstAiredAt?: Date }> {
  if (!TMDB_API_KEY || !tmdbId) {
    return { posterImage: '' };
  }

  try {
    const response = await fetchWithRetry(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`,
      undefined,
      {
        maxRetries: 2,
        initialDelayMs: 500,
        onRetry: (error, attempt) => {
          log.info(`TMDB retry ${attempt} for show ${tmdbId}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      return { posterImage: '' };
    }

    const data = await response.json();
    const posterImage = data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : '';
    const firstAiredAt = data.first_air_date
      ? new Date(data.first_air_date)
      : undefined;

    return { posterImage, firstAiredAt };
  } catch (error) {
    return { posterImage: '' };
  }
}

/**
 * Fetch all watched shows from Trakt
 */
async function fetchWatchedShows(): Promise<TraktWatchedShow[]> {
  const shows = await traktRequest<TraktWatchedShow[]>(`/users/${TRAKT_USERNAME}/watched/shows`);
  return shows || [];
}

/**
 * Fetch user's show ratings
 */
async function fetchRatings(): Promise<Map<number, number>> {
  const ratings = await traktRequest<TraktRating[]>(`/users/${TRAKT_USERNAME}/ratings/shows`);
  const ratingsMap = new Map<number, number>();

  if (ratings) {
    for (const rating of ratings) {
      ratingsMap.set(rating.show.ids.trakt, rating.rating);
    }
  }

  return ratingsMap;
}

/**
 * Get all Trakt data for display
 */
export async function getTraktData(): Promise<TraktData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!TRAKT_CLIENT_ID || !TRAKT_ACCESS_TOKEN || !TRAKT_USERNAME) {
    log.info('Trakt credentials not configured, skipping...');
    return null;
  }

  log.info('Fetching Trakt data...');

  try {
    // Fetch watched shows and ratings in parallel
    const [watchedShows, ratingsMap] = await Promise.all([
      fetchWatchedShows(),
      fetchRatings(),
    ]);

    if (!watchedShows.length) {
      log.info('No watched shows found on Trakt');
      return null;
    }

    log.info(`Found ${watchedShows.length} watched shows, fetching posters...`);

    // Fetch details from TMDB (with rate limiting)
    const shows: TVShow[] = [];
    for (const watched of watchedShows) {
      const tmdbDetails = watched.show.ids.tmdb
        ? await fetchTMDBDetails(watched.show.ids.tmdb)
        : { posterImage: '' };

      shows.push({
        title: watched.show.title,
        year: watched.show.year,
        traktId: watched.show.ids.trakt,
        tmdbId: watched.show.ids.tmdb,
        imdbId: watched.show.ids.imdb,
        slug: watched.show.ids.slug,
        posterImage: tmdbDetails.posterImage,
        firstAiredAt: tmdbDetails.firstAiredAt,
        rating: ratingsMap.get(watched.show.ids.trakt),
        plays: watched.plays,
        lastWatchedAt: new Date(watched.last_watched_at),
        link: `https://trakt.tv/shows/${watched.show.ids.slug}`,
      });

      // Small delay to avoid rate limiting TMDB
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Sort by last watched date (most recent first)
    shows.sort((a, b) => b.lastWatchedAt.getTime() - a.lastWatchedAt.getTime());

    // Calculate stats
    const totalPlays = shows.reduce((sum, s) => sum + s.plays, 0);
    const ratedShows = shows.filter(s => s.rating && s.rating > 0);
    const averageRating = ratedShows.length > 0
      ? ratedShows.reduce((sum, s) => sum + (s.rating || 0), 0) / ratedShows.length
      : 0;

    const data: TraktData = {
      shows,
      stats: {
        totalShows: shows.length,
        totalPlays,
        rated: ratedShows.length,
        averageRating: Math.round(averageRating * 10) / 10,
      },
      timestamp: Date.now(),
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched ${shows.length} shows from Trakt`);

    return data;
  } catch (error) {
    log.error('Error fetching Trakt data:', error);
    return null;
  }
}
