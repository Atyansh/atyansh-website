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

import { FileCache, shouldPersist } from '../cache';

interface ListData {
  timestamp: number;
  items: string[];
}

const list = (n: number): ListData => ({ timestamp: Date.now(), items: Array.from({ length: n }, (_, i) => `item-${i}`) });
const count = (d: ListData) => d.items.length;

describe('shouldPersist', () => {
  it('refuses an empty result even with nothing to compare against', () => {
    expect(shouldPersist(list(0), null, count)).toEqual({ persist: false, reason: 'fresh result is empty' });
  });

  it('accepts a first-ever non-empty result', () => {
    expect(shouldPersist(list(3), null, count).persist).toBe(true);
  });

  it('refuses a result that shrank below half of the previous copy', () => {
    const verdict = shouldPersist(list(40), list(100), count);
    expect(verdict.persist).toBe(false);
    expect(verdict.reason).toBe('fresh result shrank to 40 from 100');
  });

  it('accepts normal growth and modest shrinkage', () => {
    expect(shouldPersist(list(120), list(100), count).persist).toBe(true);
    expect(shouldPersist(list(50), list(100), count).persist).toBe(true);
  });

  it('ignores a previous copy whose shape it cannot count', () => {
    const malformed = { timestamp: 0 } as unknown as ListData;
    expect(shouldPersist(list(1), malformed, count).persist).toBe(true);
  });
});

describe('FileCache.setIfPlausible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compares against the previous build copy and skips the write when the list collapsed', async () => {
    mockReadFile.mockImplementation(async (path: string) => {
      if (path === '.cache-fallback/things.json') return JSON.stringify(list(100));
      throw new Error('ENOENT');
    });
    const cache = new FileCache<ListData>('things', { ttl: 1000 });

    expect(await cache.setIfPlausible('Things', list(10), count)).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('writes a plausible result', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const cache = new FileCache<ListData>('things', { ttl: 1000 });

    expect(await cache.setIfPlausible('Things', list(10), count)).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
