// Goodreads RSS feed integration
// Fetches book data from Goodreads RSS feeds

const GOODREADS_USER_ID = import.meta.env.GOODREADS_USER_ID;

// Cache configuration
const CACHE_DIR = '.cache';
const GOODREADS_CACHE_FILE = '.cache/goodreads-data.json';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

export interface GoodreadsBook {
  title: string;
  author: string;
  coverImage: string;
  rating?: number;
  status: 'reading' | 'finished' | 'want-to-read';
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

interface CachedGoodreadsData extends GoodreadsData {}

// In-memory cache
let memoryCache: CachedGoodreadsData | null = null;

/**
 * Load Goodreads cache from disk
 */
async function loadCache(): Promise<CachedGoodreadsData | null> {
  if (memoryCache) {
    return memoryCache;
  }

  if (!isNode) {
    return null;
  }

  try {
    const { promises: fs } = await import('fs');
    const cacheData = await fs.readFile(GOODREADS_CACHE_FILE, 'utf-8');
    const cached: CachedGoodreadsData = JSON.parse(cacheData);

    // Convert date strings back to Date objects
    cached.books = cached.books.map(book => ({
      ...book,
      dateRead: book.dateRead ? new Date(book.dateRead) : undefined,
      publishedDate: book.publishedDate ? new Date(book.publishedDate) : undefined,
    }));

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION) {
      memoryCache = cached;
      console.log('✓ Using cached Goodreads data');
      return cached;
    }

    console.log('Goodreads cache expired, fetching fresh data...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is invalid
    return null;
  }
}

/**
 * Save Goodreads cache to disk
 */
async function saveCache(data: GoodreadsData): Promise<void> {
  if (!isNode) {
    return;
  }

  try {
    const { promises: fs } = await import('fs');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(GOODREADS_CACHE_FILE, JSON.stringify(data, null, 2));
    memoryCache = data;
    console.log('✓ Saved Goodreads data to cache');
  } catch (error) {
    console.error('Failed to save Goodreads cache:', error);
  }
}

/**
 * Parse Goodreads RSS feed XML
 */
function parseRSSFeed(xml: string, status: 'reading' | 'finished' | 'want-to-read'): GoodreadsBook[] {
  const books: GoodreadsBook[] = [];

  // Parse XML items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Extract book data
    const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(item) || /<title>(.*?)<\/title>/.exec(item);
    const authorMatch = /<author_name>(.*?)<\/author_name>/.exec(item);
    const linkMatch = /<link><!\[CDATA\[(.*?)\]\]><\/link>/.exec(item) || /<link>(.*?)<\/link>/.exec(item);
    const largeImageMatch = /<book_large_image_url><!\[CDATA\[(.*?)\]\]><\/book_large_image_url>/.exec(item);
    const mediumImageMatch = /<book_medium_image_url><!\[CDATA\[(.*?)\]\]><\/book_medium_image_url>/.exec(item);
    const imageMatch = /<book_image_url><!\[CDATA\[(.*?)\]\]><\/book_image_url>/.exec(item);
    const userRatingMatch = /<user_rating>(\d+)<\/user_rating>/.exec(item);
    const userReadAtMatch = /<user_read_at><!\[CDATA\[(.*?)\]\]><\/user_read_at>/.exec(item) || /<user_read_at>(.*?)<\/user_read_at>/.exec(item);
    const userDateAddedMatch = /<user_date_added><!\[CDATA\[(.*?)\]\]><\/user_date_added>/.exec(item) || /<user_date_added>(.*?)<\/user_date_added>/.exec(item);
    const isbnMatch = /<isbn>(.*?)<\/isbn>/.exec(item);
    const descMatch = /<book_description><!\[CDATA\[(.*?)\]\]><\/book_description>/.exec(item);
    const publishedYearMatch = /<book_published>(\d+)<\/book_published>/.exec(item);
    const publicationYearMatch = /<book_publication_year>(\d+)<\/book_publication_year>/.exec(item);
    const publicationMonthMatch = /<book_publication_month>(\d+)<\/book_publication_month>/.exec(item);
    const publicationDayMatch = /<book_publication_day>(\d+)<\/book_publication_day>/.exec(item);

    if (!titleMatch) continue;

    const title = titleMatch[1];
    const author = authorMatch?.[1] || 'Unknown Author';
    const link = linkMatch?.[1];

    // Use large image if available, fall back to medium, then regular
    let coverImage = largeImageMatch?.[1] || mediumImageMatch?.[1] || imageMatch?.[1] || '';

    // Extract rating
    let rating: number | undefined;
    if (userRatingMatch) {
      const ratingValue = parseInt(userRatingMatch[1], 10);
      if (ratingValue > 0) {
        rating = ratingValue;
      }
    }

    // Extract date read
    let dateRead: Date | undefined;
    const dateStr = userReadAtMatch?.[1] || userDateAddedMatch?.[1];
    if (dateStr) {
      try {
        dateRead = new Date(dateStr);
      } catch (e) {
        // Invalid date, skip
      }
    }

    const isbn = isbnMatch?.[1];
    const description = descMatch?.[1];

    // Extract published date
    let publishedDate: Date | undefined;
    const year = publishedYearMatch?.[1] || publicationYearMatch?.[1];
    if (year) {
      try {
        const month = publicationMonthMatch?.[1] || '1';
        const day = publicationDayMatch?.[1] || '1';
        publishedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } catch (e) {
        // Invalid date, skip
      }
    }

    books.push({
      title,
      author,
      coverImage,
      rating,
      status,
      dateRead,
      publishedDate,
      link,
      isbn,
      description: description?.replace(/<[^>]+>/g, '').substring(0, 500), // Strip HTML and limit length
    });
  }

  return books;
}

/**
 * Fetch books from a specific Goodreads shelf
 */
async function fetchShelf(userId: string, shelf: string, status: 'reading' | 'finished' | 'want-to-read'): Promise<GoodreadsBook[]> {
  try {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`;
    console.log(`Fetching Goodreads ${shelf} shelf...`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch Goodreads ${shelf} shelf: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const books = parseRSSFeed(xml, status);

    console.log(`✓ Fetched ${books.length} books from ${shelf} shelf`);
    return books;
  } catch (error) {
    console.error(`Error fetching Goodreads ${shelf} shelf:`, error);
    return [];
  }
}

/**
 * Get all Goodreads data from RSS feeds
 */
export async function getGoodreadsData(): Promise<GoodreadsData | null> {
  // Check cache first
  const cached = await loadCache();
  if (cached) {
    return cached;
  }

  if (!GOODREADS_USER_ID) {
    console.log('Goodreads user ID not configured, skipping...');
    return null;
  }

  console.log('Fetching Goodreads data...');

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
    await saveCache(data);

    console.log(`✓ Fetched ${allBooks.length} total books from Goodreads`);
    console.log(`  - ${readBooks.length} finished`);
    console.log(`  - ${currentlyReadingBooks.length} currently reading`);
    console.log(`  - ${wantToReadBooks.length} want to read`);

    return data;
  } catch (error) {
    console.error('Error fetching Goodreads data:', error);
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
