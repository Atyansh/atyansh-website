import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { UnifiedGame } from '../utils/unified-games';
import { getPlatformName, getPlatformColor } from '../utils/unified-games';

interface GameDetailsModalProps {
  game: UnifiedGame;
  onClose: () => void;
}

export default function GameDetailsModal({ game, onClose }: GameDetailsModalProps) {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const platformColor = getPlatformColor(game.platform);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black bg-opacity-70"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Content */}
        <motion.div
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Game Image Header */}
          <div className="relative h-64 rounded-t-lg overflow-hidden">
            <img
              src={game.headerImage || game.image}
              alt={game.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

            {/* Platform Badge */}
            <div
              className="absolute bottom-4 right-4 px-3 py-1.5 rounded text-white font-bold shadow-lg"
              style={{ backgroundColor: platformColor }}
            >
              {getPlatformName(game.platform)}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Title */}
            <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
              {game.name}
            </h2>

            {/* Stats Grid */}
            <div className="space-y-6">
              {/* Steam Stats */}
              {game.steamData && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/>
                    </svg>
                    Steam Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Playtime</div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                        {Math.floor(game.steamData.playtimeMinutes / 60)}h
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {game.steamData.playtimeMinutes} minutes
                      </div>
                    </div>
                    {game.steamData.playtime2Weeks !== undefined && game.steamData.playtime2Weeks > 0 && (
                      <div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last 2 Weeks</div>
                        <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                          {Math.floor(game.steamData.playtime2Weeks / 60)}h
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {game.steamData.playtime2Weeks} minutes
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PSN Stats */}
              {game.psnData && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    </svg>
                    PlayStation Statistics
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Platform</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {game.psnData.category}
                        </div>
                      </div>
                      {game.psnData.playDuration && (
                        <div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Playtime</div>
                          <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {game.psnData.playDuration}
                          </div>
                        </div>
                      )}
                    </div>

                    {game.psnData.trophies && game.psnData.trophies.total > 0 && (
                      <div>
                        <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Trophies Earned</div>
                        <div className="grid grid-cols-4 gap-3">
                          {game.psnData.trophies.platinum > 0 && (
                            <div className="text-center p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                              <div className="text-2xl mb-1">🏆</div>
                              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {game.psnData.trophies.platinum}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Platinum</div>
                            </div>
                          )}
                          {game.psnData.trophies.gold > 0 && (
                            <div className="text-center p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                              <div className="text-2xl mb-1">🥇</div>
                              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {game.psnData.trophies.gold}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Gold</div>
                            </div>
                          )}
                          {game.psnData.trophies.silver > 0 && (
                            <div className="text-center p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                              <div className="text-2xl mb-1">🥈</div>
                              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {game.psnData.trophies.silver}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Silver</div>
                            </div>
                          )}
                          {game.psnData.trophies.bronze > 0 && (
                            <div className="text-center p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                              <div className="text-2xl mb-1">🥉</div>
                              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {game.psnData.trophies.bronze}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Bronze</div>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 text-center">
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total: </span>
                          <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
                            {game.psnData.trophies.total}
                          </span>
                        </div>
                      </div>
                    )}

                    {game.psnData.lastPlayed && (
                      <div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Played</div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {new Date(game.psnData.lastPlayed).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nintendo Stats */}
              {game.nintendoData && (
                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.1c-.074 0-.15.074-.15.15v23.7c-.001.076.075.15.226.15zm4.574-13.199c1.351 0 2.399 1.125 2.399 2.398 0 1.352-1.125 2.4-2.399 2.4-1.35 0-2.4-1.049-2.4-2.4-.075-1.349 1.05-2.398 2.4-2.398zM11.4 0H6.15C2.775 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h5.25c.074 0 .15-.074.15-.149V.15c.001-.076-.075-.15-.15-.15zM9.676 22.051H6.15c-2.326 0-4.201-1.875-4.201-4.201V6.15c0-2.326 1.875-4.201 4.201-4.201H9.6l.076 20.102zM3.75 7.199c0 1.275.975 2.25 2.25 2.25s2.25-.975 2.25-2.25c0-1.273-.975-2.25-2.25-2.25s-2.25.977-2.25 2.25z"/>
                    </svg>
                    Nintendo Switch Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Playtime</div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                        {Math.floor(game.nintendoData.playtimeSeconds / 3600)}h
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {Math.floor(game.nintendoData.playtimeSeconds / 60)} minutes
                      </div>
                    </div>
                    {game.nintendoData.lastPlayed && (
                      <div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Last Played</div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {new Date(game.nintendoData.lastPlayed).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
