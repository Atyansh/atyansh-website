import { describe, it, expect } from 'vitest';
import { displayName, mergeSessions, parsePlayHistories, sessionTokenExpiry } from '../nintendo';

// Shaped like app-api.znej.nintendo.com/api/v2.0/users/me/play_histories
const raw = {
  playHistories: [
    {
      titleId: '0100aaaa00000000',
      titleName: 'Hades II – Nintendo Switch 2 Edition',
      platform: 'BEE',
      imageUrl: 'https://atum-img-lp1.cdn.nintendo.net/i/c/aaa_512',
      lastUpdatedAt: '2026-02-14T00:00:00Z',
      firstPlayedAt: '2025-11-27T19:39:12Z',
      lastPlayedAt: '2026-02-13T02:11:21Z',
      totalPlayedDays: 23,
      totalPlayedMinutes: 6173,
    },
    {
      titleId: '0100bbbb00000000',
      titleName: 'SUPER MARIO MAKER 2',
      platform: 'HAC',
      firstPlayedAt: '2019-08-25T22:46:19Z',
      lastPlayedAt: '2019-08-31T19:19:22Z',
      totalPlayedDays: 2,
      totalPlayedMinutes: 153,
    },
    {
      titleId: '0100cccc00000000',
      titleName: 'Hidden Game',
      platform: 'HAC',
      totalPlayedDays: 1,
      totalPlayedMinutes: 10,
    },
  ],
  hiddenTitleList: ['0100cccc00000000'],
  recentPlayHistories: [
    {
      playedDate: '2026-02-12T00:00:00Z',
      dailyPlayHistories: [
        { titleId: '0100aaaa00000000', titleName: 'Hades II – Nintendo Switch 2 Edition', totalPlayedMinutes: 201 },
      ],
    },
  ],
};

describe('displayName', () => {
  it('drops the Switch 2 Edition suffix (shown as a badge instead)', () => {
    expect(displayName('Hades II – Nintendo Switch 2 Edition')).toBe('Hades II');
    expect(displayName('Some Game - Nintendo Switch 2 Edition')).toBe('Some Game');
  });

  it('title-cases shouty multi-word names but keeps stylised single words', () => {
    expect(displayName('SUPER MARIO MAKER 2')).toBe('Super Mario Maker 2');
    expect(displayName('GRIS')).toBe('GRIS');
    expect(displayName('The Legend of Zelda: Tears of the Kingdom')).toBe('The Legend of Zelda: Tears of the Kingdom');
  });
});

describe('parsePlayHistories', () => {
  const stats = parsePlayHistories(raw);

  it('maps each title, skipping hidden ones, newest first', () => {
    expect(stats.recentGames.map(g => g.name)).toEqual(['Hades II', 'Super Mario Maker 2']);
    expect(stats.recentGames[0]).toMatchObject({
      titleId: '0100aaaa00000000',
      totalPlayTime: 6173 * 60,
      totalPlayedDays: 23,
      firstPlayedAt: Date.parse('2025-11-27T19:39:12Z'),
      lastPlayedAt: Date.parse('2026-02-13T02:11:21Z'),
      device: 'switch2',
      imageUrl: 'https://atum-img-lp1.cdn.nintendo.net/i/c/aaa_512',
    });
    expect(stats.recentGames[1].device).toBe('switch');
  });

  it('totals games, hours, days and the first play date', () => {
    expect(stats.totalGames).toBe(2);
    expect(stats.totalHoursPlayed).toBe(Math.round((6173 + 153) / 60));
    expect(stats.totalDaysPlayed).toBe(25);
    expect(stats.firstPlayedAt).toBe(Date.parse('2019-08-25T22:46:19Z'));
  });

  it('turns recent play days into sessions and merges them into the previous log', () => {
    expect(stats.sessions).toEqual([{ date: '2026-02-12', titleId: '0100aaaa00000000', name: 'Hades II', minutes: 201 }]);
    const older = { date: '2026-01-02', titleId: '0100bbbb00000000', name: 'Super Mario Maker 2', minutes: 30 };
    const sameDayEarlier = { date: '2026-02-12', titleId: '0100aaaa00000000', name: 'Hades II', minutes: 90 };
    expect(parsePlayHistories(raw, [older, sameDayEarlier]).sessions).toEqual([
      { date: '2026-02-12', titleId: '0100aaaa00000000', name: 'Hades II', minutes: 201 },
      older,
    ]);
  });

  it('copes with an empty response', () => {
    expect(parsePlayHistories({})).toMatchObject({ recentGames: [], totalGames: 0, totalHoursPlayed: 0, sessions: [] });
  });
});

describe('mergeSessions', () => {
  it('keeps one entry per game per day, newest day first', () => {
    const a = { date: '2026-01-01', titleId: 'a', name: 'A', minutes: 10 };
    const b = { date: '2026-01-03', titleId: 'b', name: 'B', minutes: 5 };
    expect(mergeSessions([a], [b, { ...a, minutes: 20 }])).toEqual([b, { ...a, minutes: 20 }]);
  });
});

describe('sessionTokenExpiry', () => {
  it('reads exp from the token payload', () => {
    const payload = Buffer.from(JSON.stringify({ typ: 'session_token', exp: 1858799766 })).toString('base64url');
    expect(sessionTokenExpiry(`x.${payload}.y`)).toBe(new Date(1858799766 * 1000).toISOString());
  });

  it('returns undefined for anything else', () => {
    expect(sessionTokenExpiry('not-a-jwt')).toBeUndefined();
  });
});
