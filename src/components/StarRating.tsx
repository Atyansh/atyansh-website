interface StarRatingProps {
  /** 0–5; rounded to the nearest half star */
  rating: number;
  /** Accessible text; defaults to "<rating> out of 5 stars" */
  label?: string;
  className?: string;
}

/**
 * Five stars with half-star precision (e.g. 9/10 → 4½, 7/10 → 3½). Each star
 * is a single masked <span> (shape: /icons/star.svg, colors: .star-icon in
 * global.css) to keep grids of hundreds of cards light.
 */
export default function StarRating({ rating, label, className = '' }: StarRatingProps) {
  const rounded = Math.round(Math.min(Math.max(rating, 0), 5) * 2) / 2;
  const text = label ?? `${rounded} out of 5 stars`;

  return (
    <span className={`flex items-center gap-1 ${className}`}>
      <span className="sr-only">Rated {text}</span>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = rounded - i >= 1 ? 'full' : rounded - i >= 0.5 ? 'half' : 'empty';
        return <span key={i} className="star-icon" data-fill={fill} aria-hidden="true" />;
      })}
    </span>
  );
}
