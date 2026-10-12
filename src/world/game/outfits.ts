// Player outfits. Classics are always available; the rest unlock as goal
// rewards (unlock = goal id, see Progress.ts).

import type { Look } from './Character';

export interface Outfit {
  id: string;
  name: string;
  /** swatch colours for the wardrobe UI */
  body: string;
  joints: string;
  look: Omit<Look, 'skin' | 'hair' | 'hairColor' | 'beard'>;
  unlock?: string;
}

const o = (id: string, name: string, top: Look['top'], topColor: string, bottom: Look['bottom'], bottomColor: string, shoeColor: string, unlock?: string): Outfit =>
  ({ id, name, body: topColor, joints: bottomColor, look: { top, topColor, bottom, bottomColor, shoeColor }, unlock });

export const OUTFITS: Outfit[] = [
  o('classic', 'Street', 'shirt_short', '#2f3542', 'pants', '#2b3a55', '#e9e6df'),
  o('chalk', 'Weekend', 'shirt_long', '#d9d3c7', 'pants', '#3c4a63', '#2a2a2a'),
  o('midnight', 'Night Out', 'jacket', '#1d2129', 'pants', '#202430', '#151515'),
  o('marquee', 'Marquee', 'jacket', '#7d1f24', 'pants', '#1f1f24', '#c9a24a', 'tour'),
  o('tabby', 'Tabby', 'shirt_long', '#c97a35', 'pants', '#4a3a2a', '#e9e6df', 'pets'),
  o('crimp', 'Crimp', 'shirt_short', '#2f6b4f', 'shorts', '#3a3f48', '#f3d34a', 'climb'),
  o('arcade', 'Arcade', 'jacket', '#2a1a4a', 'pants', '#16161e', '#ff4fd8', 'arcade'),
  o('gold', 'Golden Record', 'jacket', '#c9a24a', 'pants', '#1a1a1a', '#1a1a1a', 'records'),
];

export const outfitById = (id: string): Outfit => OUTFITS.find((x) => x.id === id) ?? OUTFITS[0];

/** The player's fixed features (outfits change clothes, not the person) */
export const PLAYER_LOOK = { skin: 'light' as const, hair: 'Hair_SimpleParted', hairColor: '#2a1f18', beard: false };
