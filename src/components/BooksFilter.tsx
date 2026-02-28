import MediaFilterGrid, { type MediaFilterGridConfig } from './MediaFilterGrid';
import ErrorBoundary from './ErrorBoundary';
import type { BookStatus } from '../content/config';

interface BookData {
  title: string;
  author: string;
  coverImage: string;
  rating?: number;
  status: BookStatus;
  dateRead?: Date;
  publishedDate?: Date;
}

interface Book {
  data: BookData;
}

interface BooksFilterProps {
  books: Book[];
}

const config: MediaFilterGridConfig<Book> = {
  search: {
    placeholder: 'Title or author...',
    match: (b, q) =>
      b.data.title.toLowerCase().includes(q) ||
      b.data.author.toLowerCase().includes(q),
  },
  filters: [
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'all', label: 'All Books' },
        { value: 'reading', label: 'Currently Reading' },
        { value: 'finished', label: 'Finished' },
        { value: 'want-to-read', label: 'Want to Read' },
      ],
      match: (b, v) => v === 'all' || b.data.status === v,
    },
    {
      id: 'rating',
      label: 'Rating',
      options: [
        { value: 'all', label: 'All Ratings' },
        { value: '5', label: '5 Stars' },
        { value: '4', label: '4 Stars' },
        { value: '3', label: '3 Stars' },
        { value: '2', label: '2 Stars' },
        { value: '1', label: '1 Star' },
        { value: 'rated', label: 'Any Rating' },
      ],
      match: (b, v) => {
        if (v === 'all') return true;
        if (v === 'rated') return !!b.data.rating && b.data.rating > 0;
        return b.data.rating === parseInt(v);
      },
    },
  ],
  sortOptions: [
    {
      value: 'publishedDate',
      label: 'Published Date',
      compare: (a, b) => {
        if (a.data.publishedDate && b.data.publishedDate)
          return b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf();
        if (a.data.publishedDate) return -1;
        if (b.data.publishedDate) return 1;
        return 0;
      },
    },
    {
      value: 'title',
      label: 'Title (A-Z)',
      compare: (a, b) => a.data.title.localeCompare(b.data.title),
    },
    {
      value: 'author',
      label: 'Author (A-Z)',
      compare: (a, b) => a.data.author.localeCompare(b.data.author),
    },
    {
      value: 'rating',
      label: 'Rating (High to Low)',
      compare: (a, b) => (b.data.rating || 0) - (a.data.rating || 0),
    },
  ],
  defaultSort: 'publishedDate',
  card: {
    getKey: (b) => `${b.data.title}-${b.data.author}`,
    getTitle: (b) => b.data.title,
    getSubtitle: (b) => b.data.author,
    getImage: (b) => b.data.coverImage,
    getRating: (b) => b.data.rating,
  },
  filterColumnClass: 'lg:grid-cols-4',
  itemNounPlural: 'books',
};

function BooksFilterInner({ books }: BooksFilterProps) {
  return <MediaFilterGrid items={books} config={config} />;
}

export default function BooksFilter(props: BooksFilterProps) {
  return <ErrorBoundary sectionName="Books"><BooksFilterInner {...props} /></ErrorBoundary>;
}
