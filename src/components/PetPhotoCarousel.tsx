import { useState } from 'react';
import BaseCarousel from './BaseCarousel';
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
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

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
      <BaseCarousel itemCount={images.length}>
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
      </BaseCarousel>

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
