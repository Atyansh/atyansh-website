// Nintendo Switch play history, straight from Nintendo.
//
// Nintendo has no public API, but the play history the Nintendo Switch
// Online / Nintendo Store apps show is served by an app API that accepts an
// ordinary Nintendo Account access token. NINTENDO_SESSION_TOKEN (from
// scripts/get-nintendo-token.cjs, valid ~2 years) is traded for a 15-minute
// access token on every build, so this needs no browser and no scraping.
// Covers still come from IGDB (unified-games.ts); Nintendo's own square
// icon is only the fallback.

import { createLogger } from './logger';
import { FileCache } from './cache';
import { fetchWithRetry } from './retry';

const log = createLogger('Nintendo');

// The Nintendo Store app's login client (see scripts/get-nintendo-token.cjs)
const CLIENT_ID = '5c38e31cd085304b';
const TOKEN_URL = 'https://accounts.nintendo.com/connect/1.0.0/api/token';
const PLAY_HISTORIES_URL = 'https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories';

export type NintendoDevice = 'switch' | 'switch2';

export interface NintendoGame {
  titleId: string;
  name: string;
  /** Nintendo's square icon (512px), used only when IGDB has no cover */
  imageUrl?: string;
  totalPlayTime: number; // in seconds
  totalPlayedDays?: number;
  firstPlayedAt?: number; // timestamp (ms)
  lastPlayedAt?: number; // timestamp (ms)
  device?: NintendoDevice;
}

/** Minutes played of one game on one day */
export interface NintendoSession {
  date: string; // YYYY-MM-DD
  titleId: string;
  name: string;
  minutes: number;
}

export interface NintendoStats {
  recentGames: NintendoGame[];
  totalGames: number;
  totalHoursPlayed: number;
  totalDaysPlayed?: number;
  firstPlayedAt?: number;
  /** Day-by-day play, newest first. Nintendo only reports the last few play
   *  days, so each build merges them into the previous build's log. */
  sessions?: NintendoSession[];
}

interface CachedData {
  games: NintendoGame[];
  stats: NintendoStats;
  /** When NINTENDO_SESSION_TOKEN expires (ISO), for the health check's warning */
  sessionExpiresAt?: string;
  timestamp: number;
}

const nintendoCache = new FileCache<CachedData>('nintendo-data', { ttl: 24 * 60 * 60 * 1000 });

// --- Parsing (pure) ---------------------------------------------------------

interface RawTitle {
  titleId: string;
  titleName: string;
  platform?: string;
  imageUrl?: string;
  firstPlayedAt?: string;
  lastPlayedAt?: string;
  totalPlayedDays?: number;
  totalPlayedMinutes?: number;
}

interface RawPlayHistories {
  playHistories?: RawTitle[];
  hiddenTitleList?: unknown[];
  recentPlayHistories?: Array<{
    playedDate: string;
    dailyPlayHistories?: Array<{ titleId: string; titleName: string; totalPlayedMinutes?: number }>;
  }>;
}

const SWITCH_2_EDITION = /\s*[–—-]\s*Nintendo Switch 2 Edition$/i;

/**
 * A display name from Nintendo's title name: the "– Nintendo Switch 2
 * Edition" suffix becomes a Switch 2 badge instead, and all-caps names of
 * several words ("SUPER MARIO MAKER 2") are title-cased. Single all-caps
 * words ("GRIS") are kept: those are usually the real styling.
 */
export function displayName(titleName: string): string {
  const name = titleName.replace(SWITCH_2_EDITION, '').trim();
  if (/\s/.test(name) && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    return name.toLowerCase().replace(/(^|[\s:(-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  }
  return name;
}

/** 'BEE' is Nintendo's platform code for Switch 2, 'HAC' for the original Switch */
function deviceOf(title: RawTitle): NintendoDevice {
  return title.platform === 'BEE' || SWITCH_2_EDITION.test(title.titleName) ? 'switch2' : 'switch';
}

const toMs = (iso?: string) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
};

/** Merge freshly reported play days into the previous log (fresh wins). Pure. */
export function mergeSessions(previous: NintendoSession[], fresh: NintendoSession[]): NintendoSession[] {
  const byKey = new Map<string, NintendoSession>();
  for (const s of [...previous, ...fresh]) byKey.set(`${s.date}|${s.titleId}`, s);
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date) || b.minutes - a.minutes);
}

/** Turn the play_histories response into site stats. Pure. */
export function parsePlayHistories(raw: RawPlayHistories, previousSessions: NintendoSession[] = []): NintendoStats {
  const hidden = new Set((raw.hiddenTitleList ?? []).map(t => (typeof t === 'string' ? t : (t as RawTitle)?.titleId)));
  const titles = (raw.playHistories ?? []).filter(t => t.titleId && t.titleName && !hidden.has(t.titleId));

  const games: NintendoGame[] = titles.map(t => ({
    titleId: t.titleId,
    name: displayName(t.titleName),
    imageUrl: t.imageUrl,
    totalPlayTime: (t.totalPlayedMinutes ?? 0) * 60,
    totalPlayedDays: t.totalPlayedDays,
    firstPlayedAt: toMs(t.firstPlayedAt),
    lastPlayedAt: toMs(t.lastPlayedAt),
    device: deviceOf(t),
  }));

  const names = new Map(games.map(g => [g.titleId, g.name]));
  const fresh: NintendoSession[] = (raw.recentPlayHistories ?? []).flatMap(day =>
    (day.dailyPlayHistories ?? [])
      .filter(d => d.titleId && !hidden.has(d.titleId) && (d.totalPlayedMinutes ?? 0) > 0)
      .map(d => ({
        date: day.playedDate.slice(0, 10),
        titleId: d.titleId,
        name: names.get(d.titleId) ?? displayName(d.titleName),
        minutes: d.totalPlayedMinutes!,
      })),
  );

  const recentGames = [...games].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
  const firsts = games.map(g => g.firstPlayedAt).filter((t): t is number => t !== undefined);
  const totalMinutes = games.reduce((sum, g) => sum + g.totalPlayTime / 60, 0);

  return {
    recentGames,
    totalGames: games.length,
    totalHoursPlayed: Math.round(totalMinutes / 60),
    totalDaysPlayed: games.reduce((sum, g) => sum + (g.totalPlayedDays ?? 0), 0),
    firstPlayedAt: firsts.length ? Math.min(...firsts) : undefined,
    sessions: mergeSessions(previousSessions, fresh),
  };
}

/** The session token's expiry, from its JWT payload (not verified, only read). Pure. */
export function sessionTokenExpiry(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

// --- Fetching ---------------------------------------------------------------

async function getAccessToken(sessionToken: string): Promise<string> {
  const res = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      session_token: sessionToken,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token',
    }),
  });
  if (!res.ok) {
    // 400 invalid_grant: the session token expired or was revoked
    throw new Error(`Nintendo sign-in was rejected (HTTP ${res.status}: ${(await res.text()).slice(0, 120)}); run scripts/get-nintendo-token.cjs again`);
  }
  const { access_token: accessToken } = await res.json();
  if (!accessToken) throw new Error('Nintendo returned no access token');
  return accessToken;
}

async function fetchPlayHistories(accessToken: string): Promise<RawPlayHistories> {
  const res = await fetchWithRetry(PLAY_HISTORIES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'gentry-locale': 'en-US' },
  });
  if (!res.ok) throw new Error(`Nintendo play history returned HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/**
 * Nintendo Switch stats: today's cache, else a fresh fetch, else (on any
 * failure) the last good copy so the page keeps its games.
 */
export async function getNintendoStats(): Promise<NintendoStats | null> {
  const cached = await nintendoCache.get();
  if (cached) return cached.stats;

  const sessionToken = import.meta.env.NINTENDO_SESSION_TOKEN;
  try {
    if (!sessionToken) throw new Error('NINTENDO_SESSION_TOKEN is not set');
    const raw = await fetchPlayHistories(await getAccessToken(sessionToken));

    const previous = await nintendoCache.getStale();
    const stats = parsePlayHistories(raw, previous?.stats?.sessions ?? []);
    log.info(`Fetched ${stats.totalGames} Nintendo Switch games, ${stats.totalHoursPlayed}h played`);

    await nintendoCache.setIfPlausible('Nintendo', {
      games: stats.recentGames,
      stats,
      sessionExpiresAt: sessionTokenExpiry(sessionToken),
      timestamp: Date.now(),
    }, d => d.games.length);
    return stats;
  } catch (error) {
    log.error('Error fetching Nintendo play history:', error);
    return (await nintendoCache.fallback('Nintendo'))?.stats ?? null;
  }
}
