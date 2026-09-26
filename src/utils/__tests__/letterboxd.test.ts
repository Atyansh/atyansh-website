import { parseLetterboxdRSS, mergeIncremental, type LetterboxdMovie } from '../letterboxd';

function wrapInFeed(...items: string[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com">
  <channel>
    ${items.map(item => `<item>${item}</item>`).join('\n    ')}
  </channel>
</rss>`;
}

function diaryItem(slug: string, title: string, year: number, filmId = '872871'): string {
  return `
    <title>${title}, ${year} - ★★★★★</title>
    <link>https://letterboxd.com/atyansh/film/${slug}/</link>
    <letterboxd:filmTitle>${title}</letterboxd:filmTitle>
    <letterboxd:filmYear>${year}</letterboxd:filmYear>
    <description><![CDATA[ <p><img src="https://a.ltrbxd.com/resized/film-poster/8/7/2/8/7/1/${filmId}-${slug}-0-600-0-900-crop.jpg?v=ebe6beb4fc"/></p> ]]></description>
  `;
}

const movie = (slug: string, title = slug): LetterboxdMovie => ({
  title,
  posterImage: `https://a.ltrbxd.com/${slug}.jpg`,
  link: `https://letterboxd.com/film/${slug}/`,
});

describe('parseLetterboxdRSS', () => {
  it('extracts title, year, canonical link, and listing-size poster', () => {
    const [film] = parseLetterboxdRSS(wrapInFeed(diaryItem('spider-man-brand-new-day', 'Spider-Man: Brand New Day', 2026)));
    expect(film.title).toBe('Spider-Man: Brand New Day');
    expect(film.year).toBe(2026);
    expect(film.releaseDate?.getFullYear()).toBe(2026);
    expect(film.link).toBe('https://letterboxd.com/film/spider-man-brand-new-day/');
    expect(film.posterImage).toBe(
      'https://a.ltrbxd.com/resized/film-poster/8/7/2/8/7/1/872871-spider-man-brand-new-day-0-230-0-345-crop.jpg?v=ebe6beb4fc'
    );
  });

  it('decodes XML entities in titles', () => {
    const [film] = parseLetterboxdRSS(wrapInFeed(diaryItem('a-bugs-life', 'A Bug&#039;s Life &amp; More', 1998)));
    expect(film.title).toBe("A Bug's Life & More");
  });

  it('skips non-film items like lists', () => {
    const list = `
      <title>My favourite films</title>
      <link>https://letterboxd.com/atyansh/list/favourites/</link>
    `;
    expect(parseLetterboxdRSS(wrapInFeed(list))).toEqual([]);
  });

  it('keeps one entry per film when it was rewatched', () => {
    const films = parseLetterboxdRSS(wrapInFeed(
      diaryItem('inception', 'Inception', 2010),
      diaryItem('inception', 'Inception', 2010),
    ));
    expect(films).toHaveLength(1);
  });
});

describe('mergeIncremental', () => {
  it('keeps every previous film and adds new ones', () => {
    const merged = mergeIncremental([movie('new-release')], [movie('old-classic')], [movie('a'), movie('b')]);
    expect(merged.map(m => m.link)).toEqual([
      'https://letterboxd.com/film/new-release/',
      'https://letterboxd.com/film/old-classic/',
      'https://letterboxd.com/film/a/',
      'https://letterboxd.com/film/b/',
    ]);
  });

  it('dedupes by slug, preferring fresh entries over previous ones', () => {
    const fresh = { ...movie('inception'), posterImage: 'fresh.jpg' };
    const stale = { ...movie('inception'), posterImage: 'stale.jpg' };
    const merged = mergeIncremental([fresh], [], [stale]);
    expect(merged).toHaveLength(1);
    expect(merged[0].posterImage).toBe('fresh.jpg');
  });

  it('matches member-scoped and plain film links as the same film', () => {
    const scoped = { ...movie('troy'), link: 'https://letterboxd.com/atyansh/film/troy/' };
    expect(mergeIncremental([movie('troy')], [], [scoped])).toHaveLength(1);
  });
});
