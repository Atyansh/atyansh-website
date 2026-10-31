import { vi, describe, it, expect, beforeEach } from 'vitest';

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
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

// No retries/backoff: each shelf request resolves to whatever fetch returns
vi.mock('../retry', () => ({
  fetchWithRetry: (url: string) => fetch(url),
}));

const lastGood = {
  timestamp: Date.now() - 4 * 86400000,
  books: [{ title: 'Dune', author: 'Frank Herbert', coverImage: '', status: 'finished', dateRead: '2026-01-02T00:00:00.000Z' }],
};

async function loadGoodreads() {
  vi.resetModules();
  vi.stubEnv('GOODREADS_USER_ID', '123');
  return import('../goodreads');
}

describe('getGoodreadsData when Goodreads fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No fresh .cache file; last build's copy restored into .cache-fallback
    mockReadFile.mockImplementation(async (path: string) => {
      if (path === '.cache-fallback/goodreads-data.json') return JSON.stringify(lastGood);
      throw new Error('ENOENT');
    });
  });

  it('serves the last good books and does not cache the failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Page not found', { status: 404 })));
    const { getGoodreadsData } = await loadGoodreads();

    const data = await getGoodreadsData();

    expect(data!.books).toHaveLength(1);
    expect(data!.books[0].title).toBe('Dune');
    expect(data!.books[0].dateRead).toBeInstanceOf(Date);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('treats one failed shelf as a failure rather than caching a partial library', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('shelf=read')
        ? new Response('Page not found', { status: 404 })
        : new Response('<rss><channel></channel></rss>', { status: 200 })
    ));
    const { getGoodreadsData } = await loadGoodreads();

    const data = await getGoodreadsData();

    expect(data!.books[0].title).toBe('Dune');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
