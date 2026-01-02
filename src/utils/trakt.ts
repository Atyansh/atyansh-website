// Trakt API integration for TV shows
// Uses OAuth 2.0 with automatic token refresh

const TRAKT_CLIENT_ID = import.meta.env.TRAKT_CLIENT_ID;
const TRAKT_CLIENT_SECRET = import.meta.env.TRAKT_CLIENT_SECRET;
const TRAKT_USERNAME = import.meta.env.TRAKT_USERNAME;
let TRAKT_ACCESS_TOKEN = import.meta.env.TRAKT_ACCESS_TOKEN;
let TRAKT_REFRESH_TOKEN = import.meta.env.TRAKT_REFRESH_TOKEN;

const TMDB_API_KEY = import.meta.env.TMDB_API_KEY;

// Cache configuration
const CACHE_DIR = '.cache';
const TRAKT_CACHE_FILE = '.cache/trakt-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// Track if token was already refreshed this session
let tokenRefreshed = false;

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

// In-memory cache
let memoryCache: TraktData | null = null;

/**
 * Update a secret in Google Cloud Secret Manager
 */
async function updateSecretManager(secretName: string, value: string): Promise<boolean> {
  if (!isNode) return false;

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`echo -n "${value}" | gcloud secrets versions add ${secretName} --data-file=-`);
    console.log(`✓ Updated ${secretName} in Secret Manager`);
    return true;
  } catch (error) {
    console.log(`Note: Could not update Secret Manager (gcloud may not be configured)`);
    return false;
  }
}

/**
 * Refresh the Trakt access token using the refresh token
 */
async function refreshAccessToken(): Promise<boolean> {
  if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET || !TRAKT_REFRESH_TOKEN) {
    console.log('Cannot refresh Trakt token: missing credentials');
    return false;
  }

  if (tokenRefreshed) {
    console.log('Trakt token already refreshed this session, not retrying');
    return false;
  }

  try {
    console.log('Refreshing Trakt access token...');

    const response = await fetch('https://api.trakt.tv/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        refresh_token: TRAKT_REFRESH_TOKEN,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Trakt token refresh failed: ${response.status} - ${errorText}`);
      return false;
    }

    const data = await response.json();

    // Update tokens in memory
    TRAKT_ACCESS_TOKEN = data.access_token;
    TRAKT_REFRESH_TOKEN = data.refresh_token;
    tokenRefreshed = true;

    const expiresInHours = Math.round(data.expires_in / 3600);
    console.log(`Trakt token refreshed successfully (expires in ${expiresInHours} hours)`);

    // Try to persist to Secret Manager for future builds
    await updateSecretManager('TRAKT_ACCESS_TOKEN', data.access_token);
    await updateSecretManager('TRAKT_REFRESH_TOKEN', data.refresh_token);

    return true;
  } catch (error) {
    console.error('Error refreshing Trakt token:', error);
    return false;
  }
}

/**
 * Load Trakt cache from disk
 */
async function loadCache(): Promise<TraktData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(TRAKT_CACHE_FILE, 'utf-8');
    const cached: TraktData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached Trakt data');
      return cached;
    }

    console.log('Trakt cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Trakt cache to disk
 */
async function saveCache(data: TraktData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(TRAKT_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved Trakt data to cache');
  } catch (error) {
    console.error('Failed to save Trakt cache:', error);
  }
}

/**
 * Make authenticated request to Trakt API
 */
async function traktRequest<T>(endpoint: string, retry = true): Promise<T | null> {
  if (!TRAKT_ACCESS_TOKEN) {
    console.error('Trakt access token not configured');
    return null;
  }

  try {
    const response = await fetch(`https://api.trakt.tv${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${TRAKT_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID || '',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (response.status === 401 && retry) {
      // Token expired, try to refresh
      console.log('Trakt token expired, attempting refresh...');
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return traktRequest<T>(endpoint, false);
      }
      return null;
    }

    if (!response.ok) {
      console.error(`Trakt API error: ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching from Trakt:', error);
    return null;
  }
}

/**
 * Fetch show details from TMDB (poster and first air date)
 */
async function fetchTMDBDetails(tmdbId: number): Promise<{ posterImage: string; firstAiredAt?: Date }> {
  if (!TMDB_API_KEY || !tmdbId) {
    return { posterImage: '' };
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`
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
  const cached = await loadCache();
  if (cached) {
    return cached;
  }

  if (!TRAKT_CLIENT_ID || !TRAKT_ACCESS_TOKEN || !TRAKT_USERNAME) {
    console.log('Trakt credentials not configured, skipping...');
    return null;
  }

  console.log('Fetching Trakt data...');

  try {
    // Fetch watched shows and ratings in parallel
    const [watchedShows, ratingsMap] = await Promise.all([
      fetchWatchedShows(),
      fetchRatings(),
    ]);

    if (!watchedShows.length) {
      console.log('No watched shows found on Trakt');
      return null;
    }

    console.log(`Found ${watchedShows.length} watched shows, fetching posters...`);

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
    await saveCache(data);

    console.log(`✓ Fetched ${shows.length} shows from Trakt`);

    return data;
  } catch (error) {
    console.error('Error fetching Trakt data:', error);
    return null;
  }
}
