import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface BaseCarouselProps {
  itemCount: number;
  itemNoun?: string;
  title?: string;
  /** Extra header content; from Astro pass it as `<… slot="headerActions">` */
  headerActions?: ReactNode;
  arrowZClass?: string;
  /** Carousel items. From Astro these can be passed as static slot content,
   *  so the items are server-rendered HTML rather than serialized props. */
  children: ReactNode;
}

export default function BaseCarousel({
  itemCount, itemNoun, title, headerActions, arrowZClass = 'z-10', children,
}: BaseCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  // Unknown until measured on mount: don't offer a right arrow for content
  // that doesn't overflow
  const [showRightArrow, setShowRightArrow] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }
  };

  const updateArrows = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows]);

  if (itemCount === 0) return null;

  const arrowClass = `carousel-arrow absolute top-1/2 -translate-y-1/2 ${arrowZClass} w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 flex items-center justify-center`;

  return (
    <div className="relative carousel-container">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <div className="flex items-center gap-4">
            {itemNoun && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {itemCount} {itemCount === 1 ? itemNoun : `${itemNoun}s`}
              </span>
            )}
            {headerActions}
          </div>
        </div>
      )}

      <div className="relative carousel-wrapper">
        {showLeftArrow && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className={`${arrowClass} left-0 -ml-6`}
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll left"
          >
            <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
          onScroll={updateArrows}
        >
          <div className="flex gap-4 pb-4">
            {children}
          </div>
        </div>

        {showRightArrow && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className={`${arrowClass} right-0 -mr-6`}
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll right"
          >
            <svg className="w-6 h-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Arrows appear on hover, and whenever they (or anything in the
          carousel) have keyboard focus, so they're never invisible-but-focused */}
      <style>{`
        .carousel-arrow { opacity: 0; }
        .carousel-wrapper:hover .carousel-arrow,
        .carousel-wrapper:focus-within .carousel-arrow,
        .carousel-arrow:focus-visible { opacity: 1; }
      `}</style>
    </div>
  );
}
