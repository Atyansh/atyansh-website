// IGDB (Internet Game Database) API integration
// Provides high-quality game cover art for all platforms

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
 * Clean game name for better IGDB search results
 * Removes trademark symbols, suffixes, and other noise
 */
function cleanGameName(gameName: string): string {
  return gameName
    // Remove trademark symbols
    .replace(/[®™©]/g, '')
    // Remove "Trophies" suffix (common in PSN data)
    .replace(/\s+Trophies$/i, '')
    // Remove version numbers at the end
    .replace(/\s+v?\d+(\.\d+)*$/i, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search IGDB for a game and get its cover art
 * Returns high-quality cover URL (3:4 aspect ratio)
 */
export async function getIGDBCoverUrl(gameName: string, platform?: 'steam' | 'psn' | 'nintendo'): Promise<string | null> {
  // If no API credentials, return null
  if (!IGDB_CLIENT_ID || !IGDB_ACCESS_TOKEN) {
    console.log('IGDB API credentials not configured');
    return null;
  }

  // Create cache key
  const gameKey = `${platform || 'all'}:${gameName.toLowerCase()}`;

  // Check cache first
  const cachedUrl = await getCachedCover(gameKey);
  if (cachedUrl) {
    console.log(`✓ Using cached IGDB cover for: ${gameName}`);
    return cachedUrl;
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
    // Try search first for better fuzzy matching
    const query = `
      search "${cleanedName.replace(/"/g, '\\"')}";
      fields name,cover.image_id,cover.url;
      where cover != null${platformFilter};
      limit 3;
    `;

    // Retry logic with exponential backoff for rate limit errors
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Wait for rate limit before each attempt
      await waitForRateLimit();

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Client-ID': IGDB_CLIENT_ID,
          'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: query,
      });

      // If successful or non-rate-limit error, break
      if (response.ok || response.status !== 429) {
        break;
      }

      // If rate limited and we have retries left
      if (response.status === 429 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        console.log(`Rate limited for "${gameName}", retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
      }
    }

    if (!response || !response.ok) {
      console.log(`IGDB API error for "${gameName}": ${response?.status || 'unknown'}`);
      return null;
    }

    const data: IGDBGame[] = await response.json();

    // If no results with platform filter, try without it
    if (data.length === 0 && platformFilter) {
      console.log(`No results with platform filter for "${cleanedName}", retrying without filter...`);

      const queryWithoutPlatform = `
        search "${cleanedName.replace(/"/g, '\\"')}";
        fields name,cover.image_id,cover.url;
        where cover != null;
        limit 3;
      `;

      // Retry logic for fallback query
      let response2: Response | null = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        await waitForRateLimit();

        response2 = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Client-ID': IGDB_CLIENT_ID,
            'Authorization': `Bearer ${IGDB_ACCESS_TOKEN}`,
            'Content-Type': 'text/plain',
          },
          body: queryWithoutPlatform,
        });

        if (response2.ok || response2.status !== 429) {
          break;
        }

        if (response2.status === 429 && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
          console.log(`Rate limited for "${gameName}" (no filter), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(delay);
        }
      }

      if (response2 && response2.ok) {
        const data2: IGDBGame[] = await response2.json();
        if (data2.length > 0) {
          // Use results from query without platform filter
          const exactMatch = data2.find(game =>
            game.name.toLowerCase() === cleanedName.toLowerCase()
          );

          const selectedGame = exactMatch || data2[0];

          if (selectedGame.cover) {
            const imageId = selectedGame.cover.image_id;
            const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;
            await cacheCover(gameKey, coverUrl);
            console.log(`✓ Found IGDB cover for: ${gameName} (matched as: ${selectedGame.name}) [no platform filter]`);
            return coverUrl;
          }
        }
      }
    }

    if (data.length > 0) {
      // Try to find exact match first
      const exactMatch = data.find(game =>
        game.name.toLowerCase() === cleanedName.toLowerCase()
      );

      const selectedGame = exactMatch || data[0];

      if (selectedGame.cover) {
        const imageId = selectedGame.cover.image_id;
        // Use cover_big (264x352) or cover_big_2x (528x704) for high quality
        const coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg`;

        // Cache the result
        await cacheCover(gameKey, coverUrl);

        console.log(`✓ Found IGDB cover for: ${gameName} (matched as: ${selectedGame.name})`);
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
