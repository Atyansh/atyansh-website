// Block construction for The Block (M1: textured facades over the M0 massing)
//
// Layout positions, colliders and door triggers are final; visuals are the
// M1 art pass: procedural ground textures, storefront ground floors with
// reflective glass, window-grid upper facades, awnings, parapets, and the
// cinema marquee. Interiors arrive in M2.

import * as THREE from 'three';
import type { ArtItem, BlockGeometry, BuildingDef, ColliderRect, DoorTrigger, WorldData } from './types';
import {
  BLOCK, BUILDINGS, CURB_H, FILLER, KIOSK, LAMPS, OUTER_W, PARK,
  SIDEWALK_W, WORLD_EDGE,
} from './layout';
import {
  asphaltTexture, awningTexture, grassTexture, sidewalkTexture, windowsTexture,
} from './textures';

const DOOR_W = 2.6;
const DOOR_H = 3.2;
const GF_H = 4.4;          // storefront ground-floor height
const FLOOR_H = 3.2;       // upper floor height (window tile)
const BAY_W = 4.0;         // window bay width (window tile)

/** Canvas-texture nameplate used for signage */
function makeSignTexture(text: string, accent: number, wide = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = wide ? 1024 : 512;
  canvas.height = 160;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#15161a';
  g.fillRect(0, 0, canvas.width, 160);
  g.font = `bold ${wide ? 110 : 76}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  g.fillText(text, canvas.width / 2, 84, canvas.width - 40);
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

function doorPosition(b: BuildingDef): { x: number; z: number } {
  switch (b.facing) {
    case 's': return { x: b.x, z: b.z + b.d / 2 };
    case 'n': return { x: b.x, z: b.z - b.d / 2 };
    case 'e': return { x: b.x + b.w / 2, z: b.z };
    case 'w': return { x: b.x - b.w / 2, z: b.z };
  }
}

function outwardOffset(facing: BuildingDef['facing'], amount: number): { x: number; z: number } {
  switch (facing) {
    case 's': return { x: 0, z: amount };
    case 'n': return { x: 0, z: -amount };
    case 'e': return { x: amount, z: 0 };
    case 'w': return { x: -amount, z: 0 };
  }
}

const artLoader = new THREE.TextureLoader();

function interiorFloorColor(id: string): number {
  switch (id) {
    case 'cinema': return 0x5a2e31;
    case 'records': return 0x74604a;
    case 'arcade': return 0x232530;
    case 'books': return 0x7a6448;
    case 'anime': return 0x8a6a72;
    case 'tv': return 0x4a4e58;
    case 'climb': return 0x39508c;
    default: return 0x9a938a;
  }
}

/** A row of real art (posters/covers) mounted in a storefront window,
    laid along the facade and skipping the door bay. */
function addArtRow(
  group: THREE.Group,
  items: ArtItem[],
  door: { x: number; z: number },
  rot: number,
  out: { x: number; z: number },
  opts: { y: number; w: number; h: number; gap: number; maxAlong: number },
): void {
  const slots: number[] = [];
  const step = opts.w + opts.gap;
  for (let a = step / 2; a <= opts.maxAlong; a += step) {
    slots.push(a, -a);
  }
  slots.sort((p, q) => Math.abs(p) - Math.abs(q));
  const doorHalf = DOOR_W / 2 + 0.55 + opts.w / 2;
  const usable = slots.filter((a) => Math.abs(a) > doorHalf);
  for (let i = 0; i < Math.min(items.length, usable.length); i++) {
    const tex = artLoader.load(items[i].art);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.w, opts.h),
      new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.7,
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5,
      }),
    );
    const along = usable[i];
    m.position.set(
      door.x + out.x + Math.cos(rot) * along,
      opts.y,
      door.z + out.z - Math.sin(rot) * along,
    );
    m.rotation.y = rot;
    group.add(m);
  }
}

export function buildBlock(glassEnv?: THREE.Texture, data?: WorldData): BlockGeometry {
  const group = new THREE.Group();
  const colliders: ColliderRect[] = [];
  const doors: DoorTrigger[] = [];
  const cameraBlockers: THREE.Object3D[] = [];

  // ---- Ground: street ring with asphalt texture ----
  const streetW = WORLD_EDGE.maxX - WORLD_EDGE.minX;
  const streetD = WORLD_EDGE.maxZ - WORLD_EDGE.minZ;
  const asphalt = new THREE.MeshStandardMaterial({
    map: asphaltTexture(streetW / 6, streetD / 6), roughness: 0.94,
  });
  const street = new THREE.Mesh(new THREE.PlaneGeometry(streetW, streetD), asphalt);
  street.rotation.x = -Math.PI / 2;
  street.receiveShadow = true;
  group.add(street);

  // Lane markings: dashed center line around the ring
  {
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d5c3, roughness: 0.8 });
    const dashes = new THREE.Group();
    const midS = (BLOCK.maxZ + SIDEWALK_W + WORLD_EDGE.maxZ - OUTER_W) / 2;
    const midN = -midS;
    const midE = (BLOCK.maxX + SIDEWALK_W + WORLD_EDGE.maxX - OUTER_W) / 2;
    const midW = -midE;
    const geoH = new THREE.BoxGeometry(2.4, 0.02, 0.2);
    const geoV = new THREE.BoxGeometry(0.2, 0.02, 2.4);
    for (let x = -44; x <= 44; x += 5) {
      const d1 = new THREE.Mesh(geoH, dashMat);
      d1.position.set(x, 0.011, midS);
      const d2 = new THREE.Mesh(geoH, dashMat);
      d2.position.set(x, 0.011, midN);
      dashes.add(d1, d2);
    }
    for (let z = -29; z <= 29; z += 5) {
      const d1 = new THREE.Mesh(geoV, dashMat);
      d1.position.set(midE, 0.011, z);
      const d2 = new THREE.Mesh(geoV, dashMat);
      d2.position.set(midW, 0.011, z);
      dashes.add(d1, d2);
    }
    group.add(dashes);
  }

  // ---- Sidewalks: block plinth + outer strips, textured tops ----
  const curbSide = new THREE.MeshStandardMaterial({ color: 0x8f9196, roughness: 0.92 });
  const addWalk = (x0: number, x1: number, z0: number, z1: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const top = new THREE.MeshStandardMaterial({
      map: sidewalkTexture(w / 4, d / 4), roughness: 0.95,
    });
    const mats = [curbSide, curbSide, top, curbSide, curbSide, curbSide];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, CURB_H, d), mats);
    m.position.set((x0 + x1) / 2, CURB_H / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  addWalk(BLOCK.minX - SIDEWALK_W, BLOCK.maxX + SIDEWALK_W,
    BLOCK.minZ - SIDEWALK_W, BLOCK.maxZ + SIDEWALK_W);
  addWalk(WORLD_EDGE.minX, WORLD_EDGE.maxX, WORLD_EDGE.minZ, WORLD_EDGE.minZ + OUTER_W);
  addWalk(WORLD_EDGE.minX, WORLD_EDGE.maxX, WORLD_EDGE.maxZ - OUTER_W, WORLD_EDGE.maxZ);
  addWalk(WORLD_EDGE.minX, WORLD_EDGE.minX + OUTER_W, WORLD_EDGE.minZ, WORLD_EDGE.maxZ);
  addWalk(WORLD_EDGE.maxX - OUTER_W, WORLD_EDGE.maxX, WORLD_EDGE.minZ, WORLD_EDGE.maxZ);

  // ---- Park ----
  {
    const parkW = PARK.maxX - PARK.minX;
    const parkD = PARK.maxZ - PARK.minZ;
    const park = new THREE.Mesh(
      new THREE.BoxGeometry(parkW, 0.04, parkD),
      new THREE.MeshStandardMaterial({ map: grassTexture(parkW / 6, parkD / 6), roughness: 1 }),
    );
    park.position.set((PARK.minX + PARK.maxX) / 2, CURB_H + 0.02, (PARK.minZ + PARK.maxZ) / 2);
    park.receiveShadow = true;
    group.add(park);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5236, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3d, roughness: 1 });
    for (const t of [
      { x: 29, z: -13 }, { x: 36, z: -25 }, { x: 42, z: -12 }, { x: 33, z: -19 },
    ]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8), trunkMat);
      trunk.position.set(t.x, CURB_H + 1.2, t.z);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 8), leafMat);
      crown.position.set(t.x, CURB_H + 4.6, t.z);
      crown.castShadow = true;
      group.add(trunk, crown);
      colliders.push({ minX: t.x - 0.4, maxX: t.x + 0.4, minZ: t.z - 0.4, maxZ: t.z + 0.4 });
    }
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.7, metalness: 0.5 });
    const fenceS = new THREE.Mesh(new THREE.BoxGeometry(parkW, 0.62, 0.15), fenceMat);
    fenceS.position.set((PARK.minX + PARK.maxX) / 2, CURB_H + 0.31, PARK.maxZ);
    group.add(fenceS);
    colliders.push({ minX: PARK.minX, maxX: PARK.maxX, minZ: PARK.maxZ - 0.1, maxZ: PARK.maxZ + 0.1, top: CURB_H + 0.66 });
    const fenceW = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, parkD), fenceMat);
    fenceW.position.set(PARK.minX, CURB_H + 0.31, (PARK.minZ + PARK.maxZ) / 2);
    group.add(fenceW);
    colliders.push({ minX: PARK.minX - 0.1, maxX: PARK.minX + 0.1, minZ: PARK.minZ, maxZ: PARK.maxZ, top: CURB_H + 0.66 });
  }

  // ---- Shared building materials ----
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.55, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x86a7bb, metalness: 0.6, roughness: 0.2,
    envMap: glassEnv ?? null, envMapIntensity: 0.25,
    transparent: true, opacity: 0.18, depthWrite: false,
  });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xcfd0d3, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x606268, roughness: 0.95 });
  const AWNINGS = new Set(['records', 'books', 'anime', 'tv']);

  // ---- Enterable buildings ----
  for (const b of BUILDINGS) {
    const rot = facingRotation(b.facing);
    const door = doorPosition(b);
    const out = outwardOffset(b.facing, 1);
    const upperH = b.h - GF_H;
    const floors = Math.max(1, Math.round(upperH / FLOOR_H));

    // Ground floor: solid base (interiors are separate levels — see environments.ts)
    const baseColor = new THREE.Color(0x9c968b).lerp(new THREE.Color(b.accent), 0.22);
    const gfMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85 });
    const gf = new THREE.Mesh(new THREE.BoxGeometry(b.w, GF_H, b.d), gfMat);
    gf.position.set(b.x, CURB_H + GF_H / 2, b.z);
    gf.castShadow = true;
    gf.receiveShadow = true;
    group.add(gf);
    cameraBlockers.push(gf);
    colliders.push({
      minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
    });

    // Upper floors: window-grid texture per face, repeats matched to size
    if (upperH > 0.5) {
      const mkWin = (spanMeters: number) => {
        const tex = windowsTexture(
          0x9c968b, b.accent, 7000 + Math.abs(b.x) * 13 + Math.abs(b.z) * 7,
          spanMeters / BAY_W, floors,
        );
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      };
      const matX = mkWin(b.d);   // east/west faces span depth
      const matZ = mkWin(b.w);   // north/south faces span width
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, upperH, b.d),
        [matX, matX, roofMat, roofMat, matZ, matZ],
      );
      upper.position.set(b.x, CURB_H + GF_H + upperH / 2, b.z);
      upper.castShadow = true;
      upper.receiveShadow = true;
      group.add(upper);
      cameraBlockers.push(upper);

      // Parapet cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.35, b.d + 0.4), parapetMat);
      cap.position.set(b.x, CURB_H + b.h + 0.178, b.z);
      group.add(cap);
    }

    // Storefront: glass band across the facing side
    const facadeLen = b.facing === 's' || b.facing === 'n' ? b.w : b.d;
    const glassLen = facadeLen * 0.82;
    const glassH = 2.7;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(glassLen, glassH, 0.12), glassMat);
    glass.position.set(door.x + out.x * 0.08, CURB_H + 0.5 + glassH / 2, door.z + out.z * 0.08);
    glass.rotation.y = rot;
    group.add(glass);
    const recess = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.5 }),
    );
    recess.position.set(door.x + out.x * 0.16, CURB_H + DOOR_H / 2, door.z + out.z * 0.16);
    recess.rotation.y = rot;
    group.add(recess);
    // Frame: header + sill + end pillars
    const header = new THREE.Mesh(new THREE.BoxGeometry(glassLen + 0.4, 0.45, 0.3), frameMat);
    header.position.set(door.x + out.x * 0.1, CURB_H + 0.5 + glassH + 0.2, door.z + out.z * 0.1);
    header.rotation.y = rot;
    group.add(header);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(glassLen + 0.4, 0.5, 0.24), frameMat);
    sill.position.set(door.x + out.x * 0.1, CURB_H + 0.25, door.z + out.z * 0.1);
    sill.rotation.y = rot;
    group.add(sill);
    const pillarGeo = new THREE.BoxGeometry(0.35, GF_H, 0.35);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, frameMat);
      const along = side * (glassLen / 2 + 0.35);
      p.position.set(
        door.x + out.x * 0.15 + Math.cos(rot) * along,
        CURB_H + GF_H / 2,
        door.z + out.z * 0.15 - Math.sin(rot) * along,
      );
      p.rotation.y = rot;
      group.add(p);
    }

    // Awning (shops only)
    if (AWNINGS.has(b.id)) {
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(glassLen * 0.7, 0.08, 1.15),
        new THREE.MeshStandardMaterial({
          map: awningTexture(b.accent), roughness: 0.9, side: THREE.DoubleSide,
        }),
      );
      awn.position.set(door.x + out.x * 0.75, CURB_H + 3.42, door.z + out.z * 0.75);
      awn.rotation.y = rot;
      // Tilt down toward the street in the facade's local frame
      awn.rotateX(0.3);
      awn.castShadow = true;
      group.add(awn);
    }

    // Signage: marquee for the cinema, sign band for everyone else
    if (b.id === 'cinema') {
      const mq = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.62, 1.9, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xe9e6da, roughness: 0.6 }),
      );
      mq.add(body);
      const faceTex = makeSignTexture('CINEMA', b.accent, true);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(b.w * 0.58, 1.5),
        new THREE.MeshStandardMaterial({
          map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.35,
        }),
      );
      face.position.set(0, 0, 0.71);
      mq.add(face);
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.62 + 0.2, 0.14, 1.5),
        new THREE.MeshStandardMaterial({ color: b.accent, emissive: b.accent, emissiveIntensity: 0.5 }),
      );
      trim.position.y = -1.0;
      mq.add(trim);
      mq.position.set(door.x + out.x * 0.8, CURB_H + GF_H + 1.4, door.z + out.z * 0.8);
      mq.rotation.y = rot;
      group.add(mq);

      // Poster cases flanking the door, filled with the latest real posters
      const posters = data?.movies ?? [];
      [-1, 1].forEach((side, idx) => {
        const caseM = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 1.75, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x1c1d22, roughness: 0.4 }),
        );
        const along = side * (DOOR_W / 2 + 1.35);
        caseM.position.set(
          door.x + out.x * 0.2 + Math.cos(rot) * along,
          CURB_H + 1.75,
          door.z + out.z * 0.2 - Math.sin(rot) * along,
        );
        caseM.rotation.y = rot;
        group.add(caseM);
        const p = posters[idx];
        if (p) {
          const tex = artLoader.load(p.art);
          tex.colorSpace = THREE.SRGBColorSpace;
          const art = new THREE.Mesh(
            new THREE.PlaneGeometry(1.0, 1.6),
            new THREE.MeshStandardMaterial({
              map: tex, roughness: 0.6,
              emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25,
            }),
          );
          art.position.copy(caseM.position);
          art.position.x += out.x * 0.08;
          art.position.z += out.z * 0.08;
          art.rotation.y = rot;
          group.add(art);
        }
      });
      // More recent movies inside the lobby glass
      if (posters.length > 2) {
        addArtRow(group, posters.slice(2, 8), door, rot, outwardOffset(b.facing, 0.19),
          { y: CURB_H + 1.95, w: 1.35, h: 2.05, gap: 0.5, maxAlong: glassLen / 2 - 0.8 });
      }
    } else {
      const signTex = makeSignTexture(b.name, b.accent);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(facadeLen * 0.6, 9), 1.1, 0.28),
        [frameMat, frameMat, frameMat, frameMat,
          new THREE.MeshStandardMaterial({
            map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.32,
          }),
          frameMat],
      );
      sign.position.set(door.x + out.x * 0.35, CURB_H + GF_H - 0.28, door.z + out.z * 0.35);
      sign.rotation.y = rot;
      group.add(sign);
    }

    // Window dressing from real site data (M2)
    if (data) {
      const rowY = CURB_H + 1.95;
      const maxAlong = glassLen / 2 - 0.7;
      if (b.id === 'records' && data.music?.length) {
        addArtRow(group, data.music.slice(0, 6), door, rot, outwardOffset(b.facing, 0.19),
          { y: CURB_H + 2.45, w: 0.95, h: 0.95, gap: 0.35, maxAlong });
        addArtRow(group, data.music.slice(6, 12), door, rot, outwardOffset(b.facing, 0.19),
          { y: CURB_H + 1.3, w: 0.95, h: 0.95, gap: 0.35, maxAlong });
      } else if (b.id === 'arcade' && data.games?.length) {
        addArtRow(group, data.games.slice(0, 6), door, rot, outwardOffset(b.facing, 0.19),
          { y: rowY, w: 1.15, h: 1.55, gap: 0.4, maxAlong });
      } else if (b.id === 'books' && data.books?.length) {
        addArtRow(group, data.books.slice(0, 8), door, rot, outwardOffset(b.facing, 0.19),
          { y: CURB_H + 1.7, w: 0.75, h: 1.1, gap: 0.28, maxAlong });
      } else if (b.id === 'anime' && data.anime?.length) {
        addArtRow(group, data.anime.slice(0, 6), door, rot, outwardOffset(b.facing, 0.19),
          { y: rowY, w: 0.95, h: 1.4, gap: 0.35, maxAlong });
      } else if (b.id === 'tv' && data.tv?.length) {
        addArtRow(group, data.tv.slice(0, 6), door, rot, outwardOffset(b.facing, 0.19),
          { y: rowY, w: 0.95, h: 1.4, gap: 0.35, maxAlong });
      }
    }

    doors.push({
      buildingId: b.id, name: b.name, route: b.route,
      x: door.x + out.x * 0.9, z: door.z + out.z * 0.9, radius: 2.2,
    });
  }

  // ---- Block-interior filler mass (windowed, muted) ----
  for (const f of FILLER) {
    const floors = Math.max(2, Math.round(f.h / FLOOR_H));
    const mkWin = (span: number) => new THREE.MeshStandardMaterial({
      map: windowsTexture(0x8d9096, 0x777d88, 9000 + Math.abs(f.x) * 3 + Math.abs(f.z), span / BAY_W, floors),
      roughness: 0.85,
    });
    const matX = mkWin(f.d);
    const matZ = mkWin(f.w);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(f.w, f.h, f.d),
      [matX, matX, roofMat, roofMat, matZ, matZ],
    );
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
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(k.w, k.h, k.d),
      new THREE.MeshStandardMaterial({ color: 0x40454f, roughness: 0.8 }),
    );
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
        map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.3,
      }),
    );
    sign.position.set(k.x - k.w / 2 - 0.01, CURB_H + k.h - 0.5, k.z);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);

    // Front page pinned to the kiosk: the actual latest blog post
    const post = data?.posts?.[0];
    if (post) {
      const pc = document.createElement('canvas');
      pc.width = 640; pc.height = 448;
      const pg = pc.getContext('2d')!;
      pg.fillStyle = '#efe9da'; pg.fillRect(0, 0, 640, 448);
      pg.fillStyle = '#191b21';
      pg.textAlign = 'center';
      pg.font = 'bold 44px Georgia, serif';
      pg.fillText('THE DAILY BUILD', 320, 56);
      pg.fillRect(30, 76, 580, 3);
      pg.textAlign = 'left';
      pg.font = 'bold 36px Georgia, serif';
      let ty = 130;
      let line = '';
      for (const w of post.title.split(' ')) {
        if (pg.measureText(`${line}${w} `).width > 580) {
          pg.fillText(line, 30, ty); ty += 44; line = '';
        }
        line += `${w} `;
      }
      pg.fillText(line, 30, ty);
      pg.font = '24px Georgia, serif';
      pg.fillStyle = '#4a4e58';
      ty += 46;
      line = '';
      for (const w of (post.description ?? '').split(' ')) {
        if (pg.measureText(`${line}${w} `).width > 580) {
          pg.fillText(line, 30, ty); ty += 30; line = '';
          if (ty > 420) break;
        }
        line += `${w} `;
      }
      if (ty <= 420) pg.fillText(line, 30, ty);
      const pTex = new THREE.CanvasTexture(pc);
      pTex.colorSpace = THREE.SRGBColorSpace;
      const page = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 1.4),
        new THREE.MeshStandardMaterial({ map: pTex, emissive: 0xffffff, emissiveMap: pTex, emissiveIntensity: 0.25 }),
      );
      page.position.set(k.x - k.w / 2 - 0.02, CURB_H + 1.55, k.z);
      page.rotation.y = -Math.PI / 2;
      group.add(page);
    }
  }

  // ---- Streetlights ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8e9ec, roughness: 0.4 });
  for (const l of LAMPS) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 8), poleMat);
    pole.position.set(l.x, CURB_H + 2.7, l.z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), headMat);
    head.position.set(l.x, CURB_H + 5.5, l.z);
    group.add(head);
    colliders.push({ minX: l.x - 0.18, maxX: l.x + 0.18, minZ: l.z - 0.18, maxZ: l.z + 0.18 });
  }

  // ---- Surroundings: extended ground + distant skyline ----
  {
    const groundFar = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshStandardMaterial({ color: 0x44464c, roughness: 0.95 }),
    );
    groundFar.rotation.x = -Math.PI / 2;
    groundFar.position.y = -0.05;
    group.add(groundFar);

    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const skyline = new THREE.Group();
    const tints = [0x9aa2ae, 0x8b929e, 0xa6a8ad, 0x7e8894, 0xb0b3b8];
    for (let ring = 0; ring < 2; ring++) {
      const rMin = ring === 0 ? 120 : 260;
      const rMax = ring === 0 ? 220 : 460;
      const count = ring === 0 ? 42 : 30;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + rand() * 0.2;
        const r = rMin + rand() * (rMax - rMin);
        const w = 18 + rand() * 42;
        const d = 18 + rand() * 42;
        const h = ring === 0 ? 14 + rand() * 46 : 30 + rand() * 110;
        const mat = new THREE.MeshStandardMaterial({
          color: tints[Math.floor(rand() * tints.length)],
          roughness: 0.95,
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(Math.cos(ang) * r, h / 2 - 0.05, Math.sin(ang) * r);
        m.rotation.y = rand() * Math.PI;
        skyline.add(m);
      }
    }
    group.add(skyline);
  }

  // ---- World edge fence colliders (invisible) ----
  colliders.push(
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.minZ },
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.maxZ, maxZ: WORLD_EDGE.maxZ + 1 },
    { minX: WORLD_EDGE.minX - 1, maxX: WORLD_EDGE.minX, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.maxZ + 1 },
    { minX: WORLD_EDGE.maxX, maxX: WORLD_EDGE.maxX + 1, minZ: WORLD_EDGE.minZ - 1, maxZ: WORLD_EDGE.maxZ + 1 },
  );

  return { group, colliders, doors, cameraBlockers };
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
