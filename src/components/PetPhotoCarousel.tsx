import { useCallback, useRef, useState } from 'react';
import BaseCarousel from './BaseCarousel';
import MediaViewer from './MediaViewer';

interface Image {
  src: string;
  alt: string;
  title?: string;
}

interface PetPhotoCarouselProps {
  images: Image[];
}

export default function PetPhotoCarousel({ images }: PetPhotoCarouselProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const getOrigin = useCallback(
    (index: number) => listRef.current?.querySelector<HTMLElement>(`[data-viewer-index="${index}"] img`) ?? null,
    [],
  );

  if (images.length === 0) {
    return null;
  }

  return (
    <div ref={listRef}>
      <BaseCarousel itemCount={images.length}>
        {images.map((image, index) => (
          <button
            key={index}
            type="button"
            data-viewer-index={index}
            onClick={() => setViewerIndex(index)}
            className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-lg overflow-hidden transition-transform motion-safe:hover:scale-105 motion-safe:active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-secondary)'
            }}
            aria-haspopup="dialog"
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

      {viewerIndex !== null && (
        <MediaViewer
          variant="photo"
          items={images.map((img) => ({ image: img.src, alt: img.alt, caption: img.title }))}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          getOrigin={getOrigin}
          label="Photo"
        />
      )}
    </div>
  );
}
