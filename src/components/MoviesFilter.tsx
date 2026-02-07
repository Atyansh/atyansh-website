import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from './MediaCard';
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

function MoviesFilterInner({ movies }: MoviesFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'releaseDate' | 'title' | 'year' | 'rating'>('releaseDate');

  // Get unique decades from movies
  const decades = useMemo(() => {
    const uniqueDecades = new Set<number>();
    movies.forEach(movie => {
      if (movie.data.year) {
        const decade = Math.floor(movie.data.year / 10) * 10;
        uniqueDecades.add(decade);
      }
    });
    return Array.from(uniqueDecades).sort((a, b) => b - a);
  }, [movies]);

  const filteredAndSortedMovies = useMemo(() => {
    let filtered = movies.filter(movie => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        movie.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (movie.data.director && movie.data.director.toLowerCase().includes(searchQuery.toLowerCase()));

      // Rating filter
      const matchesRating = selectedRating === 'all' ||
        (selectedRating === 'rated' && movie.data.rating && movie.data.rating > 0) ||
        (selectedRating === '5' && movie.data.rating === 5) ||
        (selectedRating === '4' && movie.data.rating && movie.data.rating >= 4 && movie.data.rating < 5) ||
        (selectedRating === '3' && movie.data.rating && movie.data.rating >= 3 && movie.data.rating < 4) ||
        (selectedRating === '2' && movie.data.rating && movie.data.rating >= 2 && movie.data.rating < 3) ||
        (selectedRating === '1' && movie.data.rating && movie.data.rating >= 1 && movie.data.rating < 2);

      // Decade filter
      const matchesDecade = selectedDecade === 'all' ||
        (movie.data.year && Math.floor(movie.data.year / 10) * 10 === parseInt(selectedDecade));

      return matchesSearch && matchesRating && matchesDecade;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.data.title.localeCompare(b.data.title);
        case 'year':
          const yearA = a.data.year || 0;
          const yearB = b.data.year || 0;
          return yearB - yearA;
        case 'releaseDate':
          if (a.data.releaseDate && b.data.releaseDate) {
            return b.data.releaseDate.valueOf() - a.data.releaseDate.valueOf();
          }
          if (a.data.releaseDate) return -1;
          if (b.data.releaseDate) return 1;
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
  }, [movies, searchQuery, selectedRating, selectedDecade, sortBy]);

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
              placeholder="Title or director..."
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

          {/* Decade Filter */}
          <div>
            <label
              htmlFor="decade"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Decade
            </label>
            <select
              id="decade"
              value={selectedDecade}
              onChange={(e) => setSelectedDecade(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Decades</option>
              {decades.map(decade => (
                <option key={decade} value={decade.toString()}>
                  {decade}s
                </option>
              ))}
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
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="2">2+ Stars</option>
              <option value="1">1+ Stars</option>
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
              onChange={(e) => setSortBy(e.target.value as 'releaseDate' | 'title' | 'year' | 'rating')}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="releaseDate">Release Date</option>
              <option value="title">Title (A-Z)</option>
              <option value="year">Release Year</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredAndSortedMovies.length} of {movies.length} films
        </div>
      </motion.div>

      {/* Movies Grid */}
      <AnimatePresence mode="popLayout">
        <motion.div
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6"
        >
          {filteredAndSortedMovies.map((movie, index) => (
            <motion.div
              key={`${movie.data.title}-${movie.data.year}`}
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
                title={movie.data.title}
                subtitle={movie.data.director || (movie.data.year ? `${movie.data.year}` : '')}
                image={movie.data.posterImage}
                rating={movie.data.rating}
                delay={0}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* No Results Message */}
      {filteredAndSortedMovies.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No films found matching your filters.
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default function MoviesFilter(props: MoviesFilterProps) {
  return <ErrorBoundary sectionName="Movies"><MoviesFilterInner {...props} /></ErrorBoundary>;
}
