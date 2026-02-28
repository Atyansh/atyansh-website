// Goodreads RSS feed integration
// Fetches book data from Goodreads RSS feeds

import { XMLParser } from 'fast-xml-parser';
import { FileCache } from './cache';
import type { BookStatus } from '../content/config';
import { createLogger } from './logger';
import { fetchWithRetry } from './retry';

const log = createLogger('Goodreads');

const GOODREADS_USER_ID = import.meta.env.GOODREADS_USER_ID;

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

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === 'item',
  processEntities: false,
});

/**
 * Parse Goodreads RSS feed XML
 */
export function parseRSSFeed(xml: string, status: BookStatus): GoodreadsBook[] {
  const parsed = xmlParser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items || !Array.isArray(items)) return [];

  const books: GoodreadsBook[] = [];

  for (const item of items) {
    const title = item.title;
    if (!title) continue;

    const author = item.author_name || 'Unknown Author';
    const link = item.link;

    // Use large image if available, fall back to medium, then regular
    const coverImage = item.book_large_image_url || item.book_medium_image_url || item.book_image_url || '';

    // Extract rating
    let rating: number | undefined;
    const ratingValue = typeof item.user_rating === 'number' ? item.user_rating : parseInt(item.user_rating, 10);
    if (ratingValue > 0) {
      rating = ratingValue;
    }

    // Extract date read
    let dateRead: Date | undefined;
    const dateStr = item.user_read_at || item.user_date_added;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) dateRead = d;
    }

    const isbn = item.isbn ? String(item.isbn) : undefined;
    const description = item.book_description ? String(item.book_description) : undefined;

    // Extract published date
    let publishedDate: Date | undefined;
    const year = item.book_published || item.book_publication_year;
    if (year) {
      const month = item.book_publication_month || 1;
      const day = item.book_publication_day || 1;
      const d = new Date(parseInt(String(year)), parseInt(String(month)) - 1, parseInt(String(day)));
      if (!isNaN(d.getTime())) publishedDate = d;
    }

    books.push({
      title: String(title),
      author: String(author),
      coverImage: String(coverImage),
      rating,
      status,
      dateRead,
      publishedDate,
      link: link ? String(link) : undefined,
      isbn,
      description: description?.replace(/<[^>]+>/g, '').substring(0, 500),
    });
  }

  return books;
}

/**
 * Fetch books from a specific Goodreads shelf
 * Includes retry logic for transient failures
 */
async function fetchShelf(userId: string, shelf: string, status: BookStatus): Promise<GoodreadsBook[]> {
  try {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`;
    log.info(`Fetching Goodreads ${shelf} shelf...`);

    const response = await fetchWithRetry(url, undefined, {
      maxRetries: 2,
      initialDelayMs: 1000,
      onRetry: (error, attempt) => {
        log.info(`Goodreads ${shelf} shelf retry ${attempt}: ${error.message}`);
      },
    });

    if (!response.ok) {
      log.error(`Failed to fetch Goodreads ${shelf} shelf: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const books = parseRSSFeed(xml, status);

    log.info(`Fetched ${books.length} books from ${shelf} shelf`);
    return books;
  } catch (error) {
    log.error(`Error fetching Goodreads ${shelf} shelf:`, error);
    return [];
  }
}

/**
 * Get all Goodreads data from RSS feeds
 */
export async function getGoodreadsData(): Promise<GoodreadsData | null> {
  // Check cache first
  const cached = await cache.get();
  if (cached) {
    return cached;
  }

  if (!GOODREADS_USER_ID) {
    log.info('Goodreads user ID not configured, skipping...');
    return null;
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
    log.error('Error fetching Goodreads data:', error);
    return null;
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
