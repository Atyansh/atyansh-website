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

        // Cloudflare sometimes serves a "Just a moment..." challenge page,
        // especially to datacenter IPs. The stealth plugin passes the JS
        // challenge automatically — give it time to clear before expecting
        // real content, otherwise the selector wait below eats the timeout
        // staring at the interstitial.
        await page.waitForFunction(
          () => !document.title.includes('Just a moment'),
          { timeout: 15000 }
        ).catch(() => {});

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

            // Construct the poster CDN URL directly from id + slug. This is a fast
            // guess that's verified (HEAD) and corrected later: the poster filename
            // can use a different slug than the listing (a year disambiguation
            // suffix may be present or absent, "4" vs "four", etc.), so we don't try
            // to be clever here — wrong guesses 403 and are resolved during recovery.
            let posterUrl = '';
            if (filmId && filmSlug) {
              // Split film id digits into a path (e.g. "778885" -> "7/7/8/8/8/5")
              const idPath = filmId.split('').join('/');
              posterUrl = `https://a.ltrbxd.com/resized/film-poster/${idPath}/${filmId}-${filmSlug}-0-230-0-345-crop.jpg`;
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
      // Long enough for a temporary Cloudflare flag on this IP to cool off —
      // 2s/4s retries were failing back-to-back against the same block.
      initialDelayMs: 10000,
      onRetry: (error, attempt) => {
        log.info(`Scrape retry ${attempt}: ${error.message}`);
      },
    }
  );
}

/**
 * Resolve a film's poster authoritatively from its own page (JSON-LD "image").
 * This is the source of truth used whenever the constructed URL can't be verified.
 * Retries transient failures so a network blip doesn't leave a film without a poster.
 */
async function fetchPosterFromFilmPage(filmLink: string): Promise<string | null> {
  const url = filmLink.startsWith('http') ? filmLink : `https://letterboxd.com${filmLink}`;
  try {
    return await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Film page ${url} returned ${res.status}`);
        const html = await res.text();
        const jsonLdMatch = /"image":"([^"]+)"/.exec(html);
        // No structured-data image means the film genuinely has no poster; don't retry.
        if (!jsonLdMatch?.[1]) return null;
        let posterUrl = jsonLdMatch[1];
        if (!posterUrl.includes('-0-230-0-345-crop')) {
          posterUrl = posterUrl.replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop');
        }
        return posterUrl;
      },
      { maxRetries: 2, initialDelayMs: 1000 }
    );
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

    // Fetch remaining listing pages one at a time with a small gap. Parallel
    // hits from a single datacenter IP are what trip Cloudflare's bot
    // detection (the cause of the intermittent mornings where pages 2+ failed
    // every retry while page 1 was fine). A serial scrape of ~5 pages costs
    // only a few seconds.
    for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      log.info(`Fetching page ${pageNum}...`);
      const pageUrl = `https://letterboxd.com/${LETTERBOXD_USERNAME}/films/page/${pageNum}/`;
      const { films } = await scrapePage(browser, pageUrl);
      allMovies.push(...films);
    }

    // A poster URL is correct only if the CDN actually serves it. The film id pins
    // the film, so any HEAD 200 is guaranteed to be the right poster.
    const headOk = (u: string) =>
      fetch(u, { method: 'HEAD' }).then(res => res.ok).catch(() => false);

    // Toggle a trailing release-year on the slug of a constructed poster URL, e.g.
    // "...667550-the-fall-guy-2024-0-230-..." <-> "...667550-the-fall-guy-0-230-...".
    // The poster filename carries the year for some films and not others, regardless
    // of the listing slug, so we try the opposite form before the authoritative fetch.
    const yearToggledPoster = (posterUrl: string, year?: number): string | null => {
      if (!year) return null;
      const m = /^(.*\/\d+-)(.+?)(-0-230-0-345-crop\.jpg.*)$/.exec(posterUrl);
      if (!m) return null;
      const [, prefix, slug, suffix] = m;
      const yearSuffix = `-${year}`;
      const toggled = slug.endsWith(yearSuffix)
        ? slug.slice(0, -yearSuffix.length)
        : `${slug}${yearSuffix}`;
      return `${prefix}${toggled}${suffix}`;
    };

    // Verify/repair every poster. Each one that ships is either a HEAD-verified CDN
    // URL or the authoritative film-page poster — no unverified guess reaches the
    // page, so there are no silent misses.
    const limit = pLimit(10);
    await Promise.all(allMovies.map((movie, i) => limit(async () => {
      if (!movie.link) return;

      const constructed = movie.posterImage;
      const haveConstructed = !!constructed && constructed.includes('/film-poster/');

      // Fast path: the constructed URL already works.
      if (haveConstructed && await headOk(constructed)) return;

      // Cheap deterministic fix: the same poster with the year added/removed.
      if (haveConstructed) {
        const alt = yearToggledPoster(constructed, movie.year);
        if (alt && await headOk(alt)) {
          allMovies[i].posterImage = alt;
          return;
        }
      }

      // Authoritative fallback: read the poster straight from the film page.
      log.info(`Resolving poster for ${movie.title}...`);
      const fixedPoster = await fetchPosterFromFilmPage(movie.link);
      if (fixedPoster) {
        allMovies[i].posterImage = fixedPoster;
      } else {
        log.error(`Could not resolve poster for ${movie.title}`);
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
    // Serve last-known-good data rather than shipping a blank movies page.
    // The stale timestamp still trips the post-build health check, so the
    // failure is alerted either way.
    const stale = await cache.getStale();
    if (stale) {
      log.error(`Falling back to stale Letterboxd data from ${new Date(stale.timestamp).toISOString()}`);
      return stale;
    }
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
