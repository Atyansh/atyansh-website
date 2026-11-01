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

/**
 * Whether a freshly fetched list-shaped result is safe to cache over the
 * previous copy. An empty result, or one that shrank below `minRatio` of the
 * previous copy, is far more likely a partial fetch (a failed page, an API
 * hiccup returning []) than real data loss, and caching it would overwrite
 * the last good copy in the build-cache bucket. Pure.
 */
export function shouldPersist<T>(
  fresh: T,
  previous: T | null,
  count: (data: T) => number,
  minRatio = 0.5
): { persist: boolean; reason?: string } {
  const freshCount = count(fresh);
  if (freshCount === 0) {
    return { persist: false, reason: 'fresh result is empty' };
  }
  let previousCount = 0;
  try {
    previousCount = previous ? count(previous) : 0;
  } catch {
    // Previous copy from an older schema — nothing to compare against
  }
  if (previousCount > 0 && freshCount < previousCount * minRatio) {
    return { persist: false, reason: `fresh result shrank to ${freshCount} from ${previousCount}` };
  }
  return { persist: true };
}

const CACHE_DIR = '.cache';
// Cloud builds restore the previous build's cache here (see cloudbuild.yaml).
// It is only read by getStale() — never treated as fresh.
const FALLBACK_CACHE_DIR = '.cache-fallback';

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

  /**
   * Read cached data ignoring TTL: the live cache first, then the fallback
   * directory restored from the previous cloud build. Lets callers serve
   * last-known-good data when a fetch fails outright. Deliberately does not
   * touch the cache file or memory cache, so the stale timestamp still trips
   * the post-build health check.
   */
  async getStale(): Promise<T | null> {
    if (!this.isNode) {
      return null;
    }

    const { promises: fs } = await import('fs');
    for (const dir of [CACHE_DIR, FALLBACK_CACHE_DIR]) {
      try {
        const cacheData = await fs.readFile(`${dir}/${this.cacheFile}.json`, 'utf-8');
        let cached: T = JSON.parse(cacheData);

        if (this.options.deserialize) {
          cached = this.options.deserialize(cached);
        }

        return cached;
      } catch {
        // Not in this location — try the next one
      }
    }
    return null;
  }

  /**
   * getStale() for a fetch that failed outright: logs which source fell back
   * and how old the data is. Callers return this instead of null so the page
   * renders last-known-good data rather than an empty section.
   */
  async fallback(source: string): Promise<T | null> {
    const stale = await this.getStale();
    if (stale) {
      log.error(`${source}: falling back to stale data from ${new Date(stale.timestamp).toISOString()}`);
    } else {
      log.error(`${source}: no stale data to fall back to`);
    }
    return stale;
  }

  /**
   * set() guarded by shouldPersist(): an empty or sharply shrunken result is
   * served by the caller but not cached, so the last good copy survives and
   * the missing fresh cache file trips the post-build health check.
   * Returns whether the data was cached.
   */
  async setIfPlausible(source: string, data: T, count: (data: T) => number): Promise<boolean> {
    const { persist, reason } = shouldPersist(data, await this.getStale(), count);
    if (!persist) {
      log.error(`${source}: ${reason} — serving it but not caching, so the last good copy survives`);
      return false;
    }
    await this.set(data);
    return true;
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
