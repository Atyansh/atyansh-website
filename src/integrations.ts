/**
 * The integration registry: the one place that knows, for every data source,
 * which env keys it needs, which page shows it, and which health-check
 * entries watch it. Used by astro.config.mjs (which routes exist, sitemap),
 * the nav and pages, scripts/check-api-health.cjs and scripts/refresh-tokens.cjs.
 *
 * An integration is ENABLED when its toggle in src/site.config.ts is on AND
 * every required env key is non-empty at build time (and, for an enhancer
 * like IGDB, something it enhances is enabled). A page is generated when any
 * of its sources is enabled.
 *
 * Like site.config.ts this must stay loadable by plain Node (type stripping):
 * only erasable type syntax, and imports with explicit .ts extensions.
 */
import { siteConfig, type IntegrationId } from './site.config.ts';

export type { IntegrationId };

/** A key name, or a list of alternatives where any one is enough */
export type EnvRequirement = string | string[];

export interface HealthCheckEntry {
  /** Exactly the `name` of an entry in scripts/check-api-health.cjs */
  name: string;
  /** Extra keys this entry needs on top of the integration's own (else it's skipped) */
  requiredEnv?: EnvRequirement[];
}

export interface Integration {
  id: IntegrationId;
  /** Human name for docs and logs */
  name: string;
  /** All must be set (an inner array: any one of them) */
  requiredEnv: EnvRequirement[];
  /** Used when present, never required */
  optionalEnv?: string[];
  /** Enabled only if at least one of these is enabled too (enhancers) */
  enhances?: IntegrationId[];
  healthChecks: HealthCheckEntry[];
  /** Where the keys come from (README table) */
  setup: string;
}

export type NavGroup = 'media' | 'main';

export interface IntegrationPage {
  route: string;
  /** Page source, relative to the project root (injected by astro.config.mjs) */
  entrypoint: string;
  navLabel: string;
  /** aria-label of the nav links */
  navAriaLabel: string;
  /** 'media' pages sit in the Media dropdown; 'main' ones in the top-level nav */
  navGroup: NavGroup;
  /** Generated when ANY of these is enabled */
  sources: IntegrationId[];
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'goodreads',
    name: 'Goodreads',
    requiredEnv: ['GOODREADS_USER_ID', 'GOODREADS_COOKIE'],
    healthChecks: [{ name: 'Goodreads' }, { name: 'Goodreads (login expiry)' }],
    setup: 'User id from your profile URL; GOODREADS_COOKIE is the Cookie header of a signed-in goodreads.com request',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    requiredEnv: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'],
    healthChecks: [{ name: 'Spotify' }],
    setup: 'App at developer.spotify.com/dashboard, then node scripts/get-spotify-token.cjs',
  },
  {
    id: 'letterboxd',
    name: 'Letterboxd',
    requiredEnv: ['LETTERBOXD_USERNAME'],
    healthChecks: [{ name: 'Letterboxd' }],
    setup: 'Your username (public profile scraping, no API key)',
  },
  {
    id: 'tmdb',
    name: 'TMDB (TV)',
    requiredEnv: ['TMDB_ACCESS_TOKEN', 'TMDB_ACCOUNT_OBJECT_ID', 'TMDB_TV_LIST_ID'],
    optionalEnv: ['TMDB_READ_TOKEN'],
    healthChecks: [{ name: 'TMDB (TV Shows)' }],
    setup: 'TMDB_READ_TOKEN from themoviedb.org/settings/api, then node scripts/setup-tmdb.cjs',
  },
  {
    id: 'myanimelist',
    name: 'MyAnimeList',
    requiredEnv: ['MAL_CLIENT_ID', 'MAL_ACCESS_TOKEN'],
    optionalEnv: ['MAL_CLIENT_SECRET', 'MAL_REFRESH_TOKEN'],
    healthChecks: [{ name: 'MyAnimeList' }],
    setup: 'App at myanimelist.net/apiconfig, then node scripts/get-mal-token.cjs',
  },
  {
    id: 'steam',
    name: 'Steam',
    requiredEnv: ['STEAM_API_KEY', 'STEAM_ID'],
    healthChecks: [{ name: 'Steam' }],
    setup: 'Key at steamcommunity.com/dev/apikey; STEAM_ID is your 64-bit Steam id',
  },
  {
    id: 'psn',
    name: 'PlayStation Network',
    requiredEnv: [['PSN_NPSSO', 'PSN_REFRESH_TOKEN']],
    optionalEnv: ['PSN_REFRESH_TOKEN_EXPIRES_AT'],
    healthChecks: [{ name: 'PlayStation Network' }],
    setup: 'NPSSO from ca.account.sony.com/api/v1/ssocookie (signed in); refresh token is minted by refresh-tokens.cjs',
  },
  {
    id: 'nintendo',
    name: 'Nintendo Switch (Exophase)',
    requiredEnv: ['EXOPHASE_USERNAME'],
    healthChecks: [{ name: 'Nintendo Switch' }],
    setup: 'Your Exophase username (public profile scraping)',
  },
  {
    id: 'igdb',
    name: 'IGDB (game covers)',
    requiredEnv: ['IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'],
    optionalEnv: ['IGDB_ACCESS_TOKEN'],
    enhances: ['steam', 'psn', 'nintendo'],
    healthChecks: [{ name: 'IGDB (Game Covers)' }],
    setup: 'Twitch app at dev.twitch.tv/console (IGDB uses Twitch auth); the access token is minted by refresh-tokens.cjs',
  },
  {
    id: 'kaya',
    name: 'Kaya (climbing)',
    requiredEnv: ['KAYA_USERNAME'],
    optionalEnv: ['KAYA_REFRESH_TOKEN'],
    healthChecks: [
      { name: 'Kaya (Climbing)' },
      { name: 'Kaya (Logged-in)', requiredEnv: ['KAYA_REFRESH_TOKEN'] },
    ],
    setup: 'Your Kaya username; optional KAYA_REFRESH_TOKEN lifts the 200-ascent public cap (see .env.example)',
  },
];

export const INTEGRATION_PAGES: IntegrationPage[] = [
  { route: '/books', entrypoint: './src/integration-pages/books.astro', navLabel: 'Books', navAriaLabel: 'Navigate to books page', navGroup: 'media', sources: ['goodreads'] },
  { route: '/music', entrypoint: './src/integration-pages/music.astro', navLabel: 'Music', navAriaLabel: 'Navigate to music page', navGroup: 'media', sources: ['spotify'] },
  { route: '/movies', entrypoint: './src/integration-pages/movies.astro', navLabel: 'Movies', navAriaLabel: 'Navigate to movies page', navGroup: 'media', sources: ['letterboxd'] },
  { route: '/tv', entrypoint: './src/integration-pages/tv.astro', navLabel: 'TV', navAriaLabel: 'Navigate to TV shows page', navGroup: 'media', sources: ['tmdb'] },
  { route: '/anime', entrypoint: './src/integration-pages/anime.astro', navLabel: 'Anime', navAriaLabel: 'Navigate to anime page', navGroup: 'media', sources: ['myanimelist'] },
  { route: '/games', entrypoint: './src/integration-pages/games.astro', navLabel: 'Games', navAriaLabel: 'Navigate to games page', navGroup: 'main', sources: ['steam', 'psn', 'nintendo'] },
  { route: '/climbing', entrypoint: './src/integration-pages/climbing.astro', navLabel: 'Climbing', navAriaLabel: 'Navigate to climbing page', navGroup: 'main', sources: ['kaya'] },
];

export type Env = Record<string, string | undefined>;
export type Toggles = Record<IntegrationId, boolean>;

const hasValue = (env: Env, key: string) => typeof env[key] === 'string' && env[key]!.trim() !== '';

/** Whether every requirement is met (an inner array: any one key). Pure. */
export function envSatisfies(requirements: EnvRequirement[], env: Env): boolean {
  return requirements.every(req => Array.isArray(req) ? req.some(key => hasValue(env, key)) : hasValue(env, req));
}

/** Required keys that are missing, for logs and docs. Pure. */
export function missingEnv(requirements: EnvRequirement[], env: Env): string[] {
  return requirements
    .filter(req => !envSatisfies([req], env))
    .map(req => Array.isArray(req) ? req.join(' or ') : req);
}

export function getIntegration(id: IntegrationId): Integration {
  const integration = INTEGRATIONS.find(i => i.id === id);
  if (!integration) throw new Error(`Unknown integration: ${id}`);
  return integration;
}

/**
 * Ids of the enabled integrations. Pure given its arguments.
 *
 * `env` defaults to import.meta.env. In an Astro build that object only
 * carries the private keys whose names appear in the module's source, which
 * is why every key is spelled out literally in INTEGRATIONS above. Node
 * callers (astro.config.mjs, scripts) pass their env explicitly.
 */
export function enabledIntegrations(
  env: Env = import.meta.env as Env,
  toggles: Toggles = siteConfig.integrations,
): Set<IntegrationId> {
  const standalone = new Set(
    INTEGRATIONS
      .filter(i => toggles[i.id] && envSatisfies(i.requiredEnv, env))
      .map(i => i.id),
  );
  return new Set(
    [...standalone].filter(id => {
      const { enhances } = getIntegration(id);
      return !enhances || enhances.some(other => standalone.has(other));
    }),
  );
}

export function isIntegrationEnabled(id: IntegrationId, env?: Env, toggles?: Toggles): boolean {
  return enabledIntegrations(env, toggles).has(id);
}

/** The integration pages that will be generated, in nav order. Pure. */
export function enabledPages(env?: Env, toggles?: Toggles): IntegrationPage[] {
  const enabled = enabledIntegrations(env, toggles);
  return INTEGRATION_PAGES.filter(page => page.sources.some(id => enabled.has(id)));
}

/** Routes of integration pages that are NOT generated (sitemap filter). Pure. */
export function disabledRoutes(env?: Env, toggles?: Toggles): string[] {
  const enabled = new Set(enabledPages(env, toggles).map(p => p.route));
  return INTEGRATION_PAGES.map(p => p.route).filter(route => !enabled.has(route));
}

/**
 * Whether the health-check entry `name` should run. Entries no integration
 * claims (none today) always run. Pure.
 */
export function isHealthCheckEnabled(name: string, env: Env, toggles: Toggles = siteConfig.integrations): boolean {
  const owner = INTEGRATIONS.find(i => i.healthChecks.some(h => h.name === name));
  if (!owner) return true;
  if (!enabledIntegrations(env, toggles).has(owner.id)) return false;
  const entry = owner.healthChecks.find(h => h.name === name)!;
  return envSatisfies(entry.requiredEnv ?? [], env);
}
