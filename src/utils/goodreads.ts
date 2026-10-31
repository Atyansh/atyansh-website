// Goodreads shelf integration
// Goodreads removed shelf RSS feeds (404 for every user since 2026-10-28) and
// shelf pages now require sign-in, so this scrapes the signed-in shelf list
// pages (/review/list/<id>) using the browser session in GOODREADS_COOKIE.
//
// What keeps the session signed in is Amazon's login cookies (at-main,
// sess-at-main, ...), which expire a year after they were issued. Goodreads
// never re-issues them, so scripts/refresh-tokens.cjs re-signs in silently
// before every build and saves the renewed cookie, keeping it a year from
// expiry indefinitely.

import { FileCache } from './cache';
import type { BookStatus } from '../content/config';
import { createLogger } from './logger';
import { fetchWithRetry } from './retry';

const log = createLogger('Goodreads');

const GOODREADS_USER_ID = import.meta.env.GOODREADS_USER_ID;
const GOODREADS_COOKIE = import.meta.env.GOODREADS_COOKIE;

// The cookie isn't tied to a browser, but send the UA it was issued to anyway
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:157.0) Gecko/20100101 Firefox/157.0';
const PER_PAGE = 100;
const MAX_PAGES = 50;

export interface GoodreadsBook {
  title: string;
  author: string;
  coverImage: string;
  rating?: number;
  status: BookStatus;
  dateRead?: Date;
  publishedDate?: Date;
  link?: string;
  isbn?: string;
  description?: string;
}

export interface GoodreadsData {
  books: GoodreadsBook[];
  timestamp: number;
}

const cache = new FileCache<GoodreadsData>('goodreads-data', {
  ttl: 24 * 60 * 60 * 1000,
  deserialize: (data) => ({
    ...data,
    books: data.books.map(book => ({
      ...book,
      dateRead: book.dateRead ? new Date(book.dateRead) : undefined,
      publishedDate: book.publishedDate ? new Date(book.publishedDate) : undefined,
    })),
  }),
});

export class GoodreadsSignedOutError extends Error {
  constructor() {
    super('Goodreads redirected to sign-in: GOODREADS_COOKIE has expired or was signed out');
    this.name = 'GoodreadsSignedOutError';
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Inner HTML of a shelf-table cell, e.g. <td class="field title"> */
function cell(row: string, field: string): string {
  const match = row.match(new RegExp(`<td class="field ${field}"[^>]*>([\\s\\S]*?)</td>`));
  return match ? match[1] : '';
}

/** A cell's visible value: tags, its <label> and "[edit]" links removed */
function cellText(row: string, field: string): string {
  return decodeEntities(
    cell(row, field)
      .replace(/<label>[\s\S]*?<\/label>/, '')
      .replace(/<a[^>]*>\[edit\]<\/a>/g, '')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function parseDate(text: string): Date | undefined {
  if (!text || text === 'not set' || text === 'unknown') return undefined;
  // "Dec 28, 2021", "Sep 2015" and "2006" all parse; anchor bare years to Jan 1
  const d = /^\d{4}$/.test(text) ? new Date(parseInt(text, 10), 0, 1) : new Date(text);
  return isNaN(d.getTime()) ? undefined : d;
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Goodreads lists authors "Last, First" but the site shows the display name.
 * Flipping is wrong for family-name-first names ("Liu, Cixin" is "Liu Cixin"),
 * so prefer whichever order the author URL slug (/author/show/5780686.Liu_Cixin) uses.
 */
function displayAuthor(listed: string, href: string): string {
  const parts = listed.split(',').map(p => p.trim());
  if (parts.length !== 2 || !parts[1]) return listed;

  const flipped = `${parts[1]} ${parts[0]}`;
  const asListed = `${parts[0]} ${parts[1]}`;
  const slug = letters(href.replace(/^.*\/author\/show\/\d+\.?/, ''));
  return slug && slug === letters(asListed) && slug !== letters(flipped) ? asListed : flipped;
}

/**
 * Parse the book rows out of a signed-in shelf list page
 */
export function parseShelfPage(html: string, status: BookStatus): GoodreadsBook[] {
  const rows = html.match(/<tr id="review_\d+"[\s\S]*?<\/tr>/g) || [];
  const books: GoodreadsBook[] = [];

  for (const row of rows) {
    const titleCell = cell(row, 'title');
    const titleMatch = titleCell.match(/<a title="([^"]*)" href="([^"]*)"/);
    if (!titleMatch) continue;

    const authorMatch = cell(row, 'author').match(/<a href="([^"]*)">([^<]*)<\/a>/);
    const author = authorMatch ? displayAuthor(decodeEntities(authorMatch[2]).trim(), authorMatch[1]) : 'Unknown Author';

    // Thumbnails come as ._SX50_., ._SY75_. or ._SX50_SY75_.; dropping the size suffix gives the
    // full-size cover, as the RSS feed's book_large_image_url did
    const coverMatch = cell(row, 'cover').match(/<img [^>]*src="([^"]*)"/);
    const coverImage = coverMatch ? coverMatch[1].replace(/\._(?:S[XY]\d+_)+\./, '.') : '';

    const ratingMatch = cell(row, 'rating').match(/data-rating="([\d.]+)"/);
    const ratingValue = ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : 0;

    // Same as the RSS feed: date read, else date added
    const added = cell(row, 'date_added').match(/<span title="([^"]*)"/);
    const dateRead = parseDate(cellText(row, 'date_read')) ?? parseDate(added ? added[1] : '');

    const isbn = cellText(row, 'isbn') || cellText(row, 'isbn13') || undefined;
    const reviewMatch = row.match(/href="(\/review\/show\/\d+)"/);

    books.push({
      title: decodeEntities(titleMatch[1]),
      author,
      coverImage,
      rating: ratingValue > 0 ? ratingValue : undefined,
      status,
      dateRead,
      publishedDate: parseDate(cellText(row, 'date_pub')),
      link: `https://www.goodreads.com${reviewMatch ? reviewMatch[1] : titleMatch[2]}`,
      isbn,
    });
  }

  return books;
}

/**
 * Fetch every page of a Goodreads shelf. Throws on failure so an
 * unreachable shelf isn't mistaken for an empty one.
 */
async function fetchShelf(userId: string, shelf: string, status: BookStatus): Promise<GoodreadsBook[]> {
  log.info(`Fetching Goodreads ${shelf} shelf...`);
  const books: GoodreadsBook[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://www.goodreads.com/review/list/${userId}?shelf=${shelf}&per_page=${PER_PAGE}&page=${page}`;
    const response = await fetchWithRetry(url, {
      headers: { 'Cookie': GOODREADS_COOKIE, 'User-Agent': USER_AGENT },
      // A signed-out request 302s to /user/sign_in; see it rather than follow it
      redirect: 'manual',
    }, {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt) => {
        log.info(`Goodreads ${shelf} shelf retry ${attempt}: ${error.message}`);
      },
    });

    if (response.status >= 300 && response.status < 400 && /sign_?in/.test(response.headers.get('location') || '')) {
      throw new GoodreadsSignedOutError();
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch Goodreads ${shelf} shelf page ${page}: ${response.status}`);
    }

    const pageBooks = parseShelfPage(await response.text(), status);
    books.push(...pageBooks);
    if (pageBooks.length < PER_PAGE) break;
  }

  log.info(`Fetched ${books.length} books from ${shelf} shelf`);
  return books;
}

/**
 * Get all Goodreads data from the signed-in shelf pages
 */
export async function getGoodreadsData(): Promise<GoodreadsData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!GOODREADS_USER_ID || !GOODREADS_COOKIE) {
    log.info('GOODREADS_USER_ID or GOODREADS_COOKIE not configured, skipping...');
    return cache.fallback('Goodreads');
  }

  log.info('Fetching Goodreads data...');

  try {
    // Fetch all shelves in parallel
    const [readBooks, currentlyReadingBooks, wantToReadBooks] = await Promise.all([
      fetchShelf(GOODREADS_USER_ID, 'read', 'finished'),
      fetchShelf(GOODREADS_USER_ID, 'currently-reading', 'reading'),
      fetchShelf(GOODREADS_USER_ID, 'to-read', 'want-to-read'),
    ]);

    const allBooks = [...readBooks, ...currentlyReadingBooks, ...wantToReadBooks];

    const data: GoodreadsData = {
      books: allBooks,
      timestamp: Date.now(),
    };

    // Save to cache
    await cache.set(data);

    log.info(`Fetched ${allBooks.length} total books from Goodreads`);
    log.info(`  - ${readBooks.length} finished`);
    log.info(`  - ${currentlyReadingBooks.length} currently reading`);
    log.info(`  - ${wantToReadBooks.length} want to read`);

    return data;
  } catch (error) {
    // Don't cache anything: an empty result here would overwrite the last
    // good copy in the build-cache bucket.
    log.error('Error fetching Goodreads data:', error);
    return cache.fallback('Goodreads');
  }
}

/**
 * Get the best cover image URL (attempt to get higher resolution)
 */
export function getBestCoverImage(url: string): string {
  if (!url) return '';

  // Try to get higher resolution version
  return url
    .replace(/_SX\d+_/, '_SX400_')
    .replace(/_SY\d+_/, '_SY600_');
}
