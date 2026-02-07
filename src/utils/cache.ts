// Generic file cache utility to eliminate caching boilerplate across data files

import { createLogger } from './logger';

const log = createLogger('Cache');

export interface Timestamped {
  timestamp: number;
}

export interface FileCacheOptions<T> {
  ttl: number; // milliseconds
  deserialize?: (data: T) => T; // e.g., reconstruct Date objects from JSON
}

const CACHE_DIR = '.cache';

export class FileCache<T extends Timestamped> {
  private memoryCache: T | null = null;
  private readonly isNode: boolean;

  constructor(
    private readonly cacheFile: string,
    private readonly options: FileCacheOptions<T>
  ) {
    this.isNode =
      typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null;
  }

  async get(): Promise<T | null> {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    if (!this.isNode) {
      return null;
    }

    try {
      const { promises: fs } = await import('fs');
      const cacheData = await fs.readFile(
        `${CACHE_DIR}/${this.cacheFile}.json`,
        'utf-8'
      );
      let cached: T = JSON.parse(cacheData);

      if (this.options.deserialize) {
        cached = this.options.deserialize(cached);
      }

      const age = Date.now() - cached.timestamp;
      if (age < this.options.ttl) {
        this.memoryCache = cached;
        log.info(`Using cached ${this.cacheFile} data`);
        return cached;
      }

      log.info(`${this.cacheFile} cache expired, fetching fresh data...`);
      return null;
    } catch {
      // Cache doesn't exist or is invalid
      return null;
    }
  }

  async set(data: T): Promise<void> {
    if (!this.isNode) {
      return;
    }

    try {
      const { promises: fs } = await import('fs');
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(
        `${CACHE_DIR}/${this.cacheFile}.json`,
        JSON.stringify(data, null, 2)
      );
      this.memoryCache = data;
      log.info(`Saved ${this.cacheFile} data to cache`);
    } catch (error) {
      log.error(`Failed to save ${this.cacheFile} cache:`, error);
    }
  }
}
