// The Block — city plan (metres; +X east, +Z south, y up).
//
//   outer ring of buildings ─ outer sidewalk ─ road ─ sidewalk ─ THE BLOCK
//
// The block (90×60) is split by a north–south alley. Enterable buildings
// open into interior levels; everything else is a non-enterable neighbour
// with its own ground-floor business. The four streets are canyons lined
// with buildings on both sides; their exits are barricaded.

export type Facing = 's' | 'n' | 'e' | 'w';
export type StyleId =
  | 'brickTan' | 'brickRed' | 'brickDark' | 'plasterCream' | 'plasterSage' | 'plasterPink' | 'plasterBlue'
  | 'plasterDark' | 'stucco' | 'modern' | 'industrial' | 'artdeco' | 'concrete';
export type GroundType = 'store' | 'shutter' | 'cafe' | 'lobby' | 'gym' | 'cinema' | 'blank';

export interface Lot {
  id: string;
  /** Display name (signs, minimap) */
  name: string;
  x: number;
  z: number;
  /** facade length (along the front) */
  w: number;
  /** depth (front to back) */
  d: number;
  h: number;
  facing: Facing;
  style: StyleId;
  ground: GroundType;
  /** Interior level this building's door opens */
  enter?: string;
  sign?: string;
  /** accent colour for signage / awnings */
  accent: number;
  awning?: boolean;
  /** also dress the side facing this direction (corner buildings) */
  corner?: Facing;
  /** low-detail backdrop massing (block interior, distant) */
  backdrop?: boolean;
}

export const BLOCK = { minX: -45, maxX: 45, minZ: -30, maxZ: 30 };
export const SIDEWALK = 4.5;
export const ROAD = 11;
export const OUTER_WALK = 3.5;
export const CURB_H = 0.15;
export const ALLEY = { minX: -1, maxX: 5 };
export const PARK = { minX: 19, maxX: 45, minZ: -30, maxZ: -6 };

/** Curb lines (block side) and outer building fronts */
export const CURB = { x: BLOCK.maxX + SIDEWALK, z: BLOCK.maxZ + SIDEWALK };
export const ROAD_OUT = { x: CURB.x + ROAD, z: CURB.z + ROAD };
export const OUTER_FRONT = { x: ROAD_OUT.x + OUTER_WALK, z: ROAD_OUT.z + OUTER_WALK };

export const STREET_NAMES = { s: 'Atyansh Ave', n: 'Commit St', w: 'Deploy Blvd', e: 'Merge Way' };

const S = (id: string, name: string, x0: number, x1: number, d: number, h: number, style: StyleId, ground: GroundType, accent: number, extra: Partial<Lot> = {}): Lot =>
  ({ id, name, x: (x0 + x1) / 2, z: BLOCK.maxZ - d / 2, w: x1 - x0, d, h, facing: 's', style, ground, accent, ...extra });
const N = (id: string, name: string, x0: number, x1: number, d: number, h: number, style: StyleId, ground: GroundType, accent: number, extra: Partial<Lot> = {}): Lot =>
  ({ id, name, x: (x0 + x1) / 2, z: BLOCK.minZ + d / 2, w: x1 - x0, d, h, facing: 'n', style, ground, accent, ...extra });
const W = (id: string, name: string, z0: number, z1: number, d: number, h: number, style: StyleId, ground: GroundType, accent: number, extra: Partial<Lot> = {}): Lot =>
  ({ id, name, x: BLOCK.minX + d / 2, z: (z0 + z1) / 2, w: z1 - z0, d, h, facing: 'w', style, ground, accent, ...extra });
const E = (id: string, name: string, z0: number, z1: number, d: number, h: number, style: StyleId, ground: GroundType, accent: number, extra: Partial<Lot> = {}): Lot =>
  ({ id, name, x: BLOCK.maxX - d / 2, z: (z0 + z1) / 2, w: z1 - z0, d, h, facing: 'e', style, ground, accent, ...extra });

export const LOTS: Lot[] = [
  // ---- The block: south face (Atyansh Ave) ----
  S('studio', 'Studio', -45, -31, 18, 22, 'modern', 'lobby', 0x9fb6ff, { enter: 'studio', sign: 'STUDIO', corner: 'w' }),
  S('cinema', 'Cinema', -31, -9, 18, 14, 'artdeco', 'cinema', 0xe8443a, { enter: 'cinema', sign: 'CINEMA' }),
  S('deli', 'Deli', -9, -1, 14, 10, 'brickRed', 'shutter', 0x2f8f5b, { sign: 'DELI', awning: true }),
  S('records', 'Records', 5, 17, 14, 11, 'brickTan', 'store', 0x36c98e, { enter: 'records', sign: 'RECORDS', awning: true }),
  S('arcade', 'Arcade', 17, 31, 16, 11, 'plasterDark', 'store', 0xb44df0, { enter: 'arcade', sign: 'ARCADE' }),
  S('anime', 'Anime Café', 31, 45, 13, 9, 'plasterPink', 'cafe', 0xff7ab8, { enter: 'anime', sign: 'ANIME CAFÉ', awning: true, corner: 'e' }),
  // ---- north face (Commit St) ----
  N('climb', 'Climbing Gym', -45, -25, 22, 16, 'industrial', 'gym', 0xffa53a, { enter: 'climb', sign: 'CLIMBING GYM', corner: 'w' }),
  N('tv', 'TV Lounge', -25, -12, 14, 12, 'brickDark', 'store', 0x4db8f0, { enter: 'tv', sign: 'TV LOUNGE', awning: true }),
  N('laundry', 'Laundromat', -12, -1, 14, 17, 'plasterCream', 'store', 0x5aa7d6, { sign: 'LAUNDROMAT' }),
  N('books', 'Library', 5, 19, 14, 12, 'brickRed', 'store', 0xd9b04a, { enter: 'books', sign: 'BOOKS', awning: true, corner: 'e' }),
  // ---- west face (Deploy Blvd) ----
  W('florist', 'Florist', -8, 12, 20, 20, 'plasterSage', 'store', 0x6fbf73, { sign: 'FLORIST', awning: true }),
  // ---- east face (Merge Way) ----
  E('coffee', 'Coffee', -6, 17, 14, 18, 'brickTan', 'cafe', 0xc98a4b, { sign: 'COFFEE', awning: true }),

  // ---- block interior backdrop massing ----
  { id: 'bw', name: '', x: -13, z: -2, w: 24, d: 28, h: 24, facing: 's', style: 'brickTan', ground: 'blank', accent: 0, backdrop: true },
  { id: 'be1', name: '', x: 12, z: 0, w: 14, d: 32, h: 20, facing: 's', style: 'plasterCream', ground: 'blank', accent: 0, backdrop: true },
  { id: 'be2', name: '', x: 25, z: 4, w: 12, d: 20, h: 15, facing: 's', style: 'brickRed', ground: 'blank', accent: 0, backdrop: true },
];

// ---- Outer ring: neighbours across each street, facing the block ----
const OS = (id: string, x0: number, x1: number, h: number, style: StyleId, ground: GroundType, accent: number, sign?: string): Lot =>
  ({ id, name: sign ?? '', x: (x0 + x1) / 2, z: OUTER_FRONT.z + 8, w: x1 - x0, d: 16, h, facing: 'n', style, ground, accent, sign, awning: ground === 'cafe' || ground === 'store' });
const ON = (id: string, x0: number, x1: number, h: number, style: StyleId, ground: GroundType, accent: number, sign?: string): Lot =>
  ({ id, name: sign ?? '', x: (x0 + x1) / 2, z: -OUTER_FRONT.z - 8, w: x1 - x0, d: 16, h, facing: 's', style, ground, accent, sign, awning: ground === 'cafe' || ground === 'store' });
const OW = (id: string, z0: number, z1: number, h: number, style: StyleId, ground: GroundType, accent: number, sign?: string): Lot =>
  ({ id, name: sign ?? '', x: -OUTER_FRONT.x - 8, z: (z0 + z1) / 2, w: z1 - z0, d: 16, h, facing: 'e', style, ground, accent, sign, awning: ground === 'cafe' || ground === 'store' });
const OE = (id: string, z0: number, z1: number, h: number, style: StyleId, ground: GroundType, accent: number, sign?: string): Lot =>
  ({ id, name: sign ?? '', x: OUTER_FRONT.x + 8, z: (z0 + z1) / 2, w: z1 - z0, d: 16, h, facing: 'w', style, ground, accent, sign, awning: ground === 'cafe' || ground === 'store' });

const XW = CURB.x;
const ZW = CURB.z;
export const OUTER_LOTS: Lot[] = [
  OS('os1', -XW, -33, 14, 'brickRed', 'store', 0xe0b040, 'BODEGA'),
  OS('os2', -33, -15, 24, 'plasterCream', 'shutter', 0x888888),
  OS('os3', -15, 3, 32, 'artdeco', 'lobby', 0xc9a24a, 'HOTEL'),
  OS('os4', 3, 19, 18, 'brickTan', 'cafe', 0x8f5e3a, 'BAKERY'),
  OS('os5', 19, 35, 28, 'concrete', 'lobby', 0x6b7d99),
  OS('os6', 35, XW, 12, 'plasterBlue', 'store', 0x3a8fd6, 'PHARMACY'),
  ON('on1', -XW, -30, 20, 'brickDark', 'shutter', 0x777777),
  ON('on2', -30, -12, 15, 'plasterSage', 'cafe', 0x6fbf73, 'NOODLES'),
  ON('on3', -12, 6, 26, 'brickTan', 'store', 0xd65a3a, 'HARDWARE'),
  ON('on4', 6, 24, 34, 'modern', 'lobby', 0x9fb6ff),
  ON('on5', 24, 38, 16, 'brickRed', 'store', 0xff9f3a, 'PIZZA'),
  ON('on6', 38, XW, 22, 'plasterCream', 'shutter', 0x888888),
  OW('ow1', -ZW, -14, 18, 'plasterPink', 'store', 0xff7ab8, 'BOUTIQUE'),
  OW('ow2', -14, 8, 30, 'brickDark', 'lobby', 0x777777),
  OW('ow3', 8, ZW, 16, 'brickTan', 'cafe', 0xc98a4b, 'DINER'),
  OE('oe1', -ZW, -10, 22, 'concrete', 'shutter', 0x888888),
  OE('oe2', -10, 12, 14, 'plasterBlue', 'store', 0x4db8f0, 'BIKES'),
  OE('oe3', 12, ZW, 26, 'brickRed', 'lobby', 0x777777),
];

/** Corner blocks diagonal to the intersections (massing only) */
export const CORNER_BLOCKS = [
  { x: -(OUTER_FRONT.x + 12), z: -(OUTER_FRONT.z + 12), h: 38 },
  { x: OUTER_FRONT.x + 12, z: -(OUTER_FRONT.z + 12), h: 30 },
  { x: -(OUTER_FRONT.x + 12), z: OUTER_FRONT.z + 12, h: 26 },
  { x: OUTER_FRONT.x + 12, z: OUTER_FRONT.z + 12, h: 44 },
];

export function facingRotation(f: Facing): number {
  return f === 's' ? 0 : f === 'n' ? Math.PI : f === 'e' ? Math.PI / 2 : -Math.PI / 2;
}

/** World-space outward unit vector of a facing */
export function facingVector(f: Facing): { x: number; z: number } {
  return f === 's' ? { x: 0, z: 1 } : f === 'n' ? { x: 0, z: -1 } : f === 'e' ? { x: 1, z: 0 } : { x: -1, z: 0 };
}
