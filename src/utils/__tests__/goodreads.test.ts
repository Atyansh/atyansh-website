import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseShelfPage } from '../goodreads';

// Three rows cut from a real signed-in /review/list page (2026-10-31)
const fixture = readFileSync(join(__dirname, 'fixtures/goodreads-shelf.html'), 'utf-8');

/** A minimal shelf row with only the cells the parser reads */
function row(cells: Record<string, string>, id = 1): string {
  const td = (name: string) =>
    `<td class="field ${name}"><label>${name}</label><div class="value">${cells[name] ?? ''}</div></td>`;
  return `<tr id="review_${id}" class="bookalike review">${
    ['cover', 'title', 'author', 'isbn', 'isbn13', 'date_pub', 'rating', 'date_read', 'date_added'].map(td).join('')
  }</tr>`;
}

const title = (t: string) => `<a title="${t}" href="/book/show/1-x">${t}</a>`;

describe('parseShelfPage', () => {
  describe('real shelf page', () => {
    const books = parseShelfPage(fixture, 'finished');

    it('parses every row', () => {
      expect(books.map(b => b.title)).toEqual([
        'Evershore (Skyward, #2.3)',
        'Death\'s End (Remembrance of Earth’s Past, #3)',
        'Sapiens: A Brief History of Humankind',
      ]);
    });

    it('builds the record the books page uses', () => {
      expect(books[0]).toMatchObject({
        author: 'Brandon Sanderson',
        coverImage: 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1636833412l/58465495.jpg',
        rating: undefined,
        status: 'finished',
        link: 'https://www.goodreads.com/review/show/1000000001',
        isbn: '9780593566633',
      });
      expect(books[0].publishedDate!.getFullYear()).toBe(2021);
      // Date read is "not set", so it falls back to date added
      expect(books[0].dateRead!.getFullYear()).toBe(2025);
    });

    it('reads the star rating and decodes entities in titles', () => {
      expect(books[1].rating).toBe(5);
      expect(books[1].title).toContain('Death\'s End');
    });

    it('keeps family-name-first authors in the order their URL uses', () => {
      expect(books[1].author).toBe('Liu Cixin');
    });
  });

  it('returns no books for an empty shelf', () => {
    expect(parseShelfPage('<table id="books"><tbody></tbody></table>', 'want-to-read')).toEqual([]);
  });

  it('skips rows without a title link', () => {
    expect(parseShelfPage(row({ author: 'x' }), 'finished')).toEqual([]);
  });

  it('defaults to Unknown Author', () => {
    expect(parseShelfPage(row({ title: title('A') }), 'finished')[0].author).toBe('Unknown Author');
  });

  it('leaves a single-part author name alone', () => {
    const books = parseShelfPage(row({ title: title('A'), author: '<a href="/author/show/1.Homer">Homer</a>' }), 'finished');
    expect(books[0].author).toBe('Homer');
  });

  it('strips combined size suffixes from covers', () => {
    const books = parseShelfPage(row({
      title: title('A'),
      cover: '<a href="/book/show/1"><img src="https://i.gr-assets.com/books/1l/21411388._SX50_SY75_.jpg" /></a>',
    }), 'finished');
    expect(books[0].coverImage).toBe('https://i.gr-assets.com/books/1l/21411388.jpg');
  });

  it('prefers date read over date added', () => {
    const books = parseShelfPage(row({
      title: title('A'),
      date_read: '<div class="date_row"><span class="date_read_value">Mar 03, 2024</span></div>',
      date_added: '<span title="October 11, 2025">Oct 11, 2025</span>',
    }), 'finished');
    expect(books[0].dateRead!.getFullYear()).toBe(2024);
    expect(books[0].dateRead!.getMonth()).toBe(2);
  });

  it('parses a year-only publication date as Jan 1', () => {
    const books = parseShelfPage(row({ title: title('A'), date_pub: ' 2006 ' }), 'finished');
    expect(books[0].publishedDate!.getFullYear()).toBe(2006);
    expect(books[0].publishedDate!.getMonth()).toBe(0);
  });

  it('treats a zero rating as unrated', () => {
    const books = parseShelfPage(row({ title: title('A'), rating: '<div class="stars" data-rating="0.0"></div>' }), 'finished');
    expect(books[0].rating).toBeUndefined();
  });

  it('uses the status it is given', () => {
    expect(parseShelfPage(row({ title: title('A') }), 'reading')[0].status).toBe('reading');
  });
});
