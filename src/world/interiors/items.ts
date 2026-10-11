// Real site data → collection-browser entries.

import type { ArtItem, WorldData } from '../data';
import type { BrowserItem } from '../ui/Browser';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const movieItems = (d: WorldData): BrowserItem[] =>
  (d.movies ?? []).map((m, i) => ({
    title: m.title, art: m.art, badge: i === 0 ? 'Latest watch' : 'Watched',
    lines: [m.year ? String(m.year) : '', `#${i + 1} of ${d.movies!.length} on the log`],
  }));

export const showItems = (d: WorldData): BrowserItem[] =>
  (d.tv ?? []).map((s) => ({ title: s.title, art: s.art, badge: 'TV', lines: [s.year ? `First aired ${s.year}` : ''] }));

export const albumItems = (d: WorldData): BrowserItem[] =>
  (d.music ?? []).map((a) => ({ title: a.title, art: a.art, badge: 'Saved album', lines: [a.artist ?? '', a.year ? String(a.year) : ''] }));

export const gameItems = (d: WorldData): BrowserItem[] => {
  const max = Math.max(1, ...(d.games ?? []).map((g) => g.hours ?? 0));
  return (d.games ?? []).map((g, i) => ({
    title: g.title, art: g.art, badge: i < 3 ? `#${i + 1} most played` : 'Steam library',
    lines: [plural(g.hours ?? 0, 'hour') + ' played'],
    progress: (g.hours ?? 0) / max, progressLabel: 'relative to the most-played game',
  }));
};

export const bookItems = (d: WorldData): BrowserItem[] =>
  (d.books ?? []).map((b) => ({
    title: b.title, art: b.art, badge: b.status === 'currently-reading' ? 'Reading now' : 'Read',
    lines: [b.author ?? '', b.year ? `Published ${b.year}` : '', b.date ? `Finished ${b.date}` : ''],
    blurb: b.blurb,
  }));

export const animeItems = (d: WorldData): BrowserItem[] =>
  (d.anime ?? []).map((a: ArtItem) => {
    const total = a.episodes ?? 0;
    const seen = a.watched ?? 0;
    return {
      title: a.title, art: a.art, badge: (a.status ?? 'watched').replace(/_/g, ' '),
      lines: [a.year ? String(a.year) : '', total ? `${seen}/${total} episodes` : plural(seen, 'episode')],
      progress: total ? Math.min(1, seen / total) : undefined, progressLabel: total ? `${Math.round((seen / total) * 100)}% watched` : undefined,
    };
  });
