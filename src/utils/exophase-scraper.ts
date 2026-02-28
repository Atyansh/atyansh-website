// Exophase scraper using Puppeteer
// Used to get Nintendo Switch gaming data since Nintendo doesn't provide an official API

import type { NintendoGame, NintendoStats } from './nintendo';
import { withRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';
import { launchStealthBrowser } from './browser';

const log = createLogger('Exophase');

// Type for data extracted from Exophase page
interface ExophaseGameData {
  name: string;
  imageUri: string;
  playTime: string;
  lastPlayed?: string;
}

const EXOPHASE_USER = import.meta.env.EXOPHASE_USERNAME;

interface CachedData {
  games: NintendoGame[];
  stats: NintendoStats;
  timestamp: number;
}

const exophaseCache = new FileCache<CachedData>('nintendo-data', { ttl: 24 * 60 * 60 * 1000 });

/**
 * Parse play time from Exophase format (e.g., "123h 45m" or "45m")
 */
function parsePlayTime(timeStr: string): number {
  if (!timeStr) return 0;

  const hourMatch = timeStr.match(/(\d+)h/);
  const minuteMatch = timeStr.match(/(\d+)m/);

  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;

  return (hours * 3600) + (minutes * 60);
}

/**
 * Check if we have valid cached data
 */
export async function getCachedNintendoStats(): Promise<NintendoStats | null> {
  const cached = await exophaseCache.get();
  return cached?.stats ?? null;
}

/**
 * Save Nintendo stats to cache
 */
export async function cacheNintendoStats(stats: NintendoStats): Promise<void> {
  await exophaseCache.set({
    games: stats.recentGames,
    stats,
    timestamp: Date.now(),
  });
}

/**
 * Scrape Nintendo Switch data from Exophase profile
 * Includes retry logic for transient failures (network, timeout, browser issues)
 */
export async function scrapeExophaseNintendoStats(): Promise<NintendoStats | null> {
  try {
    // Launch browser once outside retry — only retry page scraping, not browser creation
    log.info('Launching browser to scrape Exophase...');
    const browser = await launchStealthBrowser([
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ]);

    try {
      return await withRetry(
        async () => {
          const page = await browser.newPage();

          // Set viewport and user agent
          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          // Navigate to Exophase profile
          log.info(`Navigating to https://www.exophase.com/user/${EXOPHASE_USER}/`);
          await page.goto(`https://www.exophase.com/user/${EXOPHASE_USER}/`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });

          // Wait for Cloudflare challenge to clear (if present)
          log.info('Waiting for Cloudflare challenge...');
          await page.waitForFunction(
            () => !document.title.includes('Just a moment'),
            { timeout: 15000 }
          ).catch(() => {
            // Page may never have had a Cloudflare challenge — that's fine
          });

          const title = await page.title();
          log.info(`Page title: ${title}`);

          // Wait for content to load
          log.info('Waiting for content to load...');
          try {
            await page.waitForSelector('body', { timeout: 5000 });
          } catch (e) {
            log.info('Basic body selector failed, continuing anyway...');
          }

          // Extract Nintendo Switch games data from embedded JSON
          const nintendoData = await page.evaluate(() => {
            // Exophase embeds game data in window.playerGames as JSON
            const playerGames = (window as any).playerGames;

            if (!playerGames || typeof playerGames !== 'string') {
              return [];
            }

            try {
              const data = JSON.parse(playerGames);
              const games = data.games || [];

              return games.map((game: any) => ({
                name: game.meta?.title || 'Unknown',
                // Try to use higher quality image: resource_large > resource_standard
                imageUri: game.resource_large || game.resource_standard || game.resource_small,
                playTime: game.playtime || '0m',
                lastPlayed: game.lastplayed_utc ? new Date(game.lastplayed_utc * 1000).toISOString() : undefined,
              }));
            } catch (e) {
              console.error('Failed to parse playerGames JSON:', e);
              return [];
            }
          });

          await page.close();

          log.info(`Found ${nintendoData.length} Nintendo Switch games on Exophase`);

          if (nintendoData.length === 0) {
            throw new Error('No Nintendo Switch games found on Exophase profile');
          }

          // Transform to our format
          const games: NintendoGame[] = (nintendoData as ExophaseGameData[]).map((game, index) => {
            const totalPlayTime = parsePlayTime(game.playTime);

            return {
              titleId: `exophase-${index}`,
              name: game.name,
              imageUri: game.imageUri,
              totalPlayTime,
              lastPlayedAt: game.lastPlayed ? new Date(game.lastPlayed).getTime() : undefined,
            };
          });

          // Calculate stats
          const totalSeconds = games.reduce((sum, game) => sum + game.totalPlayTime, 0);
          const totalHoursPlayed = Math.round(totalSeconds / 3600);

          const recentGames = [...games]
            .filter(g => g.lastPlayedAt)
            .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));

          const stats: NintendoStats = {
            recentGames,
            totalGames: games.length,
            totalHoursPlayed,
          };

          // Don't cache here - caching happens after image enhancement in getNintendoStats()
          return stats;
        },
        {
          maxRetries: 2,
          initialDelayMs: 3000,
          onRetry: (error, attempt) => {
            log.info(`Exophase scrape retry ${attempt}: ${error.message}`);
          },
        }
      );
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (error: any) {
    log.error('Error scraping Exophase:', error.message || error);
    return null;
  }
}
