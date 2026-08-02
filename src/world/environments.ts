// Interior levels for The Block (M2c)
//
// Each enterable building opens (Enter at its street door) into a dedicated
// environment built in its own far-off cell — unconstrained by the exterior
// footprint. Every level supplies its colliders, camera blockers, spawn and
// exit; the LevelManager in index.ts swaps the active set and dims the sun.
// All furniture gets real colliders. No web links — the game holds it all.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { plyPanelTexture } from './textures';
import type { ArtItem, ColliderRect, WorldData } from './types';

const CELL_ORIGIN_X = 2000;
const CELL_SPACING = 500;

export interface InteriorLevel {
  id: string;
  name: string;
  group: THREE.Group;
  colliders: ColliderRect[];
  blockers: THREE.Object3D[];
  /** World-space spawn just inside the entry door, facing into the room */
  spawn: { x: number; z: number; heading: number };
  /** Walk here + Enter returns to the street */
  exit: { x: number; z: number; radius: number };
  lights: THREE.Light[];
  /** Ground height inside the level (crash pads, standable furniture tops) */
  groundFn: (x: number, z: number) => number;
  onEnter?: () => void;
  onExit?: () => void;
  /** Walk-up spots where Enter triggers an action (prompt shows the label) */
  interact?: Array<{ x: number; z: number; radius: number; label: string; action: () => void }>;
}

/** Horizontal surface the player can stand on (world XZ, top height) */
interface Platform { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

/** Furniture at or below this top height is jumpable and standable */
const STANDABLE_MAX = 1.35;

const loader = new THREE.TextureLoader();

function artMat(item: ArtItem, emissive = 0.5): THREE.MeshStandardMaterial {
  const tex = loader.load(item.art);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.7,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive,
  });
}

function textTexture(
  text: string, sub = '', w = 1024, accent = '#e8e4d8',
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#191b21'; g.fillRect(0, 0, w, 256);
  g.textAlign = 'center';
  g.fillStyle = accent;
  g.font = 'bold 96px system-ui, sans-serif';
  g.fillText(text, w / 2, sub ? 128 : 150, w - 60);
  if (sub) {
    g.font = '44px system-ui, sans-serif';
    g.fillStyle = '#8d93a3';
    g.fillText(sub, w / 2, 205, w - 60);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Basic room shell builder inside a level cell (local coords, origin at center) */
class Cell {
  group = new THREE.Group();
  colliders: ColliderRect[] = [];
  blockers: THREE.Object3D[] = [];
  lights: THREE.Light[] = [];
  platforms: Platform[] = [];
  readonly ox: number;

  constructor(index: number, public readonly halfW: number, public readonly h: number, public readonly halfD: number) {
    this.ox = CELL_ORIGIN_X + index * CELL_SPACING;
    this.group.position.set(this.ox, 0, 0);
  }

  /** local→world for colliders/triggers */
  wx(lx: number): number { return this.ox + lx; }

  add(m: THREE.Object3D, lx: number, ly: number, lz: number, ry = 0): void {
    m.position.set(lx, ly, lz);
    m.rotation.y = ry;
    this.group.add(m);
  }

  collide(lx0: number, lx1: number, lz0: number, lz1: number, top?: number): void {
    const r: ColliderRect = {
      minX: this.wx(Math.min(lx0, lx1)), maxX: this.wx(Math.max(lx0, lx1)),
      minZ: Math.min(lz0, lz1), maxZ: Math.max(lz0, lz1),
    };
    if (top !== undefined) r.top = top;
    this.colliders.push(r);
  }

  /** Standable surface (local coords) — groundFn returns its top inside it */
  platform(lx0: number, lx1: number, lz0: number, lz1: number, y: number): void {
    this.platforms.push({
      minX: this.wx(Math.min(lx0, lx1)), maxX: this.wx(Math.max(lx0, lx1)),
      minZ: Math.min(lz0, lz1), maxZ: Math.max(lz0, lz1), y,
    });
  }

  /** Solid box with matching collider; low furniture is jumpable + standable */
  box(w: number, h: number, d: number, mat: THREE.Material, lx: number, ly: number, lz: number, ry = 0): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = false;
    m.receiveShadow = true;
    this.add(m, lx, ly, lz, ry);
    // Axis-aligned collider approximation (fine for ry ~ 0 or PI/2 furniture)
    const [cw, cd] = Math.abs(Math.sin(ry)) > 0.5 ? [d, w] : [w, d];
    const top = ly + h / 2;
    if (top <= STANDABLE_MAX) {
      this.collide(lx - cw / 2, lx + cw / 2, lz - cd / 2, lz + cd / 2, top);
      this.platform(lx - cw / 2, lx + cw / 2, lz - cd / 2, lz + cd / 2, top);
    } else {
      this.collide(lx - cw / 2, lx + cw / 2, lz - cd / 2, lz + cd / 2);
    }
    return m;
  }

  /** Room: floor, ceiling with light panels, 4 walls with a door gap on +Z */
  shell(opts: {
    floor: number; wall: number; ceiling?: number;
    doorW?: number; panelEvery?: number; lightColor?: number; lightIntensity?: number;
  }): void {
    const { halfW, halfD, h } = this;
    const doorW = opts.doorW ?? 3.2;
    const wallT = 0.5;
    const floorMat = new THREE.MeshStandardMaterial({ color: opts.floor, roughness: 0.92 });
    const wallMat = new THREE.MeshStandardMaterial({ color: opts.wall, roughness: 0.9 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: opts.ceiling ?? 0x2b2d33, roughness: 0.95 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.2, halfD * 2), floorMat);
    floor.receiveShadow = true;
    this.add(floor, 0, -0.1, 0);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.2, halfD * 2), ceilMat);
    this.add(ceil, 0, h + 0.1, 0);
    this.blockers.push(ceil);

    // Back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, h, wallT), wallMat);
    back.receiveShadow = true;
    this.add(back, 0, h / 2, -halfD + wallT / 2);
    this.blockers.push(back);
    this.collide(-halfW, halfW, -halfD, -halfD + wallT);
    // Side walls
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, halfD * 2), wallMat);
      side.receiveShadow = true;
      this.add(side, s * (halfW - wallT / 2), h / 2, 0);
      this.blockers.push(side);
      this.collide(s * halfW - (s > 0 ? wallT : 0), s * halfW + (s < 0 ? wallT : 0), -halfD, halfD);
    }
    // Front wall with door gap
    const segW = (halfW * 2 - doorW) / 2;
    for (const s of [-1, 1]) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, h, wallT), wallMat);
      seg.receiveShadow = true;
      this.add(seg, s * (doorW / 2 + segW / 2), h / 2, halfD - wallT / 2);
      this.blockers.push(seg);
      const x0 = s < 0 ? -halfW : doorW / 2;
      this.collide(x0, x0 + segW, halfD - wallT, halfD);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(doorW, Math.max(0.4, h - 3.4), wallT), wallMat);
    this.add(header, 0, 3.4 + Math.max(0.4, h - 3.4) / 2, halfD - wallT / 2);
    // Exit glow strip over the door
    const exitBar = new THREE.Mesh(
      new THREE.BoxGeometry(doorW, 0.28, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3ddc7b, emissive: 0x3ddc7b, emissiveIntensity: 1.4 }),
    );
    this.add(exitBar, 0, 3.2, halfD - wallT - 0.06);
    // Closed double door in the gap — Enter swaps the level under the fade,
    // so it never needs to visibly open; it just can't be walked through.
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.55, metalness: 0.25 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.35, metalness: 0.7 });
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2 - 0.05, 3.3, 0.12), doorMat);
      this.add(leaf, s * doorW / 4, 1.65, halfD - 0.3);
      this.blockers.push(leaf);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(doorW / 2 - 0.5, 0.09, 0.07), barMat);
      this.add(bar, s * doorW / 4, 1.05, halfD - 0.21);
    }
    this.collide(-doorW / 2, doorW / 2, halfD - 0.5, halfD);

    // Ceiling light panels + point lights
    const every = opts.panelEvery ?? 6;
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: opts.lightColor ?? 0xfff2dc,
      emissiveIntensity: 2.4,
    });
    const rows = Math.max(1, Math.floor((halfD * 2) / every));
    const cols = Math.max(1, Math.floor((halfW * 2) / every));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lx = -halfW + (c + 0.5) * ((halfW * 2) / cols);
        const lz = -halfD + (r + 0.5) * ((halfD * 2) / rows);
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.2), panelMat);
        this.add(p, lx, h - 0.06, lz);
      }
    }
    const lights = Math.min(8, Math.max(2, Math.floor((halfW * halfD * 4) / 160)));
    for (let i = 0; i < lights; i++) {
      const lp = new THREE.PointLight(
        opts.lightColor ?? 0xfff1dd,
        opts.lightIntensity ?? 58,
        Math.max(halfW, halfD) * 2.6, 1.9,
      );
      const lz = -halfD + ((i + 0.5) * (halfD * 2)) / lights;
      this.add(lp, 0, h - 0.8, lz);
      this.lights.push(lp);
    }
  }

  /** Fill a wall face with a grid of art. wall: back|left|right or a z-line for partitions */
  artGrid(
    items: ArtItem[],
    wall: 'back' | 'left' | 'right',
    opts: { w: number; h: number; gapX?: number; gapY?: number; yBase?: number; rows?: number },
  ): number {
    const gapX = opts.gapX ?? 0.35;
    const gapY = opts.gapY ?? 0.5;
    const rows = opts.rows ?? 2;
    const yBase = opts.yBase ?? 1.35;
    const span = wall === 'back' ? this.halfW * 2 - 2 : this.halfD * 2 - 2;
    const cols = Math.floor(span / (opts.w + gapX));
    let used = 0;
    for (let r = 0; r < rows && used < items.length; r++) {
      const y = yBase + opts.h / 2 + r * (opts.h + gapY);
      for (let c = 0; c < cols && used < items.length; c++) {
        const a = -span / 2 + (c + 0.5) * (span / cols);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(opts.w, opts.h), artMat(items[used]));
        if (wall === 'back') this.add(m, a, y, -this.halfD + 0.56, 0);
        else if (wall === 'left') this.add(m, -this.halfW + 0.56, y, a, Math.PI / 2);
        else this.add(m, this.halfW - 0.56, y, a, -Math.PI / 2);
        used++;
      }
    }
    return used;
  }

  /** Free-standing double-sided partition wall along z, filled with art */
  partition(
    items: ArtItem[], lx: number, length: number,
    opts: { w: number; h: number; rows?: number; wallH?: number },
  ): number {
    const wallH = opts.wallH ?? this.h - 1.2;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x33363e, roughness: 0.9 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, length), wallMat);
    wall.receiveShadow = true;
    this.add(wall, lx, wallH / 2, 0);
    this.blockers.push(wall);
    this.collide(lx - 0.2, lx + 0.2, -length / 2, length / 2);

    const rows = opts.rows ?? 2;
    const gapX = 0.32;
    const gapY = 0.45;
    const cols = Math.floor((length - 1) / (opts.w + gapX));
    let used = 0;
    // Alternate faces so a partial fill still dresses both sides evenly
    for (let c = 0; c < cols && used < items.length; c++) {
      for (const side of [1, -1]) {
        for (let r = 0; r < rows && used < items.length; r++) {
          const y = 1.2 + opts.h / 2 + r * (opts.h + gapY);
          const a = -(length - 1) / 2 + (c + 0.5) * ((length - 1) / cols);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(opts.w, opts.h), artMat(items[used]));
          this.add(m, lx + side * 0.22, y, a, side > 0 ? Math.PI / 2 : -Math.PI / 2);
          used++;
        }
      }
    }
    return used;
  }

  finish(id: string, name: string): InteriorLevel {
    const platforms = this.platforms;
    return {
      id, name,
      group: this.group,
      colliders: this.colliders,
      blockers: this.blockers,
      lights: this.lights,
      groundFn: (x, z) => {
        // Highest standable surface underfoot (small margin ~ capsule radius)
        let y = 0;
        for (const p of platforms) {
          if (x >= p.minX - 0.2 && x <= p.maxX + 0.2
            && z >= p.minZ - 0.2 && z <= p.maxZ + 0.2 && p.y > y) y = p.y;
        }
        return y;
      },
      spawn: { x: this.wx(0), z: this.halfD - 2.2, heading: Math.PI },
      exit: { x: this.wx(0), z: this.halfD - 1.4, radius: 1.9 },
    };
  }
}

const mat = (c: number, rough = 0.85, metal = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

// ---------------------------------------------------------------------------
// The environments
// ---------------------------------------------------------------------------

function cinemaLevel(i: number, data?: WorldData): InteriorLevel {
  const movies = data?.movies ?? [];
  const c = new Cell(i, 16, 6.5, 26);
  c.shell({ floor: 0x571f24, wall: 0x8a8377, ceiling: 0x1e1b1d, lightColor: 0xffe3c0 });

  // Marquee title inside
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.0),
    new THREE.MeshStandardMaterial({
      map: textTexture('EVERY FILM', `${movies.length} watched`, 1024, '#ff5a4e'),
      emissive: 0xffffff, emissiveMap: textTexture('EVERY FILM', `${movies.length} watched`, 1024, '#ff5a4e'),
      emissiveIntensity: 0.6,
    }),
  );
  c.add(title, 0, 4.9, -c.halfD + 0.57);

  // Red carpet spine
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, c.halfD * 2 - 2), mat(0x8e1f24, 0.95));
  c.add(carpet, 0, 0.12, 0);

  // Full collection: perimeter walls + two double-sided partitions
  let used = 0;
  used += c.artGrid(movies.slice(used), 'back', { w: 1.25, h: 1.85, rows: 2, yBase: 0.8 });
  used += c.artGrid(movies.slice(used), 'left', { w: 1.25, h: 1.85, rows: 2, yBase: 0.8 });
  used += c.artGrid(movies.slice(used), 'right', { w: 1.25, h: 1.85, rows: 2, yBase: 0.8 });
  used += c.partition(movies.slice(used), -7.5, c.halfD * 2 - 9, { w: 1.25, h: 1.85, rows: 2 });
  used += c.partition(movies.slice(used), 7.5, c.halfD * 2 - 9, { w: 1.25, h: 1.85, rows: 2 });

  // Concession counter near the door
  c.box(4.6, 1.05, 1.3, mat(0x3a2d26), -9.5, 0.55, c.halfD - 4.5);

  return c.finish('cinema', 'CINEMA');
}

function recordsLevel(i: number, data?: WorldData): InteriorLevel {
  const albums = data?.music ?? [];
  const c = new Cell(i, 12, 5, 16);
  c.shell({ floor: 0x6d5942, wall: 0x4a4438, ceiling: 0x241f1c, lightColor: 0xffe9c8 });

  const title = textTexture('RECORDS', `${albums.length} albums on rotation`, 1024, '#36c98e');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.7),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.6 }),
  );
  c.add(sign, 0, 3.8, -c.halfD + 0.57);

  let used = 0;
  used += c.artGrid(albums.slice(used), 'back', { w: 1.15, h: 1.15, rows: 2, yBase: 0.9, gapY: 0.4 });
  used += c.artGrid(albums.slice(used), 'left', { w: 1.15, h: 1.15, rows: 2, yBase: 0.9, gapY: 0.4 });
  used += c.artGrid(albums.slice(used), 'right', { w: 1.15, h: 1.15, rows: 2, yBase: 0.9, gapY: 0.4 });

  // Bin rows (collide)
  for (const lz of [2.5, -1.5, -5.5]) {
    for (const lx of [-5.5, 0, 5.5]) {
      c.box(3.4, 0.95, 1.4, mat(0x5a4634), lx, 0.5, lz);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.5), mat(0x6b5540));
      c.add(lip, lx, 1.0, lz);
    }
  }
  // Listening corner
  c.box(1.2, 1.7, 0.8, mat(0x22242a, 0.5, 0.4), -c.halfW + 1.8, 0.85, c.halfD - 4);
  return c.finish('records', 'RECORDS');
}

function arcadeLevel(i: number, data?: WorldData): InteriorLevel {
  const games = data?.games ?? [];
  const c = new Cell(i, 13, 4.8, 18);
  c.shell({
    floor: 0x1c1e26, wall: 0x232630, ceiling: 0x14151b,
    lightColor: 0xb44df0, lightIntensity: 38, panelEvery: 9,
  });

  const title = textTexture('ARCADE', `${games.length} games · most played first`, 1024, '#c77df5');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 1.8),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.8 }),
  );
  c.add(sign, 0, 3.5, -c.halfD + 0.57);

  // Neon floor strips
  for (const lx of [-8, -2.7, 2.7, 8]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.02, c.halfD * 2 - 4),
      new THREE.MeshStandardMaterial({ color: 0x7a2bd8, emissive: 0x7a2bd8, emissiveIntensity: 1.6 }),
    );
    c.add(strip, lx, 0.02, 0);
  }

  // Cabinet rows facing the aisles
  const cabMat = mat(0x14151a, 0.55);
  games.forEach((gItem, gi) => {
    const row = Math.floor(gi / 8);
    const col = gi % 8;
    const lx = -c.halfW + 2.6 + col * 2.9;
    const lz = -c.halfD + 4 + row * 4.6;
    if (lz > c.halfD - 5) return;
    const cab = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.9, 0.9), cabMat);
    body.position.y = 0.95;
    cab.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), artMat(gItem, 0.9));
    screen.position.set(0, 1.3, 0.46);
    screen.rotation.x = -0.1;
    cab.add(screen);
    const marq = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.3, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xb44df0, emissive: 0xb44df0, emissiveIntensity: 1.1 }),
    );
    marq.position.set(0, 2.05, 0.22);
    cab.add(marq);
    c.add(cab, lx, 0, lz, Math.PI);
    c.collide(lx - 0.55, lx + 0.55, lz - 0.5, lz + 0.5);
  });

  return c.finish('arcade', 'ARCADE');
}

function booksLevel(i: number, data?: WorldData): InteriorLevel {
  const books = data?.books ?? [];
  const c = new Cell(i, 11, 4.6, 15);
  c.shell({ floor: 0x6d5334, wall: 0x54462f, ceiling: 0x2a251c, lightColor: 0xffe2b8, lightIntensity: 44 });

  const title = textTexture('LIBRARY', `${books.length} books read`, 1024, '#e8c56a');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 1.6),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.55 }),
  );
  c.add(sign, 0, 3.4, -c.halfD + 0.57);

  let used = 0;
  used += c.artGrid(books.slice(used), 'back', { w: 0.85, h: 1.25, rows: 2, yBase: 0.9, gapY: 0.45 });
  used += c.artGrid(books.slice(used), 'left', { w: 0.85, h: 1.25, rows: 2, yBase: 0.9, gapY: 0.45 });
  used += c.artGrid(books.slice(used), 'right', { w: 0.85, h: 1.25, rows: 2, yBase: 0.9, gapY: 0.45 });

  // Shelf islands with procedural spines + reading nook
  const spineColors = [0x8a3324, 0x2e4d3a, 0x39496b, 0x7a6032, 0x5b3550, 0x365a5e];
  for (const lx of [-4.5, 0, 4.5]) {
    const shelf = c.box(3.4, 2.1, 0.9, mat(0x4c3a29), lx, 1.05, -2);
    void shelf;
    for (let s = 0; s < 26; s++) {
      const bw = 0.09 + (s % 4) * 0.02;
      const bh = 0.5 + ((s * 7) % 5) * 0.06;
      const spine = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.24),
        mat(spineColors[s % spineColors.length], 0.8),
      );
      const sx = lx - 1.55 + s * 0.12;
      const row = s % 2 === 0 ? 0.55 : 1.6;
      c.add(spine, sx, row + bh / 2, -2 + 0.34);
    }
  }
  c.box(2.2, 0.75, 2.2, mat(0x6b4a34, 0.9), c.halfW - 3, 0.38, c.halfD - 4.5);
  return c.finish('books', 'LIBRARY');
}

function animeLevel(i: number, data?: WorldData): InteriorLevel {
  const anime = data?.anime ?? [];
  const c = new Cell(i, 13, 4.6, 17);
  c.shell({ floor: 0x6e4a52, wall: 0x4e3a44, ceiling: 0x291f26, lightColor: 0xffc4da, lightIntensity: 44 });

  const title = textTexture('ANIME CAFÉ', `${anime.length} series watched`, 1024, '#ff7ab8');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 1.7),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.6 }),
  );
  c.add(sign, 0, 3.5, -c.halfD + 0.57);

  let used = 0;
  used += c.artGrid(anime.slice(used), 'back', { w: 0.95, h: 1.35, rows: 2, yBase: 0.85, gapY: 0.4 });
  used += c.artGrid(anime.slice(used), 'left', { w: 0.95, h: 1.35, rows: 2, yBase: 0.85, gapY: 0.4 });
  used += c.artGrid(anime.slice(used), 'right', { w: 0.95, h: 1.35, rows: 2, yBase: 0.85, gapY: 0.4 });
  used += c.partition(anime.slice(used), 0, c.halfD * 2 - 8, { w: 0.95, h: 1.35, rows: 2, wallH: 3.4 });

  // Café tables (collide)
  for (const [lx, lz] of [[-6, 3], [6, 3], [-6, -3], [6, -3]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.07, 18), mat(0x7a4c56));
    c.add(top, lx, 0.8, lz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), mat(0x2c2325));
    c.add(leg, lx, 0.4, lz);
    c.collide(lx - 0.7, lx + 0.7, lz - 0.7, lz + 0.7, 0.84);
    c.platform(lx - 0.7, lx + 0.7, lz - 0.7, lz + 0.7, 0.84);
  }
  // Paper lanterns
  for (const lx of [-8, -4, 0, 4, 8]) {
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd7e6, emissive: 0xff9ec4, emissiveIntensity: 1.1 }),
    );
    c.add(lantern, lx, 3.6, 0.5 * (lx % 3));
  }
  return c.finish('anime', 'ANIME CAFÉ');
}

function tvLevel(i: number, data?: WorldData): InteriorLevel {
  const shows = data?.tv ?? [];
  const c = new Cell(i, 12, 4.6, 15);
  c.shell({
    floor: 0x39404e, wall: 0x2c313c, ceiling: 0x191c22,
    lightColor: 0x9cc8ff, lightIntensity: 34, panelEvery: 9,
  });

  const title = textTexture('TV LOUNGE', `${shows.length} shows tracked`, 1024, '#4db8f0');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.6),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.7 }),
  );
  c.add(sign, 0, 3.5, -c.halfD + 0.57);

  // Wall of screens: every show as a glowing panel
  let used = 0;
  used += c.artGrid(shows.slice(used), 'back', { w: 1.05, h: 1.5, rows: 2, yBase: 0.7, gapY: 0.35 });
  used += c.artGrid(shows.slice(used), 'left', { w: 1.05, h: 1.5, rows: 2, yBase: 0.7, gapY: 0.35 });
  used += c.artGrid(shows.slice(used), 'right', { w: 1.05, h: 1.5, rows: 2, yBase: 0.7, gapY: 0.35 });

  // Couch pit (collide)
  for (const [lz, ry] of [[2.2, 0], [-2.2, Math.PI]] as Array<[number, number]>) {
    c.box(4.6, 0.75, 1.3, mat(0x3b4a63), 0, 0.4, lz, ry);
    const backr = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.72, 0.32), mat(0x33415a));
    c.add(backr, 0, 1.08, lz + (ry === 0 ? 0.62 : -0.62), ry);
  }
  c.box(1.9, 0.45, 1.0, mat(0x23262e, 0.6), 0, 0.25, 0);
  return c.finish('tv', 'TV LOUNGE');
}

function climbLevel(i: number, data?: WorldData): InteriorLevel {
  const pyramid = data?.climbing ?? [];
  const c = new Cell(i, 22, 12, 28);
  c.shell({
    floor: 0x2d4b8f, wall: 0x9aa3ad, ceiling: 0x3a3d44,
    lightColor: 0xf2f5ff, lightIntensity: 72, panelEvery: 8,
  });

  const stats = data?.climbStats;
  const sub = stats
    ? `${stats.totalSends} sends · ${stats.flashRate}% flash · max ${stats.maxGrade}`
    : 'bouldering · real send pyramid on the wall';
  const title = textTexture('CLIMBING GYM', sub, 1024, '#ffa53a');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.9),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.55 }),
  );
  c.add(sign, 0, 8.6, c.halfD - 0.6, Math.PI);

  const padMat = mat(0x274487, 0.98);
  const kickMat = mat(0x24262b, 0.9);
  const gradePalette = [0x3ddc7b, 0x3fa7dd, 0xf3d34a, 0xef8f3a, 0xe8443a, 0xb44df0, 0x6b4a2f, 0x24262d];

  // Seeded rng for hold placement
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Real hold vocabulary (weighted): footholds and crimps are everywhere,
  // jugs common, slopers/pinches regular, the odd cone and macro blob.
  const jug = new THREE.SphereGeometry(0.14, 10, 8);
  const crimp = new THREE.BoxGeometry(0.24, 0.05, 0.09);
  const sloper = new THREE.SphereGeometry(0.19, 12, 8);
  sloper.scale(1, 0.45, 1);
  const pinch = new THREE.BoxGeometry(0.09, 0.22, 0.1);
  const foot = new THREE.SphereGeometry(0.05, 6, 5);
  const cone5 = new THREE.ConeGeometry(0.12, 0.2, 5);
  const macro = new THREE.DodecahedronGeometry(0.3, 0);
  macro.scale(1, 0.55, 0.8);
  const holdGeo = [foot, foot, crimp, crimp, jug, jug, sloper, pinch, cone5, macro];

  /**
   * An angled wall section with clustered routes of colored holds.
   * Built inside a yawed pivot group so every hold/volume computes in the
   * wall's own frame and stays glued to the face at any lean.
   * lean > 0 = overhang (top tips toward the room), < 0 = slab.
   * The wall's bottom edge sits on the floor at (lx, lz).
   */
  const wallSection = (
    lx: number, lz: number, width: number, height: number, lean: number, ry: number, routes: number,
  ) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0, lz);
    pivot.rotation.y = ry;
    c.group.add(pivot);
    const cL = Math.cos(lean), sL = Math.sin(lean);

    // Painted-ply panel with t-nut grid; repeat matched so nut density is
    // constant across differently sized sections
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 0.4),
      new THREE.MeshStandardMaterial({
        map: plyPanelTexture(width / 1.5, height / 1.5), roughness: 0.88,
      }),
    );
    slab.rotation.x = lean;
    slab.position.set(0, (height / 2) * cL, (height / 2) * sL);
    slab.receiveShadow = true;
    pivot.add(slab);
    c.blockers.push(slab);

    // Kickboard: the dark base strip every real wall has
    const kick = new THREE.Mesh(new THREE.BoxGeometry(width, 0.36, 0.1), kickMat);
    kick.rotation.x = lean;
    kick.position.set(0, 0.18 * cL - 0.27 * sL, 0.18 * sL + 0.27 * cL);
    pivot.add(kick);

    // Collider: block only where the climbing surface is at body height.
    // An overhang's upper reach hangs metres above the player's head — the
    // full footprint would read as an invisible cuboid wall, so the strip
    // ends where the underside clears ~1.9m. Slabs block at the base line.
    const zNear = Math.min(-0.4, height * sL - 0.4);
    const zFar = lean > 0
      ? Math.min(height * sL, 1.9 * (sL / cL)) + 0.5
      : 0.4;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of [
      [-width / 2, zNear], [width / 2, zNear],
      [-width / 2, zFar], [width / 2, zFar],
    ] as Array<[number, number]>) {
      const wx = px * Math.cos(ry) + pz * Math.sin(ry);
      const wz = -px * Math.sin(ry) + pz * Math.cos(ry);
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }
    c.collide(lx + minX, lx + maxX, lz + minZ, lz + maxZ);

    // Face-frame -> pivot-local: a point at climb-height hy, offset `off`
    // out of the face, lands at (hx, hy*cL - off*sL, hy*sL + off*cL).
    for (let rt = 0; rt < routes; rt++) {
      const color = gradePalette[Math.floor(rnd() * gradePalette.length)];
      const holdMat = mat(color, 0.55);
      let hx = -width / 2 + (rt + 0.5) * (width / routes) + (rnd() - 0.5) * 0.4;
      // Route tag plate at the start holds, like a set problem
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.03), holdMat);
      tag.position.set(hx, 0.55 * cL - 0.23 * sL, 0.55 * sL + 0.23 * cL);
      pivot.add(tag);
      const holds = 8 + Math.floor(rnd() * 6);
      for (let hi = 0; hi < holds; hi++) {
        const t = hi / (holds - 1);
        const hy = 0.45 + t * (height - 1.0);
        hx += (rnd() - 0.5) * 0.55;
        hx = Math.max(-width / 2 + 0.3, Math.min(width / 2 - 0.3, hx));
        const hold = new THREE.Mesh(holdGeo[Math.floor(rnd() * holdGeo.length)], holdMat);
        hold.position.set(hx, hy * cL - 0.215 * sL, hy * sL + 0.215 * cL);
        hold.rotation.x = lean;             // seat flat on the leaned face
        hold.rotation.y = rnd() * Math.PI;
        hold.rotation.z = (rnd() - 0.5) * 0.3;
        pivot.add(hold);
      }
    }
    // Plywood volumes: matte white/charcoal pyramids and wedges bolted to
    // the face, apex out along the normal, spun randomly around it
    for (let v = 0; v < Math.max(2, Math.floor(width / 4.5)); v++) {
      const vw = 0.8 + rnd() * 1.0;
      const volGroup = new THREE.Group();
      const vx = -width / 2 + 1 + rnd() * (width - 2);
      const vy = 1 + rnd() * (height - 2.5);
      volGroup.position.set(vx, vy * cL - 0.2 * sL, vy * sL + 0.2 * cL);
      volGroup.rotation.x = Math.PI / 2 + lean;
      const vol = new THREE.Mesh(
        new THREE.ConeGeometry(vw / 2, 0.3 + rnd() * 0.22, rnd() > 0.5 ? 3 : 4),
        mat(rnd() > 0.35 ? 0xf2efe8 : 0x2c2e33, 0.9),
      );
      vol.rotation.y = rnd() * Math.PI;
      volGroup.add(vol);
      pivot.add(volGroup);
    }
  };

  // Varied sections around the perimeter: slab, vert, overhang, steep cave
  wallSection(-11, -c.halfD + 1.1, 18, 10, -0.1, 0, 8);     // gentle slab, back-left
  wallSection(9, -c.halfD + 1.1, 18, 10.5, 0.2, 0, 8);      // overhang, back-right
  wallSection(-c.halfW + 1.1, -14, 16, 9, 0.04, Math.PI / 2, 7);   // left vert
  wallSection(-c.halfW + 1.1, 4, 14, 10, 0.38, Math.PI / 2, 6);    // left steep cave
  wallSection(-c.halfW + 1.1, 17, 9, 8, -0.06, Math.PI / 2, 4);    // left slab by the door
  wallSection(c.halfW - 1.1, -12, 16, 9.5, 0.15, -Math.PI / 2, 7); // right overhang
  wallSection(c.halfW - 1.1, 6, 12, 8.5, -0.08, -Math.PI / 2, 5);  // right slab

  // Freestanding faceted boulder islands — the modern-gym signature:
  // angular plywood polyhedra climbable from all sides, sitting on pads.
  // Low-poly convex hulls; holds are placed ON facets, oriented along the
  // facet normal, so nothing floats.
  const upAxis = new THREE.Vector3(0, 1, 0);
  const mkBoulder = (
    bx: number, bz: number, rx: number, ry: number, rz: number,
    colorHex: number, holdCount: number, topOut = false,
  ): void => {
    // Layered rings of points -> chunky faceted MASS (a dome with a single
    // apex point reads at half its nominal height). Radii bulge at
    // mid-height and stay fat near the top so the silhouette is a mesa,
    // not a cone.
    const pts: THREE.Vector3[] = [];
    const layers: Array<[number, number]> = topOut
      ? [[0, 0.85], [0.55, 1.0], [1, 0.75]]
      : [[0, 0.85], [0.3, 1.0], [0.62, 0.92], [1, 0.5]];
    for (const [ly, lr] of layers) {
      const ringN = 7;
      for (let k = 0; k < ringN; k++) {
        const ang = (k / ringN) * Math.PI * 2 + rnd() * 0.7;
        const jr = 0.82 + rnd() * 0.18;
        pts.push(new THREE.Vector3(
          Math.cos(ang) * rx * lr * jr,
          ly * ry * (0.95 + rnd() * 0.05),
          Math.sin(ang) * rz * lr * jr,
        ));
      }
    }
    if (topOut) {
      for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        pts.push(new THREE.Vector3(px * rx * 0.5, ry, pz * rz * 0.5));
      }
    }
    const geo = new ConvexGeometry(pts);
    const hull = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9, flatShading: true }),
    );
    hull.receiveShadow = true;
    c.add(hull, bx, 0.24, bz);   // sits on its pad
    c.blockers.push(hull);
    // Octagon-ish footprint from three overlapping AABBs — a single square
    // would leave big invisible corners around the rounded base
    const top = topOut ? 0.24 + ry : undefined;
    c.collide(bx - rx * 0.92, bx + rx * 0.92, bz - rz * 0.5, bz + rz * 0.5, top);
    c.collide(bx - rx * 0.5, bx + rx * 0.5, bz - rz * 0.92, bz + rz * 0.92, top);
    c.collide(bx - rx * 0.75, bx + rx * 0.75, bz - rz * 0.75, bz + rz * 0.75, top);
    if (topOut) {
      c.platform(bx - rx * 0.55, bx + rx * 0.55, bz - rz * 0.55, bz + rz * 0.55, 0.24 + ry);
    }

    // Holds across the facets: pick triangles, random barycentric point,
    // seat along the facet normal
    const posAttr = geo.getAttribute('position');
    const triCount = posAttr.count / 3;
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    let placed = 0, guard = 0;
    while (placed < holdCount && guard++ < holdCount * 40) {
      const tri = Math.floor(rnd() * triCount);
      v0.fromBufferAttribute(posAttr, tri * 3);
      v1.fromBufferAttribute(posAttr, tri * 3 + 1);
      v2.fromBufferAttribute(posAttr, tri * 3 + 2);
      e1.subVectors(v1, v0);
      e2.subVectors(v2, v0);
      n.crossVectors(e1, e2).normalize();
      if (n.y < -0.2) continue;                 // skip undersides
      let a = rnd(), b = rnd();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const point = v0.clone().addScaledVector(e1, a).addScaledVector(e2, b);
      if (point.y < 0.2) continue;              // clear of the pad line
      const hold = new THREE.Mesh(
        holdGeo[Math.floor(rnd() * holdGeo.length)],
        mat(gradePalette[Math.floor(rnd() * gradePalette.length)], 0.55),
      );
      hold.position.copy(point).addScaledVector(n, 0.02);
      hold.quaternion.setFromUnitVectors(upAxis, n);
      hold.rotateY(rnd() * Math.PI * 2);
      hull.add(hold);
      placed++;
    }
  };

  // Island scale matches the walls (~10m): serious freestanding masses
  mkBoulder(-7, -9, 8.5, 9.2, 6.5, 0xe8e4da, 150);         // big cream ridge
  mkBoulder(10, 3, 6.0, 7.8, 5.5, 0x8fa3b8, 110);          // steel-blue tower
  mkBoulder(-5, 14, 4.5, 1.12, 3.6, 0xcfd4c9, 30, true);   // low top-out slab (jumpable)

  // Crash pads: strips under every wall + aprons under the boulder islands.
  // Standable — feet stay on top. Aprons sit 2cm taller than the wall
  // strips so overlapping pad tops never share a plane (z-fighting).
  const padZones: Array<[number, number, number, number, number]> = [
    [0, -c.halfD + 3.9, c.halfW * 2 - 2, 6, 0.24],
    [-c.halfW + 3.9, 1, 6, c.halfD * 2 - 8, 0.24],
    [c.halfW - 3.9, 1, 6, c.halfD * 2 - 8, 0.24],
    [-7, -9, 19, 15, 0.26],
    [10, 3, 14, 13, 0.26],
    [-5, 14, 12.6, 10.2, 0.26],
  ];
  for (const [px, pz, pw, pd, top] of padZones) {
    const padMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, top - 0.02, pd), padMat);
    c.add(padMesh, px, (top - 0.02) / 2 + 0.01, pz);
    c.platform(px - pw / 2, px + pw / 2, pz - pd / 2, pz + pd / 2, top);
  }

  // The send-pyramid chart (kept, framed, near the entrance)
  if (pyramid.length) {
    const chart = document.createElement('canvas');
    chart.width = 640; chart.height = 320;
    const cg = chart.getContext('2d')!;
    cg.fillStyle = '#1d1f26'; cg.fillRect(0, 0, 640, 320);
    cg.font = 'bold 34px system-ui'; cg.fillStyle = '#fff';
    cg.textAlign = 'center';
    cg.fillText('SEND PYRAMID', 320, 44);
    const maxCount = Math.max(...pyramid.map((p) => p.count));
    pyramid.forEach((p, gi) => {
      const bw = 640 / pyramid.length;
      const bh = (p.count / maxCount) * 200;
      cg.fillStyle = `#${gradePalette[gi % gradePalette.length].toString(16).padStart(6, '0')}`;
      cg.fillRect(gi * bw + 10, 270 - bh, bw - 20, bh);
      cg.fillStyle = '#cfd6e4';
      cg.font = '26px system-ui';
      cg.fillText(p.grade, gi * bw + bw / 2, 300);
      cg.fillText(String(p.count), gi * bw + bw / 2, 262 - bh);
    });
    const chartTex = new THREE.CanvasTexture(chart);
    chartTex.colorSpace = THREE.SRGBColorSpace;
    const framed = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.8),
      new THREE.MeshStandardMaterial({ map: chartTex, emissive: 0xffffff, emissiveMap: chartTex, emissiveIntensity: 0.5 }),
    );
    c.add(framed, 0, 5.6, c.halfD - 0.6, Math.PI);
  }

  // Beta theater: one big portrait screen playing one send at a time (a
  // single video decoder instead of eight), auto-advancing through the
  // playlist, with a static up-next thumbnail rail and a bench to watch
  // from. Enter at the bench skips to the next send.
  const vids = data?.climbVideos ?? [];
  const lvl = c.finish('climb', 'CLIMBING GYM');
  if (vids.length) {
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'none';
    let cur = 0;

    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0c0d10, roughness: 0.6,
      emissive: 0xffffff, emissiveIntensity: 0.85,
    });
    const setPoster = (): void => {
      const t = vids[cur].thumb;
      if (!t) return;
      const tex = loader.load(t);
      tex.colorSpace = THREE.SRGBColorSpace;
      screenMat.map = tex;
      screenMat.emissiveMap = tex;
      screenMat.needsUpdate = true;
    };
    // Swap poster -> live texture on EVERY 'playing' (not once): show() sets
    // the poster back each time the src changes, so a once-listener would
    // leave every video after the first frozen on its thumbnail.
    let videoTex: THREE.VideoTexture | null = null;
    el.addEventListener('playing', () => {
      if (!videoTex) {
        videoTex = new THREE.VideoTexture(el);
        videoTex.colorSpace = THREE.SRGBColorSpace;
      }
      screenMat.map = videoTex;
      screenMat.emissiveMap = videoTex;
      screenMat.needsUpdate = true;
    });

    // Now-playing plaque, redrawn per send
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 1024;
    plaqueCanvas.height = 192;
    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    const drawPlaque = (): void => {
      const g = plaqueCanvas.getContext('2d')!;
      const v = vids[cur];
      g.fillStyle = '#191b21';
      g.fillRect(0, 0, 1024, 192);
      g.textAlign = 'center';
      g.fillStyle = '#ffa53a';
      g.font = 'bold 80px system-ui, sans-serif';
      g.fillText(`NOW SHOWING · ${v.grade.toUpperCase()}`, 512, 82);
      g.font = '40px system-ui, sans-serif';
      g.fillStyle = '#8d93a3';
      g.fillText(`${v.gym} · ${v.date} · ${cur + 1} of ${vids.length}`, 512, 150);
      plaqueTex.needsUpdate = true;
    };

    // Up-next rail: static thumbnails, orange frame marks what's playing
    const railX = (i: number): number => -4.6 - i * 1.5;
    const hiFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.34, 2.28, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xffa53a, emissive: 0xffa53a, emissiveIntensity: 1.0 }),
    );
    c.add(hiFrame, railX(0), 3.55, c.halfD - 0.57);
    vids.forEach((v, vi) => {
      if (!v.thumb) return;
      const t = loader.load(v.thumb);
      t.colorSpace = THREE.SRGBColorSpace;
      const thumb = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 2.1),
        new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.4 }),
      );
      c.add(thumb, railX(vi), 3.55, c.halfD - 0.61, Math.PI);
      const lbl = textTexture(v.grade.toUpperCase(), v.date, 512, '#ffa53a');
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshStandardMaterial({ map: lbl, emissive: 0xffffff, emissiveMap: lbl, emissiveIntensity: 0.45 }),
      );
      c.add(p, railX(vi), 2.25, c.halfD - 0.61, Math.PI);
    });

    const show = (i: number): void => {
      cur = (i + vids.length) % vids.length;
      el.src = vids[cur].video;
      setPoster();
      drawPlaque();
      hiFrame.position.x = railX(cur);
      el.play().catch(() => {});
    };
    el.addEventListener('ended', () => show(cur + 1));
    // Dress the screen before first entry (no fetch/decode until then)
    setPoster();
    drawPlaque();

    // The screen itself, right of the door
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.7, 0.1), mat(0x1b1d22, 0.5));
    c.add(frame, 8.6, 3.85, c.halfD - 0.56);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.3), screenMat);
    c.add(screen, 8.6, 3.85, c.halfD - 0.62, Math.PI);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 0.56),
      new THREE.MeshStandardMaterial({ map: plaqueTex, emissive: 0xffffff, emissiveMap: plaqueTex, emissiveIntensity: 0.55 }),
    );
    c.add(plaque, 8.6, 0.82, c.halfD - 0.62, Math.PI);
    const theaterSign = textTexture('BETA THEATER', 'real footage · Enter at the bench for the next send', 1024, '#3fa7dd');
    const ts = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 1.4),
      new THREE.MeshStandardMaterial({ map: theaterSign, emissive: 0xffffff, emissiveMap: theaterSign, emissiveIntensity: 0.6 }),
    );
    c.add(ts, 8.6, 7.3, c.halfD - 0.6, Math.PI);

    // Viewing bench (standable like any pad)
    c.box(3.4, 0.45, 1.0, padMat, 8.6, 0.23, c.halfD - 7.5);

    lvl.interact = [{
      x: c.wx(8.6), z: c.halfD - 7.5, radius: 2.8,
      label: 'next send', action: () => show(cur + 1),
    }];
    lvl.onEnter = () => show(cur);
    lvl.onExit = () => el.pause();
  }
  return lvl;
}

/** Paper project plaque: title, tech list, wrapped description */
function plaqueTexture(p: { title: string; description?: string; tech: string[]; featured: boolean }): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 768, 512);
  g.fillStyle = '#242832';
  g.fillRect(0, 0, 768, 10);
  g.font = 'bold 52px system-ui, sans-serif';
  g.fillStyle = '#1c1f28';
  g.fillText(p.title + (p.featured ? ' ★' : ''), 36, 88, 700);
  g.font = '30px system-ui, sans-serif';
  g.fillStyle = '#5a6b8c';
  g.fillText(p.tech.slice(0, 4).join(' · '), 36, 140, 700);
  g.font = '32px system-ui, sans-serif';
  g.fillStyle = '#3b3f4a';
  const words = (p.description ?? '').split(' ');
  let line = '', ty = 208;
  for (const w of words) {
    if (g.measureText(`${line}${w} `).width > 700) {
      g.fillText(line, 36, ty); ty += 44; line = '';
      if (ty > 480) break;
    }
    line += `${w} `;
  }
  if (ty <= 480) g.fillText(line, 36, ty);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function studioLevel(i: number, data?: WorldData): InteriorLevel {
  const c = new Cell(i, 10, 4.2, 13);
  c.shell({ floor: 0x8a8378, wall: 0x6f7480, ceiling: 0x2c2e33, lightColor: 0xeef2ff, lightIntensity: 46 });

  const title = textTexture('STUDIO', 'projects & how the site gets built', 1024, '#9fb6ff');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.55 }),
  );
  c.add(sign, 0, 3.4, -c.halfD + 0.57);

  // Project plaques down both side walls
  const projects = data?.projects ?? [];
  projects.slice(0, 6).forEach((p, pi) => {
    const side = pi % 2 === 0 ? -1 : 1;
    const lz = -c.halfD + 3.5 + Math.floor(pi / 2) * 4.4;
    const tex = plaqueTexture(p);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 1.8),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.42 }),
    );
    c.add(plaque, side * (c.halfW - 0.58), 2.0, lz, side < 0 ? Math.PI / 2 : -Math.PI / 2);
  });

  // Site-by-the-numbers board on the back wall
  const nums = document.createElement('canvas');
  nums.width = 1024; nums.height = 512;
  const g = nums.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 512);
  g.font = 'bold 56px system-ui, sans-serif';
  g.fillStyle = '#1c1f28';
  g.textAlign = 'center';
  g.fillText('THE SITE, BY THE NUMBERS', 512, 76);
  const rows: string[] = [];
  const count = (k: 'movies' | 'tv' | 'music' | 'games' | 'books' | 'anime', label: string): void => {
    const n = data?.[k]?.length;
    if (n) rows.push(`${n} ${label}`);
  };
  count('movies', 'films watched');
  count('tv', 'shows tracked');
  count('music', 'albums on rotation');
  count('games', 'games played');
  count('books', 'books read');
  count('anime', 'anime series');
  const s = data?.climbStats;
  if (s) rows.push(`${s.totalSends} boulders sent · ${s.flashRate}% flash · max ${s.maxGrade}`);
  g.font = '42px system-ui, sans-serif';
  g.fillStyle = '#3b4252';
  rows.forEach((r, ri) => g.fillText(r, 512, 150 + ri * 52));
  const numsTex = new THREE.CanvasTexture(nums);
  numsTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.3),
    new THREE.MeshStandardMaterial({ map: numsTex, emissive: 0xffffff, emissiveMap: numsTex, emissiveIntensity: 0.4 }),
  );
  c.add(board, 0, 1.4, -c.halfD + 0.57);

  // Work desks in the middle
  for (const [lx, lz] of [[-4, 0], [4, 0], [-4, 4.5], [4, 4.5]]) {
    c.box(2.4, 0.85, 1.2, mat(0x8a7a63), lx, 0.45, lz);
    const monitor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x10131c, emissive: 0x2a3d5e, emissiveIntensity: 0.9 }),
    );
    c.add(monitor, lx, 1.35, lz - 0.35);
  }
  return c.finish('studio', 'STUDIO');
}

export function buildInteriorLevels(data?: WorldData): Map<string, InteriorLevel> {
  const builders: Array<(i: number, d?: WorldData) => InteriorLevel> = [
    cinemaLevel, recordsLevel, arcadeLevel, booksLevel, animeLevel, tvLevel, climbLevel, studioLevel,
  ];
  const map = new Map<string, InteriorLevel>();
  builders.forEach((b, i) => {
    const lvl = b(i, data);
    map.set(lvl.id, lvl);
  });
  return map;
}
