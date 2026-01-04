import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from './MediaCard';

interface BookData {
  title: string;
  author: string;
  coverImage: string;
  rating?: number;
  status: 'reading' | 'finished' | 'want-to-read';
  dateRead?: Date;
  publishedDate?: Date;
}

interface Book {
  data: BookData;
}

interface BooksFilterProps {
  books: Book[];
}

export default function BooksFilter({ books }: BooksFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'publishedDate' | 'rating'>('publishedDate');

  const filteredAndSortedBooks = useMemo(() => {
    let filtered = books.filter(book => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        book.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.data.author.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = selectedStatus === 'all' || book.data.status === selectedStatus;

      // Rating filter
      const matchesRating = selectedRating === 'all' ||
        (selectedRating === 'rated' && book.data.rating && book.data.rating > 0) ||
        (selectedRating === '5' && book.data.rating === 5) ||
        (selectedRating === '4' && book.data.rating === 4) ||
        (selectedRating === '3' && book.data.rating === 3) ||
        (selectedRating === '2' && book.data.rating === 2) ||
        (selectedRating === '1' && book.data.rating === 1);

      return matchesSearch && matchesStatus && matchesRating;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.data.title.localeCompare(b.data.title);
        case 'author':
          return a.data.author.localeCompare(b.data.author);
        case 'publishedDate':
          if (a.data.publishedDate && b.data.publishedDate) {
            return b.data.publishedDate.valueOf() - a.data.publishedDate.valueOf();
          }
          if (a.data.publishedDate) return -1;
          if (b.data.publishedDate) return 1;
          return 0;
        case 'rating':
          const ratingA = a.data.rating || 0;
          const ratingB = b.data.rating || 0;
          return ratingB - ratingA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [books, searchQuery, selectedStatus, selectedRating, sortBy]);

  return (
    <div className="w-full">
      {/* Filter Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Status
            </label>
            <select
              id="status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Books</option>
              <option value="reading">Currently Reading</option>
              <option value="finished">Finished</option>
              <option value="want-to-read">Want to Read</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div>
            <label
              htmlFor="rating"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Rating
            </label>
            <select
              id="rating"
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
              <option value="rated">Any Rating</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="sort"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'title' | 'author' | 'publishedDate' | 'rating')}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="publishedDate">Published Date</option>
              <option value="title">Title (A-Z)</option>
              <option value="author">Author (A-Z)</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredAndSortedBooks.length} of {books.length} books
        </div>
      </motion.div>

      {/* Books Grid */}
      <AnimatePresence mode="popLayout">
        <motion.div
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6"
        >
          {filteredAndSortedBooks.map((book, index) => (
            <motion.div
              key={`${book.data.title}-${book.data.author}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                duration: 0.3,
                delay: Math.min(index * 0.05, 0.5),
              }}
            >
              <MediaCard
                title={book.data.title}
                subtitle={book.data.author}
                image={book.data.coverImage}
                rating={book.data.rating}
                delay={0}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* No Results Message */}
      {filteredAndSortedBooks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No books found matching your filters.
          </p>
        </motion.div>
      )}
    </div>
  );
}
