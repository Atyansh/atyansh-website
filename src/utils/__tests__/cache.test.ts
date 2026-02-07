import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fs module before importing cache
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('fs', () => ({
  promises: {
    readFile: (...args: any[]) => mockReadFile(...args),
    writeFile: (...args: any[]) => mockWriteFile(...args),
    mkdir: (...args: any[]) => mockMkdir(...args),
  },
}));

// Mock logger to suppress output
vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { FileCache } from '../cache';

interface TestData {
  timestamp: number;
  value: string;
}

describe('FileCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('get()', () => {
    it('returns null when no cache file exists', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const result = await cache.get();
      expect(result).toBeNull();
    });

    it('returns null when cache is expired', async () => {
      const expiredData: TestData = {
        timestamp: Date.now() - 120000, // 2 minutes ago
        value: 'old-data',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(expiredData));

      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 }); // 1 minute TTL
      const result = await cache.get();
      expect(result).toBeNull();
    });

    it('returns cached data when within TTL', async () => {
      const freshData: TestData = {
        timestamp: Date.now() - 10000, // 10 seconds ago
        value: 'fresh-data',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(freshData));

      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const result = await cache.get();
      expect(result).not.toBeNull();
      expect(result!.value).toBe('fresh-data');
    });

    it('returns from memory cache on second call without reading file again', async () => {
      const freshData: TestData = {
        timestamp: Date.now() - 10000,
        value: 'cached-value',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(freshData));

      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });

      // First call reads from file
      const first = await cache.get();
      expect(first!.value).toBe('cached-value');
      expect(mockReadFile).toHaveBeenCalledTimes(1);

      // Second call should use memory cache, not read file again
      const second = await cache.get();
      expect(second!.value).toBe('cached-value');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('calls deserialize hook when provided', async () => {
      const freshData: TestData = {
        timestamp: Date.now() - 10000,
        value: 'raw-value',
      };
      mockReadFile.mockResolvedValue(JSON.stringify(freshData));

      const deserialize = vi.fn((data: TestData) => ({
        ...data,
        value: data.value.toUpperCase(),
      }));

      const cache = new FileCache<TestData>('test-cache', {
        ttl: 60000,
        deserialize,
      });

      const result = await cache.get();
      expect(deserialize).toHaveBeenCalledTimes(1);
      expect(result!.value).toBe('RAW-VALUE');
    });
  });

  describe('set()', () => {
    it('writes data to file with JSON.stringify', async () => {
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const data: TestData = { timestamp: Date.now(), value: 'new-data' };

      await cache.set(data);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '.cache/test-cache.json',
        JSON.stringify(data, null, 2)
      );
    });

    it('creates cache directory with mkdir recursive', async () => {
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const data: TestData = { timestamp: Date.now(), value: 'data' };

      await cache.set(data);

      expect(mockMkdir).toHaveBeenCalledWith('.cache', { recursive: true });
    });

    it('stores in memory cache after set', async () => {
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const data: TestData = { timestamp: Date.now(), value: 'memory-data' };

      await cache.set(data);

      // Subsequent get should use memory cache, not read file
      const result = await cache.get();
      expect(result!.value).toBe('memory-data');
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe('non-Node environment', () => {
    const originalProcess = globalThis.process;

    beforeEach(() => {
      // Simulate non-Node environment by nullifying process.versions
      globalThis.process = {
        ...originalProcess,
        versions: null as any,
      };
    });

    afterEach(() => {
      globalThis.process = originalProcess;
    });

    it('get() returns null', async () => {
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const result = await cache.get();
      expect(result).toBeNull();
    });

    it('set() is a no-op', async () => {
      const cache = new FileCache<TestData>('test-cache', { ttl: 60000 });
      const data: TestData = { timestamp: Date.now(), value: 'data' };

      await cache.set(data);

      expect(mockMkdir).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
