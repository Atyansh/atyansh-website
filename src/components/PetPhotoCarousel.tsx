import { useState, useRef } from 'react';
import FullscreenImageViewer from './FullscreenImageViewer';

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

  const navigatePrev = () => {
    setFullscreenIndex((prev) =>
      prev === 0 ? images.length - 1 : (prev ?? 0) - 1
    );
  };

  const navigateNext = () => {
    setFullscreenIndex((prev) =>
      prev === images.length - 1 ? 0 : (prev ?? 0) + 1
    );
  };

  if (images.length === 0) {
    return null;
  }

  // Map to FullscreenImageViewer format (title -> caption)
  const fullscreenImages = images.map((img) => ({
    src: img.src,
    alt: img.alt,
    caption: img.title,
  }));

  return (
    <>
      <div className="relative carousel-container w-full max-w-full overflow-hidden md:overflow-visible">
        {/* Carousel Wrapper */}
        <div className="relative carousel-wrapper overflow-hidden md:overflow-visible">
          {/* Previous Button */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 items-center justify-center -ml-6"
              style={{ backgroundColor: 'var(--bg-card)' }}
              aria-label="Scroll left"
            >
              <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  onClick={() => setFullscreenIndex(index)}
                  className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-lg overflow-hidden transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-secondary)'
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
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 items-center justify-center -mr-6"
              style={{ backgroundColor: 'var(--bg-card)' }}
              aria-label="Scroll right"
            >
              <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {fullscreenIndex !== null && (
        <FullscreenImageViewer
          images={fullscreenImages}
          currentIndex={fullscreenIndex}
          onClose={() => setFullscreenIndex(null)}
          onPrevious={navigatePrev}
          onNext={navigateNext}
        />
      )}
    </>
  );
}
