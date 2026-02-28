import MediaFilterGrid, { type MediaFilterGridConfig } from './MediaFilterGrid';
import ErrorBoundary from './ErrorBoundary';

interface MovieData {
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

interface Movie {
  data: MovieData;
}

interface MoviesFilterProps {
  movies: Movie[];
}

const config: MediaFilterGridConfig<Movie> = {
  search: {
    placeholder: 'Title or director...',
    match: (m, q) =>
      m.data.title.toLowerCase().includes(q) ||
      (m.data.director?.toLowerCase().includes(q) ?? false),
  },
  filters: [
    {
      id: 'decade',
      label: 'Decade',
      options: (items) => [
        { value: 'all', label: 'All Decades' },
        ...Array.from(new Set(items.map(m => m.data.year ? Math.floor(m.data.year / 10) * 10 : null).filter(Boolean) as number[]))
          .sort((a, b) => b - a)
          .map(d => ({ value: d.toString(), label: `${d}s` })),
      ],
      match: (m, v) => v === 'all' || (!!m.data.year && Math.floor(m.data.year / 10) * 10 === parseInt(v)),
    },
    {
      id: 'rating',
      label: 'Rating',
      options: [
        { value: 'all', label: 'All Ratings' },
        { value: '5', label: '5 Stars' },
        { value: '4', label: '4+ Stars' },
        { value: '3', label: '3+ Stars' },
        { value: '2', label: '2+ Stars' },
        { value: '1', label: '1+ Stars' },
        { value: 'rated', label: 'Any Rating' },
      ],
      match: (m, v) => {
        if (v === 'all') return true;
        if (v === 'rated') return !!m.data.rating && m.data.rating > 0;
        const threshold = parseInt(v);
        if (threshold === 5) return m.data.rating === 5;
        return !!m.data.rating && m.data.rating >= threshold && m.data.rating < threshold + 1;
      },
    },
  ],
  sortOptions: [
    {
      value: 'releaseDate',
      label: 'Release Date',
      compare: (a, b) => {
        if (a.data.releaseDate && b.data.releaseDate)
          return b.data.releaseDate.valueOf() - a.data.releaseDate.valueOf();
        if (a.data.releaseDate) return -1;
        if (b.data.releaseDate) return 1;
        return 0;
      },
    },
    {
      value: 'title',
      label: 'Title (A-Z)',
      compare: (a, b) => a.data.title.localeCompare(b.data.title),
    },
    {
      value: 'year',
      label: 'Release Year',
      compare: (a, b) => (b.data.year || 0) - (a.data.year || 0),
    },
    {
      value: 'rating',
      label: 'Rating (High to Low)',
      compare: (a, b) => (b.data.rating || 0) - (a.data.rating || 0),
    },
  ],
  defaultSort: 'releaseDate',
  card: {
    getKey: (m) => `${m.data.title}-${m.data.year}`,
    getTitle: (m) => m.data.title,
    getSubtitle: (m) => m.data.director || (m.data.year ? `${m.data.year}` : ''),
    getImage: (m) => m.data.posterImage,
    getRating: (m) => m.data.rating,
  },
  filterColumnClass: 'lg:grid-cols-4',
  itemNounPlural: 'films',
};

function MoviesFilterInner({ movies }: MoviesFilterProps) {
  return <MediaFilterGrid items={movies} config={config} />;
}

export default function MoviesFilter(props: MoviesFilterProps) {
  return <ErrorBoundary sectionName="Movies"><MoviesFilterInner {...props} /></ErrorBoundary>;
}
