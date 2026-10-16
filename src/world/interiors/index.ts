// All building interiors, each its own level (see Room.ts).

import type { Game } from '../game/Game';
import type { Level } from '../game/Level';
import { buildCinema } from './Cinema';
import { buildRecords } from './Records';
import { buildArcade } from './Arcade';
import { buildLibrary } from './Library';
import { buildAnimeCafe } from './AnimeCafe';
import { buildTvLounge } from './TvLounge';
import { buildStudio } from './Studio';
import { buildGym } from './Gym';

type Builder = (game: Game, index: number) => Level;

// Order fixes each interior's slot in space (INTERIOR_ORIGIN + i × spacing)
export const INTERIORS: Array<[string, Builder | null]> = [
  ['cinema', buildCinema],
  ['records', buildRecords],
  ['arcade', buildArcade],
  ['books', buildLibrary],
  ['anime', buildAnimeCafe],
  ['tv', buildTvLounge],
  ['climb', buildGym],
  ['studio', buildStudio],
];

export function buildInteriors(game: Game, extra: Partial<Record<string, Builder>> = {}): void {
  INTERIORS.forEach(([id, build], i) => {
    const b = build ?? extra[id];
    if (b) game.addLevel(b(game, i));
  });
}
