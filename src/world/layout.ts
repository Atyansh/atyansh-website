// The Block — spatial plan (M0 gray-box)
//
// World units are meters, +X east, +Z south. The building mass sits in the
// middle; a perimeter sidewalk, then the street, then an outer sidewalk with
// the world fence. A north-south alley cuts the block between the cinema and
// the record shop. The NE corner of the block is the pocket park.

import type { BuildingDef } from './types';

// Block mass extents (buildings live inside this)
export const BLOCK = { minX: -45, maxX: 45, minZ: -30, maxZ: 30 };
// Sidewalk ring around the block
export const SIDEWALK_W = 4.5;
// Street ring beyond the sidewalk
export const STREET_W = 11;
// Outer sidewalk (world edge)
export const OUTER_W = 3.5;

export const WORLD_EDGE = {
  minX: BLOCK.minX - SIDEWALK_W - STREET_W - OUTER_W,
  maxX: BLOCK.maxX + SIDEWALK_W + STREET_W + OUTER_W,
  minZ: BLOCK.minZ - SIDEWALK_W - STREET_W - OUTER_W,
  maxZ: BLOCK.maxZ + SIDEWALK_W + STREET_W + OUTER_W,
};

export const CURB_H = 0.15;

// The alley gap (north-south cut through the block)
export const ALLEY = { minX: -1, maxX: 5 };

// The pocket park (NE corner of the block, open to north and east sidewalks)
export const PARK = { minX: 24, maxX: 45, minZ: -30, maxZ: -8 };

// Enterable buildings. Doors face outward to the perimeter sidewalk.
export const BUILDINGS: BuildingDef[] = [
  // --- South face (fronts at z = BLOCK.maxZ) ---
  { id: 'cinema', name: 'CINEMA', route: '/movies', accent: 0xe8443a,
    x: -11, z: 21, w: 20, d: 18, h: 15, facing: 's' },
  { id: 'records', name: 'RECORDS', route: '/music', accent: 0x36c98e,
    x: 11, z: 23, w: 12, d: 14, h: 10, facing: 's' },
  { id: 'arcade', name: 'ARCADE', route: '/games', accent: 0xb44df0,
    x: 25, z: 22, w: 14, d: 16, h: 11, facing: 's' },
  { id: 'anime', name: 'ANIME CAFÉ', route: '/anime', accent: 0xff7ab8,
    x: 38, z: 23.5, w: 11, d: 13, h: 9, facing: 's' },

  // --- North face (fronts at z = BLOCK.minZ) ---
  { id: 'climb', name: 'CLIMBING GYM', route: '/climbing', accent: 0xffa53a,
    x: -34, z: -19, w: 20, d: 22, h: 17, facing: 'n' },
  { id: 'tv', name: 'TV LOUNGE', route: '/tv', accent: 0x4db8f0,
    x: -16, z: -23, w: 13, d: 14, h: 9, facing: 'n' },
  { id: 'books', name: 'BOOKS', route: '/books', accent: 0xd9b04a,
    x: 12, z: -23, w: 13, d: 14, h: 10, facing: 'n' },

  // --- West face (fronts at x = BLOCK.minX) ---
  { id: 'studio', name: 'STUDIO', route: '/work', accent: 0x9fb6ff,
    x: -37, z: 6, w: 16, d: 20, h: 19, facing: 'w' },
];

// Non-enterable background mass filling the block interior (skyline depth)
export const FILLER: Array<{ x: number; z: number; w: number; d: number; h: number }> = [
  { x: -18, z: -2, w: 26, d: 22, h: 24 },
  { x: 14, z: 2, w: 18, d: 18, h: 20 },
  { x: 30, z: 12, w: 14, d: 12, h: 14 },
];

// The newsstand kiosk (small freestanding structure on the SE outer sidewalk)
export const KIOSK = {
  id: 'news', name: 'NEWS', route: '/blog', accent: 0xdddddd,
  x: BLOCK.maxX + SIDEWALK_W + STREET_W + 1.8,
  z: 18,
  w: 3.4, d: 3.0, h: 3.2,
};

// Streetlight positions (perimeter, staggered)
export const LAMPS: Array<{ x: number; z: number }> = [
  { x: -30, z: 38 }, { x: 0, z: 38 }, { x: 30, z: 38 },
  { x: -30, z: -38 }, { x: 0, z: -38 }, { x: 30, z: -38 },
  { x: -53, z: 15 }, { x: -53, z: -15 },
  { x: 53, z: 15 }, { x: 53, z: -15 },
];
