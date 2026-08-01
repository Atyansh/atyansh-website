// Shared types for The Block (/world)

import type * as THREE from 'three';

export interface BuildingDef {
  id: string;
  /** Display name used on gray-box signage and door prompts */
  name: string;
  /** Site route this building deep-links to */
  route: string;
  /** Accent color used for signage/trim (hex) */
  accent: number;
  /** Footprint center in world XZ */
  x: number;
  z: number;
  /** Footprint size */
  w: number;
  d: number;
  /** Height of the shell */
  h: number;
  /** Which side the door faces: +z = toward south street, etc. */
  facing: 'n' | 's' | 'e' | 'w';
}

/** Axis-aligned collision rectangle on the ground plane */
export interface ColliderRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DoorTrigger {
  buildingId: string;
  name: string;
  route: string;
  /** Trigger center */
  x: number;
  z: number;
  radius: number;
}

export interface BlockGeometry {
  group: THREE.Group;
  colliders: ColliderRect[];
  doors: DoorTrigger[];
  /** Meshes the camera boom may not pass through */
  cameraBlockers: THREE.Object3D[];
}

export interface GroundSample {
  /** Ground height at a world XZ position (street vs sidewalk vs park) */
  y: number;
}
