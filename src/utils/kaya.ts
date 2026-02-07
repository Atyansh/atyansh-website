// Kaya Climbing App API integration
// Uses their internal GraphQL API to fetch climbing data

import { fetchWithRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const log = createLogger('Kaya');

const KAYA_USERNAME = import.meta.env.KAYA_USERNAME;
const KAYA_GRAPHQL_ENDPOINT = 'https://kaya-beta.kayaclimb.com/graphql';

// Kaya API types
export interface KayaGrade {
  id: string;
  name: string;
  ordering?: number;
}

export interface KayaGym {
  id: string;
  name: string;
}

export interface KayaArea {
  id: string;
  name: string;
}

export interface KayaClimb {
  id: string;
  name: string | null;
  gym: KayaGym | null;
  area: KayaArea | null;
  grade: KayaGrade;
}

export interface KayaVideo {
  id: string;
  thumb_url: string;
  video_url: string;
}

export interface KayaAscent {
  id: string;
  date: string;
  rating: number | null;
  video: KayaVideo | null;
  climb: KayaClimb;
}

export interface KayaProfile {
  id: string;
  username: string;
  fname: string;
  lname: string;
  photo_url: string | null;
  bio: string | null;
  height: number | null; // in cm
  ape_index: number | null; // in cm
  limit_grade_bouldering: KayaGrade | null;
  limit_grade_routes: KayaGrade | null;
  is_private: boolean;
}

export interface KayaGradeDistribution {
  grade: KayaGrade;
  ascent_count: number;
  redpoint_count: number;
  flash_count: number;
  onsight_count: number;
}

export interface KayaData {
  profile: KayaProfile | null;
  pyramid: KayaGradeDistribution[];
  ascents: KayaAscent[];
  ascentsWithVideos: KayaAscent[];
  stats: {
    totalSends: number;
    totalFlashes: number;
    flashRate: number;
    maxGrade: string | null;
    totalVideos: number;
  };
  timestamp: number;
}

const cache = new FileCache<KayaData>('kaya-data', { ttl: 24 * 60 * 60 * 1000 });

// GraphQL request headers
const GRAPHQL_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Origin': 'https://kaya-app.kayaclimb.com',
  'Referer': 'https://kaya-app.kayaclimb.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
};

/**
 * Execute GraphQL query against Kaya API
 * Includes retry logic for transient failures
 */
async function kayaGraphQL<T>(query: string, variables: Record<string, any>): Promise<T | null> {
  try {
    const response = await fetchWithRetry(
      KAYA_GRAPHQL_ENDPOINT,
      {
        method: 'POST',
        headers: GRAPHQL_HEADERS,
        body: JSON.stringify({ query, variables })
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`Kaya API retry ${attempt}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      log.error(`Kaya API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.errors) {
      log.error('Kaya GraphQL errors:', data.errors);
      return null;
    }

    return data.data;
  } catch (error) {
    log.error('Error fetching from Kaya:', error);
    return null;
  }
}

/**
 * Get user profile by username
 */
async function getProfile(username: string): Promise<KayaProfile | null> {
  const query = `
    query webUser($username: String!) {
      webUser(username: $username) {
        id
        username
        fname
        lname
        photo_url
        bio
        height
        ape_index
        limit_grade_bouldering { id name }
        limit_grade_routes { id name }
        is_private
      }
    }
  `;

  const data = await kayaGraphQL<{ webUser: KayaProfile }>(query, { username });
  return data?.webUser || null;
}

/**
 * Get bouldering grade pyramid for a user
 */
async function getGradePyramid(userId: string): Promise<KayaGradeDistribution[]> {
  const query = `
    query webFilterDistributionForAscents($user_id: ID!, $climb_type_id: ID!) {
      webFilterDistributionForAscents(user_id: $user_id, climb_type_id: $climb_type_id) {
        data {
          grade { id name ordering }
          ascent_count
          redpoint_count
          flash_count
          onsight_count
        }
      }
    }
  `;

  // climb_type_id: 1 = bouldering
  const data = await kayaGraphQL<{ webFilterDistributionForAscents: { data: KayaGradeDistribution[] } }>(
    query,
    { user_id: userId, climb_type_id: '1' }
  );

  // Filter to only grades with ascents and sort by ordering
  const pyramid = data?.webFilterDistributionForAscents?.data || [];
  return pyramid
    .filter(g => g.ascent_count > 0)
    .sort((a, b) => (a.grade.ordering || 0) - (b.grade.ordering || 0));
}

/**
 * Get all bouldering ascents for a user (paginated)
 */
async function getAllAscents(userId: string): Promise<KayaAscent[]> {
  const query = `
    query webAscentsForUser($user_id: ID!, $climb_type_id: ID, $count: Int!, $offset: Int!) {
      webAscentsForUser(user_id: $user_id, climb_type_id: $climb_type_id, count: $count, offset: $offset) {
        id
        date
        rating
        video {
          id
          thumb_url
          video_url
        }
        climb {
          id
          name
          gym { id name }
          area { id name }
          grade { id name ordering }
        }
      }
    }
  `;

  const allAscents: KayaAscent[] = [];
  let offset = 0;
  const count = 100;

  while (true) {
    const data = await kayaGraphQL<{ webAscentsForUser: KayaAscent[] }>(
      query,
      { user_id: userId, climb_type_id: '1', count, offset }
    );

    const ascents = data?.webAscentsForUser || [];
    allAscents.push(...ascents);

    if (ascents.length < count) break;
    offset += count;
  }

  return allAscents;
}

/**
 * Convert height from cm to feet and inches
 */
export function formatHeight(heightCm: number): string {
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

/**
 * Convert ape index from cm to inches with +/- sign
 */
export function formatApeIndex(apeIndexCm: number): string {
  const inches = apeIndexCm / 2.54;
  const sign = inches >= 0 ? '+' : '';
  return `${sign}${inches.toFixed(1)}"`;
}

/**
 * Get grade ordering for sorting (higher = harder)
 */
export function getGradeOrdering(gradeName: string): number {
  const gradeMap: Record<string, number> = {
    'vIntro': 0,
    'vB': 5,
    'v0': 10,
    'v1': 20,
    'v2': 30,
    'v3': 40,
    'v4': 50,
    'v5': 60,
    'v6': 70,
    'v7': 80,
    'v8': 90,
    'v9': 100,
    'v10': 110,
    'v11': 120,
    'v12': 130,
    'v13': 140,
    'v14': 150,
    'v15': 160,
    'v16': 170,
    'v17': 180,
    'Boulder': -1, // Fallback grade
  };
  return gradeMap[gradeName] ?? -1;
}

/**
 * Get all Kaya data for display
 */
export async function getKayaData(): Promise<KayaData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  log.info('Fetching Kaya data...');

  try {
    // Get profile first to get user ID
    const profile = await getProfile(KAYA_USERNAME);
    if (!profile) {
      log.error('Failed to get Kaya profile');
      return null;
    }

    if (profile.is_private) {
      log.error('Kaya profile is private');
      return null;
    }

    log.info(`Found Kaya user: ${profile.fname} (ID: ${profile.id})`);

    // Fetch pyramid and ascents in parallel
    const [pyramid, ascents] = await Promise.all([
      getGradePyramid(profile.id),
      getAllAscents(profile.id)
    ]);

    // Filter ascents with videos and sort by grade (highest first)
    const ascentsWithVideos = ascents
      .filter(a => a.video !== null)
      .sort((a, b) => {
        const gradeA = a.climb.grade.ordering ?? getGradeOrdering(a.climb.grade.name);
        const gradeB = b.climb.grade.ordering ?? getGradeOrdering(b.climb.grade.name);
        // Sort by grade descending, then by date descending
        if (gradeB !== gradeA) return gradeB - gradeA;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    // Calculate stats
    // First try = flash + onsight (both are first attempt sends)
    const totalSends = pyramid.reduce((sum, g) => sum + g.ascent_count, 0);
    const totalFlashes = pyramid.reduce((sum, g) => sum + g.flash_count + g.onsight_count, 0);
    const flashRate = totalSends > 0 ? Math.round((totalFlashes / totalSends) * 100) : 0;

    // Get max grade (last in sorted pyramid)
    const maxGrade = pyramid.length > 0 ? pyramid[pyramid.length - 1].grade.name : null;

    const data: KayaData = {
      profile,
      pyramid,
      ascents,
      ascentsWithVideos,
      stats: {
        totalSends,
        totalFlashes,
        flashRate,
        maxGrade,
        totalVideos: ascentsWithVideos.length
      },
      timestamp: Date.now()
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched Kaya data: ${totalSends} sends, ${ascentsWithVideos.length} videos, max grade ${maxGrade}`);

    return data;
  } catch (error) {
    log.error('Error fetching Kaya data:', error);
    return null;
  }
}
