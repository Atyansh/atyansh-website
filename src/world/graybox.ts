// Gray-box construction of The Block (M0)
//
// Everything here is placeholder massing — boxes, slabs, simple signage — but
// laid out at final positions with real colliders and door triggers, so the
// feel of walking the block is what ships in later milestones.

import * as THREE from 'three';
import type { BlockGeometry, BuildingDef, ColliderRect, DoorTrigger } from './types';
import {
  BLOCK, BUILDINGS, CURB_H, FILLER, KIOSK, LAMPS, OUTER_W, PARK,
  SIDEWALK_W, STREET_W, WORLD_EDGE,
} from './layout';

const DOOR_W = 2.6;
const DOOR_H = 3.2;

/** Canvas-texture nameplate used for gray-box signage */
function makeSignTexture(text: string, accent: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#101014';
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  g.fillText(text, 256, 68, 480);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function facingRotation(facing: BuildingDef['facing']): number {
  switch (facing) {
    case 's': return 0;
    case 'n': return Math.PI;
    case 'e': return -Math.PI / 2;
    case 'w': return Math.PI / 2;
  }
}

/** Door world position on the building's facing edge */
function doorPosition(b: BuildingDef): { x: number; z: number } {
  switch (b.facing) {
    case 's': return { x: b.x, z: b.z + b.d / 2 };
    case 'n': return { x: b.x, z: b.z - b.d / 2 };
    case 'e': return { x: b.x + b.w / 2, z: b.z };
    case 'w': return { x: b.x - b.w / 2, z: b.z };
  }
}

export function buildBlock(): BlockGeometry {
  const group = new THREE.Group();
  const colliders: ColliderRect[] = [];
  const doors: DoorTrigger[] = [];
  const cameraBlockers: THREE.Object3D[] = [];

  const concrete = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.95 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.85, metalness: 0.05 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x4a4d55, roughness: 0.9 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x2a3b2e, roughness: 1.0 });

  // ---- Ground: street ring ----
  const streetOuterW = WORLD_EDGE.maxX - WORLD_EDGE.minX;
  const streetOuterD = WORLD_EDGE.maxZ - WORLD_EDGE.minZ;
  const street = new THREE.Mesh(new THREE.PlaneGeometry(streetOuterW, streetOuterD), asphalt);
  street.rotation.x = -Math.PI / 2;
  street.position.y = 0;
  street.receiveShadow = true;
  group.add(street);

  // ---- Ground: raised sidewalk ring + block plinth (one slab) ----
  const plinthW = BLOCK.maxX - BLOCK.minX + SIDEWALK_W * 2;
  const plinthD = BLOCK.maxZ - BLOCK.minZ + SIDEWALK_W * 2;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(plinthW, CURB_H, plinthD), curb);
  plinth.position.set(
    (BLOCK.minX + BLOCK.maxX) / 2,
    CURB_H / 2,
    (BLOCK.minZ + BLOCK.maxZ) / 2,
  );
  plinth.receiveShadow = true;
  group.add(plinth);

  // Outer sidewalks (four strips at the world edge)
  const outerStrips: Array<[number, number, number, number]> = [
    [WORLD_EDGE.minX, WORLD_EDGE.maxX, WORLD_EDGE.minZ, WORLD_EDGE.minZ + OUTER_W],
    [WORLD_EDGE.minX, WORLD_EDGE.maxX, WORLD_EDGE.maxZ - OUTER_W, WORLD_EDGE.maxZ],
    [WORLD_EDGE.minX, WORLD_EDGE.minX + OUTER_W, WORLD_EDGE.minZ, WORLD_EDGE.maxZ],
    [WORLD_EDGE.maxX - OUTER_W, WORLD_EDGE.maxX, WORLD_EDGE.minZ, WORLD_EDGE.maxZ],
  ];
  for (const [x0, x1, z0, z1] of outerStrips) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, CURB_H, z1 - z0), curb);
    m.position.set((x0 + x1) / 2, CURB_H / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---- Park (green surface patch on the plinth, NE corner) ----
  const park = new THREE.Mesh(
    new THREE.BoxGeometry(PARK.maxX - PARK.minX, 0.04, PARK.maxZ - PARK.minZ),
    grass,
  );
  park.position.set((PARK.minX + PARK.maxX) / 2, CURB_H + 0.02, (PARK.minZ + PARK.maxZ) / 2);
  park.receiveShadow = true;
  group.add(park);

  // Park trees (placeholder cones)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x27452c, roughness: 1 });
  const treeSpots = [
    { x: 29, z: -13 }, { x: 36, z: -25 }, { x: 42, z: -12 }, { x: 33, z: -19 },
  ];
  for (const t of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8), trunkMat);
    trunk.position.set(t.x, CURB_H + 1.2, t.z);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), leafMat);
    crown.position.set(t.x, CURB_H + 2.4 + 2.2, t.z);
    crown.castShadow = true;
    group.add(trunk, crown);
    colliders.push({ minX: t.x - 0.4, maxX: t.x + 0.4, minZ: t.z - 0.4, maxZ: t.z + 0.4 });
  }
  // Park bench-height fence along its inner edges (visual only, low)
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.8 });
  const fenceS = new THREE.Mesh(
    new THREE.BoxGeometry(PARK.maxX - PARK.minX, 0.9, 0.15), fenceMat);
  fenceS.position.set((PARK.minX + PARK.maxX) / 2, CURB_H + 0.45, PARK.maxZ);
  group.add(fenceS);
  colliders.push({ minX: PARK.minX, maxX: PARK.maxX, minZ: PARK.maxZ - 0.1, maxZ: PARK.maxZ + 0.1 });
  const fenceW = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.9, PARK.maxZ - PARK.minZ), fenceMat);
  fenceW.position.set(PARK.minX, CURB_H + 0.45, (PARK.minZ + PARK.maxZ) / 2);
  group.add(fenceW);
  colliders.push({ minX: PARK.minX - 0.1, maxX: PARK.minX + 0.1, minZ: PARK.minZ, maxZ: PARK.maxZ });

  // ---- Buildings ----
  const shellMats = new Map<string, THREE.MeshStandardMaterial>();
  for (const b of BUILDINGS) {
    // Slightly tinted shell so gray-box buildings are tellable-apart
    const base = new THREE.Color(0x565a63);
    base.lerp(new THREE.Color(b.accent), 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9 });
    shellMats.set(b.id, mat);

    const shell = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    shell.position.set(b.x, CURB_H + b.h / 2, b.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    cameraBlockers.push(shell);
    colliders.push({
      minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
    });

    const rot = facingRotation(b.facing);
    const door = doorPosition(b);

    // Door recess (dark inset panel flush with the facade)
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.6 }),
    );
    recess.position.set(door.x, CURB_H + DOOR_H / 2, door.z);
    recess.rotation.y = rot;
    // Nudge outward so it sits proud of the facade
    const out = outwardOffset(b.facing, 0.02);
    recess.position.x += out.x;
    recess.position.z += out.z;
    group.add(recess);

    // Signage bar above the door with emissive accent + name
    const signTex = makeSignTexture(b.name, b.accent);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(b.w * 0.7, 9), 1.4, 0.35),
      [
        new THREE.MeshStandardMaterial({ color: 0x14151a }),
        new THREE.MeshStandardMaterial({ color: 0x14151a }),
        new THREE.MeshStandardMaterial({ color: 0x14151a }),
        new THREE.MeshStandardMaterial({ color: 0x14151a }),
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: 0xffffff,
          emissiveMap: signTex,
          emissiveIntensity: 3.4,
        }),
        new THREE.MeshStandardMaterial({ color: 0x14151a }),
      ],
    );
    sign.position.set(door.x + out.x * 20, CURB_H + DOOR_H + 1.6, door.z + out.z * 20);
    sign.rotation.y = rot;
    group.add(sign);

    // Accent strip under the sign (small emissive line, hints at future neon)
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(b.w * 0.85, 11), 0.12, 0.1),
      new THREE.MeshStandardMaterial({
        color: b.accent, emissive: b.accent, emissiveIntensity: 5.0,
      }),
    );
    strip.position.set(door.x + out.x * 15, CURB_H + DOOR_H + 0.7, door.z + out.z * 15);
    strip.rotation.y = rot;
    group.add(strip);

    doors.push({
      buildingId: b.id, name: b.name, route: b.route,
      x: door.x + out.x * 60, z: door.z + out.z * 60, radius: 2.4,
    });
  }

  // ---- Block-interior filler mass ----
  const fillerMat = new THREE.MeshStandardMaterial({ color: 0x2d3038, roughness: 0.95 });
  for (const f of FILLER) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), fillerMat);
    m.position.set(f.x, CURB_H + f.h / 2, f.z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    cameraBlockers.push(m);
    colliders.push({
      minX: f.x - f.w / 2, maxX: f.x + f.w / 2,
      minZ: f.z - f.d / 2, maxZ: f.z + f.d / 2,
    });
  }

  // ---- Newsstand kiosk ----
  {
    const k = KIOSK;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3c414c, roughness: 0.85 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(k.w, k.h, k.d), mat);
    m.position.set(k.x, CURB_H + k.h / 2, k.z);
    m.castShadow = true;
    group.add(m);
    cameraBlockers.push(m);
    colliders.push({
      minX: k.x - k.w / 2, maxX: k.x + k.w / 2,
      minZ: k.z - k.d / 2, maxZ: k.z + k.d / 2,
    });
    const signTex = makeSignTexture(k.name, 0xffffff);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.7),
      new THREE.MeshStandardMaterial({
        map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.4,
      }),
    );
    sign.position.set(k.x - k.w / 2 - 0.01, CURB_H + k.h - 0.5, k.z);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);
    doors.push({
      buildingId: k.id, name: k.name, route: k.route,
      x: k.x - k.w / 2 - 1.2, z: k.z, radius: 1.8,
    });
  }

  // ---- Streetlights ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffc26e, emissiveIntensity: 6.0,
  });
  LAMPS.forEach((l, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 8), poleMat);
    pole.position.set(l.x, 2.7, l.z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), headMat);
    head.position.set(l.x, 5.5, l.z);
    group.add(head);
    const light = new THREE.PointLight(0xffc27a, 320, 34, 2.0);
    light.position.set(l.x, 5.4, l.z);
    // Two shadow-casting lamps near the main corner keep the budget sane in M0
    if (i === 1 || i === 4) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
    }
    group.add(light);
    colliders.push({ minX: l.x - 0.18, maxX: l.x + 0.18, minZ: l.z - 0.18, maxZ: l.z + 0.18 });
  });

  // ---- World edge fence colliders (invisible) ----
  colliders.push(
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.minZ },
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.maxZ, maxZ: WORLD_EDGE.maxZ + 1 },
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.minX, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.maxZ + 1 },
    { minX: WORLD_EDGE.maxX, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.maxZ + 1 },
  );

  return { group, colliders, doors, cameraBlockers };
}

function outwardOffset(facing: BuildingDef['facing'], amount: number): { x: number; z: number } {
  switch (facing) {
    case 's': return { x: 0, z: amount };
    case 'n': return { x: 0, z: -amount };
    case 'e': return { x: amount, z: 0 };
    case 'w': return { x: -amount, z: 0 };
  }
}

/** Ground height at a world position: curb-height on the plinth/outer walks, 0 on the street */
export function sampleGroundY(x: number, z: number): number {
  const onPlinth =
    x >= BLOCK.minX - SIDEWALK_W && x <= BLOCK.maxX + SIDEWALK_W &&
    z >= BLOCK.minZ - SIDEWALK_W && z <= BLOCK.maxZ + SIDEWALK_W;
  if (onPlinth) return CURB_H;
  const onOuter =
    x <= WORLD_EDGE.minX + OUTER_W || x >= WORLD_EDGE.maxX - OUTER_W ||
    z <= WORLD_EDGE.minZ + OUTER_W || z >= WORLD_EDGE.maxZ - OUTER_W;
  if (onOuter) return CURB_H;
  return 0;
}
