import { useState } from 'react';
import type { UnifiedGame } from '../utils/unified-games';
import { getPlatformName, getPlatformColor } from '../utils/unified-games';
import { getGameCapsuleFallbacks } from '../utils/steam';

interface GameCardProps {
  game: UnifiedGame;
}

export default function GameCard({ game }: GameCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(game.image);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTap = () => {
    // Only toggle on touch devices (no hover capability)
    if (window.matchMedia('(hover: none)').matches) {
      setIsExpanded(!isExpanded);
    }
  };

  const platformColor = getPlatformColor(game.platform);

  const handleImageError = () => {
    // If Steam game, try fallback URLs
    if (game.platform === 'steam' && game.steamData) {
      const fallbacks = getGameCapsuleFallbacks(game.steamData.appid);
      if (fallbackIndex < fallbacks.length) {
        setImageSrc(fallbacks[fallbackIndex]);
        setFallbackIndex(fallbackIndex + 1);
        return;
      }
    }
    // No more fallbacks, show error state
    setImageError(true);
  };

  return (
    <div className="relative group w-full" onClick={handleTap}>
      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {/* Game Image */}
        {!imageError ? (
          <img
            src={imageSrc}
            alt={game.name}
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
          style={{ backgroundColor: platformColor, color: '#ffffff' }}
        >
          {getPlatformName(game.platform)}
        </div>

        {/* Stats Overlay - tap to show on mobile, hover on desktop */}
        <div
          className={`absolute inset-0 flex flex-col justify-end p-3 z-10 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 30%, color-mix(in srgb, var(--bg-primary) 95%, transparent) 100%)'
          }}
        >
          <div className="space-y-2" style={{ color: 'var(--text-primary)' }}>
            {/* Game Title */}
            <h3 className="font-bold text-sm line-clamp-2">{game.name}</h3>

            {/* Steam Stats */}
            {game.steamData && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Playtime:</span>
                  <span className="font-semibold">{Math.floor(game.steamData.playtimeMinutes / 60)}h</span>
                </div>
                {game.steamData.lastPlayed && game.steamData.lastPlayed > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Last Played:</span>
                    <span className="font-semibold">{new Date(game.steamData.lastPlayed * 1000).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* PSN Stats */}
            {game.psnData && (
              <div className="text-xs space-y-1">
                {game.psnData.playDuration && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Playtime:</span>
                    <span className="font-semibold">{game.psnData.playDuration}</span>
                  </div>
                )}
                {game.psnData.trophies && game.psnData.trophies.total > 0 && (
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--text-secondary)' }}>Trophies:</span>
                    <div className="flex gap-1 text-xs">
                      {game.psnData.trophies.platinum > 0 && <span>🏆{game.psnData.trophies.platinum}</span>}
                      {game.psnData.trophies.gold > 0 && <span>🥇{game.psnData.trophies.gold}</span>}
                      {game.psnData.trophies.silver > 0 && <span>🥈{game.psnData.trophies.silver}</span>}
                      {game.psnData.trophies.bronze > 0 && <span>🥉{game.psnData.trophies.bronze}</span>}
                    </div>
                  </div>
                )}
                {game.psnData.lastPlayed && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Last Played:</span>
                    <span className="font-semibold">{new Date(game.psnData.lastPlayed).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Nintendo Stats */}
            {game.nintendoData && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Playtime:</span>
                  <span className="font-semibold">{Math.floor(game.nintendoData.playtimeSeconds / 3600)}h</span>
                </div>
                {game.nintendoData.lastPlayed && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Last Played:</span>
                    <span className="font-semibold">{new Date(game.nintendoData.lastPlayed).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
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
