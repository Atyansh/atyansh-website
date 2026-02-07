import { useState, useRef } from 'react';
import type { SpotifyTrack } from '../utils/spotify';
import MediaCard from './MediaCard';
import ErrorBoundary from './ErrorBoundary';

interface MusicCarouselProps {
  tracks: SpotifyTrack[];
  title: string;
  playlistUrl?: string;
}

function MusicCarouselInner({ tracks, title, playlistUrl }: MusicCarouselProps) {
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

  const getBestImage = (images: Array<{ url: string; height: number; width: number }>) => {
    if (!images || images.length === 0) return undefined;
    const sorted = [...images].sort((a, b) => (b.height || 0) - (a.height || 0));
    return sorted[0]?.url;
  };

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="relative carousel-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </span>
          {playlistUrl && (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1 rounded-full hover:opacity-80 transition-all border-2"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                borderColor: 'var(--accent)'
              }}
            >
              Open in Spotify
            </a>
          )}
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative carousel-wrapper">
        {/* Previous Button */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 flex items-center justify-center -ml-6"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll left"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
          onScroll={handleScroll}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-4 pb-4">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="flex-shrink-0 w-48"
              >
                <a
                  href={track.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <MediaCard
                    title={track.name}
                    subtitle={track.artists.map(a => a.name).join(', ')}
                    image={getBestImage(track.album.images) || ''}
                    delay={0}
                  />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Next Button */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full shadow-lg transition-all duration-200 hover:scale-110 opacity-0 flex items-center justify-center -mr-6"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            aria-label="Scroll right"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}

export default function MusicCarousel(props: MusicCarouselProps) {
  return <ErrorBoundary sectionName="Music"><MusicCarouselInner {...props} /></ErrorBoundary>;
}
