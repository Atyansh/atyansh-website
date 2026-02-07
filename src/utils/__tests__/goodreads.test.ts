import { parseRSSFeed } from '../goodreads';

function wrapInFeed(...items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    ${items.map(item => `<item>${item}</item>`).join('\n    ')}
  </channel>
</rss>`;
}

describe('parseRSSFeed', () => {
  describe('title parsing', () => {
    it('parses a CDATA-wrapped title', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[The Great Gatsby]]></title>
        <author_name>F. Scott Fitzgerald</author_name>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe('The Great Gatsby');
    });

    it('parses a non-CDATA title', () => {
      const xml = wrapInFeed(`
        <title>Simple Title</title>
        <author_name>Author Name</author_name>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books).toHaveLength(1);
      expect(books[0].title).toBe('Simple Title');
    });
  });

  describe('author extraction', () => {
    it('extracts author name', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[The Great Gatsby]]></title>
        <author_name>F. Scott Fitzgerald</author_name>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].author).toBe('F. Scott Fitzgerald');
    });

    it('defaults to Unknown Author when no author provided', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[No Author Book]]></title>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].author).toBe('Unknown Author');
    });
  });

  describe('image priority', () => {
    it('prefers large image over medium and regular', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Image Test]]></title>
        <book_large_image_url><![CDATA[https://img.com/large.jpg]]></book_large_image_url>
        <book_medium_image_url><![CDATA[https://img.com/medium.jpg]]></book_medium_image_url>
        <book_image_url><![CDATA[https://img.com/regular.jpg]]></book_image_url>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].coverImage).toBe('https://img.com/large.jpg');
    });

    it('falls back to medium when large is not provided', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Medium Image Test]]></title>
        <book_medium_image_url><![CDATA[https://img.com/medium.jpg]]></book_medium_image_url>
        <book_image_url><![CDATA[https://img.com/regular.jpg]]></book_image_url>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].coverImage).toBe('https://img.com/medium.jpg');
    });
  });

  describe('rating extraction', () => {
    it('extracts a valid rating', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Rated Book]]></title>
        <user_rating>4</user_rating>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].rating).toBe(4);
    });

    it('treats rating of 0 as undefined', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Unrated Book]]></title>
        <user_rating>0</user_rating>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].rating).toBeUndefined();
    });
  });

  describe('date parsing', () => {
    it('parses user_read_at date from CDATA', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Dated Book]]></title>
        <user_read_at><![CDATA[Mon, 01 Jan 2024 00:00:00 -0800]]></user_read_at>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].dateRead).toBeInstanceOf(Date);
      expect(books[0].dateRead!.getFullYear()).toBe(2024);
    });

    it('constructs published date from year/month/day fields', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Published Book]]></title>
        <book_published>2020</book_published>
        <book_publication_month>6</book_publication_month>
        <book_publication_day>15</book_publication_day>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].publishedDate).toBeInstanceOf(Date);
      expect(books[0].publishedDate!.getFullYear()).toBe(2020);
      expect(books[0].publishedDate!.getMonth()).toBe(5); // 0-indexed
      expect(books[0].publishedDate!.getDate()).toBe(15);
    });
  });

  describe('ISBN extraction', () => {
    it('extracts ISBN', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[ISBN Book]]></title>
        <isbn>9780743273565</isbn>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].isbn).toBe('9780743273565');
    });
  });

  describe('description with HTML stripping', () => {
    it('strips HTML tags from description', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Described Book]]></title>
        <book_description><![CDATA[<p>This is a <b>great</b> book about <i>life</i>.</p>]]></book_description>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].description).toBe('This is a great book about life.');
    });
  });

  describe('missing title', () => {
    it('skips items without a title', () => {
      const xml = wrapInFeed(`
        <author_name>Some Author</author_name>
        <user_rating>5</user_rating>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books).toHaveLength(0);
    });
  });

  describe('status parameter', () => {
    it('passes status through to result', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Status Book]]></title>
      `);

      const readingBooks = parseRSSFeed(xml, 'reading');
      expect(readingBooks[0].status).toBe('reading');

      const finishedBooks = parseRSSFeed(xml, 'finished');
      expect(finishedBooks[0].status).toBe('finished');

      const wantBooks = parseRSSFeed(xml, 'want-to-read');
      expect(wantBooks[0].status).toBe('want-to-read');
    });
  });

  describe('link extraction', () => {
    it('extracts link from CDATA', () => {
      const xml = wrapInFeed(`
        <title><![CDATA[Linked Book]]></title>
        <link><![CDATA[https://www.goodreads.com/book/show/12345]]></link>
      `);
      const books = parseRSSFeed(xml, 'finished');
      expect(books[0].link).toBe('https://www.goodreads.com/book/show/12345');
    });
  });
});
