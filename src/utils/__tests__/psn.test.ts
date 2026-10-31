import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockGetUserTitles = vi.fn();

vi.mock('fs', () => ({
  promises: {
    readFile: (...args: any[]) => mockReadFile(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    mkdir: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

vi.mock('psn-api', () => ({
  exchangeNpssoForCode: vi.fn(),
  exchangeCodeForAccessToken: vi.fn(),
  getUserTitles: (...args: any[]) => mockGetUserTitles(...args),
}));

// No retries/backoff
vi.mock('../retry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

const title = (i: number) => ({
  npCommunicationId: `NPWR${i}`,
  trophyTitleName: `Game ${i}`,
  trophyTitlePlatform: 'PS5',
  lastUpdatedDateTime: '2026-10-01T00:00:00Z',
  earnedTrophies: { bronze: 1, silver: 1, gold: 0, platinum: i % 2 },
});

/** A trophy list of `total` titles served in pages like the PSN API */
function servePages(total: number) {
  mockGetUserTitles.mockImplementation(async (_auth: unknown, _account: string, { limit, offset = 0 }: { limit: number; offset?: number }) => {
    const end = Math.min(offset + limit, total);
    return {
      trophyTitles: Array.from({ length: end - offset }, (_, k) => title(offset + k)),
      totalItemCount: total,
      ...(end < total ? { nextOffset: end } : {}),
    };
  });
}

async function loadPSN() {
  vi.resetModules();
  vi.stubEnv('PSN_ACCESS_TOKEN', 'token');
  return import('../psn');
}

describe('getPSNData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
  });

  it('pages through the whole trophy list and totals every title', async () => {
    servePages(450);
    const { getPSNData } = await loadPSN();

    const data = await getPSNData();

    expect(mockGetUserTitles).toHaveBeenCalledTimes(3);
    expect(mockGetUserTitles.mock.calls.map(c => c[2].offset)).toEqual([0, 200, 400]);
    expect(data!.stats.totalGames).toBe(450);
    expect(data!.stats.totalTrophies.bronze).toBe(450);
    expect(data!.stats.totalTrophies.platinum).toBe(225);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('serves the last good list, uncached, when a later page fails', async () => {
    servePages(450);
    mockGetUserTitles.mockImplementationOnce(async () => ({ trophyTitles: Array.from({ length: 200 }, (_, i) => title(i)), totalItemCount: 450, nextOffset: 200 }))
      .mockImplementationOnce(async () => { throw new Error('HTTP 503'); });
    mockReadFile.mockImplementation(async (path: string) => {
      if (path === '.cache-fallback/psn-data.json') {
        return JSON.stringify({ timestamp: 1, games: [title(1)], stats: { totalGames: 440, totalTrophies: {} } });
      }
      throw new Error('ENOENT');
    });
    const { getPSNData } = await loadPSN();

    const data = await getPSNData();

    expect(data!.stats.totalGames).toBe(440);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('treats an { error } response as a failure, not an empty library', async () => {
    mockGetUserTitles.mockResolvedValue({ error: { message: 'Access denied' } });
    const { getPSNData } = await loadPSN();

    expect(await getPSNData()).toBeNull();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
