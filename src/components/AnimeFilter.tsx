import MediaFilterGrid, { type MediaFilterGridConfig } from './MediaFilterGrid';
import ErrorBoundary from './ErrorBoundary';
import type { AnimeStatus } from '../content/config';

interface AnimeData {
  title: string;
  englishTitle?: string;
  imageUrl: string;
  score?: number;
  status: AnimeStatus;
  episodes?: number;
  episodesWatched?: number;
  type?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  malUrl: string;
}

interface Anime {
  data: AnimeData;
}

interface AnimeFilterProps {
  anime: Anime[];
}

const config: MediaFilterGridConfig<Anime> = {
  search: {
    placeholder: 'Title...',
    match: (a, q) =>
      a.data.title.toLowerCase().includes(q) ||
      (a.data.englishTitle?.toLowerCase().includes(q) ?? false),
  },
  filters: [
    {
      id: 'status',
      label: 'Status',
      defaultValue: 'completed',
      options: [
        { value: 'all', label: 'All Status' },
        { value: 'watching', label: 'Watching' },
        { value: 'completed', label: 'Completed' },
        { value: 'on_hold', label: 'On Hold' },
        { value: 'dropped', label: 'Dropped' },
        { value: 'plan_to_watch', label: 'Plan to Watch' },
      ],
      match: (a, v) => v === 'all' || a.data.status === v,
    },
    {
      id: 'type',
      label: 'Type',
      options: (items) => [
        { value: 'all', label: 'All Types' },
        ...Array.from(new Set(items.map(a => a.data.type).filter(Boolean) as string[]))
          .sort()
          .map(t => ({ value: t, label: t })),
      ],
      match: (a, v) => v === 'all' || a.data.type === v,
    },
    {
      id: 'score',
      label: 'Score',
      options: [
        { value: 'all', label: 'All Scores' },
        { value: '10', label: '10' },
        { value: '9', label: '9' },
        { value: '8', label: '8' },
        { value: '7', label: '7' },
        { value: '6', label: '6' },
      ],
      match: (a, v) => {
        if (v === 'all') return true;
        const threshold = parseInt(v);
        if (threshold === 10) return a.data.score === 10;
        return !!a.data.score && a.data.score >= threshold && a.data.score < threshold + 1;
      },
    },
  ],
  sortOptions: [
    {
      value: 'releaseDate',
      label: 'Release Date (Newest First)',
      compare: (a, b) => {
        const dateA = a.data.startDate ? new Date(a.data.startDate).getTime() : (a.data.year || 0) * 365 * 24 * 60 * 60 * 1000;
        const dateB = b.data.startDate ? new Date(b.data.startDate).getTime() : (b.data.year || 0) * 365 * 24 * 60 * 60 * 1000;
        return dateB - dateA;
      },
    },
    {
      value: 'score',
      label: 'Score (High to Low)',
      compare: (a, b) => (b.data.score || 0) - (a.data.score || 0),
    },
    {
      value: 'title',
      label: 'Title (A-Z)',
      compare: (a, b) => a.data.title.localeCompare(b.data.title),
    },
    {
      value: 'type',
      label: 'Type',
      compare: (a, b) => (a.data.type || '').localeCompare(b.data.type || ''),
    },
  ],
  defaultSort: 'releaseDate',
  card: {
    getKey: (a) => `${a.data.title}-${a.data.malUrl}`,
    getTitle: (a) => a.data.title,
    getSubtitle: (a) => a.data.type || '',
    getImage: (a) => a.data.imageUrl,
    getRating: (a) => a.data.score ? a.data.score / 2 : undefined,
  },
  filterColumnClass: 'lg:grid-cols-5',
  itemNounPlural: 'anime',
};

function AnimeFilterInner({ anime }: AnimeFilterProps) {
  return <MediaFilterGrid items={anime} config={config} />;
}

export default function AnimeFilter(props: AnimeFilterProps) {
  return <ErrorBoundary sectionName="Anime"><AnimeFilterInner {...props} /></ErrorBoundary>;
}
