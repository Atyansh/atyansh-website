import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  INTEGRATIONS,
  INTEGRATION_PAGES,
  enabledIntegrations,
  enabledPages,
  disabledRoutes,
  envSatisfies,
  missingEnv,
  type Toggles,
} from '../integrations';
import { siteConfig } from '../site.config';

const ROOT = path.join(__dirname, '..', '..');
const allOn = Object.fromEntries(INTEGRATIONS.map(i => [i.id, true])) as Toggles;

/** Every required key set (the first alternative of an any-of) */
const fullEnv = Object.fromEntries(
  INTEGRATIONS.flatMap(i => i.requiredEnv.map(req => [Array.isArray(req) ? req[0] : req, 'set'])),
);

describe('enabledIntegrations', () => {
  it('enables nothing without env keys (a fresh fork)', () => {
    expect([...enabledIntegrations({}, allOn)]).toEqual([]);
    expect(enabledPages({}, allOn)).toEqual([]);
    expect(disabledRoutes({}, allOn)).toEqual(INTEGRATION_PAGES.map(p => p.route));
  });

  it('enables everything with every key set and every toggle on', () => {
    expect([...enabledIntegrations(fullEnv, allOn)].sort()).toEqual(INTEGRATIONS.map(i => i.id).sort());
    expect(enabledPages(fullEnv, allOn)).toEqual(INTEGRATION_PAGES);
  });

  it('needs every required key, ignoring blank values', () => {
    expect(enabledIntegrations({ SPOTIFY_CLIENT_ID: 'a', SPOTIFY_CLIENT_SECRET: 'b' }, allOn).has('spotify')).toBe(false);
    expect(enabledIntegrations({ SPOTIFY_CLIENT_ID: 'a', SPOTIFY_CLIENT_SECRET: 'b', SPOTIFY_REFRESH_TOKEN: ' ' }, allOn).has('spotify')).toBe(false);
    expect(enabledIntegrations({ SPOTIFY_CLIENT_ID: 'a', SPOTIFY_CLIENT_SECRET: 'b', SPOTIFY_REFRESH_TOKEN: 'c' }, allOn).has('spotify')).toBe(true);
  });

  it('accepts either PSN key', () => {
    expect(enabledIntegrations({ PSN_NPSSO: 'n' }, allOn).has('psn')).toBe(true);
    expect(enabledIntegrations({ PSN_REFRESH_TOKEN: 'r' }, allOn).has('psn')).toBe(true);
    expect(missingEnv(INTEGRATIONS.find(i => i.id === 'psn')!.requiredEnv, {})).toEqual(['PSN_NPSSO or PSN_REFRESH_TOKEN']);
  });

  it('turns an integration off with its toggle even when its keys are set', () => {
    expect(enabledIntegrations(fullEnv, { ...allOn, letterboxd: false }).has('letterboxd')).toBe(false);
    expect(enabledPages(fullEnv, { ...allOn, letterboxd: false }).map(p => p.route)).not.toContain('/movies');
  });

  it('enables IGDB only alongside a games platform', () => {
    const igdb = { IGDB_CLIENT_ID: 'i', IGDB_CLIENT_SECRET: 's' };
    expect(enabledIntegrations(igdb, allOn).has('igdb')).toBe(false);
    expect(enabledIntegrations({ ...igdb, STEAM_API_KEY: 'k', STEAM_ID: '1' }, allOn).has('igdb')).toBe(true);
  });

  it('generates /games when any one platform is enabled', () => {
    expect(enabledPages({ EXOPHASE_USERNAME: 'u' }, allOn).map(p => p.route)).toEqual(['/games']);
  });

  it('with only Letterboxd, generates only /movies', () => {
    expect(enabledPages({ LETTERBOXD_USERNAME: 'someone' }, allOn).map(p => p.route)).toEqual(['/movies']);
  });

  it('envSatisfies treats an empty requirement list as met', () => {
    expect(envSatisfies([], {})).toBe(true);
  });
});

describe('registry consistency', () => {
  it('has a source file for every page, outside src/pages (pages are injected only when enabled)', () => {
    for (const page of INTEGRATION_PAGES) {
      expect(existsSync(path.join(ROOT, page.entrypoint)), page.entrypoint).toBe(true);
      const routeFile = page.route.slice(1);
      expect(existsSync(path.join(ROOT, 'src/pages', `${routeFile}.astro`)), `src/pages/${routeFile}.astro`).toBe(false);
    }
  });

  it('pages only reference known integrations', () => {
    const ids = new Set(INTEGRATIONS.map(i => i.id));
    for (const page of INTEGRATION_PAGES) for (const id of page.sources) expect(ids.has(id)).toBe(true);
  });

  it('has a toggle in site.config.ts for every integration', () => {
    expect(Object.keys(siteConfig.integrations).sort()).toEqual(INTEGRATIONS.map(i => i.id).sort());
  });

  it('documents every env key in .env.example', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    const keys = INTEGRATIONS.flatMap(i => [...i.requiredEnv.flat(), ...(i.optionalEnv ?? [])]);
    for (const key of keys) expect(example, key).toMatch(new RegExp(`^${key}=`, 'm'));
  });
});

describe('site.config.ts', () => {
  it('has a canonical URL without a trailing slash', () => {
    expect(siteConfig.url).toMatch(/^https:\/\/[^/]+$/);
  });

  it('uses a valid IANA time zone', () => {
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: siteConfig.timeZone })).not.toThrow();
  });

  it("allows the analytics endpoint in firebase.json's Content-Security-Policy", () => {
    const endpoint = siteConfig.analytics.goatcounter;
    if (!endpoint) return;
    const firebase = JSON.parse(readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const csps: string[] = firebase.hosting.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .filter((h: { key: string }) => h.key === 'Content-Security-Policy')
      .map((h: { value: string }) => h.value);
    expect(csps.length).toBeGreaterThan(0);
    for (const csp of csps) {
      const connectSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('connect-src'));
      expect(connectSrc, 'update connect-src in firebase.json to match siteConfig.analytics').toContain(new URL(endpoint).origin);
    }
  });
});
