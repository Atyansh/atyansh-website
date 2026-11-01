import { useState, useRef, useCallback } from 'react';
import MediaViewer from './MediaViewer';

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
  const rootRef = useRef<HTMLDivElement>(null);
  // The visible thumbnail for an image: a mobile card, or the desktop slide
  const getOrigin = useCallback((index: number) => {
    const candidates = rootRef.current?.querySelectorAll<HTMLElement>(`[data-viewer-index="${index}"] img`) ?? [];
    return [...candidates].find((el) => el.getBoundingClientRect().width > 0) ?? null;
  }, []);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImage = images[currentIndex];

  return (
    <div className="image-gallery-slider" ref={rootRef}>
      {/* Counter Badge (desktop only) */}
      <div className="hidden lg:flex items-center justify-center mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex gap-3 sm:gap-4">
            {images.map((image, index) => (
              <button
                key={index}
                type="button"
                data-viewer-index={index}
                aria-haspopup="dialog"
                onClick={() => {
                  setCurrentIndex(index);
                  setIsFullscreen(true);
                }}
                className="flex-shrink-0 w-64 sm:w-80 rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
                aria-label={`View ${image.alt} in fullscreen`}
              >
                <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  />
                </div>
                <div className="p-4 border-t" style={{ background: 'linear-gradient(to right, var(--bg-card), var(--bg-secondary))', borderColor: 'var(--border)' }}>
                  <p className="text-center text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {image.caption || image.alt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Slider (visible on desktop) */}
      <div className="hidden lg:block relative rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {/* Image Container */}
        <div className="relative w-full cursor-pointer" style={{ paddingBottom: '60%' }} onClick={() => setIsFullscreen(true)} data-viewer-index={currentIndex}>
          <img
            key={currentIndex}
            src={currentImage.src}
            alt={currentImage.alt}
            className="absolute top-0 left-0 w-full h-full object-contain hover:opacity-95 transition-opacity"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          />

          {/* Keyboard-accessible way into the viewer (the slide itself is a click target) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-haspopup="dialog"
            aria-label="View image full size"
          >
            <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            </svg>
          </button>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
                style={{ backgroundColor: 'var(--bg-card)' }}
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
                style={{ backgroundColor: 'var(--bg-card)' }}
                aria-label="Next image"
              >
                <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Caption Bar */}
        <div className="p-6 border-t" style={{ background: 'linear-gradient(to right, var(--bg-card), var(--bg-secondary))', borderColor: 'var(--border)' }}>
          <p className="text-center text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
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
                  backgroundColor: index === currentIndex ? 'var(--accent)' : 'var(--text-secondary)'
                }}
              />
            </button>
          ))}
        </div>
      )}

      <style>{`
        .image-gallery-slider {
          width: 100%;
        }
      `}</style>

      {isFullscreen && (
        <MediaViewer
          variant="photo"
          items={images.map((img) => ({ image: img.src, alt: img.alt, caption: img.caption || img.alt }))}
          index={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setIsFullscreen(false)}
          getOrigin={getOrigin}
          label="Image"
        />
      )}
    </div>
  );
}
