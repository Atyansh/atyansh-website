import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from './MediaCard';

interface ShowData {
  title: string;
  year: number;
  posterImage: string;
  firstAiredAt?: Date;
  rating?: number;
  plays: number;
  lastWatchedAt: Date;
  link: string;
}

interface Show {
  data: ShowData;
}

interface TVFilterProps {
  shows: Show[];
}

export default function TVFilter({ shows }: TVFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  const [selectedDecade, setSelectedDecade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'year' | 'rating'>('year');

  // Get unique decades from shows
  const decades = useMemo(() => {
    const uniqueDecades = new Set<number>();
    shows.forEach(show => {
      if (show.data.year) {
        const decade = Math.floor(show.data.year / 10) * 10;
        uniqueDecades.add(decade);
      }
    });
    return Array.from(uniqueDecades).sort((a, b) => b - a);
  }, [shows]);

  const filteredAndSortedShows = useMemo(() => {
    let filtered = shows.filter(show => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        show.data.title.toLowerCase().includes(searchQuery.toLowerCase());

      // Rating filter (Trakt uses 1-10 scale)
      const matchesRating = selectedRating === 'all' ||
        (selectedRating === 'rated' && show.data.rating && show.data.rating > 0) ||
        (selectedRating === '9' && show.data.rating && show.data.rating >= 9) ||
        (selectedRating === '8' && show.data.rating && show.data.rating >= 8) ||
        (selectedRating === '7' && show.data.rating && show.data.rating >= 7) ||
        (selectedRating === '6' && show.data.rating && show.data.rating >= 6);

      // Decade filter
      const matchesDecade = selectedDecade === 'all' ||
        (show.data.year && Math.floor(show.data.year / 10) * 10 === parseInt(selectedDecade));

      return matchesSearch && matchesRating && matchesDecade;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.data.title.localeCompare(b.data.title);
        case 'year':
          // Use firstAiredAt for granular sorting, fall back to year
          const dateA = a.data.firstAiredAt ? new Date(a.data.firstAiredAt).getTime() : (a.data.year * 10000000000000);
          const dateB = b.data.firstAiredAt ? new Date(b.data.firstAiredAt).getTime() : (b.data.year * 10000000000000);
          return dateB - dateA;
        case 'rating':
          const ratingA = a.data.rating || 0;
          const ratingB = b.data.rating || 0;
          return ratingB - ratingA;
        default:
          return 0;
      }
    });

    return filtered;
  }, [shows, searchQuery, selectedRating, selectedDecade, sortBy]);

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
              placeholder="Show title..."
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
              <option value="9">9+ Rating</option>
              <option value="8">8+ Rating</option>
              <option value="7">7+ Rating</option>
              <option value="6">6+ Rating</option>
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
              onChange={(e) => setSortBy(e.target.value as 'title' | 'year' | 'rating')}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="year">Release Date</option>
              <option value="title">Title (A-Z)</option>
              <option value="rating">Rating (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredAndSortedShows.length} of {shows.length} shows
        </div>
      </motion.div>

      {/* Shows Grid */}
      <AnimatePresence mode="popLayout">
        <motion.div
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6"
        >
          {filteredAndSortedShows.map((show, index) => (
            <motion.div
              key={`${show.data.title}-${show.data.year}`}
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
                title={show.data.title}
                subtitle={show.data.year ? `${show.data.year}` : ''}
                image={show.data.posterImage}
                rating={show.data.rating ? show.data.rating / 2 : undefined} // Convert 10-scale to 5-scale for display
                delay={0}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* No Results Message */}
      {filteredAndSortedShows.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No shows found matching your filters.
          </p>
        </motion.div>
      )}
    </div>
  );
}
