import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const {
  APIs,
  DISCORD_LIMITS,
  checkAPIHealth,
  buildDiscordPayload,
  buildPlainTextMessage,
  sendDiscordNotification,
} = require('../../../scripts/check-api-health.cjs');

const api = (name: string) => APIs.find((a: any) => a.name === name);
const DAY = 24 * 60 * 60 * 1000;

const healthySpotify = {
  topTracks: { short: [{}], medium: [{}], long: [{}] },
  topArtists: { short: [{}], medium: [{}], long: [{}] },
  playlists: [{}],
  recentlyPlayed: [{}],
};

describe('checkFn on fixture data', () => {
  it('Spotify needs top tracks, artists, playlists and recently played', () => {
    expect(api('Spotify').checkFn(healthySpotify)).toBe(true);
    const noArtists = { ...healthySpotify, topArtists: { short: [], medium: [], long: [] } };
    expect(api('Spotify').checkFn(noArtists)).toBe(false);
    expect(api('Spotify').failReason(noArtists)).toContain('top artists');
  });

  it.each([
    ['MyAnimeList', { anime: [{}] }, { anime: [] }],
    ['Steam', { games: [{}] }, { games: [] }],
    ['PlayStation Network', { games: [{}] }, {}],
    ['IGDB (Game Covers)', { 'steam:x': { url: 'u', timestamp: 1 } }, { 'steam:x': { url: '', timestamp: 1 } }],
    ['Letterboxd', { movies: [{}] }, { movies: [] }],
    ['Goodreads', { books: [{}] }, { books: [] }],
    ['Goodreads (session renewal)', { renewed: true }, { renewed: false, error: 'x' }],
    ['Nintendo Switch', { games: [{}] }, { games: [] }],
    ['Kaya (Climbing)', { pyramid: [{}], ascentsWithVideos: [{}] }, { pyramid: [{}], ascentsWithVideos: [] }],
    ['Kaya (Logged-in)', {}, { authError: 'token refresh returned 401' }],
    ['TMDB (TV Shows)', { shows: [{ posterImage: 'p' }, { posterImage: '' }] }, { shows: [{ posterImage: '' }, { posterImage: '' }] }],
  ])('%s passes healthy data and fails broken data', (name, good, bad) => {
    expect(api(name).checkFn(good)).toBeTruthy();
    expect(api(name).checkFn(bad)).toBeFalsy();
  });
});

describe('checkAPIHealth', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'health-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const write = (file: string, data: object) => writeFileSync(path.join(dir, file), JSON.stringify(data));

  it('reports a missing Kaya file once, not again as a logged-in failure', async () => {
    const results = await checkAPIHealth(dir, [api('Kaya (Climbing)'), api('Kaya (Logged-in)')]);
    expect(results.failed.map((f: any) => f.name)).toEqual(['Kaya (Climbing)']);
    expect(results.skipped.map((f: any) => f.name)).toEqual(['Kaya (Logged-in)']);
  });

  it('reports a stale Kaya file once', async () => {
    write('kaya-data.json', { timestamp: Date.now() - 2 * DAY, pyramid: [{}], ascentsWithVideos: [{}], authError: 'old' });
    const results = await checkAPIHealth(dir, [api('Kaya (Climbing)'), api('Kaya (Logged-in)')]);
    expect(results.failed.map((f: any) => f.name)).toEqual(['Kaya (Climbing)']);
  });

  it('alerts on a fresh Kaya file with an auth error', async () => {
    write('kaya-data.json', { timestamp: Date.now(), pyramid: [{}], ascentsWithVideos: [{}], authError: 'token refresh returned 401' });
    const results = await checkAPIHealth(dir, [api('Kaya (Climbing)'), api('Kaya (Logged-in)')]);
    expect(results.healthy.map((f: any) => f.name)).toEqual(['Kaya (Climbing)']);
    expect(results.failed.map((f: any) => f.name)).toEqual(['Kaya (Logged-in)']);
  });

  it('accepts an IGDB cache whose newest cover is a few days old (covers are reused for 7 days)', async () => {
    write('igdb-covers.json', { 'steam:x': { url: 'u', timestamp: Date.now() - 3 * DAY } });
    const results = await checkAPIHealth(dir, [api('IGDB (Game Covers)')]);
    expect(results.healthy).toHaveLength(1);
  });
});

/** Every API failing, with long reasons — the worst case for Discord's limits */
function allFailing() {
  return {
    healthy: [],
    failed: APIs.map((a: any) => ({
      name: a.name,
      reason: `Error reading cache: ${'x'.repeat(900)}`,
      renewal: a.renewal,
      requiresApiKey: a.requiresApiKey,
      selfHealing: a.selfHealing || false,
    })),
    timestamp: new Date().toISOString(),
  };
}

describe('buildDiscordPayload', () => {
  it('stays within every Discord limit when all APIs fail', () => {
    const { embeds: [embed] } = buildDiscordPayload(allFailing());

    expect(embed.fields.length).toBeLessThanOrEqual(DISCORD_LIMITS.fields);
    for (const field of embed.fields) {
      expect(field.value.length).toBeLessThanOrEqual(1024);
      expect(field.name.length).toBeLessThanOrEqual(256);
    }
    const total = embed.title.length + embed.description.length + embed.footer.text.length
      + embed.fields.reduce((n: number, f: any) => n + f.name.length + f.value.length, 0);
    expect(total).toBeLessThanOrEqual(6000);
    // Whatever didn't fit is summarised rather than silently dropped
    expect(embed.fields.at(-1).name).toMatch(/^…and \d+ more$/);
  });

  it('gives each failed API its own field, most urgent first', () => {
    const results = {
      healthy: [{ name: 'Steam' }],
      failed: [
        { name: 'Letterboxd', reason: 'r1', renewal: 'f1', requiresApiKey: false },
        { name: 'TMDB (TV Shows)', reason: 'r2', renewal: 'f2', requiresApiKey: true, selfHealing: false },
      ],
      timestamp: new Date().toISOString(),
    };
    const { embeds: [embed] } = buildDiscordPayload(results);
    expect(embed.fields.map((f: any) => f.name)).toEqual([
      '🚨 Action required: TMDB (TV Shows)',
      '❌ Scraping failed: Letterboxd',
      '✅ Healthy APIs',
    ]);
    expect(embed.fields[0].value).toBe('r2\nFix: f2');
  });
});

describe('buildPlainTextMessage', () => {
  it('fits in a 2000-character message when all APIs fail', () => {
    const text = buildPlainTextMessage(allFailing());
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(text).toContain('Spotify');
  });
});

describe('sendDiscordNotification', () => {
  beforeEach(() => {
    vi.stubEnv('DISCORD_BOT_TOKEN', 'bot');
    vi.stubEnv('DISCORD_USER_ID', '42');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries as plain text when Discord rejects the embed', async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/users/@me/channels')) return new Response(JSON.stringify({ id: 'c1' }));
      const body = JSON.parse(init.body as string);
      return body.embeds
        ? new Response('{"message": "Invalid Form Body"}', { status: 400 })
        : new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendDiscordNotification(allFailing())).toBe(true);
    const lastBody = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
    expect(lastBody.embeds).toBeUndefined();
    expect(lastBody.content.length).toBeLessThanOrEqual(2000);
  });

  it('returns false rather than throwing when both attempts fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/users/@me/channels')
        ? new Response(JSON.stringify({ id: 'c1' }))
        : new Response('nope', { status: 500 })
    ));
    expect(await sendDiscordNotification(allFailing())).toBe(false);
  });
});
