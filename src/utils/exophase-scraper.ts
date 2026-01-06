// Exophase scraper using Puppeteer
// Used to get Nintendo Switch gaming data since Nintendo doesn't provide an official API

import type { NintendoGame, NintendoStats } from './nintendo';
import { withRetry } from './retry';

// Type for data extracted from Exophase page
interface ExophaseGameData {
  name: string;
  imageUri: string;
  playTime: string;
  lastPlayed?: string;
}

const EXOPHASE_USER = import.meta.env.EXOPHASE_USERNAME;
const CACHE_DIR = '.cache';
const CACHE_FILE = '.cache/nintendo-data.json';
const CACHE_DURATION = 86400000; // 24 hours in milliseconds

interface CachedData {
  games: NintendoGame[];
  stats: NintendoStats;
  timestamp: number;
}

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
  try {
    const fs = await import('fs/promises');
    const cacheExists = await fs.access(CACHE_FILE).then(() => true).catch(() => false);

    if (cacheExists) {
      const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
      const cached: CachedData = JSON.parse(cacheContent);

      const now = Date.now();
      if ((now - cached.timestamp) < CACHE_DURATION) {
        console.log('✓ Using cached Nintendo data');
        return cached.stats;
      }
    }
  } catch (error) {
    console.log('Cache read failed');
  }
  return null;
}

/**
 * Save Nintendo stats to cache
 */
export async function cacheNintendoStats(stats: NintendoStats): Promise<void> {
  try {
    const fs = await import('fs/promises');

    // Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    const cacheData: CachedData = {
      games: stats.recentGames, // Store games array separately for health check
      stats: stats,
      timestamp: Date.now(),
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log('✓ Cached Nintendo data');
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
}

/**
 * Scrape Nintendo Switch data from Exophase profile
 * Includes retry logic for transient failures (network, timeout, browser issues)
 */
export async function scrapeExophaseNintendoStats(): Promise<NintendoStats | null> {
  try {
    return await withRetry(
      async () => {
        console.log('Launching browser to scrape Exophase...');
        const puppeteer = await import('puppeteer-extra');
        const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

        puppeteer.default.use(StealthPlugin());

        const browser = await puppeteer.default.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
          ],
        });

        try {
          const page = await browser.newPage();

          // Set viewport and user agent
          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          // Navigate to Exophase profile
          console.log(`Navigating to https://www.exophase.com/user/${EXOPHASE_USER}/`);
          await page.goto(`https://www.exophase.com/user/${EXOPHASE_USER}/`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          });

          // Wait for Cloudflare challenge to complete (up to 30 seconds)
          console.log('Waiting for Cloudflare challenge...');
          await new Promise(resolve => setTimeout(resolve, 10000));

          // Check if we're still on Cloudflare challenge page
          const title = await page.title();
          console.log('Page title:', title);

          // Take a screenshot for debugging
          try {
            await page.screenshot({ path: '/tmp/exophase-screenshot.png' });
            console.log('Screenshot saved to /tmp/exophase-screenshot.png');
          } catch (e) {
            console.log('Could not take screenshot');
          }

          // Wait for any of these selectors (more flexible)
          console.log('Waiting for content to load...');
          try {
            await page.waitForSelector('body', { timeout: 5000 });
          } catch (e) {
            console.log('Basic body selector failed, continuing anyway...');
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

          await browser.close();

          console.log(`Found ${nintendoData.length} Nintendo Switch games on Exophase`);

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

        } finally {
          await browser.close().catch(() => {});
        }
      },
      {
        maxRetries: 2,
        initialDelayMs: 3000,
        onRetry: (error, attempt) => {
          console.log(`Exophase scrape retry ${attempt}: ${error.message}`);
        },
      }
    );
  } catch (error: any) {
    console.error('Error scraping Exophase:', error.message || error);
    return null;
  }
}
