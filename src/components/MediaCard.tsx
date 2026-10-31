import type { CSSProperties, ReactNode } from 'react';
import StarRating from './StarRating';
import PlayButton from './PlayButton';

export interface MediaCardDetail {
  label: string;
  value: string;
}

export type SpotifyEmbedType = 'track' | 'album' | 'artist' | 'playlist' | 'show' | 'episode';

export interface MediaCardProps {
  title: string;
  subtitle?: string;
  image: string;
  /** Rating on a 0–5 scale; fractional values render as half stars */
  rating?: number;
  /** Accessible description of the rating, e.g. "9 out of 10" */
  ratingLabel?: string;
  /** Opens this item in the media viewer (MediaFilterGrid passes it) */
  onOpen?: () => void;
  /** Spotify item to play in place: the card becomes a play/pause button
   *  driving the hidden embed in SpotifyPlayer.astro */
  spotify?: { type: SpotifyEmbedType; id: string };
  tags?: string[];
  /** Entrance animation delay in seconds; omit for no entrance animation */
  enterDelay?: number;
  /** Load the image eagerly (first screenful) instead of lazily */
  eager?: boolean;
}

/**
 * Poster-style media tile. Stateless and framer-free so it can be rendered
 * statically by Astro (no hydration) or inside an island. Three variants:
 *
 * - spotify: a <button> that plays/pauses the item in place (track/album/
 *   artist/playlist previews, podcast episodes/shows), with a progress ring
 *   around the play icon (driven by SpotifyPlayer.astro)
 * - onOpen: a <button aria-haspopup="dialog"> that opens the item in the
 *   shared MediaViewer (grows out of the tile)
 *
 * Nothing links off-site. The hover/focus/tap overlay is pure CSS
 * (.media-card rules in global.css).
 */
export default function MediaCard({
  title,
  subtitle,
  image,
  rating,
  ratingLabel,
  onOpen,
  spotify,
  tags = [],
  enterDelay,
  eager = false,
}: MediaCardProps) {
  const animated = enterDelay !== undefined;
  const className = 'media-card group relative block w-full overflow-hidden rounded-lg shadow-lg text-left cursor-pointer';
  const enterClass = animated ? ' animate-pop' : '';
  const style = animated ? ({ '--enter-delay': `${enterDelay}s` } as CSSProperties) : undefined;
  const hasRating = rating !== undefined && rating > 0;

  const body: ReactNode = (
    <>
      <span className="relative block aspect-[2/3] overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {image && (
          <img
            src={image}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            data-warm={eager ? undefined : ''}
            decoding="async"
            className="w-full h-full object-cover"
          />
        )}

        {/* Overlay: hover (mouse), focus (keyboard), tap (touch), active track */}
        <span
          className="media-card-overlay absolute inset-0 flex flex-col justify-end"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 20%, color-mix(in srgb, var(--bg-primary) 95%, transparent) 100%)'
          }}
        >
          <span className="relative block p-4" style={{ color: 'var(--text-primary)' }}>
            <span className="font-bold text-lg mb-1 line-clamp-2">{title}</span>
            {subtitle && <span className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{subtitle}</span>}

            {hasRating && <StarRating rating={rating} label={ratingLabel} className="mb-2" />}

            {tags.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>

        {/* Centered on the tile; shown with the overlay (and always on touch
            screens, which can't hover) */}
        {spotify && (
          <span className="media-card-play absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <PlayButton />
          </span>
        )}
      </span>

      {/* Minimal caption, hidden while the overlay is showing */}
      <span
        className="media-card-caption absolute bottom-0 left-0 right-0 p-3"
        aria-hidden="true"
        style={{
          background: 'linear-gradient(to top, color-mix(in srgb, var(--bg-primary) 90%, transparent), transparent)'
        }}
      >
        <span className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </span>
    </>
  );

  if (spotify) {
    const name = subtitle && spotify.type !== 'artist' ? `${title} by ${subtitle}` : title;
    const verb = spotify.type === 'show' || spotify.type === 'episode' ? 'episode' : 'preview';
    return (
      <button
        type="button"
        className={className + enterClass}
        style={style}
        data-spotify-embed={`${spotify.type}/${spotify.id}`}
        data-track-name={name}
        data-track-verb={verb}
        aria-label={`Play ${verb}: ${name}`}
        aria-pressed="false"
      >
        {body}
      </button>
    );
  }

  if (onOpen) {
    return (
      <button
        type="button"
        className={className + enterClass}
        style={style}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={subtitle ? `${title}, ${subtitle}: view details` : `${title}: view details`}
        data-viewer-tile=""
      >
        {body}
      </button>
    );
  }

  // Nothing to do on click: still focusable so keyboards can reveal the overlay
  return (
    <div tabIndex={0} className={className + enterClass} style={style}>
      {body}
    </div>
  );
}
