// Letterboxd web scraping integration
// Fetches movie data by scraping Letterboxd profile pages with pagination

const LETTERBOXD_USERNAME = import.meta.env.LETTERBOXD_USERNAME;

// Cache configuration
const CACHE_DIR = '.cache';
const LETTERBOXD_CACHE_FILE = '.cache/letterboxd-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

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

interface CachedLetterboxdData extends LetterboxdData {}

// In-memory cache
let memoryCache: CachedLetterboxdData | null = null;

/**
 * Load Letterboxd cache from disk
 */
async function loadCache(): Promise<CachedLetterboxdData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(LETTERBOXD_CACHE_FILE, 'utf-8');
    const cached: CachedLetterboxdData = JSON.parse(cacheData);

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached Letterboxd data');
      return cached;
    }

    console.log('Letterboxd cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Letterboxd cache to disk
 */
async function saveCache(data: LetterboxdData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(LETTERBOXD_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved Letterboxd data to cache');
  } catch (error) {
    console.error('Failed to save Letterboxd cache:', error);
  }
}

/**
 * Scrape films from a single Letterboxd page using Puppeteer for accurate image URLs
 */
async function scrapePage(url: string): Promise<{films: LetterboxdMovie[], maxPage: number}> {
  try {
    // Use Puppeteer to render the page and extract actual image URLs
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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
      console.log('Some images may not have loaded, continuing...');
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

    await browser.close();

    // Process the extracted data
    const films: LetterboxdMovie[] = filmData.films.map((film: any) => {
      let releaseDate: Date | undefined;
      if (film.year) {
        try {
          releaseDate = new Date(film.year, 0, 1);
        } catch (e) {
          // Invalid date
        }
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
    console.error(`Error scraping ${url}:`, error);
    return { films: [], maxPage: 1 };
  }
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
  const cached = await loadCache();
  if (cached) {
    return cached;
  }

  if (!LETTERBOXD_USERNAME) {
    console.log('Letterboxd username not configured, skipping...');
    return null;
  }

  console.log('Fetching Letterboxd data...');

  try {
    const allMovies: LetterboxdMovie[] = [];

    // Scrape first page to determine total number of pages
    const firstUrl = `https://letterboxd.com/${LETTERBOXD_USERNAME}/films/`;
    console.log(`Fetching page 1...`);
    const { films: firstPageFilms, maxPage } = await scrapePage(firstUrl);
    allMovies.push(...firstPageFilms);

    console.log(`Found ${maxPage} total pages`);

    // Scrape remaining pages
    for (let page = 2; page <= maxPage; page++) {
      console.log(`Fetching page ${page}...`);
      const pageUrl = `https://letterboxd.com/${LETTERBOXD_USERNAME}/films/page/${page}/`;
      const { films } = await scrapePage(pageUrl);
      allMovies.push(...films);

      // Add a small delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Fix poster URLs that might not work (e.g., movies using /sm/upload/ pattern)
    const https = await import('https');
    const url = await import('url');

    for (let i = 0; i < allMovies.length; i++) {
      const movie = allMovies[i];

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
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.end();
        });

        if (!isAccessible && movie.link) {
          console.log(`Fixing poster for ${movie.title}...`);
          const fixedPoster = await fetchPosterFromFilmPage(movie.link);
          if (fixedPoster) {
            allMovies[i].posterImage = fixedPoster;
          }
        }
      }
    }

    const data: LetterboxdData = {
      movies: allMovies,
      timestamp: Date.now(),
    };

    // Save to cache
    await saveCache(data);

    console.log(`✓ Fetched ${allMovies.length} movies from Letterboxd across ${maxPage} pages`);

    return data;
  } catch (error) {
    console.error('Error fetching Letterboxd data:', error);
    return null;
  }
}
