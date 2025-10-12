// PlayStation Network API integration using psn-api
// Documentation: https://github.com/achievements-app/psn-api

import {
  exchangeNpssoForCode,
  exchangeCodeForAccessToken,
  getUserTitles,
  type AuthTokensResponse,
  type TitleThinResponse,
} from 'psn-api';

const PSN_NPSSO = import.meta.env.PSN_NPSSO;

let cachedAuth: AuthTokensResponse | null = null;

export interface PSNGame {
  titleId: string;
  name: string;
  image?: string;
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
  recentGames: PSNGame[];
  totalGames: number;
  totalTrophies: {
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
    total: number;
  };
  trophyLevel?: number;
  completedGames: number; // Games with 100% trophies
}

/**
 * Get PSN authorization tokens
 */
async function getPSNAuth(): Promise<AuthTokensResponse | null> {
  if (!PSN_NPSSO) {
    console.error('PSN NPSSO token not configured');
    return null;
  }

  // Return cached auth if still valid (tokens last 1 hour)
  if (cachedAuth) {
    return cachedAuth;
  }

  try {
    // Exchange NPSSO for authorization code
    const accessCode = await exchangeNpssoForCode(PSN_NPSSO);

    // Exchange code for access token
    const authorization = await exchangeCodeForAccessToken(accessCode);

    cachedAuth = authorization;
    return authorization;
  } catch (error) {
    console.error('Error getting PSN authorization:', error);
    return null;
  }
}

/**
 * Get user's played titles
 */
export async function getPSNTitles(): Promise<PSNGame[]> {
  try {
    const auth = await getPSNAuth();
    if (!auth) {
      return [];
    }

    // Get titles for the authenticated user
    const response = await getUserTitles(
      { accessToken: auth.accessToken },
      'me',
      {
        limit: 50, // Get last 50 games
      }
    );

    // Transform the response to our format
    const games: PSNGame[] = response.trophyTitles.map((title: any) => {
      // PSN API doesn't provide playtime in trophy data
      // We'll leave it undefined for now
      let playDuration: string | undefined = undefined;

      // Try to get a better quality image
      // PSN trophy icon URLs are typically square and small
      // We can try to construct better URLs or just use what's available
      let imageUrl = title.trophyTitleIconUrl;

      // Some PSN images have size parameters we can modify
      // Try to replace small with larger resolution if possible
      if (imageUrl && imageUrl.includes('/trophy/')) {
        // Keep the original URL as PSN doesn't provide easy access to larger game covers
        imageUrl = imageUrl;
      }

      return {
        titleId: title.npCommunicationId,
        name: title.trophyTitleName,
        image: imageUrl,
        category: title.trophyTitlePlatform || 'Unknown',
        lastPlayedDateTime: title.lastUpdatedDateTime,
        earnedTrophies: title.earnedTrophies ? {
          bronze: title.earnedTrophies.bronze || 0,
          silver: title.earnedTrophies.silver || 0,
          gold: title.earnedTrophies.gold || 0,
          platinum: title.earnedTrophies.platinum || 0,
        } : undefined,
        playDuration,
      };
    });

    return games;
  } catch (error) {
    console.error('Error fetching PSN titles:', error);
    return [];
  }
}

/**
 * Get PSN gaming stats
 */
export async function getPSNStats(): Promise<PSNStats | null> {
  try {
    const auth = await getPSNAuth();
    if (!auth) {
      return null;
    }

    const titles = await getPSNTitles();

    if (titles.length === 0) {
      return null;
    }

    // Sort by last played (most recent first)
    const recentGames = titles
      .filter(g => g.lastPlayedDateTime)
      .sort((a, b) => {
        const dateA = new Date(a.lastPlayedDateTime!).getTime();
        const dateB = new Date(b.lastPlayedDateTime!).getTime();
        return dateB - dateA;
      })
      .slice(0, 10); // Get top 10 recent games

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

    // Trophy level would require additional API call
    // For now, set to undefined
    const trophyLevel: number | undefined = undefined;

    // Calculate completed games (games with 100% trophy completion)
    // Note: We'd need total trophy counts to calculate this accurately
    // For now, set to 0 as a placeholder
    const completedGames = 0;

    return {
      recentGames,
      totalGames: titles.length,
      totalTrophies,
      trophyLevel,
      completedGames,
    };
  } catch (error) {
    console.error('Error fetching PSN stats:', error);
    return null;
  }
}

/**
 * Format last played date
 */
export function formatLastPlayed(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
}
