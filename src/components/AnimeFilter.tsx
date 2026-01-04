import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from './MediaCard';

interface AnimeData {
  title: string;
  englishTitle?: string;
  imageUrl: string;
  score?: number; // User's rating (1-10)
  status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';
  episodes?: number;
  episodesWatched?: number;
  type?: string; // TV, Movie, OVA, etc.
  year?: number;
  startDate?: string; // ISO date string from Astro
  endDate?: string; // ISO date string from Astro
  malUrl: string;
}

interface Anime {
  data: AnimeData;
}

interface AnimeFilterProps {
  anime: Anime[];
}

export default function AnimeFilter({ anime }: AnimeFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('completed');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedScore, setSelectedScore] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'score' | 'type' | 'releaseDate'>('releaseDate');

  // Get unique types from anime
  const types = useMemo(() => {
    const uniqueTypes = new Set<string>();
    anime.forEach(a => {
      if (a.data.type) {
        uniqueTypes.add(a.data.type);
      }
    });
    return Array.from(uniqueTypes).sort();
  }, [anime]);

  const filteredAndSortedAnime = useMemo(() => {
    let filtered = anime.filter(a => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        a.data.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.data.englishTitle && a.data.englishTitle.toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      const matchesStatus = selectedStatus === 'all' || a.data.status === selectedStatus;

      // Type filter
      const matchesType = selectedType === 'all' || a.data.type === selectedType;

      // Score filter
      const matchesScore = selectedScore === 'all' ||
        (selectedScore === '10' && a.data.score === 10) ||
        (selectedScore === '9' && a.data.score && a.data.score >= 9 && a.data.score < 10) ||
        (selectedScore === '8' && a.data.score && a.data.score >= 8 && a.data.score < 9) ||
        (selectedScore === '7' && a.data.score && a.data.score >= 7 && a.data.score < 8) ||
        (selectedScore === '6' && a.data.score && a.data.score >= 6 && a.data.score < 7);

      return matchesSearch && matchesStatus && matchesType && matchesScore;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.data.title.localeCompare(b.data.title);
        case 'score':
          const scoreA = a.data.score || 0;
          const scoreB = b.data.score || 0;
          return scoreB - scoreA;
        case 'type':
          const typeA = a.data.type || '';
          const typeB = b.data.type || '';
          return typeA.localeCompare(typeB);
        case 'releaseDate':
          // Use startDate if available, otherwise fall back to year
          const dateA = a.data.startDate ? new Date(a.data.startDate).getTime() : (a.data.year || 0) * 365 * 24 * 60 * 60 * 1000;
          const dateB = b.data.startDate ? new Date(b.data.startDate).getTime() : (b.data.year || 0) * 365 * 24 * 60 * 60 * 1000;

          // Debug logging for specific anime
          if (a.data.title.includes('Dandadan 2nd') || a.data.title.includes('Kimetsu no Yaiba Movie 1')) {
            console.log(`Comparing ${a.data.title} (${a.data.startDate}, ${dateA}) vs ${b.data.title} (${b.data.startDate}, ${dateB})`);
            console.log(`Result: ${dateB - dateA}`);
          }

          return dateB - dateA; // Most recent first
        default:
          return 0;
      }
    });

    return filtered;
  }, [anime, searchQuery, selectedStatus, selectedType, selectedScore, sortBy]);

  return (
    <div className="w-full">
      {/* Filter Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              placeholder="Title..."
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
              <option value="all">All Status</option>
              <option value="watching">Watching</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="dropped">Dropped</option>
              <option value="plan_to_watch">Plan to Watch</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type
            </label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Types</option>
              {types.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Score Filter */}
          <div>
            <label
              htmlFor="score"
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Score
            </label>
            <select
              id="score"
              value={selectedScore}
              onChange={(e) => setSelectedScore(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Scores</option>
              <option value="10">10</option>
              <option value="9">9</option>
              <option value="8">8</option>
              <option value="7">7</option>
              <option value="6">6</option>
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
              onChange={(e) => setSortBy(e.target.value as 'title' | 'score' | 'type' | 'releaseDate')}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="releaseDate">Release Date (Newest First)</option>
              <option value="score">Score (High to Low)</option>
              <option value="title">Title (A-Z)</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredAndSortedAnime.length} of {anime.length} anime
        </div>
      </motion.div>

      {/* Anime Grid */}
      <AnimatePresence mode="popLayout">
        <motion.div
          layout
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6"
        >
          {filteredAndSortedAnime.map((a, index) => (
            <motion.div
              key={`${a.data.title}-${a.data.malUrl}`}
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
                title={a.data.title}
                subtitle={a.data.type || ''}
                image={a.data.imageUrl}
                rating={a.data.score ? a.data.score / 2 : undefined}
                delay={0}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* No Results Message */}
      {filteredAndSortedAnime.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No anime found matching your filters.
          </p>
        </motion.div>
      )}
    </div>
  );
}
