// Player outfits (mannequin body + joint colours). The classics are always
// available; the rest unlock as goal rewards (see Progress.ts).

export interface Outfit {
  id: string;
  name: string;
  body: string;
  joints: string;
  /** reward id that unlocks it; undefined = always available */
  unlock?: string;
}

export const OUTFITS: Outfit[] = [
  { id: 'classic', name: 'Street', body: '#3b4250', joints: '#ff9a3c' },
  { id: 'chalk', name: 'Chalk', body: '#e9e5dc', joints: '#2c3340' },
  { id: 'midnight', name: 'Midnight', body: '#1c2030', joints: '#4dc3ff' },
  { id: 'marquee', name: 'Marquee', body: '#7d1f24', joints: '#ffd27a', unlock: 'tour' },
  { id: 'tabby', name: 'Tabby', body: '#c97a35', joints: '#5a3a22', unlock: 'pets' },
  { id: 'crimp', name: 'Crimp', body: '#2f6b4f', joints: '#f3d34a', unlock: 'climb' },
  { id: 'arcade', name: 'Arcade', body: '#2a1a4a', joints: '#ff4fd8', unlock: 'arcade' },
  { id: 'gold', name: 'Golden Record', body: '#c9a24a', joints: '#1a1a1a', unlock: 'records' },
];

export const outfitById = (id: string): Outfit => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
