// MyAnimeList integration using official MAL API v2
// Fetches anime data from the official MyAnimeList API

import { fetchWithRetry } from './retry';

const MAL_CLIENT_ID = import.meta.env.MAL_CLIENT_ID;
const MAL_ACCESS_TOKEN = import.meta.env.MAL_ACCESS_TOKEN;

// Cache configuration
const CACHE_DIR = '.cache';
const MAL_CACHE_FILE = '.cache/myanimelist-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// MAL API configuration
const MAL_API_BASE = 'https://api.myanimelist.net/v2';
const RATE_LIMIT_DELAY = 100; // 100ms between requests

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

export interface MALAnime {
  title: string;
  englishTitle?: string;
  imageUrl: string;
  score?: number; // User's rating (1-10)
  status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';
  episodes?: number;
  episodesWatched?: number;
  type?: string; // TV, Movie, OVA, etc.
  year?: number;
  startDate?: Date;
  endDate?: Date;
  malUrl: string;
}

export interface MALData {
  anime: MALAnime[];
  timestamp: number;
}

interface CachedMALData extends MALData {}

// In-memory cache
let memoryCache: CachedMALData | null = null;

/**
 * Load MAL cache from disk
 */
async function loadCache(): Promise<CachedMALData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(MAL_CACHE_FILE, 'utf-8');
    const cached: CachedMALData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached MyAnimeList data');
      return cached;
    }

    console.log('MyAnimeList cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save MAL cache to disk
 */
async function saveCache(data: MALData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(MAL_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved MyAnimeList data to cache');
  } catch (error) {
    console.error('Failed to save MyAnimeList cache:', error);
  }
}

/**
 * Fetch user's animelist from MAL API with pagination
 * Includes retry logic for transient failures
 */
async function fetchAnimeList(): Promise<MALAnime[]> {
  const allAnime: MALAnime[] = [];
  const limit = 100; // Max per page
  let offset = 0;
  let hasMore = true;

  // Fields to request from API
  const fields = 'list_status{start_date,finish_date,num_episodes_watched,score},alternative_titles,media_type,num_episodes,start_season,start_date,status';

  while (hasMore) {
    try {
      console.log(`Fetching anime (offset ${offset})...`);

      const url = `${MAL_API_BASE}/users/@me/animelist?fields=${fields}&limit=${limit}&offset=${offset}`;

      const response = await fetchWithRetry(
        url,
        {
          headers: {
            'X-MAL-Client-ID': MAL_CLIENT_ID,
            'Authorization': `Bearer ${MAL_ACCESS_TOKEN}`,
          },
        },
        {
          maxRetries: 2,
          initialDelayMs: 1000,
          onRetry: (error, attempt) => {
            console.log(`MAL animelist retry ${attempt} (offset ${offset}): ${error.message}`);
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('MAL Access Token expired or invalid. Please run: node scripts/get-mal-token.cjs');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      // Parse anime entries
      for (const entry of data.data) {
        const node = entry.node;
        const listStatus = entry.list_status;

        // Map status to our format
        let status: MALAnime['status'];
        switch (listStatus.status) {
          case 'watching':
            status = 'watching';
            break;
          case 'completed':
            status = 'completed';
            break;
          case 'on_hold':
            status = 'on_hold';
            break;
          case 'dropped':
            status = 'dropped';
            break;
          case 'plan_to_watch':
            status = 'plan_to_watch';
            break;
          default:
            status = 'plan_to_watch';
        }

        // Parse dates
        // Use the anime's actual start_date (air date), not when user started watching
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (node.start_date) {
          try {
            startDate = new Date(node.start_date);
          } catch (e) {
            // Invalid date
          }
        }

        // Use user's finish date for endDate
        if (listStatus.finish_date) {
          try {
            endDate = new Date(listStatus.finish_date);
          } catch (e) {
            // Invalid date
          }
        }

        // Get year from start_season
        const year = node.start_season?.year;

        allAnime.push({
          title: node.title,
          englishTitle: node.alternative_titles?.en || undefined,
          imageUrl: node.main_picture?.large || node.main_picture?.medium || '',
          score: listStatus.score > 0 ? listStatus.score : undefined,
          status,
          episodes: node.num_episodes || undefined,
          episodesWatched: listStatus.num_episodes_watched || undefined,
          type: node.media_type || undefined,
          year,
          startDate,
          endDate,
          malUrl: `https://myanimelist.net/anime/${node.id}`,
        });
      }

      // Check if there's more data
      if (data.paging?.next) {
        offset += limit;
        // Respect rate limit
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching anime (offset ${offset}):`, error);
      hasMore = false;
    }
  }

  return allAnime;
}

/**
 * Get all MyAnimeList data using official MAL API
 */
export async function getMALData(): Promise<MALData | null> {
  // Check cache first
  const cached = await loadCache();
  if (cached) {
    return cached;
  }

  if (!MAL_CLIENT_ID || !MAL_ACCESS_TOKEN) {
    console.log('MyAnimeList API credentials not configured, skipping...');
    console.log('Run: node scripts/get-mal-token.cjs to get credentials');
    return null;
  }

  console.log('Fetching MyAnimeList data from official API...');

  try {
    const anime = await fetchAnimeList();

    const data: MALData = {
      anime,
      timestamp: Date.now(),
    };

    // Save to cache
    await saveCache(data);

    console.log(`✓ Fetched ${anime.length} anime from MyAnimeList`);

    return data;
  } catch (error) {
    console.error('Error fetching MyAnimeList data:', error);
    return null;
  }
}
