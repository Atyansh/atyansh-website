import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface FullscreenImage {
  src: string;
  alt: string;
  caption?: string;
}

interface FullscreenImageViewerProps {
  images: FullscreenImage[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export default function FullscreenImageViewer({
  images,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
}: FullscreenImageViewerProps) {
  const scrollPositionRef = useRef(0);

  // Lock body scroll and preserve scroll position
  useEffect(() => {
    scrollPositionRef.current = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      const scrollY = scrollPositionRef.current;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      });
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrevious();
      else if (e.key === 'ArrowRight') onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext]);

  const currentImage = images[currentIndex];
  const caption = currentImage.caption || currentImage.alt;
  const buttonStyle = {
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    pointerEvents: 'auto' as const,
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="z-[9999] flex items-center justify-center"
      onClick={onClose}
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
        touchAction: 'none',
      }}
    >
      {/* Close Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full transition-all flex items-center justify-center z-10 shadow-lg"
        style={buttonStyle}
        aria-label="Close fullscreen"
      >
        <svg className="w-6 h-6 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image Counter */}
      <div
        className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-6 md:left-6 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium z-10 shadow-lg"
        style={buttonStyle}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute left-2 sm:left-4 md:left-6 lg:left-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110"
          style={buttonStyle}
          aria-label="Previous image"
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Main Image */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 md:p-12 lg:p-16 xl:p-20"
        style={{ pointerEvents: 'none' }}
      >
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
          style={{ width: 'auto', height: 'auto', pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute right-2 sm:right-4 md:right-6 lg:right-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full transition-all flex items-center justify-center z-10 shadow-lg hover:scale-110"
          style={buttonStyle}
          aria-label="Next image"
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Caption Overlay */}
      {caption && (
        <div
          className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 z-10"
          style={{
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 50%, transparent 100%)',
            pointerEvents: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <p
            className="text-center text-sm sm:text-base md:text-lg leading-relaxed max-w-4xl mx-auto"
            style={{ color: 'var(--accent)' }}
          >
            {caption}
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
