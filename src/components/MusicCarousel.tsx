import type { SpotifyTrack } from '../utils/spotify';
import { getBestImage } from '../utils/spotify';
import MediaCard from './MediaCard';
import BaseCarousel from './BaseCarousel';
import ErrorBoundary from './ErrorBoundary';

interface MusicCarouselProps {
  tracks: SpotifyTrack[];
  title: string;
  playlistUrl?: string;
}

function MusicCarouselInner({ tracks, title, playlistUrl }: MusicCarouselProps) {
  const headerActions = playlistUrl ? (
    <a
      href={playlistUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm px-3 py-1 rounded-full hover:opacity-80 transition-all border-2"
      style={{ backgroundColor: 'transparent', color: 'var(--accent)', borderColor: 'var(--accent)' }}
    >
      Open in Spotify
    </a>
  ) : undefined;

  return (
    <BaseCarousel itemCount={tracks.length} itemNoun="track" title={title} headerActions={headerActions}>
      {tracks.map((track) => (
        <div key={track.id} className="flex-shrink-0 w-48">
          <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="block">
            <MediaCard
              title={track.name}
              subtitle={track.artists.map(a => a.name).join(', ')}
              image={getBestImage(track.album.images) || ''}
              delay={0}
            />
          </a>
        </div>
      ))}
    </BaseCarousel>
  );
}

export default function MusicCarousel(props: MusicCarouselProps) {
  return <ErrorBoundary sectionName="Music"><MusicCarouselInner {...props} /></ErrorBoundary>;
}
