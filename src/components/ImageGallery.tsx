import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface ImageGalleryProps {
  images: { src: string; alt: string; title?: string }[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedImage !== null && lightboxRef.current) {
      lightboxRef.current.focus();
    }
  }, [selectedImage]);

  const handlePrevious = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1);
    }
  };

  const handleNext = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') setSelectedImage(null);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="relative aspect-square overflow-hidden rounded-lg cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => setSelectedImage(index)}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </motion.div>
        ))}
      </div>

      {/* Lightbox */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedImage !== null && (
            <motion.div
              ref={lightboxRef}
              className="fixed inset-0 bg-black z-[99999] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              {/* Top bar with close button and counter */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 z-20">
                {images.length > 1 && (
                  <div className="text-white text-lg font-medium">
                    {selectedImage + 1} / {images.length}
                  </div>
                )}
                <div className="flex-1"></div>
                <button
                  className="text-white text-4xl hover:opacity-70 transition-opacity w-12 h-12 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Navigation arrows */}
              {images.length > 1 && (
                <>
                  <button
                    className="absolute left-8 top-1/2 -translate-y-1/2 text-white text-7xl hover:opacity-70 transition-opacity z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevious();
                    }}
                    aria-label="Previous"
                  >
                    ‹
                  </button>

                  <button
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-white text-7xl hover:opacity-70 transition-opacity z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNext();
                    }}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Image */}
              <motion.img
                key={selectedImage}
                src={images[selectedImage].src}
                alt={images[selectedImage].alt}
                className="max-w-[95vw] max-h-[95vh] object-contain"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
