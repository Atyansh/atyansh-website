import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import MediaCard, { type MediaCardDetail } from './MediaCard';
import MediaViewer, { type ViewerItem } from './MediaViewer';

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
    /** 0–5 scale; fractional values show half stars */
    getRating?: (item: T) => number | undefined;
    /** Accessible rating text, e.g. "9 out of 10" (defaults to "x out of 5 stars") */
    getRatingLabel?: (item: T) => string | undefined;
    /** Facts shown in the media viewer (pre-formatted at build time) */
    getDetails?: (item: T) => MediaCardDetail[] | undefined;
  };
  renderItem?: (item: T, index: number) => React.ReactNode;
  gridClassName?: string;
  filterColumnClass: string;
  itemNounPlural: string;
  /** Accessible name prefix for the viewer dialog, e.g. "Book details" */
  viewerLabel?: string;
}

interface MediaFilterGridProps<T> {
  items: T[];
  config: MediaFilterGridConfig<T>;
}

// Covers in the first rows load eagerly; the rest are lazy (and warmed up in
// the background once the page has loaded, see ImageWarmup.astro). The
// aspect-ratio boxes reserve their space, so there's no layout shift.
const EAGER_IMAGE_COUNT = 12;

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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  // The viewer walks the grid in its current filtered/sorted order
  const viewerItems: ViewerItem[] = useMemo(
    () =>
      filteredAndSorted.map((item) => ({
        image: config.card.getImage(item),
        title: config.card.getTitle(item),
        subtitle: config.card.getSubtitle(item),
        rating: config.card.getRating?.(item),
        ratingLabel: config.card.getRatingLabel?.(item),
        details: config.card.getDetails?.(item),
      })),
    [filteredAndSorted, config],
  );
  const getOrigin = useCallback(
    (index: number) => gridRef.current?.querySelector<HTMLElement>(`[data-viewer-index="${index}"] img`) ?? null,
    [],
  );

  const setFilter = (id: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [id]: value }));
  };

  const gridClassName = config.gridClassName ?? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6';

  // Server-rendered cards must be visible before (and without) hydration, so
  // nothing animates in on first render (AnimatePresence initial={false});
  // only filter/sort changes animate, and not at all under reduced motion.
  return (
    <MotionConfig reducedMotion="user">
    <div className="w-full">
      <div
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

        <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
          Showing {filteredAndSorted.length} of {items.length} {config.itemNounPlural}
        </div>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div layout className={gridClassName} ref={gridRef}>
          {filteredAndSorted.map((item, index) => (
            <motion.div
              key={config.card.getKey(item)}
              data-viewer-index={index}
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
                  ratingLabel={config.card.getRatingLabel?.(item)}
                  onOpen={() => setViewerIndex(index)}
                  eager={index < EAGER_IMAGE_COUNT}
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredAndSorted.length === 0 && (
        <div className="text-center py-12" role="status">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No {config.itemNounPlural} found matching your filters.
          </p>
        </div>
      )}
      {viewerIndex !== null && viewerItems[viewerIndex] && (
        <MediaViewer
          items={viewerItems}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          getOrigin={getOrigin}
          label={config.viewerLabel ?? 'Details'}
        />
      )}
    </div>
    </MotionConfig>
  );
}
