import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Image {
  src: string;
  alt: string;
  title?: string;
}

interface PetPhotoCarouselProps {
  images: Image[];
}

export default function PetPhotoCarousel({ images }: PetPhotoCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const scrollPositionRef = useRef(0);

  // Lock body scroll when fullscreen is open and preserve scroll position
  useEffect(() => {
    if (fullscreenIndex !== null) {
      // Save current scroll position
      scrollPositionRef.current = window.scrollY;

      // Lock scroll and apply negative top to maintain visual position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      // Also prevent on html element for iOS
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = scrollPositionRef.current;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';

      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';

      // Restore the scroll position
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';

      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    };
  }, [fullscreenIndex]);

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

  const openFullscreen = (index: number) => {
    setFullscreenIndex(index);
  };

  const closeFullscreen = () => {
    setFullscreenIndex(null);
  };

  const navigateFullscreen = (direction: 'prev' | 'next') => {
    if (fullscreenIndex === null) return;

    if (direction === 'prev') {
      setFullscreenIndex((prev) =>
        prev === 0 ? images.length - 1 : (prev ?? 0) - 1
      );
    } else {
      setFullscreenIndex((prev) =>
        prev === images.length - 1 ? 0 : (prev ?? 0) + 1
      );
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    if (fullscreenIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreen();
      } else if (e.key === 'ArrowLeft') {
        navigateFullscreen('prev');
      } else if (e.key === 'ArrowRight') {
        navigateFullscreen('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenIndex, images.length]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative carousel-container w-full max-w-full overflow-hidden md:overflow-visible">
        {/* Carousel Wrapper */}
        <div className="relative carousel-wrapper overflow-hidden md:overflow-visible">
          {/* Previous Button */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-lg transition-all duration-200 hover:scale-110 opacity-0 items-center justify-center -ml-6"
              aria-label="Scroll left"
            >
              <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Scrollable Container */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-hidden scrollbar-hide w-full"
            onScroll={handleScroll}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex gap-3 sm:gap-4 pb-4">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => openFullscreen(index)}
                  className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-lg overflow-hidden transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    focusRingColor: 'var(--accent)'
                  }}
                  aria-label={`View ${image.alt} in fullscreen`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Next Button */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-lg transition-all duration-200 hover:scale-110 opacity-0 items-center justify-center -mr-6"
              aria-label="Scroll right"
            >
              <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Hide scrollbar and show buttons on carousel hover */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .carousel-wrapper:hover button {
            opacity: 1;
          }
        `}</style>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenIndex !== null && typeof document !== 'undefined' && createPortal(
        <div
          className="z-[9999] flex items-center justify-center"
          onClick={closeFullscreen}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
            padding: 0,
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            overflow: 'hidden',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            touchAction: 'none'
          }}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeFullscreen();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full transition-all flex items-center justify-center z-10 shadow-lg"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#1f2937',
              pointerEvents: 'auto'
            }}
            aria-label="Close fullscreen"
          >
            <svg className="w-6 h-6 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter */}
          <div
            className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-6 md:left-6 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium z-10 shadow-lg"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#1f2937',
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {fullscreenIndex + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateFullscreen('prev');
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute left-2 sm:left-4 md:left-6 lg:left-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#1f2937',
                pointerEvents: 'auto'
              }}
              aria-label="Previous image"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Main Image Container */}
          <div
            className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 md:p-12 lg:p-16 xl:p-20"
            style={{ pointerEvents: 'none' }}
          >
            <img
              src={images[fullscreenIndex].src}
              alt={images[fullscreenIndex].alt}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
              style={{
                width: 'auto',
                height: 'auto',
                pointerEvents: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateFullscreen('next');
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute right-2 sm:right-4 md:right-6 lg:right-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: '#1f2937',
                pointerEvents: 'auto'
              }}
              aria-label="Next image"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
