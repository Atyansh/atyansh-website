// Enterable interiors for The Block (M2b)
//
// Each enterable building's ground floor is hollow: four walls with a real
// door opening, floor, lit ceiling, and furnishings built from the site's
// data (world-data.json art). Walking through the door just works — wall
// colliders have a gap — and a small plaque inside deep-links to the 2D page.

import * as THREE from 'three';
import type { ArtItem, BuildingDef, ColliderRect, DoorTrigger, WorldData } from './types';
import { CURB_H } from './layout';

const WALL_T = 0.45;
export const DOOR_OPENING = 3.0;

/** Ground-floor (interior) height per building; default matches facades */
export function gfHeight(id: string): number {
  return id === 'climb' ? 8.0 : 4.4;
}

const artLoader = new THREE.TextureLoader();

function artMaterial(item: ArtItem, emissive = 0.55): THREE.MeshStandardMaterial {
  const tex = artLoader.load(item.art);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.7,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive,
  });
}

interface Ctx {
  group: THREE.Group;
  colliders: ColliderRect[];
  blockers: THREE.Object3D[];
  doors: DoorTrigger[];
}

/**
 * Hollow ground-floor shell: walls with a door gap on the facing side,
 * floor, ceiling with emissive light panels, and a point light. Returns the
 * interior frame (local +Z = toward the door/facade) for furnishing.
 */
export function buildInteriorShell(
  b: BuildingDef, ctx: Ctx, exteriorColor: THREE.Color, floorColor: number,
): { addLocal: (m: THREE.Object3D, lx: number, ly: number, lz: number, ry?: number) => void;
     halfW: number; halfD: number; h: number } {
  const h = gfHeight(b.id);
  const rot = { s: 0, n: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[b.facing];
  // Local frame: +Z points out the door. Facade wall is at local z=+halfD.
  const alongFacade = b.facing === 's' || b.facing === 'n' ? b.w : b.d;
  const intoBuilding = b.facing === 's' || b.facing === 'n' ? b.d : b.w;
  const halfW = alongFacade / 2;
  const halfD = intoBuilding / 2;

  const wallMat = new THREE.MeshStandardMaterial({ color: exteriorColor, roughness: 0.85 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.9 });

  const local = new THREE.Group();
  local.position.set(b.x, CURB_H, b.z);
  local.rotation.y = rot;
  ctx.group.add(local);

  const addLocal = (m: THREE.Object3D, lx: number, ly: number, lz: number, ry = 0): void => {
    m.position.set(lx, ly, lz);
    m.rotation.y = ry;
    local.add(m);
  };

  /** Convert a local-frame rect to a world-frame collider */
  const collideLocal = (lx0: number, lx1: number, lz0: number, lz1: number, top?: number) => {
    const corners = [[lx0, lz0], [lx0, lz1], [lx1, lz0], [lx1, lz1]].map(([lx, lz]) => {
      const c = Math.cos(rot), s = Math.sin(rot);
      return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
    });
    const xs = corners.map((c) => c[0]);
    const zs = corners.map((c) => c[1]);
    const r: ColliderRect = {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
    };
    if (top !== undefined) r.top = top;
    ctx.colliders.push(r);
  };

  // Facade wall: two segments flanking the door opening
  const segW = (alongFacade - DOOR_OPENING) / 2;
  for (const side of [-1, 1]) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, h, WALL_T), wallMat);
    seg.castShadow = true;
    seg.receiveShadow = true;
    addLocal(seg, side * (DOOR_OPENING / 2 + segW / 2), h / 2, halfD - WALL_T / 2);
    ctx.blockers.push(seg);
    const lx0 = side * (DOOR_OPENING / 2) + (side < 0 ? -segW : 0);
    collideLocal(lx0, lx0 + segW, halfD - WALL_T, halfD);
  }
  // Header above the door
  const header = new THREE.Mesh(new THREE.BoxGeometry(DOOR_OPENING, h - 3.3, WALL_T), wallMat);
  addLocal(header, 0, 3.3 + (h - 3.3) / 2, halfD - WALL_T / 2);

  // Back and side walls
  const back = new THREE.Mesh(new THREE.BoxGeometry(alongFacade, h, WALL_T), innerMat);
  back.receiveShadow = true;
  addLocal(back, 0, h / 2, -halfD + WALL_T / 2);
  ctx.blockers.push(back);
  collideLocal(-halfW, halfW, -halfD, -halfD + WALL_T);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, h, intoBuilding), innerMat);
    wall.receiveShadow = true;
    addLocal(wall, side * (halfW - WALL_T / 2), h / 2, 0);
    ctx.blockers.push(wall);
    collideLocal(side * halfW - (side > 0 ? WALL_T : 0), side * halfW + (side < 0 ? WALL_T : 0), -halfD, halfD);
  }

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(alongFacade - WALL_T, 0.06, intoBuilding - WALL_T),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9 }),
  );
  floor.receiveShadow = true;
  addLocal(floor, 0, 0.03, 0);

  // Ceiling with emissive light panels
  const ceil = new THREE.Mesh(
    new THREE.BoxGeometry(alongFacade, 0.2, intoBuilding),
    new THREE.MeshStandardMaterial({ color: 0xbfbcb2, roughness: 0.95 }),
  );
  addLocal(ceil, 0, h + 0.1, 0);
  ctx.blockers.push(ceil);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.6,
  });
  const panels = Math.max(2, Math.floor(intoBuilding / 5));
  for (let i = 0; i < panels; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(Math.min(alongFacade * 0.4, 4), 0.06, 1.1), panelMat);
    addLocal(p, 0, h - 0.05, -halfD + (i + 0.5) * (intoBuilding / panels));
  }
  const light = new THREE.PointLight(0xfff1dd, 30, Math.max(alongFacade, intoBuilding) * 1.4, 1.8);
  addLocal(light, 0, h - 0.8, 0);

  return { addLocal, halfW, halfD, h };
}

/** A wall plaque + door trigger inside the room that deep-links to the 2D page */
function addSitePlaque(
  b: BuildingDef, ctx: Ctx,
  addLocal: Ctx['group']['add'] extends never ? never : (m: THREE.Object3D, lx: number, ly: number, lz: number, ry?: number) => void,
  halfD: number,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#20222a'; g.fillRect(0, 0, 512, 128);
  g.font = '500 44px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#cfd6e4';
  g.fillText(`⏎  ${b.route} on atyansh.com`, 256, 64, 480);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 }),
  );
  // Just inside the door, on the header-side wall face
  addLocal(plaque, 0, 2.55, halfD - WALL_T - 0.02, Math.PI);
  const rot = { s: 0, n: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[b.facing];
  const c = Math.cos(rot), s = Math.sin(rot);
  const lz = halfD - 1.6;
  ctx.doors.push({
    buildingId: b.id, name: `${b.name} — view on site`, route: b.route,
    x: b.x + lz * s, z: b.z + lz * c, radius: 1.7,
  });
}

/** Furnish an interior from world data according to the building's category */
export function furnishInterior(
  b: BuildingDef, ctx: Ctx, data: WorldData | undefined,
  frame: { addLocal: (m: THREE.Object3D, lx: number, ly: number, lz: number, ry?: number) => void; halfW: number; halfD: number; h: number },
): void {
  const { addLocal, halfW, halfD, h } = frame;
  addSitePlaque(b, ctx, addLocal as never, halfD);

  const artRowOnWall = (
    items: ArtItem[], wall: 'back' | 'left' | 'right',
    y: number, w: number, hh: number, gap: number, emissive = 0.5,
  ) => {
    const span = wall === 'back' ? (halfW - WALL_T) * 2 : (halfD - WALL_T) * 2;
    const step = w + gap;
    const count = Math.min(items.length, Math.floor(span / step));
    const start = -((count - 1) * step) / 2;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), artMaterial(items[i], emissive));
      const a = start + i * step;
      if (wall === 'back') addLocal(m, a, y, -halfD + WALL_T + 0.02, 0);
      else if (wall === 'left') addLocal(m, -halfW + WALL_T + 0.02, y, a, Math.PI / 2);
      else addLocal(m, halfW - WALL_T - 0.02, y, a, -Math.PI / 2);
    }
    return count;
  };

  const boxMat = (c: number, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });

  switch (b.id) {
    case 'cinema': {
      const movies = data?.movies ?? [];
      // Gallery: two rows on the back wall, one row per side wall
      artRowOnWall(movies.slice(0, 6), 'back', 2.9, 1.35, 2.0, 0.45);
      artRowOnWall(movies.slice(6, 12), 'back', 1.15, 1.35, 2.0, 0.45);
      artRowOnWall(movies.slice(12, 18), 'left', 2.0, 1.35, 2.0, 0.5);
      artRowOnWall(movies.slice(18, 24), 'right', 2.0, 1.35, 2.0, 0.5);
      // Red carpet to the door
      const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, halfD * 2 - 1), boxMat(0x8e1f24, 0.95));
      addLocal(carpet, 0, 0.08, 0);
      // Concession counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.05, 1.2), boxMat(0x3a2d26));
      counter.castShadow = true;
      addLocal(counter, -halfW + 3.2, 0.55, -halfD + 2.4);
      break;
    }
    case 'records': {
      const albums = data?.music ?? [];
      artRowOnWall(albums.slice(0, 5), 'back', 2.5, 1.1, 1.1, 0.5);
      artRowOnWall(albums.slice(5, 9), 'left', 2.2, 1.1, 1.1, 0.5);
      artRowOnWall(albums.slice(9, 12), 'right', 2.2, 1.1, 1.1, 0.5);
      // Record bins
      for (const [lx, lz] of [[-1.6, 0.6], [1.6, 0.6], [-1.6, -2.2], [1.6, -2.2]]) {
        const bin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 1.3), boxMat(0x5a4634));
        bin.castShadow = true;
        addLocal(bin, lx, 0.5, lz);
        // crate lip
        const lip = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.4), boxMat(0x6b5540));
        addLocal(lip, lx, 1.0, lz);
      }
      break;
    }
    case 'arcade': {
      const games = data?.games ?? [];
      // Cabinet rows along both side walls
      const perSide = Math.min(4, Math.ceil(games.length / 2));
      games.slice(0, perSide * 2).forEach((gItem, i) => {
        const side = i < perSide ? -1 : 1;
        const idx = i % perSide;
        const cab = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.85, 0.85), boxMat(0x17181d, 0.6));
        body.position.y = 0.925;
        body.castShadow = true;
        cab.add(body);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.95), artMaterial(gItem, 0.85));
        screen.position.set(0, 1.28, 0.44);
        screen.rotation.x = -0.12;
        cab.add(screen);
        const marquee = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.28, 0.5),
          new THREE.MeshStandardMaterial({ color: b.accent, emissive: b.accent, emissiveIntensity: 0.9 }),
        );
        marquee.position.set(0, 1.99, 0.2);
        cab.add(marquee);
        const lz = halfD - 3.2 - idx * 2.1;
        addLocal(cab, side * (halfW - 1.35), 0, lz, side < 0 ? Math.PI / 2 : -Math.PI / 2);
      });
      // Free-play sign wall art
      artRowOnWall(games.slice(perSide * 2, perSide * 2 + 3), 'back', 2.2, 1.2, 1.6, 0.4);
      break;
    }
    case 'books': {
      const books = data?.books ?? [];
      artRowOnWall(books.slice(0, 6), 'back', 2.3, 0.85, 1.25, 0.35);
      // Shelf islands with cover faces
      for (const [i, [lx, lz]] of [[-2.2, 0.5], [2.2, 0.5]].entries()) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 3.6), boxMat(0x4c3a29));
        shelf.castShadow = true;
        addLocal(shelf, lx, 1.0, lz);
        const faces = books.slice(6 + i * 2, 8 + i * 2);
        faces.forEach((bk, j) => {
          const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.05), artMaterial(bk, 0.4));
          addLocal(cover, lx + (lx < 0 ? 0.32 : -0.32), 1.35, lz - 0.9 + j * 1.8, lx < 0 ? Math.PI / 2 : -Math.PI / 2);
        });
      }
      break;
    }
    case 'anime': {
      const anime = data?.anime ?? [];
      artRowOnWall(anime.slice(0, 5), 'back', 2.4, 1.0, 1.45, 0.5);
      artRowOnWall(anime.slice(5, 8), 'left', 2.2, 1.0, 1.45, 0.5);
      artRowOnWall(anime.slice(8, 10), 'right', 2.2, 1.0, 1.45, 0.5);
      // Café tables
      for (const [lx, lz] of [[-1.7, 0.4], [1.7, 0.4], [0, -2.0]]) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 16), boxMat(0x7a4c56));
        addLocal(top, lx, 0.78, lz);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.78, 8), boxMat(0x2c2325));
        addLocal(leg, lx, 0.39, lz);
        ctxCollideCircle(ctx, b, lx, lz, 0.7);
      }
      break;
    }
    case 'tv': {
      const shows = data?.tv ?? [];
      // Big screen wall: 2x3 grid of show posters like a video wall
      artRowOnWall(shows.slice(0, 3), 'back', 2.75, 1.35, 1.9, 0.7);
      artRowOnWall(shows.slice(3, 6), 'back', 0.95, 1.35, 1.35, 0.7);
      // Couch
      const couch = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 1.2), boxMat(0x3b4a63));
      couch.castShadow = true;
      addLocal(couch, 0, 0.4, 1.4);
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 0.3), boxMat(0x33415a));
      addLocal(backrest, 0, 1.05, 1.95);
      ctxCollideCircle(ctx, b, 0, 1.6, 1.6);
      break;
    }
    case 'climb': {
      // The showpiece: a full-height climbing wall built from the real
      // grade pyramid — one route column per grade, holds colored by grade,
      // column height proportional to ascent count.
      const pyramid = data?.climbing ?? [];
      const wallLean = 0.12;
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry((halfW - WALL_T) * 2 - 0.6, h - 0.4, 0.35),
        boxMat(0x8a97a8, 0.95),
      );
      wallMesh.castShadow = true;
      wallMesh.rotation.x = -wallLean;
      addLocal(wallMesh, 0, (h - 0.4) / 2 + 0.2, -halfD + 1.5);
      const gradeColors = [0x4dc36b, 0x3fa7dd, 0xf3d34a, 0xef8f3a, 0xe8443a, 0xb44df0, 0x8a5432, 0x2c2f36, 0xdddddd, 0xff7ab8];
      const usable = pyramid.slice(0, 8);
      const maxCount = Math.max(1, ...usable.map((p) => p.count));
      const span = (halfW - WALL_T) * 2 - 1.4;
      usable.forEach((p, gi) => {
        const colX = -span / 2 + (gi + 0.5) * (span / usable.length);
        const colH = 1.2 + (p.count / maxCount) * (h - 2.4);
        const holds = Math.max(3, Math.round(colH / 0.55));
        for (let hi = 0; hi < holds; hi++) {
          const hold = new THREE.Mesh(
            new THREE.SphereGeometry(0.11 + (hi % 3) * 0.025, 8, 6),
            boxMat(gradeColors[gi % gradeColors.length], 0.55),
          );
          const hy = 0.5 + (hi / (holds - 1)) * (colH - 0.6);
          const jitter = Math.sin(hi * 12.9898 + gi * 78.233) * 0.22;
          addLocal(hold, colX + jitter, hy, -halfD + 1.5 + 0.2 + hy * wallLean);
        }
      });
      // Grade chart plaque from the data
      const chart = document.createElement('canvas');
      chart.width = 512; chart.height = 256;
      const cg = chart.getContext('2d')!;
      cg.fillStyle = '#1d1f26'; cg.fillRect(0, 0, 512, 256);
      cg.font = 'bold 26px system-ui'; cg.fillStyle = '#fff';
      cg.textAlign = 'center';
      cg.fillText('SEND PYRAMID', 256, 34);
      usable.forEach((p, gi) => {
        const bw = 512 / usable.length;
        const bh = (p.count / maxCount) * 160;
        cg.fillStyle = `#${gradeColors[gi % gradeColors.length].toString(16).padStart(6, '0')}`;
        cg.fillRect(gi * bw + 8, 220 - bh, bw - 16, bh);
        cg.fillStyle = '#cfd6e4';
        cg.font = '20px system-ui';
        cg.fillText(p.grade, gi * bw + bw / 2, 244);
      });
      const chartTex = new THREE.CanvasTexture(chart);
      chartTex.colorSpace = THREE.SRGBColorSpace;
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.3),
        new THREE.MeshStandardMaterial({ map: chartTex, emissive: 0xffffff, emissiveMap: chartTex, emissiveIntensity: 0.5 }),
      );
      addLocal(plaque, halfW - WALL_T - 0.02, 2.2, 1.5, -Math.PI / 2);
      // Crash pads
      const pad = new THREE.Mesh(new THREE.BoxGeometry((halfW - WALL_T) * 2 - 0.8, 0.28, 2.6), boxMat(0x2d4b8f, 0.98));
      addLocal(pad, 0, 0.17, -halfD + 2.6);
      break;
    }
    case 'studio': {
      // Drafting desks + pinned-up blueprint feel (no data art yet)
      for (const [lx, lz] of [[-2.2, -1], [2.2, -1]]) {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.1), boxMat(0x8a7a63));
        desk.castShadow = true;
        addLocal(desk, lx, 0.45, lz);
        ctxCollideCircle(ctx, b, lx, lz, 1.1);
      }
      const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), boxMat(0xf0ede4, 0.95));
      addLocal(board, 0, 2.2, -halfD + WALL_T + 0.02);
      break;
    }
  }
}

/** Convenience: circular furniture collider in the building's local frame */
function ctxCollideCircle(ctx: Ctx, b: BuildingDef, lx: number, lz: number, r: number): void {
  const rot = { s: 0, n: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 }[b.facing];
  const c = Math.cos(rot), s = Math.sin(rot);
  const wx = b.x + lx * c + lz * s;
  const wz = b.z - lx * s + lz * c;
  ctx.colliders.push({ minX: wx - r / 2, maxX: wx + r / 2, minZ: wz - r / 2, maxZ: wz + r / 2 });
}
