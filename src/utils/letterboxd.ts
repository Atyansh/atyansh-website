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

        // Extract film data from the listing HTML. Each card carries its slug and
        // film id (in data-postered-identifier), which is everything needed to build
        // the poster URL directly — so there's no need to scroll and wait for
        // Letterboxd's lazy-loaded <img> tags to swap in (that race is what left
        // ~2 of every 12 posters stuck on the empty-poster placeholder).
        const filmData = await page.evaluate(() => {
          const films: any[] = [];
          const reactComponents = document.querySelectorAll('.react-component[data-item-name]');

          reactComponents.forEach((container) => {
            const filmSlug = container.getAttribute('data-item-slug') || '';
            const filmName = container.getAttribute('data-item-name') || '';
            const link = container.getAttribute('data-item-link') || '';

            // Film id used to live in data-film-id; Letterboxd now embeds it in
            // data-postered-identifier as {"uid":"film:836571",...}. Support both.
            let filmId = container.getAttribute('data-film-id') || '';
            if (!filmId) {
              const ident = container.getAttribute('data-postered-identifier') || '';
              const idMatch = /film:(\d+)/.exec(ident);
              if (idMatch) filmId = idMatch[1];
            }

            // Parse title and year (year informs slug disambiguation below)
            const titleYearMatch = /^(.*?)\s*\((\d{4})\)$/.exec(filmName);
            let title = filmName;
            let year: number | undefined;

            if (titleYearMatch) {
              title = titleYearMatch[1].trim();
              year = parseInt(titleYearMatch[2], 10);
            }

            // Construct the poster CDN URL directly from id + slug.
            let posterUrl = '';
            if (filmId && filmSlug) {
              // Some slugs carry a disambiguation year suffix (e.g. "the-fall-guy-2024")
              // that isn't part of the poster path; others have the year as part of the
              // title (e.g. "blade-runner-2049"). Strip only a suffix matching the year.
              let slugForPoster = filmSlug;
              if (year) {
                const yearSuffix = `-${year}`;
                if (filmSlug.endsWith(yearSuffix)) {
                  slugForPoster = filmSlug.slice(0, -yearSuffix.length);
                }
              }

              // Split film id digits into a path (e.g. "778885" -> "7/7/8/8/8/5")
              const idPath = filmId.split('').join('/');
              posterUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${slugForPoster}-0-230-0-345-crop.jpg`;
            }

            // Include all movies (missing/wrong posters are recovered below via the film page)
            if (title) {
              films.push({
                title,
                year,
                link,
                posterImage: posterUrl,
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

          return {
            title: film.title,
            year: film.year,
            releaseDate,
            posterImage: film.posterImage,
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
    const url = filmLink.startsWith('http') ? filmLink : `https://letterboxd.com${filmLink}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();
    const jsonLdMatch = /"image":"([^"]+)"/.exec(html);
    if (jsonLdMatch?.[1]) {
      let posterUrl = jsonLdMatch[1];
      if (!posterUrl.includes('-0-230-0-345-crop')) {
        posterUrl = posterUrl.replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop');
      }
      return posterUrl;
    }
    return null;
  } catch {
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

    // Recover posters that are missing or wrong by reading the film page directly.
    // This catches two cases: films with no usable id/slug (poster never built, or
    // still an empty-poster placeholder), and constructed /film-poster/ URLs that
    // 404 due to slug disambiguation. The HEAD check avoids fetching the film page
    // for the common case where the constructed URL is already valid.
    const limit = pLimit(10);
    await Promise.all(allMovies.map((movie, i) => limit(async () => {
      if (!movie.link) return;

      const missing = !movie.posterImage || movie.posterImage.includes('empty-poster');
      let needsFix = missing;

      if (!missing && movie.posterImage.includes('/film-poster/')) {
        // Quick HEAD request to check the constructed URL is actually accessible
        const isAccessible = await fetch(movie.posterImage, { method: 'HEAD' })
          .then(res => res.ok)
          .catch(() => false);
        needsFix = !isAccessible;
      }

      if (needsFix) {
        log.info(`Fixing poster for ${movie.title}...`);
        const fixedPoster = await fetchPosterFromFilmPage(movie.link);
        if (fixedPoster) {
          allMovies[i].posterImage = fixedPoster;
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
