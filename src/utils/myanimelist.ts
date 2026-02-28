// MyAnimeList integration using official MAL API v2
// Fetches anime data from the official MyAnimeList API

import { FileCache } from './cache';
import { createLogger } from './logger';
import type { AnimeStatus } from '../content/config';
import { fetchWithRetry } from './retry';

const log = createLogger('MAL');

const MAL_CLIENT_ID = import.meta.env.MAL_CLIENT_ID;
const MAL_ACCESS_TOKEN = import.meta.env.MAL_ACCESS_TOKEN;

// MAL API configuration
const MAL_API_BASE = 'https://api.myanimelist.net/v2';
const RATE_LIMIT_DELAY = 100; // 100ms between requests

export interface MALAnime {
  title: string;
  englishTitle?: string;
  imageUrl: string;
  score?: number; // User's rating (1-10)
  status: AnimeStatus;
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

const cache = new FileCache<MALData>('myanimelist-data', { ttl: 24 * 60 * 60 * 1000 });

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
      log.info(`Fetching anime (offset ${offset})...`);

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
            log.info(`MAL animelist retry ${attempt} (offset ${offset}): ${error.message}`);
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
          const d = new Date(node.start_date);
          if (!isNaN(d.getTime())) startDate = d;
        }

        // Use user's finish date for endDate
        if (listStatus.finish_date) {
          const d = new Date(listStatus.finish_date);
          if (!isNaN(d.getTime())) endDate = d;
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
      log.error(`Error fetching anime (offset ${offset}):`, error);
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
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!MAL_CLIENT_ID || !MAL_ACCESS_TOKEN) {
    log.info('MyAnimeList API credentials not configured, skipping...');
    log.info('Run: node scripts/get-mal-token.cjs to get credentials');
    return null;
  }

  log.info('Fetching MyAnimeList data from official API...');

  try {
    const anime = await fetchAnimeList();

    const data: MALData = {
      anime,
      timestamp: Date.now(),
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched ${anime.length} anime from MyAnimeList`);

    return data;
  } catch (error) {
    log.error('Error fetching MyAnimeList data:', error);
    return null;
  }
}
