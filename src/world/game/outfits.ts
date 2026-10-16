// Player looks. Rocketbox avatars have their clothes painted into their
// textures, so each look is its own avatar (characters/rb/<avatar>.glb).
// Classics are always available; the rest unlock as goal rewards
// (unlock = goal id, see Progress.ts).

export interface Outfit {
  id: string;
  name: string;
  avatar: string;
  /** swatch colours for the wardrobe UI: top, bottom, shoes */
  swatch: [string, string, string];
  unlock?: string;
}

export const OUTFITS: Outfit[] = [
  { id: 'classic', name: 'Street', avatar: 'p_hoodie', swatch: ['#2847c8', '#3c4f63', '#f2f2ee'] },
  { id: 'chalk', name: 'Weekend', avatar: 'p_tee', swatch: ['#4a6a9a', '#5a7390', '#2a2a2a'] },
  { id: 'midnight', name: 'Night Out', avatar: 'p_black', swatch: ['#1d1f22', '#4a6080', '#4a3020'] },
  { id: 'marquee', name: 'Marquee', avatar: 'p_jacket', swatch: ['#3a3d40', '#3c5070', '#6b4a32'], unlock: 'tour' },
  { id: 'tabby', name: 'Tabby', avatar: 'p_henley', swatch: ['#c0282a', '#2f4060', '#8a8f96'], unlock: 'pets' },
  { id: 'crimp', name: 'Crimp', avatar: 'p_track', swatch: ['#8a1f24', '#26282c', '#f2f2ee'], unlock: 'climb' },
  { id: 'arcade', name: 'Arcade', avatar: 'p_denim', swatch: ['#3a4a6a', '#6a85a8', '#f2f2ee'], unlock: 'arcade' },
  { id: 'gold', name: 'Golden Record', avatar: 'p_shirt', swatch: ['#9cc0e8', '#2a2f3a', '#1a1a1a'], unlock: 'records' },
];

export const outfitById = (id: string): Outfit => OUTFITS.find((x) => x.id === id) ?? OUTFITS[0];

/** Townspeople (characters/rb/<id>.glb); clip set chosen by the leading m/f */
export const NPC_AVATARS = {
  m: ['m01', 'm02', 'm03', 'm04', 'm05', 'm09', 'm13', 'm14', 'm18', 'm20'],
  f: ['f01', 'f02', 'f03', 'f04', 'f05', 'f07', 'f08', 'f09', 'f11', 'f12', 'f13', 'f14', 'f15', 'f17'],
};
