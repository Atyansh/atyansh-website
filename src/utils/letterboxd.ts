// Letterboxd web scraping integration
// Fetches movie data by scraping Letterboxd profile pages with pagination

import { withRetry } from './retry';
import { FileCache } from './cache';
import { createLogger } from './logger';
import { pLimit } from './concurrency';
import { launchStealthBrowser } from './browser';

const LETTERBOXD_USERNAME = import.meta.env.LETTERBOXD_USERNAME;

const log = createLogger('Letterboxd');
const cache = new FileCache<LetterboxdData>('letterboxd-data', { ttl: 24 * 60 * 60 * 1000 });

export interface LetterboxdMovie {
  title: string;
  year?: number;
  releaseDate?: Date;
  director?: string;
  posterImage: string;
  rating?: number;
  watchedDate?: Date;
  reviewText?: string;
  link?: string;
  rewatch?: boolean;
}

export interface LetterboxdData {
  movies: LetterboxdMovie[];
  timestamp: number;
}

/**
 * Scrape films from a single Letterboxd page using Puppeteer for accurate image URLs
 * Includes retry logic for transient failures
 * Accepts a shared browser instance and creates a new page (tab) per call.
 */
async function scrapePage(browser: Awaited<ReturnType<Awaited<typeof import('puppeteer-extra')>['default']['launch']>>, url: string): Promise<{films: LetterboxdMovie[], maxPage: number}> {
  return withRetry(
    async () => {
      let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

      try {
        page = await browser.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.poster-list', { timeout: 10000 });

        // Scroll down to trigger lazy loading of all images
        await page.evaluate(async () => {
          await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        });

        // Wait for images to actually load (not just placeholders)
        await page.waitForFunction(
          () => {
            const imgs = document.querySelectorAll('.react-component[data-item-name] img');
            const loadedCount = Array.from(imgs).filter(img => {
              const src = img.getAttribute('src') || '';
              return src && !src.includes('empty-poster') && src.includes('ltrbxd.com');
            }).length;
            const totalCount = imgs.length;
            // Wait until at least 90% of images have loaded (some might genuinely not have posters)
            return loadedCount >= totalCount * 0.9;
          },
          { timeout: 15000 }
        ).catch(() => {
          // If timeout, continue anyway - some movies might not have posters
          log.info('Some images may not have loaded, continuing...');
        });

        // Extract film data from rendered page
        const filmData = await page.evaluate(() => {
          const films: any[] = [];
          const reactComponents = document.querySelectorAll('.react-component[data-item-name]');

          reactComponents.forEach((container) => {
            const filmSlug = container.getAttribute('data-item-slug');
            const filmName = container.getAttribute('data-item-name') || '';
            const link = container.getAttribute('data-item-link') || '';
            const filmId = container.getAttribute('data-film-id') || '';
            const img = container.querySelector('img');
            let posterUrl = img?.getAttribute('src') || '';

            // Parse title and year first (needed for slug disambiguation logic)
            const titleYearMatch = /^(.*?)\s*\((\d{4})\)$/.exec(filmName);
            let title = filmName;
            let year: number | undefined;

            if (titleYearMatch) {
              title = titleYearMatch[1].trim();
              year = parseInt(titleYearMatch[2], 10);
            }

            // If lazy loading gave us a placeholder, try to construct the CDN URL from film ID
            if (!posterUrl || posterUrl.includes('empty-poster')) {
              if (filmId && filmSlug) {
                // Determine the correct slug to use for poster URL
                // Some slugs have year suffixes for disambiguation (e.g., "the-fall-guy-2024")
                // Others have years as part of the title (e.g., "blade-runner-2049" for a 2017 film)
                let slugForPoster = filmSlug;
                if (year) {
                  const yearSuffix = `-${year}`;
                  if (filmSlug.endsWith(yearSuffix)) {
                    // Year in slug matches release year, likely a disambiguation suffix - remove it
                    slugForPoster = filmSlug.slice(0, -yearSuffix.length);
                  }
                  // Otherwise keep full slug (year might be part of the title)
                }

                // Split film ID digits into path (e.g., "778885" -> "7/7/8/8/8/5")
                const idPath = filmId.split('').join('/');
                // Construct CDN URL
                posterUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${slugForPoster}-0-230-0-345-crop.jpg`;
              }
            }

            // Include all movies
            if (title) {
              films.push({
                title,
                year,
                link,
                posterImage: posterUrl || '',
              });
            }
          });

          // Find max page from pagination
          let maxPage = 1;
          document.querySelectorAll('.pagination a').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const match = /\/page\/(\d+)\//.exec(href);
            if (match) {
              const pageNum = parseInt(match[1], 10);
              if (pageNum > maxPage) maxPage = pageNum;
            }
          });

          return { films, maxPage };
        });

        // Close the tab, not the browser
        await page.close();
        page = null;

        // Process the extracted data
        const films: LetterboxdMovie[] = filmData.films.map((film: any) => {
          let releaseDate: Date | undefined;
          if (film.year) {
            const d = new Date(film.year, 0, 1);
            if (!isNaN(d.getTime())) releaseDate = d;
          }

          // Upgrade poster image to higher resolution (230x345 instead of 70x105)
          const posterImage = film.posterImage
            .replace('-0-70-0-105-crop', '-0-230-0-345-crop')
            .replace('-0-140-0-210-crop', '-0-230-0-345-crop');

          return {
            title: film.title,
            year: film.year,
            releaseDate,
            posterImage,
            link: film.link.startsWith('http') ? film.link : `https://letterboxd.com${film.link}`,
          };
        });

        return { films, maxPage: filmData.maxPage };
      } catch (error) {
        // Debug: Log page state on any failure
        if (page) {
          try {
            const pageTitle = await page.title();
            const pageUrl = page.url();
            const html = await page.content();
            log.error(`Scrape failed for ${url}`);
            log.debug(`Page title: "${pageTitle}"`);
            log.debug(`Current URL: ${pageUrl}`);
            log.debug(`HTML preview (first 1000 chars):`);
            log.debug(html.substring(0, 1000));
          } catch (debugError) {
            log.error(`Could not capture page state: ${debugError}`);
          }
        }
        throw error;
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }
    },
    {
      maxRetries: 2,
      initialDelayMs: 2000,
      onRetry: (error, attempt) => {
        log.info(`Scrape retry ${attempt}: ${error.message}`);
      },
    }
  );
}

/**
 * Fetch poster URL from individual film page (for films that use /sm/upload/ pattern)
 */
async function fetchPosterFromFilmPage(filmLink: string): Promise<string | null> {
  try {
    const https = await import('https');
    const url = filmLink.startsWith('http') ? filmLink : `https://letterboxd.com${filmLink}`;

    return new Promise((resolve) => {
      https.get(url, (res) => {
        let html = '';
        res.on('data', (chunk) => { html += chunk; });
        res.on('end', () => {
          // Extract poster URL from JSON-LD structured data
          const jsonLdMatch = /"image":"([^"]+)"/.exec(html);
          if (jsonLdMatch && jsonLdMatch[1]) {
            // Ensure it's a 230x345 poster
            let posterUrl = jsonLdMatch[1];
            if (!posterUrl.includes('-0-230-0-345-crop')) {
              posterUrl = posterUrl.replace(/- 0-\d+-0-\d+-crop/, '-0-230-0-345-crop');
            }
            resolve(posterUrl);
          } else {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  } catch (error) {
    return null;
  }
}

/**
 * Get all Letterboxd data by scraping all paginated pages
 */
export async function getLetterboxdData(): Promise<LetterboxdData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!LETTERBOXD_USERNAME) {
    log.info('Letterboxd username not configured, skipping...');
    return null;
  }

  log.info('Fetching Letterboxd data...');

  // Launch browser once and share across all page scrapes
  const browser = await launchStealthBrowser([
    '--disable-blink-features=AutomationControlled',
  ]);

  try {
    const allMovies: LetterboxdMovie[] = [];

    // Scrape first page to determine total number of pages
    const firstUrl = `https://letterboxd.com/${LETTERBOXD_USERNAME}/films/`;
    log.info('Fetching page 1...');
    const { films: firstPageFilms, maxPage } = await scrapePage(browser, firstUrl);
    allMovies.push(...firstPageFilms);

    log.info(`Found ${maxPage} total pages`);

    // Scrape remaining pages concurrently (limit to 2 to avoid Cloudflare detection)
    if (maxPage > 1) {
      const pageLimit = pLimit(2);
      const pageResults = await Promise.all(
        Array.from({ length: maxPage - 1 }, (_, i) => i + 2).map(page =>
          pageLimit(async () => {
            log.info(`Fetching page ${page}...`);
            const pageUrl = `https://letterboxd.com/${LETTERBOXD_USERNAME}/films/page/${page}/`;
            const { films } = await scrapePage(browser, pageUrl);
            // Small delay as safety margin against rapid parallel requests
            await new Promise(resolve => setTimeout(resolve, 200));
            return films;
          })
        )
      );
      for (const films of pageResults) {
        allMovies.push(...films);
      }
    }

    // Fix poster URLs that might not work (e.g., movies using /sm/upload/ pattern)
    const https = await import('https');
    const url = await import('url');

    const limit = pLimit(10);
    await Promise.all(allMovies.map((movie, i) => limit(async () => {
      // Check if poster URL looks like it might be inaccessible (constructed /film-poster/ URL)
      if (movie.posterImage.includes('/film-poster/')) {
        // Quick HEAD request to check if URL is accessible
        const isAccessible = await new Promise<boolean>((resolve) => {
          const parsedUrl = new url.URL(movie.posterImage);
          const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'HEAD'
          };

          const req = https.request(options, (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 400);
          });
          req.on('error', () => resolve(false));
          req.end();
        });

        if (!isAccessible && movie.link) {
          log.info(`Fixing poster for ${movie.title}...`);
          const fixedPoster = await fetchPosterFromFilmPage(movie.link);
          if (fixedPoster) {
            allMovies[i].posterImage = fixedPoster;
          }
        }
      }
    })));

    const data: LetterboxdData = {
      movies: allMovies,
      timestamp: Date.now(),
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched ${allMovies.length} movies from Letterboxd across ${maxPage} pages`);

    return data;
  } catch (error) {
    log.error('Error fetching Letterboxd data:', error);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
