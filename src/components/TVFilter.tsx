import MediaFilterGrid, { type MediaFilterGridConfig } from './MediaFilterGrid';
import ErrorBoundary from './ErrorBoundary';

interface ShowData {
  title: string;
  year: number;
  posterImage: string;
  firstAiredAt?: Date;
  rating?: number;
  link: string;
}

interface Show {
  data: ShowData;
}

interface TVFilterProps {
  shows: Show[];
}

const config: MediaFilterGridConfig<Show> = {
  search: {
    placeholder: 'Show title...',
    match: (s, q) => s.data.title.toLowerCase().includes(q),
  },
  filters: [
    {
      id: 'decade',
      label: 'Decade',
      options: (items) => [
        { value: 'all', label: 'All Decades' },
        ...Array.from(new Set(items.map(s => s.data.year ? Math.floor(s.data.year / 10) * 10 : null).filter(Boolean) as number[]))
          .sort((a, b) => b - a)
          .map(d => ({ value: d.toString(), label: `${d}s` })),
      ],
      match: (s, v) => v === 'all' || (!!s.data.year && Math.floor(s.data.year / 10) * 10 === parseInt(v)),
    },
    {
      id: 'rating',
      label: 'Rating',
      options: [
        { value: 'all', label: 'All Ratings' },
        { value: '9', label: '9+ Rating' },
        { value: '8', label: '8+ Rating' },
        { value: '7', label: '7+ Rating' },
        { value: '6', label: '6+ Rating' },
        { value: 'rated', label: 'Any Rating' },
      ],
      match: (s, v) => {
        if (v === 'all') return true;
        if (v === 'rated') return !!s.data.rating && s.data.rating > 0;
        return !!s.data.rating && s.data.rating >= parseInt(v);
      },
    },
  ],
  sortOptions: [
    {
      value: 'year',
      label: 'Release Date',
      compare: (a, b) => {
        const dateA = a.data.firstAiredAt ? new Date(a.data.firstAiredAt).getTime() : (a.data.year * 10000000000000);
        const dateB = b.data.firstAiredAt ? new Date(b.data.firstAiredAt).getTime() : (b.data.year * 10000000000000);
        return dateB - dateA;
      },
    },
    {
      value: 'title',
      label: 'Title (A-Z)',
      compare: (a, b) => a.data.title.localeCompare(b.data.title),
    },
    {
      value: 'rating',
      label: 'Rating (High to Low)',
      compare: (a, b) => (b.data.rating || 0) - (a.data.rating || 0),
    },
  ],
  defaultSort: 'year',
  card: {
    getKey: (s) => `${s.data.title}-${s.data.year}`,
    getTitle: (s) => s.data.title,
    getSubtitle: (s) => s.data.year ? `${s.data.year}` : '',
    getImage: (s) => s.data.posterImage,
    getRating: (s) => s.data.rating ? s.data.rating / 2 : undefined,
  },
  filterColumnClass: 'lg:grid-cols-4',
  itemNounPlural: 'shows',
};

function TVFilterInner({ shows }: TVFilterProps) {
  return <MediaFilterGrid items={shows} config={config} />;
}

export default function TVFilter(props: TVFilterProps) {
  return <ErrorBoundary sectionName="TV Shows"><TVFilterInner {...props} /></ErrorBoundary>;
}
