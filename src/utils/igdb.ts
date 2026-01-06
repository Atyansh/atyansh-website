// IGDB (Internet Game Database) API integration
// Provides high-quality game cover art for all platforms

import { fetchWithRetry } from './retry';

const IGDB_CLIENT_ID = import.meta.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = import.meta.env.IGDB_CLIENT_SECRET;
let IGDB_ACCESS_TOKEN = import.meta.env.IGDB_ACCESS_TOKEN;

// Track if we've already refreshed the token this session
let tokenRefreshed = false;

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
 * Save IGDB cache to disk
 */
async function saveCache(cache: IGDBCache): Promise<void> {
  // Only save cache in Node.js environment
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    // Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(IGDB_CACHE_FILE, JSON.stringify(cache, null, 2));
    memoryCache = cache;
  } catch (error) {
    console.error('Failed to save IGDB cache:', error);
  }
}

/**
 * Get cached cover URL if available and not expired
 */
async function getCachedCover(gameKey: string): Promise<string | null> {
  const cache = await loadCache();
  const cached = cache[gameKey];

  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      // Empty string means we cached a null result (game not found)
      return cached.url || null;
    }
  }

  return null;
}

/**
 * Cache a cover URL
 */
async function cacheCover(gameKey: string, url: string): Promise<void> {
  const cache = await loadCache();
  cache[gameKey] = {
    url,
    timestamp: Date.now(),
  };
  await saveCache(cache);
}

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 250; // 250ms between requests (4 requests per second)
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000; // Start with 2 second delay

/**
 * Wait to respect rate limits
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Refresh the IGDB access token using client credentials
 * Returns true if successful, false otherwise
 * Includes retry logic for transient failures
 */
async function refreshAccessToken(): Promise<boolean> {
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.log('Cannot refresh IGDB token: missing client credentials');
    return false;
  }

  if (tokenRefreshed) {
    console.log('Token already refreshed this session, not retrying');
    return false;
  }

  try {
    console.log('Refreshing IGDB access token...');

    const response = await fetchWithRetry(
      'https://id.twitch.tv/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: IGDB_CLIENT_ID,
          client_secret: IGDB_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          console.log(`IGDB token refresh retry ${attempt}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to refresh token: ${response.status}`);
      return false;
    }

    const data = await response.json();
    IGDB_ACCESS_TOKEN = data.access_token;
    tokenRefreshed = true;

    const expiresInDays = Math.round(data.expires_in / 86400);
    console.log(`IGDB token refreshed successfully (expires in ${expiresInDays} days)`);

    // Try to persist to Secret Manager for future builds
    await updateSecretManager('IGDB_ACCESS_TOKEN', data.access_token);

    return true;
  } catch (error) {
    console.error('Error refreshing IGDB token:', error);
    return false;
  }
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

/**
 * Search IGDB by Steam App ID for exact matching
 * Uses two-step lookup: external_games -> games
 */
async function getIGDBCoverBySteamId(steamAppId: number): Promise<string | null> {
  if (!IGDB_CLIENT_ID || !IGDB_ACCESS_TOKEN) {
    return null;
  }

  try {
    // Step 1: Query external_games to find the IGDB game ID
    // Category 1 = Steam (filters out other platforms with same numeric IDs)
    const externalGamesUrl = 'https://api.igdb.com/v4/external_games';
    const externalQuery = `fields game; where uid = "${steamAppId}" & category = 1; limit 1;`;

    await waitForRateLimit();

    const externalResponse = await fetchWithRetry(
      externalGamesUrl,
      {
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID,
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: externalQuery,
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_BASE_DELAY,
        onRetry: (error, attempt) => {
          console.log(`IGDB external_games lookup retry ${attempt}: ${error.message}`);
        },
      }
    );

    if (!externalResponse.ok) {
      if (externalResponse.status === 401 || externalResponse.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return getIGDBCoverBySteamId(steamAppId);
        }
      }
      return null;
    }

    const externalData = await externalResponse.json();
    if (!externalData.length || !externalData[0].game) {
      return null;
    }

    const igdbGameId = externalData[0].game;

    // Step 2: Query games endpoint to get the cover
    const gamesUrl = 'https://api.igdb.com/v4/games';
    const gamesQuery = `fields name,cover.image_id; where id = ${igdbGameId}; limit 1;`;

    await waitForRateLimit();

    const gamesResponse = await fetchWithRetry(
      gamesUrl,
      {
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID,
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: gamesQuery,
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_BASE_DELAY,
        onRetry: (error, attempt) => {
          console.log(`IGDB games lookup retry ${attempt}: ${error.message}`);
        },
      }
    );

    if (!gamesResponse.ok) {
      return null;
    }

    const gamesData: IGDBGame[] = await gamesResponse.json();

    if (gamesData.length > 0 && gamesData[0].cover) {
      const imageId = gamesData[0].cover.image_id;
      const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
      console.log(`✓ Found IGDB cover by Steam ID ${steamAppId}: ${gamesData[0].name}`);
      return coverUrl;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching IGDB cover by Steam ID ${steamAppId}:`, error);
    return null;
  }
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

  // Check if search contains numbers (sequel indicator)
  const searchNumbers = search.match(/\d+/g);
  const resultNumbers = result.match(/\d+/g);

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
 * Search IGDB for a game and get its cover art
 * Returns high-quality cover URL (3:4 aspect ratio)
 * Includes retry logic for transient failures
 */
export async function getIGDBCoverUrl(gameName: string, platform?: 'steam' | 'psn' | 'nintendo', steamAppId?: number): Promise<string | null> {
  // If no API credentials, return null
  if (!IGDB_CLIENT_ID || !IGDB_ACCESS_TOKEN) {
    console.log('IGDB API credentials not configured');
    return null;
  }

  // Create cache key (include steamAppId for Steam games)
  const gameKey = steamAppId
    ? `steam:${steamAppId}`
    : `${platform || 'all'}:${gameName.toLowerCase()}`;

  // Check cache first
  const cachedUrl = await getCachedCover(gameKey);
  if (cachedUrl) {
    console.log(`✓ Using cached IGDB cover for: ${gameName}`);
    return cachedUrl;
  }

  // For Steam games, try exact ID matching first
  if (platform === 'steam' && steamAppId) {
    const coverByIdUrl = await getIGDBCoverBySteamId(steamAppId);
    if (coverByIdUrl) {
      await cacheCover(gameKey, coverByIdUrl);
      return coverByIdUrl;
    }
    // Fall through to name-based search if ID lookup fails
    console.log(`Steam ID lookup failed for ${gameName}, trying name search...`);
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

    // Wait for rate limit before request
    await waitForRateLimit();

    const response = await fetchWithRetry(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID,
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: query,
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: RETRY_BASE_DELAY,
        onRetry: (error, attempt) => {
          console.log(`IGDB retry ${attempt} for "${gameName}": ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      // Check if it's an auth error and try to refresh token
      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry with new token (recursive call, but tokenRefreshed prevents infinite loop)
          return getIGDBCoverUrl(gameName, platform);
        }
      }
      console.log(`IGDB API error for "${gameName}": ${response.status}`);
      return null;
    }

    const data: IGDBGame[] = await response.json();

    // If no results with platform filter, try without it
    if (data.length === 0 && platformFilter) {
      console.log(`No results with platform filter for "${cleanedName}", retrying without filter...`);

      const queryWithoutPlatform = `
        search "${cleanedName.replace(/"/g, '\\"')}";
        fields name,cover.image_id,cover.url,aggregated_rating,rating,rating_count;
        where cover != null;
        limit 10;
      `;

      await waitForRateLimit();

      const response2 = await fetchWithRetry(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Client-ID': IGDB_CLIENT_ID,
            'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: queryWithoutPlatform,
        },
        {
          maxRetries: MAX_RETRIES,
          initialDelayMs: RETRY_BASE_DELAY,
          onRetry: (error, attempt) => {
            console.log(`IGDB retry ${attempt} for "${gameName}" (no filter): ${error.message}`);
          },
        }
      );

      if (response2.ok) {
        const data2: IGDBGame[] = await response2.json();
        if (data2.length > 0) {
          // Score all results and pick the best match
          // Sort by nameScore first, then by popularityBonus for ties
          const scoredResults = data2
            .filter(game => game.cover)
            .map(game => {
              const scores = scoreMatch(cleanedName, game);
              return { game, ...scores, totalScore: scores.nameScore + scores.popularityBonus };
            })
            .sort((a, b) => {
              if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
              return b.popularityBonus - a.popularityBonus;
            });

          const bestMatch = scoredResults.find(r => r.nameScore > 0);

          if (bestMatch) {
            const imageId = bestMatch.game.cover!.image_id;
            const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
            await cacheCover(gameKey, coverUrl);
            console.log(`✓ Found IGDB cover for: ${gameName} (matched as: ${bestMatch.game.name}, score: ${bestMatch.nameScore}+${Math.round(bestMatch.popularityBonus)}) [no platform filter]`);
            return coverUrl;
          }
        }
      }
    }

    if (data.length > 0) {
      // Score all results and pick the best match
      // Sort by nameScore first, then by popularityBonus for ties
      const scoredResults = data
        .filter(game => game.cover)
        .map(game => {
          const scores = scoreMatch(cleanedName, game);
          return { game, ...scores, totalScore: scores.nameScore + scores.popularityBonus };
        })
        .sort((a, b) => {
          if (a.nameScore !== b.nameScore) return b.nameScore - a.nameScore;
          return b.popularityBonus - a.popularityBonus;
        });

      // Only use results with reasonable scores
      const bestMatch = scoredResults.find(r => r.nameScore > 0);

      if (bestMatch) {
        const imageId = bestMatch.game.cover!.image_id;
        // Use cover_big (264x352) or cover_big_2x (528x704) for high quality
        const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;

        // Cache the result
        await cacheCover(gameKey, coverUrl);

        console.log(`✓ Found IGDB cover for: ${gameName} (matched as: ${bestMatch.game.name}, score: ${bestMatch.nameScore}+${Math.round(bestMatch.popularityBonus)})`);
        return coverUrl;
      }
    }

    console.log(`✗ No IGDB cover found for: ${gameName}`);

    // Cache the null result to avoid repeated failed lookups
    await cacheCover(gameKey, '');

    return null;
  } catch (error) {
    console.error(`Error fetching IGDB cover for "${gameName}":`, error);
    return null;
  }
}

/**
 * Get multiple IGDB cover URLs in parallel
 */
export async function getIGDBCoversForGames(
  games: Array<{ name: string; platform?: 'steam' | 'psn' | 'nintendo' }>
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  await Promise.all(
    games.map(async (game) => {
      const coverUrl = await getIGDBCoverUrl(game.name, game.platform);
      results.set(game.name, coverUrl);
    })
  );

  return results;
}
