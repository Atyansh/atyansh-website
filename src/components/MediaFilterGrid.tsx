import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from './MediaCard';

interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef<T> {
  id: string;
  label: string;
  type?: 'select' | 'range';
  options: FilterOption[] | ((items: T[]) => FilterOption[]);
  defaultValue?: string;
  match: (item: T, value: string) => boolean;
  // Range-specific props
  min?: number;
  max?: number;
  formatLabel?: (value: number) => string;
}

export interface SortDef<T> {
  value: string;
  label: string;
  compare: (a: T, b: T) => number;
}

export interface MediaFilterGridConfig<T> {
  filters: FilterDef<T>[];
  sortOptions: SortDef<T>[];
  defaultSort: string;
  search: {
    placeholder: string;
    match: (item: T, query: string) => boolean;
  };
  card: {
    getKey: (item: T) => string;
    getTitle: (item: T) => string;
    getSubtitle: (item: T) => string;
    getImage: (item: T) => string;
    getRating?: (item: T) => number | undefined;
  };
  renderItem?: (item: T, index: number) => React.ReactNode;
  gridClassName?: string;
  filterColumnClass: string;
  itemNounPlural: string;
}

interface MediaFilterGridProps<T> {
  items: T[];
  config: MediaFilterGridConfig<T>;
}

export default function MediaFilterGrid<T>({ items, config }: MediaFilterGridProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    config.filters.forEach(f => {
      defaults[f.id] = f.defaultValue ?? 'all';
    });
    return defaults;
  });
  const [sortBy, setSortBy] = useState(config.defaultSort);

  const resolvedFilters = useMemo(() =>
    config.filters.map(f => ({
      ...f,
      resolvedOptions: typeof f.options === 'function' ? f.options(items) : f.options,
    })),
    [config.filters, items]
  );

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let filtered = items.filter(item => {
      if (query && !config.search.match(item, query)) return false;
      return config.filters.every(f => f.match(item, filterValues[f.id] ?? 'all'));
    });

    const sortOption = config.sortOptions.find(s => s.value === sortBy);
    if (sortOption) {
      filtered.sort(sortOption.compare);
    }

    return filtered;
  }, [items, searchQuery, filterValues, sortBy, config]);

  const setFilter = (id: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
  };

  const gridClassName = config.gridClassName ?? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6';

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className={`grid grid-cols-1 md:grid-cols-2 ${config.filterColumnClass} gap-4`}>
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder={config.search.placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Dynamic Filters */}
          {resolvedFilters.map(filter => (
            <div key={filter.id}>
              <label htmlFor={filter.id} className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                {filter.type === 'range' && filter.formatLabel
                  ? `${filter.label}: ${filter.formatLabel(parseInt(filterValues[filter.id]))}`
                  : filter.label}
              </label>
              {filter.type === 'range' ? (
                <input
                  id={filter.id}
                  type="range"
                  min={filter.min ?? 0}
                  max={filter.max ?? 100}
                  value={filterValues[filter.id]}
                  onChange={(e) => setFilter(filter.id, e.target.value)}
                  className="w-full theme-slider"
                />
              ) : (
                <select
                  id={filter.id}
                  value={filterValues[filter.id]}
                  onChange={(e) => setFilter(filter.id, e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border transition-colors"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {filter.resolvedOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {/* Sort */}
          <div>
            <label htmlFor="sort" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border transition-colors"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {config.sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredAndSorted.length} of {items.length} {config.itemNounPlural}
        </div>
      </motion.div>

      <AnimatePresence mode="popLayout">
        <motion.div layout className={gridClassName}>
          {filteredAndSorted.map((item, index) => (
            <motion.div
              key={config.card.getKey(item)}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
            >
              {config.renderItem ? config.renderItem(item, index) : (
                <MediaCard
                  title={config.card.getTitle(item)}
                  subtitle={config.card.getSubtitle(item)}
                  image={config.card.getImage(item)}
                  rating={config.card.getRating?.(item)}
                  delay={0}
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredAndSorted.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No {config.itemNounPlural} found matching your filters.
          </p>
        </motion.div>
      )}
    </div>
  );
}
