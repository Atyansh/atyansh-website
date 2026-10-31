// Failure paths that must serve the last good copy without caching the
// failure over it (the build-cache bucket keeps whatever .cache holds).
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('fs', () => ({
  promises: {
    readFile: (...args: any[]) => mockReadFile(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    mkdir: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// No retries/backoff: each request resolves to whatever fetch returns
vi.mock('../retry', () => ({
  fetchWithRetry: (url: string, init?: RequestInit) => fetch(url, init),
  withRetry: (fn: () => Promise<unknown>) => fn(),
  DEFAULT_FETCH_TIMEOUT_MS: 1000,
}));

const launchStealthBrowser = vi.fn();
vi.mock('../browser', () => ({
  launchStealthBrowser: (...args: unknown[]) => launchStealthBrowser(...args),
}));

/** Serve `files` from .cache-fallback (the previous build's copy) only */
function previousBuild(files: Record<string, unknown>) {
  mockReadFile.mockImplementation(async (path: string) => {
    const name = path.replace(/^\.cache-fallback\//, '');
    if (path.startsWith('.cache-fallback/') && name in files) return JSON.stringify(files[name]);
    throw new Error('ENOENT');
  });
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function load<T>(module: string, env: Record<string, string>): Promise<T> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import(module) as Promise<T>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('MyAnimeList', () => {
  const env = { MAL_CLIENT_ID: 'id', MAL_ACCESS_TOKEN: 'token' };
  const entry = (id: number) => ({
    node: { id, title: `Anime ${id}`, start_date: '2020-04-01', main_picture: { large: 'l' } },
    list_status: { status: 'completed', score: 8 },
  });

  it('serves the last good list, uncached, when a page fails mid-pagination', async () => {
    previousBuild({ 'myanimelist-data.json': { timestamp: 1, anime: [{ title: 'Old', status: 'completed', startDate: '2019-01-01T00:00:00.000Z', malUrl: 'u', imageUrl: '' }] } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('offset=0')
        ? json({ data: [entry(1), entry(2)], paging: { next: 'more' } })
        : new Response('Service Unavailable', { status: 503 })
    ));
    const { getMALData } = await load<typeof import('../myanimelist')>('../myanimelist', env);

    const data = await getMALData();

    expect(data!.anime.map(a => a.title)).toEqual(['Old']);
    expect(data!.anime[0].startDate).toBeInstanceOf(Date);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('serves the last good list when credentials are missing', async () => {
    previousBuild({ 'myanimelist-data.json': { timestamp: 1, anime: [{ title: 'Old' }] } });
    const { getMALData } = await load<typeof import('../myanimelist')>('../myanimelist', { MAL_CLIENT_ID: '', MAL_ACCESS_TOKEN: '' });

    expect((await getMALData())!.anime[0].title).toBe('Old');
  });
});

describe('TMDB', () => {
  const env = { TMDB_ACCESS_TOKEN: 't', TMDB_ACCOUNT_OBJECT_ID: 'acct', TMDB_TV_LIST_ID: '7' };

  it('serves the last good shows, uncached, when page 2 of the list fails', async () => {
    previousBuild({ 'tmdb-tv-data.json': { timestamp: 1, shows: [{ title: 'Old Show', firstAiredAt: '2010-01-01T00:00:00.000Z' }], stats: {} } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/list/7') && url.endsWith('page=2')) return new Response('', { status: 500 });
      return json({ results: [{ id: 1, name: 'Show', first_air_date: '2020-01-01' }], total_pages: url.includes('/list/') ? 2 : 1 });
    }));
    const { getTmdbTVData } = await load<typeof import('../tmdb')>('../tmdb', env);

    const data = await getTmdbTVData();

    expect(data!.shows.map(s => s.title)).toEqual(['Old Show']);
    expect(data!.shows[0].firstAiredAt).toBeInstanceOf(Date);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

describe('Steam', () => {
  const env = { STEAM_API_KEY: 'k', STEAM_ID: '1' };

  it('serves the last good stats when owned games come back empty', async () => {
    previousBuild({ 'steam-data.json': { timestamp: 1, games: [{ appid: 1 }], stats: { totalGames: 321, playerSummary: {} } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('GetPlayerSummaries')
        ? json({ response: { players: [{ personaname: 'me' }] } })
        : json({ response: {} })
    ));
    const { getSteamStats } = await load<typeof import('../steam')>('../steam', env);

    expect((await getSteamStats())!.totalGames).toBe(321);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('keeps only the player summary fields the games page shows', async () => {
    previousBuild({});
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('GetPlayerSummaries')
        ? json({ response: { players: [{ personaname: 'me', realname: 'Real Name', loccountrycode: 'US', gameextrainfo: 'Hades II' }] } })
        : json({ response: { games: [{ appid: 1, name: 'Hades II', playtime_forever: 600 }] } })
    ));
    const { getSteamStats } = await load<typeof import('../steam')>('../steam', env);

    const stats = await getSteamStats();

    expect(stats!.playerSummary).toEqual({ gameextrainfo: 'Hades II' });
    expect(mockWriteFile.mock.calls[0][1]).not.toContain('Real Name');
  });
});

describe('Spotify', () => {
  const env = { SPOTIFY_CLIENT_ID: 'c', SPOTIFY_CLIENT_SECRET: 's', SPOTIFY_REFRESH_TOKEN: 'r' };
  const track = (id: string) => ({
    id,
    name: `Track ${id}`,
    uri: `spotify:track:${id}`,
    artists: [{ id: 'a', name: 'Artist', uri: 'spotify:artist:a', external_urls: { spotify: 'x' } }],
    album: { id: 'al', name: 'Album', images: [{ url: 'img', height: 640, width: 640 }], available_markets: ['US', 'NZ'] },
    available_markets: ['US', 'NZ'],
    external_ids: { isrc: 'X' },
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    popularity: 50,
  });

  function spotifyApi(overrides: Record<string, () => Response> = {}) {
    return vi.fn(async (url: string) => {
      if (url.includes('accounts.spotify.com')) return json({ access_token: 'at' });
      for (const [fragment, respond] of Object.entries(overrides)) {
        if (url.includes(fragment)) return respond();
      }
      if (url.includes('/me/top/tracks')) return json({ items: [track('t1'), track('t2')] });
      if (url.includes('/me/top/artists')) return json({ items: [{ id: 'a', name: 'Artist', genres: ['rock'], images: [], external_urls: { spotify: 'x' }, followers: { total: 9 } }] });
      if (url.includes('/me/albums')) return json({ items: [{ album: { id: 'al', name: 'Album', artists: [], images: [], release_date: '2020', external_urls: { spotify: 'x' }, tracks: { items: [track('t9')] } } }] });
      if (url.includes('/me/playlists')) return json({ items: [{ id: 'p1', name: 'Focus', images: null, tracks: { total: 2 }, external_urls: { spotify: 'x' }, public: true, owner: { id: 'me' } }, null] });
      if (url.includes('/me/player/recently-played')) return json({ items: [{ track: track('t3'), played_at: '2026-10-30T00:00:00Z' }] });
      if (url.includes('/playlists/p1/tracks')) return json({ items: [{ track: track('t4') }, { track: null }], next: null });
      return new Response('not found', { status: 404 });
    });
  }

  it('serves the last good data, uncached, when one endpoint returns 503', async () => {
    previousBuild({ 'spotify-data.json': {
      timestamp: 1,
      topTracks: { short: [track('old')], medium: [], long: [] },
      topArtists: { short: [], medium: [], long: [] },
      savedAlbums: [], playlists: [], featuredPlaylists: [], recentlyPlayed: [],
    } });
    vi.stubGlobal('fetch', spotifyApi({ '/me/albums': () => new Response('Service Unavailable', { status: 503 }) }));
    const { getSpotifyData } = await load<typeof import('../spotify')>('../spotify', env);

    const data = await getSpotifyData();

    expect(data!.topTracks.short.map(t => t.id)).toEqual(['old']);
    // The fallback copy is slimmed on read too
    expect(data!.topTracks.short[0]).not.toHaveProperty('available_markets');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('serves the last good data when a featured playlist page fails', async () => {
    previousBuild({ 'spotify-data.json': {
      timestamp: 1,
      topTracks: { short: [], medium: [], long: [] },
      topArtists: { short: [], medium: [], long: [] },
      savedAlbums: [], playlists: [], featuredPlaylists: [{ id: 'p1', name: 'Focus', images: [], tracks: { total: 1 }, external_urls: { spotify: 'x' }, public: true, allTracks: [track('kept')] }], recentlyPlayed: [],
    } });
    vi.stubGlobal('fetch', spotifyApi({ '/playlists/p1/tracks': () => new Response('', { status: 502 }) }));
    const { getSpotifyData } = await load<typeof import('../spotify')>('../spotify', env);

    const data = await getSpotifyData();

    expect(data!.featuredPlaylists[0].allTracks!.map(t => t.id)).toEqual(['kept']);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('caches only the fields the music page uses, keeping ids and uris for the embed player', async () => {
    previousBuild({});
    vi.stubGlobal('fetch', spotifyApi());
    const { getSpotifyData } = await load<typeof import('../spotify')>('../spotify', env);

    const data = await getSpotifyData();

    expect(data!.topTracks.short[0]).toEqual({
      id: 't1',
      name: 'Track t1',
      uri: 'spotify:track:t1',
      artists: [{ id: 'a', name: 'Artist' }],
      album: { id: 'al', name: 'Album', images: [{ url: 'img', height: 640, width: 640 }] },
      external_urls: { spotify: 'https://open.spotify.com/track/t1' },
    });
    // Null playlist entries and removed tracks are dropped
    expect(data!.playlists).toHaveLength(1);
    expect(data!.featuredPlaylists[0].allTracks!.map(t => t.id)).toEqual(['t4']);
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).not.toContain('available_markets');
    expect(written).not.toContain('external_ids');
  });
});

describe('Letterboxd incremental update', () => {
  const env = { LETTERBOXD_USERNAME: 'someone' };

  /** A browser whose page 1 lists `films` and whose later pages are Cloudflare-blocked */
  function blockedAfterPageOne(films: object[]) {
    let goto = '';
    const page = {
      goto: vi.fn(async (url: string) => {
        goto = url;
        if (url.includes('/page/')) throw new Error('Navigation timeout of 30000 ms exceeded');
      }),
      waitForFunction: vi.fn(async () => {}),
      waitForSelector: vi.fn(async () => {}),
      evaluate: vi.fn(async () => ({ films, maxPage: 3 })),
      close: vi.fn(async () => {}),
      title: vi.fn(async () => 'Just a moment...'),
      url: vi.fn(() => goto),
      content: vi.fn(async () => '<html></html>'),
    };
    launchStealthBrowser.mockResolvedValue({ newPage: vi.fn(async () => page), close: vi.fn(async () => {}) });
  }

  const rss = `<rss><channel>
    <item>
      <link>https://letterboxd.com/someone/film/new-film/</link>
      <letterboxd:watchedDate>2026-10-20</letterboxd:watchedDate>
      <letterboxd:rewatch>No</letterboxd:rewatch>
      <letterboxd:filmTitle>New Film</letterboxd:filmTitle>
      <letterboxd:filmYear>2026</letterboxd:filmYear>
      <letterboxd:memberRating>4.5</letterboxd:memberRating>
    </item>
    <item>
      <link>https://letterboxd.com/someone/film/old-classic/</link>
      <letterboxd:watchedDate>2026-10-18</letterboxd:watchedDate>
      <letterboxd:rewatch>Yes</letterboxd:rewatch>
      <letterboxd:filmTitle>Old Classic</letterboxd:filmTitle>
      <letterboxd:filmYear>1975</letterboxd:filmYear>
    </item>
  </channel></rss>`;

  it('revives cached dates, merges diary details, and sorts like the movies page', async () => {
    const lastFullScrape = Date.now() - 5 * 86400000;
    previousBuild({ 'letterboxd-data.json': {
      timestamp: Date.now() - 86400000,
      lastFullScrape,
      movies: [
        { title: 'Old Classic', year: 1975, releaseDate: '1975-01-01T00:00:00.000Z', posterImage: 'p', link: 'https://letterboxd.com/film/old-classic/', rating: 5 },
        { title: 'Middle', year: 2001, releaseDate: '2001-01-01T00:00:00.000Z', watchedDate: '2024-03-04T00:00:00.000Z', posterImage: 'p', link: 'https://letterboxd.com/film/middle/', rating: 3 },
      ],
    } });
    blockedAfterPageOne([{ title: 'New Film', year: 2026, link: '/film/new-film/', posterImage: 'https://a.ltrbxd.com/resized/film-poster/1/1-new-film-0-230-0-345-crop.jpg', rating: 4 }]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/rss/') ? new Response(rss) : new Response(null, { status: 200 })
    ));
    const { getLetterboxdData } = await load<typeof import('../letterboxd')>('../letterboxd', env);

    const data = await getLetterboxdData();
    const movies = data!.movies;

    expect(movies.map(m => m.title).sort()).toEqual(['Middle', 'New Film', 'Old Classic']);
    for (const movie of movies) {
      expect(movie.releaseDate).toBeInstanceOf(Date);
    }
    const byTitle = Object.fromEntries(movies.map(m => [m.title, m]));
    // Grid rating wins over the feed's
    expect(byTitle['New Film'].rating).toBe(4);
    expect(byTitle['New Film'].watchedDate).toEqual(new Date(2026, 9, 20));
    expect(byTitle['Old Classic'].rewatch).toBe(true);
    expect(byTitle['Old Classic'].rating).toBe(5);
    expect(byTitle['Middle'].watchedDate).toBeInstanceOf(Date);

    // The movies page's default sort (MoviesFilter: newest release first)
    const sorted = [...movies].sort((a, b) => b.releaseDate!.valueOf() - a.releaseDate!.valueOf());
    expect(sorted.map(m => m.title)).toEqual(['New Film', 'Middle', 'Old Classic']);

    expect(data!.lastFullScrape).toBe(lastFullScrape);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('serves the last good list when the username is missing', async () => {
    previousBuild({ 'letterboxd-data.json': { timestamp: 1, movies: [{ title: 'Kept', posterImage: '', releaseDate: '2001-01-01T00:00:00.000Z' }] } });
    const { getLetterboxdData } = await load<typeof import('../letterboxd')>('../letterboxd', { LETTERBOXD_USERNAME: '' });

    const data = await getLetterboxdData();

    expect(data!.movies[0].title).toBe('Kept');
    expect(data!.movies[0].releaseDate).toBeInstanceOf(Date);
    expect(launchStealthBrowser).not.toHaveBeenCalled();
  });
});

describe('Kaya', () => {
  it.each([
    ['the profile lookup fails', { errors: [{ message: 'boom' }] }],
    ['the profile is private', { data: { webUser: { id: '1', fname: 'A', is_private: true } } }],
  ])('serves the last good data when %s', async (_, profileResponse) => {
    previousBuild({ 'kaya-data.json': { timestamp: 1, ascents: [{ id: 'a1' }], ascentsWithVideos: [], pyramid: [], profile: null, stats: {} } });
    vi.stubGlobal('fetch', vi.fn(async () => json(profileResponse)));
    const { getKayaData } = await load<typeof import('../kaya')>('../kaya', { KAYA_USERNAME: 'climber' });

    const data = await getKayaData();

    expect(data!.ascents.map(a => a.id)).toEqual(['a1']);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
