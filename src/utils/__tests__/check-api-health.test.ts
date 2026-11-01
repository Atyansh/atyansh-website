import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const {
  APIs,
  DISCORD_LIMITS,
  selectAPIs,
  monitorName,
  checkAPIHealth,
  buildDiscordPayload,
  buildPlainTextMessage,
  readBuildFailures,
  sendDiscordNotification,
} = require('../../../scripts/check-api-health.cjs');

import { INTEGRATIONS } from '../../integrations';
import { siteConfig } from '../../site.config';

const api = (name: string) => APIs.find((a: any) => a.name === name);
const names = (list: { name: string }[]) => list.map(a => a.name).sort();
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
    ['Goodreads (login expiry)', { renewed: false, expiresAt: new Date(Date.now() + 200 * DAY).toISOString() }, { renewed: true, expiresAt: new Date(Date.now() + 10 * DAY).toISOString() }],
    ['Nintendo Switch', { games: [{}] }, { games: [] }],
    ['Kaya (Climbing)', { pyramid: [{}], ascentsWithVideos: [{}] }, { pyramid: [{}], ascentsWithVideos: [] }],
    ['Kaya (Logged-in)', {}, { authError: 'token refresh returned 401' }],
    ['TMDB (TV Shows)', { shows: [{ posterImage: 'p' }, { posterImage: '' }] }, { shows: [{ posterImage: '' }, { posterImage: '' }] }],
  ])('%s passes healthy data and fails broken data', (name, good, bad) => {
    expect(api(name).checkFn(good)).toBeTruthy();
    expect(api(name).checkFn(bad)).toBeFalsy();
  });
});

describe('Goodreads (login expiry)', () => {
  const check = () => api('Goodreads (login expiry)');
  const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

  it('does not alert just because the silent renewal was refused', () => {
    expect(check().checkFn({ renewed: false, error: 'silent sign-in was refused (HTTP 200)', expiresAt: inDays(300) })).toBe(true);
  });

  it('does not alert when the expiry is unknown (the Goodreads check covers a dead cookie)', () => {
    expect(check().checkFn({ renewed: false, error: 'x' })).toBe(true);
  });

  it('alerts within 30 days of expiry, with the date and days left', () => {
    const data = { renewed: false, expiresAt: inDays(12.5) };
    expect(check().checkFn(data)).toBe(false);
    expect(check().failReason(data)).toMatch(/expires on \d{4}-\d{2}-\d{2} \(12 days left\)/);
    expect(check().checkFn({ expiresAt: inDays(31) })).toBe(true);
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

describe('build failures', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'ci-failures-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads one entry per failed step, with its log tail', () => {
    writeFileSync(path.join(dir, 'test'), 'FAIL src/utils/__tests__/x.test.ts\n1 failed\n');
    writeFileSync(path.join(dir, 'build-site'), 'error TS2345\n');
    expect(readBuildFailures(dir)).toEqual([
      { step: 'build-site', logTail: 'error TS2345' },
      { step: 'test', logTail: 'FAIL src/utils/__tests__/x.test.ts\n1 failed' },
    ]);
  });

  it('is empty when no step failed (no directory)', () => {
    expect(readBuildFailures(path.join(dir, 'missing'))).toEqual([]);
  });

  it('leads the DM with the failed step and the end of its log, within limits', () => {
    const results = {
      ...allFailing(),
      buildFailures: [{ step: 'test', logTail: 'x'.repeat(5000) + '\nTests 1 failed | 166 passed' }],
    };
    const payload = buildDiscordPayload(results);
    const [embed] = payload.embeds;
    expect(payload.content).toBe('Website build failed:');
    expect(embed.title).toContain('Website build failed (test)');
    expect(embed.fields[0].name).toBe('🛑 Build step failed: test');
    expect(embed.fields[0].value).toContain('Tests 1 failed | 166 passed');
    expect(embed.fields[0].value.length).toBeLessThanOrEqual(1024);
    const total = embed.title.length + embed.description.length + embed.footer.text.length
      + embed.fields.reduce((n: number, f: any) => n + f.name.length + f.value.length, 0);
    expect(total).toBeLessThanOrEqual(6000);
    expect(buildPlainTextMessage(results)).toMatch(/^🛑 Website build failed at test/);
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

describe('integration registry', () => {
  it('claims every health-check entry exactly once, and names only real entries', () => {
    const claimed = INTEGRATIONS.flatMap(i => i.healthChecks.map(h => h.name));
    expect([...claimed].sort()).toEqual(names(APIs));
    expect(new Set(claimed).size).toBe(claimed.length);
  });
});

describe('selectAPIs (disabled integrations are skipped, not alerted)', () => {
  const allOn = Object.fromEntries(INTEGRATIONS.map(i => [i.id, true]));
  const modules = (toggles = allOn) => ({
    siteConfig: { ...siteConfig, integrations: toggles },
    integrations: require('../../integrations.ts'),
  });

  it('skips every entry when no integration keys are set (a fresh fork)', () => {
    const { active, skipped } = selectAPIs(APIs, { env: {}, modules: modules() });
    expect(active).toEqual([]);
    expect(names(skipped)).toEqual(names(APIs));
  });

  it('checks only the enabled integration', () => {
    const { active } = selectAPIs(APIs, { env: { LETTERBOXD_USERNAME: 'someone' }, modules: modules() });
    expect(names(active)).toEqual(['Letterboxd']);
  });

  it('skips an integration toggled off even when its keys are set', () => {
    const env = { LETTERBOXD_USERNAME: 'someone', STEAM_API_KEY: 'k', STEAM_ID: '1' };
    const { active, skipped } = selectAPIs(APIs, { env, modules: modules({ ...allOn, steam: false }) });
    expect(names(active)).toEqual(['Letterboxd']);
    expect(skipped.map((s: any) => s.name)).toContain('Steam');
  });

  it('checks the Kaya logged-in entry only when KAYA_REFRESH_TOKEN is set', () => {
    expect(names(selectAPIs(APIs, { env: { KAYA_USERNAME: 'climber' }, modules: modules() }).active)).toEqual(['Kaya (Climbing)']);
    expect(names(selectAPIs(APIs, { env: { KAYA_USERNAME: 'climber', KAYA_REFRESH_TOKEN: 't' }, modules: modules() }).active))
      .toEqual(['Kaya (Climbing)', 'Kaya (Logged-in)']);
  });

  it('checks IGDB only alongside a games platform', () => {
    const igdb = { IGDB_CLIENT_ID: 'i', IGDB_CLIENT_SECRET: 's' };
    expect(names(selectAPIs(APIs, { env: igdb, modules: modules() }).active)).toEqual([]);
    expect(names(selectAPIs(APIs, { env: { ...igdb, EXOPHASE_USERNAME: 'u' }, modules: modules() }).active))
      .toEqual(['IGDB (Game Covers)', 'Nintendo Switch']);
  });

  it('checks every toggled-on integration when the keys could not be read', () => {
    const { active, skipped } = selectAPIs(APIs, { env: {}, envKnown: false, modules: modules({ ...allOn, spotify: false }) });
    expect(names(skipped)).toEqual(['Spotify']);
    expect(active).toHaveLength(APIs.length - 1);
  });

  it('checks everything when the registry cannot be loaded', () => {
    expect(selectAPIs(APIs, { env: {}, modules: null }).active).toEqual(APIs);
  });

  it('a skipped integration never reaches the report as a failure', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'health-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { active } = selectAPIs(APIs, { env: { LETTERBOXD_USERNAME: 'someone' }, modules: modules() });
      writeFileSync(path.join(dir, 'letterboxd-data.json'), JSON.stringify({ movies: [{}], timestamp: Date.now() }));
      const results = await checkAPIHealth(dir, active);
      expect(results.failed).toEqual([]);
      expect(names(results.healthy)).toEqual(['Letterboxd']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      vi.restoreAllMocks();
    }
  });
});

describe('monitorName', () => {
  it('comes from site.config.ts', () => {
    expect(monitorName()).toBe(`${siteConfig.shortName} Website Monitor`);
    expect(monitorName(null)).toBe('Website Monitor');
  });
});
