import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Image {
  src: string;
  alt: string;
  caption?: string;
}

interface ImageGalleryProps {
  images: Image[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Lock body scroll when fullscreen is open and preserve scroll position
  useEffect(() => {
    if (isFullscreen) {
      // Save current scroll position
      scrollPositionRef.current = window.scrollY;

      // Lock scroll and apply negative top to maintain visual position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';
      document.body.style.height = '100%';
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

      // Restore the scroll position with double RAF to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      });
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
    };
  }, [isFullscreen]);

  // Keyboard navigation for fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreen();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, images.length]);

  const currentImage = images[currentIndex];

  return (
    <div className="image-gallery-slider">
      {/* Counter Badge (desktop only) */}
      <div className="hidden lg:flex items-center justify-center mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Image {currentIndex + 1} of {images.length}
          </span>
        </div>
      </div>

      {/* Mobile Horizontal Scroll View (visible on mobile/tablet) */}
      <div className="lg:hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide w-full pb-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex gap-3 sm:gap-4">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  openFullscreen();
                }}
                className="flex-shrink-0 w-64 sm:w-80 rounded-2xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-900 transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  focusRingColor: 'var(--accent)'
                }}
                aria-label={`View ${image.alt} in fullscreen`}
              >
                <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="absolute top-0 left-0 w-full h-full object-contain bg-gray-50 dark:bg-gray-950"
                  />
                </div>
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 p-4 border-t border-gray-700/50">
                  <p className="text-white text-center text-sm leading-relaxed">
                    {image.caption || image.alt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Slider (visible on desktop) */}
      <div className="hidden lg:block relative rounded-2xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-900">
        {/* Image Container */}
        <div className="relative w-full cursor-pointer" style={{ paddingBottom: '60%' }} onClick={openFullscreen}>
          <img
            key={currentIndex}
            src={currentImage.src}
            alt={currentImage.alt}
            className="absolute top-0 left-0 w-full h-full object-contain bg-gray-50 dark:bg-gray-950 hover:opacity-95 transition-opacity"
          />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
                aria-label="Next image"
              >
                <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Caption Bar */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 p-6 border-t border-gray-700/50">
          <p className="text-white text-center text-base leading-relaxed">
            {currentImage.caption || currentImage.alt}
          </p>
        </div>
      </div>

      {/* Dot Indicators (desktop only) */}
      {images.length > 1 && (
        <div className="hidden lg:flex items-center justify-center gap-2 mt-6">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className="transition-all duration-300"
              aria-label={`Go to image ${index + 1}`}
            >
              <div
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 h-2'
                    : 'w-2 h-2 opacity-50 hover:opacity-75'
                }`}
                style={{
                  backgroundColor: index === currentIndex ? 'var(--accent)' : '#9ca3af'
                }}
              />
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .image-gallery-slider {
          width: 100%;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Fullscreen Modal */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
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
            {currentIndex + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
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
              src={currentImage.src}
              alt={currentImage.alt}
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
                handleNext();
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

          {/* Caption Overlay */}
          {(currentImage.caption || currentImage.alt) && (
            <div
              className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 z-10"
              style={{
                background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 50%, transparent 100%)',
                pointerEvents: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <p className="text-white text-center text-sm sm:text-base md:text-lg leading-relaxed max-w-4xl mx-auto">
                {currentImage.caption || currentImage.alt}
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
