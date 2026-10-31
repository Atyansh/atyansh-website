import { describe, it, expect } from 'vitest';
import { nintendoTitleIds } from '../exophase-scraper';

describe('nintendoTitleIds', () => {
  it('derives ids from game names, so they survive the list reordering', () => {
    expect(nintendoTitleIds(['The Legend of Zelda: Tears of the Kingdom', 'Pokémon Legends: Z-A'])).toEqual([
      'exophase-the-legend-of-zelda-tears-of-the-kingdom',
      'exophase-pokemon-legends-z-a',
    ]);
    expect(nintendoTitleIds(['New Game', 'Pokémon Legends: Z-A'])[1]).toBe('exophase-pokemon-legends-z-a');
  });

  it('keeps ids unique when names repeat or have no letters', () => {
    expect(nintendoTitleIds(['Tetris', 'Tetris', '!!!'])).toEqual(['exophase-tetris', 'exophase-tetris-2', 'exophase-game']);
  });
});
