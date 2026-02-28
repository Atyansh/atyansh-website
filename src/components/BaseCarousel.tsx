import { useState, useRef, type ReactNode } from 'react';

interface BaseCarouselProps {
  itemCount: number;
  itemNoun?: string;
  title?: string;
  headerActions?: ReactNode;
  arrowZClass?: string;
  children: ReactNode;
}

export default function BaseCarousel({
  itemCount, itemNoun, title, headerActions, arrowZClass = 'z-10', children,
}: BaseCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  if (itemCount === 0) return null;

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
            onClick={() => scroll('left')}
            className={`absolute left-0 top-1/2 -translate-y-1/2 ${arrowZClass} w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 flex items-center justify-center -ml-6`}
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll left"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          <div className="flex gap-4 pb-4">
            {children}
          </div>
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className={`absolute right-0 top-1/2 -translate-y-1/2 ${arrowZClass} w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 flex items-center justify-center -mr-6`}
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll right"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        .carousel-wrapper:hover button {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
