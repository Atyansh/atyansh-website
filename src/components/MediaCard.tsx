import type { CSSProperties, ReactNode } from 'react';
import StarRating from './StarRating';

export interface MediaCardProps {
  title: string;
  subtitle?: string;
  image: string;
  /** Rating on a 0–5 scale; fractional values render as half stars */
  rating?: number;
  /** Accessible description of the rating, e.g. "9 out of 10" */
  ratingLabel?: string;
  /** External page for this item; the card becomes a link (new tab) */
  href?: string;
  /** Spotify track id; the card becomes a button that plays it in the site's
   *  Spotify player (see SpotifyPlayer.astro) instead of linking out */
  spotifyTrackId?: string;
  tags?: string[];
  /** Entrance animation delay in seconds; omit for no entrance animation */
  enterDelay?: number;
  /** Load the image eagerly (first screenful) instead of lazily */
  eager?: boolean;
}

/**
 * Poster-style media tile. Stateless and framer-free so it can be rendered
 * statically by Astro (no hydration) or inside an island. Overlay reveal is
 * pure CSS (.media-card rules in global.css): hover on hover-capable
 * pointers, :focus-visible for keyboards, and [data-expanded] — toggled by
 * the delegated tap handler in TapToReveal.astro — on touch screens.
 */
export default function MediaCard({
  title,
  subtitle,
  image,
  rating,
  ratingLabel,
  href,
  spotifyTrackId,
  tags = [],
  enterDelay,
  eager = false,
}: MediaCardProps) {
  const animated = enterDelay !== undefined;
  const className = `media-card group relative block w-full overflow-hidden rounded-lg shadow-lg text-left cursor-pointer${animated ? ' animate-pop' : ''}`;
  const style = animated ? ({ '--enter-delay': `${enterDelay}s` } as CSSProperties) : undefined;

  const body: ReactNode = (
    <>
      <span className="relative block aspect-[2/3] overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {image && (
          <img
            src={image}
            alt=""
            width={300}
            height={450}
            loading={eager ? 'eager' : 'lazy'}
            data-warm={eager ? undefined : ''}
            decoding="async"
            className="media-card-image w-full h-full object-cover"
          />
        )}

        {spotifyTrackId && (
          <span className="media-card-now-playing absolute top-2 left-2 z-10 px-2 py-1 rounded-full text-xs font-bold items-center gap-1" style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}>
            <svg className="w-3 h-3" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            In player
          </span>
        )}

        {/* Full overlay: hover (mouse), focus (keyboard), tap (touch) */}
        <span
          className="media-card-overlay absolute inset-0 flex flex-col justify-end"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 20%, color-mix(in srgb, var(--bg-primary) 95%, transparent) 100%)'
          }}
        >
          {spotifyTrackId && (
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-lg" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--accent)' }}>
                <svg className="w-5 h-5" style={{ transform: 'translateX(1px)' }} fill="var(--accent)" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          )}
          <span className="relative block p-4" style={{ color: 'var(--text-primary)' }}>
            <span className="font-bold text-lg mb-1 line-clamp-2">{title}</span>
            {subtitle && <span className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{subtitle}</span>}

            {rating !== undefined && rating > 0 && (
              <StarRating rating={rating} label={ratingLabel} className="mb-2" />
            )}

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

  if (spotifyTrackId) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        data-spotify-track={spotifyTrackId}
        data-track-title={title}
        data-track-subtitle={subtitle}
        aria-label={subtitle ? `Play ${title} by ${subtitle}` : `Play ${title}`}
      >
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style} data-tap-reveal="">
        {body}
      </a>
    );
  }

  // No destination: still focusable so keyboard users can reveal the overlay
  return (
    <div tabIndex={0} className={className} style={style} data-tap-reveal="">
      {body}
    </div>
  );
}
