import { useState } from 'react';

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

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImage = images[currentIndex];

  return (
    <div className="image-gallery-slider">
      {/* Counter Badge */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Image {currentIndex + 1} of {images.length}
          </span>
        </div>
      </div>

      {/* Main Slider */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-100 dark:bg-gray-900">
        {/* Image Container */}
        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
          <img
            key={currentIndex}
            src={currentImage.src}
            alt={currentImage.alt}
            className="absolute top-0 left-0 w-full h-full object-contain bg-gray-50 dark:bg-gray-950"
          />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-700 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleNext}
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

      {/* Dot Indicators */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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
      `}</style>
    </div>
  );
}
