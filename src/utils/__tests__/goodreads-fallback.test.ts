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
  fetchWithRetry: (url: string, init?: RequestInit) => fetch(url, init),
}));

const lastGood = {
  timestamp: Date.now() - 4 * 86400000,
  books: [{ title: 'Dune', author: 'Frank Herbert', coverImage: '', status: 'finished', dateRead: '2026-01-02T00:00:00.000Z' }],
};

async function loadGoodreads() {
  vi.resetModules();
  vi.stubEnv('GOODREADS_USER_ID', '123');
  vi.stubEnv('GOODREADS_COOKIE', 'at-main=x; sess-at-main=y');
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

  it('serves the last good books when the cookie has expired', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'https://www.goodreads.com/user/sign_in' } })
    ));
    const { getGoodreadsData } = await loadGoodreads();

    const data = await getGoodreadsData();

    expect(data!.books[0].title).toBe('Dune');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('treats one failed shelf as a failure rather than caching a partial library', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('shelf=read')
        ? new Response('Page not found', { status: 404 })
        : new Response('<table id="books"><tbody></tbody></table>', { status: 200 })
    ));
    const { getGoodreadsData } = await loadGoodreads();

    const data = await getGoodreadsData();

    expect(data!.books[0].title).toBe('Dune');
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

describe('getGoodreadsData when Goodreads works', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
  });

  it('sends the cookie, pages through a full shelf, and caches the result', async () => {
    const shelfRow = (i: number) =>
      `<tr id="review_${i}" class="bookalike review"><td class="field title"><label>title</label><div class="value"><a title="Book ${i}" href="/book/show/${i}">Book ${i}</a></div></td></tr>`;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (!url.includes('shelf=read')) return new Response('', { status: 200 });
      const page = Number(new URL(url).searchParams.get('page'));
      // 100 rows on page 1 means there may be more; 3 on page 2 means done
      const count = page === 1 ? 100 : 3;
      return new Response(Array.from({ length: count }, (_, i) => shelfRow(page * 1000 + i)).join(''), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getGoodreadsData } = await loadGoodreads();

    const data = await getGoodreadsData();

    expect(data!.books).toHaveLength(103);
    const readCalls = fetchMock.mock.calls.filter(([url]) => (url as string).includes('shelf=read'));
    expect(readCalls).toHaveLength(2);
    expect((readCalls[0][1] as RequestInit).headers).toMatchObject({ Cookie: 'at-main=x; sess-at-main=y' });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
