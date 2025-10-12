// Spotify API integration
// Uses OAuth 2.0 with refresh token for authentication

const SPOTIFY_CLIENT_ID = import.meta.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = import.meta.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = import.meta.env.SPOTIFY_REFRESH_TOKEN;

// Cache configuration
const CACHE_DIR = '.cache';
const SPOTIFY_CACHE_FILE = '.cache/spotify-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// Spotify API types
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  preview_url?: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  release_date: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  tracks: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
  public: boolean;
}

export interface SpotifyPodcastEpisode {
  id: string;
  name: string;
  description?: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  duration_ms: number;
  release_date: string;
  show: {
    id: string;
    name: string;
    publisher: string;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyRecentlyPlayedItem {
  track?: SpotifyTrack;
  episode?: SpotifyPodcastEpisode;
  played_at: string;
  context?: {
    type: string;
    href: string;
  };
}

export interface SpotifyPlaylistWithTracks extends SpotifyPlaylist {
  allTracks?: SpotifyTrack[];
}

export interface SpotifyData {
  topTracks: {
    short: SpotifyTrack[];
    medium: SpotifyTrack[];
    long: SpotifyTrack[];
  };
  topArtists: {
    short: SpotifyArtist[];
    medium: SpotifyArtist[];
    long: SpotifyArtist[];
  };
  savedAlbums: SpotifyAlbum[];
  playlists: SpotifyPlaylist[];
  featuredPlaylists: SpotifyPlaylistWithTracks[];
  recentlyPlayed: SpotifyRecentlyPlayedItem[];
  timestamp: number;
}

interface CachedSpotifyData extends SpotifyData {}

// In-memory cache
let memoryCache: CachedSpotifyData | null = null;

/**
 * Load Spotify cache from disk
 */
async function loadCache(): Promise<CachedSpotifyData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(SPOTIFY_CACHE_FILE, 'utf-8');
    const cached: CachedSpotifyData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached Spotify data');
      return cached;
    }

    console.log('Spotify cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Spotify cache to disk
 */
async function saveCache(data: SpotifyData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(SPOTIFY_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved Spotify data to cache');
  } catch (error) {
    console.error('Failed to save Spotify cache:', error);
  }
}

/**
 * Get access token using refresh token
 */
async function getAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    console.error('Spotify credentials not configured');
    return null;
  }

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SPOTIFY_REFRESH_TOKEN,
      }),
    });

    if (!response.ok) {
      console.error(`Spotify auth error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    return null;
  }
}

/**
 * Fetch data from Spotify API
 */
async function spotifyFetch<T>(endpoint: string, accessToken: string): Promise<T | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Spotify API error for ${endpoint}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching from Spotify ${endpoint}:`, error);
    return null;
  }
}

/**
 * Get user's top tracks
 */
async function getTopTracks(accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term', limit: number = 20): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data?.items || [];
}

/**
 * Get user's top artists
 */
async function getTopArtists(accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term', limit: number = 20): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ items: SpotifyArtist[] }>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data?.items || [];
}

/**
 * Get user's saved albums
 */
async function getSavedAlbums(accessToken: string, limit: number = 50): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ items: Array<{ album: SpotifyAlbum }> }>(
    `/me/albums?limit=${limit}`,
    accessToken
  );
  return data?.items.map(item => item.album) || [];
}

/**
 * Get user's playlists
 */
async function getUserPlaylists(accessToken: string, limit: number = 50): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    `/me/playlists?limit=${limit}`,
    accessToken
  );
  return data?.items || [];
}

/**
 * Get user's recently played tracks and podcast episodes
 */
async function getRecentlyPlayed(accessToken: string, limit: number = 50): Promise<SpotifyRecentlyPlayedItem[]> {
  const data = await spotifyFetch<{ items: SpotifyRecentlyPlayedItem[] }>(
    `/me/player/recently-played?limit=${limit}`,
    accessToken
  );
  return data?.items || [];
}

/**
 * Get all tracks from a specific playlist
 */
async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const data = await spotifyFetch<{ items: Array<{ track: SpotifyTrack }>; next: string | null }>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
      accessToken
    );

    if (data?.items) {
      tracks.push(...data.items.map(item => item.track));
      hasMore = data.next !== null;
      offset += limit;
    } else {
      hasMore = false;
    }
  }

  return tracks;
}

/**
 * Get all Spotify data (top tracks, artists, albums, playlists, recently played)
 */
export async function getSpotifyData(): Promise<SpotifyData | null> {
  // Check cache first
  const cached = await loadCache();
  if (cached) {
    return cached;
  }

  // Get fresh data from Spotify
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('Failed to get Spotify access token');
    return null;
  }

  console.log('Fetching Spotify data...');

  try {
    // Fetch all data in parallel
    const [
      topTracksShort,
      topTracksMedium,
      topTracksLong,
      topArtistsShort,
      topArtistsMedium,
      topArtistsLong,
      savedAlbums,
      playlists,
      recentlyPlayed,
    ] = await Promise.all([
      getTopTracks(accessToken, 'short_term', 20),
      getTopTracks(accessToken, 'medium_term', 20),
      getTopTracks(accessToken, 'long_term', 20),
      getTopArtists(accessToken, 'short_term', 20),
      getTopArtists(accessToken, 'medium_term', 20),
      getTopArtists(accessToken, 'long_term', 20),
      getSavedAlbums(accessToken, 50),
      getUserPlaylists(accessToken, 50),
      getRecentlyPlayed(accessToken, 50),
    ]);

    // Find featured playlists and fetch their tracks
    const featuredPlaylistNames = ['Songs I actually listen to', 'Focus'];
    const featuredPlaylists: SpotifyPlaylistWithTracks[] = [];

    for (const playlistName of featuredPlaylistNames) {
      const playlist = playlists.find(p => p.name === playlistName);
      if (playlist) {
        console.log(`Fetching tracks for playlist: ${playlistName}...`);
        const tracks = await getPlaylistTracks(accessToken, playlist.id);
        // Reverse tracks to show most recently added first
        featuredPlaylists.push({
          ...playlist,
          allTracks: tracks.reverse(),
        });
        console.log(`✓ Fetched ${tracks.length} tracks for ${playlistName}`);
      }
    }

    const data: SpotifyData = {
      topTracks: {
        short: topTracksShort,
        medium: topTracksMedium,
        long: topTracksLong,
      },
      topArtists: {
        short: topArtistsShort,
        medium: topArtistsMedium,
        long: topArtistsLong,
      },
      savedAlbums,
      playlists: playlists.filter(p => p.public || p.id), // Only include accessible playlists
      featuredPlaylists,
      recentlyPlayed,
      timestamp: Date.now(),
    };

    // Save to cache
    await saveCache(data);

    console.log(`✓ Fetched Spotify data: ${data.topTracks.long.length} tracks, ${data.topArtists.long.length} artists, ${data.savedAlbums.length} albums, ${data.playlists.length} playlists, ${data.featuredPlaylists.length} featured playlists, ${data.recentlyPlayed.length} recently played`);

    return data;
  } catch (error) {
    console.error('Error fetching Spotify data:', error);
    return null;
  }
}

/**
 * Get the best image URL from Spotify images array
 */
export function getBestImage(images: Array<{ url: string; height: number; width: number }>): string | undefined {
  if (!images || images.length === 0) {
    return undefined;
  }

  // Sort by size (prefer larger images) and return the first one
  const sorted = [...images].sort((a, b) => (b.height || 0) - (a.height || 0));
  return sorted[0]?.url;
}
