import { useId, type CSSProperties, type ReactNode } from 'react';
import StarRating from './StarRating';

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
  /** Extra facts shown when the card is expanded (pre-formatted strings) */
  details?: MediaCardDetail[];
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
 * - otherwise: a <button aria-expanded> that expands an info panel with the
 *   full title and details over the card (CardExpand.astro handles toggling)
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
  details = [],
  spotify,
  tags = [],
  enterDelay,
  eager = false,
}: MediaCardProps) {
  const panelId = useId();
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
          {spotify && (
            <span className="absolute inset-x-0 top-0 bottom-[40%] flex items-center justify-center" aria-hidden="true">
              <span className="track-control relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <svg className="track-ring absolute inset-0 w-full h-full" viewBox="0 0 56 56">
                  <circle className="track-ring-bg" cx="28" cy="28" r="26" fill="none" strokeWidth="3" />
                  <circle className="track-ring-progress" cx="28" cy="28" r="26" fill="none" strokeWidth="3" pathLength={1} strokeDasharray="1" strokeLinecap="round" />
                </svg>
                <svg className="track-icon-play w-5 h-5" style={{ transform: 'translateX(1px)' }} fill="var(--accent)" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <svg className="track-icon-pause w-5 h-5" fill="var(--accent)" viewBox="0 0 24 24">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              </span>
            </span>
          )}
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

  // Expandable info card: the panel overlays the card (and the cards below
  // it if it's taller), so the grid itself never reflows
  return (
    <div className={`media-card-wrap relative${enterClass}`} style={style}>
      <button
        type="button"
        className={className}
        aria-expanded="false"
        aria-controls={panelId}
        data-expand-toggle=""
      >
        {body}
      </button>
      <div
        id={panelId}
        className="media-card-panel absolute left-0 right-0 top-0 min-h-full rounded-lg shadow-lg border p-4 text-left"
        style={{
          // --bg-card is translucent in some themes; layer it on the page color so the panel is opaque
          background: 'linear-gradient(var(--bg-card), var(--bg-card)), var(--bg-primary)',
          borderColor: 'var(--accent)',
          color: 'var(--text-primary)',
        }}
      >
        <p className="font-bold text-base leading-snug mb-1 break-words hyphens-auto">{title}</p>
        {subtitle && <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        {hasRating && <StarRating rating={rating} label={ratingLabel} className="mb-2" />}
        {details.length > 0 && (
          <dl className="text-xs space-y-1">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-2">
                <dt style={{ color: 'var(--text-secondary)' }}>{d.label}</dt>
                <dd className="font-semibold text-right">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
