import { describe, it, expect } from 'vitest';
import { parseLetterboxdRSS, addDiaryDetails, reviveMovieDates, type LetterboxdMovie } from '../letterboxd';

const item = (slug: string, fields: Record<string, string>) => `<item>
  <link>https://letterboxd.com/atyansh/film/${slug}/</link>
  <letterboxd:filmTitle>${slug}</letterboxd:filmTitle>
  <letterboxd:filmYear>2025</letterboxd:filmYear>
  ${Object.entries(fields).map(([k, v]) => `<letterboxd:${k}>${v}</letterboxd:${k}>`).join('\n  ')}
</item>`;

const film = (slug: string, extra: Partial<LetterboxdMovie> = {}): LetterboxdMovie => ({
  title: slug,
  posterImage: `${slug}.jpg`,
  link: `https://letterboxd.com/film/${slug}/`,
  ...extra,
});

describe('parseLetterboxdRSS diary details', () => {
  it('reads the rating, watch date and rewatch flag', () => {
    const [movie] = parseLetterboxdRSS(`<rss>${item('anora', { watchedDate: '2025-03-02', rewatch: 'No', memberRating: '4.0' })}</rss>`);
    expect(movie.rating).toBe(4);
    expect(movie.watchedDate).toEqual(new Date(2025, 2, 2));
    expect(movie.rewatch).toBeUndefined();
  });

  it('leaves an unrated entry without a rating', () => {
    const [movie] = parseLetterboxdRSS(`<rss>${item('love-exposure', { watchedDate: '2025-11-01' })}</rss>`);
    expect(movie.rating).toBeUndefined();
  });

  it('keeps the newest entry of a film logged twice and marks it a rewatch', () => {
    const movies = parseLetterboxdRSS(`<rss>
      ${item('inception', { watchedDate: '2026-01-05', rewatch: 'No', memberRating: '5.0' })}
      ${item('inception', { watchedDate: '2020-01-05', rewatch: 'No', memberRating: '4.0' })}
    </rss>`);
    expect(movies).toHaveLength(1);
    expect(movies[0].watchedDate).toEqual(new Date(2026, 0, 5));
    expect(movies[0].rating).toBe(5);
    expect(movies[0].rewatch).toBe(true);
  });
});

describe('addDiaryDetails (full scrape)', () => {
  it('fills watch dates and rewatches from the feed, then from the previous copy', () => {
    const grid = [film('recent', { rating: 3 }), film('older', { rating: 4 }), film('unknown')];
    const rss = [film('recent', { rating: 5, watchedDate: new Date(2026, 9, 1), rewatch: true })];
    const previous = [film('older', { rating: 2, watchedDate: new Date(2024, 0, 1) })];

    const [recent, older, unknown] = addDiaryDetails(grid, rss, previous);

    // The grid's current rating wins over the diary entry's
    expect(recent).toMatchObject({ rating: 3, watchedDate: new Date(2026, 9, 1), rewatch: true });
    // A watch date that scrolled out of the feed is kept from last time,
    // but the rating is today's
    expect(older).toMatchObject({ rating: 4, watchedDate: new Date(2024, 0, 1) });
    expect(unknown.watchedDate).toBeUndefined();
  });

  it('drops a rating removed on Letterboxd rather than restoring the old one', () => {
    const [movie] = addDiaryDetails([film('x')], [], [film('x', { rating: 4 })]);
    expect(movie.rating).toBeUndefined();
  });

  it('uses the feed rating when the grid showed none', () => {
    const [movie] = addDiaryDetails([film('x')], [film('x', { rating: 3.5 })], []);
    expect(movie.rating).toBe(3.5);
  });
});

describe('reviveMovieDates', () => {
  it('turns cached date strings back into Dates and drops invalid ones', () => {
    const revived = reviveMovieDates({
      ...film('x'),
      releaseDate: '2001-01-01T00:00:00.000Z' as unknown as Date,
      watchedDate: 'not a date' as unknown as Date,
    });
    expect(revived.releaseDate).toEqual(new Date('2001-01-01T00:00:00.000Z'));
    expect(revived.watchedDate).toBeUndefined();
  });
});
