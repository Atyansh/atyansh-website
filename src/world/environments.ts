// Interior levels for The Block (M2c)
//
// Each enterable building opens (Enter at its street door) into a dedicated
// environment built in its own far-off cell — unconstrained by the exterior
// footprint. Every level supplies its colliders, camera blockers, spawn and
// exit; the LevelManager in index.ts swaps the active set and dims the sun.
// All furniture gets real colliders. No web links — the game holds it all.

import * as THREE from 'three';
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
}

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

  /** Solid box with matching collider */
  box(w: number, h: number, d: number, mat: THREE.Material, lx: number, ly: number, lz: number, ry = 0): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = false;
    m.receiveShadow = true;
    this.add(m, lx, ly, lz, ry);
    // Axis-aligned collider approximation (fine for ry ~ 0 or PI/2 furniture)
    const [cw, cd] = Math.abs(Math.sin(ry)) > 0.5 ? [d, w] : [w, d];
    this.collide(lx - cw / 2, lx + cw / 2, lz - cd / 2, lz + cd / 2);
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

    // Ceiling light panels + point lights
    const every = opts.panelEvery ?? 6;
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: opts.lightColor ?? 0xfff2dc,
      emissiveIntensity: 1.7,
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
    const lights = Math.min(4, Math.max(2, Math.floor((halfW * halfD * 4) / 220)));
    for (let i = 0; i < lights; i++) {
      const lp = new THREE.PointLight(
        opts.lightColor ?? 0xfff1dd,
        opts.lightIntensity ?? 42,
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
    return {
      id, name,
      group: this.group,
      colliders: this.colliders,
      blockers: this.blockers,
      lights: this.lights,
      spawn: { x: this.wx(0), z: this.halfD - 2.2, heading: Math.PI },
      exit: { x: this.wx(0), z: this.halfD - 1.2, radius: 1.6 },
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
    lightColor: 0xb44df0, lightIntensity: 26, panelEvery: 9,
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
  c.shell({ floor: 0x6d5334, wall: 0x54462f, ceiling: 0x2a251c, lightColor: 0xffe2b8, lightIntensity: 30 });

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
  c.shell({ floor: 0x6e4a52, wall: 0x4e3a44, ceiling: 0x291f26, lightColor: 0xffc4da, lightIntensity: 30 });

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
    c.collide(lx - 0.7, lx + 0.7, lz - 0.7, lz + 0.7);
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
    lightColor: 0x9cc8ff, lightIntensity: 22, panelEvery: 9,
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
  const c = new Cell(i, 17, 11, 22);
  c.shell({
    floor: 0x2d4b8f, wall: 0x9aa3ad, ceiling: 0x3a3d44,
    lightColor: 0xf2f5ff, lightIntensity: 55, panelEvery: 8,
  });

  const title = textTexture('CLIMBING GYM', 'bouldering · real send pyramid on the wall', 1024, '#ffa53a');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.9),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.55 }),
  );
  c.add(sign, 0, 8.6, c.halfD - 0.6, Math.PI);

  const wallMat = mat(0x8a97a8, 0.95);
  const padMat = mat(0x274487, 0.98);
  const gradePalette = [0x3ddc7b, 0x3fa7dd, 0xf3d34a, 0xef8f3a, 0xe8443a, 0xb44df0, 0x6b4a2f, 0x24262d];

  // Seeded rng for hold placement
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const holdGeo = [
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.SphereGeometry(0.15, 8, 6),
    new THREE.BoxGeometry(0.2, 0.12, 0.16),
    new THREE.ConeGeometry(0.13, 0.2, 6),
  ];

  /** An angled wall section with clustered routes of colored holds */
  const wallSection = (
    lx: number, lz: number, width: number, height: number, lean: number, ry: number, routes: number,
  ) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.4), wallMat);
    slab.rotation.order = 'YXZ';
    slab.rotation.y = ry;
    slab.rotation.x = -lean;
    slab.position.set(lx, height / 2 * Math.cos(lean), lz);
    slab.castShadow = false;
    slab.receiveShadow = true;
    c.group.add(slab);
    c.blockers.push(slab);
    // Collider: base strip, generous depth to cover the lean
    const depth = 0.6 + Math.sin(Math.abs(lean)) * height;
    const cx = Math.cos(ry), sz = Math.sin(ry);
    // Approximate axis-aligned footprint
    const hw = (Math.abs(cx) * width + Math.abs(sz) * 0.4) / 2 + 0.2;
    const hd = (Math.abs(sz) * width + Math.abs(cx) * (0.4 + depth)) / 2 + 0.2;
    c.collide(lx - hw, lx + hw, lz - hd, lz + hd);

    // Routes: clusters of same-colored holds meandering up the section
    for (let rt = 0; rt < routes; rt++) {
      const color = gradePalette[Math.floor(rnd() * gradePalette.length)];
      const holdMat = mat(color, 0.55);
      let hx = -width / 2 + (rt + 0.5) * (width / routes) + (rnd() - 0.5) * 0.4;
      const holds = 7 + Math.floor(rnd() * 7);
      for (let hi = 0; hi < holds; hi++) {
        const t = hi / (holds - 1);
        const hy = 0.35 + t * (height - 0.9);
        hx += (rnd() - 0.5) * 0.55;
        hx = Math.max(-width / 2 + 0.3, Math.min(width / 2 - 0.3, hx));
        const hold = new THREE.Mesh(holdGeo[Math.floor(rnd() * holdGeo.length)], holdMat);
        // Position on the leaned face, pushed slightly off the slab
        const off = 0.28;
        const yLocal = hy * Math.cos(lean);
        const zLocal = hy * Math.sin(lean) + off;
        hold.position.set(
          lx + hx * Math.cos(ry) + zLocal * Math.sin(ry),
          yLocal,
          lz - hx * Math.sin(ry) + zLocal * Math.cos(ry),
        );
        hold.rotation.y = rnd() * Math.PI;
        c.group.add(hold);
      }
    }
    // A couple of volumes
    for (let v = 0; v < Math.max(1, Math.floor(width / 7)); v++) {
      const vw = 0.9 + rnd() * 0.8;
      const vol = new THREE.Mesh(new THREE.ConeGeometry(vw / 2, 0.5, 4), mat(0xd8d5cc, 0.9));
      const vx = -width / 2 + 1 + rnd() * (width - 2);
      const vy = 1 + rnd() * (height - 2.5);
      const zLocal = vy * Math.sin(lean) + 0.35;
      vol.rotation.z = Math.PI / 2;
      vol.rotation.y = rnd() * Math.PI;
      vol.position.set(
        lx + vx * Math.cos(ry) + zLocal * Math.sin(ry),
        vy * Math.cos(lean),
        lz - vx * Math.sin(ry) + zLocal * Math.cos(ry),
      );
      c.group.add(vol);
    }
  };

  // Varied sections around the perimeter: slab, vert, overhang, steep cave
  wallSection(-8, -c.halfD + 1.1, 15, 9.5, -0.1, 0, 7);     // gentle slab, back-left
  wallSection(8, -c.halfD + 1.1, 15, 10, 0.18, 0, 7);       // overhang, back-right
  wallSection(-c.halfW + 1.1, -6, 13, 8.5, 0.05, Math.PI / 2, 6);   // left vert
  wallSection(-c.halfW + 1.6, 8, 10, 9.5, 0.35, Math.PI / 2, 5);    // left steep cave
  wallSection(c.halfW - 1.1, -4, 14, 9, 0.12, -Math.PI / 2, 6);     // right overhang
  wallSection(c.halfW - 1.4, 9, 8, 7, -0.08, -Math.PI / 2, 4);      // right slab

  // Central boulder
  const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), mat(0x98a1ac, 0.95));
  boulder.scale.set(1.4, 0.85, 1.1);
  c.add(boulder, 1, 1.7, -2);
  c.collide(-2.4, 4.4, -4.7, 0.7);
  for (let hi = 0; hi < 26; hi++) {
    const color = gradePalette[hi % gradePalette.length];
    const hold = new THREE.Mesh(holdGeo[hi % holdGeo.length], mat(color, 0.55));
    const ang = rnd() * Math.PI * 2;
    const elev = rnd() * 1.1;
    hold.position.set(
      1 + Math.cos(ang) * 3.4 * 0.98,
      0.5 + elev * 1.6,
      -2 + Math.sin(ang) * 2.6 * 0.98,
    );
    c.group.add(hold);
  }

  // Crash pads under everything
  const pad1 = new THREE.Mesh(new THREE.BoxGeometry(c.halfW * 2 - 2, 0.22, 5), padMat);
  c.add(pad1, 0, 0.13, -c.halfD + 3.4);
  const pad2 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, c.halfD * 2 - 6), padMat);
  c.add(pad2, -c.halfW + 3.4, 0.13, 1);
  const pad3 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.22, c.halfD * 2 - 6), padMat);
  c.add(pad3, c.halfW - 3.4, 0.13, 1);

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
    c.add(framed, 6.5, 2.4, c.halfD - 0.6, Math.PI);
  }

  return c.finish('climb', 'CLIMBING GYM');
}

function studioLevel(i: number, _data?: WorldData): InteriorLevel {
  const c = new Cell(i, 10, 4.2, 13);
  c.shell({ floor: 0x8a8378, wall: 0x6f7480, ceiling: 0x2c2e33, lightColor: 0xeef2ff, lightIntensity: 34 });

  const title = textTexture('STUDIO', 'where the site gets built', 1024, '#9fb6ff');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshStandardMaterial({ map: title, emissive: 0xffffff, emissiveMap: title, emissiveIntensity: 0.55 }),
  );
  c.add(sign, 0, 3.2, -c.halfD + 0.57);

  for (const [lx, lz] of [[-4, -2], [4, -2], [-4, 3], [4, 3]]) {
    c.box(2.4, 0.85, 1.2, mat(0x8a7a63), lx, 0.45, lz);
    const monitor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x10131c, emissive: 0x2a3d5e, emissiveIntensity: 0.9 }),
    );
    c.add(monitor, lx, 1.35, lz - 0.35);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), mat(0xf0ede4, 0.95));
  c.add(board, -c.halfW + 0.58, 2.1, 0, Math.PI / 2);
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
