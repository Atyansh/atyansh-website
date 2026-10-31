// Spotify API integration
// Uses OAuth 2.0 with refresh token for authentication

import { fetchWithRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';

const SPOTIFY_CLIENT_ID = import.meta.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = import.meta.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = import.meta.env.SPOTIFY_REFRESH_TOKEN;

const log = createLogger('Spotify');
const cache = new FileCache<SpotifyData>('spotify-data', {
  ttl: 24 * 60 * 60 * 1000,
  deserialize: (data) => slimSpotifyData(data),
});

// Spotify API types
export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string; // spotify:track:<id>, for the embed player
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
  uri?: string;
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
  uri?: string;
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
  uri?: string;
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
  uri?: string;
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

/**
 * Get access token using refresh token
 * Includes retry logic for transient failures
 */
async function getAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    log.error('Spotify credentials not configured');
    return null;
  }

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await fetchWithRetry(
      'https://accounts.spotify.com/api/token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: SPOTIFY_REFRESH_TOKEN,
        }),
      },
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          log.info(`Spotify auth retry ${attempt}: ${error.message}`);
        },
      }
    );

    if (!response.ok) {
      log.error(`Spotify auth error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    log.error('Error getting Spotify access token:', error);
    return null;
  }
}

/**
 * Fetch data from Spotify API
 * Includes retry logic for transient failures. Throws on any failure: a
 * swallowed error used to come back as an empty list that was then cached
 * over the last good copy.
 */
async function spotifyFetch<T>(endpoint: string, accessToken: string): Promise<T> {
  const response = await fetchWithRetry(
    `https://api.spotify.com/v1${endpoint}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    },
    {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt) => {
        log.info(`Spotify API retry ${attempt} for ${endpoint}: ${error.message}`);
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify API error for ${endpoint}: ${response.status}`);
  }

  return await response.json();
}

// The API returns far more than the page uses (available_markets alone lists
// ~180 country codes per track and album). Everything cached here is also
// passed to the music page's islands as props, so keep only what the UI
// reads, plus each item's id/uri for the Spotify embed player.
type Image = { url: string; height: number; width: number };
const slimImages = (images: any): Image[] =>
  (images ?? []).map((i: any) => ({ url: i.url, height: i.height, width: i.width }));
const slimArtistRef = (a: any) => ({ id: a.id, name: a.name });
const spotifyUrl = (item: any) => ({ spotify: item.external_urls?.spotify ?? '' });
// Older cached copies can hold nulls (e.g. removed playlist tracks)
const slimAll = <T>(items: any[] | undefined, slim: (item: any) => T): T[] =>
  (items ?? []).filter(Boolean).map(slim);

export function slimTrack(t: any): SpotifyTrack {
  return {
    id: t.id,
    name: t.name,
    uri: t.uri,
    artists: (t.artists ?? []).map(slimArtistRef),
    album: { id: t.album?.id, name: t.album?.name, images: slimImages(t.album?.images) },
    ...(t.preview_url ? { preview_url: t.preview_url } : {}),
    external_urls: spotifyUrl(t),
  };
}

function slimArtist(a: any): SpotifyArtist {
  return {
    id: a.id,
    name: a.name,
    uri: a.uri,
    genres: a.genres ?? [],
    images: slimImages(a.images),
    external_urls: spotifyUrl(a),
  };
}

function slimAlbum(a: any): SpotifyAlbum {
  return {
    id: a.id,
    name: a.name,
    uri: a.uri,
    artists: (a.artists ?? []).map(slimArtistRef),
    images: slimImages(a.images),
    release_date: a.release_date,
    external_urls: spotifyUrl(a),
  };
}

function slimPlaylist(p: any): SpotifyPlaylist {
  return {
    id: p.id,
    name: p.name,
    uri: p.uri,
    ...(p.description ? { description: p.description } : {}),
    images: slimImages(p.images),
    tracks: { total: p.tracks?.total ?? 0 },
    external_urls: spotifyUrl(p),
    public: p.public,
  };
}

function slimEpisode(e: any): SpotifyPodcastEpisode {
  return {
    id: e.id,
    name: e.name,
    uri: e.uri,
    images: slimImages(e.images),
    duration_ms: e.duration_ms,
    release_date: e.release_date,
    show: { id: e.show?.id, name: e.show?.name, publisher: e.show?.publisher },
    external_urls: spotifyUrl(e),
  };
}

function slimRecentlyPlayed(item: any): SpotifyRecentlyPlayedItem {
  return {
    ...(item.track ? { track: slimTrack(item.track) } : {}),
    ...(item.episode ? { episode: slimEpisode(item.episode) } : {}),
    played_at: item.played_at,
    ...(item.context ? { context: { type: item.context.type, href: item.context.href } } : {}),
  };
}

/**
 * Reduce a full (or previously cached) Spotify payload to the fields the site
 * uses. Also applied to cached copies, so an older full-size fallback is
 * trimmed too.
 */
export function slimSpotifyData(data: SpotifyData): SpotifyData {
  return {
    topTracks: {
      short: slimAll(data.topTracks.short, slimTrack),
      medium: slimAll(data.topTracks.medium, slimTrack),
      long: slimAll(data.topTracks.long, slimTrack),
    },
    topArtists: {
      short: slimAll(data.topArtists.short, slimArtist),
      medium: slimAll(data.topArtists.medium, slimArtist),
      long: slimAll(data.topArtists.long, slimArtist),
    },
    savedAlbums: slimAll(data.savedAlbums, slimAlbum),
    playlists: slimAll(data.playlists, slimPlaylist),
    featuredPlaylists: (data.featuredPlaylists ?? []).map(p => ({
      ...slimPlaylist(p),
      allTracks: p.allTracks && slimAll(p.allTracks, slimTrack),
    })),
    recentlyPlayed: slimAll(data.recentlyPlayed, slimRecentlyPlayed),
    timestamp: data.timestamp,
  };
}

/** Total items across every list, for the cache plausibility guard */
export function countSpotifyItems(data: SpotifyData): number {
  return data.topTracks.short.length + data.topTracks.medium.length + data.topTracks.long.length
    + data.topArtists.short.length + data.topArtists.medium.length + data.topArtists.long.length
    + data.savedAlbums.length + data.playlists.length + data.recentlyPlayed.length
    + data.featuredPlaylists.reduce((sum, p) => sum + (p.allTracks?.length ?? 0), 0);
}

/**
 * Get user's top tracks
 */
async function getTopTracks(accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term', limit: number = 20): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: unknown[] }>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data.items.map(slimTrack);
}

/**
 * Get user's top artists
 */
async function getTopArtists(accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term', limit: number = 20): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ items: unknown[] }>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    accessToken
  );
  return data.items.map(slimArtist);
}

/**
 * Get user's saved albums
 */
async function getSavedAlbums(accessToken: string, limit: number = 50): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ items: Array<{ album: unknown }> }>(
    `/me/albums?limit=${limit}`,
    accessToken
  );
  return data.items.map(item => slimAlbum(item.album));
}

/**
 * Get user's playlists
 */
async function getUserPlaylists(accessToken: string, limit: number = 50): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: unknown[] }>(
    `/me/playlists?limit=${limit}`,
    accessToken
  );
  // Playlists the user no longer has access to come back as null
  return data.items.filter(Boolean).map(slimPlaylist);
}

/**
 * Get user's recently played tracks and podcast episodes
 */
async function getRecentlyPlayed(accessToken: string, limit: number = 50): Promise<SpotifyRecentlyPlayedItem[]> {
  const data = await spotifyFetch<{ items: unknown[] }>(
    `/me/player/recently-played?limit=${limit}`,
    accessToken
  );
  return data.items.map(slimRecentlyPlayed);
}

/**
 * Get all tracks from a specific playlist. Throws if any page fails rather
 * than returning the pages fetched so far.
 */
async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const limit = 100;
  const maxPages = 50; // runaway guard: 5000 tracks

  for (let page = 0; page < maxPages; page++) {
    const data = await spotifyFetch<{ items?: Array<{ track: unknown }>; next: string | null }>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
      accessToken
    );

    if (!Array.isArray(data.items)) {
      throw new Error(`Spotify playlist ${playlistId} page at offset ${offset} had no items`);
    }

    // Removed/unavailable tracks come back as { track: null }
    tracks.push(...data.items.filter(item => item.track).map(item => slimTrack(item.track)));
    if (!data.next) {
      return tracks;
    }
    offset += limit;
  }

  throw new Error(`Spotify playlist ${playlistId} still had more tracks after ${maxPages} pages`);
}

/**
 * Get all Spotify data (top tracks, artists, albums, playlists, recently played)
 */
export async function getSpotifyData(): Promise<SpotifyData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  // Get fresh data from Spotify
  const accessToken = await getAccessToken();
  if (!accessToken) {
    log.error('Failed to get Spotify access token');
    return cache.fallback('Spotify');
  }

  log.info('Fetching Spotify data...');

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

    // Find featured playlists and fetch their tracks in parallel
    const featuredPlaylistNames = ['Songs I actually listen to', 'Focus'];
    const featuredPlaylistResults = await Promise.all(
      featuredPlaylistNames.map(async (playlistName): Promise<SpotifyPlaylistWithTracks | null> => {
        const playlist = playlists.find(p => p.name === playlistName);
        if (!playlist) return null;
        log.info(`Fetching tracks for playlist: ${playlistName}...`);
        const tracks = await getPlaylistTracks(accessToken, playlist.id);
        log.info(`Fetched ${tracks.length} tracks for ${playlistName}`);
        return { ...playlist, allTracks: tracks.reverse() };
      })
    );
    const featuredPlaylists = featuredPlaylistResults.filter(
      (p): p is SpotifyPlaylistWithTracks => p !== null
    );

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
      playlists,
      featuredPlaylists,
      recentlyPlayed,
      timestamp: Date.now(),
    };

    // Save to cache, unless it came back empty or sharply shrunken
    await cache.setIfPlausible('Spotify', data, countSpotifyItems);

    log.info(`Fetched Spotify data: ${data.topTracks.long.length} tracks, ${data.topArtists.long.length} artists, ${data.savedAlbums.length} albums, ${data.playlists.length} playlists, ${data.featuredPlaylists.length} featured playlists, ${data.recentlyPlayed.length} recently played`);

    return data;
  } catch (error) {
    log.error('Error fetching Spotify data:', error);
    return cache.fallback('Spotify');
  }
}

/**
 * Get the best image URL from Spotify images array
 * Spotify API returns images sorted largest-first, so just take the first one
 */
export function getBestImage(images: Array<{ url: string; height: number; width: number }>): string | undefined {
  return images?.[0]?.url;
}
