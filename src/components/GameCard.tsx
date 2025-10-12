import { motion } from 'framer-motion';
import { useState } from 'react';
import type { UnifiedGame } from '../utils/unified-games';
import { formatPlaytime, getPlatformName, getPlatformColor } from '../utils/unified-games';
import { getGameCapsuleFallbacks } from '../utils/steam';

interface GameCardProps {
  game: UnifiedGame;
  delay?: number;
}

export default function GameCard({ game, delay = 0 }: GameCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(game.image);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        delay: delay,
        ease: 'easeOut'
      }
    }
  };

  const hoverVariants = {
    scale: 1.05,
    y: -5,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  };

  const platformColor = getPlatformColor(game.platform);
  const playtime = formatPlaytime(game);

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
    <div className="relative group w-full">
      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 bg-gray-800">
        {/* Game Image */}
        {!imageError ? (
          <img
            src={imageSrc}
            alt={game.name}
            className="w-full h-full object-cover transition-opacity duration-200"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <div className="text-center p-4">
              <div className="text-white text-sm font-medium opacity-70">{game.name}</div>
            </div>
          </div>
        )}

        {/* Platform Badge */}
        <div
          className="absolute top-2 right-2 px-2 py-1 rounded text-white text-xs font-bold shadow-lg z-20"
          style={{ backgroundColor: platformColor }}
        >
          {getPlatformName(game.platform)}
        </div>

        {/* Stats Overlay on Hover */}
        <div
          className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 z-10 transition-opacity duration-200"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(0,0,0,0.85) 100%)'
          }}
        >
          <div className="text-white space-y-2">
            {/* Game Title */}
            <h3 className="font-bold text-sm line-clamp-2">{game.name}</h3>

            {/* Steam Stats */}
            {game.steamData && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-300">Playtime:</span>
                  <span className="font-semibold">{Math.floor(game.steamData.playtimeMinutes / 60)}h</span>
                </div>
                {game.steamData.playtime2Weeks && game.steamData.playtime2Weeks > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Last 2 weeks:</span>
                    <span className="font-semibold">{Math.floor(game.steamData.playtime2Weeks / 60)}h</span>
                  </div>
                )}
              </div>
            )}

            {/* PSN Stats */}
            {game.psnData && (
              <div className="text-xs space-y-1">
                {game.psnData.playDuration && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Playtime:</span>
                    <span className="font-semibold">{game.psnData.playDuration}</span>
                  </div>
                )}
                {game.psnData.trophies && game.psnData.trophies.total > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Trophies:</span>
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
                    <span className="text-gray-300">Last Played:</span>
                    <span className="font-semibold text-xs">
                      {new Date(game.psnData.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Nintendo Stats */}
            {game.nintendoData && (
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-300">Playtime:</span>
                  <span className="font-semibold">{Math.floor(game.nintendoData.playtimeSeconds / 3600)}h</span>
                </div>
                {game.nintendoData.lastPlayed && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Last Played:</span>
                    <span className="font-semibold text-xs">
                      {new Date(game.nintendoData.lastPlayed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
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
