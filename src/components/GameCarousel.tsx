import { useCallback, useMemo, useRef, useState } from 'react';
import GameCard, { type GameCardData } from './GameCard';
import BaseCarousel from './BaseCarousel';
import ErrorBoundary from './ErrorBoundary';
import MediaViewer, { type ViewerItem } from './MediaViewer';

interface GameCarouselProps {
  games: GameCardData[];
  title: string;
}

function GameCarouselInner({ games, title }: GameCarouselProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const viewerItems: ViewerItem[] = useMemo(
    () =>
      games.map((game) => {
        const t = game.trophies;
        const trophies = t
          ? [t.platinum && `${t.platinum} platinum`, t.gold && `${t.gold} gold`, t.silver && `${t.silver} silver`, t.bronze && `${t.bronze} bronze`]
              .filter(Boolean)
              .join(', ')
          : '';
        return {
          image: game.image,
          title: game.name,
          subtitle: game.platformName,
          details: [...game.stats, ...(trophies ? [{ label: 'Trophies', value: trophies }] : [])],
        };
      }),
    [games],
  );
  const getOrigin = useCallback(
    (index: number) => listRef.current?.querySelector<HTMLElement>(`[data-viewer-index="${index}"] img`) ?? null,
    [],
  );

  return (
    <div ref={listRef}>
      <BaseCarousel itemCount={games.length} itemNoun="game" title={title} arrowZClass="z-40">
        {games.map((game, index) => (
          <div key={game.id} className="flex-shrink-0 w-56" data-viewer-index={index}>
            <GameCard game={game} onOpen={() => setViewerIndex(index)} />
          </div>
        ))}
      </BaseCarousel>
      {viewerIndex !== null && (
        <MediaViewer
          items={viewerItems}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          getOrigin={getOrigin}
          label="Game details"
        />
      )}
    </div>
  );
}

export default function GameCarousel(props: GameCarouselProps) {
  return <ErrorBoundary sectionName="Games"><GameCarouselInner {...props} /></ErrorBoundary>;
}
