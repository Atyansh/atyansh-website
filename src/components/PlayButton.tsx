interface PlayButtonProps {
  /** md: music tiles (56px); sm: smaller tiles such as climbing videos */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Shared circular play control (music tiles, climbing videos). Purely visual
 * (aria-hidden): the surrounding <button> carries the label. Everything is
 * drawn in one SVG viewBox, so the progress ring is always concentric with
 * the button, and it doesn't depend on border-radius (Brutalist and Dark
 * Terminal force border-radius: 0 on every element, which turned the old
 * CSS circle into a square). States come from an ancestor's
 * [data-track-state] = loading | playing | paused | ready, and progress
 * from --track-progress (0–1); see .play-btn in global.css.
 */
export default function PlayButton({ size = 'md', className = '' }: PlayButtonProps) {
  return (
    <span className={`play-btn play-btn--${size} ${className}`} aria-hidden="true">
      <svg className="play-btn-svg" viewBox="0 0 56 56" focusable="false">
        <circle className="play-btn-bg" cx="28" cy="28" r="27" />
        <g className="play-btn-ring">
          <circle className="play-btn-track" cx="28" cy="28" r="25" fill="none" strokeWidth="2.5" />
          <circle
            className="play-btn-progress"
            cx="28"
            cy="28"
            r="25"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
        <path className="play-btn-play" d="M23.5 18.5v19l15-9.5z" />
        <g className="play-btn-pause">
          <rect x="20.5" y="19" width="5" height="18" rx="1.2" />
          <rect x="30.5" y="19" width="5" height="18" rx="1.2" />
        </g>
      </svg>
    </span>
  );
}
