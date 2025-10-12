// Steam Web API integration
// Documentation: https://steamwebapi.azurewebsites.net/

const STEAM_API_KEY = import.meta.env.STEAM_API_KEY;
const STEAM_ID = import.meta.env.STEAM_ID;
const BASE_URL = 'https://api.steampowered.com';

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number; // Total playtime in minutes
  playtime_2weeks?: number; // Playtime in last 2 weeks in minutes
  img_icon_url: string;
  img_logo_url: string;
}

export interface RecentGame extends SteamGame {
  playtime_2weeks: number;
}

export interface PlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number; // 0: Offline, 1: Online, etc.
  gameid?: string;
  gameextrainfo?: string; // Currently playing game name
}

export interface SteamStats {
  recentGames: RecentGame[];
  topPlayedGames: SteamGame[];
  totalGames: number;
  totalHoursPlayed: number;
  playerSummary: PlayerSummary;
  gamesPlayedCount: number; // Games with playtime > 0
  averageHoursPerGame: number;
}

/**
 * Fetch player summary (profile info, online status, currently playing)
 */
export async function getPlayerSummary(): Promise<PlayerSummary | null> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.error('Steam API key or Steam ID not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${STEAM_ID}`
    );
    const data = await response.json();

    if (data.response?.players?.length > 0) {
      return data.response.players[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching Steam player summary:', error);
    return null;
  }
}

/**
 * Fetch recently played games (games played in last 2 weeks)
 */
export async function getRecentlyPlayedGames(): Promise<RecentGame[]> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.error('Steam API key or Steam ID not configured');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json`
    );
    const data = await response.json();

    return data.response?.games || [];
  } catch (error) {
    console.error('Error fetching recently played games:', error);
    return [];
  }
}

/**
 * Fetch all owned games with playtime
 */
export async function getOwnedGames(): Promise<SteamGame[]> {
  if (!STEAM_API_KEY || !STEAM_ID) {
    console.error('Steam API key or Steam ID not configured');
    return [];
  }

  try {
    const response = await fetch(
      `${BASE_URL}/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=true&include_played_free_games=true`
    );
    const data = await response.json();

    return data.response?.games || [];
  } catch (error) {
    console.error('Error fetching owned games:', error);
    return [];
  }
}

/**
 * Get comprehensive Steam stats
 */
export async function getSteamStats(): Promise<SteamStats | null> {
  try {
    const [playerSummary, recentGames, ownedGames] = await Promise.all([
      getPlayerSummary(),
      getRecentlyPlayedGames(),
      getOwnedGames(),
    ]);

    if (!playerSummary) {
      return null;
    }

    // Calculate total hours played across all games
    const totalMinutes = ownedGames.reduce((sum, game) => sum + game.playtime_forever, 0);
    const totalHoursPlayed = Math.round(totalMinutes / 60);

    // Get games that have been played (playtime > 0)
    const playedGames = ownedGames.filter(game => game.playtime_forever > 0);
    const gamesPlayedCount = playedGames.length;

    // Calculate average hours per played game
    const averageHoursPerGame = gamesPlayedCount > 0
      ? Math.round(totalMinutes / 60 / gamesPlayedCount)
      : 0;

    // Get top 10 most played games
    const topPlayedGames = [...playedGames]
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 10);

    return {
      recentGames,
      topPlayedGames,
      totalGames: ownedGames.length,
      totalHoursPlayed,
      playerSummary,
      gamesPlayedCount,
      averageHoursPerGame,
    };
  } catch (error) {
    console.error('Error fetching Steam stats:', error);
    return null;
  }
}

/**
 * Get Steam game icon URL
 */
export function getGameIconUrl(appid: number, iconHash: string): string {
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${iconHash}.jpg`;
}

/**
 * Get Steam game header/capsule image URL (better quality for cards)
 * Using header.jpg which is 460x215 (16:9 ratio)
 */
export function getGameCapsuleUrl(appid: number): string {
  // Use header.jpg - it's 16:9 ratio and high quality
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/**
 * Get Steam game capsule image fallback URLs
 */
export function getGameCapsuleFallbacks(appid: number): string[] {
  return [
    `https://media.steampowered.com/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://media.steampowered.com/steam/apps/${appid}/capsule_616x353.jpg`,
  ];
}

/**
 * Get Steam game hero/header image URL (for modal)
 */
export function getGameHeaderUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`;
}

/**
 * Convert playtime from minutes to hours with decimal
 */
export function formatPlaytime(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) {
    return `${minutes}m`;
  }
  return `${hours.toFixed(1)}h`;
}
