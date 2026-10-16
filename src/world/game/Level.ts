// A level is a self-contained space: the street, or one building interior.
// All levels share the physics world (interiors sit far apart), but only the
// active level's group is rendered and updated.

import type * as THREE from 'three';
import type { Interactable } from './Interaction';

export interface Spawn {
  position: THREE.Vector3;
  facing: number;
}

export interface Level {
  id: string;
  name: string;
  group: THREE.Group;
  interior: boolean;
  /** Song key from src/audio/songs.ts (home, movies, games, …) */
  music: string;
  ambience: 'street' | 'park' | 'interior' | 'gym' | 'arcade' | 'cafe';
  spawn: Spawn;
  interactables: Interactable[];
  /** Camera boom length in this space */
  boom?: number;
  /** Image-based light strength inside (interiors) */
  envIntensity?: number;
  /** Shadow frustum half-size around the player */
  shadowExtent?: number;
  update?(dt: number, time: number): void;
  onEnter?(): void;
  onExit?(): void;
  /** Minimap drawing hook (street only) */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
}
