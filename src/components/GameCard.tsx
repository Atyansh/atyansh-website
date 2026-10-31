import { useEffect, useRef, useState } from 'react';

/** Display-ready game data, built at build time in games.astro (dates are
 *  pre-formatted strings, so server and client render identical text). */
export interface GameCardData {
  id: string;
  name: string;
  image: string;
  /** Tried in order if `image` fails to load */
  fallbackImages?: string[];
  platformName: string;
  platformColor: string;
  stats: Array<{ label: string; value: string }>;
  trophies?: { platinum: number; gold: number; silver: number; bronze: number };
}

interface GameCardProps {
  game: GameCardData;
}

export default function GameCard({ game }: GameCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(game.image);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleImageError = () => {
    const fallbacks = game.fallbackImages ?? [];
    if (fallbackIndex < fallbacks.length) {
      setImageSrc(fallbacks[fallbackIndex]);
      setFallbackIndex(fallbackIndex + 1);
      return;
    }
    // No more fallbacks, show error state
    setImageError(true);
  };

  // The island hydrates when visible, so the server-rendered image may have
  // already failed before React attached onError: catch that up on mount
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) handleImageError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats overlay: hover (mouse), focus (keyboard), or tap on touch screens
  // ([data-tap-reveal] → TapToReveal.astro; styles in global.css)
  return (
    <div className="game-card relative group w-full" tabIndex={0} role="group" aria-label={game.name} data-tap-reveal="">
      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {/* Game Image */}
        {!imageError && imageSrc ? (
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover transition-opacity duration-200"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--bg-secondary), var(--bg-primary))' }}>
            <div className="text-center p-4">
              <div className="text-sm font-medium opacity-70" style={{ color: 'var(--text-secondary)' }}>{game.name}</div>
            </div>
          </div>
        )}

        {/* Platform Badge */}
        <div
          className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold shadow-lg z-20"
          style={{ backgroundColor: game.platformColor, color: '#ffffff' }}
        >
          {game.platformName}
        </div>

        {/* Stats Overlay */}
        <div
          className="media-card-overlay absolute inset-0 flex flex-col justify-end p-3 z-10"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 30%, color-mix(in srgb, var(--bg-primary) 95%, transparent) 100%)'
          }}
        >
          <div className="space-y-2" style={{ color: 'var(--text-primary)' }}>
            <div className="font-bold text-sm line-clamp-2" aria-hidden="true">{game.name}</div>

            {(game.stats.length > 0 || game.trophies) && (
              <dl className="text-xs space-y-1">
                {game.stats.map((stat) => (
                  <div key={stat.label} className="flex justify-between">
                    <dt style={{ color: 'var(--text-secondary)' }}>{stat.label}:</dt>
                    <dd className="font-semibold">{stat.value}</dd>
                  </div>
                ))}
                {game.trophies && (
                  <div className="flex justify-between items-center">
                    <dt style={{ color: 'var(--text-secondary)' }}>Trophies:</dt>
                    <dd className="flex gap-1 text-xs">
                      {game.trophies.platinum > 0 && <span title="Platinum">🏆{game.trophies.platinum}</span>}
                      {game.trophies.gold > 0 && <span title="Gold">🥇{game.trophies.gold}</span>}
                      {game.trophies.silver > 0 && <span title="Silver">🥈{game.trophies.silver}</span>}
                      {game.trophies.bronze > 0 && <span title="Bronze">🥉{game.trophies.bronze}</span>}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Game Title Below Card */}
      <div className="mt-2 px-1">
        <h3
          className="font-semibold text-xs line-clamp-2 min-h-[2rem]"
          style={{ color: 'var(--text-primary)' }}
          title={game.name}
        >
          {game.name}
        </h3>
      </div>
    </div>
  );
}
