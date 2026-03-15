// IGDB (Internet Game Database) API integration
// Provides high-quality game cover art for all platforms

import { pLimit } from './concurrency';
import { fetchWithRetry } from './retry';
import { createLogger } from './logger';

const log = createLogger('IGDB');

const IGDB_CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
const IGDB_ACCESS_TOKEN = import.meta.env.IGDB_ACCESS_TOKEN;

// Cache configuration
const CACHE_DIR = '.cache';
const IGDB_CACHE_FILE = '.cache/igdb-covers.json';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

interface IGDBCover {
  id: number;
  image_id: string;
  url: string;
}

interface IGDBGame {
  id: number;
  name: string;
  cover?: IGDBCover;
  aggregated_rating?: number; // Critic rating (0-100)
  rating?: number; // User rating (0-100)
  rating_count?: number; // Number of user ratings
  first_release_date?: number; // Unix timestamp
}

interface CachedCover {
  url: string;
  timestamp: number;
}

interface IGDBCache {
  [gameKey: string]: CachedCover;
}

// In-memory cache for the current build
let memoryCache: IGDBCache | null = null;
let cacheDirty = false;

/**
 * Load IGDB cache from disk
 */
async function loadCache(): Promise<IGDBCache> {
  if (memoryCache) {
    return memoryCache;
  }

  // Only use cache in Node.js environment
  if (!isNode) {
    memoryCache = {};
    return memoryCache;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(IGDB_CACHE_FILE, 'utf-8');
    memoryCache = JSON.parse(cacheData);
    return memoryCache!;
  } catch (error) {
    // Cache doesn't exist or is invalid
    memoryCache = {};
    return memoryCache;
  }
}

/**
 * Get cached cover URL if available and not expired
 * Returns: string = positive hit, null = negative hit (not found), undefined = cache miss
 */
async function getCachedCover(gameKey: string): Promise<string | null | undefined> {
  const cache = await loadCache();
  const cached = cache[gameKey];

  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      // Empty string means we cached a null result (game not found)
      return cached.url || null;
    }
  }

  return undefined;
}

/**
 * Cache a cover URL (memory only; call flushIGDBCache to persist)
 */
async function cacheCover(gameKey: string, url: string): Promise<void> {
  const cache = await loadCache();
  cache[gameKey] = {
    url,
    timestamp: Date.now(),
  };
  cacheDirty = true;
}

/**
 * Flush IGDB cache to disk (batched write — call once after all covers are fetched)
 */
export async function flushIGDBCache(): Promise<void> {
  if (!cacheDirty || !isNode || !memoryCache) return;

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(IGDB_CACHE_FILE, JSON.stringify(memoryCache, null, 2));
    cacheDirty = false;
  } catch (error) {
    log.error('Failed to save IGDB cache:', error);
  }
}

// Rate limiting — pLimit(1) serializes all IGDB API calls so that
// the timestamp check actually works across concurrent callers.
const igdbLimit = pLimit(1);
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 250; // 250ms between requests (4 requests per second)
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000; // Start with 2 second delay

/**
 * Rate-limited IGDB API fetch. Serializes requests so only one is in-flight
 * at a time, with 250ms minimum spacing to stay under IGDB's 4 req/s limit.
 */
async function igdbFetch(url: string, body: string, retryLabel: string): Promise<Response> {
  return igdbLimit(async () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    return fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID!,
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body,
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_BASE_DELAY,
        onRetry: (error, attempt) => {
          log.info(`${retryLabel} retry ${attempt}: ${error.message}`);
        },
      }
    );
  });
}

// Games that should be excluded from the library (not real games)
const EXCLUDED_GAMES = new Set([
  'virtual desktop', // VR software, not a game
]);

// Name mappings for games with non-standard names
const NAME_MAPPINGS: Record<string, string> = {
  'grand theft auto v legacy': 'Grand Theft Auto V',
  'mega man 11 demo version': 'Mega Man 11',
};

/**
 * Clean game name for better IGDB search results
 * Removes trademark symbols, suffixes, and other noise
 */
function cleanGameName(gameName: string): string {
  let name = gameName
    // Remove trademark symbols
    .replace(/[®™©]/g, '')
    // Remove "Trophies" suffix (common in PSN data)
    .replace(/\s+Trophies$/i, '')
    // Remove version numbers at the end (requires "v" prefix or decimal like "1.0")
    // This preserves sequel numbers like "2" in "Left 4 Dead 2"
    .replace(/\s+v\d+(\.\d+)*$/i, '')
    .replace(/\s+\d+\.\d+(\.\d+)*$/, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Apply name mappings
  const lowerName = name.toLowerCase();
  if (NAME_MAPPINGS[lowerName]) {
    name = NAME_MAPPINGS[lowerName];
  }

  return name;
}

/**
 * Check if a game should be excluded from the library
 */
export function isExcludedGame(gameName: string): boolean {
  return EXCLUDED_GAMES.has(gameName.toLowerCase().trim());
}

// Edition/variant suffixes that should be penalized if not in the search
const EDITION_SUFFIXES = [
  'deluxe edition', 'deluxe', 'ultimate edition', 'ultimate',
  'gold edition', 'gold', 'premium edition', 'premium',
  'complete edition', 'complete', 'definitive edition', 'definitive',
  'game of the year edition', 'goty edition', 'goty',
  'enhanced edition', 'enhanced', 'remastered', 'remake',
  'digital deluxe', 'collector\'s edition', 'special edition',
];

/**
 * Score how well an IGDB result matches our search
 * Higher score = better match
 * Returns [nameScore, popularityBonus] where popularityBonus is used to break ties
 */
function scoreMatch(searchName: string, game: IGDBGame): { nameScore: number; popularityBonus: number } {
  const search = searchName.toLowerCase();
  const result = game.name.toLowerCase();

  // Calculate popularity bonus (0-20 points based on rating count and ratings)
  let popularityBonus = 0;
  if (game.rating_count && game.rating_count > 0) {
    // More ratings = more popular/well-known game
    popularityBonus += Math.min(10, Math.log10(game.rating_count) * 3);
  }
  if (game.aggregated_rating && game.aggregated_rating > 0) {
    // Higher critic rating = likely the "main" version of a game
    popularityBonus += (game.aggregated_rating / 100) * 5;
  }
  if (game.rating && game.rating > 0) {
    // Higher user rating
    popularityBonus += (game.rating / 100) * 5;
  }

  // Exact match is best
  if (search === result) return { nameScore: 100, popularityBonus };

  // Normalize Roman numerals to Arabic in the result for number comparison only.
  // This ensures "Slay the Spire II" matches search "Slay the Spire 2", etc.
  // The original `result` string is still used for all other matching checks.
  const romanToArabic: [RegExp, string][] = [
    [/\bviii\b/g, '8'], [/\bvii\b/g, '7'], [/\bvi\b/g, '6'],
    [/\bv\b/g, '5'], [/\biv\b/g, '4'], [/\biii\b/g, '3'], [/\bii\b/g, '2'],
  ];
  let resultForNumbers = result;
  for (const [pattern, replacement] of romanToArabic) {
    resultForNumbers = resultForNumbers.replace(pattern, replacement);
  }

  // Check if search contains numbers (sequel indicator)
  const searchNumbers = search.match(/\d+/g);
  const resultNumbers = resultForNumbers.match(/\d+/g);

  // If search has numbers, result should have the same numbers
  if (searchNumbers && searchNumbers.length > 0) {
    const hasMatchingNumbers = searchNumbers.every(num =>
      resultNumbers && resultNumbers.includes(num)
    );
    if (!hasMatchingNumbers) return { nameScore: 0, popularityBonus: 0 }; // Wrong sequel/version
  }

  // If search has no numbers but result does, it might be wrong version
  if (!searchNumbers && resultNumbers) {
    return { nameScore: 10, popularityBonus }; // Low score for potential version mismatch
  }

  // Penalize edition variants if search doesn't have them
  for (const suffix of EDITION_SUFFIXES) {
    if (result.includes(suffix) && !search.includes(suffix)) {
      // Result has an edition suffix that search doesn't have
      // Prefer base game over special editions
      return { nameScore: 45, popularityBonus }; // Lower than exact substring match (50)
    }
  }

  // Check if one contains the other
  if (result.includes(search) || search.includes(result)) {
    return { nameScore: 50, popularityBonus };
  }

  // Basic word overlap
  const searchWords = search.split(/\s+/);
  const resultWords = result.split(/\s+/);
  const matchingWords = searchWords.filter(w => resultWords.includes(w)).length;

  return { nameScore: Math.round((matchingWords / searchWords.length) * 40), popularityBonus };
}

/**
 * Pick the best matching game from IGDB results based on name similarity and popularity.
 * Returns the cover URL of the best match, or null if no good match found.
 */
function pickBestMatch(games: IGDBGame[], cleanedName: string): string | null {
  const scoredResults = games
    .filter(game => game.cover)
    .map(game => {
      const scores = scoreMatch(cleanedName, game);
      return { game, ...scores };
    })
    .sort((a, b) => {
      if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
      return b.popularityBonus - a.popularityBonus;
    });

  const bestMatch = scoredResults.find(r => r.nameScore > 0);
  if (!bestMatch) return null;

  const imageId = bestMatch.game.cover!.image_id;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
}

/**
 * Search IGDB for a game and get its cover art
 * Returns high-quality cover URL (3:4 aspect ratio)
 * Includes retry logic for transient failures
 */
export async function getIGDBCoverUrl(gameName: string, platform?: 'steam' | 'psn' | 'nintendo'): Promise<string | null> {
  // If no API credentials, return null
  if (!IGDB_CLIENT_ID || !IGDB_ACCESS_TOKEN) {
    log.info('IGDB API credentials not configured');
    return null;
  }

  // Create cache key
  const gameKey = `${platform || 'all'}:${gameName.toLowerCase()}`;

  // Check cache first
  const cached = await getCachedCover(gameKey);
  if (cached !== undefined) {
    if (cached) log.info(`Using cached IGDB cover for: ${gameName}`);
    return cached;
  }

  try {
    // Clean the game name for better search results
    const cleanedName = cleanGameName(gameName);

    // IGDB API endpoint
    const apiUrl = 'https://api.igdb.com/v4/games';

    // Platform-specific filtering
    let platformFilter = '';
    if (platform === 'steam') {
      platformFilter = ' & platforms = (6)'; // PC/Steam
    } else if (platform === 'psn') {
      platformFilter = ' & (platforms = (48, 167, 169))'; // PS4, PS5, PS5 Digital
    } else if (platform === 'nintendo') {
      platformFilter = ' & platforms = (130)'; // Nintendo Switch
    }

    // IGDB uses a custom query language
    // Get more results for better matching, include rating info for disambiguation
    const query = `
      search "${cleanedName.replace(/"/g, '\\"')}";
      fields name,cover.image_id,cover.url,aggregated_rating,rating,rating_count;
      where cover != null${platformFilter};
      limit 10;
    `;

    const response = await igdbFetch(
      apiUrl,
      query,
      `IGDB search for "${gameName}"`
    );

    if (!response.ok) {
      log.error(`IGDB API error for "${gameName}": ${response.status}`);
      return null;
    }

    const data: IGDBGame[] = await response.json();

    // If no results with platform filter, try without it
    if (data.length === 0 && platformFilter) {
      log.info(`No results with platform filter for "${cleanedName}", retrying without filter...`);

      const queryWithoutPlatform = `
        search "${cleanedName.replace(/"/g, '\\"')}";
        fields name,cover.image_id,cover.url,aggregated_rating,rating,rating_count;
        where cover != null;
        limit 10;
      `;

      const response2 = await igdbFetch(
        apiUrl,
        queryWithoutPlatform,
        `IGDB search for "${gameName}" (no platform filter)`
      );

      if (response2.ok) {
        const data2: IGDBGame[] = await response2.json();
        const coverUrl = data2.length > 0 ? pickBestMatch(data2, cleanedName) : null;
        if (coverUrl) {
          await cacheCover(gameKey, coverUrl);
          log.info(`Found IGDB cover for: ${gameName} [no platform filter]`);
          return coverUrl;
        }
      }
    }

    if (data.length > 0) {
      const coverUrl = pickBestMatch(data, cleanedName);
      if (coverUrl) {
        await cacheCover(gameKey, coverUrl);
        log.info(`Found IGDB cover for: ${gameName}`);
        return coverUrl;
      }
    }

    log.info(`No IGDB cover found for: ${gameName}`);

    // Cache the null result to avoid repeated failed lookups
    await cacheCover(gameKey, '');

    return null;
  } catch (error) {
    log.error(`Error fetching IGDB cover for "${gameName}":`, error);
    return null;
  }
}

